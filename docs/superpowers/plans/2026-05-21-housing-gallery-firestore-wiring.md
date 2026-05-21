# ハウジング ギャラリー一覧 実 Firestore 連携 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/housing` の Pinterest（一覧）ビューのデータ源を mock（`MOCK_LISTINGS`）から本番 Firestore `housing_listings` に付け替え、カード→詳細→通報/通知/編集削除の E2E ブロッカーを恒久解消する。

**Architecture:** 読み取り専用クエリ `getGalleryListings()` を service に追加 → `HousingListing → MockListing(view-model)` のアダプタで region を `regionForDC` 導出 → `useGalleryListings()` フックが取得・変換・状態管理 → `CenterArea` の Pinterest 経路だけがフックを使う（マップビューは sampleWardLayout のまま現状維持）。

**Tech Stack:** React + TypeScript, Firestore (firebase v12 web SDK), Vitest (happy-dom, `@testing-library/react` の `renderHook`), react-i18next。

**設計書:** `docs/superpowers/specs/2026-05-21-housing-gallery-firestore-wiring-design.md`

---

## File Structure

- **Create** `src/lib/housing/galleryAdapter.ts` — `HousingListing → MockListing` 変換（region 導出・除外判定）
- **Create** `src/lib/housing/__tests__/galleryAdapter.test.ts` — アダプタ単体テスト（純粋関数）
- **Create** `src/components/housing/workspace/useGalleryListings.ts` — 取得フック（loading/ready/error）
- **Create** `src/components/housing/workspace/__tests__/useGalleryListings.test.ts` — フックテスト（service モック）
- **Modify** `src/lib/housingListingsService.ts` — `getGalleryListings()` 追加（`orderBy` import 追加）
- **Modify** `src/__tests__/housing/housingListingsService.test.ts` — `getGalleryListings` のテスト追加（`orderBy` モック追加）
- **Modify** `src/components/housing/workspace/CenterArea.tsx` — Pinterest 経路をフックに差し替え
- **Modify** `src/__tests__/housing/CenterArea.test.tsx` — Pinterest カード枚数 assert をモックデータに追従
- **Modify** `firestore.indexes.json` — `housing_listings` 複合インデックス追加
- **Modify** `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json` — `housing.gallery.loading` / `housing.gallery.error` キー追加

---

## Task 1: `getGalleryListings` クエリ関数

**Files:**
- Modify: `src/lib/housingListingsService.ts`
- Test: `src/__tests__/housing/housingListingsService.test.ts`

- [ ] **Step 1: テストのモックに `orderBy` を追加**

`src/__tests__/housing/housingListingsService.test.ts` のモック定義部を更新する。

既存:
```ts
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));
```

置換後:
```ts
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  orderBy: (...a: unknown[]) => mockOrderBy(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));
```

`beforeEach` のリセットにも追加:
```ts
beforeEach(() => {
  mockGetDocs.mockReset();
  mockQuery.mockReset();
  mockCollection.mockReset();
  mockWhere.mockReset();
  mockLimit.mockReset();
  mockOrderBy.mockReset();
});
```

- [ ] **Step 2: 失敗するテストを書く**

同ファイル末尾、import 文に `getGalleryListings` を追加（`from '../../lib/housingListingsService'`）し、新しい describe ブロックを追加:

```ts
describe('getGalleryListings', () => {
  it('isHidden==false で createdAt 降順クエリし、deletedAt 済みをクライアント除外する', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a', data: () => ({ dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 3, buildingType: 'house', plot: 12, size: 'M', addressKey: 'k1', imageMode: 'none', tags: [], createdAt: 200, updatedAt: 200, isHidden: false, reportCount: 0, deletedAt: null }) },
        { id: 'b', data: () => ({ dc: 'Mana', server: 'Anima', area: 'Shirogane', ward: 3, buildingType: 'house', plot: 15, size: 'S', addressKey: 'k2', imageMode: 'none', tags: [], createdAt: 100, updatedAt: 100, isHidden: false, reportCount: 0, deletedAt: 1717000000000 }) },
      ],
    });
    const r = await getGalleryListings();
    expect(r.map((x) => x.id)).toEqual(['a']); // b は deletedAt があるので除外
    expect(mockWhere).toHaveBeenCalledWith('isHidden', '==', false);
    expect(mockOrderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(200);
  });

  it('0 件なら空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await getGalleryListings();
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `rtk vitest run src/__tests__/housing/housingListingsService.test.ts`
Expected: FAIL（`getGalleryListings` is not a function / import エラー）

- [ ] **Step 4: 実装する**

`src/lib/housingListingsService.ts` の import に `orderBy` を追加:
```ts
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
```

ファイル末尾に追加:
```ts
/**
 * spec 2026-05-21: ギャラリー一覧用。 公開中の物件を新着順で取得する。
 * deletedAt!=null（家主削除済）は client filter で除外（deletedAt==null の二重等値を避け、
 * 複合インデックスを isHidden+createdAt の 1 本に保つ）。
 */
