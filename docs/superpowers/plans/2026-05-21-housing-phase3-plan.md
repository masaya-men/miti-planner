# Housing Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジングツアーに「家主編集・削除 / 物件詳細表示 / 通報フロー + 通知」 を業界水準準拠で追加し、 動く骨組みを提供する。

**Architecture:**
- 詳細表示は **react-router-dom v7 の background-location パターン** (Next.js Intercepting Routes 相当を React Router で実現)。 一覧 → カードクリック → モーダル (URL 更新)、 直アクセス → フルページ。
- soft delete は **`deletedAt` を新規追加**。 既存 `isHidden` は「運営側非表示」 (3 件通報自動 + 管理画面手動)、 新規 `deletedAt` は「家主削除」 と役割分離。 一覧クエリは `isHidden == false && deletedAt == null`。
- API は既存 `api/housing/index.ts` の action ルーティング (`?action=...`) を拡張、 新規 5 ハンドラを `_*Handler.ts` で分離。 認証は既存パターン (`Bearer` トークン → `getAuth().verifyIdToken()`)。
- 通報は Firestore Transaction で `reports` doc 作成 + `reportCount` +1 + 通知 doc 作成 + 自動非表示判定をアトミックに実行。
- 通知は `users/{uid}/notifications/{id}` に保存、 `onSnapshot` でリアルタイム購読。 reporterUid は通知側に書かない (家主に渡らない)。

**Tech Stack:**
- React 18 + TypeScript + Vite 7 + react-router-dom v7
- Firebase Admin SDK (server)、 Firebase Web SDK + onSnapshot (client)
- Zod (validation)、 zustand (state)
- Vitest (pool='vmThreads' 維持)、 React Testing Library
- ハウジング独自トンマナ: `src/styles/housing.css` の CSS 変数 (`--housing-honey`, `--housing-panel-bg`, `--housing-text-base` 等) を使う。 Inter フォント・ハニーゴールド色採用 OK。

**Reference docs:**
- Spec: `docs/superpowers/specs/2026-05-20-housing-phase3-design.md`
- Mockup: `docs/.private/housing-tour-mockup/index.html` (トンマナ正典)
- Rules: `.claude/rules/housing-design.md`, `.claude/rules/i18n.md`, `.claude/rules/css-rules.md`
- Memory: `feedback_industry_standard.md`, `feedback_housing_design_independent.md`, `feedback_auth_privacy.md`, `feedback_no_hardcoding.md`, `feedback_build_check.md`, `feedback_vercel_tsc_strict.md`

---

## File Structure

### 新規ファイル

**型 / 定数**
- `src/types/notification.ts` — `HousingNotification` 型 + 型ガード
- `src/types/housing.ts` (modify) — `HousingListing.deletedAt` 追加

**API ハンドラ** (`api/housing/`)
- `_updateListingHandler.ts` — 物件編集 (ownerUid 認可)
- `_deleteListingHandler.ts` — soft delete (`deletedAt` 設定)
- `_reportListingHandler.ts` — 通報送信 (transaction、 通知作成)
- `_listNotificationsHandler.ts` — 通知一覧 GET
- `_markNotificationReadHandler.ts` — 既読化 POST
- `index.ts` (modify) — 新規 5 action 分岐追加

**詳細表示** (`src/components/housing/listing/`)
- `HousingDetailContent.tsx` — 詳細の中身 (モーダル/ページ両用)
- `HousingDetailModal.tsx` — モーダルラッパー (PC dialog / SP bottom sheet)
- `HousingDetailLayout.tsx` — フルページラッパー
- `HousingDetailPage.tsx` — `/housing/listing/:id` 用エントリ
- `HousingActionBar.tsx` — お気に入り / シェア / ちがった / kebab
- `HousingDetailKebab.tsx` — 家主専用 ︙ メニュー (編集 / 削除)
- `HousingPhotoGallery.tsx` — 写真ギャラリー
- `HousingShareButton.tsx` — Web Share API + X URL + コピー
- `HousingDetailRoutes.tsx` — background-location パターンの実装ヘルパ

**通報** (`src/components/housing/report/`)
- `HousingReportModal.tsx` — reason 5 択モーダル
- `HousingReportGuideModal.tsx` — 通知後の reason 別 CTA モーダル
- `useHousingReport.ts` — 通報送信フック

**削除確認** (`src/components/housing/delete/`)
- `HousingDeleteConfirm.tsx` — 削除確認ダイアログ
- `useHousingDelete.ts` — 削除送信フック

**編集** (`src/components/housing/edit/`)
- `HousingEditModal.tsx` — 既存 `HousingRegisterModal` を mode='edit' で呼ぶ薄いラッパー
- `useHousingUpdate.ts` — 編集送信フック

**通知** (`src/components/housing/notifications/`)
- `NotificationBell.tsx` — bell + 未読バッジ
- `NotificationDropdown.tsx` — クリックで開くドロップダウン
- `NotificationItem.tsx` — ドロップダウン内 1 行
- `useNotifications.ts` — `onSnapshot` 購読フック

**スタイル**
- `src/styles/housing.css` (modify) — 詳細モーダル / bottom sheet / dropdown / report modal の class を追加

### 既存ファイル変更

- `src/types/housing.ts` — `deletedAt: number | null` 追加
- `src/components/housing/workspace/HousingRegisterModal.tsx` — `mode: 'create' \| 'edit'` props + `initialValues` props 追加
- `src/components/housing/workspace/TopBar.tsx` — `<NotificationBell>` 配置
- `src/components/housing/HousingDetailPagePlaceholder.tsx` — 削除
- `src/App.tsx` — `/housing/listing/:id` ルート追加 (background-location 対応)
- `src/components/housing/HousingWorkspace.tsx` — 物件カードクリックを `<Link>` に変更、 background-location state を付与
- `api/housing/index.ts` — 新規 action 5 つの分岐追加
- `firestore.rules` — 既存 housing_listings の update/delete ルール + users/{uid}/notifications ルール追加
- `src/locales/ja.json` — Phase 3 用 i18n キー追加
- `src/locales/en.json` / `ko.json` / `zh.json` — 同じキー構造でジャ値コピー (動作確認は ja で行う)

### 既存ファイル削除

- `src/components/housing/HousingDetailPagePlaceholder.tsx` — 本実装で置き換え

---

## TDD Policy (重要)

各タスクで以下のルールを適用:
- **React コンポーネント / フック / 純粋関数**: 失敗するテストを書く → 実装で通す → リファクタの順 (spec §9.1 準拠)
- **API ハンドラ**: 既存プロジェクトに API ハンドラのユニットテストパターンがないため (firebase-admin ESM 制約)、 **API ハンドラはテストを書かず手動動作確認のみ**。 ただしハンドラ内で使う**純粋関数 (validation, transaction-logic 等) はテスト書く**。
- **CSS**: テストなし、 視覚確認のみ
- **型定義**: TypeScript で守られるためテスト不要、 ただし**型ガード関数はテスト書く**

---

# Phase 1 — 基盤 (型 + Rules + 一覧フィルタ)

## Task 1: HousingListing に deletedAt フィールド追加

**Files:**
- Modify: `src/types/housing.ts:129` (`isHidden` の下に `deletedAt` 追加)
- Test: `src/__tests__/housing/housingTypes.test.ts` (既存ファイルに 1 ケース追加)

- [ ] **Step 1: 既存テストファイルに deletedAt 検証ケース追加**

```typescript
// src/__tests__/housing/housingTypes.test.ts に追記
import type { HousingListing } from '@/types/housing';

describe('HousingListing.deletedAt', () => {
  it('null と number の両方を許容する', () => {
    const alive: HousingListing['deletedAt'] = null;
    const deleted: HousingListing['deletedAt'] = Date.now();
    expect(alive).toBeNull();
    expect(typeof deleted).toBe('number');
  });
});
```

- [ ] **Step 2: テスト実行 → fail 確認 (型エラー)**

Run: `npx vitest run src/__tests__/housing/housingTypes.test.ts`
Expected: FAIL — `'deletedAt' does not exist on type 'HousingListing'`

- [ ] **Step 3: 型定義に追加**

`src/types/housing.ts` の `HousingListing` interface の `reportCount: number;` の直後 (line 130 付近) に追記:

```typescript
  /**
   * 家主による削除タイムスタンプ (soft delete)。
   * - null: 生きてる
   * - number: 削除済み (30 日後に物理削除予定)
   * 既存の isHidden は「運営非表示 (自動/手動)」 として用途分離する。
   */
  deletedAt: number | null;
```

- [ ] **Step 4: テスト pass 確認**

Run: `npx vitest run src/__tests__/housing/housingTypes.test.ts`
Expected: PASS

- [ ] **Step 5: 既存 validator が deletedAt を想定していないか確認**

Run: `npx tsc --noEmit`
Expected: 既存 `src/utils/housingValidation.ts` 等で型エラーが出る場合は最小修正 (新規物件作成時は `deletedAt: null` を返す等)。

確認ポイント:
- `_registerListingHandler.ts` で listing doc を作る箇所に `deletedAt: null` を追加
- `housingValidation.ts` の `validateRegistrationDraft` が `deletedAt` を扱う必要はない (登録時は null 固定)

修正例 (`api/housing/_registerListingHandler.ts` の listing 構築箇所):

```typescript
const listing: Omit<HousingListing, 'id'> = {
  // ... 既存フィールド
  reportCount: 0,
  deletedAt: null,  // ← 追加
};
```

- [ ] **Step 6: 一覧クエリに deletedAt フィルタ追加**

一覧取得ハンドラがあれば (`_listListingsHandler.ts` 等)、 既存の `.where('isHidden', '==', false)` の隣に `.where('deletedAt', '==', null)` を追加。 もしまだ一覧ハンドラがなければこの step はスキップ (詳細表示は単一 doc 取得で動くため)。

```typescript
const snap = await adminDb
  .collection('housing_listings')
  .where('isHidden', '==', false)
  .where('deletedAt', '==', null)  // ← 追加
  .limit(50)
  .get();
```

注意: 既存ドキュメントは `deletedAt` フィールドを持たない → Firestore の `where(field, '==', null)` は **フィールド未設定 doc にもマッチする** (`null` と「未設定」 を区別しない) ので、 過去データに影響なし。

- [ ] **Step 7: build + 全テスト**

Run: `rtk npm run build`
Expected: 成功
Run: `npx vitest run`
Expected: 既存テスト全 pass

- [ ] **Step 8: Commit**

```bash
rtk git add src/types/housing.ts src/__tests__/housing/housingTypes.test.ts api/housing/_registerListingHandler.ts
rtk git commit -m "feat(housing-phase3): HousingListing に deletedAt (soft delete) フィールド追加"
```

---

## Task 2: HousingNotification 型 + 型ガード

**Files:**
- Create: `src/types/notification.ts`
- Test: `src/__tests__/housing/notificationTypes.test.ts`

- [ ] **Step 1: テスト作成**

`src/__tests__/housing/notificationTypes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  isValidNotificationType,
  isValidSeverity,
  type HousingNotification,
} from '@/types/notification';

describe('notification types', () => {
  describe('isValidNotificationType', () => {
    it("'housing_report' を許容する", () => {
      expect(isValidNotificationType('housing_report')).toBe(true);
    });
    it('未知の値を拒否する', () => {
      expect(isValidNotificationType('unknown')).toBe(false);
    });
  });

  describe('isValidSeverity', () => {
    it("'normal' と 'high' を許容する", () => {
      expect(isValidSeverity('normal')).toBe(true);
      expect(isValidSeverity('high')).toBe(true);
    });
    it('未知の値を拒否する', () => {
      expect(isValidSeverity('critical')).toBe(false);
    });
  });

  describe('HousingNotification 型', () => {
    it('必須フィールドを持つオブジェクトを構築できる', () => {
      const n: HousingNotification = {
        id: 'nid1',
        type: 'housing_report',
        listingId: 'lid1',
        reason: 'wrong_info',
        severity: 'normal',
        createdAt: Date.now(),
        read: false,
      };
      expect(n.type).toBe('housing_report');
    });
  });
});
```

- [ ] **Step 2: fail 確認**

Run: `npx vitest run src/__tests__/housing/notificationTypes.test.ts`
Expected: FAIL — `Cannot find module '@/types/notification'`

- [ ] **Step 3: 型ファイル作成**

`src/types/notification.ts`:

```typescript
import type { ReportReason } from './housing';

export const NOTIFICATION_TYPES = ['housing_report'] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const NOTIFICATION_SEVERITIES = ['normal', 'high'] as const;
export type NotificationSeverity = typeof NOTIFICATION_SEVERITIES[number];

export function isValidNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isValidSeverity(value: string): value is NotificationSeverity {
  return (NOTIFICATION_SEVERITIES as readonly string[]).includes(value);
}

/**
 * users/{uid}/notifications/{id} - アプリ内通知
 * 重要: 通報者の reporterUid はここに保存しない (家主に渡らない)
 */
export interface HousingNotification {
  id: string;
  type: NotificationType;
  listingId: string;
  /** 通報理由 (type='housing_report' の場合) */
  reason: ReportReason;
  /** griefing / nsfw は 'high'、 他は 'normal' */
  severity: NotificationSeverity;
  /** reason = 'other' の場合に通報者が入れたコメント */
  comment?: string;
  /** Listing 削除済みでも通知は残るため、 タイトルをスナップショット */
  listingTitleSnapshot?: string;
  createdAt: number;
  read: boolean;
  readAt?: number;
}
```

- [ ] **Step 4: pass 確認**

Run: `npx vitest run src/__tests__/housing/notificationTypes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/types/notification.ts src/__tests__/housing/notificationTypes.test.ts
rtk git commit -m "feat(housing-phase3): HousingNotification 型と型ガード追加"
```

---

## Task 3: Firestore Security Rules 更新

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: 既存 firestore.rules を確認**

Run: `cat firestore.rules | head -80` で housing_listings セクションを確認。 以下を追加/更新。

- [ ] **Step 2: housing_listings の update / delete ルール追加**

`firestore.rules` の housing_listings ブロックを以下に置き換え (既存に類似ブロックがあれば置き換え、 なければ追加):

```javascript
match /housing_listings/{listingId} {
  allow read: if true;  // 公開
  // create: Admin SDK 経由のみ (登録は Cloud Function 相当の API ハンドラから)
  allow create: if false;
  // update: 家主本人のみ。 ownerUid 改竄禁止。
  allow update: if request.auth != null
                && request.auth.uid == resource.data.ownerUid
                && request.resource.data.ownerUid == resource.data.ownerUid;
  // delete: 物理削除はクライアントから禁止 (Admin SDK のみ、 30 日後 cron 想定)
  allow delete: if false;

  match /reports/{reportId} {
    // 読み: 管理者のみ
    allow read: if request.auth != null && request.auth.token.admin == true;
    // 作成: 認証ユーザー、 ただし reporterUid は自分自身
    allow create: if request.auth != null
                  && request.resource.data.reporterUid == request.auth.uid;
    allow update, delete: if false;
  }
}
```

- [ ] **Step 3: users/{uid}/notifications ルール追加**

```javascript
match /users/{uid}/notifications/{notificationId} {
  // 読: 本人のみ
  allow read: if request.auth != null && request.auth.uid == uid;
  // 更新: 本人のみ、 既読フラグの更新だけ許可
  allow update: if request.auth != null
                && request.auth.uid == uid
                && request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['read', 'readAt']);
  // 作成・削除: Admin SDK 経由のみ
  allow create, delete: if false;
}
```

- [ ] **Step 4: ルールデプロイ**

Firebase CLI が使えるなら:

```bash
firebase deploy --only firestore:rules
```

使えなければ Firebase Console から手動デプロイ。 デプロイは **このタスク段階では実施しない** (実装完了後にまとめて行う) → ファイル変更だけしてコミットする。

- [ ] **Step 5: Commit**

```bash
rtk git add firestore.rules
rtk git commit -m "feat(housing-phase3): Firestore Rules に housing 編集/通報/通知ルール追加"
```

---

# Phase 2 — Sub-spec 3-A 編集削除

## Task 4: _updateListingHandler 実装 + index.ts に登録

**Files:**
- Create: `api/housing/_updateListingHandler.ts`
- Modify: `api/housing/index.ts`

参考: `api/housing/_registerListingHandler.ts` の構造をベースに作る。

- [ ] **Step 1: 既存 _registerListingHandler.ts の構造を確認**

Run: `cat api/housing/_registerListingHandler.ts` (既存パターン: initAdmin, verifyAppCheck, applyRateLimit, getAuth, runTransaction, setCors)

- [ ] **Step 2: _updateListingHandler.ts 作成**

`api/housing/_updateListingHandler.ts`:

```typescript
/**
 * ハウジング物件編集ハンドラ
 * 認可: ownerUid 一致のみ
 * Body: { listingId, ...updatedFields }
 * 更新可能フィールド: dc, server, area, ward, plot, size, buildingType,
 *   roomKind, roomNumber, imageMode, postUrl, ogImageUrl, thumbnailPath,
 *   tags, description, addressKey
 * 不変フィールド: id, ownerUid, createdAt, reportCount, isHidden, deletedAt
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { validateRegistrationDraft } from '../../src/utils/housingValidation.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId, ...updates } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    // validation: draft 構造を組み立てて zod 通す
    const draftForValidation = {
      dc: updates.dc,
      server: updates.server,
      area: updates.area,
      ward: updates.ward,
      plot: updates.plot,
      size: updates.size,
      buildingType: updates.buildingType,
      roomKind: updates.roomKind,
      roomNumber: updates.roomNumber,
      imageMode: updates.imageMode,
      postUrl: updates.postUrl,
      ogImageUrl: updates.ogImageUrl,
      thumbnailPath: updates.thumbnailPath,
      tags: updates.tags ?? [],
      description: updates.description,
      addressKey: updates.addressKey,
    };
    const result = validateRegistrationDraft(draftForValidation as any);
    if (!result.ok) {
      return res.status(400).json({ error: 'invalid_request', errors: result.errors });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('not_found'); // 削除済みは編集不可

      tx.update(listingRef, {
        ...draftForValidation,
        updatedAt: Date.now(),
      });
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[housing/update-listing] error:', error);
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 3: index.ts に action 追加**

`api/housing/index.ts`:

```typescript
import canRegisterHandler from './_canRegisterHandler.js';
import registerListingHandler from './_registerListingHandler.js';
import checkDuplicateHandler from './_checkDuplicateHandler.js';
import updateListingHandler from './_updateListingHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'can-register':
      return canRegisterHandler(req, res);
    case 'register-listing':
      return registerListingHandler(req, res);
    case 'check-duplicate':
      return checkDuplicateHandler(req, res);
    case 'update-listing':
      return updateListingHandler(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter.',
      });
  }
}
```

- [ ] **Step 4: build 確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 5: Commit (次タスクと合わせて後でまとめる、 一旦単独でも OK)**

このタスクは Task 5 (delete handler) と合わせて 1 commit にする (次タスクの Step 5 でまとめて commit)。

---

## Task 5: _deleteListingHandler 実装

**Files:**
- Create: `api/housing/_deleteListingHandler.ts`
- Modify: `api/housing/index.ts`

- [ ] **Step 1: _deleteListingHandler.ts 作成**

`api/housing/_deleteListingHandler.ts`:

```typescript
/**
 * ハウジング物件 soft delete ハンドラ
 * 認可: ownerUid 一致のみ
 * Body: { listingId }
 * 動作: housing_listings/{id}.deletedAt = Date.now() を設定
 *   サブコレクション (reports) はそのまま保持 (異議申し立て対応)
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';

function setCors(req: any, res: any) {
  // ... _updateListingHandler.ts と同じ
  const origin = req.headers?.origin || '';
  const allowed = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { listingId } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid !== uid) throw new Error('forbidden');
      if (data.deletedAt) throw new Error('already_deleted');

      tx.update(listingRef, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[housing/delete-listing] error:', error);
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'forbidden') return res.status(403).json({ error: 'forbidden' });
    if (error?.message === 'already_deleted') return res.status(200).json({ success: true }); // idempotent
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: index.ts に action 追加**

```typescript
import deleteListingHandler from './_deleteListingHandler.js';

// switch 内に追加
case 'delete-listing':
  return deleteListingHandler(req, res);
```

- [ ] **Step 3: build 確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: Commit**

```bash
rtk git add api/housing/_updateListingHandler.ts api/housing/_deleteListingHandler.ts api/housing/index.ts
rtk git commit -m "feat(housing-phase3): 編集 / 削除 API ハンドラ追加 (update-listing / delete-listing)"
```

---

## Task 6: HousingRegisterModal を edit モード対応化

**Files:**
- Modify: `src/components/housing/workspace/HousingRegisterModal.tsx`
- Test: `src/components/housing/workspace/__tests__/HousingRegisterModal.test.tsx` (なければ作成)

- [ ] **Step 1: 既存 HousingRegisterModal の props を確認**

Run: `cat src/components/housing/workspace/HousingRegisterModal.tsx | head -50`

現在: `{ open: boolean; onClose: () => void }`

- [ ] **Step 2: 拡張テストを書く**

`src/components/housing/workspace/__tests__/HousingRegisterModal.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingRegisterModal } from '../HousingRegisterModal';

// Firebase / i18n 等は mock
vi.mock('@/lib/firebase', () => ({ /* ... */ }));

describe('HousingRegisterModal mode', () => {
  it("mode='create' (default) でタイトルが「物件を登録」 になる", () => {
    render(<HousingRegisterModal open={true} onClose={() => {}} />);
    // ja の housing.register.title が表示されることを確認
    expect(screen.getByText(/物件を登録/i)).toBeInTheDocument();
  });

  it("mode='edit' でタイトルが「物件を編集」 になり、 initialValues を反映する", () => {
    const initial = {
      id: 'lid1',
      dc: 'Mana',
      server: 'Anima',
      area: 'Mist' as const,
      ward: 5,
      buildingType: 'house' as const,
      plot: 12,
      size: 'M' as const,
      addressKey: 'mana-anima-mist-5-house-12',
      imageMode: 'thumbnail' as const,
      tags: ['和風'],
    };
    render(
      <HousingRegisterModal
        open={true}
        onClose={() => {}}
        mode="edit"
        initialValues={initial}
      />
    );
    expect(screen.getByText(/物件を編集/i)).toBeInTheDocument();
    // tags が反映される確認等
  });
});
```

- [ ] **Step 3: fail 確認**

Run: `npx vitest run src/components/housing/workspace/__tests__/HousingRegisterModal.test.tsx`
Expected: FAIL (mode props がまだない)

- [ ] **Step 4: HousingRegisterModal に mode + initialValues + listingId props 追加**

`src/components/housing/workspace/HousingRegisterModal.tsx`:

```typescript
interface HousingRegisterModalProps {
  open: boolean;
  onClose: () => void;
  /** デフォルト 'create'。 'edit' で編集モード */
  mode?: 'create' | 'edit';
  /** mode='edit' の場合に必須。 編集対象の物件 */
  initialValues?: Partial<HousingListing> & { id: string };
}

export function HousingRegisterModal({
  open,
  onClose,
  mode = 'create',
  initialValues,
}: HousingRegisterModalProps) {
  const { t } = useTranslation();
  const title = mode === 'edit'
    ? t('housing.edit.modal.title')
    : t('housing.register.title');
  // ... 既存ロジック
  // フォーム初期値: mode='edit' なら initialValues を流し込む
  // submit 時: mode='edit' なら ?action=update-listing を呼ぶ、 'create' なら register-listing
}
```

具体的な改修箇所:
1. props に `mode` と `initialValues` を追加
2. フォーム state の初期値を `initialValues` ベースにする (Edit 時)
3. submit ハンドラで mode 分岐:
   ```typescript
   const endpoint = mode === 'edit'
     ? '/api/housing?action=update-listing'
     : '/api/housing?action=register-listing';
   const body = mode === 'edit'
     ? { listingId: initialValues!.id, ...draft }
     : draft;
   ```
4. submit ボタン文言を `t('housing.edit.save')` or `t('housing.register.submit')`

- [ ] **Step 5: テスト pass 確認**

Run: `npx vitest run src/components/housing/workspace/__tests__/HousingRegisterModal.test.tsx`
Expected: PASS

- [ ] **Step 6: build**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 7: Commit (Task 8 まで保留、 編集 UI 一括コミット)**

---

## Task 7: HousingEditModal (薄いラッパー) + useHousingUpdate フック

**Files:**
- Create: `src/components/housing/edit/HousingEditModal.tsx`
- Create: `src/components/housing/edit/useHousingUpdate.ts`
- Test: `src/components/housing/edit/__tests__/useHousingUpdate.test.ts`

- [ ] **Step 1: useHousingUpdate のテスト書く**

`src/components/housing/edit/__tests__/useHousingUpdate.test.ts`:

```typescript
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingUpdate } from '../useHousingUpdate';

