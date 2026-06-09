import { describe, it, expect } from "vitest";
import { isJoinerReadonly } from "../Timeline";

describe("isJoinerReadonly", () => {
  it("ジョイナー（roomToken あり）かつ編集不可は true", () => {
    expect(isJoinerReadonly("tok", false)).toBe(true);
  });
  it("ジョイナーでも編集可（canEdit）は false", () => {
    expect(isJoinerReadonly("tok", true)).toBe(false);
  });
  it("通常（roomToken null）は canEdit に関わらず false", () => {
    expect(isJoinerReadonly(null, false)).toBe(false);
    expect(isJoinerReadonly(null, true)).toBe(false);
  });
});
