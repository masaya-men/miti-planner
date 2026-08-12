// Firestore反映(Vercel経由・コスト高)を間引く判定の純粋関数(2026-08-12コスト改善)。
// DOストレージ保存(server.ts の saveBinaryOnly)はこの対象外で常に毎回実施する
// (「こまめなローカル的保護」はここでは変えない・間引くのはFirestoreへの反映だけ)。

/** Firestore への反映間隔の下限(ms)。ソロ機能の定期バックアップ(5分)に合わせる(src/components/Layout.tsx)。 */
export const FIRESTORE_SYNC_MIN_INTERVAL_MS = 5 * 60_000;

/**
 * force=true(全員退室時のonClose)は常に反映する(間引かない=タブを閉じたら確実に保存)。
 * それ以外(編集debounceによる通常のonSave)は、前回の反映(lastSyncAt)から
 * FIRESTORE_SYNC_MIN_INTERVAL_MS 未満なら間引く(false)。lastSyncAt=0(未実施)は初回として必ず反映する。
 */
export function shouldSyncFirestore(force: boolean, lastSyncAt: number, now: number): boolean {
  if (force) return true;
  return now - lastSyncAt >= FIRESTORE_SYNC_MIN_INTERVAL_MS;
}
