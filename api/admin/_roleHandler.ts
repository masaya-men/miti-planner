/**
 * 管理者ロール付与 + 権限検証API ハンドラー
 * GET  — 管理者権限の検証
 * POST — ロール付与/剥奪
 *
 * POST Body: { uid: string, role: 'admin' | null, secret: string }
 * セキュリティ: ADMIN_SECRET による保護（初回設定用）
 */
import { initAdmin, verifyAdmin } from '../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { getAuth } from 'firebase-admin/auth';
import * as crypto from 'crypto';

/** CORS: 許可オリジンのホワイトリスト */
function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // App Check検証（POSTでsecretが提供されている場合のみスキップ — curl初回設定用）
  const hasValidSecret = req.method === 'POST' && typeof req.body?.secret === 'string' && req.body.secret.length > 0;
  if (!hasValidSecret && !(await verifyAppCheck(req, res))) return;

  // --- GET: 管理者権限検証 ---
  if (req.method === 'GET') {
    if (!(await applyRateLimit(req, res, 20, 60_000))) return;
    try {
      initAdmin();
      const adminUid = await verifyAdmin(req);
      return res.status(200).json({ isAdmin: adminUid !== null });
    } catch (err: any) {
      console.error('admin verify error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // レート制限（1分あたり5回まで）
  if (!(await applyRateLimit(req, res, 5, 60_000))) return;

  try {
    initAdmin();

    const { uid, role, secret } = req.body || {};

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required' });
    }

    if (role !== 'admin' && role !== null) {
      return res.status(400).json({ error: 'role must be "admin" or null' });
    }

    // 認証: ADMIN_SECRET または既存管理者のトークン
    let authorizedBy = 'secret';
    const adminSecret = process.env.ADMIN_SECRET;

    // タイミングセーフ比較（タイミング攻撃対策）
    const secretMatch = secret && adminSecret && secret.length === adminSecret.length
      && crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(adminSecret));
    if (secretMatch) {
      // 秘密キー認証（初回セットアップ用）
      authorizedBy = 'secret';
    } else {
      // 既存管理者のトークン認証
      const adminUid = await verifyAdmin(req);
      if (!adminUid) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      authorizedBy = adminUid;
    }

    // Custom Claimsを設定
    const claims = role === 'admin' ? { role: 'admin' } : {};
    await getAuth().setCustomUserClaims(uid, claims);

    // 監査ログ
    await writeAuditLog({
      action: 'set_role',
      target: `user.${uid}`,
      adminUid: authorizedBy,
      changes: { after: { role } },
    });

    return res.status(200).json({ success: true, uid, role });
  } catch (err: any) {
    console.error('set-role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
