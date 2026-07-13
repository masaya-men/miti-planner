# ハウジング ヘッダー横断検索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 探すページのヘッダーに、タイトル/説明/タグ名/住所/サーバー・DC・地域名を横断するフリーワード検索を復活させ、同じ語でハウジンガー名がヒットしたら候補を出してその人の家に絞れるようにする。

**Architecture:** `applyFilters`(純関数)は不変のまま、keyword を別レイヤーで後段適用する。検索テキスト組み立て(表示名解決に i18n が必要)は純関数 + 依存注入で単体テスト可能にし、共通フックで BrowsePage(表示) と FilterPanel(件数) の両方に効かせる。ハウジンガー候補は既存 `searchPersonalTags` API を再利用。

**Tech Stack:** React + TypeScript + zustand (`useHousingFilterStore`) + react-i18next + vitest。

**設計書:** `docs/superpowers/specs/2026-07-13-housing-header-global-search-design.md`

## Global Constraints

- `src/lib/housing/applyFilters.ts` は**変更しない**。keyword を `FilterCondition` に足さない(純粋性維持)。
- ハウジング配下は独自トンマナ (`.claude/rules/housing-design.md`)。CSS はトークン経由・ハードコード禁止。
- i18n は 4言語 parity 必須。locale JSON は**該当ブロックだけ textual 編集**(全体 parse→stringify 禁止)。
- `PersonalTagFilter` の撤去・通報移設は**今回スコープ外**(触らない)。
- 各タスク末で build/test を緑にしてからコミット。最終は `npm run build`(tsc -b 厳密) + `npx vitest run` 緑。
- 本番 push / main マージ / firebase deploy は**行わない**(ユーザーのローカル確認ゲートに回す)。
- コミット先は `integration/housing-big3`。
- vitest は単一ファイル指定で実行 (`npx vitest run <path>`)。出力をパイプしない (vmThreads ハング回避)。

---

### Task 1: `pickRegionLocale` を共通化 (regionMap へ切り出し)

**Files:**
- Modify: `src/data/housing/regionMap.ts`
- Modify: `src/components/housing/workspace/FilterPanel.tsx:33-48`
- Test: `src/__tests__/housing/regionMap.test.ts` (無ければ新規)

**Interfaces:**
- Produces: `pickRegionLocale(language: string): RegionLocale` — i18n.language ("ja","en-US"等) を
  'ja'|'en'|'ko'|'zh' に正規化。Task 3/4 が使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/regionMap.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickRegionLocale } from '../../data/housing/regionMap';

