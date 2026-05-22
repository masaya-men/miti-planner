/**
 * Vercel Cron — SNS 連動物件のツイート生存ローリングチェック
 *
 * 1 日 1 回、最も長く未確認の SNS 物件を古い順に N 件確認し、
 * 元ツイートが 404 (削除/非公開) なら物件を soft delete する。
 *
 * スケール根拠 (設計書 §4-5):
 *   人気物件は「開いた時チェック (C)」が即捕まえ lastTweetCheckAt を更新するため、
 *   cron は誰も開かない長い裾野を少しずつ掃除する安全網。固定バッチで 10 万件でも破綻しない。
 *
 * 認証: Vercel Cron が付与する `Authorization: Bearer <CRON_SECRET>`。
 *   CRON_SECRET は Vercel ダッシュボードで設定済みであること（未設定なら 401）。
 */
import { initAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { checkTweetStatus } from '../../../src/lib/housing/tweetSyndication.js';

const DEFAULT_BATCH = 150;

export default async function handler(req: any, res: any) {
  const authHeader = req.headers?.authorization || '';
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : '';
  if (!expected || authHeader !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    initAdmin();
    const db = getAdminFirestore();
    const batch = Number(process.env.HOUSING_TWEET_CHECK_BATCH) || DEFAULT_BATCH;

    const snap = await db
      .collection('housing_listings')
      .where('imageMode', '==', 'sns')
      .where('deletedAt', '==', null)
      .orderBy('lastTweetCheckAt', 'asc')
      .limit(batch)
      .get();

    let deleted = 0;
    let alive = 0;
    let errored = 0;
    const now = Date.now();

    // 並列度は小さめ (Twitter を叩きすぎない)。逐次で十分軽量。
    for (const doc of snap.docs) {
      const data = doc.data();
      const tweetId = data.tweetId ? String(data.tweetId) : null;
      if (!tweetId) {
        errored++;
        continue;
      }
      const status = await checkTweetStatus(tweetId);
      if (status === 'gone') {
        await doc.ref.update({ deletedAt: now, updatedAt: now });
        deleted++;
      } else if (status === 'alive') {
        await doc.ref.update({ lastTweetCheckAt: now });
        alive++;
      } else {
        errored++; // fail-safe: 何も触らない (lastTweetCheckAt 据え置き = 次回再試行)
      }
    }

    return res.status(200).json({ checked: snap.size, deleted, alive, errored });
  } catch (err: any) {
    console.error('[cron/check-sns-tweets] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