// firebase auth mock
vi.mock('@/lib/firebase', () => ({
  getCurrentUserIdToken: vi.fn(async () => 'mock-token'),
}));

describe('useHousingUpdate', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時に success=true と data を返す', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingUpdate());
    let res;
    await act(async () => {
      res = await result.current.update('lid1', { description: 'updated' });
    });
    expect(res).toEqual({ ok: true });
  });

  it('403 でエラーを返す', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    });
    const { result } = renderHook(() => useHousingUpdate());
    let res;
    await act(async () => {
      res = await result.current.update('lid1', {});
    });
    expect(res).toEqual({ ok: false, error: 'forbidden' });
  });
});
```

- [ ] **Step 2: fail 確認**

Run: `npx vitest run src/components/housing/edit/__tests__/useHousingUpdate.test.ts`
Expected: FAIL (モジュール未作成)

- [ ] **Step 3: useHousingUpdate.ts 作成**

```typescript
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

export interface UseHousingUpdateResult {
  ok: boolean;
  error?: string;
}

export function useHousingUpdate() {
  const [loading, setLoading] = useState(false);

  async function update(
    listingId: string,
    updates: Record<string, unknown>
  ): Promise<UseHousingUpdateResult> {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) return { ok: false, error: 'unauthenticated' };
      const token = await user.getIdToken();
      const res = await fetch('/api/housing?action=update-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId, ...updates }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data?.error ?? `http_${res.status}` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'unknown_error' };
    } finally {
      setLoading(false);
    }
  }

  return { update, loading };
}
```

- [ ] **Step 4: pass 確認**

Run: `npx vitest run src/components/housing/edit/__tests__/useHousingUpdate.test.ts`
Expected: PASS

- [ ] **Step 5: HousingEditModal 作成 (薄いラッパー)**

`src/components/housing/edit/HousingEditModal.tsx`:

```typescript
import { HousingRegisterModal } from '../workspace/HousingRegisterModal';
import type { HousingListing } from '@/types/housing';

interface HousingEditModalProps {
  open: boolean;
  onClose: () => void;
  listing: HousingListing;
}

export function HousingEditModal({ open, onClose, listing }: HousingEditModalProps) {
  return (
    <HousingRegisterModal
      open={open}
      onClose={onClose}
      mode="edit"
      initialValues={listing}
    />
  );
}
```

- [ ] **Step 6: build**

Run: `rtk npm run build`
Expected: 成功

---

## Task 8: HousingDeleteConfirm + useHousingDelete

**Files:**
- Create: `src/components/housing/delete/HousingDeleteConfirm.tsx`
- Create: `src/components/housing/delete/useHousingDelete.ts`
- Test: `src/components/housing/delete/__tests__/HousingDeleteConfirm.test.tsx`
- Test: `src/components/housing/delete/__tests__/useHousingDelete.test.ts`

- [ ] **Step 1: useHousingDelete のテスト書く**

`src/components/housing/delete/__tests__/useHousingDelete.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingDelete } from '../useHousingDelete';

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'mock-token' } }),
}));

describe('useHousingDelete', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('成功時 ok=true', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingDelete());
    let res;
    await act(async () => {
      res = await result.current.deleteListing('lid1');
    });
    expect(res).toEqual({ ok: true });
  });

  it('404 で not_found', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false, status: 404, json: async () => ({ error: 'not_found' }),
    });
    const { result } = renderHook(() => useHousingDelete());
    let res;
    await act(async () => {
      res = await result.current.deleteListing('lid1');
    });
    expect(res).toEqual({ ok: false, error: 'not_found' });
  });
});
```

- [ ] **Step 2: fail 確認 → useHousingDelete.ts 実装 → pass**

`src/components/housing/delete/useHousingDelete.ts`:

```typescript
import { useState } from 'react';
import { getAuth } from 'firebase/auth';

export function useHousingDelete() {
  const [loading, setLoading] = useState(false);

  async function deleteListing(listingId: string) {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) return { ok: false, error: 'unauthenticated' };
      const token = await user.getIdToken();
      const res = await fetch('/api/housing?action=delete-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data?.error ?? `http_${res.status}` };
      }
      return { ok: true };
    } finally {
      setLoading(false);
    }
  }

  return { deleteListing, loading };
}
```

Run: `npx vitest run src/components/housing/delete/__tests__/useHousingDelete.test.ts`
Expected: PASS

- [ ] **Step 3: HousingDeleteConfirm のテスト書く**

`src/components/housing/delete/__tests__/HousingDeleteConfirm.test.tsx`:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingDeleteConfirm } from '../HousingDeleteConfirm';

describe('HousingDeleteConfirm', () => {
  it('物件タイトルが表示される', () => {
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="和風の隠れ家"
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText(/和風の隠れ家/)).toBeInTheDocument();
  });

  it('「削除する」 クリックで onConfirm が呼ばれる', () => {
    const onConfirm = vi.fn();
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="X"
        onCancel={() => {}}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /削除する/ }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('「キャンセル」 クリックで onCancel が呼ばれる', () => {
    const onCancel = vi.fn();
    render(
      <HousingDeleteConfirm
        open={true}
        listingTitle="X"
        onCancel={onCancel}
        onConfirm={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /キャンセル/ }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: HousingDeleteConfirm.tsx 実装**

```typescript
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  listingTitle: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function HousingDeleteConfirm({
  open, listingTitle, onCancel, onConfirm, loading,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;
  return (
    <div className="housing-modal-backdrop" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="housing-delete-confirm-card"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-delete-confirm-title">{t('housing.delete.title')}</h2>
        <p className="housing-delete-confirm-target">「{listingTitle}」</p>
        <ul className="housing-delete-confirm-body">
          <li>{t('housing.delete.body.line1')}</li>
          <li>{t('housing.delete.body.line2')}</li>
          <li>{t('housing.delete.body.line3')}</li>
        </ul>
        <div className="housing-delete-confirm-actions">
          <button type="button" onClick={onCancel} disabled={loading}>
            {t('housing.delete.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="housing-btn-danger"
          >
            {t('housing.delete.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: CSS 追加** (`src/styles/housing.css` に追記)

```css
.housing-modal-backdrop {
  position: fixed; inset: 0; z-index: 80;
  background: rgba(0, 0, 0, 0.55);
  display: grid; place-items: center;
}
.housing-delete-confirm-card {
  background: rgba(20, 14, 8, 0.96);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: var(--housing-panel-radius);
  padding: 24px 28px;
  max-width: 420px;
  color: var(--housing-text);
  font-size: var(--housing-text-base);
}
.housing-delete-confirm-title {
  font-size: 18px; font-weight: 600; margin: 0 0 12px;
  color: #ff8a6c; /* warning */
}
.housing-delete-confirm-target {
  margin: 0 0 16px; color: var(--housing-text-dim);
}
.housing-delete-confirm-body {
  list-style: disc inside; margin: 0 0 24px; padding: 0;
  color: var(--housing-text-dim); line-height: 1.6;
}
.housing-delete-confirm-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
.housing-delete-confirm-actions button {
  padding: 8px 16px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--housing-panel-border);
  color: var(--housing-text); cursor: pointer;
  font-size: var(--housing-text-base);
}
.housing-btn-danger {
  background: #c44a3a !important;
  border-color: #c44a3a !important;
  color: #fff !important;
}
.housing-btn-danger:hover { background: #d85b4a !important; }
```

- [ ] **Step 6: テスト pass 確認**

Run: `npx vitest run src/components/housing/delete/__tests__/`
Expected: PASS

- [ ] **Step 7: build**

Run: `rtk npm run build`
Expected: 成功

---

## Task 9: HousingDetailKebab (家主専用 ︙ メニュー)

**Files:**
- Create: `src/components/housing/listing/HousingDetailKebab.tsx`
- Test: `src/components/housing/listing/__tests__/HousingDetailKebab.test.tsx`

- [ ] **Step 1: テスト書く**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { HousingDetailKebab } from '../HousingDetailKebab';

describe('HousingDetailKebab', () => {
  it('クリックで「編集」「削除」 が表示される', () => {
    render(<HousingDetailKebab onEdit={() => {}} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /メニュー/ }));
    expect(screen.getByText(/編集/)).toBeInTheDocument();
    expect(screen.getByText(/削除/)).toBeInTheDocument();
  });

  it('編集クリックで onEdit が呼ばれる', () => {
    const onEdit = vi.fn();
    render(<HousingDetailKebab onEdit={onEdit} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /メニュー/ }));
    fireEvent.click(screen.getByText(/編集/));
    expect(onEdit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: HousingDetailKebab.tsx 実装**

```typescript
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  onEdit: () => void;
  onDelete: () => void;
}

export function HousingDetailKebab({ onEdit, onDelete }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div className="housing-kebab" ref={ref}>
      <button
        type="button"
        aria-label={t('housing.detail.kebab.aria_label')}
        className="housing-kebab-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="5" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="19" r="2" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="housing-kebab-menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            {t('housing.detail.kebab.edit')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="housing-kebab-item-danger"
            onClick={() => { setOpen(false); onDelete(); }}
          >
            {t('housing.detail.kebab.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: CSS 追加** (`src/styles/housing.css` 末尾)

```css
.housing-kebab { position: relative; display: inline-block; }
.housing-kebab-trigger {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--housing-panel-border);
  color: var(--housing-text); cursor: pointer;
  display: grid; place-items: center;
}
.housing-kebab-trigger:hover { background: rgba(255, 255, 255, 0.12); }
.housing-kebab-menu {
  position: absolute; right: 0; top: calc(100% + 4px);
  min-width: 160px;
  background: rgba(20, 14, 8, 0.98);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: 12px;
  padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
  z-index: 90;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
}
.housing-kebab-menu button {
  background: transparent; border: none;
  color: var(--housing-text);
  font-size: var(--housing-text-base);
  text-align: left; padding: 8px 12px; cursor: pointer;
  border-radius: 8px;
}
.housing-kebab-menu button:hover { background: rgba(255, 201, 135, 0.12); }
.housing-kebab-item-danger { color: #ff8a6c !important; }
.housing-kebab-item-danger:hover { background: rgba(255, 138, 108, 0.16) !important; }
```

- [ ] **Step 4: テスト pass 確認 + build**

Run: `npx vitest run src/components/housing/listing/__tests__/HousingDetailKebab.test.tsx`
Run: `rtk npm run build`

- [ ] **Step 5: Commit (編集削除 UI 一式)**

```bash
rtk git add src/components/housing/edit/ src/components/housing/delete/ src/components/housing/listing/HousingDetailKebab.tsx src/components/housing/listing/__tests__/HousingDetailKebab.test.tsx src/components/housing/workspace/HousingRegisterModal.tsx src/components/housing/workspace/__tests__/HousingRegisterModal.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing-phase3): 家主編集モーダル / 削除確認 / kebab メニュー追加"
```

---

# Phase 3 — Sub-spec 3-B 詳細表示

## Task 10: i18n キーを ja.json に追加 (Phase 3 全 sub-spec 分)

**Files:**
- Modify: `src/locales/ja.json`, `en.json`, `ko.json`, `zh.json`

このタイミングで一括追加。 en/ko/zh は同じキー構造で ja 値コピー (動作確認 ja 優先、 翻訳は次セッション)。

- [ ] **Step 1: ja.json の `"housing"` ブロック直下に Phase 3 用キーを追加**

`src/locales/ja.json`:

```jsonc
{
  "housing": {
    /* ... 既存 ... */

    "detail": {
      "title": "物件詳細",
      "owner_label": "登録者",
      "share": "シェア",
      "share_copy_link": "リンクをコピー",
      "share_copied": "コピーしました",
      "share_twitter": "X で共有",
      "report_button": "ちがった",
      "favorite_aria": "お気に入りに追加",
      "favorited_aria": "お気に入りから外す",
      "close_aria": "閉じる",
      "back_aria": "戻る",
      "kebab": {
        "aria_label": "メニュー",
        "edit": "編集",
        "delete": "削除"
      },
      "login_required": "この操作にはログインが必要です",
      "cannot_report_own": "自分の物件は通報できません"
    },

    "edit": {
      "modal": { "title": "物件を編集" },
      "save": "保存",
      "success": "更新しました",
      "error": "更新に失敗しました"
    },

    "delete": {
      "title": "この物件を削除しますか?",
      "body": {
        "line1": "一覧から非表示になります",
        "line2": "30 日後に完全削除されます",
        "line3": "この操作は元に戻せません"
      },
      "confirm": "削除する",
      "cancel": "キャンセル",
      "success": "削除しました",
      "error": "削除に失敗しました"
    },

    "report": {
      "modal": {
        "title": "この物件について報告",
        "subtitle": "どの点が違いますか?"
      },
      "reason": {
        "wrong_info": "位置や情報が違う",
        "sold": "売却済み",
        "griefing": "嫌がらせ・ハラスメント",
        "nsfw": "不適切なコンテンツ",
        "other": "その他"
      },
      "comment": {
        "placeholder": "詳細を教えてください (任意)",
        "placeholder_required": "詳細を教えてください (必須)",
        "required": "「その他」 を選択した場合は詳細を入力してください"
      },
      "submit": "報告する",
      "cancel": "キャンセル",
      "success": "報告を受け付けました。 ご協力ありがとうございます",
      "duplicate": "すでに同じ理由で報告済みです",
      "error": "報告の送信に失敗しました。 時間をおいて再度お試しください"
    },

    "guide": {
      "title": "あなたの物件に報告がありました",
      "reason_label": "理由",
      "body": {
        "wrong_info": "内容を確認して、 必要に応じて情報を編集してください",
        "sold": "この物件は売却済みですか? 売却済みなら削除してください",
        "griefing": "身に覚えがない場合は LoPo Discord で異議申し立てが可能です",
        "nsfw": "LoPo 運営が直接確認します。 身に覚えがない場合は Discord で異議申し立て",
        "other": "報告者からのコメント"
      },
      "cta": {
        "edit": "編集する",
        "delete": "物件を削除する",
        "dispute": "Discord で異議申し立て"
      },
      "later": "あとで"
    },

    "notifications": {
      "title": "通知",
      "empty": "通知はありません",
      "mark_all_read": "すべて既読にする",
      "see_all": "すべて見る",
      "see_all_coming_soon": "準備中",
      "bell_aria": "通知",
      "unread_badge_aria": "{{n}} 件の未読",
      "item": {
        "report": "あなたの物件「{{title}}」 について「{{reason}}」 と報告がありました"
      },
      "time": {
        "just_now": "たった今",
        "minutes_ago": "{{n}} 分前",
        "hours_ago": "{{n}} 時間前",
        "days_ago": "{{n}} 日前"
      }
    }
  }
}
```

- [ ] **Step 2: en / ko / zh にも同じキー追加 (ja 値コピー)**

簡単な方法: ja.json から Phase 3 ブロックをコピーして 3 つのファイルに貼り付ける。 動作確認は ja で行うので翻訳は後回し。

- [ ] **Step 3: build (i18n 型生成あれば走らせる)**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(housing-phase3): i18n キー追加 (detail/edit/delete/report/guide/notifications)"
```

---

## Task 11: HousingPhotoGallery + HousingShareButton + HousingActionBar

**Files:**
- Create: `src/components/housing/listing/HousingPhotoGallery.tsx`
- Create: `src/components/housing/listing/HousingShareButton.tsx`
- Create: `src/components/housing/listing/HousingActionBar.tsx`
- Test: `src/components/housing/listing/__tests__/HousingShareButton.test.tsx`
- Test: `src/components/housing/listing/__tests__/HousingActionBar.test.tsx`

- [ ] **Step 1: HousingShareButton のテスト書く**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HousingShareButton } from '../HousingShareButton';

describe('HousingShareButton', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => {}) },
    });
  });

  it('Web Share API が無いとき、 リンクコピーボタンと X 共有ボタンが出る', () => {
    // navigator.share を undefined にする
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    render(<HousingShareButton url="https://lopoly.app/housing/listing/lid1" title="X" />);
    fireEvent.click(screen.getByRole('button', { name: /シェア/ }));
    expect(screen.getByText(/リンクをコピー/)).toBeInTheDocument();
    expect(screen.getByText(/X で共有/)).toBeInTheDocument();
  });

  it('リンクコピー押下で clipboard.writeText が呼ばれる', async () => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    render(<HousingShareButton url="https://example.com/lid1" title="X" />);
    fireEvent.click(screen.getByRole('button', { name: /シェア/ }));
    fireEvent.click(screen.getByText(/リンクをコピー/));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com/lid1');
  });
});
```

- [ ] **Step 2: HousingShareButton.tsx 実装**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  url: string;
  title: string;
}

export function HousingShareButton({ url, title }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    // スマホ: Web Share API があれば直接呼ぶ
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({ title, url });
        return;
      } catch {
        // ユーザーキャンセル等は無視してドロップダウン表示
      }
    }
    setOpen((v) => !v);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const tweet = () => {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="housing-share">
      <button
        type="button"
        className="housing-action-btn"
        onClick={onClick}
        aria-label={t('housing.detail.share')}
      >
        {t('housing.detail.share')}
      </button>
      {open && (
        <div role="menu" className="housing-share-menu">
          <button type="button" onClick={copyLink}>
            {copied ? t('housing.detail.share_copied') : t('housing.detail.share_copy_link')}
          </button>
          <button type="button" onClick={tweet}>
            {t('housing.detail.share_twitter')}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: HousingPhotoGallery.tsx 実装**

「動く骨組み」 重視 — 1 枚目を大きく表示するだけ。 サムネ並べはスコープ外。 写真がなければ no-image プレースホルダ。

```typescript
import type { HousingListing } from '@/types/housing';

