import { describe, it, expect } from "vitest";
import { resolveContentId } from "../Timeline";

describe("resolveContentId(ジョイナーフォールバック)", () => {
  it("SavedPlan の contentId を優先", () => {
    expect(resolveContentId("m4s", "other")).toBe("m4s");
  });
  it("SavedPlan が無ければジョイナーセッションの contentId", () => {
    expect(resolveContentId(null, "m4s")).toBe("m4s");
  });
  it("どちらも無ければ null", () => {
    expect(resolveContentId(null, null)).toBeNull();
  });
});
