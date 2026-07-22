# ハウジング一覧: 表示順ランダム化 + スクロール位置復元 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探すページ (BrowsePage) のデフォルト表示順を「ランダム」にし(新着順/古い順も選択可)、探す・お気に入り・ハウジンガープロフィールの3画面で「一覧→詳細→戻る」時にスクロール位置と並び順選択を復元する。ブラウザの実リロードまたはシャッフルボタン押下でのみランダム順を再抽選する。

**Architecture:** 新設の非永続 zustand ストア `useHousingListOrderStore` (`'browse'|'favorites'|'housinger'` の3キーで scrollTop/シード値/並び順選択を保持) を SPA 内で共有する。React Router の `Outlet` 切り替えではこのストアの JS メモリ上の値が残るため詳細ページ往復で状態が保持され、実リロードではモジュールごと初期化されるため新しくシャッフルされる。ランダム順は配列そのものを保存せず「シード値のみ」を保持し、表示のたびに `seededShuffle(現在のlistings, seed)` で決定的に再計算する。

**Tech Stack:** TypeScript / React / Zustand (非永続ストア) / vitest + @testing-library/react (happy-dom) / react-i18next

**設計書:** `docs/superpowers/specs/2026-07-21-housing-browse-random-order-scroll-restore-design.md`

## 設計書との差分 (実装前調査で判明・要記録)

設計書は「探すページの現在のデフォルト表示は `sortListingsForGallery` による住所順グループ化」としているが、これは**現在のコードと一致しない**。`BrowsePage.tsx:89-97`(および `HousingerPage.tsx:124-132`)は `sortListingsForGallery` の結果 (`merged`) を **さらに `.sort()` で `createdAt` 降順に上書き**しており、`sort` の初期値は `useState<BrowseSortOrder>('newest')`。つまり**現在の実際のデフォルトは既に「新着順」であり、住所順グループ化ではない**(`sortListingsForGallery` の呼び出し自体は残っているが、結果が常に後続の `.sort()` で上書きされるため事実上無効)。`HousingerPage.tsx:124-125` のコメント自体が「表示順は BrowseSortSelect の選択で上書きする」と明記しており、実装者も認識していた。

この差分により、設計要件「住所順を選択肢から廃止する」は**実質的に無風**(`BrowseSortSelect.tsx` の `ORDERS` は元々 `['newest', 'oldest']` の2択のみで、住所順という選択肢自体がUIに存在したことがない)。本計画での実質的な変更は「`'random'` を3つ目の選択肢として追加し、デフォルトにする」のみで、住所順を除去する作業は不要 (存在しないため)。`sortListingsForGallery` 関数自体は他の呼び出し元 (`FavoritesPage.tsx` の「すべて」タブ、`useHousingListingsStore.ts` 内の初期整形) で引き続き使われているため削除しない (設計書の指示どおり)。

## Global Constraints

- UIテキストは必ず i18n キー経由、ハードコード禁止。4言語 (ja/en/ko/zh) 同時追加・parity 維持。ロケールJSONは該当ブロックのみ textual 編集する。
- ハウジング画面 (`src/components/housing/**`, `src/styles/housing.css`) は独自トンマナ対象 (`.claude/rules/housing-design.md`)。色・寸法は必ず `--housing-*` トークン経由、`rgb()/rgba()/#hex/px` の直書き禁止 (housing.css 内の token 定義行を除く)。
- ランダム表示順 (デフォルト変更+シャッフルボタン) は **探すページのみ**が対象。お気に入り・ハウジンガープロフィールの並び順選択肢は変更しない (2択のまま)。スクロール位置復元は **探す・お気に入り・プロフィールの3画面共通**。
- vitest 実行は `npm test -- <path>` を使う (`npx vitest` は使わない)。出力は `> .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt` の形でファイルに落として Read で読む。**`| grep` 等へのパイプ禁止** (Windows で EPIPE→ハングする既知問題)。Bashツールの timeout を 70000ms 程度で必ず指定する。フルテスト実行 (Task 10) は 300000ms 程度を確保する。
- 新規ファイルは 2-space インデント (このリポジトリの housing 配下の主流)。既存ファイル編集時はそのファイル自身のインデントに合わせる (対象ファイルは全て 2-space 済み)。

---

### Task 1: BrowseSortSelect に random 選択肢を追加 + orders プロパティ化

**Files:**
- Modify: `src/components/housing/browse/BrowseSortSelect.tsx`
- Create: `src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

**Interfaces:**
- Produces: `BrowseSortOrder` 型に `'random'` が追加される (`'random' | 'newest' | 'oldest'`)。`BrowseSortSelectProps` に任意の `orders?: BrowseSortOrder[]` が追加され、未指定時は既存どおり `['newest', 'oldest']` の2択 (後方互換、ハウジンガーページは無変更で済む)。i18n キー `housing.browse.sort_random` / `housing.browse.shuffle_button` が4言語で追加される。
- Consumes: なし (このタスクが起点)。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { BrowseSortSelect } from '../BrowseSortSelect';

beforeAll(() => {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      lng: 'ja', fallbackLng: 'ja',
      resources: { ja: { translation: jaTranslations } },
      interpolation: { escapeValue: false },
    });
  }
});

describe('BrowseSortSelect', () => {
  it('orders 未指定なら新着順/古い順の2択のみ表示する (既存仕様のまま)', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect value="newest" onChange={() => {}} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.queryByRole('option', { name: /ランダム/ })).toBeNull();
  });

  it('orders=[random,newest,oldest] を渡すと3択表示する', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect
          value="random"
          onChange={() => {}}
          orders={['random', 'newest', 'oldest']}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(screen.getByRole('option', { name: /ランダム/ })).toBeInTheDocument();
  });

  it('option クリックで onChange が呼ばれる', () => {
    let picked: string | null = null;
    render(
      <I18nextProvider i18n={i18n}>
        <BrowseSortSelect
          value="random"
          onChange={(v) => { picked = v; }}
          orders={['random', 'newest', 'oldest']}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('option', { name: /新着順/ }));
    expect(picked).toBe('newest');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: `orders` prop が存在しない/`'random'` が型エラーで FAIL。

- [ ] **Step 3: BrowseSortSelect.tsx を実装**

`src/components/housing/browse/BrowseSortSelect.tsx` の内容を以下に置き換える:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check } from 'lucide-react';

export type BrowseSortOrder = 'random' | 'newest' | 'oldest';

export interface BrowseSortSelectProps {
  value: BrowseSortOrder;
  onChange: (v: BrowseSortOrder) => void;
  /**
   * 選択肢の一覧・表示順。未指定なら新着順/古い順の2択 (お気に入り/ハウジンガープロフィールの
   * 既存仕様)。探すページはランダムを含む3択を明示的に渡す (ランダム表示順は探すページのみの
   * 機能のため、他ページは何も変えずに済むようデフォルトを維持している)。
   */
  orders?: BrowseSortOrder[];
}

const DEFAULT_ORDERS: BrowseSortOrder[] = ['newest', 'oldest'];

/**
 * 中央ツールバーの並び替え (参考UI「並び替え: 新着順 ▼」)。
 * overflow パネル内でも安全なよう、短いメニューを下方向に絶対配置で開く。
 */
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

- [ ] **Step 4: ロケール4言語に追加**

`src/locales/ja.json` の `"browse"` ブロック内 (`"sort_label": "並び替え",` の行の直後・`"sort_newest": "新着順",` の直前) に以下を挿入し、さらに `"sort_oldest": "古い順"` (末尾行・カンマ無し) を書き換える:

```json
            "sort_label": "並び替え",
            "sort_random": "ランダム",
            "sort_newest": "新着順",
            "sort_oldest": "古い順",
            "shuffle_button": "シャッフル"
