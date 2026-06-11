import { describe, it, expect } from "vitest";
import { shouldGcRoom } from "../_collabGcLogic.js";

const DAY = 86_400_000;
describe("shouldGcRoom", () => {
  const now = 1_000 * DAY;
  it("revoked かつ 7 日より古い → 掃除対象", () => {
    expect(shouldGcRoom({ revoked: true, createdAt: now - 8 * DAY }, now, 7)).toBe(true);
  });
  it("revoked でも 7 日以内 → 残す", () => {
    expect(shouldGcRoom({ revoked: true, createdAt: now - 1 * DAY }, now, 7)).toBe(false);
  });
  it("有効な部屋は対象外", () => {
    expect(shouldGcRoom({ revoked: false, createdAt: now - 100 * DAY }, now, 7)).toBe(false);
  });
  it("createdAt 欠落は安全側で残す", () => {
    expect(shouldGcRoom({ revoked: true }, now, 7)).toBe(false);
  });
});
