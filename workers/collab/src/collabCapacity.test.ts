// workers/collab/src/collabCapacity.test.ts
import { describe, it, expect } from "vitest";
import {
  isRoomFull,
  resolveMaxParticipants,
  DEFAULT_MAX_PARTICIPANTS,
  SYSTEM_MAX_PARTICIPANTS,
  MAX_PARTICIPANTS_KEY,
} from "./collabCapacity";

describe("isRoomFull", () => {
  it("在室数が上限未満なら満員でない", () => {
    expect(isRoomFull(0, 8)).toBe(false);
    expect(isRoomFull(7, 8)).toBe(false);
  });
  it("在室数が上限と等しい/超過なら満員", () => {
    expect(isRoomFull(8, 8)).toBe(true);
    expect(isRoomFull(9, 8)).toBe(true);
  });
  it("上限 1 の部屋は 1 人目で満員", () => {
    expect(isRoomFull(0, 1)).toBe(false);
    expect(isRoomFull(1, 1)).toBe(true);
  });
});

describe("resolveMaxParticipants", () => {
  it("未保存(undefined)は既定 8", () => {
    expect(resolveMaxParticipants(undefined)).toBe(DEFAULT_MAX_PARTICIPANTS);
    expect(DEFAULT_MAX_PARTICIPANTS).toBe(8);
  });
  it("非数(NaN/Infinity)は既定 8", () => {
    expect(resolveMaxParticipants(NaN)).toBe(8);
    expect(resolveMaxParticipants(Infinity)).toBe(8);
  });
  it("範囲内はそのまま(小数は切り捨て)", () => {
    expect(resolveMaxParticipants(4)).toBe(4);
    expect(resolveMaxParticipants(4.9)).toBe(4);
  });
  it("[1, SYSTEM_MAX] に丸める", () => {
    expect(resolveMaxParticipants(0)).toBe(1);
    expect(resolveMaxParticipants(-5)).toBe(1);
    expect(resolveMaxParticipants(999)).toBe(SYSTEM_MAX_PARTICIPANTS);
    expect(SYSTEM_MAX_PARTICIPANTS).toBe(20);
  });
});

describe("MAX_PARTICIPANTS_KEY", () => {
  it("storage キーは衝突しにくい名前空間付き", () => {
    expect(MAX_PARTICIPANTS_KEY).toBe("collab:maxParticipants");
  });
});
