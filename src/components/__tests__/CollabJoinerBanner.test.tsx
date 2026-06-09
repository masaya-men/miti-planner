import { describe, it, expect } from "vitest";
import { bannerKind } from "../CollabJoinerBanner";

describe("bannerKind（バナー状態判定）", () => {
  it("編集可は edit", () => {
    expect(bannerKind({ isLoggedIn: true, canEdit: true })).toBe("edit");
  });
  it("ログイン済・未同意は consent", () => {
    expect(bannerKind({ isLoggedIn: true, canEdit: false })).toBe("consent");
  });
  it("未ログインは login", () => {
    expect(bannerKind({ isLoggedIn: false, canEdit: false })).toBe("login");
  });
});
