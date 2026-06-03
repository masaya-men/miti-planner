import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Room", () => {
  it("WebSocket の upgrade 要求に 101 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/test-room", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
  });

  it("ある接続のメッセージを、他の在室者へ中継する", async () => {
    const url = "https://collab.test/parties/room/broadcast-room";

    const resA = await SELF.fetch(url, { headers: { Upgrade: "websocket" } });
    const resB = await SELF.fetch(url, { headers: { Upgrade: "websocket" } });
    const a = resA.webSocket!;
    const b = resB.webSocket!;
    a.accept();
    b.accept();

    try {
      const receivedByB = new Promise<string>((resolve) => {
        b.addEventListener("message", (e: MessageEvent) => resolve(e.data as string));
      });

      a.send("hello-from-a");
      expect(await receivedByB).toBe("hello-from-a");
    } finally {
      // 状態汚染防止: 失敗時も含め必ず開いた WebSocket を閉じる
      a.close();
      b.close();
    }
  });

  it("中継は送信者自身には返らない", async () => {
    const url = "https://collab.test/parties/room/no-echo-room";

    const a = (await SELF.fetch(url, { headers: { Upgrade: "websocket" } })).webSocket!;
    const b = (await SELF.fetch(url, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();
    b.accept();

    try {
      let aGotEcho = false;
      a.addEventListener("message", () => { aGotEcho = true; });
      const receivedByB = new Promise<string>((resolve) => {
        b.addEventListener("message", (e: MessageEvent) => resolve(e.data as string));
      });

      a.send("ping");
      await receivedByB; // B が受け取るまで待つ
      // A へのエコー(あれば)がマイクロタスク/タスクキューに残っている可能性を
      // 排出してから判定する。「B 受信 = A 受信済み」という暗黙の仮定に頼らず、
      // 送信者除外の漏れを確実に検出するため。
      await new Promise((r) => setTimeout(r, 0));
      expect(aGotEcho).toBe(false);
    } finally {
      // 状態汚染防止: 失敗時も含め必ず開いた WebSocket を閉じる
      a.close();
      b.close();
    }
  });

  it("WebSocket 接続中は、在室数を HTTP GET で取得できる", async () => {
    const wsUrl = "https://collab.test/parties/room/count-room";
    const countUrl = "https://collab.test/parties/room/count-room/count";

    const a = (await SELF.fetch(wsUrl, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();

    try {
      const res = await SELF.fetch(countUrl);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { count: number };
      expect(body.count).toBe(1);
    } finally {
      a.close();
    }
  });

  it("接続を閉じると在室数が減る", async () => {
    const wsUrl = "https://collab.test/parties/room/leave-room";
    const countUrl = "https://collab.test/parties/room/leave-room/count";

    const a = (await SELF.fetch(wsUrl, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();
    expect(((await (await SELF.fetch(countUrl)).json()) as { count: number }).count).toBe(1);

    // close() を呼んだ後、サーバー側 onClose が反映されるまで HTTP GET でポーリング
    // する (固定 setTimeout 1回だと CI 負荷で偽陰性になりうるため、最大 ~500ms リトライ)。
    a.close();
    let after = { count: 1 };
    for (let i = 0; i < 10; i++) {
      after = (await (await SELF.fetch(countUrl)).json()) as { count: number };
      if (after.count === 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(after.count).toBe(0);
  });
});
