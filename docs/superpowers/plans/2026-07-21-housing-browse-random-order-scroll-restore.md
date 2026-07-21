# ハウジング一覧: 表示順ランダム化 + スクロール位置復元 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探すページの並び順デフォルトを「ランダム」にし(新着順/古い順も選択可・シャッフルボタン付き)、探す/お気に入り/ハウジンガープロフィールの3画面で一覧→詳細→戻る時のスクロール位置を復元する。

**Architecture:** ランダム順の種(seed)とスクロール位置は、React コンポーネントの state ではなく **persist しない(sessionStorageに保存しない)プレーンな zustand store** に持たせる。React Router の SPA 内遷移(戻る・タブ切替)はこの store の値を破棄しないが、ブラウザの実リロードでは JS メモリごと消える(sessionStorage に保存すると実リロードでも残ってしまい要件を満たせない)。

**Tech Stack:** React 18 + TypeScript, Zustand(persistミドルウェアなし), Vitest, react-i18next。

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-07-21-housing-browse-random-order-scroll-restore-design.md`(矛盾したら設計書を優先して確認)。
- ランダム表示順の変更対象は**探すページのみ**。お気に入り・ハウジンガープロフィールページの並び順UIは変更しない。
- スクロール位置復元の対象は**探す・お気に入り・ハウジンガープロフィールの3画面**。
- 住所順グルーピング(`sortListingsForGallery`)は関数自体を削除しない(お気に入り・ハウジンガープロフィール・ストア初期化で引き続き使用中)。
- push前ゲート: `npm run build && npx vitest run`(最終タスクで実行)。

---

### Task 1: 決定的シード付きシャッフルの純関数

**Files:**
- Create: `src/lib/housing/seededShuffle.ts`
- Test: `src/lib/housing/__tests__/seededShuffle.test.ts`

**Interfaces:**
- Produces: `shuffleWithSeed<T>(items: readonly T[], seed: number): T[]`(同じ seed + 同じ入力配列なら常に同じ順序を返す)

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/seededShuffle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { shuffleWithSeed } from '../seededShuffle';

describe('shuffleWithSeed', () => {
  it('同じ seed・同じ配列なら常に同じ順序を返す', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const r1 = shuffleWithSeed(input, 42);
    const r2 = shuffleWithSeed(input, 42);
    expect(r1).toEqual(r2);
  });

  it('異なる seed なら (十分な要素数で) 異なる順序になり得る', () => {
    const input = Array.from({ length: 20 }, (_, i) => i);
    const r1 = shuffleWithSeed(input, 1);
    const r2 = shuffleWithSeed(input, 2);
    expect(r1).not.toEqual(r2);
  });

  it('元の配列を破壊しない', () => {
    const input = ['a', 'b', 'c'];
    const copy = [...input];
    shuffleWithSeed(input, 7);
    expect(input).toEqual(copy);
  });

  it('要素数・要素自体は変わらない(順序だけが変わる)', () => {
    const input = ['a', 'b', 'c', 'd'];
    const result = shuffleWithSeed(input, 99);
    expect(result).toHaveLength(4);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it('空配列は空配列を返す', () => {
    expect(shuffleWithSeed([], 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/seededShuffle.test.ts`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/lib/housing/seededShuffle.ts`:

```ts
/**
 * 決定的 (deterministic) シャッフル。同じ seed + 同じ入力配列なら常に同じ順序を返す。
 * ハウジング探すページの「ランダム表示」で、アプリ内遷移(戻る・タブ切替)では
 * 再シャッフルせず同じ並びを保つために使う (seed 自体は非永続 store が持つ、
 * useHousingBrowseSessionStore 参照)。
 *
 * mulberry32 (軽量な seeded PRNG) + Fisher-Yates シャッフル。
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  const rand = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- [ ] **Step 4: テストを再実行して成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/seededShuffle.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/seededShuffle.ts src/lib/housing/__tests__/seededShuffle.test.ts
git commit -m "feat(housing): 決定的シード付きシャッフル純関数を追加"
```

---

### Task 2: 非永続セッションstore(ランダムseed + スクロール位置)

**Files:**
- Create: `src/store/useHousingBrowseSessionStore.ts`
- Test: `src/store/__tests__/useHousingBrowseSessionStore.test.ts`

**Interfaces:**
- Produces: `useHousingBrowseSessionStore` — `randomSeed: number`、`reshuffle(): void`、`getScrollPosition(key: string): number | undefined`、`setScrollPosition(key: string, value: number): void`。**persist ミドルウェアは使わない**(sessionStorage/localStorageに一切保存しない。JSメモリのみ、ブラウザの実リロードで自然に初期化される)。

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useHousingBrowseSessionStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingBrowseSessionStore } from '../useHousingBrowseSessionStore';

describe('useHousingBrowseSessionStore', () => {
  beforeEach(() => {
    // モジュールレベル store のため、テスト間で reshuffle 前の状態に依存しないようにリセット。
    useHousingBrowseSessionStore.setState({ randomSeed: 1, scrollPositions: {} });
  });

  it('reshuffle すると randomSeed が変わる', () => {
    const before = useHousingBrowseSessionStore.getState().randomSeed;
    useHousingBrowseSessionStore.getState().reshuffle();
    const after = useHousingBrowseSessionStore.getState().randomSeed;
    expect(after).not.toBe(before);
  });

  it('setScrollPosition/getScrollPosition がキーごとに独立して動く', () => {
    useHousingBrowseSessionStore.getState().setScrollPosition('browse', 120);
    useHousingBrowseSessionStore.getState().setScrollPosition('favorites', 50);
    expect(useHousingBrowseSessionStore.getState().getScrollPosition('browse')).toBe(120);
    expect(useHousingBrowseSessionStore.getState().getScrollPosition('favorites')).toBe(50);
  });

  it('未設定キーは undefined を返す', () => {
    expect(useHousingBrowseSessionStore.getState().getScrollPosition('unknown')).toBeUndefined();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/store/__tests__/useHousingBrowseSessionStore.test.ts`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/store/useHousingBrowseSessionStore.ts`:

```ts
import { create } from 'zustand';

interface HousingBrowseSessionState {
  /** 探すページのランダム表示順を決めるシード値。アプリ内遷移では変わらず、
   *  ブラウザの実リロードではこのモジュール自体が再評価されて新しい値になる。 */
  randomSeed: number;
  /** 能動的な「シャッフル」ボタン押下時に呼ぶ。 */
  reshuffle: () => void;
  /** listKey (例: 'browse' / 'favorites' / 'housinger:<uid>') ごとのスクロール位置。 */
  scrollPositions: Record<string, number>;
  setScrollPosition: (key: string, value: number) => void;
  getScrollPosition: (key: string) => number | undefined;
}

