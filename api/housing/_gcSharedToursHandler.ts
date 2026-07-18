/**
 * 期限切れ共有ツアーの GC ハンドラ（cron・日次）
 *
 * CRON_SECRET 認証で期限切れ/終了済みの shared_tours を物理削除する。
 * 判定は src/lib/sharedTour/lifecycle.ts の shouldGcSharedTour を再利用する（テスト済み・複製しない）。
 * Vercel Hobby の cron は日次のみのため、参加者への即時反映は client 側 isTourExpired
 * （lastActivityAt 経過判定）に任せ、このハンドラは物理削除（コスト/掃除）だけを担う。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { shouldGcSharedTour } from '../../src/lib/sharedTour/lifecycle.js';

export default async function handler(req: any, res: any): Promise<void> {
  // CRON_SECRET 認証（_collabGcHandler と同型・fail-closed）。
  const auth = req.headers?.authorization || '';
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  if (!expected || auth !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    initAdmin();
    const adminDb = getAdminFirestore();
    const now = Date.now();
    // createdAt 昇順で上限件数だけ走査する（10 秒/バッチ上限を守る）。
    const snap = await adminDb.collection('shared_tours').orderBy('createdAt').limit(300).get();

    const targets: any[] = [];
    for (const doc of snap.docs) {
      const liveRef = doc.ref.collection('live').doc('current');
      const liveSnap = await liveRef.get();
      const live = liveSnap.exists ? (liveSnap.data() as any) : null;
      if (shouldGcSharedTour({ createdAt: doc.data().createdAt }, live, now)) {
        targets.push(doc.ref);
      }
    }

    // 各ツアー = live/current + presence/* + 親 の delete。Firestore batch 上限 500 op → 400 で分割。
    // （親 doc の delete は subcollection を消さない Firestore 仕様のため live/current と presence/* を
    //   明示 delete する。presence は SHARED_TOUR_MAX_PARTICIPANTS(300) まで積み得るため、1ツアーの
    //   途中でも delete を積むたびに 400 到達を確認し、必要ならその場で commit してバッチを切り直す。）
    let batch = adminDb.batch();
    let ops = 0;
    let deleted = 0;
    let presenceDeleted = 0;
    for (const ref of targets) {
      batch.delete(ref.collection('live').doc('current'));
      batch.delete(ref);
      ops += 2;
      deleted++;
      if (ops >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }

      const presenceSnap = await ref.collection('presence').get();
      for (const presenceDoc of presenceSnap.docs) {
        batch.delete(presenceDoc.ref);
        ops++;
        presenceDeleted++;
        if (ops >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          ops = 0;
        }
      }
    }
    if (ops > 0) await batch.commit();

    res.status(200).json({ deleted, presenceDeleted });
  } catch (error: any) {
    console.error('[housing/gc-shared-tours] error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