describe('pickRegionLocale', () => {
  it('maps ja / en / ko / zh heads', () => {
    expect(pickRegionLocale('ja')).toBe('ja');
    expect(pickRegionLocale('en-US')).toBe('en');
    expect(pickRegionLocale('ko')).toBe('ko');
    expect(pickRegionLocale('zh-CN')).toBe('zh');
  });
  it('falls back to ja for unknown / empty', () => {
    expect(pickRegionLocale('fr')).toBe('ja');
    expect(pickRegionLocale('')).toBe('ja');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/regionMap.test.ts`
Expected: FAIL ("pickRegionLocale is not a function" 相当)

- [ ] **Step 3: 実装 (regionMap.ts に追加)**

`src/data/housing/regionMap.ts` の末尾に追加:
```ts
/** i18n.language を RegionLocale ('ja'|'en'|'ko'|'zh') に正規化。未知/空は ja。 */
export function pickRegionLocale(language: string): RegionLocale {
    const head = (language || 'ja').slice(0, 2).toLowerCase();
    if (head === 'en' || head === 'ko' || head === 'zh') return head;
    return 'ja';
}
```

- [ ] **Step 4: FilterPanel のローカル `pickLocale` を置き換え**

`src/components/housing/workspace/FilterPanel.tsx`:
- import 行 (`regionMap` からの import) を `import { REGION_LABELS, type RegionLocale, pickRegionLocale } from '../../../data/housing/regionMap';` に変更 (既存の REGION_LABELS import と統合)。
- 33-37 行のローカル関数 `pickLocale` を**削除**。
- 48 行 `const locale = pickLocale(i18n.language);` を `const locale = pickRegionLocale(i18n.language);` に変更。

- [ ] **Step 5: テストが通ることを確認 + 型チェック**

Run: `npx vitest run src/__tests__/housing/regionMap.test.ts`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
rtk git add src/data/housing/regionMap.ts src/components/housing/workspace/FilterPanel.tsx src/__tests__/housing/regionMap.test.ts
rtk git commit -m "refactor(housing): pickRegionLocale を regionMap に共通化 (FilterPanel から切り出し)"
```

---

### Task 2: `useHousingFilterStore` に keyword を追加

**Files:**
- Modify: `src/store/useHousingFilterStore.ts`
- Test: `src/store/__tests__/useHousingFilterStore.test.ts` (無ければ新規)

**Interfaces:**
- Produces: store に `keyword: string` / `setKeyword(keyword: string): void`。`clearAll` が keyword も ''。
  Task 4/5/7 が読む/書く。

- [ ] **Step 1: 失敗するテストを書く**

`src/store/__tests__/useHousingFilterStore.test.ts` (既存なら該当 describe を追記):
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFilterStore } from '../useHousingFilterStore';

describe('useHousingFilterStore keyword', () => {
  beforeEach(() => useHousingFilterStore.getState().clearAll());
  it('setKeyword updates keyword', () => {
    useHousingFilterStore.getState().setKeyword('cafe');
    expect(useHousingFilterStore.getState().keyword).toBe('cafe');
  });
  it('clearAll resets keyword to empty', () => {
    useHousingFilterStore.getState().setKeyword('cafe');
    useHousingFilterStore.getState().clearAll();
    expect(useHousingFilterStore.getState().keyword).toBe('');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/store/__tests__/useHousingFilterStore.test.ts`
Expected: FAIL ("setKeyword is not a function")

- [ ] **Step 3: 実装**

`src/store/useHousingFilterStore.ts`:
- `interface HousingFilterState` に追加:
```ts
  keyword: string;
  setKeyword: (keyword: string) => void;
```
- 初期値に `keyword: '',` を追加。
- アクション追加: `setKeyword: (keyword) => set({ keyword }),`
- `clearAll` を更新: `clearAll: () => set({ dc: null, regions: [], servers: [], areas: [], sizes: [], tags: [], keyword: '' }),`

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/store/__tests__/useHousingFilterStore.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/store/useHousingFilterStore.ts src/store/__tests__/useHousingFilterStore.test.ts
rtk git commit -m "feat(housing): filter store に検索 keyword 状態を追加"
```

---

### Task 3: 検索純関数 `listingSearch.ts`

**Files:**
- Create: `src/lib/housing/listingSearch.ts`
- Test: `src/__tests__/housing/listingSearch.test.ts`

**Interfaces:**
- Consumes: `getTagById` (housingTags), `formatHousingAddress` (formatHousingAddress),
  `regionLabel` (regionMap), `MockListing` (mockListings), `RegionLocale` (regionMap)。
- Produces:
  - `buildListingSearchText(listing: MockListing, t: (k: string) => string, lang: string, locale: RegionLocale): string`
  - `matchesKeyword(searchText: string, keyword: string): boolean`
  Task 4 が使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/listingSearch.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildListingSearchText, matchesKeyword } from '../../lib/housing/listingSearch';
import type { MockListing } from '../../data/housing/mockListings';

// t mock: 静的タグ id をそのまま返す (housing.tag.official_cafe → 'housing.tag.official_cafe')
const tId = (k: string) => k;

const base: MockListing = {
  id: 'l1', ownerUid: 'u1', dc: 'Mana', server: 'Anima', region: 'JP',
  area: 'Mist', ward: 23, buildingType: 'house', plot: 6, size: 'M',
  imageMode: 'none', tags: ['official_cafe', 'personal_alice'],
  description: '静かな隠れ家カフェ', title: 'Cafe LoPo',
  createdAt: 0, lastConfirmedAt: 0, addressKey: 'k',
};

describe('buildListingSearchText', () => {
  const text = buildListingSearchText(base, tId, 'ja', 'ja');
  it('includes title and description (lowercased)', () => {
    expect(text).toContain('cafe lopo');       // title は小文字化
    expect(text).toContain('隠れ家カフェ');
  });
  it('includes static tag i18nKey but not personal tag', () => {
    expect(text).toContain('housing.tag.official_cafe');
    expect(text).not.toContain('personal_alice');
  });
  it('includes address, server, dc, region label', () => {
    expect(text).toContain('ミスト');           // formatHousingAddress の area 名
    expect(text).toContain('anima');            // server (小文字化)
    expect(text).toContain('mana');             // dc
    expect(text).toContain('日本');             // regionLabel(JP, ja)
  });
});

describe('matchesKeyword', () => {
  it('empty keyword always matches', () => {
    expect(matchesKeyword('anything', '')).toBe(true);
    expect(matchesKeyword('anything', '   ')).toBe(true);
  });
  it('single word partial match, case-insensitive', () => {
    expect(matchesKeyword('静かな隠れ家カフェ', 'カフェ')).toBe(true);
    expect(matchesKeyword('cafe lopo', 'CAFE')).toBe(true);
    expect(matchesKeyword('cafe lopo', 'tavern')).toBe(false);
  });
  it('multi-word AND', () => {
    expect(matchesKeyword('cafe wafu house', 'cafe wafu')).toBe(true);
    expect(matchesKeyword('cafe house', 'cafe wafu')).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/__tests__/housing/listingSearch.test.ts`
Expected: FAIL (モジュール未作成)

- [ ] **Step 3: 実装**

`src/lib/housing/listingSearch.ts`:
```ts
import type { MockListing } from '../../data/housing/mockListings';
import { getTagById } from '../../data/housingTags';
import { formatHousingAddress } from './formatHousingAddress';
import { regionLabel, type RegionLocale } from '../../data/housing/regionMap';

type TFunc = (key: string) => string;

/**
 * listing 1件を「検索可能テキスト」(表示名を連結した小文字文字列) に変換する。
 * 対象: タイトル / 説明文 / 静的タグ(公式・季節・テーマ)の表示名 / 住所表示名 /
 *       サーバー名 / DC 名 / 地域表示名。個人タグ名はここには含めない (API 側で拾う)。
 */
export function buildListingSearchText(
  listing: MockListing,
  t: TFunc,
  lang: string,
  locale: RegionLocale,
): string {
  const parts: string[] = [];
  if (listing.title) parts.push(listing.title);
  if (listing.description) parts.push(listing.description);
  for (const id of listing.tags) {
    const tag = getTagById(id);        // 個人タグは undefined → skip
    if (tag) parts.push(t(tag.i18nKey));
  }
  parts.push(
    formatHousingAddress(
      {
        area: listing.area,
        ward: listing.ward,
        buildingType: listing.buildingType,
        plot: listing.plot,
        apartmentBuilding: listing.apartmentBuilding,
        roomNumber: listing.roomNumber,
      },
      lang,
    ),
  );
  parts.push(listing.server);
  parts.push(listing.dc);
  parts.push(regionLabel(listing.region, locale));
  return parts.join(' ').toLowerCase();
}

/**
 * 検索テキストがキーワードに一致するか。複数語は空白区切りで AND、大文字小文字無視の部分一致。
 * keyword が空 (trim 後 0 文字) なら常に true。
 */
export function matchesKeyword(searchText: string, keyword: string): boolean {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => searchText.includes(w));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/__tests__/housing/listingSearch.test.ts`
Expected: PASS (全 assertion)

注: `ミスト` を含むかは formatHousingAddress の area 名解決に依存。もし area 名が
"ミスト・ヴィレッジ" なら `toContain('ミスト')` は通る。万一 mock の area 名が異なる場合は
テストの期待文字列を実際の `getAreaName('Mist','ja')` の戻り値に合わせる。

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/listingSearch.ts src/__tests__/housing/listingSearch.test.ts
rtk git commit -m "feat(housing): 横断検索の純関数 (検索テキスト組み立て + keyword マッチ)"
```

---

### Task 4: 共通フック `useKeywordFilteredListings`

**Files:**
- Create: `src/lib/housing/useKeywordFilteredListings.ts`

**Interfaces:**
- Consumes: `buildListingSearchText`, `matchesKeyword` (Task 3), `pickRegionLocale` (Task 1),
  `useTranslation`。
- Produces: `useKeywordFilteredListings(listings: MockListing[], keyword: string): MockListing[]`。
  Task 5 が使う。

- [ ] **Step 1: 実装 (薄いフック。ロジックは Task 3 のテスト済み純関数に委譲)**

`src/lib/housing/useKeywordFilteredListings.ts`:
```ts
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../data/housing/mockListings';
import { pickRegionLocale } from '../../data/housing/regionMap';
import { buildListingSearchText, matchesKeyword } from './listingSearch';

/** listings を keyword で絞る。keyword 空なら listings をそのまま返す。 */
export function useKeywordFilteredListings(
  listings: MockListing[],
  keyword: string,
): MockListing[] {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    if (keyword.trim().length === 0) return listings;
    const lang = i18n.language;
    const locale = pickRegionLocale(lang);
    return listings.filter((l) =>
      matchesKeyword(buildListingSearchText(l, t, lang, locale), keyword),
    );
  }, [listings, keyword, t, i18n.language]);
}
```

- [ ] **Step 2: 型チェック (このフックは build で検証。専用テストは Task 3 の純関数でカバー済み)**

Run: `npx tsc -b --noEmit` あるいは Task 5 と合わせて `npm run build` で確認。
Expected: 型エラーなし。

- [ ] **Step 3: コミット**

```bash
rtk git add src/lib/housing/useKeywordFilteredListings.ts
rtk git commit -m "feat(housing): keyword 絞り込み共通フック"
```

---

### Task 5: BrowsePage / FilterPanel に keyword を配線

**Files:**
- Modify: `src/components/housing/pages/BrowsePage.tsx:46-62`
- Modify: `src/components/housing/workspace/FilterPanel.tsx:50-77`

**Interfaces:**
- Consumes: `useKeywordFilteredListings` (Task 4), store `keyword` (Task 2)。

- [ ] **Step 1: BrowsePage を変更**

`src/components/housing/pages/BrowsePage.tsx`:
- import 追加: `import { useKeywordFilteredListings } from '../../../lib/housing/useKeywordFilteredListings';`
- store 購読を追加 (他の filter 購読の並びに): `const keyword = useHousingFilterStore((s) => s.keyword);`
- 59-62 の `filtered` useMemo を `filteredBase` にリネームし、直後に keyword 後段適用:
```ts
  const filteredBase = useMemo(
    () => applyFilters(merged, { dc, regions, servers, areas, sizes, tags }),
    [merged, dc, regions, servers, areas, sizes, tags],
  );
  const filtered = useKeywordFilteredListings(filteredBase, keyword);
```
`filtered` を使う既存箇所 (`sorted` の元 73-79、`BrowseMapView` 141、`EmptyResult` 判定 142) は**変更不要**。

- [ ] **Step 2: FilterPanel を変更**

`src/components/housing/workspace/FilterPanel.tsx`:
- import 追加: `import { useKeywordFilteredListings } from '../../../lib/housing/useKeywordFilteredListings';`
- store 購読を追加: `const keyword = useHousingFilterStore((s) => s.keyword);`
- 70-73 の `result` useMemo を `resultBase` にリネームし、直後に keyword 後段適用:
```ts
  const resultBase = useMemo(
    () => applyFilters(source, { dc, regions, servers, areas, sizes, tags }),
    [source, dc, regions, servers, areas, sizes, tags],
  );
  const result = useKeywordFilteredListings(resultBase, keyword);
```
`useEffect(() => setCounts(result.length, source.length), ...)` の依存はそのまま (`result.length` を見る)。

- [ ] **Step 3: build で回帰確認 (keyword 未入力時は挙動不変)**

Run: `npm run build`
Expected: 成功 (tsc 型エラーなし)。

- [ ] **Step 4: 既存の探す/フィルタ関連テストが緑か確認**

Run: `npx vitest run src/__tests__/housing/applyFilters.test.ts`
Expected: PASS (applyFilters 不変なので当然緑)。

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/pages/BrowsePage.tsx src/components/housing/workspace/FilterPanel.tsx
rtk git commit -m "feat(housing): 探す一覧と件数バッジに keyword 絞り込みを配線"
```

---

### Task 6: i18n 4言語キー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

**Interfaces:**
- Produces: `housing.header.search_placeholder` / `housing.header.search_housingers` /
  `housing.header.search_view_homes` (4言語)。Task 7 が使う。

- [ ] **Step 1: 各ロケールの `housing` オブジェクト内に `header` ブロックを追加**

各ファイルの `housing` 直下 (既存の同階層キー、例 `topbar` や `tabs` の近く) に、
`header` が無ければ新設して以下を追加。**既存ブロックを壊さず該当箇所だけ textual 編集**。

ja.json:
```json
    "header": {
      "search_placeholder": "ハウジングを検索（名前・テーマ・住所…）",
      "search_housingers": "ハウジンガー",
      "search_view_homes": "{{name}} の家を見る"
    },
```
en.json:
```json
    "header": {
      "search_placeholder": "Search housing (name, theme, address…)",
      "search_housingers": "Housingers",
      "search_view_homes": "View {{name}}'s homes"
    },
```
ko.json:
```json
    "header": {
      "search_placeholder": "하우징 검색 (이름·테마·주소…)",
      "search_housingers": "하우징어",
      "search_view_homes": "{{name}} 님의 집 보기"
    },
```
zh.json:
```json
    "header": {
      "search_placeholder": "搜索房屋（名称·主题·地址…）",
      "search_housingers": "房主",
      "search_view_homes": "查看 {{name}} 的房屋"
    },
```
注: `housing.header` が既存の場合はキー3つを既存 header 内に追記 (重複キーを作らない)。

- [ ] **Step 2: i18n parity テストが緑か確認**

Run: `npx vitest run src/locales`
Expected: PASS (4言語で同じキー集合)。もし parity テストのパスが違う場合は
`src/locales/__tests__/*-i18n-parity.test.ts` を指定。

- [ ] **Step 3: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(housing): ヘッダー横断検索の4言語キーを追加"
```

---

### Task 7: AppHeader に検索窓 + ハウジンガー候補

**Files:**
- Modify: `src/components/housing/shell/AppHeader.tsx`

**Interfaces:**
- Consumes: store `keyword`/`setKeyword`/`toggleTag` (Task 2 + 既存)、`searchPersonalTags` (既存)、
  i18n キー (Task 6)、`useLocation`。

- [ ] **Step 1: import と hooks を追加**

`src/components/housing/shell/AppHeader.tsx` 冒頭の import に追加:
```ts
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { searchPersonalTags } from '../../../lib/personalTagApiClient';
import type { PersonalTag } from '../../../types/housing';
```
(既存の `useNavigate` import 行に `useLocation` を足す形。`flushSync` 等既存 import は保持。)

コンポーネント本体の先頭 (既存 hooks の並び) に追加:
```ts
  const location = useLocation();
  const showSearch = location.pathname === '/housing';
  const keyword = useHousingFilterStore((s) => s.keyword);
  const setKeyword = useHousingFilterStore((s) => s.setKeyword);
  const toggleTag = useHousingFilterStore((s) => s.toggleTag);
  const [housingerHits, setHousingerHits] = useState<PersonalTag[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

- [ ] **Step 2: ハウジンガー候補の debounce effect + 外側クリックで閉じる effect を追加**

```ts
  useEffect(() => {
    if (!showSearch) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = keyword.trim();
    if (q.length === 0) { setHousingerHits([]); return; }
    debounceRef.current = setTimeout(() => {
      searchPersonalTags(q)
        .then((tags) => setHousingerHits(tags.slice(0, 5)))
        .catch(() => setHousingerHits([]));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [keyword, showSearch]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownOpen]);
```

- [ ] **Step 3: JSX にブランドと TabBar の間へ検索窓を挿入**

`<div className="housing-brand-wrap">…</div>` と `<TabBar />` の間に:
```tsx
      {showSearch && (
        <div className="housing-app-search" ref={searchWrapRef}>
          <input
            type="search"
            className="housing-app-search-input"
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setDropdownOpen(true); }}
            onFocus={() => setDropdownOpen(true)}
            placeholder={t('housing.header.search_placeholder')}
            aria-label={t('housing.header.search_placeholder')}
          />
          {dropdownOpen && keyword.trim().length > 0 && housingerHits.length > 0 && (
            <div className="housing-app-search-dropdown">
              <div className="housing-app-search-dropdown-head">
                {t('housing.header.search_housingers')}
              </div>
              {housingerHits.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="housing-app-search-housinger"
                  onClick={() => { toggleTag(tag.id); setDropdownOpen(false); }}
                >
                  {t('housing.header.search_view_homes', { name: tag.displayName })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: build で型チェック**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/shell/AppHeader.tsx
rtk git commit -m "feat(housing): ヘッダー横断検索窓 + ハウジンガー候補を復活 (探すページ限定表示)"
```

---

### Task 8: CSS (検索窓 + ドロップダウン)

**Files:**
- Modify: `src/styles/housing.css`

**Interfaces:**
- 使うトークン: 既存 `--housing-*` (パネル背景・divider・text・radius・z-index)。ハードコード禁止。

- [ ] **Step 1: 既存クラスの残存を確認**

Run: `rtk grep "housing-app-search" src/styles/housing.css`
- 残っていれば流用し、下記の dropdown 3クラスだけ追加。
- 無ければ `.housing-app-search` / `.housing-app-search-input` も追加。

- [ ] **Step 2: スタイルを追加 (housing.css の適切なヘッダー関連ブロック付近)**

既存 `.housing-input` / `.housing-tag-picker-list` / `.housing-tag-picker-option` を参照し、
同じトークンで以下を定義 (値はハードコードせず既存トークン var() を使う):
```css
/* ヘッダー横断検索 (探すページのみ) */
.housing-app-search {
  position: relative;
  flex: 0 1 clamp(180px, 22vw, 320px);
  min-width: 0;
}
.housing-app-search-input {
  /* .housing-input と同等 (高さ・背景・角丸・text 色はトークン経由)。width:100% */
}
.housing-app-search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: var(--housing-z-dropdown, 40); /* 既存 z トークンがあればそれを使う */
  /* 背景・border・radius・shadow は .housing-tag-picker-list と同じトークン */
}
.housing-app-search-dropdown-head {
  /* .housing-filter-field-label 相当の小見出し (mute 色) */
}
.housing-app-search-housinger {
  display: block;
  width: 100%;
  text-align: left;
  /* .housing-tag-picker-option と同じ padding / hover / text 色トークン */
}
```
**実装者への指示**: 上記コメントの「〜と同じトークン」は、参照先クラスの実際の
`var(--housing-*)` をコピーして具体値を埋める。新規ハードコード color/px を足さない。
`z-index` は housing.css 内の既存 z トークン (grep `--housing-z`) を使う。無ければ
既存ドロップダウン (`.housing-tag-picker-list`) の z 値に合わせる。

- [ ] **Step 3: レイアウト確認 (TabBar 中央維持)**

`.housing-app-header` が flex で `[brand][search][TabBar][right]` を並べる。
検索窓が入っても TabBar が中央に見えるよう、既存の TabBar 中央寄せ (margin:auto 等) を確認。
崩れる場合は検索窓を `flex: 0 1 …` (伸びない) にして中央バランスを保つ (上記で対応済み)。

- [ ] **Step 4: build**

Run: `npm run build`
Expected: 成功。

- [ ] **Step 5: コミット**

```bash
rtk git add src/styles/housing.css
rtk git commit -m "style(housing): ヘッダー検索窓 + 候補ドロップダウンのスタイル"
```

---

### Task 9: 全体緑ゲート + dev 起動確認

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: 成功 (tsc -b 厳密で未使用変数/型エラーなし)。

- [ ] **Step 2: 関連テスト一括**

Run: `npx vitest run src/__tests__/housing src/store/__tests__/useHousingFilterStore.test.ts src/locales`
Expected: 全 PASS。

- [ ] **Step 3: dev で読み込みエラーが無いことを確認 (ユーザー実機の前段)**

dev サーバー稼働中なら、コンソールに import/型エラーが出ていないか確認。
実機の見た目/操作確認は**ユーザーに引き継ぐ** (spec §6 チェックリスト)。

---

## Self-Review 結果

**Spec coverage:**
- §3.1 store keyword → Task 2 ✅
- §3.2 listingSearch 純関数 → Task 3 ✅
- §3.2 注意 pickRegionLocale 切り出し → Task 1 ✅
- §3.3 useKeywordFilteredListings → Task 4 ✅
- §3.4 BrowsePage/FilterPanel 配線 → Task 5 ✅
- §3.5 AppHeader 検索窓 + ハウジンガー候補 + 外側クリック → Task 7 ✅
- §3.6 CSS → Task 8 ✅
- §4 i18n 4言語 → Task 6 ✅
- §5 テスト → Task 1/2/3 に内包 ✅
- §6 受け入れ基準 → Task 9 で dev 起動 → ユーザー引き継ぎ ✅

**Placeholder scan:** CSS の「同じトークン」は実装者向けに参照先を明示 (grep 指示付き) = 具体的手順あり。TBD/TODO なし。

**Type consistency:** `pickRegionLocale`(Task1) / `buildListingSearchText`・`matchesKeyword`(Task3) /
`useKeywordFilteredListings`(Task4) のシグネチャは全タスクで一致。store の `keyword`/`setKeyword` 名も一致。
