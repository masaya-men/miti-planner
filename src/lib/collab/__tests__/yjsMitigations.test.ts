import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { AppliedMitigation } from "../../../types";
import {
  appliedToYMap,
  yMapToApplied,
  readMitigations,
  YJS_MITIGATIONS_KEY,
} from "../yjsMitigations";

function bridge(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== b) Y.applyUpdate(b, u, a); });
  b.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== a) Y.applyUpdate(a, u, b); });
}
const sample = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
  id: "m1", mitigationId: "rampart_pld", time: 30, duration: 20, ownerId: "MT", ...over,
});

describe("yjsMitigations 変換", () => {
  it("appliedToYMap → yMapToApplied で往復一致(任意フィールド含む)", () => {
    const orig = sample({ targetId: "ST", linkedMitigationId: "x", autoHidden: true });
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    arr.push([appliedToYMap(orig)]);
    expect(yMapToApplied(arr.get(0))).toEqual(orig);
  });
  it("未指定の任意フィールドは undefined のまま(空文字や false に化けない)", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    arr.push([appliedToYMap(sample())]);
    const back = yMapToApplied(arr.get(0));
    expect(back.targetId).toBeUndefined();
    expect(back.autoHidden).toBeUndefined();
  });
});

describe("yjsMitigations CRDT 同期", () => {
  it("A の add が B に伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    a.getArray(YJS_MITIGATIONS_KEY).push([appliedToYMap(sample())]);
    expect(readMitigations(b)).toEqual([sample()]);
  });
  it("同時 add で両方残る(衝突なしマージ)", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    a.getArray(YJS_MITIGATIONS_KEY).push([appliedToYMap(sample({ id: "a1" }))]);
    b.getArray(YJS_MITIGATIONS_KEY).push([appliedToYMap(sample({ id: "b1", ownerId: "H1" }))]);
    expect(readMitigations(a).map((m) => m.id).sort()).toEqual(["a1", "b1"]);
    expect(readMitigations(b).map((m) => m.id).sort()).toEqual(["a1", "b1"]);
  });
  it("updateMitigationTime 相当(Y.Map の time set)が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    const arr = a.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    arr.push([appliedToYMap(sample({ id: "m1", time: 30 }))]);
    arr.get(0).set("time", 45);
    expect(readMitigations(b)[0].time).toBe(45);
  });
  it("remove(index delete)が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    const arr = a.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY);
    arr.push([appliedToYMap(sample({ id: "m1" }))]);
    arr.delete(0, 1);
    expect(readMitigations(b)).toEqual([]);
  });
});
