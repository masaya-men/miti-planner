/**
 * コンテンツ管理API ハンドラー
 * GET    — 全コンテンツ取得
 * POST   — コンテンツ追加
 * PUT    — コンテンツ更新
 * DELETE — コンテンツ削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { sendDiscordNotification } from '../../src/lib/discordWebhook.js';
import { FieldValue } from 'firebase-admin/firestore';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

/** /master/contentsのバックアップを作成 */
async function createBackup(db: FirebaseFirestore.Firestore, data: any) {
  const backupRef = db.collection('master_backups').doc(`contents_${Date.now()}`);
  await backupRef.set({
    type: 'contents',
    data,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** /master/config の dataVersion を+1する */
async function bumpDataVersion(db: FirebaseFirestore.Firestore) {
  const configRef = db.doc('master/config');
  await configRef.set({ dataVersion: FieldValue.increment(1) }, { merge: true });
}

/** コンテンツアイテムの必須フィールド検証 */
function validateItem(item: any): string | null {
  if (!item) return 'item is required';
  if (!item.id || typeof item.id !== 'string') return 'item.id is required';
  if (!item.name?.ja) return 'item.name.ja is required';
  if (!item.name?.en) return 'item.name.en is required';
  if (!item.category) return 'item.category is required';
  if (item.level === undefined || item.level === null) return 'item.level is required';
  return null;
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // App Check検証
  if (!(await verifyAppCheck(req, res))) return;

  // レート制限（30回/分）
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();

    // 管理者認証
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const db = getAdminFirestore();
    const contentsRef = db.doc('master/contents');

    // --- GET: 全コンテンツ取得 ---
    if (req.method === 'GET') {
      const snap = await contentsRef.get();
      if (!snap.exists) {
        return res.status(200).json({ items: [], series: [] });
      }
      return res.status(200).json(snap.data());
    }

    // --- POST: コンテンツ追加 ---
    if (req.method === 'POST') {
      const { item, series } = req.body || {};
      const error = validateItem(item);
      if (error) return res.status(400).json({ error });

      const snap = await contentsRef.get();
      const current = snap.exists ? snap.data()! : { items: [], series: [] };
      const items: any[] = current.items || [];
      const seriesList: any[] = current.series || [];

      // ID重複チェック
      if (items.some((i: any) => i.id === item.id)) {
        return res.status(409).json({ error: `Item with id "${item.id}" already exists` });
      }

      // バックアップ作成
      await createBackup(db, current);

      // アイテム追加
      items.push(item);

      // シリーズが指定されていて未存在なら追加
      if (series && series.id && !seriesList.some((s: any) => s.id === series.id)) {
        seriesList.push(series);
      }

      const updated = { items, series: seriesList };
      await contentsRef.set(updated);
      await bumpDataVersion(db);
      await writeAuditLog({
        action: 'create',
        target: `contents.${item.id}`,
        adminUid,
        changes: { after: item },
      });

      // ユーザー向けDiscord通知
      sendDiscordNotification({
        title: '🗺️ 新コンテンツ追加',
        description: `**${item.name?.ja}**（${item.shortName?.ja || item.id}）が追加されました`,
        color: 0x000000,
      });

      return res.status(201).json({ success: true, item });
    }

    // --- PUT: コンテンツ更新 ---
    if (req.method === 'PUT') {
      const { item } = req.body || {};
      if (!item?.id) return res.status(400).json({ error: 'item.id is required' });

      const snap = await contentsRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Contents document not found' });

      const current = snap.data()!;
      const items: any[] = current.items || [];
      const idx = items.findIndex((i: any) => i.id === item.id);
      if (idx === -1) {
        return res.status(404).json({ error: `Item with id "${item.id}" not found` });
      }

      // バックアップ作成
      await createBackup(db, current);

      const before = { ...items[idx] };
      // 既存にマージ
      items[idx] = { ...items[idx], ...item };

      await contentsRef.set({ ...current, items });
      await bumpDataVersion(db);
      await writeAuditLog({
        action: 'update',
        target: `contents.${item.id}`,
        adminUid,
        changes: { before, after: items[idx] },
      });

      return res.status(200).json({ success: true, item: items[idx] });
    }

    // --- DELETE: コンテンツ削除 ---
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const snap = await contentsRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Contents document not found' });

      const current = snap.data()!;
      const items: any[] = current.items || [];
      const idx = items.findIndex((i: any) => i.id === id);
      if (idx === -1) {
        return res.status(404).json({ error: `Item with id "${id}" not found` });
      }

      // バックアップ作成
      await createBackup(db, current);

      const deleted = items.splice(idx, 1)[0];
      await contentsRef.set({ ...current, items });
      await bumpDataVersion(db);
      await writeAuditLog({
        action: 'delete',
        target: `contents.${id}`,
        adminUid,
        changes: { before: deleted },
      });

      return res.status(200).json({ success: true, deleted });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/contents] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
