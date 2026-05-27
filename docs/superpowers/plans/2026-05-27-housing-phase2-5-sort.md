# Housing Phase 2-5: lastConfirmedAt 2 段 sort 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一覧データに「全体 createdAt desc、 同 addressKey 内は lastConfirmedAt desc」 の 2 段 sort を適用し、 ハウジング画面 7 consumer 全てで並び順を統一する。

**Architecture:** pure helper `sortListingsForGallery` を新規作成し、 `useHousingListingsStore` の `load` / `upsert` で適用する (案 A = ストア層対応)。 view 層 (CenterArea) の重複 sort は撤去。 helper は §3.7 のバッジ判定 (= 同 addressKey 内で他 listing と比較) と同じ部品にする。

**Tech Stack:** TypeScript / Zustand / Vitest

**設計書:** `docs/.private/2026-05-27-housing-video-3frame-and-phase2.md` §3.6

---

## File Structure

**Created:**
- `src/lib/housing/sortListingsForGallery.ts` — pure sort helper (副作用なし、 immutable)
- `src/lib/housing/__tests__/sortListingsForGallery.test.ts` — helper 単体テスト

**Modified:**
- `src/store/useHousingListingsStore.ts` — `load` / `upsert` で helper 適用
- `src/store/__tests__/useHousingListingsStore.test.ts` — 新仕様テスト追加 (既存テストの順序 assert に影響なし、 fixture 確認のみ)
- `src/components/housing/workspace/CenterArea.tsx:61-64` — view 層の重複 sort 撤去

**Read-only check (no modify expected):**
- `src/components/housing/workspace/RightPanel.tsx`
- `src/components/housing/workspace/TourBuilderPane.tsx`
- `src/components/housing/workspace/TourProgressList.tsx`
- `src/components/housing/workspace/FavoritesListPane.tsx`
- `src/components/housing/workspace/FavoritesModal.tsx`
- `src/components/housing/workspace/FilterPanel.tsx`

---

## Task 1: pure helper `sortListingsForGallery` 作成 (TDD)

**Files:**
- Create: `src/lib/housing/sortListingsForGallery.ts`
- Create: `src/lib/housing/__tests__/sortListingsForGallery.test.ts`

- [ ] **Step 1: テストファイル作成 (failing tests)**

```typescript
// src/lib/housing/__tests__/sortListingsForGallery.test.ts
import { describe, it, expect } from 'vitest';
import type { MockListing } from '../../../data/housing/mockListings';
import { sortListingsForGallery } from '../sortListingsForGallery';

const listing = (over: Partial<MockListing>): MockListing => ({
    id: 'x', ownerUid: 'u', dc: 'Materia', server: 'Bismarck',
    region: 'OCE', area: 'LavenderBeds', ward: 23, buildingType: 'house',
    plot: 6, size: 'M', addressKey: 'k', imageMode: 'none', tags: [],
    createdAt: 1, updatedAt: 1, lastConfirmedAt: 1,
    isHidden: false, reportCount: 0, deletedAt: null,
    ...over,
});

describe('sortListingsForGallery', () => {
    it('空配列はそのまま空配列を返す', () => {
        expect(sortListingsForGallery([])).toEqual([]);
    });

    it('元配列を mutate しない (immutable)', () => {
        const input = [
            listing({ id: 'a', createdAt: 1, addressKey: 'addr-a' }),
            listing({ id: 'b', createdAt: 2, addressKey: 'addr-b' }),
        ];
        const snapshot = input.map((l) => l.id);
        sortListingsForGallery(input);
        expect(input.map((l) => l.id)).toEqual(snapshot);
    });

    it('全 listing が別住所のとき createdAt desc で並ぶ', () => {
        const input = [
            listing({ id: 'old', createdAt: 100, addressKey: 'a' }),
            listing({ id: 'new', createdAt: 300, addressKey: 'b' }),
            listing({ id: 'mid', createdAt: 200, addressKey: 'c' }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['new', 'mid', 'old']);
    });

    it('同住所内では lastConfirmedAt desc で並ぶ', () => {
        const input = [
            listing({ id: 'a1', createdAt: 100, addressKey: 'addr', lastConfirmedAt: 500 }),
            listing({ id: 'a2', createdAt: 100, addressKey: 'addr', lastConfirmedAt: 900 }),
            listing({ id: 'a3', createdAt: 100, addressKey: 'addr', lastConfirmedAt: 200 }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['a2', 'a1', 'a3']);
    });

    it('複数住所混在: 各住所の代表 (= 同住所内で lastConfirmedAt 最大の listing) の createdAt desc で並ぶ', () => {
        const input = [
            // addr-X (代表 createdAt=300, 最新確認=800)
            listing({ id: 'x1', createdAt: 300, addressKey: 'addr-X', lastConfirmedAt: 800 }),
            listing({ id: 'x2', createdAt: 250, addressKey: 'addr-X', lastConfirmedAt: 400 }),
            // addr-Y (代表 createdAt=500, 最新確認=600)
            listing({ id: 'y1', createdAt: 500, addressKey: 'addr-Y', lastConfirmedAt: 600 }),
            // addr-Z (単独 createdAt=400)
            listing({ id: 'z1', createdAt: 400, addressKey: 'addr-Z', lastConfirmedAt: 100 }),
        ];
        const out = sortListingsForGallery(input);
        // 各住所内: x1, x2 / y1 / z1
        // 各住所の代表 createdAt: addr-Y=500 > addr-Z=400 > addr-X=300
        expect(out.map((l) => l.id)).toEqual(['y1', 'z1', 'x1', 'x2']);
    });

    it('lastConfirmedAt が同値のときは createdAt desc を保つ (= 安定 sort)', () => {
        const input = [
            listing({ id: 'older', createdAt: 100, addressKey: 'k', lastConfirmedAt: 500 }),
            listing({ id: 'newer', createdAt: 200, addressKey: 'k', lastConfirmedAt: 500 }),
        ];
        const out = sortListingsForGallery(input);
        expect(out.map((l) => l.id)).toEqual(['newer', 'older']);
    });
});
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/lib/housing/__tests__/sortListingsForGallery.test.ts`

