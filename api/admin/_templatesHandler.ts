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
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/lopo-miti(-[a-z0-9]+)?\.vercel\.app$/.test(origin);
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
        const backups = [
          ...masterSnap.docs.map(d => ({ id: d.id, ...d.data(), collection: 'master' })),
          ...templateSnap.docs.map(d => ({ id: d.id, ...d.data(), collection: 'template' })),
        ].sort((a: any, b: any) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
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
        const planData = planDoc.data() as any;

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
      // バックアップから復元
      if (req.body?.type === 'restore') {
        const { backupId, backupCollection } = req.body;
        if (!backupId || !backupCollection) {
          return res.status(400).json({ error: 'backupId and backupCollection required' });
        }
        const collName = backupCollection === 'master' ? 'master_backups' : 'template_backups';
        const backupDoc = await db.collection(collName).doc(backupId).get();
        if (!backupDoc.exists) {
          return res.status(404).json({ error: 'Backup not found' });
        }
        const backup = backupDoc.data() as any;

        // 復元先を決定し、現在のデータをバックアップしてから復元
        if (backup.type === 'template' && backup.contentId) {
          const currentDoc = await db.collection('templates').doc(backup.contentId).get();
          if (currentDoc.exists) {
            await db.collection('template_backups').doc(`template_${backup.contentId}_${Date.now()}`).set({
              type: 'template', contentId: backup.contentId, data: currentDoc.data(), createdAt: FieldValue.serverTimestamp(),
            });
          }
          await db.collection('templates').doc(backup.contentId).set(backup.data);
        } else if (backup.type && backup.data) {
          const targetPath = `master/${backup.type}`;
          const currentDoc = await db.doc(targetPath).get();
          if (currentDoc.exists) {
            await db.collection('master_backups').doc(`${backup.type}_${Date.now()}`).set({
              type: backup.type, data: currentDoc.data(), createdAt: FieldValue.serverTimestamp(),
            });
          }
          await db.doc(targetPath).set(backup.data);
        }

        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'restore' as any,
          target: `backup.${backupId}`,
          adminUid,
          changes: { before: undefined, after: { restored_from: backupId } },
        });

        return res.status(200).json({ success: true });
      }

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

        // 差分検出（ユーザー向け通知用）
        const prevData = current.exists ? current.data()! : { jobs: [], mitigations: [] };
        const prevJobs = prevData.jobs || [];
        const prevMits = prevData.mitigations || [];

        // 新規ジョブ
        const prevJobIds = new Set(prevJobs.map((j: any) => j.id));
        const newJobs = jobs.filter((j: any) => !prevJobIds.has(j.id));

        // 新規スキル
        const prevMitIds = new Set(prevMits.map((m: any) => m.id));
        const newMits = mitigations.filter((m: any) => !prevMitIds.has(m.id));

        // 値が変わったスキル
        const prevMitMap = new Map<string, any>(prevMits.map((m: any) => [m.id, m]));
        const changedMits = mitigations.filter((m: any) => {
          const prev = prevMitMap.get(m.id) as any;
          if (!prev) return false;
          return m.value !== prev.value || m.duration !== prev.duration || m.recast !== prev.recast;
        });

        await skillsRef.set({ jobs, mitigations, displayOrder });
        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'update',
          target: 'skills',
          adminUid,
          changes: { after: { jobCount: jobs.length, mitigationCount: mitigations.length } },
        });

        // ユーザー向けDiscord通知（変更があった場合のみ）
        const lines: string[] = [];
        for (const j of newJobs) {
          lines.push(`🆕 ジョブ追加: **${j.name?.ja || j.id}**`);
        }
        for (const m of newMits) {
          lines.push(`🆕 スキル追加: **${m.name?.ja || m.id}**`);
        }
        for (const m of changedMits) {
          const prev = prevMitMap.get(m.id) as any;
          const diffs: string[] = [];
          if (m.value !== prev.value) diffs.push(`軽減率 ${prev.value}%→${m.value}%`);
          if (m.duration !== prev.duration) diffs.push(`効果時間 ${prev.duration}s→${m.duration}s`);
          if (m.recast !== prev.recast) diffs.push(`リキャスト ${prev.recast}s→${m.recast}s`);
          lines.push(`📝 **${m.name?.ja || m.id}** — ${diffs.join('、')}`);
        }
        if (lines.length > 0) {
          sendDiscordNotification({
            title: '⚔️ スキルデータ更新',
            description: lines.join('\n'),
            color: 0x000000,
          });
        }

        return res.status(200).json({ success: true });
      }

      // サーバーデータ更新
      if (req.body?.type === 'servers') {
        const docRef = db.doc('master/servers');
        // バックアップ
        const current = await docRef.get();
        if (current.exists) {
          await db.collection('master_backups').doc(`servers_${Date.now()}`).set({
            type: 'servers',
            data: current.data(),
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        const { type: _, ...serversData } = req.body;
        // 許可するフィールドのみ保存（任意フィールド混入防止）
        const allowedFields = ['dataCenters', 'dataVersion'];
        const filtered: Record<string, any> = {};
        for (const key of allowedFields) {
          if (key in serversData) filtered[key] = serversData[key];
        }
        await docRef.set(filtered);
        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'update',
          target: 'servers',
          adminUid,
          changes: {},
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

        // 新規パッチの検出
        const prevPatches = current.exists ? Object.keys((current.data() as any)?.patchStats || {}) : [];
        const newPatches = Object.keys(patchStats).filter((p: string) => !prevPatches.includes(p));

        await statsRef.set({ levelModifiers, patchStats, defaultStatsByLevel });
        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'update',
          target: 'stats',
          adminUid,
          changes: {},
        });

        // ユーザー向けDiscord通知（新パッチ追加時のみ）
        if (newPatches.length > 0) {
          sendDiscordNotification({
            title: '📊 ステータスデータ更新',
            description: `パッチ ${newPatches.join(', ')} のデフォルトステータスが追加されました`,
            color: 0x000000,
          });
        }

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
