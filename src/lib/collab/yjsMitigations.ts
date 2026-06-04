import * as Y from "yjs";
import type { AppliedMitigation } from "../../types";

/** Y.Doc トップレベルの軽減配置キー(②-b 以降も同じ Y.Doc にキーを並べる)。 */
export const YJS_MITIGATIONS_KEY = "timelineMitigations";

/**
 * Y.Map から key の値を読む。
 *
 * Yjs の Y.Map は「ドキュメント未統合(detached)」状態だと .get()/.has() が
 * "Invalid access: Add Yjs type to a document before reading data." で読めず、
 * 値は内部の _prelimContent(JS Map)に保持される。統合後は _prelimContent が
 * null になり .get()/.has() が正となる。両状態を透過的に読むためのアクセサ。
 */
function readKey(y: Y.Map<unknown>, key: string): { has: boolean; value: unknown } {
  const prelim = (y as unknown as { _prelimContent: Map<string, unknown> | null })._prelimContent;
  if (prelim) {
    return { has: prelim.has(key), value: prelim.get(key) };
  }
  return { has: y.has(key), value: y.get(key) };
}

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
    id: readKey(y, "id").value as string,
    mitigationId: readKey(y, "mitigationId").value as string,
    time: readKey(y, "time").value as number,
    duration: readKey(y, "duration").value as number,
    ownerId: readKey(y, "ownerId").value as string,
  };
  const targetId = readKey(y, "targetId");
  if (targetId.has) m.targetId = targetId.value as string;
  const linked = readKey(y, "linkedMitigationId");
  if (linked.has) m.linkedMitigationId = linked.value as string;
  const autoHidden = readKey(y, "autoHidden");
  if (autoHidden.has) m.autoHidden = autoHidden.value as boolean;
  return m;
}

/** Y.Doc から軽減配置の配列を読む。 */
export function readMitigations(doc: Y.Doc): AppliedMitigation[] {
  return doc.getArray<Y.Map<unknown>>(YJS_MITIGATIONS_KEY).toArray().map(yMapToApplied);
}

/** Y.Array 内で id に一致する要素の index を返す(なければ -1)。 */
export function indexOfMitigation(arr: Y.Array<Y.Map<unknown>>, id: string): number {
  for (let i = 0; i < arr.length; i++) {
    if (readKey(arr.get(i), "id").value === id) return i;
  }
  return -1;
}