Expected: FAIL (`Cannot find module '../sortListingsForGallery'`)

- [ ] **Step 3: helper 実装**

```typescript
// src/lib/housing/sortListingsForGallery.ts
import type { MockListing } from '../../data/housing/mockListings';

/**
 * 一覧表示用の 2 段 sort:
 * - 各 addressKey の代表 (= 同住所内で lastConfirmedAt 最大の listing) を選び、
 *   その createdAt desc で住所グループの並びを決める
 * - 同 addressKey 内では lastConfirmedAt desc で並ぶ
 * - 同 lastConfirmedAt 内は createdAt desc で安定化
 *
 * 設計書 docs/.private/2026-05-27-housing-video-3frame-and-phase2.md §3.6
 *
 * Always returns a new array (does not mutate input).
 */
export function sortListingsForGallery<T extends Pick<MockListing, 'createdAt' | 'lastConfirmedAt' | 'addressKey'>>(
    listings: T[],
): T[] {
    if (listings.length === 0) return [];

    // 1. addressKey ごとにグループ化
    const groups = new Map<string, T[]>();
    for (const l of listings) {
        const arr = groups.get(l.addressKey);
        if (arr) arr.push(l);
        else groups.set(l.addressKey, [l]);
    }

    // 2. 各グループ内を lastConfirmedAt desc → createdAt desc で sort
    for (const arr of groups.values()) {
        arr.sort((a, b) => (b.lastConfirmedAt - a.lastConfirmedAt) || (b.createdAt - a.createdAt));
    }

    // 3. グループの並びは代表 listing の createdAt desc で決定
    //    (代表 = グループ内で lastConfirmedAt 最大 = sort 後の先頭)
    const sortedGroups = Array.from(groups.values()).sort(
        (a, b) => b[0].createdAt - a[0].createdAt,
    );

    // 4. flatten
    return sortedGroups.flat();
}
```

- [ ] **Step 4: テストパス確認**

Run: `npx vitest run src/lib/housing/__tests__/sortListingsForGallery.test.ts`

