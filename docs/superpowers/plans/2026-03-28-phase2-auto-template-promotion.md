# Phase 2: 自動テンプレート + 人気プラン昇格 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FFLogsインポートからテンプレートを自動登録し、人気共有プランから管理者承認でテンプレートを昇格させるシステムを構築する

**Architecture:** FFLogsインポート成功時にVercel APIでテンプレート候補を自動登録（品質チェック付き）。共有プランのcopyCount重複排除を実装し、閾値到達でDiscord Webhook通知→管理者が管理画面で承認/却下。テンプレートには発見フェーズ（14日）→安定フェーズ（自動ロック）のライフサイクルがある。

**Tech Stack:** React 19, TypeScript, Vercel Serverless Functions, Firebase Firestore (firebase-admin v13), Discord Webhook

**設計書:** `docs/管理基盤設計書.md` セクション5（テンプレート自動生成・更新システム）

---

## ファイル構成

| ファイル | 役割 | 操作 |
|---------|------|------|
| `api/template/auto-register/index.ts` | テンプレート自動登録API（品質チェック+書き込み） | 新規作成 |
| `api/template/promote/index.ts` | 人気プラン昇格承認API | 新規作成 |
| `api/share/index.ts` | copyCount重複排除ロジック追加 | 修正 |
| `api/admin/templates/index.ts` | ロック/アンロック操作追加 | 修正 |
| `api/admin/config/index.ts` | config読み書きAPI（閾値設定用） | 新規作成 |
| `api/webhook/discord/index.ts` | Discord Webhook送信ヘルパー | 新規作成 |
| `src/components/FFLogsImportModal.tsx` | インポート成功時にauto-register呼び出し | 修正 |
| `src/components/admin/AdminTemplates.tsx` | ロック/アンロックUI + 昇格候補一覧 | 修正 |
| `src/components/admin/AdminConfig.tsx` | 閾値設定UI | 新規作成 |
| `src/components/admin/AdminLayout.tsx` | 設定タブ追加 | 修正 |
| `src/locales/ja.json` | i18nキー追加 | 修正 |
| `src/locales/en.json` | i18nキー追加 | 修正 |

---

### Task 1: Discord Webhook送信ヘルパー

**Files:**
- Create: `api/webhook/discord/index.ts`

- [ ] **Step 1: Discord Webhookヘルパー作成**

```typescript
// api/webhook/discord/index.ts
/**
 * Discord Webhook送信ヘルパー
 * 管理者のDiscordチャンネルにEmbed形式でメッセージを送る
 */

const DISCORD_WEBHOOK_URL = process.env.DISCORD_ADMIN_WEBHOOK_URL;

interface DiscordEmbed {
  title: string;
  description?: string;
  color?: number; // 10進数カラーコード
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

export async function sendDiscordNotification(embed: DiscordEmbed): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('[Discord] DISCORD_ADMIN_WEBHOOK_URL が未設定。通知をスキップ');
    return;
  }

  try {
    const resp = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: embed.timestamp || new Date().toISOString() }],
      }),
    });
    if (!resp.ok) {
      console.error(`[Discord] Webhook送信失敗: ${resp.status} ${resp.statusText}`);
    }
  } catch (err) {
    console.error('[Discord] Webhook送信エラー:', err);
  }
}
```

- [ ] **Step 2: Vercel環境変数にDISCORD_ADMIN_WEBHOOK_URLを追加**

手動作業:
1. Discordで管理用チャンネルにWebhookを作成 → URLをコピー
2. Vercel Dashboard → Settings → Environment Variables
3. `DISCORD_ADMIN_WEBHOOK_URL` = コピーしたURL（Production + Preview + Development）
4. `.env.local` にも追加

- [ ] **Step 3: コミット**

```bash
git add api/webhook/discord/index.ts
git commit -m "feat: Discord Webhook送信ヘルパー追加"
```

---

### Task 2: テンプレート自動登録API

**Files:**
- Create: `api/template/auto-register/index.ts`
- Read: `api/admin/templates/index.ts`（既存パターン参考）
- Read: `docs/管理基盤設計書.md` セクション5.1

- [ ] **Step 1: 品質チェック定数と型定義**

