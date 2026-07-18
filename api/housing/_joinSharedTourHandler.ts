/**
 * POST /api/housing?action=join-shared-tour
 * Body: { tourToken: string, sessionId: string }
 * 認証不要(参加者は未ログイン・匿名)。参加人数のソフト上限(SHARED_TOUR_MAX_PARTICIPANTS)を
 * presence サブコレクションの集計クエリで実現する。300人分の入場ゲート+60秒毎の heartbeat。
 *
 * 「ソフト」上限である旨(spec §3): このAPIを経由せず直接 shared_tours/{token}/live/current を
 * onSnapshot 購読すること自体は技術的に防げない。tourToken(nanoid・推測不能)が実質的な鍵であり、
 * 正規参加者が迂回する動機がないことを前提にした防御レベル。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { SHARED_TOUR_MAX_PARTICIPANTS } from '../../src/types/sharedTour.js';
import { shouldEnforceCap, SHARED_TOUR_PRESENCE_STALE_MS } from './_joinSharedTourLogic.js';

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
  // 幹事1人あたりの heartbeat は約60秒に1回。300人×少し余裕を見た値。
  if (!(await applyRateLimit(req, res, 20, 60_000, { scope: 'join-shared-tour', globalMax: 1500 }))) return;

  const { tourToken, sessionId } = (req.body ?? {}) as { tourToken?: unknown; sessionId?: unknown };
  if (typeof tourToken !== 'string' || !tourToken) {
    return res.status(400).json({ error: 'tourToken required' });
  }
  if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 100) {
    return res.status(400).json({ error: 'invalid_session' });
  }

  try {
    initAdmin();
    const db = getAdminFirestore();
    const tourRef = db.collection('shared_tours').doc(tourToken);
    const tourSnap = await tourRef.get();
    if (!tourSnap.exists) return res.status(404).json({ error: 'not_found' });

    const now = Date.now();
    const presenceCol = tourRef.collection('presence');
    const sessionRef = presenceCol.doc(sessionId);
    const sessionSnap = await sessionRef.get();
    const existingLastSeenAt = sessionSnap.exists ? (sessionSnap.data()?.lastSeenAt as number | undefined) : undefined;

    if (shouldEnforceCap(existingLastSeenAt, now)) {
      const staleThreshold = now - SHARED_TOUR_PRESENCE_STALE_MS;
      const countSnap = await presenceCol.where('lastSeenAt', '>=', staleThreshold).count().get();
      if (countSnap.data().count >= SHARED_TOUR_MAX_PARTICIPANTS) {
        return res.status(200).json({ ok: false, reason: 'full' });
      }
    }

    await sessionRef.set({ lastSeenAt: now });
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[housing/join-shared-tour] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