Expected: PASS (6 tests)

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/sortListingsForGallery.ts src/lib/housing/__tests__/sortListingsForGallery.test.ts
rtk git commit -m "feat(housing): #60 Phase 2-5 sortListingsForGallery helper (2 段 sort)"
```

---

## Task 2: store の `load` で helper 適用

**Files:**
- Modify: `src/store/useHousingListingsStore.ts:42-61`
- Test: `src/store/__tests__/useHousingListingsStore.test.ts`

- [ ] **Step 1: 新テスト追加 (failing)**

`src/store/__tests__/useHousingListingsStore.test.ts` の `describe` ブロック末尾 (line 80 の直後、 `});` の直前) に追加:

```typescript
  it('load: 同住所複数 listing は lastConfirmedAt desc、 別住所は createdAt desc で並ぶ', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      // addr-X (代表 createdAt=300, lastConfirmedAt=800)
      doc({ id: 'x1', addressKey: 'addr-X', createdAt: 300, lastConfirmedAt: 800, plot: 6, size: 'M' }),
      doc({ id: 'x2', addressKey: 'addr-X', createdAt: 250, lastConfirmedAt: 400, plot: 6, size: 'M' }),
      // addr-Y (代表 createdAt=500)
      doc({ id: 'y1', addressKey: 'addr-Y', createdAt: 500, lastConfirmedAt: 600, plot: 7, size: 'M' }),
    ]);
    await useHousingListingsStore.getState().load();
    const ids = useHousingListingsStore.getState().listings.map((l) => l.id);
    // addr-Y (createdAt=500) → addr-X (createdAt=300 で x1, x2 順)
    expect(ids).toEqual(['y1', 'x1', 'x2']);
  });
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/store/__tests__/useHousingListingsStore.test.ts`

Expected: 新テスト 1 件 FAIL (現状は Firestore 順そのまま → `['x1', 'x2', 'y1']` を返す)

- [ ] **Step 3: ファイル冒頭の import 追加**

`src/store/useHousingListingsStore.ts` の line 9-11 を以下に置換 (静的 import を追加):

```typescript
import { create } from 'zustand';
import type { MockListing } from '../data/housing/mockListings';
import { sortListingsForGallery } from '../lib/housing/sortListingsForGallery';
// 注意: service / adapter は load() 内で動的 import する。
// 静的 import すると firebase.ts がこのストアを import する全コンポーネント経由でロードされ、
// テストの appcheck teardown ハングを誘発するため (memory: reference_vitest_pool_firebase)。
// sortListingsForGallery は firebase に依存しない pure helper なので静的 import OK。
```

- [ ] **Step 4: `load` 関数を修正**

`src/store/useHousingListingsStore.ts` の `load` 関数を以下に修正 (動的 import 配列はそのまま、 sort 適用を追加):

```typescript
  load: async () => {
    const cur = get().status;
    // 冪等: 取得中 / 取得済みなら何もしない (error からは再試行可)
    if (cur === 'loading' || cur === 'ready') return;
    set({ status: 'loading', error: null });
    try {
      const [{ getGalleryListings }, { firestoreToGalleryListing }] = await Promise.all([
        import('../lib/housingListingsService'),
        import('../lib/housing/galleryAdapter'),
      ]);
      const docs = await getGalleryListings();
      const listings = sortListingsForGallery(
        docs.map(firestoreToGalleryListing).filter((l): l is MockListing => l !== null),
      );
      set({ status: 'ready', listings, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'unknown_error';
      set({ status: 'error', error: message });
    }
  },
```

- [ ] **Step 5: テストパス確認**

Run: `npx vitest run src/store/__tests__/useHousingListingsStore.test.ts`

Expected: 全テスト PASS (既存 6 + 新 1)

- [ ] **Step 6: コミット**

```bash
rtk git add src/store/useHousingListingsStore.ts src/store/__tests__/useHousingListingsStore.test.ts
rtk git commit -m "feat(housing): #60 Phase 2-5 store.load で sortListingsForGallery 適用"
```

---

## Task 3: store の `upsert` で sort 維持

**Files:**
- Modify: `src/store/useHousingListingsStore.ts:62-69`
- Test: `src/store/__tests__/useHousingListingsStore.test.ts`

**背景:** 現状 `upsert` は新規 listing を先頭追加するだけで sort を壊す。 Phase 2-5 では sort 維持が必要。

- [ ] **Step 1: 新テスト追加 (failing)**

`src/store/__tests__/useHousingListingsStore.test.ts` の `describe` ブロック末尾に追加:

```typescript
  it('upsert: 新規追加後も lastConfirmedAt 2 段 sort が維持される', async () => {
    // 既存 listing が 1 件ある状態を作る
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'existing', addressKey: 'addr-A', createdAt: 100, lastConfirmedAt: 100, plot: 6, size: 'M' }),
    ]);
    await useHousingListingsStore.getState().load();

    // 新規 listing を upsert (より新しい createdAt)
    const newListing = {
      ...useHousingListingsStore.getState().listings[0],
      id: 'fresh',
      addressKey: 'addr-B',
      createdAt: 500,
      lastConfirmedAt: 500,
    };
    useHousingListingsStore.getState().upsert(newListing);

    // fresh (createdAt=500) が existing (createdAt=100) より先
    const ids = useHousingListingsStore.getState().listings.map((l) => l.id);
    expect(ids).toEqual(['fresh', 'existing']);
  });

  it('upsert: 同住所への新規追加は lastConfirmedAt 順で挿入される', async () => {
    getGalleryListingsMock.mockResolvedValueOnce([
      doc({ id: 'old', addressKey: 'same', createdAt: 100, lastConfirmedAt: 100, plot: 6, size: 'M' }),
    ]);
    await useHousingListingsStore.getState().load();

    const newer = {
      ...useHousingListingsStore.getState().listings[0],
      id: 'newer',
      addressKey: 'same',
      createdAt: 200,
      lastConfirmedAt: 300, // 既存より新しい lastConfirmedAt
    };
    useHousingListingsStore.getState().upsert(newer);

    // 同住所内で lastConfirmedAt desc → newer が先
    const ids = useHousingListingsStore.getState().listings.map((l) => l.id);
    expect(ids).toEqual(['newer', 'old']);
  });
