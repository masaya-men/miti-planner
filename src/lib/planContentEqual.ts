/**
 * 共有中身の同一判定 (偽競合コピー防止の中核・2026-07-14)
 *
 * 共同編集(collab)は本体保存を DO(Cloudflare Durable Object) が代行し、保存の度に
 * Firestore の plans/{id}.updatedAt = serverTimestamp を書く (api/collab/_saveHandler.ts)。
 * これはクライアントの編集時刻(Date.now)を必ず追い越すため、「リモートの方が新しい」は
 * collab では常態。中身が同一でも updatePlan が skipped_newer_remote を返し、偽の競合コピーが
 * 量産される (usePlanStore の conflict 処理)。
 *
 * この関数は「DO が実際に保存する共有中身フィールド」だけを比較する。一致していれば
 * 中身は分岐しておらず、競合コピーは偽アラーム = 作るべきでない。
 * 逆に不一致なら本物の乖離 (退室と同 tick の未配送編集・#saveEnabled=false での凍結 等) の
 * 可能性があり、従来どおり退避コピーを残す (敵対監査 E の指摘 = 一律抑制は禁止・中身一致を必須条件)。
 *
 * 比較の原則:
 * - 対象フィールドは readPlanDataFull(workers/collab/src/yjsPlanData.ts) と対応させる。
 *   myMemberId 等 DO 非保存フィールドは含めない (含めると偽コピーが消えない)。
 * - id キー配列は順序非依存 (Yjs / dedupeById で順序が入れ替わりうる)。
 * - undefined ≈ 空 (未マイグレ既存プランの undefined と空配列を差分にしない)。
 */
import type { PlanData } from '../types';

/** null/undefined を等価に扱う deep-equal。オブジェクトは undefined 値のキーを無視して比較。 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null);
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false; // プリミティブで !== は既に不一致
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao).filter((k) => ao[k] !== undefined);
  const bk = Object.keys(bo).filter((k) => bo[k] !== undefined);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/** 配列でなければ空配列に正規化。 */
function normArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** id を持つ要素の配列を id→要素 の Map へ。id が無い要素は出現順の index キーへフォールバック。
 *  id 重複は先勝ち (最初の出現を残す) = worker/client の dedupeById と同一セマンティクス。
 *  最後勝ちだと「load 時に破棄される重複要素」で誤差分を出しうるため揃える。 */
function byId(items: unknown[]): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const it of items) {
    if (it && typeof it === 'object' && 'id' in (it as Record<string, unknown>)) {
      const key = String((it as Record<string, unknown>).id);
      if (!m.has(key)) m.set(key, it); // 先勝ち
    } else {
      m.set(`__idx_${m.size}`, it);
    }
  }
  return m;
}

/** id キー配列の順序非依存比較 (undefined ≈ 空)。 */
function idArrayEqual(a: unknown, b: unknown): boolean {
  const ma = byId(normArray(a));
  const mb = byId(normArray(b));
  if (ma.size !== mb.size) return false;
  for (const [id, ea] of ma) {
    if (!mb.has(id)) return false;
    if (!deepEqual(ea, mb.get(id))) return false;
  }
  return true;
}

/**
 * DO が保存する共有中身フィールドが a/b で一致するか。
 * 一致 = 偽競合 (コピー不要)、不一致 = 本物の乖離の可能性 (退避コピーを残す)。
 */
export function isSharedPlanContentEqual(a?: PlanData | null, b?: PlanData | null): boolean {
  const da = a ?? undefined;
  const db = b ?? undefined;
  if (!da && !db) return true;
  const A = (da ?? {}) as Partial<PlanData>;
  const B = (db ?? {}) as Partial<PlanData>;

  // id キー配列 (順序非依存)。readPlanDataFull が書き戻す配列群。
  const idArrayFields: (keyof PlanData)[] = [
    'timelineEvents',
    'timelineMitigations',
    'phases',
    'labels',
    'partyMembers',
    'memos',
  ];
  for (const f of idArrayFields) {
    if (!idArrayEqual(A[f], B[f])) return false;
  }

  // 進捗: points は id キー配列、他はスカラー/bool。
  const pa = A.progress;
  const pb = B.progress;
  if (!idArrayEqual(pa?.points, pb?.points)) return false;
  if ((pa?.cleared ?? false) !== (pb?.cleared ?? false)) return false;
  if ((pa?.activeDays ?? undefined) !== (pb?.activeDays ?? undefined)) return false;
  if ((pa?.activeHours ?? undefined) !== (pb?.activeHours ?? undefined)) return false;

  // スカラー / オブジェクト。
  if ((A.currentLevel ?? undefined) !== (B.currentLevel ?? undefined)) return false;
  if (!deepEqual(A.aaSettings, B.aaSettings)) return false;
  if (!deepEqual(A.schAetherflowPatterns, B.schAetherflowPatterns)) return false;

  return true;
}
