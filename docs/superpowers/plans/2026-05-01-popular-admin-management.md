# 野良主流 管理画面拡張 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボトムシートの野良主流カードを管理画面から個別に「非表示」にできるようにし、運営テスト用プランが意図せず全ユーザーに表示される問題を解消する。

**Architecture:** Firestore `shared_plans/{id}.hidden` フラグを追加 → `api/popular` GET でフィルタ → 管理画面 `AdminFeatured.tsx` に「野良主流ビュー」タブを追加し、コンテンツ別 上位 10 件のカード一覧で ★ Featured / 🚫 Hidden を直接トグル。

**Tech Stack:** React 19, TypeScript, Vercel Serverless, Firestore (Admin SDK), Tailwind, vitest, react-i18next, lucide-react

**参照設計書:** [docs/superpowers/specs/2026-05-01-popular-admin-management-design.md](../specs/2026-05-01-popular-admin-management-design.md)

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| Modify: `api/popular/index.ts` | GET の hidden フィルタ + PATCH の hidden 切替対応 |
| Create: `api/popular/popularFilters.ts` | hidden フィルタロジック純粋関数（テスト容易性） |
| Create: `api/admin/_popularHandler.ts` | 管理者用 GET /api/admin?resource=popular ハンドラー |
| Modify: `api/admin/index.ts` | resource=popular ルート追加 |
| Modify: `src/components/admin/AdminFeatured.tsx` | セグメント切替 + 既存 search ビューを内部分離 |
| Create: `src/components/admin/PopularBrowseView.tsx` | 野良主流ビューのカード一覧＋詳細ペイン |
| Modify: `src/locales/{ja,en,zh,ko}.json` | i18n キー追加（admin.popular_*） |
| Create: `src/__tests__/popularFilters.test.ts` | hidden フィルタの単体テスト |
| Create: `src/__tests__/PopularBrowseView.test.tsx` | コンポーネントテスト（API モック） |

---

### Task 1: hidden フィルタ純粋関数を切り出し（TDD）

**Files:**
- Create: `api/popular/popularFilters.ts`
- Create: `src/__tests__/popularFilters.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

```typescript
// src/__tests__/popularFilters.test.ts
import { describe, it, expect } from 'vitest';
import { filterVisible, isVisible } from '../../api/popular/popularFilters';

describe('isVisible', () => {
    it('returns true when hidden is undefined', () => {
        expect(isVisible({ hidden: undefined })).toBe(true);
    });
    it('returns true when hidden is false', () => {
        expect(isVisible({ hidden: false })).toBe(true);
    });
    it('returns false when hidden is true', () => {
        expect(isVisible({ hidden: true })).toBe(false);
    });
});

