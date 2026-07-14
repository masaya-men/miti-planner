/**
 * テンプレート1件の公開読みハンドラー。
 * GET /api/template?action=public-template&id=<contentId>&v=<dataVersion>
 *   → テンプレ doc data (200) / { error } (400 invalid id / 404 not found)
 *
 * - Admin SDK 経由の窓口読み (P1-M: Firestore Rules の直読みから移行する準備)。
 * - 匿名可・App Check 検証しない (公開データの GET のみ、書き込み無し)。
 * - v(dataVersion) は cache-buster としてのみ URL に含まれる (サーバー側では読まない)。
 *   内容変更で dataVersion++ → URL が変わる → 旧キャッシュは自然失効するため長期キャッシュ可。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { rejectIfPublicApiDisabled } from '../../src/lib/publicApiGuard.js';

/** contentId の許容形式 (英数字・アンダースコア・ハイフンのみ、1〜40文字)。 */
export const CONTENT_ID_RE = /^[a-zA-Z0-9_-]{1,40}$/;

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (rejectIfPublicApiDisabled(res)) return;
  if (!(await applyRateLimit(req, res, 60, 60_000, { scope: 'public-template', globalMax: 600 }))) return;

  const id = typeof req.query?.id === 'string' ? req.query.id : '';
  if (!CONTENT_ID_RE.test(id)) return res.status(400).json({ error: 'invalid id' });

  try {
    initAdmin();
    const db = getAdminFirestore();
    const snap = await db.collection('templates').doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: 'not found' });

    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    return res.status(200).json(snap.data());
  } catch (err: any) {
    console.error('[template/public-template] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
