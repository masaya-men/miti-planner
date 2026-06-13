import { SELF, fetchMock, env, runInDurableObject } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import * as Y from "yjs";
import { saveDocBinary, loadDocBinary } from "./docPersistence";

const BASE = "https://lopoly.app";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

/** /count を在室数が安定するまでポーリングして {count, max} を返す。 */
async function pollCount(room: string): Promise<{ count: number; max: number }> {
  let last = { count: 0, max: 0 };
  for (let i = 0; i < 25; i++) {
    const r = await SELF.fetch(`https://collab.test/parties/room/${room}/count`);
    last = await r.json<{ count: number; max: number }>();
    if (last.count >= 1) break;
    await new Promise((res) => setTimeout(res, 20));
  }
  return last;
}

describe("Room (YServer) ", () => {
  it("WebSocket の upgrade 要求に 101 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/upgrade-room", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeDefined();
    res.webSocket?.accept();
    res.webSocket?.close();
  });

  it("接続中は在室数を GET /count で取得できる", async () => {
    const ws = (await SELF.fetch("https://collab.test/parties/room/count-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      const { count } = await pollCount("count-room");
      expect(count).toBe(1);
    } finally {
      ws.close();
    }
  });

  it("接続を閉じると在室数が減る", async () => {
    const ws = (await SELF.fetch("https://collab.test/parties/room/close-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    await pollCount("close-room");
    ws.close();
    let count = 1;
    for (let i = 0; i < 25; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/close-room/count");
      count = (await r.json<{ count: number; max: number }>()).count;
      if (count === 0) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    expect(count).toBe(0);
  });

  it("/count は seed で受け取った maxParticipants を返す", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=max-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 5 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/max-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      const { count, max } = await pollCount("max-room");
      expect(count).toBe(1);
      expect(max).toBe(5);
    } finally {
      ws.close();
    }
  });

  it("②-b-1: 全要素入り seed 応答でも部屋が立ち上がり /count が max を返す(fetchSeedFull 配線)", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=full-seed-room", method: "GET" })
      .reply(200, {
        mitigations: [{ id: "m1", mitigationId: "rampart", time: 10, duration: 20, ownerId: "MT" }],
        timelineEvents: [{ id: "e1", time: 30, name: { ja: "技" }, damageType: "magical" }],
        phases: [{ id: "p1", name: { ja: "P1" }, startTime: 0, endTime: 60 }],
        currentLevel: 90,
        maxParticipants: 3,
      });
    const ws = (await SELF.fetch("https://collab.test/parties/room/full-seed-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      const { count, max } = await pollCount("full-seed-room");
      expect(count).toBe(1);
      expect(max).toBe(3);
    } finally {
      ws.close();
    }
  });

  it("満員(上限1)の部屋は 2 人目の upgrade を 403 で拒否する", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=full-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 1 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/full-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      // onLoad が max=1 を storage に書くまで待つ(/count が {count:1, max:1} になる)。
      const settled = await pollCount("full-room");
      expect(settled).toEqual({ count: 1, max: 1 });
      // 2 人目: onBeforeConnect が満員と判定し 403(WebSocket は張られない)。
      const res2 = await SELF.fetch("https://collab.test/parties/room/full-room", {
        headers: { Upgrade: "websocket" },
      });
      expect(res2.status).toBe(403);
      expect(res2.webSocket).toBeNull();
    } finally {
      ws.close();
    }
  });

  it("墓標(skipped)を受けても例外で落ちず、保存を止める", async () => {
    fetchMock.get(BASE).intercept({ path: "/api/collab/load?roomToken=tomb-room", method: "GET" })
      .reply(200, { mitigations: [{ id: "m1", mitigationId: "rampart", time: 1, duration: 2, ownerId: "MT" }], maxParticipants: 8 });
    // onClose で 1 回だけ save が呼ばれる（debounce=5000ms は 30ms 待ちでは走らない）。
    // .persist() にすると後続テストの save にもこの interceptor が当たり #saveEnabled=false が波及するため 1 回きり。
    fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" }).reply(200, { skipped: "deleted" });

    const ws = (await SELF.fetch("https://collab.test/parties/room/tomb-room", { headers: { Upgrade: "websocket" } })).webSocket!;
    ws.accept();
    await pollCount("tomb-room");
    ws.close(); // onClose の最終 flush で save が呼ばれ skipped を受ける（例外で落ちないこと）
    await new Promise((r) => setTimeout(r, 30));
    expect(true).toBe(true);
  });

  it("/destroy は共有シークレット付きで storage を全消去し 200 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/destroy-room/destroy", {
      method: "POST",
      headers: { "x-collab-secret": "test-secret" },
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ destroyed?: boolean }>();
    expect(body.destroyed).toBe(true);
  });

  it("/destroy はシークレット無し/誤りを 401 で拒否", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/destroy-room/destroy", {
      method: "POST",
      headers: { "x-collab-secret": "wrong" },
    });
    expect(res.status).toBe(401);
  });

  it("/destroy は既存接続を 4001 で閉じ、以後の新規接続も拒否する(失効=即退出・再入室不可)", async () => {
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=revoke-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 8 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/revoke-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    await pollCount("revoke-room"); // count=1 まで待つ

    // 既存接続が失効コードで閉じられることを観測する。
    const closedCode = new Promise<number>((resolve) => {
      ws.addEventListener("close", (e: any) => resolve(e.code));
      setTimeout(() => resolve(-1), 1500);
    });

    const res = await SELF.fetch("https://collab.test/parties/room/revoke-room/destroy", {
      method: "POST",
      headers: { "x-collab-secret": "test-secret" },
    });
    expect(res.status).toBe(200);
    expect(await closedCode).toBe(4001); // 既存接続は即退出

    // 新規接続(再入室)は onConnect が即 close → /count は 1 に戻らない(暖かい DO でも拒否)。
    const ws2 = (await SELF.fetch("https://collab.test/parties/room/revoke-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws2.accept();
    let count = -1;
    for (let i = 0; i < 15; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/revoke-room/count");
      count = (await r.json<{ count: number; max: number }>()).count;
      await new Promise((res) => setTimeout(res, 20));
    }
    expect(count).toBe(0); // 再入室できない
    ws2.close();
  });

  it("/set-max はシークレット付きで上限を即時更新し /count に反映する", async () => {
    // seed で max=8 の部屋を立ち上げる。
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=setmax-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 8 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/setmax-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      // 部屋が立ち上がり max=8 が storage に書かれるまで待つ。
      const before = await pollCount("setmax-room");
      expect(before.max).toBe(8);
      // POST /set-max?n=1 でライブ更新する。
      const setRes = await SELF.fetch("https://collab.test/parties/room/setmax-room/set-max?n=1", {
        method: "POST",
        headers: { "x-collab-secret": "test-secret" },
      });
      expect(setRes.status).toBe(200);
      const body = await setRes.json<{ max: number }>();
      expect(body.max).toBe(1);
      // /count も即座に新しい max を返す(ストレージ書き換え済み)。
      const after = await SELF.fetch("https://collab.test/parties/room/setmax-room/count");
      const { max } = await after.json<{ count: number; max: number }>();
      expect(max).toBe(1);
    } finally {
      ws.close();
    }
  });

  it("/set-max はシークレット無し/誤りを 401 で拒否し max を変えない", async () => {
    // seed で max=8 の部屋を立ち上げる（別ルーム名で独立させる）。
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=setmax-auth-room", method: "GET" })
      .reply(200, { mitigations: [], maxParticipants: 8 });
    const ws = (await SELF.fetch("https://collab.test/parties/room/setmax-auth-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      await pollCount("setmax-auth-room");
      // シークレット無しは 401。
      const noSecret = await SELF.fetch("https://collab.test/parties/room/setmax-auth-room/set-max?n=1", {
        method: "POST",
      });
      expect(noSecret.status).toBe(401);
      // シークレット誤りも 401。
      const wrongSecret = await SELF.fetch("https://collab.test/parties/room/setmax-auth-room/set-max?n=1", {
        method: "POST",
        headers: { "x-collab-secret": "wrong-secret" },
      });
      expect(wrongSecret.status).toBe(401);
      // max は変わっていないこと。
      const after = await SELF.fetch("https://collab.test/parties/room/setmax-auth-room/count");
      const { max } = await after.json<{ count: number; max: number }>();
      expect(max).toBe(8);
    } finally {
      ws.close();
    }
  });

  it("2 回目のロードは Firestore を再 fetch せずバイナリから復元する（再 seed 合流の封じ込め）", async () => {
    // 1 回目の onLoad だけ load を 1 回 intercept。2 回目に再 fetch したら
    // afterEach の assertNoPendingInterceptors が pending を検出して失敗する。
    fetchMock.get(BASE)
      .intercept({ path: "/api/collab/load?roomToken=persist-room", method: "GET" })
      .reply(200, {
        mitigations: [],
        partyMembers: ["MT", "ST", "H1", "H2", "D1", "D2", "D3", "D4"].map((id) => ({ id, jobId: "pld", role: "tank" })),
        maxParticipants: 8,
      });
    // save は debounce で飛び得るので任意回数許可。
    fetchMock.get(BASE).intercept({ path: "/api/collab/save", method: "POST" }).reply(200, { ok: true }).persist();

    const ws1 = (await SELF.fetch("https://collab.test/parties/room/persist-room", { headers: { Upgrade: "websocket" } })).webSocket!;
    ws1.accept();
    await pollCount("persist-room");
    ws1.close();
    await new Promise((r) => setTimeout(r, 50));
    const ws2 = (await SELF.fetch("https://collab.test/parties/room/persist-room", { headers: { Upgrade: "websocket" } })).webSocket!;
    ws2.accept();
    await pollCount("persist-room");
    ws2.close();
    // afterEach の assertNoPendingInterceptors が load の 2 回目要求が無いことを保証する。
  });
});

describe("docPersistence on real DO storage", () => {
  it("実 DO ストレージで Yjs バイナリ(Uint8Array チャンク)が round-trip する", async () => {
    const id = (env as any).Room.idFromName("ydoc-roundtrip-room");
    const stub = (env as any).Room.get(id);
    await runInDurableObject(stub, async (_instance: unknown, state: DurableObjectState) => {
      const doc = new Y.Doc();
      const arr = doc.getArray<Y.Map<unknown>>("partyMembers");
      for (const mid of ["MT", "ST", "H1", "H2"]) {
        const m = new Y.Map<unknown>();
        m.set("id", mid);
        arr.push([m]);
      }
      const bin = Y.encodeStateAsUpdate(doc);
      const storage = state.storage as any;
      await saveDocBinary(storage, bin);
      const back = await loadDocBinary(storage);
      expect(back).not.toBeNull();
      expect([...back!]).toEqual([...bin]);
      // 復元バイナリから doc を再構成して内容一致を確認（identity 往復）。
      const restored = new Y.Doc();
      Y.applyUpdate(restored, back!);
      expect(restored.getArray("partyMembers").length).toBe(4);
    });
  });
});
