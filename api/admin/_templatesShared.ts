/**
 * テンプレート管理API — 共通部品(バックアップ作成・dataVersion 加算)
 */
import { FieldValue } from 'firebase-admin/firestore';

/** テンプレートのバックアップを作成 */
export async function createBackup(db: FirebaseFirestore.Firestore, contentId: string, data: unknown) {
  const backupRef = db.collection('template_backups').doc(`template_${contentId}_${Date.now()}`);
  await backupRef.set({
    type: 'template',
    contentId,
    data,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** /master/config の dataVersion を+1する */
export async function bumpDataVersion(db: FirebaseFirestore.Firestore) {
  const configRef = db.doc('master/config');
  await configRef.set({ dataVersion: FieldValue.increment(1) }, { merge: true });
}
