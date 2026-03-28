/**
 * テンプレート管理API + マスターコンフィグ管理API（統合）
 * GET    /api/admin/templates              — 全テンプレート一覧（サマリー）
 * GET    /api/admin/templates?id=xx        — 特定テンプレート取得
 * GET    /api/admin/templates?type=config  — マスターコンフィグ取得
 * POST   /api/admin/templates              — テンプレート作成/置換
 * PUT    /api/admin/templates              — テンプレート更新
 * PUT    /api/admin/templates (type=config)— マスターコンフィグ更新
 * GET    /api/admin/templates?type=skills — スキルデータ取得
 * GET    /api/admin/templates?type=stats  — ステータスデータ取得
 * PUT    /api/admin/templates (type=skills)— スキルデータ更新
 * PUT    /api/admin/templates (type=stats) — ステータスデータ更新
 * DELETE /api/admin/templates              — テンプレート削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
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
  const backupRef = db.collection('template_backups').doc(`template_${contentId}_${Date.now()}`);
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
  await configRef.set({ dataVersion: FieldValue.increment(1) }, { merge: true });
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
    const templatesCol = db.collection('templates');

    // --- GET ---
    if (req.method === 'GET') {
      // マスターコンフィグ取得
      if (req.query?.type === 'config') {
        const configRef = db.doc('master/config');
        const snap = await configRef.get();
        return res.status(200).json(snap.exists ? snap.data() : {});
      }

      // スキルデータ取得
      if (req.query?.type === 'skills') {
        const snap = await db.doc('master/skills').get();
        if (!snap.exists) return res.status(404).json({ error: 'Skills data not found' });
        return res.status(200).json(snap.data());
      }

      // ステータスデータ取得
      if (req.query?.type === 'stats') {
        const snap = await db.doc('master/stats').get();
        if (!snap.exists) return res.status(404).json({ error: 'Stats data not found' });
        return res.status(200).json(snap.data());
      }

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

    // --- PUT: テンプレート更新 / マスターコンフィグ更新 ---
    if (req.method === 'PUT') {
      // マスターコンフィグ更新
      if (req.body?.type === 'config') {
        const configRef = db.doc('master/config');
        const updates = req.body;
        const allowed = ['promotionThreshold', 'promotionMultiplier', 'featureFlags'];
        const filtered: Record<string, any> = {};
        for (const key of allowed) {
          if (updates[key] !== undefined) filtered[key] = updates[key];
        }
        if (Object.keys(filtered).length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }
        const before = (await configRef.get()).data() || {};
        await configRef.set(filtered, { merge: true });
        await writeAuditLog({ action: 'update', target: 'config', adminUid, changes: { before, after: filtered } });
        return res.status(200).json({ success: true });
      }

      // スキルデータ更新
      if (req.body?.type === 'skills') {
        const { jobs, mitigations, displayOrder } = req.body;
        if (!Array.isArray(jobs) || !Array.isArray(mitigations) || !Array.isArray(displayOrder)) {
          return res.status(400).json({ error: 'jobs, mitigations, displayOrder arrays are required' });
        }

        const skillsRef = db.doc('master/skills');
        const current = await skillsRef.get();
        if (current.exists) {
          await db.collection('master_backups').doc(`skills_${Date.now()}`).set({
            type: 'skills',
            data: current.data(),
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        await skillsRef.set({ jobs, mitigations, displayOrder });
        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'update',
          target: 'skills',
          adminUid,
          changes: { after: { jobCount: jobs.length, mitigationCount: mitigations.length } },
        });

        return res.status(200).json({ success: true });
      }

      // ステータスデータ更新
      if (req.body?.type === 'stats') {
        const { levelModifiers, patchStats, defaultStatsByLevel } = req.body;
        if (!levelModifiers || !patchStats || !defaultStatsByLevel) {
          return res.status(400).json({ error: 'levelModifiers, patchStats, defaultStatsByLevel are required' });
        }

        const statsRef = db.doc('master/stats');
        const current = await statsRef.get();
        if (current.exists) {
          await db.collection('master_backups').doc(`stats_${Date.now()}`).set({
            type: 'stats',
            data: current.data(),
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        await statsRef.set({ levelModifiers, patchStats, defaultStatsByLevel });
        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'update',
          target: 'stats',
          adminUid,
          changes: {},
        });

        return res.status(200).json({ success: true });
      }

      const { contentId, ...updates } = req.body || {};
      if (!contentId) return res.status(400).json({ error: 'contentId is required' });

      const docRef = templatesCol.doc(contentId);
      const existing = await docRef.get();
      if (!existing.exists) {
        return res.status(404).json({ error: `Template "${contentId}" not found` });
      }

      // バックアップ作成
      await createBackup(db, contentId, existing.data());

      const mergeData: Record<string, any> = {
        ...updates,
        lastUpdatedAt: FieldValue.serverTimestamp(),
        lastUpdatedBy: adminUid,
      };

      // lockedAt の特殊処理
      if (updates.lock === true) {
        mergeData.lockedAt = FieldValue.serverTimestamp();
        delete mergeData.lock;
      } else if (updates.lock === false) {
        mergeData.lockedAt = null;
        delete mergeData.lock;
      }

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