/**
 * 2026-07-21 追加 (実機FB: 表示順ランダム化+スクロール位置復元)。
 *
 * **意図的に persist ミドルウェアを使わない** (sessionStorage にも保存しない)。
 * React Router の SPA 内遷移 (詳細ページへ→戻る、タブ切替) は JS モジュールの状態を
 * 破棄しないため、このプレーンな store は「アプリ内遷移では値を保持し、ブラウザの
 * 実リロードでは自然に初期化される」という要件を追加の分岐なしに満たす。
 * 既存の useHousingViewStore/useHousingRandomStore (sessionStorage永続化) とは
 * 意図的に異なる実装。
 */
export const useHousingBrowseSessionStore = create<HousingBrowseSessionState>((set, get) => ({
  randomSeed: Date.now(),
  reshuffle: () => set({ randomSeed: Date.now() + Math.floor(Math.random() * 1_000_000) }),
  scrollPositions: {},
  setScrollPosition: (key, value) =>
    set((s) => ({ scrollPositions: { ...s.scrollPositions, [key]: value } })),
  getScrollPosition: (key) => get().scrollPositions[key],
}));
```

- [ ] **Step 4: テストを再実行して成功を確認**

Run: `npx vitest run src/store/__tests__/useHousingBrowseSessionStore.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingBrowseSessionStore.ts src/store/__tests__/useHousingBrowseSessionStore.test.ts
git commit -m "feat(housing): ランダムseed+スクロール位置の非永続storeを追加"
```

---

### Task 3: スクロール位置復元の共有フック

**Files:**
- Create: `src/lib/housing/useListScrollRestore.ts`
- Test: `src/lib/housing/__tests__/useListScrollRestore.test.tsx`

**Interfaces:**
- Consumes: Task2の `useHousingBrowseSessionStore`
- Produces: `useListScrollRestore(key: string, ready: boolean): React.RefObject<HTMLDivElement>`。呼び出し側はこの ref を実際のスクロールコンテナ div に渡す。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/useListScrollRestore.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useListScrollRestore } from '../useListScrollRestore';
import { useHousingBrowseSessionStore } from '../../../store/useHousingBrowseSessionStore';

function TestList({ listKey, ready }: { listKey: string; ready: boolean }) {
  const ref = useListScrollRestore(listKey, ready);
  return (
    <div ref={ref} data-testid="scroll-box" style={{ overflowY: 'auto', height: '100px' }}>
      <div style={{ height: '1000px' }} />
    </div>
  );
}

describe('useListScrollRestore', () => {
  beforeEach(() => {
    useHousingBrowseSessionStore.setState({ scrollPositions: {} });
  });

  it('保存済みのスクロール位置があれば ready=true になった時点で復元する', () => {
    useHousingBrowseSessionStore.getState().setScrollPosition('browse', 300);
    const { getByTestId } = render(<TestList listKey="browse" ready />);
    const box = getByTestId('scroll-box') as HTMLDivElement;
    expect(box.scrollTop).toBe(300);
  });

  it('保存済みの値が無ければ 0 のまま', () => {
    const { getByTestId } = render(<TestList listKey="favorites" ready />);
    const box = getByTestId('scroll-box') as HTMLDivElement;
    expect(box.scrollTop).toBe(0);
  });

  it('unmount 時に現在のスクロール位置を store へ保存する', () => {
    const { getByTestId, unmount } = render(<TestList listKey="housinger:abc" ready />);
    const box = getByTestId('scroll-box') as HTMLDivElement;
    box.scrollTop = 150;
    box.dispatchEvent(new Event('scroll'));
    unmount();
    expect(useHousingBrowseSessionStore.getState().getScrollPosition('housinger:abc')).toBe(150);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/useListScrollRestore.test.tsx`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: 実装**

