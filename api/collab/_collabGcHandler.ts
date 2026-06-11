/**
 * 共同編集 GC ハンドラ
 *
 * CRON_SECRET 認証で revoked 古い部屋を削除（Firestore 掃除）。
 * バイナリ本体は /destroy（Task 6）で破棄済み。
 * revoked: true かつ createdAt が 7 日超のドキュメントを削除する。
 */
import { getDb } from './_handlerShared.js';
import { shouldGcRoom, type GcRoomDoc } from './_collabGcLogic.js';

const RETENTION_DAYS = 7;

export default async function handler(req: any, res: any): Promise<void> {
  const auth = req.headers?.authorization || '';
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  if (!expected || auth !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const db = getDb();
  const now = Date.now();
  const snap = await db.collection('collabRooms').where('revoked', '==', true).get();

  let deleted = 0;
  for (const doc of snap.docs) {
    if (shouldGcRoom(doc.data() as GcRoomDoc, now, RETENTION_DAYS)) {
      await doc.ref.delete();
      deleted++;
    }
  }

  res.status(200).json({ ok: true, deleted });
}
