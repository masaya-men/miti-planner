// client src/lib/collab/yjsPlanData.ts のミラー(別パッケージのため複製)。
// ⚠ キー名/構造を変えたら client 側と必ず揃える(往復が崩れると seed/save が壊れる)。
import * as Y from "yjs";
import { MITIGATIONS_KEY } from "./yjsMitigations";

export const TIMELINE_EVENTS_KEY = "timelineEvents";
export const PHASES_KEY = "phases";
export const LABELS_KEY = "labels";
export const MEMOS_KEY = "memos";
export const PLAN_META_KEY = "planMeta";
export const META_LEVEL = "currentLevel";
export const META_AA = "aaSettings";
export const META_SCH = "schAetherflowPatterns";

type Rec = Record<string, unknown> & { id: string };

/** worker が受付係から受け取る PlanData seed(全フィールド・worker はフィールド型を見ない)。 */
export interface PlanDataSeed {
  mitigations: Rec[];
  timelineEvents?: Rec[];
  phases?: Rec[];
  labels?: Rec[];
  memos?: Rec[];
  currentLevel?: number;
  aaSettings?: Record<string, unknown>;
  schAetherflowPatterns?: Record<string, number>;
}

function recordToYMap(rec: Rec): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(rec)) if (v !== undefined) y.set(k, v);
  return y;
}
function pushAll(doc: Y.Doc, key: string, items: Rec[] | undefined): void {
  if (!items || items.length === 0) return;
  const arr = doc.getArray<Y.Map<unknown>>(key);
  items.forEach((it) => arr.push([recordToYMap(it)]));
}
function readAll(doc: Y.Doc, key: string): Rec[] {
  return doc.getArray<Y.Map<unknown>>(key).toArray().map((y) => y.toJSON() as Rec);
}

/** seed 用: 全 PlanData 要素を載せた新しい Y.Doc を作る(onLoad の返り値)。 */
export function buildSeedDocFull(seed: PlanDataSeed): Y.Doc {
  const doc = new Y.Doc();
  doc.transact(() => {
    pushAll(doc, MITIGATIONS_KEY, seed.mitigations);
    pushAll(doc, TIMELINE_EVENTS_KEY, seed.timelineEvents);
    pushAll(doc, PHASES_KEY, seed.phases);
    pushAll(doc, LABELS_KEY, seed.labels);
    pushAll(doc, MEMOS_KEY, seed.memos);
    const meta = doc.getMap(PLAN_META_KEY);
    if (seed.currentLevel !== undefined) meta.set(META_LEVEL, seed.currentLevel);
    if (seed.aaSettings !== undefined) meta.set(META_AA, seed.aaSettings);
    if (seed.schAetherflowPatterns !== undefined) meta.set(META_SCH, seed.schAetherflowPatterns);
  });
  return doc;
}

/** 書き戻し用: Y.Doc から全 PlanData 要素を読む(onSave で使用)。 */
export function readPlanDataFull(doc: Y.Doc): PlanDataSeed {
  const meta = doc.getMap(PLAN_META_KEY);
  return {
    mitigations: readAll(doc, MITIGATIONS_KEY),
    timelineEvents: readAll(doc, TIMELINE_EVENTS_KEY),
    phases: readAll(doc, PHASES_KEY),
    labels: readAll(doc, LABELS_KEY),
    memos: readAll(doc, MEMOS_KEY),
    currentLevel: meta.get(META_LEVEL) as number | undefined,
    aaSettings: meta.get(META_AA) as Record<string, unknown> | undefined,
    schAetherflowPatterns: meta.get(META_SCH) as Record<string, number> | undefined,
  };
}