describe('filterVisible', () => {
    it('keeps non-hidden plans', () => {
        const input = [
            { hidden: false, score: 10 },
            { hidden: undefined, score: 5 },
        ];
        expect(filterVisible(input)).toHaveLength(2);
    });
    it('removes hidden plans', () => {
        const input = [
            { hidden: false, score: 10 },
            { hidden: true, score: 999 },
            { hidden: undefined, score: 3 },
        ];
        const result = filterVisible(input);
        expect(result).toHaveLength(2);
        expect(result.every(d => d.hidden !== true)).toBe(true);
    });
    it('returns empty array when all hidden', () => {
        const input = [{ hidden: true }, { hidden: true }];
        expect(filterVisible(input)).toEqual([]);
    });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/__tests__/popularFilters.test.ts`
Expected: FAIL（`Cannot find module '../../api/popular/popularFilters'`）

- [ ] **Step 3: 実装**

```typescript
// api/popular/popularFilters.ts
/**
 * shared_plan の hidden フラグ判定ヘルパー（管理画面で hidden=true にされたプランは
 * ボトムシート野良主流から除外する）。
 */

export interface HiddenAware {
    hidden?: boolean;
}

/** hidden が true でなければ可視。undefined / false は可視扱い。 */
export function isVisible<T extends HiddenAware>(item: T): boolean {
    return item.hidden !== true;
}

/** hidden=true を弾いた配列を返す（純粋関数）。 */
export function filterVisible<T extends HiddenAware>(items: T[]): T[] {
    return items.filter(isVisible);
}
```

- [ ] **Step 4: テストパス確認**

Run: `npx vitest run src/__tests__/popularFilters.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: コミット**

```bash
git add api/popular/popularFilters.ts src/__tests__/popularFilters.test.ts
git commit -m "feat(popular): add hidden filter pure function with tests"
```

---

### Task 2: GET /api/popular に hidden フィルタを組み込む

**Files:**
- Modify: `api/popular/index.ts:170-194` (scored 配列のフィルタ部分)

- [ ] **Step 1: import 追加**

`api/popular/index.ts` 先頭の import 群に追加:

```typescript
import { isVisible } from './popularFilters.js';
```

- [ ] **Step 2: scored 配列の filter を hidden 込みに変更**

[api/popular/index.ts:176-184](../../../api/popular/index.ts#L176-L184) の `scored` 計算を以下に置換:

```typescript
const scored = allSnap.docs
    .filter(doc => isVisible(doc.data() as { hidden?: boolean }))
    .map(doc => {
        const data = doc.data();
        const byDay: Record<string, number> = data.copyCountByDay || {};
        let score7d = 0;
        for (const [key, n] of Object.entries(byDay)) {
            if (key >= windowStart) score7d += n;
        }
        return { doc, score7d, copyCount: data.copyCount ?? 0 };
    });
```

- [ ] **Step 3: featured 取得の hidden ガードを追加**

[api/popular/index.ts:162-168, 195-198](../../../api/popular/index.ts) の featured 取得・代入部分を以下に置換:

```typescript
// featured プランを取得（hidden=true は弾く）
const featuredSnap = await db
    .collection(COLLECTION)
    .where('contentId', '==', id)
    .where('featured', '==', true)
    .limit(2)  // hidden で弾かれることを考慮し 2 件取得
    .get();
const validFeaturedDoc = featuredSnap.docs.find(d => isVisible(d.data() as { hidden?: boolean }));

// ... scored ソートまで既存通り ...

const plans = scored.slice(0, 2).map(s => mapDoc(s.doc));
const featured = validFeaturedDoc ? mapDoc(validFeaturedDoc) : null;
```

**Cache-Control について（変更しない方針）**

管理画面で hidden を切り替えたとき、ボトムシートに反映されるまで最大 15 分かかる。
ユーザー判断: Firestore 読み取りコスト節約のため既存 `s-maxage=900` を維持。
管理者がテスト確認するときは `?t=Date.now()` のようなランダムクエリ付きで取得すれば CDN を bypass して即時 Firestore から取れる。

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: テスト確認**

Run: `npx vitest run`
Expected: 既存テスト + Task 1 のテスト全 PASS

- [ ] **Step 6: コミット**

```bash
git add api/popular/index.ts
git commit -m "feat(popular): exclude hidden plans from GET /api/popular"
```

---

### Task 3: PATCH /api/popular に hidden 切替を追加

**Files:**
- Modify: `api/popular/index.ts:303-371` (PATCH ブロック)

- [ ] **Step 1: PATCH ブロックを以下で置換**

[api/popular/index.ts:303-371](../../../api/popular/index.ts) を以下で置換:

```typescript
} else if (req.method === 'PATCH') {
    // ── 管理者専用: featured / hidden フラグ切替 ──
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { shareId, featured, hidden } = req.body ?? {};
    if (typeof shareId !== 'string') {
        return res.status(400).json({ error: 'shareId (string) required' });
    }
    const hasFeatured = typeof featured === 'boolean';
    const hasHidden = typeof hidden === 'boolean';
    if (!hasFeatured && !hasHidden) {
        return res.status(400).json({ error: 'featured (boolean) or hidden (boolean) required' });
    }

    const docRef = db.collection(COLLECTION).doc(shareId);
    const snap = await docRef.get();
    if (!snap.exists) {
        return res.status(404).json({ error: 'not found' });
    }
    const data = snap.data()!;
    const contentId = data.contentId;
    if (!contentId) {
        return res.status(400).json({ error: 'plan has no contentId' });
    }
    const newImageHash = (data.imageHash as string) ?? null;

    // 不整合ガード: hidden=true なら featured も強制 false に
    let effectiveFeatured = hasFeatured ? featured : (data.featured === true);
    if (hasHidden && hidden === true) {
        effectiveFeatured = false;
    }

    // featured を true にする場合、同コンテンツの他 featured を取得（hidden=true は弾く）
    let oldFeaturedEntries: { shareId: string; imageHash: string | null }[] = [];
    if (effectiveFeatured && (hasFeatured || hasHidden)) {
        const oldFeaturedSnap = await db
            .collection(COLLECTION)
            .where('contentId', '==', contentId)
            .where('featured', '==', true)
            .get();
        oldFeaturedEntries = oldFeaturedSnap.docs
            .filter(d => d.id !== shareId)
            .map(d => ({
                shareId: d.id,
                imageHash: (d.data().imageHash as string) ?? null,
            }));
    }

    // トランザクション: shared_plans のみ一貫更新
    await db.runTransaction(async (tx) => {
        const updates: Record<string, any> = {};

        if (hasFeatured || hasHidden) {
            updates.featured = effectiveFeatured;
        }
        if (hasHidden) {
            updates.hidden = hidden;
            updates.hiddenAt = hidden ? Date.now() : FieldValue.delete();
            updates.hiddenBy = hidden ? adminUid : FieldValue.delete();
        }

        if (effectiveFeatured) {
            for (const entry of oldFeaturedEntries) {
                tx.update(db.collection(COLLECTION).doc(entry.shareId), { featured: false });
            }
        }
        tx.update(docRef, updates);
    });

    // og_image_meta.keepForever は featured 連動のみ（hidden では触らない）
    const metaCol = db.collection(OG_IMAGE_META_COLLECTION);
    if (effectiveFeatured) {
        if (newImageHash) {
            await metaCol.doc(newImageHash).update({ keepForever: true })
                .catch(() => {});
        }
        for (const entry of oldFeaturedEntries) {
            if (entry.imageHash && entry.imageHash !== newImageHash) {
                await metaCol.doc(entry.imageHash).update({ keepForever: FieldValue.delete() })
                    .catch(() => {});
            }
        }
    } else if (hasFeatured && featured === false) {
        // featured を明示的に false にした場合 keepForever を解除
        if (newImageHash) {
            await metaCol.doc(newImageHash).update({ keepForever: FieldValue.delete() })
                .catch(() => {});
        }
    }

    return res.status(200).json({
        ok: true,
        featured: effectiveFeatured,
        hidden: hasHidden ? hidden : (data.hidden === true),
    });

}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: テスト確認**

Run: `npx vitest run`
Expected: 全 PASS

- [ ] **Step 4: コミット**

```bash
git add api/popular/index.ts
git commit -m "feat(popular): add hidden flag toggle to PATCH /api/popular"
```

---

### Task 4: 管理者用 GET /api/admin?resource=popular ハンドラー

**Files:**
- Create: `api/admin/_popularHandler.ts`
- Modify: `api/admin/index.ts`

- [ ] **Step 1: ハンドラー作成**

```typescript
// api/admin/_popularHandler.ts
/**
 * 管理者用: 野良主流ビュー（コンテンツ別 上位 N 件、hidden 含む）
 * GET /api/admin?resource=popular&contentId=X&limit=10
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { verifyAdmin } from '../../src/lib/adminAuth.js';

const COLLECTION = 'shared_plans';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

function todayKey(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
function dayKeyDaysBefore(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function initAdmin() {
    if (!getApps().length) {
        let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
        if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
        pk = pk.replace(/\\n/g, '\n');
        initializeApp({
            credential: cert({
                projectId: process.env.FIREBASE_PROJECT_ID!,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
                privateKey: pk,
            }),
        });
    }
}

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const contentId = (req.query?.contentId as string) || '';
    if (!contentId) {
        return res.status(400).json({ error: 'contentId required' });
    }
    const limitRaw = parseInt((req.query?.limit as string) || `${DEFAULT_LIMIT}`, 10);
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? DEFAULT_LIMIT : limitRaw), MAX_LIMIT);

    initAdmin();
    const db = getFirestore();

    const snap = await db.collection(COLLECTION)
        .where('contentId', '==', contentId)
        .get();

    const windowStart = dayKeyDaysBefore(6);
    const scored = snap.docs.map(doc => {
        const data = doc.data();
        const byDay: Record<string, number> = data.copyCountByDay || {};
        let score7d = 0;
        for (const [key, n] of Object.entries(byDay)) {
            if (key >= windowStart) score7d += n;
        }
        return { doc, data, score7d };
    });

    // 並び順: featured 優先 → score7d 降順 → 生涯 copyCount 降順 → doc.id
    scored.sort((a, b) => {
        const af = a.data.featured === true ? 1 : 0;
        const bf = b.data.featured === true ? 1 : 0;
        if (af !== bf) return bf - af;
        if (a.score7d !== b.score7d) return b.score7d - a.score7d;
        const ac = a.data.copyCount ?? 0;
        const bc = b.data.copyCount ?? 0;
        if (ac !== bc) return bc - ac;
        return a.doc.id < b.doc.id ? -1 : a.doc.id > b.doc.id ? 1 : 0;
    });

    const top = scored.slice(0, limit);

    const plans = top.map(({ doc, data, score7d }) => {
        const partyMembers = data.planData?.partyMembers?.map((m: any) => ({
            id: m.id,
            jobId: m.jobId,
            role: m.role,
        })) ?? [];
        const ownerId: string = data.ownerId ?? '';
        const ownerUidSuffix = ownerId.length >= 4 ? ownerId.slice(-4) : ownerId;
        return {
            shareId: doc.id,
            title: data.title ?? '',
            contentId: data.contentId,
            copyCount: data.copyCount ?? 0,
            score7d,
            featured: data.featured === true,
            hidden: data.hidden === true,
            hiddenAt: data.hiddenAt ?? null,
            createdAt: data.createdAt ?? null,
            ownerUidSuffix,
            partyMembers,
            imageHash: data.imageHash ?? null,
        };
    });

    return res.status(200).json({ contentId, plans, todayKey: todayKey() });
}
```

- [ ] **Step 2: index.ts に case 追加**

[api/admin/index.ts](../../../api/admin/index.ts) を以下で置換:

```typescript
/**
 * 管理API統合エンドポイント
 * ?resource=contents  → コンテンツ管理 (GET/POST/PUT/DELETE)
 * ?resource=role      → ロール管理 (GET/POST)
 * ?resource=templates → テンプレート管理 (GET/POST/PUT/DELETE)
 * ?resource=sync      → データ同期 (POST)
 * ?resource=dashboard → ダッシュボード統計 (GET)
 * ?resource=ugc       → UGC管理 (GET/DELETE)
 * ?resource=popular   → 野良主流ランキング (GET)
 */
import contentsHandler from './_contentsHandler.js';
import roleHandler from './_roleHandler.js';
import templatesHandler from './_templatesHandler.js';
import syncHandler from './_syncHandler.js';
import dashboardHandler from './_dashboardHandler.js';
import ugcHandler from './_ugcHandler.js';
import popularHandler from './_popularHandler.js';

export default async function handler(req: any, res: any) {
  const resource = req.query?.resource;

  switch (resource) {
    case 'contents':
      return contentsHandler(req, res);
    case 'role':
      return roleHandler(req, res);
    case 'templates':
      return templatesHandler(req, res);
    case 'sync':
      return syncHandler(req, res);
    case 'dashboard':
      return dashboardHandler(req, res);
    case 'ugc':
      return ugcHandler(req, res);
    case 'popular':
      return popularHandler(req, res);
    default:
      return res.status(400).json({ error: 'Missing or invalid resource parameter. Use ?resource=contents|role|templates|sync|dashboard|ugc|popular' });
  }
}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 4: コミット**

```bash
git add api/admin/_popularHandler.ts api/admin/index.ts
git commit -m "feat(admin): add GET /api/admin?resource=popular for ranking browser"
```

---

### Task 5: i18n キー 4 言語追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: ja.json に admin 名前空間内へキー追加**

`admin` セクション末尾（既存 `featured_*` キーの直後）に追加:

```json
"popular_view_tab": "野良主流ビュー",
"popular_search_tab": "URL 検索",
"popular_select_content": "コンテンツを選んでください",
"popular_loading": "読み込み中…",
"popular_no_plans": "このコンテンツには共有プランがありません",
"popular_rank": "順位",
"popular_score_7d": "直近7日コピー数",
"popular_total_copies": "生涯コピー数",
"popular_owner": "オーナー (UID 末尾)",
"popular_visible_now": "⭐ 表示中（自動）",
"popular_featured_badge": "★ Featured",
"popular_hidden_badge": "🚫 非表示中",
"popular_hide_button": "ボトムシートから非表示にする",
"popular_unhide_button": "再表示する",
"popular_hide_confirm": "「{{title}}」を全ユーザーのボトムシートから非表示にします。よろしいですか？（後から再表示できます）",
"popular_unhide_confirm": "「{{title}}」をボトムシートに再表示します。よろしいですか？",
"popular_hide_success": "非表示にしました",
"popular_unhide_success": "再表示しました",
"popular_tab_savage": "零式",
"popular_tab_ultimate": "絶",
"popular_select_a_card": "左のカードを選択してください",
"popular_no_owner": "（不明）"
```

- [ ] **Step 2: en.json**

```json
"popular_view_tab": "Featured Browser",
"popular_search_tab": "URL Search",
"popular_select_content": "Select a content",
"popular_loading": "Loading…",
"popular_no_plans": "No shared plans for this content",
"popular_rank": "Rank",
"popular_score_7d": "Copies (last 7d)",
"popular_total_copies": "Total copies",
"popular_owner": "Owner (UID suffix)",
"popular_visible_now": "⭐ Live (auto)",
"popular_featured_badge": "★ Featured",
"popular_hidden_badge": "🚫 Hidden",
"popular_hide_button": "Hide from bottom sheet",
"popular_unhide_button": "Show again",
"popular_hide_confirm": "Hide \"{{title}}\" from all users' bottom sheet. OK? (You can show again later)",
"popular_unhide_confirm": "Show \"{{title}}\" in the bottom sheet again. OK?",
"popular_hide_success": "Hidden successfully",
"popular_unhide_success": "Shown again",
"popular_tab_savage": "Savage",
"popular_tab_ultimate": "Ultimate",
"popular_select_a_card": "Select a card on the left",
"popular_no_owner": "(unknown)"
```

- [ ] **Step 3: zh.json**

```json
"popular_view_tab": "野团主流浏览",
"popular_search_tab": "URL 搜索",
"popular_select_content": "请选择内容",
"popular_loading": "加载中…",
"popular_no_plans": "该内容没有共享方案",
"popular_rank": "排名",
"popular_score_7d": "最近7日复制数",
"popular_total_copies": "总复制数",
"popular_owner": "拥有者 (UID 后缀)",
"popular_visible_now": "⭐ 正在显示（自动）",
"popular_featured_badge": "★ 精选",
"popular_hidden_badge": "🚫 已隐藏",
"popular_hide_button": "从底部弹层中隐藏",
"popular_unhide_button": "重新显示",
"popular_hide_confirm": "将「{{title}}」从所有用户的底部弹层隐藏。确定吗？（之后可重新显示）",
"popular_unhide_confirm": "将「{{title}}」重新显示在底部弹层中。确定吗？",
"popular_hide_success": "已隐藏",
"popular_unhide_success": "已重新显示",
"popular_tab_savage": "零式",
"popular_tab_ultimate": "绝境",
"popular_select_a_card": "请选择左侧卡片",
"popular_no_owner": "（未知）"
```

- [ ] **Step 4: ko.json**

```json
"popular_view_tab": "야팟 주류 보기",
"popular_search_tab": "URL 검색",
"popular_select_content": "컨텐츠를 선택하세요",
"popular_loading": "로딩 중…",
"popular_no_plans": "이 컨텐츠에 공유된 플랜이 없습니다",
"popular_rank": "순위",
"popular_score_7d": "최근 7일 복사 수",
"popular_total_copies": "총 복사 수",
"popular_owner": "소유자 (UID 끝자리)",
"popular_visible_now": "⭐ 표시 중 (자동)",
"popular_featured_badge": "★ Featured",
"popular_hidden_badge": "🚫 숨김",
"popular_hide_button": "바텀시트에서 숨기기",
"popular_unhide_button": "다시 표시",
"popular_hide_confirm": "「{{title}}」을(를) 모든 사용자의 바텀시트에서 숨깁니다. 진행하시겠습니까? (나중에 다시 표시할 수 있습니다)",
"popular_unhide_confirm": "「{{title}}」을(를) 바텀시트에 다시 표시합니다. 진행하시겠습니까?",
"popular_hide_success": "숨겼습니다",
"popular_unhide_success": "다시 표시했습니다",
"popular_tab_savage": "영식",
"popular_tab_ultimate": "절",
"popular_select_a_card": "왼쪽 카드를 선택하세요",
"popular_no_owner": "(알 수 없음)"
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "i18n(admin): add popular admin browser keys (4 languages)"
```

---

### Task 6: PopularBrowseView コンポーネント実装（TDD）

**Files:**
- Create: `src/components/admin/PopularBrowseView.tsx`
- Create: `src/__tests__/PopularBrowseView.test.tsx`

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/__tests__/PopularBrowseView.test.tsx
// vitest.config.ts は globals: true なので describe/it/expect/vi/beforeEach/afterEach は import 不要
import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PopularBrowseView } from '../components/admin/PopularBrowseView';

vi.mock('../lib/apiClient', () => ({
    apiFetch: vi.fn(),
}));

import { apiFetch } from '../lib/apiClient';
const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

const mockPlans = [
    {
        shareId: 'aaa',
        title: 'Test 1',
        contentId: 'm9s',
        copyCount: 12,
        score7d: 5,
        featured: false,
        hidden: false,
        hiddenAt: null,
        createdAt: 1730000000000,
        ownerUidSuffix: 'a3f1',
        partyMembers: [],
        imageHash: null,
    },
    {
        shareId: 'bbb',
        title: 'Test 2',
        contentId: 'm9s',
        copyCount: 3,
        score7d: 2,
        featured: false,
        hidden: true,
        hiddenAt: 1730000001000,
        createdAt: 1730000000000,
        ownerUidSuffix: 'b3f2',
        partyMembers: [],
        imageHash: null,
    },
];

beforeEach(() => {
    mockApiFetch.mockReset();
});
afterEach(() => {
    vi.useRealTimers();
});

describe('PopularBrowseView', () => {
    it('shows the loading state initially', () => {
        mockApiFetch.mockImplementationOnce(() => new Promise(() => {}));
        render(<PopularBrowseView />);
        expect(screen.getByText(/読み込み中|Loading|加载|로딩/)).toBeInTheDocument();
    });

    it('shows ranked cards after fetch', async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ contentId: 'm9s', plans: mockPlans }),
        });
        render(<PopularBrowseView />);
        await waitFor(() => expect(screen.getByText('Test 1')).toBeInTheDocument());
        expect(screen.getByText('Test 2')).toBeInTheDocument();
    });

    it('marks hidden cards visually', async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ contentId: 'm9s', plans: mockPlans }),
        });
        render(<PopularBrowseView />);
        await waitFor(() => expect(screen.getByText('Test 2')).toBeInTheDocument());
        const hiddenCard = screen.getByText('Test 2').closest('[data-testid="popular-card"]');
        expect(hiddenCard).toHaveAttribute('data-hidden', 'true');
    });

    it('PATCHes hidden=true when hide button clicked', async () => {
        mockApiFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ contentId: 'm9s', plans: mockPlans }),
        });
        const { rerender: _ } = render(<PopularBrowseView />);
        await waitFor(() => expect(screen.getByText('Test 1')).toBeInTheDocument());
        fireEvent.click(screen.getByText('Test 1'));
        // confirm を抑制
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        // PATCH の reply モック + 再 fetch のモック
        mockApiFetch
            .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, hidden: true }) })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    contentId: 'm9s',
                    plans: [{ ...mockPlans[0], hidden: true }, mockPlans[1]],
                }),
            });
        const hideBtn = await screen.findByRole('button', {
            name: /非表示にする|Hide|隐藏|숨기기/,
        });
        fireEvent.click(hideBtn);
        await waitFor(() => {
            const calls = mockApiFetch.mock.calls;
            const patchCall = calls.find(c => c[1]?.method === 'PATCH');
            expect(patchCall).toBeDefined();
            expect(patchCall![1].body).toContain('"hidden":true');
            expect(patchCall![1].body).toContain('"shareId":"aaa"');
        });
    });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/__tests__/PopularBrowseView.test.tsx`
Expected: FAIL（component not found）

- [ ] **Step 3: コンポーネント実装**

```tsx
// src/components/admin/PopularBrowseView.tsx
/**
 * 野良主流ビュー: コンテンツ別 上位 N 件のカード一覧 + 詳細ペイン
 * - 左: 順位カード（featured / hidden の状態バッジ付き）
 * - 右: 選択カードの詳細 + ★ Featured / 🚫 Hidden 操作
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, EyeOff, Eye, Loader2 } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { getContentDefinitions, getAllUltimates } from '../../data/contentRegistry';

interface PlanInfo {
    shareId: string;
    title: string;
    contentId: string;
    copyCount: number;
    score7d: number;
    featured: boolean;
    hidden: boolean;
    hiddenAt: number | null;
    createdAt: number | null;
    ownerUidSuffix: string;
    partyMembers: { id: string; jobId: string | null; role: string | null }[];
    imageHash: string | null;
}

function getOgpUrl(plan: PlanInfo): string {
    return plan.imageHash
        ? `/og/${plan.imageHash}.png`
        : `/api/og?id=${encodeURIComponent(plan.shareId)}`;
}

export function PopularBrowseView() {
    const { t, i18n } = useTranslation();
    const lang = i18n.language.startsWith('ja') ? 'ja' : 'en';

    const savageContents = useMemo(
        () => getContentDefinitions().filter(c => c.category === 'savage'),
        []
    );
    const latestPatch = useMemo(
        () => savageContents.reduce((max, c) => (c.patch > max ? c.patch : max), '0'),
        [savageContents]
    );
    const savageList = useMemo(
        () => savageContents.filter(c => c.patch === latestPatch).sort((a, b) => a.order - b.order),
        [savageContents, latestPatch]
    );
    const ultimateList = useMemo(() => getAllUltimates().filter(c => c.id !== 'dsr_p1'), []);

    const [tab, setTab] = useState<'savage' | 'ultimate'>('savage');
    const [contentId, setContentId] = useState<string>(savageList[0]?.id ?? '');
    const [plans, setPlans] = useState<PlanInfo[] | null>(null);
    const [selectedShareId, setSelectedShareId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [patching, setPatching] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const list = tab === 'savage' ? savageList : ultimateList;

    // タブ切替時にコンテンツ選択を当該タブの先頭にリセット
    useEffect(() => {
        const ids = (tab === 'savage' ? savageList : ultimateList).map(c => c.id);
        if (!ids.includes(contentId)) {
            setContentId(ids[0] ?? '');
        }
    }, [tab, savageList, ultimateList, contentId]);

    const fetchPlans = useCallback(async (cid: string) => {
        if (!cid) return;
        setLoading(true);
        setError(null);
        setPlans(null);
        setSelectedShareId(null);
        try {
            const res = await apiFetch(
                `/api/admin?resource=popular&contentId=${encodeURIComponent(cid)}&limit=10`
            );
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setError(body.error || `Error: ${res.status}`);
                return;
            }
            const data = await res.json();
            setPlans(data.plans as PlanInfo[]);
            if ((data.plans as PlanInfo[]).length > 0) {
                setSelectedShareId((data.plans as PlanInfo[])[0].shareId);
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPlans(contentId);
    }, [contentId, fetchPlans]);

    const selected = plans?.find(p => p.shareId === selectedShareId) ?? null;

    const handleToggle = useCallback(async (
        plan: PlanInfo,
        kind: 'featured' | 'hidden',
        next: boolean
    ) => {
        const confirmKey =
            kind === 'hidden'
                ? next ? 'admin.popular_hide_confirm' : 'admin.popular_unhide_confirm'
                : next ? 'admin.featured_confirm_set' : 'admin.featured_confirm_unset';
        const confirmMsg = t(confirmKey, { title: plan.title || plan.shareId, content: plan.contentId });
        if (!confirm(confirmMsg)) return;

        setPatching(true);
        setError(null);
        setToast(null);
        try {
            const body: Record<string, unknown> = { shareId: plan.shareId };
            body[kind] = next;
            const res = await apiFetch('/api/popular', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                setError(errBody.error || `Error: ${res.status}`);
                return;
            }
            const successKey =
                kind === 'hidden'
                    ? next ? 'admin.popular_hide_success' : 'admin.popular_unhide_success'
                    : next ? 'admin.featured_set_success' : 'admin.featured_unset_success';
            setToast(t(successKey));
            await fetchPlans(contentId);
            setSelectedShareId(plan.shareId);
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setPatching(false);
        }
    }, [t, fetchPlans, contentId]);

    return (
        <div className="max-w-6xl">
            <h1 className="text-app-3xl font-bold mb-4">{t('admin.featured_title')}</h1>

            {/* タブ */}
            <div className="flex gap-1 mb-3 border-b border-app-border">
                {(['savage', 'ultimate'] as const).map(k => (
                    <button
                        key={k}
                        onClick={() => setTab(k)}
                        className={`px-4 py-2 text-app-lg font-semibold transition-colors ${
                            tab === k
                                ? 'text-app-text border-b-2 border-app-text -mb-px'
                                : 'text-app-text-muted hover:text-app-text'
                        }`}
                    >
                        {t(`admin.popular_tab_${k}`)}
                    </button>
                ))}
            </div>

            {/* コンテンツ選択 */}
            <div className="mb-4">
                <label className="block text-app-lg text-app-text-muted mb-1">
                    {t('admin.popular_select_content')}
                </label>
                <select
                    value={contentId}
                    onChange={e => setContentId(e.target.value)}
                    className="bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text focus:border-app-text focus:outline-none"
                >
                    {list.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.name[lang] || c.name.ja}
                        </option>
                    ))}
                </select>
            </div>

            {/* エラー / トースト */}
            {error && (
                <div className="mb-4 p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
                    {error}
                </div>
            )}
            {toast && (
                <div className="mb-4 p-3 rounded-lg bg-app-blue-dim border border-app-blue-border text-app-blue text-app-lg">
                    {toast}
                </div>
            )}

            {/* リスト + 詳細 */}
            <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
                {/* 左: カードリスト */}
                <div className="flex flex-col gap-2">
                    {loading && (
                        <div className="flex items-center gap-2 text-app-text-muted text-app-lg p-4">
                            <Loader2 size={14} className="animate-spin" />
                            {t('admin.popular_loading')}
                        </div>
                    )}
                    {!loading && plans?.length === 0 && (
                        <div className="text-app-text-muted text-app-lg p-4">
                            {t('admin.popular_no_plans')}
                        </div>
                    )}
                    {!loading && plans?.map((p, idx) => (
                        <button
                            key={p.shareId}
                            data-testid="popular-card"
                            data-hidden={p.hidden ? 'true' : 'false'}
                            onClick={() => setSelectedShareId(p.shareId)}
                            className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                                selectedShareId === p.shareId
                                    ? 'border-app-text bg-app-surface2'
                                    : 'border-app-border hover:bg-app-surface2'
                            } ${p.hidden ? 'opacity-50' : ''}`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-app-text-muted text-app-base font-mono w-6 shrink-0">
                                    #{idx + 1}
                                </span>
                                {p.featured && (
                                    <span className="text-app-yellow text-app-sm font-bold">
                                        {t('admin.popular_featured_badge')}
                                    </span>
                                )}
                                {!p.featured && idx === 0 && !p.hidden && (
                                    <span className="text-app-blue text-app-sm font-bold">
                                        {t('admin.popular_visible_now')}
                                    </span>
                                )}
                                {p.hidden && (
                                    <span className="text-app-red text-app-sm font-bold">
                                        {t('admin.popular_hidden_badge')}
                                    </span>
                                )}
                            </div>
                            <div className="text-app-lg text-app-text truncate">
                                {p.title || '(no title)'}
                            </div>
                            <div className="text-app-base text-app-text-muted mt-1">
                                {t('admin.popular_score_7d')}: {p.score7d} / {t('admin.popular_total_copies')}: {p.copyCount}
                            </div>
                        </button>
                    ))}
                </div>

                {/* 右: 詳細ペイン */}
                <div className="border border-app-border rounded-lg p-4 min-h-[400px]">
                    {!selected ? (
                        <div className="text-app-text-muted text-app-lg flex items-center justify-center h-full">
                            {t('admin.popular_select_a_card')}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <img
                                src={getOgpUrl(selected)}
                                alt=""
                                className="w-full max-w-md rounded-lg border border-app-border bg-app-surface2"
                                style={{ aspectRatio: '1200 / 630', objectFit: 'cover' }}
                            />
                            <table className="w-full text-app-lg">
                                <tbody>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted w-32">
                                            {t('admin.featured_plan_title')}
                                        </th>
                                        <td className="py-1">{selected.title || '—'}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.popular_score_7d')}
                                        </th>
                                        <td className="py-1">{selected.score7d}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.popular_total_copies')}
                                        </th>
                                        <td className="py-1">{selected.copyCount}</td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.featured_created')}
                                        </th>
                                        <td className="py-1">
                                            {selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '—'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                                            {t('admin.popular_owner')}
                                        </th>
                                        <td className="py-1 font-mono">
                                            {selected.ownerUidSuffix || t('admin.popular_no_owner')}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="border-t border-app-border pt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={() => handleToggle(selected, 'featured', !selected.featured)}
                                    disabled={patching}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                                        selected.featured
                                            ? 'text-app-yellow hover:bg-app-yellow-dim'
                                            : 'bg-app-blue text-white hover:bg-app-blue-hover'
                                    }`}
                                >
                                    {patching ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={selected.featured ? 'currentColor' : 'none'} />}
                                    {selected.featured
                                        ? t('admin.featured_unset_button')
                                        : t('admin.featured_set_button')}
                                </button>
                                <button
                                    onClick={() => handleToggle(selected, 'hidden', !selected.hidden)}
                                    disabled={patching}
                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                                        selected.hidden
                                            ? 'text-app-text border border-app-text hover:bg-app-surface2'
                                            : 'text-app-red border border-app-red-border hover:bg-app-red-dim'
                                    }`}
                                >
                                    {patching ? <Loader2 size={14} className="animate-spin" /> : selected.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                                    {selected.hidden
                                        ? t('admin.popular_unhide_button')
                                        : t('admin.popular_hide_button')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 4: テストパス確認**

Run: `npx vitest run src/__tests__/PopularBrowseView.test.tsx`
Expected: 4 tests PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/admin/PopularBrowseView.tsx src/__tests__/PopularBrowseView.test.tsx
git commit -m "feat(admin): add PopularBrowseView with hidden/featured toggle"
```