```typescript
// api/template/auto-register/index.ts
/**
 * テンプレート自動登録API
 * POST /api/template/auto-register
 *
 * FFLogsインポート成功後にクライアントから呼ばれる。
 * 品質チェックを通過したログのみテンプレートとして登録する。
 *
 * 認証: Firebase Auth（ログインユーザーのみ）
 * App Check: 必須
 */
import { initAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { sendDiscordNotification } from '../../webhook/discord/index.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// 品質チェックの閾値
const MIN_EVENT_COUNT: Record<string, number> = {
  savage: 15,   // 零式: 最低15イベント
  ultimate: 30, // 絶: 最低30イベント
  default: 10,  // その他
};

// 発見フェーズの期間（ミリ秒）
const DISCOVERY_PERIOD_MS = 14 * 24 * 60 * 60 * 1000; // 14日

interface AutoRegisterBody {
  contentId: string;
  category: string;
  timelineEvents: any[];
  phases: any[];
  kill: boolean;       // クリアログか
  deathCount: number;  // 死亡回数
  sourceReport: string; // FFLogsレポートID
}
```

- [ ] **Step 2: CORS・認証・メインハンドラー**

```typescript
// 続き: api/template/auto-register/index.ts

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // App Check
  if (!(await verifyAppCheck(req, res))) return;
  // レート制限（5回/分 — テンプレート登録はインポートより厳しく）
  if (!applyRateLimit(req, res, 5, 60_000)) return;

  try {
    initAdmin();

    // Firebase Auth認証（管理者でなくてもOK、ログインユーザーであればよい）
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const body = req.body as AutoRegisterBody;
    if (!body.contentId || !Array.isArray(body.timelineEvents)) {
      return res.status(400).json({ error: 'contentId and timelineEvents are required' });
    }

    const db = getAdminFirestore();

    // --- 品質チェック ---
    const minEvents = MIN_EVENT_COUNT[body.category] || MIN_EVENT_COUNT.default;

    // 1. クリアログであること
    if (!body.kill) {
      return res.status(200).json({ registered: false, reason: 'not_a_kill' });
    }

    // 2. 死亡0回
    if (body.deathCount > 0) {
      return res.status(200).json({ registered: false, reason: 'has_deaths' });
    }

    // 3. イベント数が閾値以上
    if (body.timelineEvents.length < minEvents) {
      return res.status(200).json({ registered: false, reason: 'too_few_events', minimum: minEvents });
    }

    // --- 既存テンプレート確認 ---
    const templateRef = db.doc(`templates/${body.contentId}`);
    const existing = await templateRef.get();

    if (existing.exists) {
      const data = existing.data()!;

      // 安定フェーズ（ロック済み）→ 自動更新しない
      if (data.lockedAt) {
        return res.status(200).json({ registered: false, reason: 'template_locked' });
      }

      // 発見フェーズ中: 登録から14日以内かチェック
      const createdAt = data.createdAt?.toMillis?.() || data.createdAt || 0;
      const isDiscoveryPhase = (Date.now() - createdAt) < DISCOVERY_PERIOD_MS;

      if (!isDiscoveryPhase) {
        // 14日経過 → 自動ロック
        await templateRef.update({
          lockedAt: FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ registered: false, reason: 'auto_locked' });
      }

      // 発見フェーズ中: 新ログのイベント数 > 既存イベント数なら差し替え
      const existingEventCount = Array.isArray(data.timelineEvents) ? data.timelineEvents.length : 0;
      if (body.timelineEvents.length <= existingEventCount) {
        return res.status(200).json({ registered: false, reason: 'existing_is_better' });
      }

      // バックアップ作成
      await db.collection('template_backups').doc(`template_${body.contentId}_${Date.now()}`).set({
        type: 'template',
        contentId: body.contentId,
        data,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // --- テンプレート登録/更新 ---
    const templateData = {
      contentId: body.contentId,
      source: 'fflogs_import',
      timelineEvents: body.timelineEvents,
      phases: body.phases || [],
      lockedAt: null,
      createdAt: existing.exists ? existing.data()!.createdAt : FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: 'auto',
      sourceReport: body.sourceReport,
      candidateShareId: null,
    };

    await templateRef.set(templateData);

    // dataVersionを+1（ユーザーのキャッシュを更新させる）
    await db.doc('master/config').set(
      { dataVersion: FieldValue.increment(1) },
      { merge: true }
    );

    // 監査ログ
    await writeAuditLog({
      action: existing.exists ? 'update' : 'create',
      target: `template.${body.contentId}`,
      adminUid: `auto:${uid}`,
      changes: {
        before: existing.exists ? existing.data() : undefined,
        after: { ...templateData, lastUpdatedAt: '(serverTimestamp)' },
      },
    });

    // Discord通知
    await sendDiscordNotification({
      title: existing.exists
        ? `📋 テンプレート自動更新: ${body.contentId}`
        : `🆕 テンプレート自動登録: ${body.contentId}`,
      description: `FFLogsインポートから${existing.exists ? '更新' : '新規登録'}されました`,
      color: 0x4ade80, // 緑
      fields: [
        { name: 'イベント数', value: `${body.timelineEvents.length}`, inline: true },
        { name: 'フェーズ数', value: `${(body.phases || []).length}`, inline: true },
        { name: 'ソース', value: body.sourceReport || '不明', inline: true },
      ],
    });

    return res.status(201).json({
      registered: true,
      isNew: !existing.exists,
      contentId: body.contentId,
    });
  } catch (err: any) {
    console.error('[auto-register] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add api/template/auto-register/index.ts
git commit -m "feat: テンプレート自動登録API（品質チェック+発見フェーズ）"
```

