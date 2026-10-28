/**
 * src/lib/collab(client)と workers/collab/src(Worker)は別パッケージのため同名の関数を複製している
 * (appliedToYMap / yMapToApplied / readMitigations / readContentId / readOwnerLabel)。
 * 両方を同じ入力で呼び、結果が一致し続けることを確かめる(片方だけ直して食い違うのを防ぐ)。
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  appliedToYMap,
  yMapToApplied,
  readMitigations as clientReadMitigations,
  YJS_MITIGATIONS_KEY,
} from "../yjsMitigations";
import { readContentId, readOwnerLabel } from "../yjsPlanData";
import {
  buildSeedDoc,
  readMitigations as workerReadMitigations,
  MITIGATIONS_KEY,
} from "../../../../workers/collab/src/yjsMitigations";
import { buildSeedDocFull } from "../../../../workers/collab/src/yjsPlanData";

const SAMPLES = [
  { id: "a", mitigationId: "m1", time: 10, duration: 20, ownerId: "MT" },
  { id: "b", mitigationId: "m2", time: 5.5, duration: 0, ownerId: "H1", targetId: "ST", linkedMitigationId: "a", autoHidden: true },
  { id: "c", mitigationId: "m3", time: 0, duration: 1, ownerId: "D1", autoHidden: false },
];

describe("client と Worker の同名関数が一致する", () => {
  it("軽減の保存キーが同じ", () => {
    expect(MITIGATIONS_KEY).toBe(YJS_MITIGATIONS_KEY);
  });

  it("Worker が組んだ doc を client が読んでも、client が組んだ doc を Worker が読んでも同じ", () => {
    const workerDoc = buildSeedDoc(SAMPLES);
    expect(clientReadMitigations(workerDoc)).toEqual(SAMPLES);

    const clientDoc = new Y.Doc();
    const arr = clientDoc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    SAMPLES.forEach((m) => arr.push([appliedToYMap(m)]));
    expect(workerReadMitigations(clientDoc)).toEqual(SAMPLES);
    expect(clientReadMitigations(clientDoc)).toEqual(workerReadMitigations(clientDoc));
  });

  it("yMapToApplied は Worker 側の Y.Map でも同じ結果", () => {
    const workerDoc = buildSeedDoc(SAMPLES);
    const ys = workerDoc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY).toArray();
    expect(ys.map(yMapToApplied)).toEqual(workerReadMitigations(workerDoc));
  });

  it("readContentId / readOwnerLabel は Worker が seed した値を読める", () => {
    const doc = buildSeedDocFull({ mitigations: [], partyMembers: [], contentId: "c1", ownerLabel: "label" });
    expect(readContentId(doc)).toBe("c1");
    expect(readOwnerLabel(doc)).toBe("label");
  });
});
