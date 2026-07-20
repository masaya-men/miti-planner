/**
 * GET /api/housing?action=can-register
 * 認証ユーザーが現在登録可能かを返す。
 * 必要なら housing_user_meta を初期化する (書き込みは Admin SDK 経由)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { evaluateCanRegister, initialUserMeta } from '../../src/utils/housingQuota.js';
import type { HousingUserMeta } from '../../src/types/housing.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  // scope 必須: check-duplicate と同じ理由 (2026-07-20 実ユーザー報告)。
  if (!(await applyRateLimit(req, res, 30, 60_000, { scope: 'housing-can-register' }))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const isAdmin = decoded.role === 'admin';
    const adminDb = getAdminFirestore();

    const ref = adminDb.collection('housing_user_meta').doc(uid);
    const snap = await ref.get();
    const now = Date.now();

    let meta: HousingUserMeta;
    if (!snap.exists) {
      meta = initialUserMeta(now);
      await ref.set(meta);
    } else {
      meta = snap.data() as HousingUserMeta;
    }

    const result = evaluateCanRegister(meta, now);
    if (result.metaAfterReset) {
      // 日付またぎで quota がリセットされたので保存
      await ref.set(result.metaAfterReset, { merge: true });
      meta = result.metaAfterReset;
    }

    return res.status(200).json({
      allowed: result.allowed || isAdmin,
      reason: isAdmin ? null : (result.reason ?? null),
      registrationCount: meta.registrationCount,
      remaining: meta.dailyQuota.remaining,
      lastReset: meta.dailyQuota.lastReset,
    });
  } catch (error: any) {
    console.error('[housing/can-register] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
