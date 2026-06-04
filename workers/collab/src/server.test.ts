import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("Room (YServer) ", () => {
  it("WebSocket の upgrade 要求に 101 を返す", async () => {
    const res = await SELF.fetch("https://collab.test/parties/room/upgrade-room", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeDefined();
    // YServer は接続直後に Yjs sync step1 を送出する。クライアント側 WebSocket を
    // accept() してからでないと「accept() を呼べ」と runtime が投げるため、
    // close() の前に必ず accept() する(素リレー時は不要だった)。
    res.webSocket?.accept();
    res.webSocket?.close();
  });

  it("接続中は在室数を GET /count で取得できる", async () => {
    const ws = (await SELF.fetch("https://collab.test/parties/room/count-room", {
      headers: { Upgrade: "websocket" },
    })).webSocket!;
    ws.accept();
    try {
      let count = 0;
      for (let i = 0; i < 25; i++) {
        const r = await SELF.fetch("https://collab.test/parties/room/count-room/count");
        count = (await r.json<{ count: number }>()).count;
        if (count >= 1) break;
        await new Promise((res) => setTimeout(res, 20));
      }
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
    for (let i = 0; i < 25; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/close-room/count");
      if ((await r.json<{ count: number }>()).count >= 1) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    ws.close();
    let count = 1;
    for (let i = 0; i < 25; i++) {
      const r = await SELF.fetch("https://collab.test/parties/room/close-room/count");
      count = (await r.json<{ count: number }>()).count;
      if (count === 0) break;
      await new Promise((res) => setTimeout(res, 20));
    }
    expect(count).toBe(0);
  });
});
