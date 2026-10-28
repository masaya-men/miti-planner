/**
 * テンプレート管理API — バックアップからの復元(PUT type=restore)
 */
import { FieldValue } from 'firebase-admin/firestore';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { bumpDataVersion } from './_templatesShared.js';

export async function handleRestore(
  req: ApiRequest,
  res: ApiResponse,
  db: FirebaseFirestore.Firestore,
  adminUid: string,
) {
  const { backupId, backupCollection } = req.body;
  if (!backupId || !backupCollection) {
    return res.status(400).json({ error: 'backupId and backupCollection required' });
  }
  const collName = backupCollection === 'master' ? 'master_backups' : 'template_backups';
  const backupDoc = await db.collection(collName).doc(backupId).get();
  if (!backupDoc.exists) {
    return res.status(404).json({ error: 'Backup not found' });
  }
  const backup = backupDoc.data() as FirebaseFirestore.DocumentData;

  // 復元先を決定し、現在のデータをバックアップしてから復元
  if (backup.type === 'template' && backup.contentId) {
    const currentDoc = await db.collection('templates').doc(backup.contentId).get();
    if (currentDoc.exists) {
      await db.collection('template_backups').doc(`template_${backup.contentId}_${Date.now()}`).set({
        type: 'template', contentId: backup.contentId, data: currentDoc.data(), createdAt: FieldValue.serverTimestamp(),
      });
    }
    await db.collection('templates').doc(backup.contentId).set(backup.data);
  } else if (backup.type && backup.data) {
    const targetPath = `master/${backup.type}`;
    const currentDoc = await db.doc(targetPath).get();
    if (currentDoc.exists) {
      await db.collection('master_backups').doc(`${backup.type}_${Date.now()}`).set({
        type: backup.type, data: currentDoc.data(), createdAt: FieldValue.serverTimestamp(),
      });
    }
    await db.doc(targetPath).set(backup.data);
  }

  await bumpDataVersion(db);
  await writeAuditLog({
    action: 'restore' as Parameters<typeof writeAuditLog>[0]['action'],
    target: `backup.${backupId}`,
    adminUid,
    changes: { before: undefined, after: { restored_from: backupId } },
  });

  return res.status(200).json({ success: true });
}
