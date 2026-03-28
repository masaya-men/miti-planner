/**
 * テンプレート管理API
 * GET    /api/admin/templates       — 全テンプレート一覧（サマリー）
 * GET    /api/admin/templates?id=xx — 特定テンプレート取得
 * POST   /api/admin/templates       — テンプレート作成/置換
 * PUT    /api/admin/templates       — テンプレート更新
 * DELETE /api/admin/templates       — テンプレート削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth';
import { writeAuditLog } from '../../../src/lib/auditLog';
import { applyRateLimit } from '../../../src/lib/rateLimit';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify';
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

/** テンプレートのバックアップを作成 */
async function createBackup(db: FirebaseFirestore.Firestore, contentId: string, data: any) {
  const backupRef = db.collection('master_backups').doc(`template_${contentId}_${Date.now()}`);
  await backupRef.set({
    type: 'template',
    contentId,
    data,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/** /master/config の dataVersion を+1する */
async function bumpDataVersion(db: FirebaseFirestore.Firestore) {
  const configRef = db.doc('master/config');
  const configSnap = await configRef.get();
  const current = configSnap.exists ? (configSnap.data()?.dataVersion ?? 0) : 0;
  await configRef.set({ dataVersion: current + 1 }, { merge: true });
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // App Check検証
  if (!(await verifyAppCheck(req, res))) return;

  // レート制限（30回/分）
  if (!applyRateLimit(req, res, 30, 60_000)) return;

  try {
    initAdmin();

    // 管理者認証
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const db = getAdminFirestore();
    const templatesCol = db.collection('master_templates');

    // --- GET ---
    if (req.method === 'GET') {
      const id = req.query?.id;

      // 特定テンプレート取得
      if (id) {
        const docSnap = await templatesCol.doc(id).get();
        if (!docSnap.exists) {
          return res.status(404).json({ error: `Template "${id}" not found` });
        }
        return res.status(200).json(docSnap.data());
      }

      // 全テンプレート一覧（サマリーのみ）
      const snapshot = await templatesCol.get();
      const list = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          contentId: d.contentId ?? doc.id,
          source: d.source ?? null,
          eventCount: Array.isArray(d.timelineEvents) ? d.timelineEvents.length : 0,
          phaseCount: Array.isArray(d.phases) ? d.phases.length : 0,
          lockedAt: d.lockedAt ?? null,
          lastUpdatedAt: d.lastUpdatedAt ?? null,
          lastUpdatedBy: d.lastUpdatedBy ?? null,
        };
      });
      return res.status(200).json({ templates: list });
    }

    // --- POST: テンプレート作成/置換 ---
    if (req.method === 'POST') {
      const { contentId, timelineEvents, phases, source } = req.body || {};
      if (!contentId) return res.status(400).json({ error: 'contentId is required' });
      if (!Array.isArray(timelineEvents)) {
        return res.status(400).json({ error: 'timelineEvents must be an array' });
      }

      const docRef = templatesCol.doc(contentId);
      const existing = await docRef.get();

      // 既存ドキュメントがあればバックアップ
      if (existing.exists) {
        await createBackup(db, contentId, existing.data());
      }

      const templateData = {
        contentId,
        source: source || 'admin_manual',
        timelineEvents,
        phases: phases || [],
        lockedAt: null,
        lastUpdatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: adminUid,
      };

      await docRef.set(templateData);
      await bumpDataVersion(db);
      await writeAuditLog({
        action: existing.exists ? 'update' : 'create',
        target: `template.${contentId}`,
        adminUid,
        changes: {
          before: existing.exists ? existing.data() : undefined,
          after: { ...templateData, lastUpdatedAt: '(serverTimestamp)' },
        },
      });

      return res.status(201).json({ success: true, contentId });
    }

    // --- PUT: テンプレート更新 ---
    if (req.method === 'PUT') {
      const { contentId, ...updates } = req.body || {};
      if (!contentId) return res.status(400).json({ error: 'contentId is required' });

      const docRef = templatesCol.doc(contentId);
      const existing = await docRef.get();
      if (!existing.exists) {
        return res.status(404).json({ error: `Template "${contentId}" not found` });
      }

      // バックアップ作成
      await createBackup(db, contentId, existing.data());

      const mergeData = {
        ...updates,
        lastUpdatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: adminUid,
      };

      await docRef.update(mergeData);
      await bumpDataVersion(db);
      await writeAuditLog({
        action: 'update',
        target: `template.${contentId}`,
        adminUid,
        changes: {
          before: existing.data(),
          after: { ...mergeData, lastUpdatedAt: '(serverTimestamp)' },
        },
      });

      return res.status(200).json({ success: true, contentId });
    }

    // --- DELETE: テンプレート削除 ---
    if (req.method === 'DELETE') {
      const contentId = req.query?.contentId || req.body?.contentId;
      if (!contentId) return res.status(400).json({ error: 'contentId is required' });

      const docRef = templatesCol.doc(contentId);
      const existing = await docRef.get();
      if (!existing.exists) {
        return res.status(404).json({ error: `Template "${contentId}" not found` });
      }

      // バックアップ作成
      await createBackup(db, contentId, existing.data());

      await docRef.delete();
      await bumpDataVersion(db);
      await writeAuditLog({
        action: 'delete',
        target: `template.${contentId}`,
        adminUid,
        changes: { before: existing.data() },
      });

      return res.status(200).json({ success: true, contentId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/templates] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
