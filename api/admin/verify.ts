/**
 * 管理者権限検証API
 * GET /api/admin/verify
 *
 * Headers: Authorization: Bearer <idToken>
 * Response: { isAdmin: boolean }
 *
 * フロントエンドが管理画面へのアクセス可否を判定するために使用
 */
import { initAdmin, verifyAdmin } from '../../src/lib/adminAuth';
import { applyRateLimit } from '../../src/lib/rateLimit';
import { verifyAppCheck } from '../../src/lib/appCheckVerify';

/** CORS: 許可オリジンのホワイトリスト（api/share/index.tsと同じパターン） */
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // App Check検証
  if (!(await verifyAppCheck(req, res))) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(req, res, 20, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    return res.status(200).json({ isAdmin: adminUid !== null });
  } catch (err: any) {
    console.error('admin verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