```

- [ ] **Step 2: テスト失敗確認**

Run: `npx vitest run src/store/__tests__/useHousingListingsStore.test.ts`

Expected: 新テスト 2 件のうち少なくとも 1 件 FAIL (現状 upsert は先頭追加のみ)

- [ ] **Step 3: `upsert` 関数を修正**

`src/store/useHousingListingsStore.ts` の `upsert` 関数を以下に修正 (静的 import は Task 2 で済):

```typescript
  upsert: (listing) =>
    set((s) => {
      // 既存と同 id を除外 + 新 listing を加え、 helper で並び直す。
      // helper は pure sync なので upsert (同期関数) からも直接呼べる。
      const others = s.listings.filter((l) => l.id !== listing.id);
      return { listings: sortListingsForGallery([...others, listing]) };
    }),
```

- [ ] **Step 4: テストパス確認**

Run: `npx vitest run src/store/__tests__/useHousingListingsStore.test.ts`

Expected: 全テスト PASS (既存 6 + Task 2 で追加 1 + 今回 2 = 9)

- [ ] **Step 5: コミット**

```bash
rtk git add src/store/useHousingListingsStore.ts src/store/__tests__/useHousingListingsStore.test.ts
rtk git commit -m "feat(housing): #60 Phase 2-5 upsert でも sort 維持"
```

---

## Task 4: CenterArea の view 層 sort を撤去

**Files:**
- Modify: `src/components/housing/workspace/CenterArea.tsx:61-64`

**背景:** store が sort 済を保証 + `applyFilters` は `Array.filter` で順序保持 → view 層の重複 sort は不要。

- [ ] **Step 1: 現状確認** ([src/components/housing/workspace/CenterArea.tsx:56-64](src/components/housing/workspace/CenterArea.tsx#L56-L64))

```typescript
const filtered = useMemo(
    () => applyFilters(galleryListings, { dc, regions, servers, areas, sizes, tags, searchText }),
    [galleryListings, dc, regions, servers, areas, sizes, tags, searchText],
);