`src/lib/housing/useListScrollRestore.ts`:

```ts
import { useEffect, useRef } from 'react';
import { useHousingBrowseSessionStore } from '../../store/useHousingBrowseSessionStore';

/**
 * 一覧→詳細→戻る、でスクロール位置を復元する共有フック(探す/お気に入り/
 * ハウジンガープロフィールの3画面で共用、2026-07-21 実機FB)。
 *
 * `ready` (= リストの描画が完了したか。読み込み中は false にする) が true になった
 * 最初のタイミングで一度だけ、保存済みのスクロール位置を復元する。unmount 時に
 * 現在のスクロール位置を保存する (画面離脱の理由 = 詳細へ遷移/他タブへ切替、どちらも
 * 同じ unmount で一律カバーする)。
 *
 * 呼び出し側は返り値の ref を、実際にスクロールする div (`.housing-listing-grid` 等) に
 * そのまま渡すこと。
 */
export function useListScrollRestore(key: string, ready: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!ready || restoredRef.current) return;
    const saved = useHousingBrowseSessionStore.getState().getScrollPosition(key);
    if (saved != null && containerRef.current) {
      containerRef.current.scrollTop = saved;
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, key]);

  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) {
        useHousingBrowseSessionStore.getState().setScrollPosition(key, el.scrollTop);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return containerRef;
}
```

- [ ] **Step 4: テストを再実行して成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/useListScrollRestore.test.tsx`
Expected: PASS(全件)

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/useListScrollRestore.ts src/lib/housing/__tests__/useListScrollRestore.test.tsx
git commit -m "feat(housing): スクロール位置復元の共有フックを追加"
```

---

### Task 4: `BrowseSortSelect.tsx` に「ランダム」を追加(選択肢を可変に)

**Files:**
- Modify: `src/components/housing/browse/BrowseSortSelect.tsx`
- Test: `src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx`(既存が無ければ新規作成)

**Interfaces:**
- Produces: `BrowseSortOrder = 'random' | 'newest' | 'oldest'`。`BrowseSortSelectProps` に `orders?: BrowseSortOrder[]`(既定 `['newest', 'oldest']` = 後方互換、HousingerPage 等は無指定のまま変更不要)。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { BrowseSortSelect } from '../BrowseSortSelect';

