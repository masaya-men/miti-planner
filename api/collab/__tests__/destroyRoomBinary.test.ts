import { describe, it, expect, vi } from "vitest";
import { destroyRoomBinary } from "../_roomDestroy.js";

describe("destroyRoomBinary", () => {
  it("worker の /destroy を共有シークレットで叩く", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await destroyRoomBinary("https://lopo-collab.example", "sec", "tokenABC", fetchImpl as any);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://lopo-collab.example/parties/room/tokenABC/destroy",
      expect.objectContaining({ method: "POST", headers: { "x-collab-secret": "sec" } }),
    );
  });

  it("失敗しても例外を投げない（best-effort）", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("net"));
    await expect(destroyRoomBinary("https://x", "sec", "t", fetchImpl as any)).resolves.toBeUndefined();
  });

  it("引数が欠けたら何もしない（fetch 未呼び出し）", async () => {
    const fetchImpl = vi.fn();
    await destroyRoomBinary("", "sec", "t", fetchImpl as any);
    await destroyRoomBinary("https://x", "", "t", fetchImpl as any);
    await destroyRoomBinary("https://x", "sec", "", fetchImpl as any);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