const pinterestListings = useMemo(
    () => [...filtered].sort((a, b) => b.createdAt - a.createdAt),
    [filtered],
);
```

- [ ] **Step 2: 修正 — `pinterestListings` を撤去し `filtered` を直接使う**

`src/components/housing/workspace/CenterArea.tsx` の line 61-64 を**削除**し、 line 104 の `pinterestListings` 参照を `filtered` に置換:

修正前 (line 100-104):
```tsx
                ) : pinterestListings.length === 0 ? (
                    <EmptyResult />
                ) : (
                    <div className="housing-center-area-scroll">
                        <PinterestView listings={pinterestListings} initialExpandedId={focusListingId} />
```

修正後:
```tsx
                ) : filtered.length === 0 ? (
                    <EmptyResult />
                ) : (
                    <div className="housing-center-area-scroll">
                        <PinterestView listings={filtered} initialExpandedId={focusListingId} />
```

- [ ] **Step 3: 既存テスト確認**

Run: `npx vitest run src/__tests__/housing/CenterArea.test.tsx`

Expected: PASS (= CenterArea テストが順序を assert しているなら新 helper の挙動に追従、 もし fail したら fixture の `lastConfirmedAt` を整えて期待値を更新)

- [ ] **Step 4: 全テスト + tsc 通過確認**

Run (並列で良い):
```
rtk tsc --noEmit
rtk vitest run
```

Expected: 両方 PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/workspace/CenterArea.tsx
rtk git commit -m "refactor(housing): #60 Phase 2-5 CenterArea の view 層 sort を撤去 (store で済)"
```

---

## Task 5: 他 6 consumer 確認 + 最終ビルド検証

**Files (read-only check, no modification expected):**
- `src/components/housing/workspace/RightPanel.tsx`
- `src/components/housing/workspace/TourBuilderPane.tsx`
- `src/components/housing/workspace/TourProgressList.tsx`
- `src/components/housing/workspace/FavoritesListPane.tsx`
- `src/components/housing/workspace/FavoritesModal.tsx`
- `src/components/housing/workspace/FilterPanel.tsx`

**目的:** 6 consumer が「createdAt desc 前提」 の追加 sort や順序依存ロジックを持っていないか確認。 持っていれば撤去 or sort を helper で統一。

- [ ] **Step 1: 各 consumer の `listings` 使用箇所を Grep**

Run:
```
rtk grep -n "useHousingListingsStore" src/components/housing/workspace/RightPanel.tsx
rtk grep -n "useHousingListingsStore" src/components/housing/workspace/TourBuilderPane.tsx
rtk grep -n "useHousingListingsStore" src/components/housing/workspace/TourProgressList.tsx
rtk grep -n "useHousingListingsStore" src/components/housing/workspace/FavoritesListPane.tsx
rtk grep -n "useHousingListingsStore" src/components/housing/workspace/FavoritesModal.tsx
rtk grep -n "useHousingListingsStore" src/components/housing/workspace/FilterPanel.tsx
```

- [ ] **Step 2: 順序依存ロジックの確認**

各ファイルで listings に対する以下を確認:
- `.sort(...)` の有無
- `.slice()` + index 依存 (例: 「上位 3 件」 のような peek)
- 個別 component 側で `createdAt` を key にした追加処理

順序依存があるものは:
- (A) sort 撤去で済む (= store で sort 済) → 撤去してコミット
- (B) 「住所順」 等の異なる sort が必要 (例: RightPanel が `sortByAddress` 使ってるなら維持) → そのまま維持
- (C) 「createdAt desc」 と意図的に異なる場合 → ユーザーに相談

- [ ] **Step 3: 変更が必要だった場合はコミット**

```bash
rtk git add <該当ファイル>
rtk git commit -m "refactor(housing): #60 Phase 2-5 <consumer 名> の重複 sort を撤去"
```

変更不要だった場合はこのステップはスキップ。

- [ ] **Step 4: ビルド + 全テスト最終確認**

Run (順次):
```
rtk tsc --noEmit
rtk vitest run
rtk next build
```

Expected: 全部 PASS

- [ ] **Step 5: 実機検証**

ユーザーに渡す検証手順:
1. ローカル起動 (`npm run dev`)
2. `/housing` を開く → 中央 Pinterest ビューで listing が並ぶ
3. 同住所に複数 listing がある場合 (テストデータで作る or 既存)、 lastConfirmedAt 新しいほうが上に来ることを確認
4. 別住所同士は createdAt desc で並ぶことを確認
5. 右パネル / お気に入り / ツアー作成 / フィルタ件数の表示が壊れていないか確認
6. 新規登録直後、 そのカードが正しい位置に出るか確認 (= upsert の sort 維持)

ユーザー確認 OK → push して終了。

- [ ] **Step 6: push**

```bash
rtk git push
```

---

## 完了条件

- [ ] helper `sortListingsForGallery` 単体テスト 6 件 PASS
- [ ] store テスト 既存 6 + 新規 3 = 9 件 PASS
- [ ] `tsc --noEmit` PASS
- [ ] `vitest run` 全件 PASS
- [ ] `next build` PASS
- [ ] 実機検証 (中央 Pinterest + 右パネル + お気に入り + ツアー + フィルタ件数で並びが壊れていない)
- [ ] 同住所複数 listing で lastConfirmedAt 新しい順に並ぶ
- [ ] 別住所では createdAt desc を維持
- [ ] 新規登録直後の即反映 (upsert) でも sort が維持される

---

## 次セッション以降の話 (この plan のスコープ外)

設計書 §3.8 参照: 詳細モーダル内の重複一覧 / 長押し報告 / ツアー自動追加 — Phase 2-6/2-7 着手時にユーザーと詰める。