```

`src/locales/en.json` の `"browse"` ブロック、`"sort_label": "Sort",` 〜 `"sort_oldest": "Oldest"` を以下に置き換える:

```json
            "sort_label": "Sort",
            "sort_random": "Random",
            "sort_newest": "Newest",
            "sort_oldest": "Oldest",
            "shuffle_button": "Shuffle"
```

`src/locales/ko.json` の `"browse"` ブロック、`"sort_label": "정렬",` 〜 `"sort_oldest": "오래된순"` を以下に置き換える:

```json
            "sort_label": "정렬",
            "sort_random": "무작위",
            "sort_newest": "최신순",
            "sort_oldest": "오래된순",
            "shuffle_button": "셔플"
```

`src/locales/zh.json` の `"browse"` ブロック、`"sort_label": "排序",` 〜 `"sort_oldest": "最早"` を以下に置き換える:

```json
            "sort_label": "排序",
            "sort_random": "随机",
            "sort_newest": "最新",
            "sort_oldest": "最早",
            "shuffle_button": "随机排序"
```

各ファイルとも対象ブロック以外は変更しないこと (textual 編集)。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 6: Commit**

```bash
git add src/components/housing/browse/BrowseSortSelect.tsx src/components/housing/browse/__tests__/BrowseSortSelect.test.tsx src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): BrowseSortSelectにランダム選択肢とorders propを追加"
```

---

### Task 2: seededShuffle ユーティリティ

**Files:**
- Create: `src/lib/housing/seededShuffle.ts`
- Create: `src/lib/housing/__tests__/seededShuffle.test.ts`

**Interfaces:**
- Produces: `seededShuffle<T>(items: readonly T[], seed: number): T[]` (同じ items 内容 + seed なら常に同じ並びを返す純関数、元配列は変更しない)。`generateShuffleSeed(): number` (新しいシード値を生成)。
- Consumes: なし。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/seededShuffle.test.ts` を新規作成:

```typescript
import { describe, it, expect } from 'vitest';
import { seededShuffle, generateShuffleSeed } from '../seededShuffle';

describe('seededShuffle', () => {
  it('同じ seed なら常に同じ並びを返す', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = seededShuffle(items, 42);
    const b = seededShuffle(items, 42);
    expect(a).toEqual(b);
  });

  it('seed が違えば並びが変わる (十分な要素数で偶然一致しない)', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const a = seededShuffle(items, 1);
    const b = seededShuffle(items, 2);
    expect(a).not.toEqual(b);
  });

  it('元配列を変更しない', () => {
    const items = [1, 2, 3];
    const original = [...items];
    seededShuffle(items, 7);
    expect(items).toEqual(original);
  });

  it('要素数・要素の集合は保たれる (並びだけ変わる)', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const shuffled = seededShuffle(items, 99);
    expect(shuffled.length).toBe(items.length);
    expect([...shuffled].sort()).toEqual([...items].sort());
  });

  it('空配列で空配列を返す', () => {
    expect(seededShuffle([], 1)).toEqual([]);
  });
});

describe('generateShuffleSeed', () => {
  it('整数を返す', () => {
    const seed = generateShuffleSeed();
    expect(Number.isInteger(seed)).toBe(true);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/lib/housing/__tests__/seededShuffle.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: モジュールが存在せず FAIL。

- [ ] **Step 3: 実装**

`src/lib/housing/seededShuffle.ts` を新規作成:

```typescript
/**
 * seed から決定的な Fisher-Yates シャッフルを行う (mulberry32 PRNG)。
 * 同じ items (内容配列) + seed なら常に同じ並びを返す。元配列は変更しない。
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed >>> 0;
  const nextRandom = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** シャッフル用の新しいシード値を生成する (0〜0xffffffff の整数)。 */
