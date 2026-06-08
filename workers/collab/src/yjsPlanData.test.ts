import { describe, it, expect } from "vitest";
import {
  buildSeedDocFull, readPlanDataFull, type PlanDataSeed,
} from "./yjsPlanData";

const seed: PlanDataSeed = {
  mitigations: [{ id: "m1", mitigationId: "rampart", time: 10, duration: 20, ownerId: "MT" }],
  timelineEvents: [{ id: "e1", time: 30, name: { ja: "技", en: "x" }, damageType: "magical" }],
  phases: [{ id: "p1", name: { ja: "P1", en: "P1" }, startTime: 0, endTime: 60 }],
  labels: [{ id: "l1", name: { ja: "L", en: "L" }, startTime: 5, endTime: 10 }],
  memos: [{ id: "mo1", text: "hi", timeSec: 12, xRatio: 0.5, createdAt: 1, updatedAt: 1 }],
  currentLevel: 90,
  aaSettings: { damage: 100, type: "magical", target: "MT" },
  schAetherflowPatterns: { H2: 2 },
};

describe("worker yjsPlanData seed/read 往復", () => {
  it("buildSeedDocFull で組んだ Y.Doc を readPlanDataFull で読むと元に一致", () => {
    const doc = buildSeedDocFull(seed);
    expect(readPlanDataFull(doc)).toEqual(seed);
  });
  it("欠落フィールドは空配列/undefined にフォールバック", () => {
    const doc = buildSeedDocFull({ mitigations: [] });
    const out = readPlanDataFull(doc);
    expect(out.mitigations).toEqual([]);
    expect(out.timelineEvents).toEqual([]);
    expect(out.phases).toEqual([]);
    expect(out.labels).toEqual([]);
    expect(out.memos).toEqual([]);
    expect(out.currentLevel).toBeUndefined();
    expect(out.aaSettings).toBeUndefined();
    expect(out.schAetherflowPatterns).toBeUndefined();
  });
});
