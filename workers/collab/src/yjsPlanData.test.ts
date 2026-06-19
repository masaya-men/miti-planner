import { describe, it, expect } from "vitest";
import {
  buildSeedDocFull, readPlanDataFull, readContentId, readOwnerLabel, type PlanDataSeed,
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
  partyMembers: [{ id: "MT", jobId: "pld", role: "tank", stats: { hp: 100, mainStat: 1, det: 1, crt: 1, ten: 1, ss: 1, wd: 1 }, computedValues: { Rampart: 20 } }],
  contentId: "m4s",
  ownerLabel: "土曜固定P",
};

describe("worker yjsPlanData seed/read 往復", () => {
  it("buildSeedDocFull で組んだ Y.Doc を readPlanDataFull で読むと元に一致(contentId/ownerLabel/progressPoints 系は除外)", () => {
    const doc = buildSeedDocFull(seed);
    // contentId/ownerLabel は save 非対象。progressPoints 系は seed に含まれず空/undefined になるため除外して比較。
    const { contentId, ownerLabel, ...rest } = seed;
    const out = readPlanDataFull(doc);
    const { progressPoints, progressCleared, progressActiveDays, progressActiveHours, ...outRest } = out;
    expect(outRest).toEqual(rest);
    expect(progressPoints).toEqual([]);
    expect(progressCleared).toBeUndefined();
    expect(progressActiveDays).toBeUndefined();
    expect(progressActiveHours).toBeUndefined();
  });
  it("contentId は planMeta に seed され readContentId で読める", () => {
    const doc = buildSeedDocFull(seed);
    expect(readContentId(doc)).toBe("m4s");
  });
  it("ownerLabel は planMeta に seed され readOwnerLabel で読める", () => {
    const doc = buildSeedDocFull(seed);
    expect(readOwnerLabel(doc)).toBe("土曜固定P");
  });
  it("欠落フィールドは空配列/undefined にフォールバック", () => {
    const doc = buildSeedDocFull({ mitigations: [] });
    const out = readPlanDataFull(doc);
    expect(out.mitigations).toEqual([]);
    expect(out.timelineEvents).toEqual([]);
    expect(out.phases).toEqual([]);
    expect(out.labels).toEqual([]);
    expect(out.memos).toEqual([]);
    expect(out.partyMembers).toEqual([]);
    expect(out.currentLevel).toBeUndefined();
    expect(out.aaSettings).toBeUndefined();
    expect(out.schAetherflowPatterns).toBeUndefined();
  });
  it("progressPoints と進捗 meta が seed→read で往復する", () => {
    const doc = buildSeedDocFull({
      mitigations: [],
      progressPoints: [{ id: "pt_a", ts: 1, reachedPos: 10 }],
      progressCleared: true,
      progressActiveDays: 5,
      progressActiveHours: 9,
    });
    const out = readPlanDataFull(doc);
    expect(out.progressPoints).toEqual([{ id: "pt_a", ts: 1, reachedPos: 10 }]);
    expect(out.progressCleared).toBe(true);
    expect(out.progressActiveDays).toBe(5);
    expect(out.progressActiveHours).toBe(9);
  });
});