export function generateShuffleSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/lib/housing/__tests__/seededShuffle.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/seededShuffle.ts src/lib/housing/__tests__/seededShuffle.test.ts
git commit -m "feat(housing): シード値からの決定的シャッフルユーティリティを追加"
```

---

### Task 3: useHousingListOrderStore (非永続ストア)

**Files:**
- Create: `src/store/useHousingListOrderStore.ts`
- Create: `src/__tests__/housing/useHousingListOrderStore.test.ts`

**Interfaces:**
- Consumes: `BrowseSortOrder` (Task 1 の `src/components/housing/browse/BrowseSortSelect.tsx`)。`FavTab` (`src/components/housing/favorites/favoritesOrder.ts`、既存・変更なし)。`generateShuffleSeed` (Task 2 の `src/lib/housing/seededShuffle.ts`)。
- Produces: `HousingListKey` 型 (`'browse' | 'favorites' | 'housinger'`)。`useHousingListOrderStore` (zustand フック)。state 形状 `entries: Record<HousingListKey, { seed: number; scrollTop: number; sortMode: BrowseSortOrder; favTab: FavTab }>`。既定値: `browse.sortMode = 'random'`、`housinger.sortMode = 'newest'`、`favorites.favTab = 'all'`、全キー `scrollTop = 0`。アクション: `setScrollTop(key, value)` / `setSortMode(key, mode)` / `setFavTab(key, tab)` / `reshuffle(key)` (seed を再生成) / `reset()` (テスト用・全キーを初期状態に戻す。seed は新規生成)。
  - **各エントリの全フィールドは全キーで共有される形状だが、実際に読まれるのは画面ごとに異なる**: `seed`/ランダム系は `browse` のみ使用、`favTab` は `favorites` のみ使用、`sortMode` は `browse`/`housinger` が使用 (`favorites` は未使用)。unused なフィールドも型を単純に保つため共通形状にしている。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/useHousingListOrderStore.test.ts` を新規作成:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingListOrderStore } from '../../store/useHousingListOrderStore';

describe('useHousingListOrderStore', () => {
  beforeEach(() => useHousingListOrderStore.getState().reset());

  it('browse の既定 sortMode は random, housinger は newest', () => {
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.sortMode).toBe('random');
    expect(entries.housinger.sortMode).toBe('newest');
  });

  it('scrollTop は3キーとも既定 0', () => {
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.scrollTop).toBe(0);
    expect(entries.favorites.scrollTop).toBe(0);
    expect(entries.housinger.scrollTop).toBe(0);
  });

  it('favorites の既定 favTab は all', () => {
    expect(useHousingListOrderStore.getState().entries.favorites.favTab).toBe('all');
  });

  it('setScrollTop は対象キーだけ更新する (他キーは不変)', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 250);
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.scrollTop).toBe(250);
    expect(entries.favorites.scrollTop).toBe(0);
  });

  it('setSortMode は対象キーの sortMode を更新する', () => {
    useHousingListOrderStore.getState().setSortMode('browse', 'oldest');
    expect(useHousingListOrderStore.getState().entries.browse.sortMode).toBe('oldest');
  });

  it('setFavTab は対象キーの favTab を更新する', () => {
    useHousingListOrderStore.getState().setFavTab('favorites', 'recent');
    expect(useHousingListOrderStore.getState().entries.favorites.favTab).toBe('recent');
  });

  it('reshuffle は seed を変える (同じ値になる確率は無視できるほど低い)', () => {
    const before = useHousingListOrderStore.getState().entries.browse.seed;
    useHousingListOrderStore.getState().reshuffle('browse');
    const after = useHousingListOrderStore.getState().entries.browse.seed;
    expect(after).not.toBe(before);
  });

  it('reshuffle は対象キー以外の seed を変えない', () => {
    const beforeFav = useHousingListOrderStore.getState().entries.favorites.seed;
    useHousingListOrderStore.getState().reshuffle('browse');
    expect(useHousingListOrderStore.getState().entries.favorites.seed).toBe(beforeFav);
  });

  it('reset は全キーを既定値に戻す', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 999);
    useHousingListOrderStore.getState().setSortMode('housinger', 'oldest');
    useHousingListOrderStore.getState().reset();
    const { entries } = useHousingListOrderStore.getState();
    expect(entries.browse.scrollTop).toBe(0);
    expect(entries.housinger.sortMode).toBe('newest');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/__tests__/housing/useHousingListOrderStore.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: モジュールが存在せず FAIL。

- [ ] **Step 3: 実装**

`src/store/useHousingListOrderStore.ts` を新規作成:

