/**
 * ハウジング公開データの版番号 (housing_meta/public.version) を +1 するヘルパー (2026-07-14 P1)。
 *
 * 公開一覧/詳細/ハウジンガー窓口 (api/housing/public) が長期キャッシュ (s-maxage=86400) を返しても、
 * 内容が変わったら 30 秒以内に全員へ反映させるための単一カウンタ。全書き込みハンドラが
 * 本体書き込みと同じ transaction/batch 内でこれを呼ぶことで、確実に版を進める。
 *
 * merge:true + FieldValue.increment を使うため、doc/field が未作成でも 0→1 で自然に始まる。
 */
import { FieldValue } from 'firebase-admin/firestore';

const META_PATH = 'housing_meta/public';

/** transaction 内で version を +1 (tx.get はすべて済ませてから呼ぶこと) */
export function bumpPublicVersionTx(
  tx: FirebaseFirestore.Transaction,
  adminDb: FirebaseFirestore.Firestore,
): void {
  tx.set(adminDb.doc(META_PATH), { version: FieldValue.increment(1) }, { merge: true });
}

/** batch 内で version を +1 */
export function bumpPublicVersionBatch(
  batch: FirebaseFirestore.WriteBatch,
  adminDb: FirebaseFirestore.Firestore,
): void {
  batch.set(adminDb.doc(META_PATH), { version: FieldValue.increment(1) }, { merge: true });
}

/** transaction/batch を使わない直更新ハンドラ用 */
export async function bumpPublicVersionDirect(
  adminDb: FirebaseFirestore.Firestore,
): Promise<void> {
  await adminDb.doc(META_PATH).set({ version: FieldValue.increment(1) }, { merge: true });
}
