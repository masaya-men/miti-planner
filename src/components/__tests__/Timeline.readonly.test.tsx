import { describe, it, expect } from "vitest";
import { isJoinerReadonly } from "../Timeline";

describe("isJoinerReadonly", () => {
  it("ジョイナーセッション中(roomToken あり)は true", () => {
    expect(isJoinerReadonly("tok")).toBe(true);
  });
  it("通常(roomToken null)は false", () => {
    expect(isJoinerReadonly(null)).toBe(false);
  });
});
