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

    const receivedByB = new Promise<string>((resolve) => {
      b.addEventListener("message", (e) => resolve(e.data as string));
    });

    a.send("hello-from-a");
    expect(await receivedByB).toBe("hello-from-a");

    // 状態汚染防止: 開いた WebSocket を閉じる
    a.close();
    b.close();
  });

  it("中継は送信者自身には返らない", async () => {
    const url = "https://collab.test/parties/room/no-echo-room";

    const a = (await SELF.fetch(url, { headers: { Upgrade: "websocket" } })).webSocket!;
    const b = (await SELF.fetch(url, { headers: { Upgrade: "websocket" } })).webSocket!;
    a.accept();
    b.accept();

    let aGotEcho = false;
    a.addEventListener("message", () => { aGotEcho = true; });
    const receivedByB = new Promise<string>((resolve) => {
      b.addEventListener("message", (e) => resolve(e.data as string));
    });

    a.send("ping");
    await receivedByB; // B が受け取るまで待つ
    expect(aGotEcho).toBe(false);

    // 状態汚染防止: 開いた WebSocket を閉じる
    a.close();
    b.close();
  });
});
