// client 版 src/lib/collab/yjsMitigations.ts のミラー(別パッケージのため複製)。
// ⚠ AppliedMitigation のフィールドを変更したら両方を必ず揃える(yjsMitigations.test.ts が往復検証)。
import * as Y from "yjs";

export const MITIGATIONS_KEY = "timelineMitigations";

export interface MitigationRecord {
  id: string;
  mitigationId: string;
  time: number;
  duration: number;
  ownerId: string;
  targetId?: string;
  linkedMitigationId?: string;
  autoHidden?: boolean;
}

function appliedToYMap(m: MitigationRecord): Y.Map<unknown> {
  const y = new Y.Map<unknown>();
  y.set("id", m.id);
  y.set("mitigationId", m.mitigationId);
  y.set("time", m.time);
  y.set("duration", m.duration);
  y.set("ownerId", m.ownerId);
  if (m.targetId !== undefined) y.set("targetId", m.targetId);
  if (m.linkedMitigationId !== undefined) y.set("linkedMitigationId", m.linkedMitigationId);
  if (m.autoHidden !== undefined) y.set("autoHidden", m.autoHidden);
  return y;
}

function yMapToApplied(y: Y.Map<unknown>): MitigationRecord {
  const m: MitigationRecord = {
    id: y.get("id") as string,
    mitigationId: y.get("mitigationId") as string,
    time: y.get("time") as number,
    duration: y.get("duration") as number,
    ownerId: y.get("ownerId") as string,
  };
  if (y.has("targetId")) m.targetId = y.get("targetId") as string;
  if (y.has("linkedMitigationId")) m.linkedMitigationId = y.get("linkedMitigationId") as string;
  if (y.has("autoHidden")) m.autoHidden = y.get("autoHidden") as boolean;
  return m;
}

/** seed 用: mitigations[] を載せた新しい Y.Doc を作る(onLoad の返り値)。 */
export function buildSeedDoc(mitigations: MitigationRecord[]): Y.Doc {
  const doc = new Y.Doc();
  const arr = doc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY);
  doc.transact(() => {
    mitigations.forEach((m) => arr.push([appliedToYMap(m)]));
  });
  return doc;
}

/** 書き戻し用: Y.Doc から mitigations[] を読む(onSave で使用)。 */
export function readMitigations(doc: Y.Doc): MitigationRecord[] {
  return doc.getArray<Y.Map<unknown>>(MITIGATIONS_KEY).toArray().map(yMapToApplied);
}
