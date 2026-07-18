/**
 * POST /api/housing?action=create-shared-tour
 * Body: { snapshot: TourSnapshot[] }
 * 認証必須 (幹事のログイン)。
 *
 * 原子操作 (batch):
 *   1. shared_tours/{tourToken} にメタ (家スナップショット・containsHiddenAddress・hostUid) を作成
 *   2. shared_tours/{tourToken}/live/current にライブ state (status/currentIndex/phase) を作成
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { nanoid } from 'nanoid';
import {
  parseCreateSharedTourRequest,
  resolveHostQuota,
  SHARED_TOUR_MAX_LIVE_PER_HOST,
} from './_sharedTourCreateLogic.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  // 発行は稀な操作 (5/分で十分)。閾値の根拠は docs/.private/2026-07-15-shared-tour-hardening.md 参照。
  if (!(await applyRateLimit(req, res, 5, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await getAuth().verifyIdToken(token);
    const hostUid = decoded.uid;

    const parsed = parseCreateSharedTourRequest(req.body);
    // strictNullChecks オフ環境では discriminated union の `!x.ok` 否定narrowが効かないため
    // `in` 演算子で narrow する (tsconfig.api.json の方針)。
    if ('reason' in parsed) return res.status(400).json({ error: 'invalid_snapshot', reason: parsed.reason });

    const adminDb = getAdminFirestore();

    // 1ホストあたりの同時 live ツアー数を頭打ちにする (悪用対策)。
    // hostUid 単一フィールドクエリなので複合インデックス不要。
    const existing = await adminDb.collection('shared_tours').where('hostUid', '==', hostUid).get();
    const quota = resolveHostQuota(existing.size, SHARED_TOUR_MAX_LIVE_PER_HOST);
    if (quota === 'reject') return res.status(429).json({ error: 'too_many_tours' });
    if (quota === 'evict') {
      // 既存ツアーの live/current を ended にする (clean slate・古い参加者には「終了しました」と表示される)。
      // doc 自体は消さない (物理削除は GC=Task 3.2 の仕事)。
      const evictBatch = adminDb.batch();
      for (const doc of existing.docs) {
        evictBatch.set(doc.ref.collection('live').doc('current'), { status: 'ended', lastActivityAt: Date.now() }, { merge: true });
      }
      await evictBatch.commit();
    }

    const tourToken = nanoid(24);
    const now = Date.now();
    const tourRef = adminDb.collection('shared_tours').doc(tourToken);
    const liveRef = tourRef.collection('live').doc('current');
    const batch = adminDb.batch();
    batch.set(tourRef, {
      tourToken,
      hostUid,
      snapshot: parsed.snapshot,
      containsHiddenAddress: parsed.containsHiddenAddress,
      tourName: parsed.tourName,
      createdAt: now,
    });
    batch.set(liveRef, {
      status: 'live',
      currentIndex: 0,
      phase: 'moving',
      viewStartAt: null,
      lastActivityAt: now,
      crossingAckedIndex: null,
    });
    await batch.commit();

    return res.status(200).json({ tourToken });
  } catch (error: any) {
    console.error('[housing/create-shared-tour] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