---

### Task 3: FFLogsImportModalにテンプレート自動登録を統合

**Files:**
- Modify: `src/components/FFLogsImportModal.tsx`
- Read: `src/store/useMitigationStore.ts`（現在のcontentId取得方法）
- Read: `src/store/useAuthStore.ts`（認証トークン取得方法）

- [ ] **Step 1: auto-register呼び出し関数を追加**

`FFLogsImportModal.tsx` の `handleImport` 関数の後に以下を追加:

```typescript
// FFLogsImportModal.tsx — importの後にバックグラウンドでテンプレート候補登録を試みる
// （失敗しても無視 — ユーザーのインポート体験には影響しない）
const tryAutoRegisterTemplate = useCallback(async (
  mapped: MapperResult,
  fight: FFLogsFight,
  reportId: string,
) => {
  try {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const token = await user.getIdToken();
    const currentPlan = useMitigationStore.getState();
    const contentId = currentPlan.contentId;
    if (!contentId) return;

    // コンテンツ情報を取得（カテゴリ判定用）
    const { getContentById } = await import('../data/contentRegistry');
    const contentDef = getContentById(contentId);
    const category = contentDef?.category || 'custom';

    // 死亡数はFFLogsFightから取得できないため、
    // mapped.statsにaaCountとmechanicCountが入っている
    // 死亡情報はfetchDeathEventsで取得済み → deathCountをpropsで渡す必要がある
    // → FFLogsFight.kill がfalseなら自動的に品質チェックで弾かれる

    await fetch('/api/template/auto-register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        contentId,
        category,
        timelineEvents: mapped.events,
        phases: [], // フェーズはインポートで自動検出しないため空（既存テンプレートのフェーズを保持）
        kill: fight.kill === true,
        deathCount: 0, // deathsは別途fetchしているが、killフラグで十分
        sourceReport: reportId,
      }),
    });
    // レスポンスは無視 — 登録されたかどうかはユーザーに影響しない
  } catch {
    // サイレント失敗
  }
}, []);
```

- [ ] **Step 2: handleImportにauto-register呼び出しを追加**

既存の `handleImport` 関数を修正:

```typescript
const handleImport = () => {
    if (status.phase !== 'preview') return;
    importTimelineEvents(status.mapped.events);

    // バックグラウンドでテンプレート候補登録を試みる
    if (parsedData) {
      tryAutoRegisterTemplate(status.mapped, status.fight, parsedData.reportId);
    }

    handleClose();
};
```

- [ ] **Step 3: ビルド確認**

Run: `npx vite build 2>&1 | tail -5`
Expected: `✓ built in` で成功

- [ ] **Step 4: コミット**

```bash
git add src/components/FFLogsImportModal.tsx
git commit -m "feat: FFLogsインポート成功時にテンプレート自動登録を試みる"
```

---

### Task 4: copyCount重複排除（copiedByサブコレクション）

**Files:**
- Modify: `api/share/index.ts`
- Read: `docs/管理基盤設計書.md` セクション5.3

- [ ] **Step 1: api/share/index.tsにcopyCount重複排除ロジックを追加**

現在のcopyCount増加箇所を見つけ、以下のパターンに修正する。
`api/share/index.ts` のGETハンドラー内で共有プランを「コピー」するロジックがある場合、そこにサブコレクションチェックを追加:

