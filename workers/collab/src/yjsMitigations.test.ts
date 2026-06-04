import { describe, it, expect } from "vitest";
import { buildSeedDoc, readMitigations, type MitigationRecord, MITIGATIONS_KEY } from "./yjsMitigations";

const m = (id: string, time = 10): MitigationRecord => ({
  id, mitigationId: "rampart", time, duration: 20, ownerId: "MT",
});

describe("yjsMitigations (worker mirror)", () => {
  it("buildSeedDoc → readMitigations で往復一致", () => {
    const doc = buildSeedDoc([m("a", 5), m("b", 30)]);
    expect(readMitigations(doc)).toEqual([m("a", 5), m("b", 30)]);
  });

  it("任意フィールドは値があるときだけ載る", () => {
    const full: MitigationRecord = { ...m("c"), targetId: "ST", linkedMitigationId: "x", autoHidden: true };
    const doc = buildSeedDoc([full]);
    expect(readMitigations(doc)[0]).toEqual(full);
  });

  it("client 版と同じトップレベルキー名を使う", () => {
    expect(MITIGATIONS_KEY).toBe("timelineMitigations");
  });
});
