/**
 * テンプレート管理API + マスターコンフィグ管理API ハンドラー
 * GET    — テンプレート/コンフィグ/スキル/ステータス/サーバー取得
 * POST   — テンプレート作成/置換
 * PUT    — テンプレート/マスターデータ更新
 * DELETE — テンプレート削除
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../src/lib/auditLog.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { FieldValue } from 'firebase-admin/firestore';
import type { ApiRequest, ApiResponse } from '../_apiTypes.js';
import { setCors, createBackup, bumpDataVersion } from './_templatesShared.js';
import { handleRestore } from './_masterRestoreHandler.js';
import { handleConfigPut, handleSkillsPut, handleServersPut, handleStatsPut } from './_masterDataPutHandlers.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
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

      // サーバーデータ取得
      if (req.query?.type === 'servers') {
        const serversSnap = await db.doc('master/servers').get();
        return res.status(200).json(serversSnap.exists ? serversSnap.data() : {});
      }

      // バックアップ一覧取得
      if (req.query?.type === 'backups') {
        const masterSnap = await db.collection('master_backups')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
        const templateSnap = await db.collection('template_backups')
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
        const backups = ([
          ...masterSnap.docs.map(d => ({ id: d.id, ...d.data(), collection: 'master' })),
          ...templateSnap.docs.map(d => ({ id: d.id, ...d.data(), collection: 'template' })),
        ] as Array<{ createdAt?: { _seconds?: number } }>).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
        return res.status(200).json({ backups });
      }

      // 監査ログ取得
      if (req.query?.type === 'logs') {
        const limitNum = parseInt(req.query.limit as string) || 50;
        const snap = await db.collection('admin_logs')
          .orderBy('timestamp', 'desc')
          .limit(limitNum)
          .get();
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return res.status(200).json({ logs });
      }

      // プランデータ取得（プラン→テンプレート変換用）
      if (req.query?.subtype === 'plan' && req.query?.planId) {
        const planId = req.query.planId as string;
        const planDoc = await db.collection('shared_plans').doc(planId).get();
        if (!planDoc.exists) {
          return res.status(404).json({ error: `Plan "${planId}" not found` });
        }
        const planData = planDoc.data() as FirebaseFirestore.DocumentData;

        if (planData.type === 'bundle') {
          return res.status(400).json({ error: 'Bundle shares cannot be converted to templates' });
        }

        const pd = planData.planData;
        if (!pd || !Array.isArray(pd.timelineEvents)) {
          return res.status(400).json({ error: 'Plan does not contain valid timeline data' });
        }

        return res.status(200).json({
          title: planData.title || '',
          contentId: planData.contentId || null,
          timelineEvents: pd.timelineEvents,
          phases: pd.phases || [],
        });
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
        lockedAt: FieldValue.serverTimestamp(),
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
      // バックアップから復元
      if (req.body?.type === 'restore') {
        return handleRestore(req, res, db, adminUid);
      }

      // マスターコンフィグ更新
      if (req.body?.type === 'config') {
        return handleConfigPut(req, res, db, adminUid);
      }

      // スキルデータ更新
      if (req.body?.type === 'skills') {
        return handleSkillsPut(req, res, db, adminUid);
      }

      // サーバーデータ更新
      if (req.body?.type === 'servers') {
        return handleServersPut(req, res, db, adminUid);
      }

      // ステータスデータ更新
      if (req.body?.type === 'stats') {
        return handleStatsPut(req, res, db, adminUid);
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

      const mergeData: Record<string, unknown> = {
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
  } catch (err) {
    console.error('[admin/templates] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