```typescript
import { create } from 'zustand';
import type { BrowseSortOrder } from '../components/housing/browse/BrowseSortSelect';
import type { FavTab } from '../components/housing/favorites/favoritesOrder';
import { generateShuffleSeed } from '../lib/housing/seededShuffle';

export type HousingListKey = 'browse' | 'favorites' | 'housinger';

interface HousingListOrderEntry {
  /** ランダム表示順を決めるシード値。'browse' のみ使用。 */
  seed: number;
  /** 離脱直前のスクロール位置 (px)。3 画面とも使用。 */
  scrollTop: number;
  /** 新着順/古い順/ランダムの選択。'browse'/'housinger' が使用 ('favorites' は未使用)。 */
  sortMode: BrowseSortOrder;
  /** お気に入りのタブ選択。'favorites' のみ使用。 */
  favTab: FavTab;
}

interface HousingListOrderState {
  entries: Record<HousingListKey, HousingListOrderEntry>;
  setScrollTop: (key: HousingListKey, value: number) => void;
  setSortMode: (key: HousingListKey, mode: BrowseSortOrder) => void;
  setFavTab: (key: HousingListKey, tab: FavTab) => void;
  /** ランダム順を再抽選する (シャッフルボタン押下時のみ呼ぶ)。 */
  reshuffle: (key: HousingListKey) => void;
  /** テスト用・および将来のリセット導線用: 全キーを初期状態に戻す (シードは新規生成)。 */
  reset: () => void;
}

const createInitialEntries = (): Record<HousingListKey, HousingListOrderEntry> => ({
  browse: { seed: generateShuffleSeed(), scrollTop: 0, sortMode: 'random', favTab: 'all' },
  favorites: { seed: generateShuffleSeed(), scrollTop: 0, sortMode: 'random', favTab: 'all' },
  housinger: { seed: generateShuffleSeed(), scrollTop: 0, sortMode: 'newest', favTab: 'all' },
});

/**
 * 探す/お気に入り/ハウジンガープロフィールの一覧順・スクロール位置を保持する非永続ストア。
 * 意図的に sessionStorage 永続化しない (useHousingViewStore 等とは異なる):
 * SPA内遷移 (詳細へ→戻る等) では JS メモリ上の値がそのまま残る = 再抽選されない。
 * ブラウザの実リロードではモジュールごと初期化される = 新しくシャッフルされる。
 * (設計書 docs/superpowers/specs/2026-07-21-housing-browse-random-order-scroll-restore-design.md)
 */
export const useHousingListOrderStore = create<HousingListOrderState>((set) => ({
  entries: createInitialEntries(),
  setScrollTop: (key, value) =>
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], scrollTop: value } } })),
  setSortMode: (key, mode) =>
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], sortMode: mode } } })),
  setFavTab: (key, tab) =>
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], favTab: tab } } })),
  reshuffle: (key) =>
    set((s) => ({
      entries: { ...s.entries, [key]: { ...s.entries[key], seed: generateShuffleSeed() } },
    })),
  reset: () => set({ entries: createInitialEntries() }),
}));
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/__tests__/housing/useHousingListOrderStore.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 5: Commit**

```bash
git add src/store/useHousingListOrderStore.ts src/__tests__/housing/useHousingListOrderStore.test.ts
git commit -m "feat(housing): 一覧順・スクロール位置を保持する非永続ストアを追加"
```

---

### Task 4: useListScrollRestore フック

**Files:**
- Create: `src/lib/housing/useListScrollRestore.ts`
- Create: `src/lib/housing/__tests__/useListScrollRestore.test.tsx`

**Interfaces:**
- Consumes: `useHousingListOrderStore` / `HousingListKey` (Task 3)。
- Produces: `useListScrollRestore(key: HousingListKey): React.RefObject<HTMLDivElement>`。返り値の ref をスクロールコンテナ (`overflow-y: auto` の要素) に付けると、マウント時に保存済み `scrollTop` を復元し、アンマウント時に現在の `scrollTop` を保存する。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/useListScrollRestore.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useListScrollRestore } from '../useListScrollRestore';
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
import type { HousingListKey } from '../../../store/useHousingListOrderStore';

function ScrollBox({ listKey }: { listKey: HousingListKey }) {
  const ref = useListScrollRestore(listKey);
  return (
    <div ref={ref} data-testid="scroll-box" style={{ height: '50px', overflow: 'auto' }}>
      <div style={{ height: '500px' }} />
    </div>
  );
}

describe('useListScrollRestore', () => {
  beforeEach(() => useHousingListOrderStore.getState().reset());
  afterEach(() => cleanup());

  it('マウント時、保存済み scrollTop が無ければ 0 のまま', () => {
    render(<ScrollBox listKey="browse" />);
    expect(screen.getByTestId('scroll-box').scrollTop).toBe(0);
  });

  it('アンマウント時に scrollTop をストアへ保存する', () => {
    const { unmount } = render(<ScrollBox listKey="browse" />);
    const el = screen.getByTestId('scroll-box');
    el.scrollTop = 120;
    unmount();
    expect(useHousingListOrderStore.getState().entries.browse.scrollTop).toBe(120);
  });

  it('再マウント時、保存済み scrollTop を復元する', () => {
    useHousingListOrderStore.getState().setScrollTop('browse', 240);
    render(<ScrollBox listKey="browse" />);
    expect(screen.getByTestId('scroll-box').scrollTop).toBe(240);
  });

  it('key ごとに独立して保存・復元する', () => {
    const browseRender = render(<ScrollBox listKey="browse" />);
    browseRender.getByTestId('scroll-box').scrollTop = 100;
    browseRender.unmount();

    const favRender = render(<ScrollBox listKey="favorites" />);
    expect(favRender.getByTestId('scroll-box').scrollTop).toBe(0);
    favRender.unmount();

    expect(useHousingListOrderStore.getState().entries.browse.scrollTop).toBe(100);
    expect(useHousingListOrderStore.getState().entries.favorites.scrollTop).toBe(0);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/lib/housing/__tests__/useListScrollRestore.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: モジュールが存在せず FAIL。

- [ ] **Step 3: 実装**

`src/lib/housing/useListScrollRestore.ts` を新規作成:

```typescript
import { useLayoutEffect, useRef } from 'react';
import { useHousingListOrderStore, type HousingListKey } from '../../store/useHousingListOrderStore';

/**
 * 一覧グリッドのスクロール位置を保存・復元する。マウント時に保存済み scrollTop を復元し、
 * アンマウント時 (詳細ページへの遷移等) の scrollTop を保存する。
 * 返り値の ref をスクロールコンテナ (overflow-y:auto の要素) に付けること。
 */
export function useListScrollRestore(key: HousingListKey) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = useHousingListOrderStore.getState().entries[key].scrollTop;
    return () => {
      useHousingListOrderStore.getState().setScrollTop(key, el.scrollTop);
    };
  }, [key]);

  return containerRef;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/lib/housing/__tests__/useListScrollRestore.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 5: Commit**

```bash
git add src/lib/housing/useListScrollRestore.ts src/lib/housing/__tests__/useListScrollRestore.test.tsx
git commit -m "feat(housing): 一覧グリッドのスクロール位置保存・復元フックを追加"
```

---

### Task 5: ListingGrid にシャッフルボタン + スクロール復元 + listKey 配線

**Files:**
- Modify: `src/components/housing/browse/ListingGrid.tsx`
- Modify: `src/styles/housing.css`

**Interfaces:**
- Consumes: `useHousingListOrderStore` (Task 3)、`useListScrollRestore` (Task 4)、`BrowseSortSelect` の `orders` prop (Task 1)。
- Produces: `ListingGridProps` に `listKey: HousingListKey` (必須) と `sortOrders?: BrowseSortOrder[]` (任意、`BrowseSortSelect` へそのまま転送) が追加される。`sort === 'random'` のときだけツールバーに「🔀 シャッフル」ボタンが表示され、押すと `useHousingListOrderStore.getState().reshuffle(listKey)` を呼び、グリッドの scrollTop を 0 に戻す。

このタスクには専用の自動テストを追加しない (振る舞いは Task 7 の BrowsePage 結合テストで検証する。ListingGrid 単体のテストファイルは元々存在しない)。

