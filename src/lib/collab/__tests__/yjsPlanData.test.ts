import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import type { TimelineEvent, Phase } from "../../../types";
import {
  recordToYMap, yMapToRecord, indexOfById, readArray, applyUpsert, applyRemove,
  readPlanMeta, setMetaField,
  TIMELINE_EVENTS_KEY, PHASES_KEY, PLAN_META_KEY, META_LEVEL, META_AA, META_SCH,
} from "../yjsPlanData";

function bridge(a: Y.Doc, b: Y.Doc) {
  a.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== b) Y.applyUpdate(b, u, a); });
  b.on("update", (u: Uint8Array, origin: unknown) => { if (origin !== a) Y.applyUpdate(a, u, b); });
}
const ev = (over: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: "e1", time: 30, name: { ja: "ボス技", en: "Boss" }, damageType: "magical", ...over,
});
const ph = (over: Partial<Phase> = {}): Phase => ({
  id: "p1", name: { ja: "P1", en: "P1" }, startTime: 0, endTime: 60, ...over,
});

describe("yjsPlanData 変換", () => {
  it("recordToYMap → yMapToRecord で入れ子(LocalizedString)含め往復一致", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY);
    arr.push([recordToYMap(ev({ damageAmount: 9999, warning: true }))]);
    expect(yMapToRecord<TimelineEvent>(arr.get(0))).toEqual(ev({ damageAmount: 9999, warning: true }));
  });
  it("undefined フィールドは set されない(false/空文字に化けない)", () => {
    const doc = new Y.Doc();
    const arr = doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY);
    arr.push([recordToYMap(ev())]);
    const back = yMapToRecord<TimelineEvent>(arr.get(0));
    expect(back.warning).toBeUndefined();
    expect(back.damageAmount).toBeUndefined();
  });
});

describe("yjsPlanData CRDT 同期(配列・id 単位マージ)", () => {
  it("upsert(新規=push) が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(TIMELINE_EVENTS_KEY), [ev({ id: "x" })]);
    expect(readArray<TimelineEvent>(b, TIMELINE_EVENTS_KEY)).toEqual([ev({ id: "x" })]);
  });
  it("upsert(既存=部分更新)で指定フィールドだけ変わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(TIMELINE_EVENTS_KEY), [ev({ id: "x", time: 30 })]);
    applyUpsert(a.getArray(TIMELINE_EVENTS_KEY), [{ id: "x", time: 45 } as TimelineEvent]);
    const got = readArray<TimelineEvent>(b, TIMELINE_EVENTS_KEY)[0];
    expect(got.time).toBe(45);
    expect(got.name).toEqual({ ja: "ボス技", en: "Boss" }); // 他フィールド保持
  });
  it("同時 upsert(別 id)は両方残る", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(PHASES_KEY), [ph({ id: "a1" })]);
    applyUpsert(b.getArray(PHASES_KEY), [ph({ id: "b1" })]);
    expect(readArray<Phase>(a, PHASES_KEY).map((p) => p.id).sort()).toEqual(["a1", "b1"]);
  });
  it("applyRemove(id) が伝わる", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    applyUpsert(a.getArray(PHASES_KEY), [ph({ id: "x" })]);
    applyRemove(a.getArray(PHASES_KEY), ["x"]);
    expect(readArray<Phase>(b, PHASES_KEY)).toEqual([]);
  });
  it("indexOfById は無ければ -1", () => {
    const doc = new Y.Doc();
    expect(indexOfById(doc.getArray(PHASES_KEY), "none")).toBe(-1);
  });
});

describe("yjsPlanData planMeta(スカラー・フィールド単位後勝ち)", () => {
  it("setMetaField → readPlanMeta 往復", () => {
    const a = new Y.Doc(), b = new Y.Doc(); bridge(a, b);
    setMetaField(a, META_LEVEL, 90);
    setMetaField(a, META_AA, { damage: 100, type: "magical", target: "MT" });
    setMetaField(a, META_SCH, { H2: 2 });
    expect(readPlanMeta(b)).toEqual({
      currentLevel: 90,
      aaSettings: { damage: 100, type: "magical", target: "MT" },
      schAetherflowPatterns: { H2: 2 },
    });
  });
  it("未設定の planMeta は全フィールド undefined", () => {
    const doc = new Y.Doc();
    doc.getMap(PLAN_META_KEY); // ensure exists
    expect(readPlanMeta(doc)).toEqual({ currentLevel: undefined, aaSettings: undefined, schAetherflowPatterns: undefined });
  });
});
