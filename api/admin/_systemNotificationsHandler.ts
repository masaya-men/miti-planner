/**
 * 運営通知 (system_notifications) の admin API ハンドラー。
 * POST   — 新規投稿
 * PATCH  — 編集 + 公開停止 toggle
 * DELETE — 削除 (不可逆)
 *
 * GET は提供しない (一覧取得は admin UI 側で Firestore onSnapshot 直接購読、
 * Firestore Rules で read=public のため認証不要で読める)。
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { sendDiscordNotification } from '../../src/lib/discordWebhook.js';

/** CORS設定 */
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

/** LocalizedText のバリデーション (ja/en 必須、 ko/zh は string なら OK) */
function isValidLocalizedText(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.ja !== 'string' || obj.ja.length === 0) return false;
  if (typeof obj.en !== 'string' || obj.en.length === 0) return false;
  if ('ko' in obj && obj.ko !== undefined && typeof obj.ko !== 'string') return false;
  if ('zh' in obj && obj.zh !== undefined && typeof obj.zh !== 'string') return false;
  return true;
}

/** undefined フィールドを除外して保存 (Firestore は undefined を許容しないため) */
function pruneOptional(obj: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return out;
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const db = getAdminFirestore();
    const col = db.collection('system_notifications');

    // --- POST: 新規投稿 ---
    if (req.method === 'POST') {
      const { title, body, published } = req.body || {};
      if (!isValidLocalizedText(title)) return res.status(400).json({ error: 'invalid_title' });
      if (!isValidLocalizedText(body)) return res.status(400).json({ error: 'invalid_body' });
      const now = Date.now();
      const data = {
        title: pruneOptional(title),
        body: pruneOptional(body),
        published: published !== false,
        createdAt: now,
        updatedAt: now,
      };
      const ref = await col.add(data);
      await writeAuditLog({
        action: 'create',
        target: `system_notifications.${ref.id}`,
        adminUid,
        changes: { after: data },
      });
      sendDiscordNotification({
        title: '📢 運営通知 投稿',
        description: `**${title.ja}** が公開されました (${published !== false ? '公開' : '停止中で作成'})`,
        color: 0x000000,
      });
      return res.status(201).json({ id: ref.id });
    }

    // --- PATCH: 編集 + 公開停止 toggle ---
    if (req.method === 'PATCH') {
      const { id, title, body, published } = req.body || {};
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid_id' });
      if (title !== undefined && !isValidLocalizedText(title)) return res.status(400).json({ error: 'invalid_title' });
      if (body !== undefined && !isValidLocalizedText(body)) return res.status(400).json({ error: 'invalid_body' });

      const update: any = { updatedAt: Date.now() };
      if (title !== undefined) update.title = pruneOptional(title);
      if (body !== undefined) update.body = pruneOptional(body);
      if (typeof published === 'boolean') update.published = published;

      await col.doc(id).update(update);
      await writeAuditLog({
        action: 'update',
        target: `system_notifications.${id}`,
        adminUid,
        changes: { after: update },
      });
      return res.status(200).json({ ok: true });
    }

    // --- DELETE: 削除 (不可逆) ---
    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query?.id;
      if (!id || typeof id !== 'string') return res.status(400).json({ error: 'invalid_id' });
      await col.doc(id).delete();
      await writeAuditLog({
        action: 'delete',
        target: `system_notifications.${id}`,
        adminUid,
        changes: {},
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e: any) {
    console.error('[system_notifications]', e);
    return res.status(500).json({ error: 'internal_error' });
  }
}