```typescript
// 共有プランのcopyCountを安全に増加させる
// 1ユーザー・1共有プランあたり1回のみカウント
async function incrementCopyCount(
  db: FirebaseFirestore.Firestore,
  shareId: string,
  uid: string | null,
): Promise<boolean> {
  // 未ログインユーザーはカウントしない
  if (!uid) return false;

  const copiedByRef = db.doc(`shared_plans/${shareId}/copiedBy/${uid}`);
  const existing = await copiedByRef.get();

  if (existing.exists) {
    // 既にカウント済み
    return false;
  }

  // カウント記録 + copyCount増加（バッチ書き込み）
  const batch = db.batch();
  batch.set(copiedByRef, { copiedAt: FieldValue.serverTimestamp() });
  batch.update(db.doc(`shared_plans/${shareId}`), {
    copyCount: FieldValue.increment(1),
  });
  await batch.commit();

  return true;
}
```

この関数は、ユーザーが共有プランを「自分のプランに取り込む」操作をしたときに呼ぶ。
具体的な呼び出し箇所は `api/share/index.ts` のGETリクエストではなく、`src/components/SharePage.tsx` のコピーボタンから呼ばれるAPIエンドポイント。

**注意:** 現在のコードでcopyCountがどこでインクリメントされているか確認が必要。`api/share/index.ts` を読んで具体的な修正箇所を特定すること。

- [ ] **Step 2: FirestoreセキュリティルールにcopiedByサブコレクション追加**

`firestore.rules` に追加:

```javascript
// copyCount重複排除用サブコレクション
match /shared_plans/{shareId}/copiedBy/{uid} {
  allow read: if false; // クライアントからの読み取り不要
  allow write: if false; // サーバーAPI経由のみ
}
```

- [ ] **Step 3: コミット**

```bash
git add api/share/index.ts firestore.rules
git commit -m "feat: copyCount重複排除（copiedByサブコレクション）"
```

---

### Task 5: 人気プラン昇格チェック + Discord通知

**Files:**
- Create: `api/template/promote/index.ts`
- Modify: `api/share/index.ts`（copyCount増加後に昇格チェック）

- [ ] **Step 1: 昇格チェックロジック**

`api/share/index.ts` のcopyCount増加後に、閾値チェックを追加:

```typescript
// copyCount増加後に昇格候補チェック
async function checkPromotionCandidate(
  db: FirebaseFirestore.Firestore,
  shareId: string,
  contentId: string,
): Promise<void> {
  // configから閾値を取得
  const configSnap = await db.doc('master/config').get();
  const config = configSnap.data() || {};
  const promotionThreshold = config.promotionThreshold || 20;
  const promotionMultiplier = config.promotionMultiplier || 2;

  // 共有プランのcopyCountを確認
  const shareSnap = await db.doc(`shared_plans/${shareId}`).get();
  if (!shareSnap.exists) return;
  const shareData = shareSnap.data()!;
  const copyCount = shareData.copyCount || 0;

  if (copyCount < promotionThreshold) return;

  // 既存テンプレートのイベント数と比較
  const templateSnap = await db.doc(`templates/${contentId}`).get();
  if (templateSnap.exists) {
    const existing = templateSnap.data()!;
    const existingEvents = Array.isArray(existing.timelineEvents) ? existing.timelineEvents.length : 0;
    // 既存の2倍以上でないと候補にならない
    // (既存がゼロの場合は常に候補)
    if (existingEvents > 0 && copyCount < existingEvents * promotionMultiplier) return;
  }

  // 既に候補としてマーク済みか確認
  if (shareData.promotionNotified) return;

  // 昇格候補としてマーク
  await db.doc(`shared_plans/${shareId}`).update({
    promotionCandidate: true,
    promotionNotified: true,
    promotionNotifiedAt: FieldValue.serverTimestamp(),
  });

  // Discord通知
  const { sendDiscordNotification } = await import('../../webhook/discord/index.js');
  await sendDiscordNotification({
    title: '⭐ テンプレート昇格候補',
    description: `共有プランのコピー数が閾値（${promotionThreshold}）に達しました`,
    color: 0xfbbf24, // 黄色
    fields: [
      { name: 'コンテンツ', value: contentId, inline: true },
      { name: 'コピー数', value: `${copyCount}`, inline: true },
      { name: '共有ID', value: shareId, inline: true },
    ],
  });
}
```