- [ ] **Step 1: ListingGrid.tsx を実装**

`src/components/housing/browse/ListingGrid.tsx` の内容を以下に置き換える:

```tsx
import { useTranslation } from 'react-i18next';
import { Shuffle } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from './ListingCard';
import { BrowseSortSelect, type BrowseSortOrder } from './BrowseSortSelect';
import { useHousingListOrderStore, type HousingListKey } from '../../../store/useHousingListOrderStore';
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';

export interface ListingGridProps {
  listings: MockListing[];
  /** 未指定ならカードの「ツアーに追加」ボタン自体を出さない (例: ハウジンガーページの一覧)。 */
  onAddToTour?: (id: string) => void;
  sort: BrowseSortOrder;
  onSortChange: (v: BrowseSortOrder) => void;
  /** スクロール位置の保存・復元、シャッフルボタンの対象キー。 */
  listKey: HousingListKey;
  /** BrowseSortSelect へ渡す選択肢一覧。未指定なら新着順/古い順の2択 (既存仕様)。 */
  sortOrders?: BrowseSortOrder[];
}

/**
 * 探すページ中央のグリッド (ハウジンガーページでも再利用)。上部ツールバー = 「ハウジング一覧 N件」見出し + 並び替え。
 * ビュー切替 [一覧|マップ|ルート] は地図配線 (M1) が済むまで出さない
 * (未配線の disabled タブは「壊れて見える」ため、実装スパンで復活させる)。
 */
export const ListingGrid: React.FC<ListingGridProps> = ({
  listings,
  onAddToTour,
  sort,
  onSortChange,
  listKey,
  sortOrders,
}) => {
  const { t } = useTranslation();
  const containerRef = useListScrollRestore(listKey);

  const onShuffle = () => {
    useHousingListOrderStore.getState().reshuffle(listKey);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

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
          {sort === 'random' && (
            <button
              type="button"
              className="housing-shuffle-btn"
              aria-label={t('housing.browse.shuffle_button')}
              onClick={onShuffle}
            >
              <Shuffle size={16} aria-hidden="true" />
            </button>
          )}
          <BrowseSortSelect value={sort} onChange={onSortChange} orders={sortOrders} />
        </div>
      </div>
      <div className="housing-listing-grid" ref={containerRef}>
        {listings.map((l) => (
          <ListingCard key={l.id} listing={l} onAddToTour={onAddToTour} />
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: housing.css にトークン準拠のスタイルを追加**

`src/styles/housing.css` の `.housing-sort-option-check { ... }` ブロック (既存、以下の内容) の直後に新規ブロックを追加する:

既存 (変更しない・アンカー確認用):
```css
.housing-sort-option-check {
  flex: 0 0 auto; width: 14px; display: inline-flex; color: var(--housing-honey);
}
```

その直後に以下を追加:

```css

/* ツールバー右側: シャッフルボタン + 並び替えセレクトのグループ (space-between の子を2つに保つ)。 */
.housing-listing-grid-toolbar-actions {
  display: inline-flex; align-items: center; gap: 8px;
  flex: 0 0 auto;
}
/* シャッフルボタン (ランダム表示中のみ表示・.housing-sort-trigger と同系の控えめな意匠)。 */
.housing-shuffle-btn {
  appearance: none; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  color: var(--housing-text-dim);
  background: var(--housing-panel-inner);
  border: 1px solid var(--housing-panel-border);
  border-radius: 9px;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}
.housing-shuffle-btn:hover,
.housing-shuffle-btn:focus-visible {
  color: var(--housing-text);
  border-color: var(--housing-honey-border);
  background: var(--housing-honey-soft);
}
.housing-shuffle-btn:active { transform: scale(0.95); }
```

- [ ] **Step 3: 型チェックが通ることを確認 (この時点では呼び出し元が未対応なため tsc は失敗する)**

Run: `npm test -- src/lib/housing/__tests__/seededShuffle.test.ts > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms、既存の無関係テストで vitest 自体が動くことだけ確認する簡易チェック)
Read で `.vt.txt` を確認。Expected: PASS (Task 2 のテストは ListingGrid に依存しないため無関係に緑のはず)。**ListingGrid を使う BrowsePage/HousingerPage/FavoritesGrid はまだ `listKey` を渡していないため、この時点で `npm run build` を実行すると型エラーになる。ビルド確認は Task 6/7/8 が全て完了してから (Task 10) 行う。**

- [ ] **Step 4: Commit**

```bash
git add src/components/housing/browse/ListingGrid.tsx src/styles/housing.css
git commit -m "feat(housing): ListingGridにシャッフルボタンとスクロール復元を追加"
```

---

### Task 6: FavoritesGrid にスクロール復元を配線

**Files:**
- Modify: `src/components/housing/favorites/FavoritesGrid.tsx`

**Interfaces:**
- Consumes: `useListScrollRestore` (Task 4、`listKey='favorites'` 固定で呼ぶ)。
- Produces: なし (props シグネチャは変更しない)。

- [ ] **Step 1: FavoritesGrid.tsx を実装**

`src/components/housing/favorites/FavoritesGrid.tsx` の内容を以下に置き換える:

