import { describe, it, expect, beforeEach } from "vitest";
import { hasCollabEditConsent, setCollabEditConsent } from "../collabEditConsent";

describe("collabEditConsent（部屋ごと同意）", () => {
  beforeEach(() => localStorage.clear());
  it("未同意の部屋は false", () => {
    expect(hasCollabEditConsent("tokA")).toBe(false);
  });
  it("set した部屋だけ true（別の部屋は false のまま）", () => {
    setCollabEditConsent("tokA");
    expect(hasCollabEditConsent("tokA")).toBe(true);
    expect(hasCollabEditConsent("tokB")).toBe(false);
  });
  it("複数部屋の同意が独立に積み上がる", () => {
    setCollabEditConsent("tokA");
    setCollabEditConsent("tokB");
    expect(hasCollabEditConsent("tokA")).toBe(true);
    expect(hasCollabEditConsent("tokB")).toBe(true);
  });
  it("壊れた localStorage 値でも throw せず false", () => {
    localStorage.setItem("lopo_collab_edit_consent", "{not json");
    expect(hasCollabEditConsent("tokA")).toBe(false);
  });
});