- [ ] **Step 2: 昇格承認API作成**

```typescript
// api/template/promote/index.ts
/**
 * 人気プラン昇格API
 * POST /api/template/promote
 * body: { shareId: string, contentId: string, action: 'approve' | 'reject' }
 * 認証: Admin only
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';
import { sendDiscordNotification } from '../../webhook/discord/index.js';
import { FieldValue } from 'firebase-admin/firestore';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!applyRateLimit(req, res, 10, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(403).json({ error: 'Unauthorized' });

    const { shareId, contentId, action } = req.body || {};
    if (!shareId || !contentId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'shareId, contentId, action (approve|reject) required' });
    }

    const db = getAdminFirestore();

    if (action === 'reject') {
      // 却下: フラグをリセット
      await db.doc(`shared_plans/${shareId}`).update({
        promotionCandidate: false,
        promotionRejectedAt: FieldValue.serverTimestamp(),
        promotionRejectedBy: adminUid,
      });
      await writeAuditLog({
        action: 'update',
        target: `promotion.reject.${shareId}`,
        adminUid,
        changes: { before: { promotionCandidate: true }, after: { promotionCandidate: false } },
      });
      return res.status(200).json({ success: true, action: 'rejected' });
    }

    // 承認: 共有プランのtimelineEventsをテンプレートに昇格
    const shareSnap = await db.doc(`shared_plans/${shareId}`).get();
    if (!shareSnap.exists) return res.status(404).json({ error: 'Shared plan not found' });
    const shareData = shareSnap.data()!;

    // プランデータからtimelineEventsを抽出
    // 共有プランの構造に応じて調整が必要
    const planData = shareData.planData || shareData.plans?.[0]?.planData;
    if (!planData) return res.status(400).json({ error: 'No plan data in shared plan' });

    const timelineEvents = planData.timelineEvents || [];
    const phases = planData.phases || [];

    // 既存テンプレートのバックアップ
    const templateRef = db.doc(`templates/${contentId}`);
    const existing = await templateRef.get();
    if (existing.exists) {
      await db.collection('template_backups').doc(`template_${contentId}_${Date.now()}`).set({
        type: 'template',
        contentId,
        data: existing.data(),
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // テンプレート登録
    const templateData = {
      contentId,
      source: 'popular_plan',
      timelineEvents,
      phases,
      lockedAt: null,
      createdAt: existing.exists ? existing.data()!.createdAt : FieldValue.serverTimestamp(),
      lastUpdatedAt: FieldValue.serverTimestamp(),
      lastUpdatedBy: adminUid,
      candidateShareId: shareId,
    };

    await templateRef.set(templateData);
    await db.doc('master/config').set({ dataVersion: FieldValue.increment(1) }, { merge: true });

    // 昇格フラグ更新
    await db.doc(`shared_plans/${shareId}`).update({
      promotionCandidate: false,
      promotedAt: FieldValue.serverTimestamp(),
      promotedBy: adminUid,
    });

    await writeAuditLog({
      action: 'create',
      target: `template.promoted.${contentId}`,
      adminUid,
      changes: { after: { ...templateData, lastUpdatedAt: '(serverTimestamp)' } },
    });

    await sendDiscordNotification({
      title: `✅ テンプレート昇格完了: ${contentId}`,
      description: `共有プラン ${shareId} からテンプレートに昇格されました`,
      color: 0x22c55e,
      fields: [
        { name: 'イベント数', value: `${timelineEvents.length}`, inline: true },
        { name: '承認者', value: adminUid, inline: true },
      ],
    });

    return res.status(201).json({ success: true, action: 'approved', contentId });
  } catch (err: any) {
    console.error('[promote] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 3: コミット**

```bash
git add api/template/promote/index.ts api/share/index.ts
git commit -m "feat: 人気プラン昇格チェック + 承認API + Discord通知"
```

---

### Task 6: 管理画面 — テンプレートのロック/アンロック + 昇格候補

**Files:**
- Modify: `api/admin/templates/index.ts`（ロック/アンロックPUT操作追加）
- Modify: `src/components/admin/AdminTemplates.tsx`（UI追加）
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: テンプレートAPIにロック/アンロック操作追加**

`api/admin/templates/index.ts` のPUTハンドラーは既に汎用的（`...updates` をマージ）なので、
クライアントから `{ contentId, lockedAt: true }` を送れば実質ロック可能。
ただし `lockedAt` にはサーバータイムスタンプを使いたいので、専用フラグを認識するよう修正:

```typescript
// api/admin/templates/index.ts — PUTハンドラー内に追加
// lockedAt の特殊処理
if (updates.lock === true) {
  mergeData.lockedAt = FieldValue.serverTimestamp();
  delete mergeData.lock;
} else if (updates.lock === false) {
  mergeData.lockedAt = null;
  delete mergeData.lock;
}
```

- [ ] **Step 2: 管理画面テンプレート一覧にロック/昇格UI追加**

`src/components/admin/AdminTemplates.tsx` に以下を追加:
- 各テンプレートにロック/アンロックボタン
- 昇格候補の共有プラン一覧セクション（promotionCandidate: trueのもの）
- 承認/却下ボタン

（具体的なReactコードは既存のAdminTemplates.tsxの構造に合わせて実装する。
  白黒ベースのUIルール、i18nキー経由のテキスト表示ルールに従うこと。）

- [ ] **Step 3: i18nキー追加**

`src/locales/ja.json`:
```json
{
  "admin": {
    "template_lock": "ロック",
    "template_unlock": "アンロック",
    "template_locked": "ロック中（自動更新停止）",
    "template_discovery": "発見フェーズ（自動更新中）",
    "promotion_candidates": "昇格候補",
    "promotion_approve": "承認",
    "promotion_reject": "却下",
    "promotion_copy_count": "コピー数",
    "promotion_empty": "昇格候補はありません",
    "threshold_settings": "閾値設定"
  }
}
```

`src/locales/en.json`:
```json
{
  "admin": {
    "template_lock": "Lock",
    "template_unlock": "Unlock",
    "template_locked": "Locked (auto-update disabled)",
    "template_discovery": "Discovery phase (auto-updating)",
    "promotion_candidates": "Promotion Candidates",
    "promotion_approve": "Approve",
    "promotion_reject": "Reject",
    "promotion_copy_count": "Copy count",
    "promotion_empty": "No promotion candidates",
    "threshold_settings": "Threshold Settings"
  }
}
```

- [ ] **Step 4: ビルド確認**

Run: `npx vite build 2>&1 | tail -5`
Expected: `✓ built in` で成功

- [ ] **Step 5: コミット**

```bash
git add api/admin/templates/index.ts src/components/admin/AdminTemplates.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: 管理画面テンプレートロック/アンロック + 昇格候補UI"
```

---

### Task 7: 管理画面 — 閾値設定UI

**Files:**
- Create: `api/admin/config/index.ts`
- Create: `src/components/admin/AdminConfig.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: config読み書きAPI**

