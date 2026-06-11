import { SELF, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach } from "vitest";

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