---

### Task 7: AdminFeatured.tsx にセグメント切替を追加

**Files:**
- Modify: `src/components/admin/AdminFeatured.tsx`

- [ ] **Step 1: AdminFeatured.tsx を以下で置換**

既存実装の URL 検索ビューを内部関数 `SearchView` として保持し、上部にセグメント、デフォルトで `PopularBrowseView` を表示。

```tsx
/**
 * Featured 設定ページ
 * 既定: 野良主流ビュー（PopularBrowseView）
 * 補助: URL 検索ビュー（共有 URL から shareId を抽出して直接操作）
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { Search, Star, Loader2 } from 'lucide-react';
import { PopularBrowseView } from './PopularBrowseView';

/** 共有URLまたはshareIdからshareId部分を抽出 */
function extractShareId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return trimmed;
}

interface PlanInfo {
  shareId: string;
  title: string;
  contentId: string | null;
  createdAt: number | null;
  featured: boolean;
  hidden: boolean;
  copyCount: number;
  imageHash: string | null;
}

function getOgpUrl(plan: PlanInfo): string {
  return plan.imageHash
    ? `/og/${plan.imageHash}.png`
    : `/api/og?id=${encodeURIComponent(plan.shareId)}`;
}

function PopularSearchView() {
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleSearch = async () => {
    const shareId = extractShareId(input);
    if (!shareId) return;

    setLoading(true);
    setError(null);
    setPlan(null);
    setToast(null);

    try {
      const res = await apiFetch(`/api/admin?resource=ugc&shareId=${encodeURIComponent(shareId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t('admin.featured_not_found'));
          return;
        }
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      const data = await res.json();
      setPlan({
        shareId: data.shareId,
        title: data.title || '',
        contentId: data.contentId || null,
        createdAt: data.createdAt || null,
        featured: data.featured === true,
        hidden: data.hidden === true,
        copyCount: data.copyCount || 0,
        imageHash: data.imageHash || null,
      });
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handlePatch = async (body: Record<string, unknown>, successMsgKey: string) => {
    if (!plan) return;
    setPatching(true);
    setError(null);
    setToast(null);
    try {
      const res = await apiFetch('/api/popular', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: plan.shareId, ...body }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || `Error: ${res.status}`);
        return;
      }
      const result = await res.json();
      setPlan({
        ...plan,
        featured: typeof result.featured === 'boolean' ? result.featured : plan.featured,
        hidden: typeof result.hidden === 'boolean' ? result.hidden : plan.hidden,
      });
      setToast(t(successMsgKey));
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setPatching(false);
    }
  };

  const handleToggleFeatured = async (next: boolean) => {
    if (!plan) return;
    const contentIdStr = plan.contentId || '(未設定)';
    const confirmMsg = next
      ? t('admin.featured_confirm_set', { content: contentIdStr })
      : t('admin.featured_confirm_unset');
    if (!confirm(confirmMsg)) return;
    await handlePatch({ featured: next }, next ? 'admin.featured_set_success' : 'admin.featured_unset_success');
  };

  const handleToggleHidden = async (next: boolean) => {
    if (!plan) return;
    const confirmMsg = t(next ? 'admin.popular_hide_confirm' : 'admin.popular_unhide_confirm', {
      title: plan.title || plan.shareId,
    });
    if (!confirm(confirmMsg)) return;
    await handlePatch({ hidden: next }, next ? 'admin.popular_hide_success' : 'admin.popular_unhide_success');
  };

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={t('admin.featured_url_placeholder')}
          className="flex-1 bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-text text-app-bg font-semibold text-app-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {t('admin.featured_search')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
          {error}
        </div>
      )}

      {toast && (
        <div className="mb-4 p-3 rounded-lg bg-app-blue-dim border border-app-blue-border text-app-blue text-app-lg">
          {toast}
        </div>
      )}

      {plan && (
        <div className="border border-app-border rounded-lg p-4">
          <div className="flex gap-4 mb-4">
            <img
              src={getOgpUrl(plan)}
              alt=""
              className="w-48 h-auto rounded-lg border border-app-border bg-app-surface2"
              style={{ aspectRatio: '1200 / 630', objectFit: 'cover' }}
            />
            <div className="flex-1">
              <table className="w-full text-app-lg">
                <tbody>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted w-28">
                      {t('admin.featured_current_content')}
                    </th>
                    <td className="py-1">{plan.contentId || '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_plan_title')}
                    </th>
                    <td className="py-1">{plan.title || '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_copy_count')}
                    </th>
                    <td className="py-1">{plan.copyCount}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_created')}
                    </th>
                    <td className="py-1">{plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">Status</th>
                    <td className="py-1 font-semibold flex flex-wrap gap-2">
                      {plan.featured && (
                        <span className="text-app-yellow flex items-center gap-1">
                          <Star size={14} fill="currentColor" />
                          {t('admin.featured_status_on')}
                        </span>
                      )}
                      {plan.hidden && (
                        <span className="text-app-red">{t('admin.popular_hidden_badge')}</span>
                      )}
                      {!plan.featured && !plan.hidden && (
                        <span className="text-app-text-muted">
                          {t('admin.featured_status_off')}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-app-border pt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => handleToggleFeatured(!plan.featured)}
              disabled={patching}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                plan.featured
                  ? 'text-app-red hover:bg-app-red-dim'
                  : 'bg-app-blue text-white hover:bg-app-blue-hover'
              }`}
            >
              {patching ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill={plan.featured ? 'currentColor' : 'none'} />}
              {plan.featured ? t('admin.featured_unset_button') : t('admin.featured_set_button')}
            </button>
            <button
              onClick={() => handleToggleHidden(!plan.hidden)}
              disabled={patching}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold transition-colors disabled:opacity-40 ${
                plan.hidden
                  ? 'text-app-text border border-app-text hover:bg-app-surface2'
                  : 'text-app-red border border-app-red-border hover:bg-app-red-dim'
              }`}
            >
              {plan.hidden ? t('admin.popular_unhide_button') : t('admin.popular_hide_button')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminFeatured() {
  const { t } = useTranslation();
  const [view, setView] = useState<'browse' | 'search'>('browse');

  return (
    <div>
      {/* セグメントコントロール */}
      <div className="inline-flex p-1 bg-app-surface2 rounded-lg border border-app-border mb-4">
        {(['browse', 'search'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-md text-app-lg font-semibold transition-colors ${
              view === v
                ? 'bg-app-text text-app-bg'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {t(v === 'browse' ? 'admin.popular_view_tab' : 'admin.popular_search_tab')}
          </button>
        ))}
      </div>

      {view === 'browse' ? <PopularBrowseView /> : <PopularSearchView />}
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

- [ ] **Step 3: 全テスト確認**

Run: `npx vitest run`
Expected: 全 PASS

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/AdminFeatured.tsx
git commit -m "feat(admin): split AdminFeatured into browse/search segments"
```

---

### Task 8: 統合確認・最終 push

- [ ] **Step 1: TypeScript エラー確認**

Run: `npm run build`
Expected: 警告のみ（既存 chunk size 警告は許容）。エラー無し。

- [ ] **Step 2: 全テスト実行**

Run: `npx vitest run`
Expected: 既存 + 新規テスト全 PASS

- [ ] **Step 3: ローカル dev で起動して目視確認**

Run: `npm run dev`

確認項目:
- /admin にログイン → サイドナビ「Featured 設定」クリック
- セグメント「野良主流ビュー」がデフォルトで開く
- 零式 / 絶 タブ切替
- コンテンツ選択（プルダウン）→ 上位 10 件カードが表示される
- カードクリック → 右ペインに OGP・詳細表示
- ★ Featured トグル → confirm → 成功 toast → ランキング再取得
- 🚫 非表示にする → confirm → 成功 toast → 該当カードが半透明＋「非表示中」表示
- 同コンテンツのボトムシートを別タブで開いて、非表示にしたプランが消えていること（自動 1 位繰り上がり）
- 「URL 検索」セグメントに切替 → 既存 URL 検索ビューが正常動作

- [ ] **Step 4: docs/TODO.md 更新**

「現在の状態」と「完了タスク」セクションに今回の作業を追記。

- [ ] **Step 5: 最終コミット & push**

```bash
git add docs/TODO.md
git commit -m "docs(todo): 野良主流管理画面拡張 完了記録"
git push
```

Vercel 自動デプロイ → 本番実機で再確認。

---

## 完了の定義 (Definition of Done)

- ✅ `shared_plans/{id}.hidden` フィールドが Firestore に保存される（管理者の操作経由で）
- ✅ ボトムシート GET /api/popular が hidden=true プランを返さない（自動繰り上がり動作）
- ✅ /admin/featured の野良主流ビューでコンテンツ別 上位 10 件 + featured/hidden 状態表示
- ✅ ★ / 🚫 のトグルが confirm 経由で動作、操作後即時 UI 反映
- ✅ URL 検索ビューも維持され既存挙動どおり
- ✅ 4 言語の i18n キーが揃っている
- ✅ vitest 既存全 PASS + 新規テスト PASS
- ✅ npm run build 成功
- ✅ 本番実機で動作確認

---

## YAGNI 確認

実装しないもの（設計書 §11 と一致）:
- 一括非表示 / 一括 featured
- hidden 理由メモ
- 監査ログ画面
- コンテンツ単位の機能 OFF
- スコア閾値の自動非表示