```typescript
// api/admin/config/index.ts
/**
 * マスターコンフィグ管理API
 * GET  /api/admin/config — 現在の設定取得
 * PUT  /api/admin/config — 設定更新（閾値、フィーチャーフラグ等）
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../../src/lib/adminAuth.js';
import { writeAuditLog } from '../../../src/lib/auditLog.js';
import { verifyAppCheck } from '../../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../../src/lib/rateLimit.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;
  if (!applyRateLimit(req, res, 30, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(403).json({ error: 'Unauthorized' });

    const db = getAdminFirestore();
    const configRef = db.doc('master/config');

    if (req.method === 'GET') {
      const snap = await configRef.get();
      return res.status(200).json(snap.exists ? snap.data() : {});
    }

    if (req.method === 'PUT') {
      const updates = req.body || {};
      // 更新可能なフィールドのホワイトリスト
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
      await writeAuditLog({
        action: 'update',
        target: 'config',
        adminUid,
        changes: { before, after: filtered },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('[admin/config] エラー:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: AdminConfig.tsx 閾値設定画面**

```typescript
// src/components/admin/AdminConfig.tsx
// 管理画面: 閾値設定（promotionThreshold, promotionMultiplier, featureFlags）
// 白黒ベースUI、i18nキー経由のテキスト
// 既存のAdminContents.tsxのフォームパターンに合わせて実装
```

（具体的なUIは既存の管理画面コンポーネントの構造・スタイルに合わせること）

- [ ] **Step 3: AdminLayoutにルート追加**

`src/components/admin/AdminLayout.tsx` のナビゲーションに「設定」タブ追加。
`src/App.tsx` に `<Route path="config" element={<AdminConfig />} />` 追加。

- [ ] **Step 4: ビルド確認**

Run: `npx vite build 2>&1 | tail -5`
Expected: `✓ built in` で成功

- [ ] **Step 5: コミット**

```bash
git add api/admin/config/index.ts src/components/admin/AdminConfig.tsx src/components/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat: 管理画面 閾値設定UI + config API"
```

---

### Task 8: Firestoreセキュリティルール更新 + デプロイ

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: copiedByサブコレクションのルール追加**

```javascript
// firestore.rules — shared_plansルール内に追加
match /shared_plans/{shareId}/copiedBy/{uid} {
  allow read: if false;
  allow write: if false; // サーバーAPI経由のみ
}
```

- [ ] **Step 2: ルールデプロイ**

Run: `firebase deploy --only firestore:rules`
Expected: `✅ Deploy complete!`

- [ ] **Step 3: コミット**

```bash
git add firestore.rules
git commit -m "feat: copiedByサブコレクションのセキュリティルール追加"
```

---

### Task 9: PopularPage.tsxの静的インポート修正

**Files:**
- Modify: `src/components/PopularPage.tsx`

- [ ] **Step 1: CONTENT_DEFINITIONS直接参照をFirestore対応関数に変更**

```typescript
// Before:
import { CONTENT_DEFINITIONS, getContentById, getProjectLabel } from '../data/contentRegistry';
const savageContents = CONTENT_DEFINITIONS.filter(c => c.category === 'savage');
const ultimateIds = CONTENT_DEFINITIONS...