interface Props {
  listing: HousingListing;
}

export function HousingPhotoGallery({ listing }: Props) {
  const src = listing.ogImageUrl || listing.thumbnailPath || null;
  if (!src) {
    return (
      <div className="housing-gallery-empty">
        <span>No image</span>
      </div>
    );
  }
  return (
    <div className="housing-gallery">
      <img src={src} alt="" className="housing-gallery-main" />
    </div>
  );
}
```

- [ ] **Step 4: HousingActionBar のテスト + 実装**

`src/components/housing/listing/__tests__/HousingActionBar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HousingActionBar } from '../HousingActionBar';

const listing = {
  id: 'lid1', ownerUid: 'owner1', /* ... 最小 mock ... */
} as any;

describe('HousingActionBar', () => {
  it('家主自身が見ると kebab が出るが「ちがった」 は出ない', () => {
    render(<HousingActionBar listing={listing} viewerUid="owner1" />);
    expect(screen.queryByRole('button', { name: /ちがった/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /メニュー/ })).toBeInTheDocument();
  });

  it('他人が見ると「ちがった」 は出るが kebab は出ない', () => {
    render(<HousingActionBar listing={listing} viewerUid="other-uid" />);
    expect(screen.getByRole('button', { name: /ちがった/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /メニュー/ })).not.toBeInTheDocument();
  });

  it('未ログインだと「ちがった」 は表示されるがクリックでログイン誘導', () => {
    render(<HousingActionBar listing={listing} viewerUid={null} />);
    expect(screen.getByRole('button', { name: /ちがった/ })).toBeInTheDocument();
  });
});
```

`src/components/housing/listing/HousingActionBar.tsx`:

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '@/types/housing';
import { HousingDetailKebab } from './HousingDetailKebab';
import { HousingShareButton } from './HousingShareButton';
import { useHousingFavoritesStore } from '@/store/useHousingFavoritesStore';
import { HousingReportModal } from '../report/HousingReportModal';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDelete } from '../delete/useHousingDelete';
import { toast } from 'react-toastify'; // 既存使われてれば

interface Props {
  listing: HousingListing;
  /** ログインしてれば UID、 未ログインは null */
  viewerUid: string | null;
  /** 親で詳細を閉じるコールバック (削除後等) */
  onClose?: () => void;
}

export function HousingActionBar({ listing, viewerUid, onClose }: Props) {
  const { t } = useTranslation();
  const isOwner = viewerUid != null && listing.ownerUid === viewerUid;

  const favs = useHousingFavoritesStore();
  const isFav = favs.contains(listing.id);

  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { deleteListing, loading: deleting } = useHousingDelete();

  const url = `${window.location.origin}/housing/listing/${listing.id}`;
  const titleForShare = listing.description?.slice(0, 60) ?? 'LoPo Housing';

  const onConfirmDelete = async () => {
    const res = await deleteListing(listing.id);
    if (res.ok) {
      toast.success(t('housing.delete.success'));
      setDeleteOpen(false);
      onClose?.();
    } else {
      toast.error(t('housing.delete.error'));
    }
  };

  const onReportClick = () => {
    if (!viewerUid) {
      toast.info(t('housing.detail.login_required'));
      return;
    }
    if (isOwner) {
      toast.info(t('housing.detail.cannot_report_own'));
      return;
    }
    setReportOpen(true);
  };

  return (
    <div className="housing-action-bar">
      <button
        type="button"
        className="housing-action-btn"
        aria-pressed={isFav}
        aria-label={isFav ? t('housing.detail.favorited_aria') : t('housing.detail.favorite_aria')}
        onClick={() => (isFav ? favs.remove(listing.id) : favs.add(listing.id))}
      >
        {isFav ? '♥' : '♡'}
      </button>

      <HousingShareButton url={url} title={titleForShare} />

      {!isOwner && (
        <button
          type="button"
          className="housing-action-btn"
          onClick={onReportClick}
        >
          {t('housing.detail.report_button')}
        </button>
      )}

      {isOwner && (
        <HousingDetailKebab
          onEdit={() => setEditOpen(true)}
          onDelete={() => setDeleteOpen(true)}
        />
      )}

      {reportOpen && (
        <HousingReportModal
          listingId={listing.id}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
        />
      )}
      {editOpen && (
        <HousingEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          listing={listing}
        />
      )}
      {deleteOpen && (
        <HousingDeleteConfirm
          open={deleteOpen}
          listingTitle={listing.description ?? listing.addressKey}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={onConfirmDelete}
          loading={deleting}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: CSS 追加** (housing.css)

```css
.housing-action-bar {
  display: flex; flex-direction: column; gap: 8px;
}
.housing-action-btn {
  min-width: 80px; padding: 10px 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--housing-panel-border);
  border-radius: 12px;
  color: var(--housing-text);
  font-size: var(--housing-text-base);
  cursor: pointer;
  text-align: center;
}
.housing-action-btn:hover { background: rgba(255, 201, 135, 0.16); }
.housing-share { position: relative; }
.housing-share-menu {
  position: absolute; right: 0; top: calc(100% + 4px);
  background: rgba(20, 14, 8, 0.98);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: 12px; padding: 6px; z-index: 90;
  display: flex; flex-direction: column; gap: 2px; min-width: 180px;
}
.housing-share-menu button {
  background: transparent; border: none; padding: 8px 12px;
  color: var(--housing-text); text-align: left; cursor: pointer;
  border-radius: 8px;
}
.housing-share-menu button:hover { background: rgba(255, 201, 135, 0.12); }
.housing-gallery {
  width: 100%; height: 100%; display: grid; place-items: center;
  background: rgba(0, 0, 0, 0.4);
}
.housing-gallery-main {
  max-width: 100%; max-height: 100%; object-fit: contain;
  border-radius: 12px;
}
.housing-gallery-empty {
  width: 100%; height: 240px;
  display: grid; place-items: center;
  background: rgba(255, 255, 255, 0.04);
  color: var(--housing-text-mute);
  border-radius: 12px;
}
```

- [ ] **Step 6: テスト pass + build**

Run: `npx vitest run src/components/housing/listing/__tests__/`
Run: `rtk npm run build`

---

## Task 12: HousingDetailContent (詳細の中身)

**Files:**
- Create: `src/components/housing/listing/HousingDetailContent.tsx`
- Test: `src/components/housing/listing/__tests__/HousingDetailContent.test.tsx`

- [ ] **Step 1: テスト書く**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HousingDetailContent } from '../HousingDetailContent';

const listing = {
  id: 'lid1',
  ownerUid: 'owner1',
  dc: 'Mana', server: 'Anima', area: 'Mist' as const,
  ward: 5, buildingType: 'house' as const, plot: 12, size: 'M' as const,
  addressKey: 'k', imageMode: 'none' as const,
  tags: ['和風'], description: '隠れ家',
  createdAt: 1700000000000, updatedAt: 1700000000000,
  isHidden: false, reportCount: 0, deletedAt: null,
} as any;

describe('HousingDetailContent', () => {
  it('description と address (ward, plot) が表示される', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    expect(screen.getByText(/隠れ家/)).toBeInTheDocument();
    expect(screen.getByText(/Ward 5/)).toBeInTheDocument();
    expect(screen.getByText(/Plot 12/)).toBeInTheDocument();
  });

  it('tags が表示される', () => {
    render(<HousingDetailContent listing={listing} viewerUid={null} />);
    expect(screen.getByText(/和風/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 実装**

```typescript
import type { HousingListing } from '@/types/housing';
import { HousingPhotoGallery } from './HousingPhotoGallery';
import { HousingActionBar } from './HousingActionBar';