```tsx
import type { MockListing } from '../../../data/housing/mockListings';
import { ListingCard } from '../browse/ListingCard';
import { useListScrollRestore } from '../../../lib/housing/useListScrollRestore';

export interface FavoritesGridProps {
  listings: MockListing[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onAddToTour: (id: string) => void;
}

/**
 * お気に入りページ中央グリッド。
 * ListingCard を selectable モードで並べる。
 * - 件数見出し / タブ: Task4 で追加
 * - 空状態: Task2 の FavoritesPage が担うため、ここは非空前提
 * - グリッドレイアウトは探すと共通の housing-listing-grid を再利用
 * - スクロール位置の保存・復元は 'favorites' キー固定 (このグリッドは常にお気に入り専用)。
 */
export const FavoritesGrid: React.FC<FavoritesGridProps> = ({
  listings,
  selected,
  onToggleSelect,
  onAddToTour,
}) => {
  const containerRef = useListScrollRestore('favorites');
  return (
    <div className="housing-listing-grid" data-testid="housing-favorites-grid" ref={containerRef}>
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

- [ ] **Step 2: Commit**

```bash
git add src/components/housing/favorites/FavoritesGrid.tsx
git commit -m "feat(housing): FavoritesGridにスクロール位置復元を配線"
```

(このタスクは Task 9 の FavoritesPage 結合テストで検証するため、専用テストは追加しない。)

---

### Task 7: BrowsePage をストア駆動のランダム表示順に配線

**Files:**
- Modify: `src/components/housing/pages/BrowsePage.tsx`
- Modify: `src/__tests__/housing/BrowsePage.test.tsx`
- Modify: `src/components/housing/pages/__tests__/BrowsePage.test.tsx`

**Interfaces:**
- Consumes: `useHousingListOrderStore` (Task 3)、`seededShuffle` (Task 2)、`ListingGrid` の `listKey`/`sortOrders` props (Task 5)。
- Produces: なし (このタスクで画面結線が完結)。

**重要な既存テストへの影響**: `src/components/housing/pages/__tests__/BrowsePage.test.tsx` の「BrowsePage: リージョン跨ぎの追加時ブロック」`describe` ブロック (line 69-155) は `mk('jp-1', ...)` / `mk('na-1', ...)` の2件を登録し、`screen.getAllByRole('button', { name: 'ツアーに追加' })` の **配列インデックス (`addButtons[0]`/`addButtons[1]`)** で「どちらが jp でどちらが na か」を識別している。両方とも `createdAt: Date.now()` で生成順に呼ばれるため、現在の実装 (デフォルト='newest'・Array.sort は安定ソート) では tie 時に生成順=jp が常に先頭になる。デフォルトが `'random'` に変わると、この配列インデックスの前提が壊れ、**テストが実行のたびにランダムに flaky 化する**。これを防ぐため、当該 `describe` の `beforeEach` で `useHousingListOrderStore.getState().setSortMode('browse', 'newest')` を呼び、明示的に決定的な並び順へ固定する (Step 1 でテストファイルを先に直す)。

- [ ] **Step 1: 既存テストの beforeEach を修正 (先に直しておく・regression 防止)**

`src/components/housing/pages/__tests__/BrowsePage.test.tsx` の import に以下を追加する (既存 import 群の直後):

```typescript
import { useHousingListOrderStore } from '../../../../store/useHousingListOrderStore';
```

同ファイルの「BrowsePage: リージョン跨ぎの追加時ブロック」describe (line 69-78 付近) の `beforeEach` を以下に置き換える:

```typescript
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingFavoritesStore.setState({ ids: [] });
    useEphemeralListingsStore.getState().clear();
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0 });
    useTourTrayStore.setState({ trayIds: [] });
    showToastMock.mockClear();
    // デフォルトが random になったことで addButtons[0]/[1] の順序保証が壊れないよう、
    // このブロックのテストは明示的に newest (生成順=安定ソート) へ固定する。
    useHousingListOrderStore.getState().reset();
    useHousingListOrderStore.getState().setSortMode('browse', 'newest');
  });
```

「BrowsePage: 中央フィルター解除ボタン (f)」describe の `beforeEach` (line 161-165 付近) に1行追加する:

```typescript
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] } as never);
    useHousingListOrderStore.getState().reset();
  });
```

「BrowsePage: スマホでは地図を強制的に一覧表示にする」describe の `beforeEach` (line 197-204 付近) にも同様に1行追加する:

```typescript
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingListingsStore.setState({ status: 'ready', listings: [], myListings: [] } as never);
    useHousingListOrderStore.getState().reset();
    // PC側で選択済みの 'map' を保ったまま、 スマホでは一覧強制になることを検証する。
    useHousingViewStore.getState().setBrowseView('map');
    vi.mocked(useIsMobile).mockReturnValue(true);
  });
```

`src/__tests__/housing/BrowsePage.test.tsx` にも import を追加し (既存 import 群の直後):

```typescript
import { useHousingListOrderStore } from '../../store/useHousingListOrderStore';
```

同ファイルの `beforeEach` (line 54-59) に1行追加する:

```typescript
beforeEach(() => {
  useHousingListingsStore.setState({ status: 'ready', listings: [mk('a'), mk('b')], error: null } as never);
  useHousingViewStore.getState().reset();
  useHousingFilterStore.getState().clearAll();
  useHousingListOrderStore.getState().reset();
  getPersonalTagByIdMock.mockReset();
});
```

- [ ] **Step 2: この時点でテストを実行し、まだ ListingGrid の listKey 必須化で型エラーになることを確認 (実装前の状態把握)**

Run: `npm test -- src/components/housing/pages/__tests__/BrowsePage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: FAIL (`BrowsePage.tsx` がまだ `ListingGrid` に `listKey` を渡していないため型エラー、または実行時に `sort`/`onSortChange` の食い違いで失敗)。

- [ ] **Step 3: BrowsePage.tsx を実装**

`src/components/housing/pages/BrowsePage.tsx` の import 群 (line 1-30) に以下を追加する (`import { PERSONAL_TAG_ID_PREFIX } from '../../../constants/housing';` の直後):

```typescript
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
import { seededShuffle } from '../../../lib/housing/seededShuffle';
```

`src/components/housing/pages/BrowsePage.tsx:89-97` の以下のブロック:

```tsx
  // 並び替え (参考UI「新着順/古い順」)。createdAt を key に client-side sort。
  const [sort, setSort] = useState<BrowseSortOrder>('newest');
  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
      ),
    [filtered, sort],
  );
```

を以下に置き換える:

```tsx
  // 並び替え。既定はランダム (2026-07-21 実機FB)。シード値/選択自体は useHousingListOrderStore が
  // 保持するため、詳細ページ往復 (SPA nav) では再抽選されない。実リロードまたはシャッフルボタンでのみ変わる。
  const sort = useHousingListOrderStore((s) => s.entries.browse.sortMode);
  const seed = useHousingListOrderStore((s) => s.entries.browse.seed);
  const setSort = (v: BrowseSortOrder) => useHousingListOrderStore.getState().setSortMode('browse', v);
  const sorted = useMemo(() => {
    if (sort === 'random') return seededShuffle(filtered, seed);
    return [...filtered].sort((a, b) =>
      sort === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    );
  }, [filtered, sort, seed]);
```

