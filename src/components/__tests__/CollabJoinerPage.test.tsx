import { describe, it, expect, vi } from "vitest";
import { joinerView, computeCanEdit, rehydrateThenClearReadonly } from "../CollabJoinerPage";

describe("joinerView(状態 → 表示種別)", () => {
  it("未同期は connecting", () => {
    expect(joinerView({ synced: false, invalid: false, full: false })).toBe("connecting");
  });
  it("invalid(失効/不存在)は invalid", () => {
    expect(joinerView({ synced: true, invalid: true, full: false })).toBe("invalid");
  });
  it("満員は full", () => {
    expect(joinerView({ synced: false, invalid: false, full: true })).toBe("full");
  });
  it("同期済みは sheet", () => {
    expect(joinerView({ synced: true, invalid: false, full: false })).toBe("sheet");
  });
  it("full は invalid/connecting より優先", () => {
    expect(joinerView({ synced: true, invalid: true, full: true })).toBe("full");
  });
});

describe("computeCanEdit", () => {
  it("ログイン && 同意 で true", () => {
    expect(computeCanEdit(true, true)).toBe(true);
  });
  it("未ログイン or 未同意 は false", () => {
    expect(computeCanEdit(false, true)).toBe(false);
    expect(computeCanEdit(true, false)).toBe(false);
    expect(computeCanEdit(false, false)).toBe(false);
  });
});

// 退室 cleanup: rehydrate(自分のソロ state を store へ戻す)→ 完了後 readonly 解除。
// zustand persist は同期 storage のとき .finally を持たない最小 thenable を返すため、
// 素朴に `rehydrate()?.finally(...)` するとジョイナーページ離脱で crash する(本番/StrictMode)。
describe("rehydrateThenClearReadonly", () => {
  it("rehydrate が .finally を持たない最小 thenable(同期 storage)でも clearReadonly を呼ぶ", async () => {
    const minimalThenable = { then: (cb: () => void) => { cb(); } }; // .finally なし(zustand 同期版を模倣)
    const clear = vi.fn();
    await rehydrateThenClearReadonly(() => minimalThenable, clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("rehydrate が undefined を返しても clearReadonly を呼ぶ", async () => {
    const clear = vi.fn();
    await rehydrateThenClearReadonly(() => undefined, clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("rehydrate が本物の Promise でも clearReadonly を呼ぶ", async () => {
    const clear = vi.fn();
    await rehydrateThenClearReadonly(() => Promise.resolve(), clear);
    expect(clear).toHaveBeenCalledTimes(1);
  });
  it("順序: clearReadonly は rehydrate の後", async () => {
    const order: string[] = [];
    await rehydrateThenClearReadonly(
      () => { order.push("rehydrate"); return undefined; },
      () => order.push("clear"),
    );
    expect(order).toEqual(["rehydrate", "clear"]);
  });
});
