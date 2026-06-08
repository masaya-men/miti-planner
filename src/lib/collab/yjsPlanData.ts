import * as Y from "yjs";
import type { TimelineEvent, Phase, Label, PlanMemo } from "../../types";

/** ②-b-1 で同期する Y.Doc トップレベルのキー(②-a の timelineMitigations と並ぶ)。 */
export const TIMELINE_EVENTS_KEY = "timelineEvents";
export const PHASES_KEY = "phases";
export const LABELS_KEY = "labels";
export const MEMOS_KEY = "memos";
export const PLAN_META_KEY = "planMeta";

/** planMeta(Y.Map)内のスカラーキー。 */
export const META_LEVEL = "currentLevel";
export const META_AA = "aaSettings";
export const META_SCH = "schAetherflowPatterns";

/** 配列同期キーの型(events/phases/labels/memos)。 */
export type PlanArrayKey =
  | typeof TIMELINE_EVENTS_KEY | typeof PHASES_KEY | typeof LABELS_KEY | typeof MEMOS_KEY;

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