`src/components/housing/pages/BrowsePage.tsx:193-198` の以下のブロック:

```tsx
                <ListingGrid
                  listings={sorted}
                  onAddToTour={addToTray}
                  sort={sort}
                  onSortChange={setSort}
                />
```

を以下に置き換える:

```tsx
                <ListingGrid
                  listings={sorted}
                  onAddToTour={addToTray}
                  sort={sort}
                  onSortChange={setSort}
                  listKey="browse"
                  sortOrders={['random', 'newest', 'oldest']}
                />
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/components/housing/pages/__tests__/BrowsePage.test.tsx src/__tests__/housing/BrowsePage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 5: 新規テストを追加 (ランダム既定値・シャッフルボタンの表示条件)**

`src/components/housing/pages/__tests__/BrowsePage.test.tsx` の末尾、ファイル最後の `describe` ブロックの直後に以下を新規追加する:

```typescript
describe('BrowsePage: 表示順ランダム化 (2026-07-21 実機FB)', () => {
  beforeEach(() => {
    useHousingFilterStore.getState().clearAll();
    useHousingViewStore.getState().reset();
    useHousingListOrderStore.getState().reset();
    const jp1 = mk('r-1', 'JP', 'Elemental', 'Aegis');
    const jp2 = mk('r-2', 'JP', 'Gaia', 'Ifrit');
    useHousingListingsStore.setState({ status: 'ready', listings: [jp1, jp2], myListings: [] } as never);
  });

  it('既定の並び替え選択は random (シャッフルボタンが表示される)', () => {
    renderPage();
    expect(document.querySelector('.housing-shuffle-btn')).not.toBeNull();
  });

  it('新着順に切り替えるとシャッフルボタンが消える', () => {
    renderPage();
    // トリガーボタンのアクセシブルネームは現在値の表示テキスト (既定 random ='ランダム')。
    // 「並び替え」ラベルは兄弟要素の <span> でボタンの外側にあるため、ボタン名としては使えない。
    fireEvent.click(screen.getByRole('button', { name: 'ランダム' }));
    fireEvent.click(screen.getByRole('option', { name: '新着順' }));
    expect(document.querySelector('.housing-shuffle-btn')).toBeNull();
  });

  it('シャッフルボタン押下で reshuffle が呼ばれる (seed が変わる)', () => {
    renderPage();
    const before = useHousingListOrderStore.getState().entries.browse.seed;
    fireEvent.click(document.querySelector('.housing-shuffle-btn') as HTMLElement);
    const after = useHousingListOrderStore.getState().entries.browse.seed;
    expect(after).not.toBe(before);
  });
});
```

- [ ] **Step 6: 新規テストが通ることを確認**

Run: `npm test -- src/components/housing/pages/__tests__/BrowsePage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 7: Commit**

```bash
git add src/components/housing/pages/BrowsePage.tsx src/components/housing/pages/__tests__/BrowsePage.test.tsx src/__tests__/housing/BrowsePage.test.tsx
git commit -m "feat(housing): BrowsePageの表示順をストア駆動のランダム既定に切り替え"
```

---

### Task 8: HousingerPage をストア駆動の並び順選択に配線 (ランダムは追加しない)

**Files:**
- Modify: `src/components/housing/pages/HousingerPage.tsx`
- Modify: `src/__tests__/housing/HousingerPage.test.tsx`

**Interfaces:**
- Consumes: `useHousingListOrderStore` (Task 3)、`ListingGrid` の `listKey` prop (Task 5)。
- Produces: なし。

**スコープ確認**: HousingerPage の並び替え選択肢は「新着順/古い順」の2択のまま変更しない (`ListingGrid` に `sortOrders` を渡さない = Task 1 の `DEFAULT_ORDERS` が使われる)。変更するのは「選択した並び順・スクロール位置が、詳細ページ往復で保持されるようにする」ことのみ。

- [ ] **Step 1: 既存テストの beforeEach にストアリセットを追加 (孤立性のための予防的措置)**

`src/__tests__/housing/HousingerPage.test.tsx` の import に以下を追加する (既存 import 群の直後):

```typescript
import { useHousingListOrderStore } from '../../store/useHousingListOrderStore';
```

同ファイルの `beforeEach` (line 97-103) を以下に置き換える:

```typescript
beforeEach(() => {
  mockGetHousingerProfile.mockReset();
  mockGetHousingerListings.mockReset();
  showToastMock.mockClear();
  authUid = null;
  useHousingTourStore.getState().reset();
  useHousingListOrderStore.getState().reset();
});
```

- [ ] **Step 2: テストを実行し、ListingGrid の listKey 必須化でまだ失敗することを確認**

Run: `npm test -- src/__tests__/housing/HousingerPage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: FAIL (型エラーまたは実行時エラー)。

- [ ] **Step 3: HousingerPage.tsx を実装**

`src/components/housing/pages/HousingerPage.tsx` の import 群に以下を追加する (`import '../../../styles/housing.css';` の直前):

```typescript
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
```

`src/components/housing/pages/HousingerPage.tsx:63` の以下の行:

```tsx
  const [sort, setSort] = useState<BrowseSortOrder>('newest');
```

を削除し、代わりに (同じ位置、`const kebabRef = useRef<HTMLDivElement>(null);` の直後) 以下を追加する:

```tsx
  // 並び替え選択は探すページと共通のストアに保持する (詳細ページ往復で選択が保持される)。
  // ランダムは選択肢に含めない (探すページのみの機能、既存仕様どおり新着順/古い順の2択)。
  const sort = useHousingListOrderStore((s) => s.entries.housinger.sortMode);
  const setSort = (v: BrowseSortOrder) => useHousingListOrderStore.getState().setSortMode('housinger', v);
```

`src/components/housing/pages/HousingerPage.tsx:311` の以下の行:

```tsx
            <ListingGrid listings={sorted} sort={sort} onSortChange={setSort} />
