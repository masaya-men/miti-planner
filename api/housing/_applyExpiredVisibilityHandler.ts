/**
 * 公開期限切れ物件の visibility 反映ハンドラ（cron・日次）
 *
 * 他人からの見え方 (公開判定) は isEffectivelyPublic による遅延評価で既にリアルタイムに
 * 切り替わっている。このハンドラは「設定値そのものを実態に追いつかせる掃除」だけを担う:
 * publishUntil を過ぎた public 物件を、登録/編集時に選んでおいた afterExpiryVisibility
 * (unlisted/private、既定 unlisted) へ実際に書き換える。取りこぼしても次回実行時にまとめて
 * 拾われる (対象クエリが publishUntil <= now である限り、処理し損ねたレコードは残り続ける)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { normalizeAfterExpiryVisibility } from '../../src/utils/housingValidation.js';
import { bumpPublicVersionBatch } from './_publicVersion.js';

export default async function handler(req: any, res: any): Promise<void> {
  // CRON_SECRET 認証 (_gcSharedToursHandler と同型・fail-closed)。
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

    // publishUntil <= now の public 物件のみ (visibility + publishUntil の複合インデックス使用)。
    // 上限件数だけ走査 (10 秒/バッチ上限を守る)。取りこぼしは次回実行が拾う。
    const snap = await adminDb
      .collection('housing_listings')
      .where('visibility', '==', 'public')
      .where('publishUntil', '<=', now)
      .limit(300)
      .get();

    let batch = adminDb.batch();
    let ops = 0;
    let updated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data.deletedAt) continue; // 削除済みは対象外 (物理削除 cron に任せる)。

      batch.update(doc.ref, {
        visibility: normalizeAfterExpiryVisibility(data.afterExpiryVisibility),
        publishUntil: null,
        updatedAt: now,
      });
      ops++;
      updated++;
      if (ops >= 400) {
        bumpPublicVersionBatch(batch, adminDb);
        await batch.commit();
        batch = adminDb.batch();
        ops = 0;
      }
    }
    if (ops > 0) {
      bumpPublicVersionBatch(batch, adminDb);
      await batch.commit();
    }

    res.status(200).json({ updated });
  } catch (error: any) {
    console.error('[housing/apply-expired-visibility] error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
}