interface Props {
  listing: HousingListing;
  viewerUid: string | null;
  onClose?: () => void;
}

export function HousingDetailContent({ listing, viewerUid, onClose }: Props) {
  return (
    <div className="housing-detail-content">
      <div className="housing-detail-gallery">
        <HousingPhotoGallery listing={listing} />
      </div>
      <div className="housing-detail-info">
        <h2 className="housing-detail-title">
          {listing.description || `${listing.area} W${listing.ward}`}
        </h2>
        <p className="housing-detail-address">
          {listing.dc} / {listing.server} / {listing.area} / Ward {listing.ward}
          {listing.plot != null && ` / Plot ${listing.plot}`}
          {listing.roomNumber != null && ` / Room ${listing.roomNumber}`}
        </p>
        {listing.tags.length > 0 && (
          <ul className="housing-detail-tags">
            {listing.tags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
        )}
        {listing.description && (
          <p className="housing-detail-description">{listing.description}</p>
        )}
        <div className="housing-detail-actions">
          <HousingActionBar
            listing={listing}
            viewerUid={viewerUid}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CSS 追加** (housing.css)

```css
.housing-detail-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  width: 100%; height: 100%;
}
@media (max-width: 768px) {
  .housing-detail-content { grid-template-columns: 1fr; }
}
.housing-detail-gallery { min-height: 240px; }
.housing-detail-info {
  display: flex; flex-direction: column; gap: 12px;
  color: var(--housing-text);
}
.housing-detail-title {
  font-size: 22px; font-weight: 600; margin: 0;
}
.housing-detail-address {
  font-size: var(--housing-text-sm);
  color: var(--housing-text-dim);
  margin: 0;
}
.housing-detail-tags {
  display: flex; flex-wrap: wrap; gap: 6px;
  list-style: none; padding: 0; margin: 0;
}
.housing-detail-tags li {
  background: rgba(255, 201, 135, 0.16);
  border: 1px solid rgba(255, 201, 135, 0.32);
  color: var(--housing-honey);
  border-radius: 999px;
  padding: 3px 10px;
  font-size: var(--housing-text-xs);
}
.housing-detail-description {
  font-size: var(--housing-text-base);
  color: var(--housing-text-dim);
  line-height: 1.6;
  white-space: pre-wrap;
}
.housing-detail-actions { margin-top: auto; }
```

- [ ] **Step 4: テスト pass + build**

---

## Task 13: HousingDetailModal + HousingDetailLayout

**Files:**
- Create: `src/components/housing/listing/HousingDetailModal.tsx`
- Create: `src/components/housing/listing/HousingDetailLayout.tsx`

- [ ] **Step 1: HousingDetailModal.tsx 実装**

```typescript
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '@/types/housing';
import { HousingDetailContent } from './HousingDetailContent';

interface Props {
  listing: HousingListing;
  viewerUid: string | null;
  onClose: () => void;
}

export function HousingDetailModal({ listing, viewerUid, onClose }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div
      className="housing-detail-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('housing.detail.title')}
        className="housing-detail-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="housing-detail-close"
          onClick={onClose}
          aria-label={t('housing.detail.close_aria')}
        >×</button>
        <HousingDetailContent
          listing={listing}
          viewerUid={viewerUid}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: HousingDetailLayout.tsx 実装** (フルページ版)

```typescript
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '@/types/housing';
import { HousingDetailContent } from './HousingDetailContent';

interface Props {
  listing: HousingListing;
  viewerUid: string | null;
}

export function HousingDetailLayout({ listing, viewerUid }: Props) {
  const { t } = useTranslation();
  return (
    <div className="housing-detail-fullpage">
      <header className="housing-detail-fullpage-header">
        <Link
          to="/housing"
          className="housing-detail-back"
          aria-label={t('housing.detail.back_aria')}
        >
          ← {t('housing.detail.back_aria')}
        </Link>
      </header>
      <main className="housing-detail-fullpage-main">
        <HousingDetailContent listing={listing} viewerUid={viewerUid} />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: CSS 追加**

```css
.housing-detail-backdrop {
  position: fixed; inset: 0; z-index: 70;
  background: rgba(0, 0, 0, 0.6);
  display: grid; place-items: center;
  padding: 20px;
}
.housing-detail-modal {
  position: relative;
  width: min(880px, 100%);
  height: min(640px, calc(100dvh - 40px));
  background: rgba(20, 14, 8, 0.96);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: var(--housing-panel-radius);
  padding: 24px;
  overflow: auto;
  color: var(--housing-text);
}
@media (max-width: 768px) {
  .housing-detail-backdrop { padding: 0; align-items: flex-end; }
  .housing-detail-modal {
    width: 100%;
    height: 92dvh;
    border-radius: var(--housing-panel-radius) var(--housing-panel-radius) 0 0;
  }
}
.housing-detail-close {
  position: absolute; top: 12px; right: 12px;
  width: 36px; height: 36px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--housing-panel-border);
  color: var(--housing-text); font-size: 18px;
  cursor: pointer;
  z-index: 1;
}
.housing-detail-fullpage {
  min-height: 100dvh;
  background: rgba(20, 14, 8, 0.96);
  color: var(--housing-text);
  display: flex; flex-direction: column;
}
.housing-detail-fullpage-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--housing-panel-border);
}
.housing-detail-back {
  color: var(--housing-honey); text-decoration: none;
  font-size: var(--housing-text-base);
}
.housing-detail-fullpage-main {
  flex: 1; padding: 24px;
  max-width: 1200px; width: 100%;
  margin: 0 auto;
}
```

- [ ] **Step 4: build**

Run: `rtk npm run build`

---

## Task 14: HousingDetailPage + ルート定義 + background-location パターン

**Files:**
- Create: `src/components/housing/listing/HousingDetailPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/housing/HousingWorkspace.tsx` (background-location state を仕込む)

- [ ] **Step 1: HousingDetailPage.tsx 実装** (フルページ版エントリ、 `/housing/listing/:id` 用)

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { HousingListing } from '@/types/housing';
import { HousingDetailLayout } from './HousingDetailLayout';

export function HousingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const [listing, setListing] = useState<HousingListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewerUid = getAuth().currentUser?.uid ?? null;

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      try {
        const snap = await getDoc(doc(getFirestore(), 'housing_listings', listingId));
        if (!snap.exists()) {
          setError('not_found');
          return;
        }
        const data = snap.data();
        if (data.deletedAt || data.isHidden) {
          setError('not_found');
          return;
        }
        setListing({ id: snap.id, ...data } as HousingListing);
      } catch (e: any) {
        setError(e?.message ?? 'unknown_error');
      }
    })();
  }, [listingId]);

  if (error === 'not_found') {
    return <div className="housing-detail-fullpage">Not found</div>;
  }
  if (!listing) {
    return <div className="housing-detail-fullpage">Loading...</div>;
  }
  return <HousingDetailLayout listing={listing} viewerUid={viewerUid} />;
}
```

- [ ] **Step 2: src/App.tsx に新ルート追加 + background-location 処理**

```typescript
// import 追加
import { useLocation, useNavigate } from 'react-router-dom';
import { HousingDetailPage } from './components/housing/listing/HousingDetailPage';

// App コンポーネント内、 Routes より上で
function AppRoutes() {
  const location = useLocation();
  // background location が state にあればそれをベースに描画
  const state = (location.state as { backgroundLocation?: Location }) || {};
  return (
    <>
      <Routes location={state.backgroundLocation || location}>
        {/* ... 既存ルート ... */}
        <Route path="/housing/listing/:listingId" element={<HousingDetailPage />} />
      </Routes>
      {/* background-location が立っている場合、 上に重ねるモーダルルートを描画 */}
      {state.backgroundLocation && (
        <Routes>
          <Route
            path="/housing/listing/:listingId"
            element={<HousingDetailModalRouteWrapper />}
          />
        </Routes>
      )}
    </>
  );
}
```

**`HousingDetailModalRouteWrapper`** は `useParams` で listingId を取って Firestore から listing 読み、 `<HousingDetailModal>` を描画する小さなコンポーネント。 `src/components/housing/listing/HousingDetailModalRoute.tsx` として新規作成:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { HousingListing } from '@/types/housing';
import { HousingDetailModal } from './HousingDetailModal';

export function HousingDetailModalRoute() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const [listing, setListing] = useState<HousingListing | null>(null);
  const viewerUid = getAuth().currentUser?.uid ?? null;

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      const snap = await getDoc(doc(getFirestore(), 'housing_listings', listingId));
      if (snap.exists()) setListing({ id: snap.id, ...snap.data() } as HousingListing);
    })();
  }, [listingId]);

  const close = () => navigate(-1);

  if (!listing) return null;
  return (
    <HousingDetailModal
      listing={listing}
      viewerUid={viewerUid}
      onClose={close}
    />
  );
}
```

- [ ] **Step 3: HousingWorkspace の物件カードクリックを Link 化 (background-location state 付き)**

`src/components/housing/HousingWorkspace.tsx` 等で物件カードを描画している箇所を確認、 onClick を以下のように:

```typescript
import { Link, useLocation } from 'react-router-dom';

function HousingCardLink({ listing, children }: { listing: HousingListing; children: React.ReactNode }) {
  const location = useLocation();
  return (
    <Link
      to={`/housing/listing/${listing.id}`}
      state={{ backgroundLocation: location }}
      className="housing-card-link"
    >
      {children}
    </Link>
  );
}
```

これで一覧から飛ぶときはモーダル、 URL 直アクセスはフルページ表示になる。

- [ ] **Step 4: HousingDetailPagePlaceholder 削除**

```bash
rm src/components/housing/HousingDetailPagePlaceholder.tsx
```

App.tsx で import している箇所があれば削除。

- [ ] **Step 5: build + 動作確認**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 6: Commit (詳細表示一式)**

```bash
rtk git add src/components/housing/listing/ src/App.tsx src/components/housing/HousingWorkspace.tsx src/styles/housing.css
rtk git rm src/components/housing/HousingDetailPagePlaceholder.tsx
rtk git commit -m "feat(housing-phase3): 物件詳細モーダル + フルページ表示 (background-location pattern)"
```

---

# Phase 4 — Sub-spec 3-C 通報フロー

## Task 15: _reportListingHandler 実装

**Files:**
- Create: `api/housing/_reportListingHandler.ts`
- Modify: `api/housing/index.ts`

- [ ] **Step 1: _reportListingHandler.ts 作成**