```

を以下に置き換える:

```tsx
            <ListingGrid listings={sorted} sort={sort} onSortChange={setSort} listKey="housinger" />
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/__tests__/housing/HousingerPage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/pages/HousingerPage.tsx src/__tests__/housing/HousingerPage.test.tsx
git commit -m "feat(housing): HousingerPageの並び順選択をストアで保持(スクロール復元の前提)"
```

---

### Task 9: FavoritesPage をストア駆動のタブ選択に配線

**Files:**
- Modify: `src/components/housing/pages/FavoritesPage.tsx`
- Modify: `src/components/housing/pages/__tests__/FavoritesPage.test.tsx`

**Interfaces:**
- Consumes: `useHousingListOrderStore` (Task 3)、`FavoritesGrid` (Task 6、props シグネチャ変更なし)。
- Produces: なし。

- [ ] **Step 1: 既存テストの beforeEach にストアリセットを追加**

`src/components/housing/pages/__tests__/FavoritesPage.test.tsx` の import に以下を追加する (既存 import 群の直後):

```typescript
import { useHousingListOrderStore } from '../../../../store/useHousingListOrderStore';
```

同ファイルの `beforeEach` (line 87-93) を以下に置き換える:

```typescript
  beforeEach(() => {
    // ツアーストアをリセット
    useHousingTourStore.setState({ listingIds: [], running: false, currentIndex: 0 });
    // ツアートレイストア(#5でページ横断保持に変更)を毎回クリア
    useTourTrayStore.setState({ trayIds: [] });
    showToastMock.mockClear();
    useHousingListOrderStore.getState().reset();
  });
```

- [ ] **Step 2: テストを実行し、FavoritesGrid の scrollTop wiring 追加で壊れていないことを事前確認**

Run: `npm test -- src/components/housing/pages/__tests__/FavoritesPage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: この時点では PASS のはず (FavoritesPage.tsx 自体はまだ未修正、Task 6 の FavoritesGrid 変更は props 互換なので影響なし)。PASS しなければ Task 6 の変更を見直す。

- [ ] **Step 3: FavoritesPage.tsx を実装**

`src/components/housing/pages/FavoritesPage.tsx` の import 群 (line 1-27) に以下を追加する (`import { resolveTourOrder } from '../../../lib/housing/resolveTourOrder';` の直後):

```typescript
import { useHousingListOrderStore } from '../../../store/useHousingListOrderStore';
```

`src/components/housing/pages/FavoritesPage.tsx:52` の以下の行:

```tsx
  const [tab, setTab] = useState<FavTab>('all');
```

を以下に置き換える:

```tsx
  // タブ状態 (すべて/最近追加)。探す/ハウジンガーと同じストアに保持し、詳細ページ往復で保持する。
  const tab = useHousingListOrderStore((s) => s.entries.favorites.favTab);
  const setTab = (v: FavTab) => useHousingListOrderStore.getState().setFavTab('favorites', v);
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/components/housing/pages/__tests__/FavoritesPage.test.tsx > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 70000ms)
Read で `.vt.txt` を確認。Expected: 全件 PASS、`EXIT=0`。

- [ ] **Step 5: Commit**

```bash
git add src/components/housing/pages/FavoritesPage.tsx src/components/housing/pages/__tests__/FavoritesPage.test.tsx
git commit -m "feat(housing): FavoritesPageのタブ選択をストアで保持(スクロール復元の前提)"
```

---

### Task 10: push 前ゲート (フルビルド + フルテスト)

**Files:** なし (検証のみ)

**Interfaces:** なし。

- [ ] **Step 1: フルビルド**

Run: `npm run build > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 180000ms)
Read で `.vt.txt` を確認。Expected: `EXIT=0`。型エラーが出た場合、Task 5〜9 で変更した箇所 (`ListingGrid` の呼び出し元全て= BrowsePage/HousingerPage が `listKey` を渡しているか) を確認する。

- [ ] **Step 2: フルテスト**

Run: `npm test > .vt.txt 2>&1; echo "EXIT=$?" >> .vt.txt`
(Bash tool timeout: 300000ms。**「絶対に守る実行手順」に従い、ハングしても timeout で確実に区切られる。再実行を繰り返さない。**)
Read で `.vt.txt` を確認。Expected: `EXIT=0`。既知の無関係 failure (EphemeralAddPanel 7件・環境依存で devサーバー起動時のみ緑) 以外に FAIL が無いことを確認する。もし本タスクの変更に起因する FAIL があれば、該当タスクに戻って原因調査する (systematic-debugging)。

- [ ] **Step 3: 完了報告**

全タスクの commit ログを `git log --oneline -12` で確認し、10 個のコミットが積まれていることを確認する。この時点で mainへのmerge/pushは行わない (ユーザーの承認を得てから)。

---

## 完了確認 (エンドユーザー視点・実機1周)

自動テストではカバーしきれない見た目・実機挙動を、デプロイ後に実機で確認する (ユーザー実施、design.md Step4 の要求どおり):

1. 探すページを開く→毎回(実リロード時)並び順が変わることを確認。
2. 詳細ページを開いて「戻る」→並び順が変わっていない・スクロール位置が離脱直前のままであることを確認。
3. 「🔀 シャッフル」ボタンを押す→並び順が変わり、一覧の先頭にスクロールし直されることを確認。
4. 「新着順」「古い順」に切り替える→シャッフルボタンが消えることを確認。「新着順」を選んだ状態で詳細→戻る、をしても「新着順」のままであることを確認。
5. お気に入りページ・ハウジンガープロフィールページでも、詳細→戻るでスクロール位置が保持されることを確認。
6. モバイル幅 (DevTools または実機) でシャッフルボタンの配置が崩れていないか確認。
7. 英語モードで「Shuffle」ボタン・「Random/Newest/Oldest」の並び替えメニューが崩れていないか確認。韓国語・中国語モードも同様に確認。
8. 既存の「探すページでツアーに追加」「お気に入りの一括追加」等、本タスクで触っていない機能が今まで通り動くことを確認。