describe('BrowseSortSelect', () => {
  it('orders 未指定なら従来通り新着順/古い順の2択のみ (ランダムは出ない)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect value="newest" onChange={vi.fn()} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button', { expanded: false } as any));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('orders=["random","newest","oldest"] なら3択になる', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect value="random" onChange={vi.fn()} orders={['random', 'newest', 'oldest']} />
      </I18nextProvider>,
    );
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx`
Expected: FAIL(`random` 型・`orders` prop が無い)

- [ ] **Step 3: 実装変更**

`src/components/housing/browse/BrowseSortSelect.tsx` の1-12行目を置き換え:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';

export type BrowseSortOrder = 'random' | 'newest' | 'oldest';

export interface BrowseSortSelectProps {
  value: BrowseSortOrder;
  onChange: (v: BrowseSortOrder) => void;
  /** 表示する選択肢 (既定は従来通り新着順/古い順の2択、後方互換)。 */
  orders?: BrowseSortOrder[];
}

const DEFAULT_ORDERS: BrowseSortOrder[] = ['newest', 'oldest'];
```

`BrowseSortSelect` コンポーネント本体のシグネチャと `ORDERS` 参照箇所を変更:

```tsx
export const BrowseSortSelect: React.FC<BrowseSortSelectProps> = ({ value, onChange, orders = DEFAULT_ORDERS }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const labelOf = (o: BrowseSortOrder) => t(`housing.browse.sort_${o}`);

  return (
    <div className="housing-sort" ref={rootRef} data-open={open ? 'true' : 'false'}>
      <span className="housing-sort-label">{t('housing.browse.sort_label')}</span>
      <button
        type="button"
        className="housing-sort-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{labelOf(value)}</span>
        <ChevronDown size={14} aria-hidden="true" className="housing-sort-chevron" />
      </button>
      {open && (
        <ul className="housing-sort-menu" role="listbox" aria-label={t('housing.browse.sort_label')}>
          {orders.map((o) => (
            <li key={o}>
              <button
                type="button"
                role="option"
                aria-selected={value === o}
                data-selected={value === o ? 'true' : 'false'}
                className="housing-sort-option"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
              >
                <span className="housing-sort-option-check" aria-hidden="true">
                  {value === o && <Check size={13} />}
                </span>
                {labelOf(o)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 4: i18nキー追加(4言語、`housing.browse.sort_random`)**

`src/locales/ja.json` の `housing.browse` ブロック(既存 `sort_newest`/`sort_oldest` の近く)に追記:

```json
        "sort_random": "ランダム",
```

`src/locales/en.json`:

```json
        "sort_random": "Random",
```

`src/locales/ko.json`:

```json
        "sort_random": "랜덤",
```

`src/locales/zh.json`:

```json
        "sort_random": "随机",
```

- [ ] **Step 5: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx`
Expected: PASS(全件)

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/browse/BrowseSortSelect.tsx src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): BrowseSortSelectにランダム選択肢を追加(orders prop化)"
```

---

### Task 5: `ListingGrid.tsx` にシャッフルボタン + スクロールref配線

**Files:**
- Modify: `src/components/housing/browse/ListingGrid.tsx`
- Test: `src/components/housing/browse/__tests__/ListingGrid.test.tsx`(既存が無ければ新規作成)

**Interfaces:**
- Consumes: Task4の `BrowseSortSelect`(orders prop)
- Produces: `ListingGridProps` に `orders?`/`onShuffle?`/`gridRef?` を追加。`sort==='random' && onShuffle` のときだけシャッフルボタンを表示。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/__tests__/ListingGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../../i18n';
import { ListingGrid } from '../ListingGrid';

describe('ListingGrid: シャッフルボタン', () => {
  it('sort=random かつ onShuffle が渡されていればシャッフルボタンが出る', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ListingGrid listings={[]} sort="random" onSortChange={vi.fn()} onShuffle={vi.fn()} orders={['random', 'newest', 'oldest']} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('housing-shuffle-button')).toBeInTheDocument();
  });

  it('sort=newest のときはシャッフルボタンが出ない', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <ListingGrid listings={[]} sort="newest" onSortChange={vi.fn()} onShuffle={vi.fn()} />
      </I18nextProvider>,
    );
    expect(screen.queryByTestId('housing-shuffle-button')).toBeNull();
  });

  it('シャッフルボタン押下で onShuffle が呼ばれる', () => {
    const onShuffle = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <ListingGrid listings={[]} sort="random" onSortChange={vi.fn()} onShuffle={onShuffle} orders={['random', 'newest', 'oldest']} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByTestId('housing-shuffle-button'));
    expect(onShuffle).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingGrid.test.tsx`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/components/housing/browse/ListingGrid.tsx` を全体置き換え:

```tsx
import { useTranslation } from 'react-i18next';
import type { Ref } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from './ListingCard';
import { BrowseSortSelect, type BrowseSortOrder } from './BrowseSortSelect';

