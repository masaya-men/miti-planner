import * as Y from "yjs";
import type { TimelineEvent, Phase, Label, PlanMemo } from "../../types";

/** ②-b-1 で同期する Y.Doc トップレベルのキー(②-a の timelineMitigations と並ぶ)。 */
export const TIMELINE_EVENTS_KEY = "timelineEvents";
export const PHASES_KEY = "phases";
export const LABELS_KEY = "labels";
export const MEMOS_KEY = "memos";
/** ②-b-2: パーティ編成の Y.Array キー（events 等と並ぶトップレベル）。 */
export const PARTY_MEMBERS_KEY = "partyMembers";
/** ②-b-2: mitigations Y.Array キー（②-a の YJS_MITIGATIONS_KEY と同値。汎用 batch 経路で使う）。 */
export const MITIGATIONS_KEY = "timelineMitigations";
export const PLAN_META_KEY = "planMeta";

/** planMeta(Y.Map)内のスカラーキー。 */
export const META_LEVEL = "currentLevel";
export const META_AA = "aaSettings";
export const META_SCH = "schAetherflowPatterns";

/** 配列同期キーの型（events/phases/labels/memos + ②-b-2 で partyMembers/timelineMitigations）。 */
export type PlanArrayKey =
  | typeof TIMELINE_EVENTS_KEY | typeof PHASES_KEY | typeof LABELS_KEY | typeof MEMOS_KEY
  | typeof PARTY_MEMBERS_KEY | typeof MITIGATIONS_KEY;

/** AASettings 型(PlanData.aaSettings 相当・store の setAaSettings と同一)。 */
export interface AASettings {
  damage: number;
  type: "physical" | "magical" | "unavoidable";
  target: "MT" | "ST";
}

export interface PlanMetaSlice {
  currentLevel?: number;
  aaSettings?: AASettings;
  schAetherflowPatterns?: Record<string, 1 | 2>;
}

/** プレーン record(id 必須)→ Y.Map。undefined は set しない(②-a appliedToYMap と同方針)。 */
export function recordToYMap<T extends { id: string }>(rec: T): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(rec)) {
    if (v !== undefined) y.set(k, v);
  }
  return y;
}

/** Y.Map → record。toJSON で入れ子オブジェクト(LocalizedString 等)も復元。 */
export function yMapToRecord<T>(y: Y.Map<unknown>): T {
  return y.toJSON() as T;
}

/** id 一致要素の index(なければ -1)。 */
export function indexOfById(arr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < arr.length; i++) if (arr.get(i).get("id") === id) return i;
  return -1;
}

/** Y.Doc 配列キーを plain record 配列で読む。 */
export function readArray<T>(doc: Y.Doc, key: string): T[] {
  return doc.getArray<Y.Map<unknown>>(key).toArray().map((y) => yMapToRecord<T>(y));
}

/** delta upsert: 既存 id は与えられたフィールドだけ set(部分更新)、新規 id は push(全フィールド)。 */
export function applyUpsert(arr: Y.Array<Y.Map<unknown>>, items: Array<{ id: string }>): void {
  for (const item of items) {
    const idx = indexOfById(arr, item.id);
    if (idx < 0) {
      arr.push([recordToYMap(item)]);
    } else {
      const ym = arr.get(idx);
      for (const [k, v] of Object.entries(item)) {
        if (v !== undefined && ym.get(k) !== v) ym.set(k, v);
      }
    }
  }
}

/** delta remove: id 配列を順に削除(毎回 index 取り直しで index ずれに安全)。 */
export function applyRemove(arr: Y.Array<Y.Map<unknown>>, ids: string[]): void {
  for (const id of ids) {
    const idx = indexOfById(arr, id);
    if (idx >= 0) arr.delete(idx, 1);
  }
}

/** 全置換: 既存要素を全消去してから items を push（bulk 操作・原子性は呼び出し側の transact が担保）。 */
export function applyReplace(arr: Y.Array<Y.Map<unknown>>, items: Array<{ id: string }>): void {
  if (arr.length > 0) arr.delete(0, arr.length);
  for (const item of items) arr.push([recordToYMap(item)]);
}

/** batch ハンドラの 1 操作。upsert/remove/replace を任意キーへ。 */
export interface BatchOp {
  kind: "upsert" | "remove" | "replace";
  key: PlanArrayKey;
  /** id 必須・他フィールドは任意(PartyMember/AppliedMitigation/TimelineEvent 等を横断するため id だけ要求)。 */
  items?: Array<{ id: string }>;
  ids?: string[];
}

/** Y.Doc の全 PlanArrayKey → Y.Array の対応表（collabProvider と test で共有）。 */
export function buildArrByKey(doc: Y.Doc): Record<PlanArrayKey, Y.Array<Y.Map<unknown>>> {
  return {
    [TIMELINE_EVENTS_KEY]: doc.getArray<Y.Map<unknown>>(TIMELINE_EVENTS_KEY),
    [PHASES_KEY]: doc.getArray<Y.Map<unknown>>(PHASES_KEY),
    [LABELS_KEY]: doc.getArray<Y.Map<unknown>>(LABELS_KEY),
    [MEMOS_KEY]: doc.getArray<Y.Map<unknown>>(MEMOS_KEY),
    [PARTY_MEMBERS_KEY]: doc.getArray<Y.Map<unknown>>(PARTY_MEMBERS_KEY),
    [MITIGATIONS_KEY]: doc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY),
  };
}

/** 複数キーの操作を 1 つの doc.transact（origin='local'）で原子的に適用する。 */
export function applyBatch(
  doc: Y.Doc,
  arrByKey: Record<PlanArrayKey, Y.Array<Y.Map<unknown>>>,
  ops: BatchOp[],
): void {
  doc.transact(() => {
    for (const op of ops) {
      const arr = arrByKey[op.key];
      if (op.kind === "upsert") applyUpsert(arr, op.items ?? []);
      else if (op.kind === "remove") applyRemove(arr, op.ids ?? []);
      else applyReplace(arr, op.items ?? []);
    }
  }, "local");
}

/** planMeta の 1 フィールドを set。 */
export function setMetaField(doc: Y.Doc, field: string, value: unknown): void {
  doc.getMap(PLAN_META_KEY).set(field, value);
}

/** planMeta を slice で読む。 */
export function readPlanMeta(doc: Y.Doc): PlanMetaSlice {
  const meta = doc.getMap(PLAN_META_KEY);
  return {
    currentLevel: meta.get(META_LEVEL) as number | undefined,
    aaSettings: meta.get(META_AA) as AASettings | undefined,
    schAetherflowPatterns: meta.get(META_SCH) as Record<string, 1 | 2> | undefined,
  };
}

/** 型エクスポート(consumer の参照用)。 */
export type { TimelineEvent, Phase, Label, PlanMemo };
