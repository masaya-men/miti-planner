/**
 * 管理者ロール付与API
 * POST /api/admin/set-role
 *
 * Body: { uid: string, role: 'admin' | null, secret: string }
 * - uid: 対象ユーザーのFirebase UID
 * - role: 'admin' で付与、null で剥奪
 * - secret: ADMIN_SECRET 環境変数と一致する秘密キー
 *
 * セキュリティ: ADMIN_SECRET による保護（初回設定用）
 * 2人目以降の管理者追加は、既存管理者のトークン認証でも可能
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth';
import { writeAuditLog } from '../../src/lib/auditLog';
import { applyRateLimit } from '../../src/lib/rateLimit';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: any, res: any) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // レート制限（1分あたり5回まで）
  if (!applyRateLimit(req, res, 5, 60_000)) return;

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

    if (secret && adminSecret && secret === adminSecret) {
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