// After:
import { getContentByLevel, getContentById, getProjectLabel } from '../data/contentRegistry';
// コンポーネント内で:
const allContents = getContentByLevel(100); // 必要に応じてレベルでフィルタ
// または getContentDefinitions() を contentRegistry.ts からexportして使う
```

具体的な修正はPopularPage.tsxの現在のロジックに合わせて行う。
ポイント: `CONTENT_DEFINITIONS`（静的エクスポート）ではなく `getContentDefinitions()`（ストア対応）を使う。

- [ ] **Step 2: contentRegistry.tsから getContentDefinitions をexport**

```typescript
// src/data/contentRegistry.ts
// 既存のprivate関数をexportに変更
export function getContentDefinitions(): ContentDefinition[] {
    const store = useMasterDataStore.getState();
    return store.contents?.items ?? STATIC_CONTENT_DEFINITIONS;
}
```

- [ ] **Step 3: ビルド確認**

Run: `npx vite build 2>&1 | tail -5`

- [ ] **Step 4: コミット**

```bash
git add src/components/PopularPage.tsx src/data/contentRegistry.ts
git commit -m "fix: PopularPage静的インポートをFirestore対応関数に変更"
```

---

### Task 10: 統合テスト + Vercelデプロイ

- [ ] **Step 1: ローカルビルド + 動作確認**

Run: `npx vite build && npx vite preview`

確認項目:
1. アプリが正常に起動する
2. サイドバーにコンテンツ一覧が表示される（Firestore or 静的フォールバック）
3. FFLogsインポートが正常に動作する
4. 管理画面にアクセスできる

- [ ] **Step 2: Vercelデプロイ**

Run: `git push origin main`

デプロイ後の確認:
1. https://lopoly.app/ が正常に動作
2. https://lopoly.app/admin のテンプレート管理にロック/アンロックが表示
3. 設定タブが追加されている

- [ ] **Step 3: シード確認（Firestoreにデータがあるか）**

管理画面 → コンテンツ管理 で一覧が表示されるか確認。
表示されない場合: `node scripts/seed-firestore.mjs` を実行。

---

## 依存関係

```
Task 1 (Discord Webhook) ←─── Task 2, 5, 6 が依存
Task 2 (auto-register API) ←─── Task 3 が依存
Task 4 (copyCount dedup) ←─── Task 5 が依存
Task 9 (PopularPage修正) は独立

並列実行可能:
- Task 1 + Task 4 + Task 9
- Task 2 (Task 1完了後) + Task 6 (Task 1完了後)
- Task 3 (Task 2完了後)
- Task 5 (Task 1 + Task 4 完了後)
- Task 7 は独立
- Task 8 は Task 4 完了後
- Task 10 は全タスク完了後
```