```typescript
/**
 * ハウジング物件通報ハンドラ
 * Body: { listingId, reason, comment? }
 * 動作: transaction で reports/{auto-id} 作成 + reportCount +1 + 通知 doc 作成
 *       同一 reporterUid × listingId × reason の既存があれば 409
 *       reportCount >= 3 で isHidden=true (自動非表示)
 * 通知側に reporterUid は書かない (家主に渡らない)
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { isValidReportReason } from '../../src/types/housing.js';
import { REPORT_AUTO_HIDE_THRESHOLD } from '../../src/constants/housing.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 20, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });

    const decoded = await getAuth().verifyIdToken(token);
    const reporterUid = decoded.uid;

    const { listingId, reason, comment } = req.body || {};
    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ error: 'invalid_listingId' });
    }
    if (!isValidReportReason(reason)) {
      return res.status(400).json({ error: 'invalid_reason' });
    }
    if (reason === 'other' && (!comment || typeof comment !== 'string' || comment.trim().length === 0)) {
      return res.status(400).json({ error: 'comment_required' });
    }

    const adminDb = getAdminFirestore();
    const listingRef = adminDb.collection('housing_listings').doc(listingId);

    // 重複チェック (transaction 外で軽く)
    const existing = await listingRef
      .collection('reports')
      .where('reporterUid', '==', reporterUid)
      .where('reason', '==', reason)
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(409).json({ error: 'duplicate_report' });
    }

    const severity = (reason === 'griefing' || reason === 'nsfw') ? 'high' : 'normal';

    await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(listingRef);
      if (!snap.exists) throw new Error('not_found');
      const data = snap.data()!;
      if (data.ownerUid === reporterUid) throw new Error('cannot_report_own');
      if (data.deletedAt) throw new Error('not_found');

      const newCount = (data.reportCount || 0) + 1;
      const shouldHide = newCount >= REPORT_AUTO_HIDE_THRESHOLD && !data.isHidden;

      // 通報 doc 作成
      const reportRef = listingRef.collection('reports').doc();
      tx.set(reportRef, {
        reporterUid,
        reason,
        ...(comment ? { comment: String(comment).slice(0, 500) } : {}),
        createdAt: Date.now(),
      });

      // listing 更新
      tx.update(listingRef, {
        reportCount: newCount,
        ...(shouldHide ? { isHidden: true } : {}),
      });

      // 通知 doc 作成 (家主向け)
      const notifRef = adminDb
        .collection('users').doc(data.ownerUid)
        .collection('notifications').doc();
      tx.set(notifRef, {
        type: 'housing_report',
        listingId,
        reason,
        severity,
        ...(comment ? { comment: String(comment).slice(0, 500) } : {}),
        listingTitleSnapshot: data.description?.slice(0, 60) || data.addressKey,
        createdAt: Date.now(),
        read: false,
      });
    });

    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error('[housing/report-listing] error:', error);
    if (error?.message === 'not_found') return res.status(404).json({ error: 'not_found' });
    if (error?.message === 'cannot_report_own') return res.status(403).json({ error: 'cannot_report_own' });
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: index.ts に action 追加**

```typescript
import reportListingHandler from './_reportListingHandler.js';

// switch 内
case 'report-listing':
  return reportListingHandler(req, res);
```

- [ ] **Step 3: build**

Run: `rtk npm run build`
Expected: 成功

---

## Task 16: HousingReportModal + useHousingReport

**Files:**
- Create: `src/components/housing/report/HousingReportModal.tsx`
- Create: `src/components/housing/report/useHousingReport.ts`
- Test: `src/components/housing/report/__tests__/HousingReportModal.test.tsx`
- Test: `src/components/housing/report/__tests__/useHousingReport.test.ts`

- [ ] **Step 1: useHousingReport テスト書く**

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHousingReport } from '../useHousingReport';

vi.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { getIdToken: async () => 'mock-token' } }),
}));

describe('useHousingReport', () => {
  beforeEach(() => { global.fetch = vi.fn(); });

  it('成功時 ok=true', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 201, json: async () => ({ success: true }),
    });
    const { result } = renderHook(() => useHousingReport());
    let res;
    await act(async () => {
      res = await result.current.report('lid1', 'wrong_info');
    });
    expect(res).toEqual({ ok: true });
  });

  it('409 で duplicate', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false, status: 409, json: async () => ({ error: 'duplicate_report' }),
    });
    const { result } = renderHook(() => useHousingReport());
    let res;
    await act(async () => {
      res = await result.current.report('lid1', 'wrong_info');
    });
    expect(res).toEqual({ ok: false, error: 'duplicate_report' });
  });
});
```

- [ ] **Step 2: useHousingReport 実装**

```typescript
import { useState } from 'react';
import { getAuth } from 'firebase/auth';
import type { ReportReason } from '@/types/housing';

export function useHousingReport() {
  const [loading, setLoading] = useState(false);

  async function report(listingId: string, reason: ReportReason, comment?: string) {
    setLoading(true);
    try {
      const user = getAuth().currentUser;
      if (!user) return { ok: false, error: 'unauthenticated' };
      const token = await user.getIdToken();
      const res = await fetch('/api/housing?action=report-listing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ listingId, reason, ...(comment ? { comment } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data?.error ?? `http_${res.status}` };
      }
      return { ok: true };
    } finally {
      setLoading(false);
    }
  }

  return { report, loading };
}
```

- [ ] **Step 3: HousingReportModal テスト書く**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HousingReportModal } from '../HousingReportModal';