export async function getGalleryListings(max = 200): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('isHidden', '==', false),
    orderBy('createdAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(qref);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<HousingListing, 'id'>) }))
    .filter((l) => l.deletedAt == null);
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/housingListingsService.test.ts`
Expected: PASS（全 describe）

- [ ] **Step 6: コミット**

```bash
rtk git add src/lib/housingListingsService.ts src/__tests__/housing/housingListingsService.test.ts
rtk git commit -m "feat(housing): getGalleryListings クエリ追加 (新着順・公開中・deletedAt除外)"
```

---

## Task 2: Firestore 複合インデックス

**Files:**
- Modify: `firestore.indexes.json`

- [ ] **Step 1: インデックス定義を追加**

`firestore.indexes.json` の `indexes` 配列に追記（既存 `plans` の後ろにカンマ区切りで）:

```json
    {
      "collectionGroup": "housing_listings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isHidden", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
```

追加後の全体イメージ:
```json
{
  "indexes": [
    {
      "collectionGroup": "plans",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerId", "order": "ASCENDING" },
        { "fieldPath": "updatedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "housing_listings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "isHidden", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 2: JSON 妥当性を確認**

Run: `node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid json')"`
Expected: `valid json`

（実デプロイは Task 6 でまとめて実施）

- [ ] **Step 3: コミット**

```bash
rtk git add firestore.indexes.json
rtk git commit -m "chore(housing): housing_listings 複合インデックス追加 (isHidden+createdAt)"
```

---

## Task 3: `firestoreToGalleryListing` アダプタ

**Files:**
- Create: `src/lib/housing/galleryAdapter.ts`
- Test: `src/lib/housing/__tests__/galleryAdapter.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/lib/housing/__tests__/galleryAdapter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { firestoreToGalleryListing } from '../galleryAdapter';
import type { HousingListing } from '../../../types/housing';

const base: HousingListing = {
  id: 'x',
  ownerUid: 'u',
  dc: 'Materia',
  server: 'Bismarck',
  area: 'LavenderBeds',
  ward: 23,
  buildingType: 'house',
  plot: 6,
  size: 'M',
  addressKey: 'k',
  imageMode: 'none',
  tags: ['luxury'],
  description: 'desc',
  createdAt: 100,
  updatedAt: 100,
  isHidden: false,
  reportCount: 0,
  deletedAt: null,
};

describe('firestoreToGalleryListing', () => {
  it('dc から region を導出して写す (Materia→OCE)', () => {
    const r = firestoreToGalleryListing(base);
    expect(r).not.toBeNull();
    expect(r!.region).toBe('OCE');
    expect(r!.id).toBe('x');
    expect(r!.tags).toEqual(['luxury']);
    expect(r!.createdAt).toBe(100);
  });

  it('未知の dc（region 導出不可）は null', () => {
    const r = firestoreToGalleryListing({ ...base, dc: 'UnknownDC' });
    expect(r).toBeNull();
  });

  it('plot が無い（個室/アパート等）は null', () => {
    const r = firestoreToGalleryListing({ ...base, plot: undefined });
    expect(r).toBeNull();
  });

  it('size が無い場合も null', () => {
    const r = firestoreToGalleryListing({ ...base, size: undefined });
    expect(r).toBeNull();
  });

  it('createdAt が Firestore Timestamp 風オブジェクトなら toMillis で number 化', () => {
    const ts = { toMillis: () => 999 } as unknown as number;
    const r = firestoreToGalleryListing({ ...base, createdAt: ts });
    expect(r!.createdAt).toBe(999);
  });

  it('tags 欠損は空配列にフォールバック', () => {
    const r = firestoreToGalleryListing({ ...base, tags: undefined as unknown as string[] });
    expect(r!.tags).toEqual([]);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run src/lib/housing/__tests__/galleryAdapter.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装する**

Create `src/lib/housing/galleryAdapter.ts`:
```ts
import type { HousingListing } from '../../types/housing';
import type { MockListing } from '../../data/housing/mockListings';
import { regionForDC } from '../../data/housing/dcServerMap';

/**
 * Firestore `HousingListing` → ギャラリー表示用 view-model（`MockListing` 形）。
 *
 * - `region` は `dc` から `regionForDC` で導出（マップに無い dc は変換不可）。
 * - 一覧カード/マップは `plot`・`size` を前提にするため、欠損レコード（個室・アパート等）は除外。
 * - 変換不可の場合は `null` を返し、呼び出し側でフィルタする。
 * - `createdAt` は number 設計だが、Firestore Timestamp が来た場合に備え `toMillis()` を許容。
 */
export function firestoreToGalleryListing(h: HousingListing): MockListing | null {
  const region = regionForDC(h.dc);
  if (region === null) return null;
  if (h.plot === undefined || h.size === undefined) return null;

  const raw = h.createdAt as unknown;
  const createdAt =
    typeof raw === 'number'
      ? raw
      : typeof (raw as { toMillis?: () => number })?.toMillis === 'function'
        ? (raw as { toMillis: () => number }).toMillis()
        : 0;

  return {
    id: h.id,
    ownerUid: h.ownerUid,
    dc: h.dc,
    server: h.server,
    region,
    area: h.area,
    ward: h.ward,
    plot: h.plot,
    size: h.size,
    imageMode: h.imageMode,
    postUrl: h.postUrl,
    ogImageUrl: h.ogImageUrl,
    thumbnailPath: h.thumbnailPath,
    tags: h.tags ?? [],
    description: h.description,
    createdAt,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run src/lib/housing/__tests__/galleryAdapter.test.ts`
Expected: PASS（6 ケース）

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/galleryAdapter.ts src/lib/housing/__tests__/galleryAdapter.test.ts
rtk git commit -m "feat(housing): HousingListing→ギャラリー view-model アダプタ (region導出/除外判定)"
```

---

## Task 4: `useGalleryListings` フック

**Files:**
- Create: `src/components/housing/workspace/useGalleryListings.ts`
- Test: `src/components/housing/workspace/__tests__/useGalleryListings.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/components/housing/workspace/__tests__/useGalleryListings.test.ts`:
```ts
// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HousingListing } from '../../../../types/housing';

const getGalleryListingsMock = vi.fn();
vi.mock('../../../../lib/housingListingsService', () => ({
  getGalleryListings: (...a: unknown[]) => getGalleryListingsMock(...a),
}));

import { useGalleryListings } from '../useGalleryListings';

const doc = (over: Partial<HousingListing>): HousingListing => ({
  id: 'x', ownerUid: 'u', dc: 'Materia', server: 'Bismarck',
  area: 'LavenderBeds', ward: 23, buildingType: 'house', plot: 6, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: [], createdAt: 1, updatedAt: 1,
  isHidden: false, reportCount: 0, deletedAt: null, ...over,
});

beforeEach(() => {
  getGalleryListingsMock.mockReset();
});

describe('useGalleryListings', () => {
  it('初期状態は loading', () => {
    getGalleryListingsMock.mockReturnValue(new Promise(() => {})); // 永久 pending
    const { result } = renderHook(() => useGalleryListings());
    expect(result.current.kind).toBe('loading');
  });

  it('取得成功で ready になり、変換不可レコードは除外される', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'ok', dc: 'Materia', plot: 6, size: 'M' }),
      doc({ id: 'no-region', dc: 'UnknownDC' }),
      doc({ id: 'no-plot', plot: undefined }),
    ]);
    const { result } = renderHook(() => useGalleryListings());
    await waitFor(() => expect(result.current.kind).toBe('ready'));
    if (result.current.kind !== 'ready') throw new Error('not ready');
    expect(result.current.listings.map((l) => l.id)).toEqual(['ok']);
    expect(result.current.listings[0].region).toBe('OCE');
  });

  it('取得失敗で error になる', async () => {
    getGalleryListingsMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useGalleryListings());
    await waitFor(() => expect(result.current.kind).toBe('error'));
    if (result.current.kind !== 'error') throw new Error('not error');
    expect(result.current.message).toBe('boom');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `rtk vitest run src/components/housing/workspace/__tests__/useGalleryListings.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装する**

Create `src/components/housing/workspace/useGalleryListings.ts`:
```ts
/**
 * spec 2026-05-21: ギャラリー一覧（Pinterest ビュー）用の取得フック。
 *
 * - マウント時に getGalleryListings() → アダプタ変換 → 変換不可（region 不明 / plot・size 欠損）を除外
 * - loading / ready / error の 3 状態
 */
import { useEffect, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { getGalleryListings } from '../../../lib/housingListingsService';
import { firestoreToGalleryListing } from '../../../lib/housing/galleryAdapter';

export type GalleryState =
  | { kind: 'loading' }
  | { kind: 'ready'; listings: MockListing[] }
  | { kind: 'error'; message: string };

export function useGalleryListings(): GalleryState {
  const [state, setState] = useState<GalleryState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const docs = await getGalleryListings();
        if (cancelled) return;
        const listings = docs
          .map(firestoreToGalleryListing)
          .filter((l): l is MockListing => l !== null);
        setState({ kind: 'ready', listings });
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : 'unknown_error';
        setState({ kind: 'error', message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `rtk vitest run src/components/housing/workspace/__tests__/useGalleryListings.test.ts`
Expected: PASS（3 ケース）

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/workspace/useGalleryListings.ts src/components/housing/workspace/__tests__/useGalleryListings.test.ts
rtk git commit -m "feat(housing): useGalleryListings フック (loading/ready/error, アダプタ変換)"
```

---

## Task 5: CenterArea を実データに接続 + i18n

**Files:**
- Modify: `src/components/housing/workspace/CenterArea.tsx`
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`
- Test: `src/__tests__/housing/CenterArea.test.tsx`

- [ ] **Step 1: i18n キーを追加**

4 ファイルすべての `housing` オブジェクト直下に `gallery` ブロックを追加する（既存 `detail` ブロックの近く）。`ja.json` は実訳、`en/ko/zh` は当面 ja 値をコピー（housing i18n の既存慣例）。

`src/locales/ja.json`（`housing.gallery`）:
```json
        "gallery": {
            "loading": "物件を読み込んでいます…",
            "error": "物件の読み込みに失敗しました"
        },
```

`src/locales/en.json` / `ko.json` / `zh.json` も同じキーで、値は上記 ja の文字列をそのままコピーで追加する（翻訳は別タスク）:
```json
        "gallery": {
            "loading": "物件を読み込んでいます…",
            "error": "物件の読み込みに失敗しました"
        },
```

- [ ] **Step 2: CenterArea テストを更新（失敗させる）**

`src/__tests__/housing/CenterArea.test.tsx` を更新する。

ファイル冒頭（import の後）に service モックを追加:
```ts
import type { HousingListing } from '../../types/housing';

const getGalleryListingsMock = vi.fn();
vi.mock('../../lib/housingListingsService', () => ({
  getGalleryListings: (...a: unknown[]) => getGalleryListingsMock(...a),
}));

const fsDoc = (over: Partial<HousingListing>): HousingListing => ({
  id: 'x', ownerUid: 'u', dc: 'Mana', server: 'Anima',
  area: 'Shirogane', ward: 3, buildingType: 'house', plot: 12, size: 'M',
  addressKey: 'k', imageMode: 'none', tags: ['wafu'], createdAt: 1, updatedAt: 1,
  isHidden: false, reportCount: 0, deletedAt: null, ...over,
});
```

`import { vi }` を vitest の import に追加（既存 import 行 `import { describe, it, expect, beforeAll, beforeEach } from 'vitest';` を以下に置換）:
```ts
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
```

`beforeEach` の末尾に、デフォルトで 3 件返すモック設定を追加:
```ts
beforeEach(() => {
    useHousingViewStore.getState().reset();
    useHousingFilterStore.getState().clearAll();
    useHousingRandomStore.getState().reset();
    useHousingFavoritesStore.getState().reset();
    getGalleryListingsMock.mockReset();
    getGalleryListingsMock.mockResolvedValue([
        fsDoc({ id: 'g1', plot: 12 }),
        fsDoc({ id: 'g2', plot: 15 }),
        fsDoc({ id: 'g3', plot: 18 }),
    ]);
});
```

`renderCenter` を `findBy*` 待ちができるよう、Pinterest 系テストを `async` 化する。既存テスト `switches to Pinterest grid when the Grid tab is clicked` を以下に置換（mock 件数 = 3 に追従、非同期取得を待つ）:
```ts
    it('switches to Pinterest grid and renders cards from Firestore data', async () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        expect(useHousingViewStore.getState().viewMode).toBe('pinterest');
        // useGalleryListings の取得完了を待つ
        await waitFor(() => {
            const cards = document.querySelectorAll('.housing-card');
            expect(cards.length).toBe(3);
        });
        const grid = document.querySelector('.housing-pinterest-grid');
        expect(grid).toBeTruthy();
    });
```

`@testing-library/react` の import に `waitFor` を追加（既存 `import { render, screen, fireEvent } from '@testing-library/react';` を置換）:
```ts
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
```

既存テスト `navigates to the listing detail route when a card is clicked in Pinterest mode` も取得を待つよう更新:
```ts
    it('navigates to the listing detail route when a card is clicked in Pinterest mode', async () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        const firstCard = await screen.findByRole('button', { name: 'Shirogane 3-12' });
        fireEvent.click(firstCard);
        expect(document.querySelector('.housing-card-expanded')).toBeNull();
    });
```

既存テスト `toggles favorite from the card overlay` も async 化:
```ts
    it('toggles favorite from the card overlay ♡ button (not via expanded view)', async () => {
        renderCenter();
        fireEvent.click(screen.getByRole('tab', { name: /一覧/ }));
        const favBtns = await screen.findAllByRole('button', { name: 'お気に入り' });
        expect(favBtns.length).toBeGreaterThan(0);
        fireEvent.click(favBtns[0]);
        expect(useHousingFavoritesStore.getState().ids.length).toBe(1);
    });
```

既存テスト `shows EmptyResult when filters produce zero matches in Pinterest mode` を、フィルタで 0 件にする形に更新（mock は Mana/JP データなので region=EU フィルタで 0 件）:
```ts
    it('shows EmptyResult when filters produce zero matches in Pinterest mode', async () => {
        useHousingFilterStore.setState({ regions: ['EU'] });
        useHousingViewStore.setState({ viewMode: 'pinterest' });
        renderCenter();
        expect(await screen.findByText('該当ハウジングがありません')).toBeInTheDocument();
    });
```

マップ系テスト（`renders the view mode toggle` / `starts in map mode ... bubble 5 件`）は**変更しない**（マップは MOCK_LISTINGS のまま）。

- [ ] **Step 3: テストが失敗することを確認**

Run: `rtk vitest run src/__tests__/housing/CenterArea.test.tsx`
Expected: FAIL（CenterArea がまだフックを使っておらず、Pinterest が MOCK_LISTINGS の 50 件を出すため枚数不一致 / `waitFor` 等）

- [ ] **Step 4: CenterArea を実装する**

`src/components/housing/workspace/CenterArea.tsx` を更新する。

import に追加:
```ts
import { useGalleryListings } from './useGalleryListings';
import { EmptyResult } from './EmptyResult';
```
（`EmptyResult` は既存 import 済ならそのまま）

`CenterArea` 本体の、フィルタ系 store 取得の直後に取得フックを追加:
```ts
    const gallery = useGalleryListings();
    const galleryListings = gallery.kind === 'ready' ? gallery.listings : EMPTY_LISTINGS;
```

ファイル上部（import 群の後、コンポーネント外）に安定参照の空配列を定義:
```ts
const EMPTY_LISTINGS: MockListing[] = [];
```

`filtered` / `pinterestListings` の元データを `MOCK_LISTINGS` から `galleryListings` に差し替える:
```ts
    const filtered = useMemo(
        () => applyFilters(galleryListings, { dc, regions, servers, areas, sizes, tags, searchText }),
        [galleryListings, dc, regions, servers, areas, sizes, tags, searchText],
    );

    const pinterestListings = useMemo(
        () => [...filtered].sort((a, b) => b.createdAt - a.createdAt),
        [filtered],
    );
```

マップ系（`mapWardListings` / `pickRandomWard`）は `MOCK_LISTINGS` のまま**変更しない**。

panel meta の件数表示をアクティブビューで切替:
```tsx
                <div className="housing-panel-meta">
                    {viewMode === 'map'
                        ? `${mapWardListings.length} / ${MOCK_LISTINGS.length}`
                        : `${filtered.length} / ${galleryListings.length}`}
                </div>
```

Pinterest ビューの描画分岐を loading / error / empty / ready に対応（既存の pinterest 分岐を置換）:
```tsx
                {viewMode === 'map' ? (
                    mapWardListings.length === 0 ? (
                        <EmptyResult />
                    ) : (
                        <MapView onCardClick={handleMapClick} />
                    )
                ) : gallery.kind === 'loading' ? (
                    <div className="housing-center-loading">{t('housing.gallery.loading')}</div>
                ) : gallery.kind === 'error' ? (
                    <div className="housing-center-error">{t('housing.gallery.error')}</div>
                ) : pinterestListings.length === 0 ? (
                    <EmptyResult />
                ) : (
                    <div className="housing-center-area-scroll">
                        <PinterestView listings={pinterestListings} initialExpandedId={focusListingId} />
                    </div>
                )}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `rtk vitest run src/__tests__/housing/CenterArea.test.tsx`
Expected: PASS（マップ系も Pinterest 系も）

- [ ] **Step 6: housing スイート全体の回帰確認**

Run: `rtk vitest run src/__tests__/housing src/components/housing src/lib/housing`
Expected: PASS（既存テスト含め緑。`applyFilters`/`randomWard` は無改修で通る）

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/housing/workspace/CenterArea.tsx src/__tests__/housing/CenterArea.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(housing): 一覧Pinterestビューを実Firestoreデータに接続 (loading/error/empty対応)"
```

---

## Task 6: ビルド検証・インデックスデプロイ・実機確認・E2E ハンドオフ

**Files:** なし（検証とデプロイ）

- [ ] **Step 1: 型・ビルド確認**

Run: `rtk npm run build`
Expected: 成功（tsc -b + vite build。未使用 import / 型エラーなし。memory: Vercel は tsc 厳密モード）

- [ ] **Step 2: 全テスト確認**

Run: `rtk vitest run`
Expected: PASS（housing 含む全スイート。注: appcheck teardown ハングは既知。`run` で完走する範囲を確認）

- [ ] **Step 3: Firestore インデックスをデプロイ**

Run: `firebase deploy --only firestore:indexes`
Expected: 成功。インデックスビルドに数分かかる場合あり（Firebase Console で `Enabled` を確認）。

- [ ] **Step 4: dev サーバで実機確認（匿名ビューア）**

`npm run dev`（5173）を起動し、Playwright で:
1. `/housing` を開き「一覧」タブをクリック → カードが**実物件の件数**（現状 1 件: Materia/Bismarck LavenderBeds 23-6）で表示される
2. そのカードをクリック → URL が `/housing/listing/koefEkmi4ENVJ0R8UC1G` に遷移し、**詳細モーダルが開く（バウンスしない）**
3. ActionBar（♡ / シェア / ちがった）が表示される
スクリーンショットを取得して確認。

- [ ] **Step 5: ログイン必須 E2E の手順をユーザーに提示**

以下を実施できるのはユーザー（私=Claude は Discord OAuth 不可）。手順書として提示する:
1. **アカウント B（通報者）でログイン** → 上記物件の詳細を開く → 「ちがった（通報）」→ reason 選択 → 送信。トースト成功を確認。
2. **アカウント A（家主）でログイン** → 通知ベルに赤バッジ → ドロップダウンに通報通知 → クリックで詳細＋reason 別ガイドモーダルが開く。
3. ガイドの CTA → 「編集」で `HousingEditModal`、「削除」で `HousingDeleteConfirm` → 削除実行で一覧から消える（`deletedAt` セット）。
4. 削除済み物件の直 URL が「Not found」になることを確認。

- [ ] **Step 6: TODO.md / TODO_COMPLETED.md を更新**

- TODO.md「現在の状態」を本タスク完了に更新。「一覧の実データ連携」を完了として `TODO_COMPLETED.md` へ移動。
- 行数確認 `wc -l docs/TODO.md`（100 行以内）。

- [ ] **Step 7: 最終コミット & push**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(housing): ギャラリー実データ連携 完了記録"
rtk git push
```

---

## Self-Review メモ（計画作成時チェック済）

- **Spec coverage**: §4 クエリ=Task1 / §3 アダプタ=Task3 / §5 フック=Task4 / §6 CenterArea=Task5 / §7 i18n=Task5 / §8 テスト=各Task / §9 デプロイ検証=Task6 / インデックス(§4末尾)=Task2。マップ現状維持(§2非ゴール)=Task5 で MOCK_LISTINGS 維持。網羅。
- **Placeholder scan**: 各ステップに実コード・実コマンド・期待出力あり。TBD なし。
- **Type consistency**: `getGalleryListings(max=200): Promise<HousingListing[]>` / `firestoreToGalleryListing(h): MockListing|null` / `GalleryState`(loading|ready|error) / `useGalleryListings(): GalleryState` が Task 間で一致。`MockListing` を view-model として一貫使用。
