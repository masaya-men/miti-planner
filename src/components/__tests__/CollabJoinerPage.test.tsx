import { describe, it, expect } from "vitest";
import { joinerView, computeCanEdit } from "../CollabJoinerPage";

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