describe('HousingReportModal', () => {
  it("初期状態で wrong_info が選択されている", () => {
    render(<HousingReportModal open={true} listingId="lid1" onClose={() => {}} />);
    const radio = screen.getByLabelText(/位置や情報が違う/) as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it("other を選択するとコメント欄が必須になる", () => {
    render(<HousingReportModal open={true} listingId="lid1" onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/その他/));
    expect(screen.getByPlaceholderText(/詳細を教えてください/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: HousingReportModal 実装**

```typescript
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REPORT_REASONS, type ReportReason } from '@/types/housing';
import { useHousingReport } from './useHousingReport';
import { toast } from 'react-toastify';

interface Props {
  open: boolean;
  listingId: string;
  onClose: () => void;
}

export function HousingReportModal({ open, listingId, onClose }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>('wrong_info');
  const [comment, setComment] = useState('');
  const { report, loading } = useHousingReport();

  if (!open) return null;

  const isOther = reason === 'other';
  const commentRequired = isOther;
  const canSubmit = !commentRequired || comment.trim().length > 0;

  const submit = async () => {
    if (!canSubmit || loading) return;
    const res = await report(listingId, reason, isOther ? comment.trim() : undefined);
    if (res.ok) {
      toast.success(t('housing.report.success'));
      onClose();
    } else if (res.error === 'duplicate_report') {
      toast.warn(t('housing.report.duplicate'));
    } else {
      toast.error(t('housing.report.error'));
    }
  };

  return (
    <div className="housing-modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="housing-report-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-report-title">{t('housing.report.modal.title')}</h2>
        <p className="housing-report-subtitle">{t('housing.report.modal.subtitle')}</p>
        <ul className="housing-report-reasons">
          {REPORT_REASONS.map((r) => (
            <li key={r}>
              <label>
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {t(`housing.report.reason.${r}`)}
              </label>
            </li>
          ))}
        </ul>
        <textarea
          className="housing-report-comment"
          placeholder={
            commentRequired
              ? t('housing.report.comment.placeholder_required')
              : t('housing.report.comment.placeholder')
          }
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={3}
        />
        <div className="housing-report-actions">
          <button type="button" onClick={onClose} disabled={loading}>
            {t('housing.report.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || loading}
            className="housing-btn-primary"
          >
            {t('housing.report.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: CSS 追加** (housing.css)

```css
.housing-report-modal {
  background: rgba(20, 14, 8, 0.96);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: var(--housing-panel-radius);
  padding: 24px;
  max-width: 440px;
  width: 100%;
  color: var(--housing-text);
}
.housing-report-title {
  font-size: 18px; font-weight: 600; margin: 0 0 8px;
}
.housing-report-subtitle {
  font-size: var(--housing-text-sm);
  color: var(--housing-text-dim);
  margin: 0 0 16px;
}
.housing-report-reasons {
  list-style: none; padding: 0; margin: 0 0 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.housing-report-reasons label {
  display: flex; gap: 10px; align-items: center;
  font-size: var(--housing-text-base);
  cursor: pointer;
}
.housing-report-comment {
  width: 100%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--housing-panel-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--housing-text);
  font-size: var(--housing-text-base);
  resize: vertical;
  margin-bottom: 16px;
}
.housing-report-actions {
  display: flex; gap: 8px; justify-content: flex-end;
}
.housing-report-actions button {
  padding: 8px 16px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--housing-panel-border);
  color: var(--housing-text); cursor: pointer;
  font-size: var(--housing-text-base);
}
.housing-btn-primary {
  background: var(--housing-honey) !important;
  border-color: var(--housing-honey) !important;
  color: #1a1006 !important;
  font-weight: 600;
}
.housing-btn-primary:disabled {
  opacity: 0.5; cursor: not-allowed;
}
```

- [ ] **Step 6: テスト pass + build**

Run: `npx vitest run src/components/housing/report/__tests__/`
Run: `rtk npm run build`

---

## Task 17: 通知 API 2 本 (list / mark-read)

**Files:**
- Create: `api/housing/_listNotificationsHandler.ts`
- Create: `api/housing/_markNotificationReadHandler.ts`
- Modify: `api/housing/index.ts`

- [ ] **Step 1: _listNotificationsHandler.ts 作成**

```typescript
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';

function setCors(req: any, res: any) { /* 同じ */ 
  const origin = req.headers?.origin || '';
  const allowed = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const limit = Math.min(Number(req.query?.limit) || 20, 50);
    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection('users').doc(uid)
      .collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.status(200).json({ items });
  } catch (error: any) {
    console.error('[housing/list-notifications] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: _markNotificationReadHandler.ts 作成**

```typescript
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = ['https://lopoly.app', 'https://lopo-miti.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 60, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'unauthenticated' });
    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;

    const { notificationId, all } = req.body || {};
    const adminDb = getAdminFirestore();
    const colRef = adminDb.collection('users').doc(uid).collection('notifications');

    if (all === true) {
      // 全件既読化 (batched)
      const snap = await colRef.where('read', '==', false).limit(100).get();
      const batch = adminDb.batch();
      const now = Date.now();
      snap.docs.forEach((d) => batch.update(d.ref, { read: true, readAt: now }));
      await batch.commit();
      return res.status(200).json({ success: true, updated: snap.size });
    }

    if (!notificationId || typeof notificationId !== 'string') {
      return res.status(400).json({ error: 'invalid_notificationId' });
    }
    await colRef.doc(notificationId).update({ read: true, readAt: Date.now() });
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[housing/mark-notification-read] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 3: index.ts に追加**

```typescript
import listNotificationsHandler from './_listNotificationsHandler.js';
import markNotificationReadHandler from './_markNotificationReadHandler.js';

// switch
case 'list-notifications':
  return listNotificationsHandler(req, res);
case 'mark-notification-read':
  return markNotificationReadHandler(req, res);
```

- [ ] **Step 4: build**

Run: `rtk npm run build`

---

## Task 18: NotificationBell + Dropdown + Item + useNotifications

**Files:**
- Create: `src/components/housing/notifications/NotificationBell.tsx`
- Create: `src/components/housing/notifications/NotificationDropdown.tsx`
- Create: `src/components/housing/notifications/NotificationItem.tsx`
- Create: `src/components/housing/notifications/useNotifications.ts`
- Test: `src/components/housing/notifications/__tests__/NotificationBell.test.tsx`
- Test: `src/components/housing/notifications/__tests__/useNotifications.test.ts`
- Modify: `src/components/housing/workspace/TopBar.tsx`

- [ ] **Step 1: useNotifications フック実装**

`src/components/housing/notifications/useNotifications.ts`:

```typescript
import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot, getFirestore,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { HousingNotification } from '@/types/notification';

export function useNotifications() {
  const [items, setItems] = useState<HousingNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ref = collection(getFirestore(), 'users', user.uid, 'notifications');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as HousingNotification[];
      setItems(next);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const unreadCount = items.filter((n) => !n.read).length;

  async function markRead(notificationId: string) {
    const user = getAuth().currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/housing?action=mark-notification-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notificationId }),
    });
  }

  async function markAllRead() {
    const user = getAuth().currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    await fetch('/api/housing?action=mark-notification-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ all: true }),
    });
  }

  return { items, loading, unreadCount, markRead, markAllRead };
}
```

- [ ] **Step 2: NotificationItem 実装**

```typescript
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import type { HousingNotification } from '@/types/notification';

function formatRelativeTime(t: (k: string, opts?: any) => string, ms: number): string {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return t('housing.notifications.time.just_now');
  const min = Math.floor(sec / 60);
  if (min < 60) return t('housing.notifications.time.minutes_ago', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('housing.notifications.time.hours_ago', { n: hr });
  const day = Math.floor(hr / 24);
  return t('housing.notifications.time.days_ago', { n: day });
}

interface Props {
  notification: HousingNotification;
  onClick?: (n: HousingNotification) => void;
}

export function NotificationItem({ notification, onClick }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const reasonLabel = t(`housing.report.reason.${notification.reason}`);
  const msg = t('housing.notifications.item.report', {
    title: notification.listingTitleSnapshot ?? '',
    reason: reasonLabel,
  });
  return (
    <Link
      to={`/housing/listing/${notification.listingId}?notification=${notification.id}`}
      state={{ backgroundLocation: location }}
      className={`housing-notif-item ${notification.read ? '' : 'unread'}`}
      onClick={() => onClick?.(notification)}
    >
      {!notification.read && <span className="housing-notif-dot" aria-hidden />}
      <span className="housing-notif-msg">{msg}</span>
      <span className="housing-notif-time">
        {formatRelativeTime(t, notification.createdAt)}
      </span>
    </Link>
  );
}
```

- [ ] **Step 3: NotificationDropdown 実装**

```typescript
import { useTranslation } from 'react-i18next';
import { NotificationItem } from './NotificationItem';
import type { HousingNotification } from '@/types/notification';

interface Props {
  items: HousingNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
}

export function NotificationDropdown({
  items, unreadCount, onMarkRead, onMarkAllRead, onClose,
}: Props) {
  const { t } = useTranslation();
  const top5 = items.slice(0, 5);
  return (
    <div role="menu" className="housing-notif-dropdown">
      <header className="housing-notif-dropdown-header">
        <h3>{t('housing.notifications.title')}</h3>
        {unreadCount > 0 && (
          <button type="button" onClick={onMarkAllRead}>
            {t('housing.notifications.mark_all_read')}
          </button>
        )}
      </header>
      {top5.length === 0 ? (
        <p className="housing-notif-empty">{t('housing.notifications.empty')}</p>
      ) : (
        <ul className="housing-notif-list">
          {top5.map((n) => (
            <li key={n.id}>
              <NotificationItem
                notification={n}
                onClick={(nn) => { onMarkRead(nn.id); onClose(); }}
              />
            </li>
          ))}
        </ul>
      )}
      <footer className="housing-notif-dropdown-footer">
        <span aria-disabled="true">
          {t('housing.notifications.see_all')} ({t('housing.notifications.see_all_coming_soon')})
        </span>
      </footer>
    </div>
  );
}
```

- [ ] **Step 4: NotificationBell 実装 + テスト**

`__tests__/NotificationBell.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotificationBell } from '../NotificationBell';

vi.mock('../useNotifications', () => ({
  useNotifications: () => ({
    items: [], unreadCount: 3, loading: false,
    markRead: vi.fn(), markAllRead: vi.fn(),
  }),
}));

describe('NotificationBell', () => {
  it('未読 3 件のバッジが表示される', () => {
    render(<NotificationBell />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
```

`NotificationBell.tsx`:

```typescript
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from './useNotifications';
import { NotificationDropdown } from './NotificationDropdown';

export function NotificationBell() {
  const { t } = useTranslation();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="housing-notif-bell" ref={ref}>
      <button
        type="button"
        aria-label={t('housing.notifications.bell_aria')}
        className="housing-notif-bell-trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2C8.13 2 5 5.13 5 9v5l-2 2v1h18v-1l-2-2V9c0-3.87-3.13-7-7-7zm0 20a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            className="housing-notif-badge"
            aria-label={t('housing.notifications.unread_badge_aria', { n: unreadCount })}
          >
            {badge}
          </span>
        )}
      </button>
      {open && (
        <NotificationDropdown
          items={items}
          unreadCount={unreadCount}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: TopBar に NotificationBell 配置**

`src/components/housing/workspace/TopBar.tsx` の `housing-top-right` 内、 Favorites ボタンの右隣に `<NotificationBell />` を追加。 未ログインの場合は非表示 (`useAuth` 等で確認、 既存の login 判定パターンに合わせる)。

```typescript
import { NotificationBell } from '../notifications/NotificationBell';
// ...
{isLoggedIn && <NotificationBell />}
```

- [ ] **Step 6: CSS 追加**

```css
.housing-notif-bell { position: relative; display: inline-block; }
.housing-notif-bell-trigger {
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--housing-panel-border);
  color: var(--housing-text); cursor: pointer;
  display: grid; place-items: center; position: relative;
}
.housing-notif-bell-trigger:hover { background: rgba(255, 255, 255, 0.12); }
.housing-notif-badge {
  position: absolute; top: -4px; right: -4px;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  background: #c44a3a; color: #fff;
  border-radius: 999px;
  font-size: 10px; font-weight: 700;
  display: grid; place-items: center;
  line-height: 1;
}
.housing-notif-dropdown {
  position: absolute; right: 0; top: calc(100% + 8px);
  width: 360px; max-width: calc(100vw - 24px);
  background: rgba(20, 14, 8, 0.98);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: 14px;
  z-index: 95;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
  color: var(--housing-text);
  overflow: hidden;
}
.housing-notif-dropdown-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--housing-panel-border);
}
.housing-notif-dropdown-header h3 {
  font-size: 14px; font-weight: 600; margin: 0;
}
.housing-notif-dropdown-header button {
  background: transparent; border: none;
  color: var(--housing-honey);
  font-size: 12px; cursor: pointer;
}
.housing-notif-list {
  list-style: none; margin: 0; padding: 0;
  max-height: 360px; overflow-y: auto;
}
.housing-notif-item {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 12px 16px;
  text-decoration: none;
  color: var(--housing-text);
  font-size: var(--housing-text-base);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  position: relative;
}
.housing-notif-item:hover { background: rgba(255, 201, 135, 0.08); }
.housing-notif-item.unread .housing-notif-msg { font-weight: 600; }
.housing-notif-dot {
  width: 8px; height: 8px;
  background: var(--housing-honey);
  border-radius: 50%;
  margin-top: 6px; flex: 0 0 auto;
}
.housing-notif-msg { flex: 1; line-height: 1.4; }
.housing-notif-time {
  font-size: 11px;
  color: var(--housing-text-mute);
  flex: 0 0 auto;
}
.housing-notif-empty {
  padding: 24px 16px; text-align: center;
  color: var(--housing-text-mute);
  font-size: var(--housing-text-base);
}
.housing-notif-dropdown-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--housing-panel-border);
  text-align: center;
  color: var(--housing-text-mute);
  font-size: 12px;
}
```

- [ ] **Step 7: テスト pass + build**

Run: `npx vitest run src/components/housing/notifications/__tests__/`
Run: `rtk npm run build`

---

## Task 19: HousingReportGuideModal + 通知遷移時の自動オープン

**Files:**
- Create: `src/components/housing/report/HousingReportGuideModal.tsx`
- Modify: `src/components/housing/listing/HousingDetailModalRoute.tsx` (URL クエリ `?notification=...` 処理)
- Modify: `src/components/housing/listing/HousingDetailPage.tsx` (フルページ版でも同様)
- Test: `src/components/housing/report/__tests__/HousingReportGuideModal.test.tsx`

- [ ] **Step 1: テスト書く**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HousingReportGuideModal } from '../HousingReportGuideModal';

describe('HousingReportGuideModal', () => {
  it('reason=wrong_info のとき「編集する」 CTA が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="wrong_info"
        onEdit={() => {}}
        onDelete={() => {}}
        onDispute={() => {}}
        onLater={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /編集する/ })).toBeInTheDocument();
  });

  it('reason=sold のとき「物件を削除する」 CTA が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="sold"
        onEdit={() => {}}
        onDelete={() => {}}
        onDispute={() => {}}
        onLater={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /物件を削除する/ })).toBeInTheDocument();
  });

  it('reason=griefing のとき「Discord で異議申し立て」 CTA が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="griefing"
        onEdit={() => {}}
        onDelete={() => {}}
        onDispute={() => {}}
        onLater={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /Discord/ })).toBeInTheDocument();
  });

  it('reason=other のとき comment が表示される', () => {
    render(
      <HousingReportGuideModal
        open={true}
        reason="other"
        comment="窓の位置が間違ってます"
        onEdit={() => {}}
        onDelete={() => {}}
        onDispute={() => {}}
        onLater={() => {}}
      />
    );
    expect(screen.getByText(/窓の位置が間違ってます/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: HousingReportGuideModal 実装**

```typescript
import { useTranslation } from 'react-i18next';
import type { ReportReason } from '@/types/housing';

interface Props {
  open: boolean;
  reason: ReportReason;
  comment?: string;
  onEdit: () => void;
  onDelete: () => void;
  onDispute: () => void;
  onLater: () => void;
}

export function HousingReportGuideModal({
  open, reason, comment, onEdit, onDelete, onDispute, onLater,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  const body = t(`housing.guide.body.${reason}`);
  const reasonLabel = t(`housing.report.reason.${reason}`);

  // reason 別 CTA
  let primaryCta: { label: string; onClick: () => void; tone?: 'danger' } | null = null;
  if (reason === 'wrong_info') {
    primaryCta = { label: t('housing.guide.cta.edit'), onClick: onEdit };
  } else if (reason === 'sold') {
    primaryCta = { label: t('housing.guide.cta.delete'), onClick: onDelete, tone: 'danger' };
  } else if (reason === 'griefing' || reason === 'nsfw') {
    primaryCta = { label: t('housing.guide.cta.dispute'), onClick: onDispute };
  }
  // other は 3 つ並列

  return (
    <div className="housing-modal-backdrop" onClick={onLater}>
      <div
        role="dialog"
        aria-modal="true"
        className="housing-guide-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="housing-guide-title">{t('housing.guide.title')}</h2>
        <p className="housing-guide-reason">
          {t('housing.guide.reason_label')}: <strong>{reasonLabel}</strong>
        </p>
        <p className="housing-guide-body">{body}</p>
        {reason === 'other' && comment && (
          <blockquote className="housing-guide-comment">{comment}</blockquote>
        )}

        <div className="housing-guide-actions">
          <button type="button" onClick={onLater}>
            {t('housing.guide.later')}
          </button>
          {reason === 'other' ? (
            <>
              <button type="button" onClick={onEdit}>
                {t('housing.guide.cta.edit')}
              </button>
              <button type="button" onClick={onDelete} className="housing-btn-danger">
                {t('housing.guide.cta.delete')}
              </button>
              <button type="button" onClick={onDispute}>
                {t('housing.guide.cta.dispute')}
              </button>
            </>
          ) : primaryCta ? (
            <button
              type="button"
              onClick={primaryCta.onClick}
              className={primaryCta.tone === 'danger' ? 'housing-btn-danger' : 'housing-btn-primary'}
            >
              {primaryCta.label}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: CSS 追加**

```css
.housing-guide-modal {
  background: rgba(20, 14, 8, 0.96);
  border: 1px solid var(--housing-panel-border-strong);
  border-radius: var(--housing-panel-radius);
  padding: 24px;
  max-width: 440px;
  width: 100%;
  color: var(--housing-text);
}
.housing-guide-title {
  font-size: 18px; font-weight: 600; margin: 0 0 8px;
}
.housing-guide-reason {
  font-size: var(--housing-text-sm);
  color: var(--housing-text-dim);
  margin: 0 0 12px;
}
.housing-guide-body {
  font-size: var(--housing-text-base);
  line-height: 1.6;
  margin: 0 0 16px;
}
.housing-guide-comment {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid var(--housing-honey);
  border-radius: 6px;
  color: var(--housing-text-dim);
  font-size: var(--housing-text-base);
  font-style: italic;
}
.housing-guide-actions {
  display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;
}
.housing-guide-actions button {
  padding: 8px 14px; border-radius: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--housing-panel-border);
  color: var(--housing-text); cursor: pointer;
  font-size: var(--housing-text-base);
}
```

- [ ] **Step 4: HousingDetailModalRoute で `?notification` クエリを処理**

`src/components/housing/listing/HousingDetailModalRoute.tsx` を改修:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import type { HousingListing } from '@/types/housing';
import type { HousingNotification } from '@/types/notification';
import { HousingDetailModal } from './HousingDetailModal';
import { HousingReportGuideModal } from '../report/HousingReportGuideModal';
import { HousingEditModal } from '../edit/HousingEditModal';
import { HousingDeleteConfirm } from '../delete/HousingDeleteConfirm';
import { useHousingDelete } from '../delete/useHousingDelete';
import { useNotifications } from '../notifications/useNotifications';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

export function HousingDetailModalRoute() {
  const { t } = useTranslation();
  const { listingId } = useParams<{ listingId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState<HousingListing | null>(null);
  const [notification, setNotification] = useState<HousingNotification | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const viewerUid = getAuth().currentUser?.uid ?? null;

  const { items, markRead } = useNotifications();
  const { deleteListing } = useHousingDelete();

  const notificationId = searchParams.get('notification');

  useEffect(() => {
    if (!listingId) return;
    (async () => {
      const snap = await getDoc(doc(getFirestore(), 'housing_listings', listingId));
      if (snap.exists()) setListing({ id: snap.id, ...snap.data() } as HousingListing);
    })();
  }, [listingId]);

  useEffect(() => {
    if (!notificationId) return;
    const found = items.find((n) => n.id === notificationId);
    if (found) {
      setNotification(found);
      setGuideOpen(true);
      if (!found.read) markRead(found.id);
    }
  }, [notificationId, items, markRead]);

  const close = () => navigate(-1);

  const onLater = () => setGuideOpen(false);

  const onDispute = () => {
    const url = (import.meta as any).env.VITE_DISCORD_INVITE_URL ?? 'https://discord.gg/';
    window.open(url, '_blank', 'noopener,noreferrer');
    setGuideOpen(false);
  };

  const onEdit = () => { setGuideOpen(false); setEditOpen(true); };
  const onDeleteClick = () => { setGuideOpen(false); setDeleteOpen(true); };

  const onConfirmDelete = async () => {
    if (!listing) return;
    const res = await deleteListing(listing.id);
    if (res.ok) {
      toast.success(t('housing.delete.success'));
      setDeleteOpen(false);
      close();
    } else {
      toast.error(t('housing.delete.error'));
    }
  };

  if (!listing) return null;
  return (
    <>
      <HousingDetailModal listing={listing} viewerUid={viewerUid} onClose={close} />
      {notification && (
        <HousingReportGuideModal
          open={guideOpen}
          reason={notification.reason}
          comment={notification.comment}
          onEdit={onEdit}
          onDelete={onDeleteClick}
          onDispute={onDispute}
          onLater={onLater}
        />
      )}
      {editOpen && (
        <HousingEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          listing={listing}
        />
      )}
      {deleteOpen && (
        <HousingDeleteConfirm
          open={deleteOpen}
          listingTitle={listing.description ?? listing.addressKey}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={onConfirmDelete}
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: テスト pass + build**

Run: `npx vitest run src/components/housing/report/__tests__/HousingReportGuideModal.test.tsx`
Run: `rtk npm run build`

- [ ] **Step 6: Commit (通報フロー一式 + 通知 UI 一式)**

```bash
rtk git add api/housing/_reportListingHandler.ts api/housing/_listNotificationsHandler.ts api/housing/_markNotificationReadHandler.ts api/housing/index.ts src/components/housing/report/ src/components/housing/notifications/ src/components/housing/listing/HousingDetailModalRoute.tsx src/components/housing/workspace/TopBar.tsx src/styles/housing.css
rtk git commit -m "feat(housing-phase3): 通報フロー + 通知 (bell / dropdown / reason 別ガイド)"
```

---

# Phase 5 — 仕上げ・動作確認

## Task 20: 環境変数 VITE_DISCORD_INVITE_URL 確認 + .env.example 更新

**Files:**
- Check: `.env.local`, `.env.example`

- [ ] **Step 1: `.env.example` を確認、 `VITE_DISCORD_INVITE_URL` 未定義なら追加**

`.env.example` に:
```
VITE_DISCORD_INVITE_URL=（LoPo Discord 招待 URL）
```

- [ ] **Step 2: 実値は `.env.local` (gitignore 済) にユーザー設定済みかも → 確認しない (公開リポジトリのため値は読まない)**

- [ ] **Step 3: コード上のフォールバックがあるので env なしでも動作 (`https://discord.gg/`)。 ただし正しい URL を Vercel 環境変数にも設定する必要がある。 これは引き継ぎメモに書く (次セッションで Vercel Dashboard から追加)**

---

## Task 21: 手動動作確認 (dev サーバー + Chrome)

**前提**: `npm run dev` でローカル起動、 別ブラウザ (or シークレットウィンドウ) で 2 アカウント用意。

- [ ] **Step 1: dev サーバー起動**

```bash
npm run dev
```

- [ ] **Step 2: 物件詳細モーダル**
   - `/housing` を開く → 物件カードをクリック → 詳細モーダルが開く、 URL は `/housing/listing/{id}`
   - Esc で閉じる → 元の URL に戻る
   - 同じ `/housing/listing/{id}` を別タブで直接開く → フルページ表示

- [ ] **Step 3: 編集**
   - 自分の物件詳細を開く → kebab ︙ → 編集 → 既存登録モーダルが「物件を編集」 タイトルで開く
   - description を変更 → 保存 → トースト「更新しました」 → モーダル閉じる
   - 詳細を再度開いて反映確認

- [ ] **Step 4: 削除**
   - 自分の物件詳細 → kebab → 削除 → 確認ダイアログ → 「削除する」
   - トースト「削除しました」 → 一覧から消えてること確認
   - Firestore 直接見て `deletedAt` がタイムスタンプになってること、 `isHidden` は false のままなこと確認

- [ ] **Step 5: 通報 (他人物件)**
   - 別アカウントで他人物件詳細を開く → 「ちがった」 → reason 選択 → 報告する
   - トースト「報告を受け付けました」
   - 同じ条件で再度送信 → トースト「すでに同じ理由で報告済みです」
   - 別 reason で送信 → 成功

- [ ] **Step 6: 通知**
   - 家主アカウントに戻る → TopBar bell に赤バッジ
   - bell クリック → ドロップダウン → 通知行クリック
   - 物件詳細モーダルが開く + reason 別ガイドモーダルが重なる
   - 「編集する」「物件を削除する」「Discord で異議申し立て」 各動作確認

- [ ] **Step 7: 自分の物件で「ちがった」 が表示されないこと、 kebab が表示されることを確認**

- [ ] **Step 8: ゲスト (未ログイン) で「ちがった」 押下 → ログイン誘導トースト**

- [ ] **Step 9: スマホサイズ (Chrome DevTools iPhone 12)**
   - 詳細モーダルが bottom sheet になる
   - ドロップダウンが全幅

- [ ] **Step 10: バグがあれば修正 (`feedback_one_fix_one_verify.md` 準拠で 1 件ずつ)**

---

## Task 22: 全 build + test 確認

- [ ] **Step 1: TypeScript 厳格モード確認**

Run: `npx tsc --noEmit`
Expected: エラーなし。 未使用変数あれば削除 (`feedback_vercel_tsc_strict.md`)。

- [ ] **Step 2: 全テスト**

Run: `npx vitest run`
Expected: 全 pass

- [ ] **Step 3: production build**

Run: `rtk npm run build`
Expected: 成功

- [ ] **Step 4: バンドルサイズ確認** (大きな増加がないか目視)

---

## Task 23: Firestore Rules デプロイ

- [ ] **Step 1: Firebase CLI で rules デプロイ**

```bash
firebase deploy --only firestore:rules
```

うまくいかない場合は Firebase Console から `firestore.rules` の内容を手動コピペでデプロイ。

- [ ] **Step 2: デプロイ成功確認**

Firebase Console → Firestore → Rules タブで反映済みを確認。

---

## Task 24: ローカルコミット履歴整理 + 仕上げコミット

- [ ] **Step 1: `git log` で全コミットを確認**

```bash
rtk git log --oneline origin/main..HEAD
```

期待: 大体 6-8 個のコミット (基盤 + 編集削除 + i18n + 詳細表示 + 通報フロー + 動作確認バグ修正 + 等)

- [ ] **Step 2: 残った変更 (動作確認バグ修正等) があればまとめてコミット**

```bash
rtk git status
rtk git diff
# 必要に応じて
rtk git add -A
rtk git commit -m "fix(housing-phase3): 動作確認時のバグ修正"
```

---

## Task 25: TODO.md 更新 + memory 更新 + push + Vercel デプロイ

- [ ] **Step 1: docs/TODO.md 「現在の状態」 を更新**

`docs/TODO.md` の冒頭セクションを書き換え:

```markdown
## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #45 (2026-05-21) で **Phase 3 (家主編集削除・物件詳細表示・通報フロー + 通知) を実装完了**
- **完了 (#45)**: HousingListing.deletedAt 追加 (soft delete) / API ハンドラ 5 本 (update / delete / report / list-notifications / mark-notification-read) / 詳細表示 (background-location パターン、 react-router-dom v7) / 編集モーダル (登録モーダル拡張) / 削除確認 / kebab メニュー / 通報モーダル (reason 5 択) / 通知ベル + ドロップダウン + reason 別ガイドモーダル / Firestore Rules 更新
- **方針確定 (#45)**: Intercepting Routes は使えないため background-location パターンで代替。 deletedAt と isHidden は役割分離 (家主削除 vs 運営非表示)。 API ハンドラのユニットテストは見送り (既存パターンなし)、 React 側は TDD で網羅
- (以下は前セッションから引き継ぎの注意事項…)
```

- [ ] **Step 2: docs/TODO_COMPLETED.md に Phase 3 完了を追記**

- [ ] **Step 3: 必要なら memory 追加** (例: `project_housing_phase_status.md` 更新で「Phase 3 完了、 次はマップ着手」 と書き換える)

- [ ] **Step 4: TODO.md の行数確認**

```bash
wc -l docs/TODO.md
```

100 行以内を維持。 超過していれば整理。

- [ ] **Step 5: 最終コミット (ドキュメント更新)**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(housing-phase3): セッション #45 完了記録"
```

- [ ] **Step 6: push**

```bash
rtk git push origin main
```

注: 既存ローカルコミット 3 本 + Phase 3 で増えた 6-8 本 = 合計 9-11 本がまとめて push される。 月 100 ビルド制限のため Vercel の自動ビルドは 1 回で吸収される (push 1 回 = ビルド 1 回)。

- [ ] **Step 7: Vercel デプロイ**

main への push で自動ビルドがトリガーされる。 Vercel Dashboard でビルド成功を確認。

- [ ] **Step 8: 本番動作確認**

`https://lopoly.app/housing` で動作確認 (TopBar bell が出てる、 物件詳細が開く、 等)。

- [ ] **Step 9: PWA キャッシュ問題への注意** (`feedback_pwa_cache_after_deploy.md`)

「古い形式のリクエスト」 が出る場合はハードリロード or SW アンロードを案内する。

- [ ] **Step 10: 引き継ぎメッセージをユーザーに出力**

完了内容と次セッションの方針 (Phase 3 残課題: ツアー同期 Firestore 化、 30 日 cron、 翻訳 en/ko/zh) を簡潔に伝える。

---

# Self-Review (writing-plans skill 指定)

## Spec カバレッジ確認

| Spec セクション | Task |
|---|---|
| §1.4 業界水準準拠の決定事項 | Task 4-19 全般 |
| §2.1 ルーティング | Task 14 (background-location 代替) |
| §2.2 Firestore コレクション | Task 1, 2 |
| §2.3 API エンドポイント | Task 4, 5, 15, 17 |
| §2.4 Firestore Security Rules | Task 3 |
| §3.1 通報フロー | Task 15 |
| §3.2 通知受信〜家主アクション | Task 18, 19 |
| §3.3 編集フロー | Task 6, 7 |
| §3.4 削除フロー | Task 8 |
| §3.5 詳細表示フロー | Task 12, 13, 14 |
| §4 コンポーネント設計 | Task 7-19 全般 |
| §5 UI/UX 詳細 | Task 8, 12, 13, 16, 18, 19 (CSS含む) |
| §6 i18n | Task 10 |
| §7 認可・セキュリティ | Task 3, 4, 5, 15, 17 |
| §8 エラーハンドリング | 各 handler / hook 内 |
| §9 テスト方針 | 各 task の TDD (API はスコープ外と明記) |
| §10 実装順序 | Task 1-25 順序通り |

## 主要決定事項

- **Intercepting Routes 代替**: react-router-dom v7 の background-location パターン (App.tsx で `state.backgroundLocation` を検知して二重 Routes)
- **deletedAt vs isHidden**: 両立 (家主削除 = deletedAt、 運営非表示 = isHidden)
- **API テスト**: 書かない (動く骨組み優先)、 React 側は TDD で網羅
- **シェア**: Web Share API → スマホ自動、 PC は Tweet URL + コピー
- **Discord 招待 URL**: `VITE_DISCORD_INVITE_URL` 環境変数経由

---

**Plan 完了。** 全 25 タスク、 7 commit 構成 (基盤 / 編集削除 / i18n / 詳細表示 / 通報フロー+通知 / 動作確認 / 引き継ぎ)。