export interface ListingGridProps {
  listings: MockListing[];
  /** 未指定ならカードの「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  sort: BrowseSortOrder;
  onSortChange: (v: BrowseSortOrder) => void;
  /** BrowseSortSelect に渡す選択肢。既定は新着順/古い順の2択 (後方互換)。 */
  orders?: BrowseSortOrder[];
  /** 2026-07-21 追加: 「🔀 シャッフル」ボタン押下時。未指定なら描画しない (探すページのみ渡す)。 */
  onShuffle?: () => void;
  /** 2026-07-21 追加: スクロール位置復元用の ref (useListScrollRestore の返り値をそのまま渡す)。 */
  gridRef?: Ref<HTMLDivElement>;
}

/**
 * 探すページ中央のグリッド。上部ツールバー = 「ハウジング一覧 N件」見出し + 並び替え。
 */
export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onAddToTour,
  sort,
  onSortChange,
  orders,
  onShuffle,
  gridRef,
}) => {
  const { t } = useTranslation();
  return (
    <div className="housing-listing-grid-wrap">
      <div className="housing-listing-grid-toolbar">
        <h2 className="housing-listing-grid-heading">
          {t('housing.browse.listings_label')}
          <span className="housing-listing-grid-count">
            {t('housing.browse.count_unit', { count: listings.length })}
          </span>
        </h2>
        <div className="housing-listing-grid-toolbar-actions">
          {sort === 'random' && onShuffle && (
            <button
              type="button"
              className="housing-shuffle-button"
              data-testid="housing-shuffle-button"
              onClick={onShuffle}
              aria-label={t('housing.browse.shuffle')}
            >
              🔀 {t('housing.browse.shuffle')}
            </button>
          )}
          <BrowseSortSelect value={sort} onChange={onSortChange} orders={orders} />
        </div>
      </div>
      <div className="housing-listing-grid" ref={gridRef}>
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: i18nキー追加(4言語、`housing.browse.shuffle`)**

`src/locales/ja.json` の `housing.browse` ブロックに追記:

```json
        "shuffle": "シャッフル",
```

`src/locales/en.json`:

```json
        "shuffle": "Shuffle",
```

`src/locales/ko.json`:

```json
        "shuffle": "섞기",
```

`src/locales/zh.json`:

```json
        "shuffle": "随机排序",
```

- [ ] **Step 5: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingGrid.test.tsx`
Expected: PASS(全件)

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/browse/ListingGrid.tsx src/components/housing/browse/__tests__/ListingGrid.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): ListingGridにシャッフルボタン+スクロールref配線を追加"
```

---

### Task 6: `BrowsePage.tsx` にランダム表示順+スクロール復元を統合

**Files:**
- Modify: `src/components/housing/pages/BrowsePage.tsx`
- Test: `src/components/housing/pages/__tests__/BrowsePage.test.tsx`(既存が無ければ新規作成。既存のBrowsePageテストがあれば追記)

**Interfaces:**
- Consumes: Task1 `shuffleWithSeed`、Task2 `useHousingBrowseSessionStore`、Task3 `useListScrollRestore`、Task4/5の `BrowseSortSelect`/`ListingGrid` 変更

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/pages/__tests__/BrowsePage.test.tsx` に追記(既存ファイルの render ヘルパー・ストアモックに合わせて実装者が調整すること。以下は検証したい振る舞いの仕様):

```tsx
describe('BrowsePage: 表示順ランダム化 (Batch2並行機能)', () => {
  it('初期表示の並び替えは "random" になっている', () => {
    // ListingGrid に渡される sort prop (またはBrowseSortSelectの選択状態) が
    // 'random' であることを検証する。
  });

  it('新着順を選ぶと createdAt 降順になる', () => {
    // BrowseSortSelect で newest を選択 → 一覧の順序が createdAt 降順になることを検証。
  });
});
```

> 実装者への注記: 既存 `BrowsePage.test.tsx`(無ければこのタスクで新規作成)の store モック方法(`useHousingListingsStore`/`useHousingFilterStore` 等)を先に `Read`/`Grep` で確認し、それに合わせて具体的なテストコードを実装すること。

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/pages/__tests__/BrowsePage.test.tsx`
Expected: FAIL(現状は `newest` 固定初期値のため)

- [ ] **Step 3: `BrowsePage.tsx` を変更**

import 追加(ファイル先頭の import 群に追記):

```ts
import { useHousingBrowseSessionStore } from '../../../store/useHousingBrowseSessionStore';
import { shuffleWithSeed } from '../../../lib/housing/seededShuffle';
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';
```

90行目の `const [sort, setSort] = useState<BrowseSortOrder>('newest');` を置き換え:

```ts
  // 2026-07-21 変更: 既定を「ランダム」に (実機FB: 埋もれている物件も新鮮に見えるように)。
  // 住所順グルーピング (sortListingsForGallery) はデフォルトから外れるが、関数自体は
  // お気に入り/ハウジンガープロフィールで引き続き使用中のため削除しない。
  const [sort, setSort] = useState<BrowseSortOrder>('random');
  const randomSeed = useHousingBrowseSessionStore((s) => s.randomSeed);
  const reshuffle = useHousingBrowseSessionStore((s) => s.reshuffle);
```

91-97行目の `sorted` の `useMemo` を置き換え:

```ts
  const sorted = useMemo(() => {
    if (sort === 'random') return shuffleWithSeed(filtered, randomSeed);
    return [...filtered].sort((a, b) =>
      sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    );
  }, [filtered, sort, randomSeed]);

  // 2026-07-21 追加: 一覧→詳細→戻る、のスクロール位置復元。ready は「読み込み完了かつ
  // 表示件数が確定した」タイミング (loading 中に復元しても DOM が無くスクロールできないため)。
  const listReady = status === 'success' && filtered.length > 0;
  const gridRef = useListScrollRestore('browse', listReady);

  const handleShuffle = useCallback(() => {
    reshuffle();
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [reshuffle, gridRef]);
```

(`useCallback` が未importなら `useMemo, useState` の import 行に追加する。)

`<ListingGrid ...>` 呼び出し箇所 (193-198行目) を置き換え:

```tsx
                <ListingGrid
                  listings={sorted}
                  onAddToTour={addToTray}
                  sort={sort}
                  onSortChange={setSort}
                  orders={['random', 'newest', 'oldest']}
                  onShuffle={handleShuffle}
                  gridRef={gridRef}
                />
```

- [ ] **Step 4: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/pages/__tests__/BrowsePage.test.tsx`
Expected: PASS(全件)

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/pages/BrowsePage.tsx src/components/housing/pages/__tests__/BrowsePage.test.tsx
git commit -m "feat(housing): 探すページのデフォルト表示順をランダムに変更+スクロール復元を統合"
```

---

### Task 7: お気に入りページにスクロール位置復元を統合

**Files:**
- Modify: `src/components/housing/favorites/FavoritesGrid.tsx`
- Modify: `src/components/housing/pages/FavoritesPage.tsx:242-247`
- Test: `src/components/housing/favorites/__tests__/FavoritesGrid.test.tsx`

**Interfaces:**
- Consumes: Task3の `useListScrollRestore`
- Produces: `FavoritesGridProps` に `gridRef?: Ref<HTMLDivElement>` を追加。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/favorites/__tests__/FavoritesGrid.test.tsx` に追記(既存ファイルの構造に合わせる):

```tsx
it('gridRef を渡すと housing-listing-grid div に反映される', () => {
  const ref = { current: null } as React.RefObject<HTMLDivElement>;
  render(<FavoritesGrid listings={[]} selected={new Set()} onToggleSelect={vi.fn()} onAddToTour={vi.fn()} gridRef={ref} />);
  expect(ref.current).not.toBeNull();
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/housing/favorites/__tests__/FavoritesGrid.test.tsx`
Expected: FAIL(`gridRef` prop が存在しない)

- [ ] **Step 3: `FavoritesGrid.tsx` を変更**

全体を以下に置き換え:

```tsx
import type { Ref } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from '../browse/ListingCard';

export interface FavoritesGridProps {
  listings: MockListing[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAddToTour: (id: string) => void;
  /** 2026-07-21 追加: スクロール位置復元用の ref (useListScrollRestore の返り値)。 */
  gridRef?: Ref<HTMLDivElement>;
}

export const FavoritesGrid: React.FC<FavoritesGridProps> = ({
  listings,
  selected,
  onToggleSelect,
  onAddToTour,
  gridRef,
}) => {
  return (
    <div className="housing-listing-grid" data-testid="housing-favorites-grid" ref={gridRef}>
      {listings.map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          selectable
          selected={selected.has(l.id)}
          onToggleSelect={onToggleSelect}
          onAddToTour={onAddToTour}
        />
      ))}
    </div>
  );
};
```

- [ ] **Step 4: `FavoritesPage.tsx` に配線**

ファイル先頭の import 群に追記:

```ts
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';
```

`status`/`listings` が確定している箇所の近くで(コンポーネント本体、JSXの手前)追記:

```ts
  const favListReady = status === 'success' && listings.length > 0;
  const favGridRef = useListScrollRestore('favorites', favListReady);
```

242-247行目の `<FavoritesGrid ...>` 呼び出しに `gridRef={favGridRef}` を追加:

```tsx
              <FavoritesGrid
                listings={listings}
                selected={selected}
                onToggleSelect={handleToggleSelect}
                onAddToTour={handleAddToTour}
                gridRef={favGridRef}
              />
```

- [ ] **Step 5: テストを再実行して成功を確認**

Run: `npx vitest run src/components/housing/favorites/__tests__/FavoritesGrid.test.tsx`
Expected: PASS(全件)

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/favorites/FavoritesGrid.tsx src/components/housing/pages/FavoritesPage.tsx src/components/housing/favorites/__tests__/FavoritesGrid.test.tsx
git commit -m "feat(housing): お気に入りページにスクロール位置復元を統合"
```

---

### Task 8: ハウジンガープロフィールページにスクロール位置復元を統合

**Files:**
- Modify: `src/components/housing/pages/HousingerPage.tsx`

**Interfaces:**
- Consumes: Task3の `useListScrollRestore`(Task5で `ListingGrid` に追加済みの `gridRef` prop を利用)

- [ ] **Step 1: 実装(このページは `ListingGrid` を流用しており Task5 で `gridRef` prop が既に使えるため、新規テストは不要。既存の HousingerPage テストに回帰が無いことを確認するのみ)**

import 追加:

```ts
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';
```

`sort`/`setSort` の宣言(63行目付近)の直後に追記:

```ts
  const housingerListReady = listings.length > 0;
  const housingerGridRef = useListScrollRestore(`housinger:${uid}`, housingerListReady);
```

311行目の `<ListingGrid listings={sorted} sort={sort} onSortChange={setSort} />` を置き換え:

```tsx
            <ListingGrid listings={sorted} sort={sort} onSortChange={setSort} gridRef={housingerGridRef} />
```

(`orders`/`onShuffle` は渡さない = 既存の新着順/古い順2択のまま、シャッフルボタンも出ない。設計書「お気に入り・ハウジンガープロフィールの並び順UIは変更しない」に準拠。)

- [ ] **Step 2: 既存テストを実行して回帰がないことを確認**

Run: `npx vitest run src/__tests__/housing/HousingerPage.test.tsx`
Expected: 全件PASS

- [ ] **Step 3: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add src/components/housing/pages/HousingerPage.tsx
git commit -m "feat(housing): ハウジンガープロフィールページにスクロール位置復元を統合"
```

---

### Task 9: モバイル幅でのシャッフルボタン配置確認

**Files:**
- Modify: `src/styles/housing.css`(`.housing-listing-grid-toolbar-actions` 等、必要なトークンベースのスタイル追加)

**Interfaces:**
- 既存の housing デザイントークン(`--housing-*`)経由でスタイリングする(`.claude/rules/housing-design.md` 準拠、ハードコード禁止)。

- [ ] **Step 1: `.housing-listing-grid-toolbar-actions` のスタイルを追加**

`src/styles/housing.css` の `.housing-listing-grid-toolbar` 定義の近くに追記(既存の `.housing-sort` 周辺のトークンを流用):

```css
.housing-listing-grid-toolbar-actions {
  display: flex;
  align-items: center;
  gap: var(--housing-gap-sm, 8px);
  flex-wrap: wrap;
}

.housing-shuffle-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: var(--housing-btn-padding-sm, 6px 10px);
  border-radius: var(--housing-radius-sm, 8px);
  border: 1px solid var(--housing-divider);
  background: transparent;
  color: var(--housing-text-mute);
  cursor: pointer;
  transition: background-color 150ms ease;
}

.housing-shuffle-button:hover {
  background: var(--housing-panel-bg-solid);
}

@media (max-width: 768px) {
  .housing-listing-grid-toolbar {
    flex-wrap: wrap;
    gap: var(--housing-gap-sm, 8px);
  }
  .housing-listing-grid-toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }
}
```

> 実装者への注記: `--housing-gap-sm`/`--housing-btn-padding-sm`/`--housing-radius-sm` 等が既存トークンに無ければ、`housing.css` 冒頭の `.housing-workspace` トークン定義ブロックを確認し、既存の類似トークン名に置き換えること(新規トークンを個別コンポーネント側で定義しない、housing-design.md 準拠)。

- [ ] **Step 2: 実機確認(モバイル幅)**

CSS 1489x679 / DPR 2.58 (本人環境) と 375x812 (一般的なスマホ幅) の両方で、シャッフルボタンが並び替えセレクトと重ならず、タップしやすい位置にあることを目視確認する。可能であれば Playwright スクリーンショットを撮る。

- [ ] **Step 3: Commit**

```bash
git add src/styles/housing.css
git commit -m "style(housing): シャッフルボタンのモバイル配置スタイルを追加"
```

---

### Task 10: 最終ビルド・テストゲート

**Files:** なし(検証のみ)

- [ ] **Step 1: フルテストスイートを実行**

Run: `npx vitest run`
Expected: 全件PASS(既知の失敗中テスト[TopBar4+HousingWorkspace1・EphemeralAddPanel 7件]を除く)

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: 型エラー・ビルドエラーなし

- [ ] **Step 3: 手動確認チェックリストをユーザーに提示**

1. 探すページを開くとランダム順で表示される
2. 詳細ページを開いて「戻る」で並び順・スクロール位置が変わらない
3. ブラウザをリロードすると新しい並びになる
4. 「🔀 シャッフル」ボタンで並びが変わり先頭にスクロールする
5. 「新着順」「古い順」も選べて機能する
6. お気に入りページ・ハウジンガープロフィールページでも一覧→詳細→戻るでスクロール位置が復元する
7. スマホ幅でシャッフルボタンの位置が崩れていない
8. 英語モードで文言崩れがない

- [ ] **Step 4: Commit(必要なら最終調整分をまとめて)**

```bash
git status
```

---

## Self-Review メモ

- **設計書カバレッジ**: 決定的シャッフル(Task1)/非永続store(Task2)/スクロール復元フック(Task3)/ランダム選択肢追加(Task4)/シャッフルボタン(Task5)/探すページ統合(Task6)/お気に入り(Task7)/プロフィール(Task8)/モバイル配置(Task9)。設計書の「住所順は選択肢から廃止、関数は残す」は Task6 のコメントで明記、`sortListingsForGallery` 自体は未削除(お気に入り・プロフィールページ・ストア初期化で使用継続のため)。
- **型一貫性**: `BrowseSortOrder` に `'random'` を追加したことで `ListingGrid`/`BrowseSortSelect`/`BrowsePage`/`HousingerPage` 全ての型が一致するよう Task4-8 を通して確認した。`HousingerPage`/お気に入りは `orders`/`onShuffle` を渡さないため既存動作は変わらない。
- **スコープ確認**: ランダム表示順はTask6(探すページ)のみに適用。お気に入り(Task7)・プロフィール(Task8)はスクロール復元のみでソートUIは無変更。
