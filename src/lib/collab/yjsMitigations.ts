import * as Y from "yjs";
import type { AppliedMitigation } from "../../types";

/** Y.Doc トップレベルの軽減配置キー(②-b 以降も同じ Y.Doc にキーを並べる)。 */
export const YJS_MITIGATIONS_KEY = "timelineMitigations";

/** AppliedMitigation を 1 個の Y.Map に変換。任意フィールドは値があるときだけ set。 */
export function appliedToYMap(m: AppliedMitigation): Y.Map<unknown> {
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

/** Y.Map → AppliedMitigation。未設定の任意フィールドは undefined のまま。 */
export function yMapToApplied(y: Y.Map<unknown>): AppliedMitigation {
  const m: AppliedMitigation = {
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

/** Y.Doc から軽減配置の配列を読む。 */
export function readMitigations(doc: Y.Doc): AppliedMitigation[] {
  return doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY).toArray().map(yMapToApplied);
}

/** Y.Array 内で id に一致する要素の index を返す(なければ -1)。 */
export function indexOfMitigation(arr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < arr.length; i++) {
    if (arr.get(i).get("id") === id) return i;
  }
  return -1;
}
