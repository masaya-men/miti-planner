# ハウジング ヘッダー横断検索 設計書 (2026-07-13)

対象ブランチ: `integration/housing-big3`。big3 リリース前ゲート ⑤ の実装設計。

## 0. 背景と目的

探すページのヘッダーには以前「グローバル検索窓」があったが、`value`/`onChange` の無い
**死んだプレースホルダー**だったため撤去された (commit `96005ef2`)。撤去で中央 TabBar 周りの
密度感が寂しくなった、という指摘 (実機FB 2026-07-13 セッション2 ⑤) を受け、
**本物のフリーワード横断検索**として復活させる。

### ユーザー合意事項 (brainstorming 2026-07-13)
- **案2 = 横断検索**を採用。1つの窓で「タイトル・説明文・テーマ/公式タグ名・住所・サーバー/DC/地域名」
  を網羅して探せる (「これいけるかな?を網羅して探す楽しさ」)。
- **ハウジンガー名も検索対象に含める** (LoPo に登録された情報は全部探せるのが自然、というユーザー判断)。
  ただしハウジンガー名は listing 本体に無く別コレクション (個人タグ) なので、
  **一覧本体のローカル検索 + ハウジンガー名の API 検索の2系統を1窓に束ねる**。
- **見せ方 = 絞り込み型 + ハウジンガー候補**: 打つと一覧が即絞られる。同じ語でハウジンガー名が
  ヒットしたら「〇〇さんの家を見る」候補を検索窓下に出し、押すとその人の家に絞る。
- **スコープ (重要)**: 今回は**ヘッダー横断検索の追加のみ**。フィルター内の
  `PersonalTagFilter` (ハウジンガー名検索窓) の撤去と、通報ボタンの行き場の判断は
  **本番で PF/通報を実機確認した後のフォローアップ**とする (今回は触らない)。
  → 一時的に「ヘッダー横断検索」と「フィルター内ハウジンガー窓」が両方存在するが、
    通報導線を壊さないための意図的な措置。
- **リリース制約**: 本機能は新機能。build + test 緑まで自走し、**本番 push/merge/deploy は行わない**。
  dev で動く状態にしてユーザーのローカル実機確認に回す。

## 1. スコープ

### やること
1. `useHousingFilterStore` に検索キーワード状態 `keyword` を追加。
2. 検索テキスト組み立て + マッチ判定の純関数 (`lib/housing/listingSearch.ts`) を新設。
3. keyword で一覧を絞る共通フック (`useKeywordFilteredListings`) を新設し、
   BrowsePage (表示) と FilterPanel (件数) の両方に効かせる。
4. `AppHeader` に検索窓を復活 (探すページ限定表示) + ハウジンガー候補ドロップダウン。
5. i18n 4言語キー追加。
6. 単体テスト (listingSearch) + store テスト。

### やらないこと (今回スコープ外)
- `PersonalTagFilter` の撤去 (フォローアップ)。
- 通報ボタンの移設/削除 (フォローアップ)。
- 地図モード (`BrowseMapView`) 側の keyword 反映は**やる** (下記 3.4 参照。filtered を共有するため自然に効く)。
- ハウジンガー候補からの「まとめてツアー」等の追加導線 (既存 PersonalTagFilterLink に委ねる)。

## 2. データと既存資産 (確認済み・引用)

- listing 型 `MockListing`: `title?` `description?` `tags: string[]` `area` `ward` `plot?`
  `buildingType?` `apartmentBuilding?` `roomNumber?` `server` `dc` `region`
  ([src/data/housing/mockListings.ts:13-77](../../../src/data/housing/mockListings.ts))。
  mock 生成は `description` を必ず持つ (`gen` 108行)、`title` は optional (未生成のことがある)。
- `applyFilters(listings, condition)` は純関数。dc/regions/servers/areas/sizes/tags を AND
  ([src/lib/housing/applyFilters.ts](../../../src/lib/housing/applyFilters.ts))。**このファイルは変更しない**。
- タグ表示名: `getTagById(id)?.i18nKey` → `t(i18nKey)`。個人タグ (`personal_`) は静的レジストリに
  無く `getTagById` が undefined を返す ([src/data/housingTags.ts:118](../../../src/data/housingTags.ts))。
- 住所表示名: `formatHousingAddress(addr, lang)` → 例 "ミスト・ヴィレッジ 23-6"
  ([src/lib/housing/formatHousingAddress.ts:31](../../../src/lib/housing/formatHousingAddress.ts))。
- 地域表示名: `regionLabel(region, locale)` / `REGION_LABELS`
  ([src/data/housing/regionMap.ts:12](../../../src/data/housing/regionMap.ts))。locale は 'ja'|'en'|'ko'|'zh'。
- ハウジンガー名検索: `searchPersonalTags(query): Promise<PersonalTag[]>` — 公開 API・認証不要
  ([src/lib/personalTagApiClient.ts:25](../../../src/lib/personalTagApiClient.ts))。
  `PersonalTag = { id, displayName, displayNameLower, ownerUid, ... }`。
  クリックで `toggleTag(tag.id)` すれば `applyFilters` が `listing.tags` でその個人タグを含む家に絞る
  (既存挙動。PersonalTagFilter と同じ)。
- 探すページのルート: `/housing` の index = `BrowsePage` ([src/App.tsx:98-99](../../../src/App.tsx))。
- 撤去前の検索窓マークアップ (commit `96005ef2` の削除分・器として流用):
  ```
  <div className="housing-app-search">
    <input type="search" className="housing-app-search-input"
      placeholder={t('housing.header.search_placeholder')} aria-label={...} />
  </div>
  ```
  位置は `[ブランド] [検索窓] [TabBar] [右]`。CSS クラス `.housing-app-search` /
  `.housing-app-search-input` が `housing.css` に残存しているか実装時に grep 確認
  (残っていれば流用、無ければ housing.css に追加)。

## 3. アーキテクチャ

### 3.1 状態: `useHousingFilterStore` の拡張
([src/store/useHousingFilterStore.ts](../../../src/store/useHousingFilterStore.ts))

```ts
interface HousingFilterState {
  // ...既存...
  keyword: string;                    // 追加
  setKeyword: (keyword: string) => void;  // 追加
}

// 初期値
keyword: '',
// アクション
setKeyword: (keyword) => set({ keyword }),
// clearAll に keyword: '' を追加
clearAll: () => set({ dc: null, regions: [], servers: [], areas: [], sizes: [], tags: [], keyword: '' }),
```

`FilterCondition` (applyFilters の引数型) には **keyword を足さない** (applyFilters を純粋に保つ)。

### 3.2 純関数: `src/lib/housing/listingSearch.ts` (新規)

検索テキスト組み立ては i18n の `t` と `lang` に依存するため、**依存を引数注入**して純関数に保つ
(単体テスト可能にする)。`t` はコンポーネント側の `useTranslation().t` を渡す。

```ts
import type { MockListing } from '../../data/housing/mockListings';
import { getTagById } from '../../data/housingTags';
import { formatHousingAddress } from './formatHousingAddress';
import { regionLabel, type RegionLocale } from '../../data/housing/regionMap';

type TFunc = (key: string) => string;

/**
 * listing 1件を「検索可能テキスト」(表示名を連結した小文字文字列) に変換する。
 * 検索対象: タイトル / 説明文 / 静的タグ(公式・季節・テーマ)の表示名 / 住所表示名 /
 *           サーバー名 / DC 名 / 地域表示名。個人タグ名はここには含めない (API 側で拾う)。
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
    const tag = getTagById(id);          // 個人タグは undefined → skip
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
 * keyword が空 (trim 後 0 文字) なら常に true (絞り込みなし)。
 */
export function matchesKeyword(searchText: string, keyword: string): boolean {
  const words = keyword.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => searchText.includes(w));
}
```

**注意 (安価モデル向け)**:
- `regionLabel` の第2引数 `locale` は `'ja'|'en'|'ko'|'zh'`。`lang` (i18n.language は "ja"/"en-US" 等) から
  `locale` を作るには、既存 `FilterPanel.tsx` の `pickLocale(language)` と同じロジックを使う
  (head 2文字を小文字化し en/ko/zh 以外は ja)。この `pickLocale` は現状 FilterPanel 内のローカル関数なので、
  **`src/data/housing/regionMap.ts` に `export function pickRegionLocale(language)` として切り出し**、
  FilterPanel と listingSearch の両方から使う (重複を作らない)。FilterPanel の既存 `pickLocale` は
  この共通関数を呼ぶよう置き換える。
- `t(tag.i18nKey)` はキー欠落時に**キー文字列をそのまま返す**ことがあるが、検索テキストに混じっても
  実害は小さい (誤ヒットはほぼ起きない)。厳密対応は不要。

### 3.3 共通フック: `src/lib/housing/useKeywordFilteredListings.ts` (新規)

BrowsePage と FilterPanel の両方で keyword 絞り込みを効かせる。`applyFilters` の**後段**に適用
(先に他条件で絞ってから keyword 判定 = searchText 組み立てコストを削減)。

```ts
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../data/housing/mockListings';
import { pickRegionLocale } from '../../data/housing/regionMap';
import { buildListingSearchText, matchesKeyword } from './listingSearch';

/** listings を keyword で絞る。keyword 空なら listings をそのまま返す。 */
export function useKeywordFilteredListings(listings: MockListing[], keyword: string): MockListing[] {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    if (keyword.trim().length === 0) return listings; // keyword 空 = 絞り込みなし
    const lang = i18n.language;
    const locale = pickRegionLocale(lang);
    return listings.filter((l) => matchesKeyword(buildListingSearchText(l, t, lang, locale), keyword));
  }, [listings, keyword, t, i18n.language]);
}
```

### 3.4 呼び出し側の変更

**BrowsePage.tsx** ([src/components/housing/pages/BrowsePage.tsx:59-62](../../../src/components/housing/pages/BrowsePage.tsx)):
```ts
const keyword = useHousingFilterStore((s) => s.keyword);   // 追加
const filteredBase = useMemo(
  () => applyFilters(merged, { dc, regions, servers, areas, sizes, tags }),
  [merged, dc, regions, servers, areas, sizes, tags],
);
const filtered = useKeywordFilteredListings(filteredBase, keyword);  // keyword 後段適用
```
`filtered` を使う既存箇所 (グリッド `sorted` の元、地図 `BrowseMapView`、`EmptyResult` 判定) は不変。
→ 地図モードにも自動で keyword が効く。

**FilterPanel.tsx** ([src/components/housing/workspace/FilterPanel.tsx:70-77](../../../src/components/housing/workspace/FilterPanel.tsx)):
```ts
const keyword = useHousingFilterStore((s) => s.keyword);   // 追加
const resultBase = useMemo(
  () => applyFilters(source, { dc, regions, servers, areas, sizes, tags }),
  [source, dc, regions, servers, areas, sizes, tags],
);
const result = useKeywordFilteredListings(resultBase, keyword);  // 件数バッジも keyword 反映
```
`setCounts(result.length, source.length)` は `result` を使う (keyword 反映後の件数)。

### 3.5 `AppHeader.tsx` の検索窓復活 + ハウジンガー候補

([src/components/housing/shell/AppHeader.tsx](../../../src/components/housing/shell/AppHeader.tsx))

追加する state / hooks:
```ts
import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { searchPersonalTags } from '../../../lib/personalTagApiClient';
import type { PersonalTag } from '../../../types/housing';

const location = useLocation();
const showSearch = location.pathname === '/housing';   // 探すページのみ (末尾スラッシュは router 正規化済)
const keyword = useHousingFilterStore((s) => s.keyword);
const setKeyword = useHousingFilterStore((s) => s.setKeyword);
const toggleTag = useHousingFilterStore((s) => s.toggleTag);
const [housingerHits, setHousingerHits] = useState<PersonalTag[]>([]);
const [dropdownOpen, setDropdownOpen] = useState(false);
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

ハウジンガー候補の取得 (PersonalTagFilter.tsx:28-53 と同じ debounce パターン):
```ts
useEffect(() => {
  if (!showSearch) return;                       // 探す以外では動かさない
  if (debounceRef.current) clearTimeout(debounceRef.current);
  const q = keyword.trim();
  if (q.length === 0) { setHousingerHits([]); return; }
  debounceRef.current = setTimeout(() => {
    searchPersonalTags(q)
      .then((tags) => setHousingerHits(tags.slice(0, 5)))   // 上位5件
      .catch(() => setHousingerHits([]));
  }, 300);
  return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
}, [keyword, showSearch]);
```

JSX (ブランドと TabBar の間に挿入。`showSearch` が false のときは `null`):
```tsx
{showSearch && (
  <div className="housing-app-search">
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
            onClick={() => {
              toggleTag(tag.id);          // その人の家に絞る (既存挙動)
              setDropdownOpen(false);
            }}
          >
            {t('housing.header.search_view_homes', { name: tag.displayName })}
          </button>
        ))}
      </div>
    )}
  </div>
)}
```

**外側クリックでドロップダウンを閉じる**: `housing-app-search` を `ref` で包み、
document mousedown リスナで外側判定 → `setDropdownOpen(false)`。実装は既存に同種パターンが
あれば流用、無ければ単純な useEffect + addEventListener。

**注意**: keyword は store 管理なので、探すページを離れて戻っても値が残る。
`showSearch=false` のページに移っても一覧側 (BrowsePage) はアンマウントされ、keyword は
次に探すに戻ったとき復元される。これは許容 (検索状態の保持)。気になる場合のクリアは
フォローアップ (今回スコープ外)。

### 3.6 CSS (`src/styles/housing.css`)

- `.housing-app-search` / `.housing-app-search-input`: 撤去前のスタイルが残っていれば流用。
  無ければ追加 (トークン経由・ハードコード禁止。既存の `.housing-input` を参考に、
  ヘッダー高さに収まる高さ + 角丸 + 半透明背景)。
- `.housing-app-search-dropdown` / `-head` / `.housing-app-search-housinger`: 新規。
  既存の `.housing-tag-picker-list` / `.housing-tag-picker-option`
  (PersonalTagFilter が使うドロップダウン) と**同じトークン**で揃える。
  位置は検索窓の下に `position: absolute` で重ねる (ヘッダーは他要素より前面。z-index はトークン)。
- ハウジング配下なので `.claude/rules/housing-design.md` の質感A案トークンに従う
  (濃紺フラット・honey/aether の2アクセント・装飾ピル禁止・色付き alert 箱禁止)。

## 4. i18n (4言語・`src/locales/{ja,en,ko,zh}.json` の `housing.header` 配下に追加)

`housing.header` オブジェクトが無ければ新設。既存の該当ブロックだけを textual 編集する
(全体 parse→stringify 禁止・[[feedback_locale_json_textual_edit]])。

| キー | ja | en | ko | zh |
|------|----|----|----|----|
| `housing.header.search_placeholder` | ハウジングを検索（名前・テーマ・住所…） | Search housing (name, theme, address…) | 하우징 검색 (이름·테마·주소…) | 搜索房屋（名称·主题·地址…） |
| `housing.header.search_housingers` | ハウジンガー | Housingers | 하우징어 | 房主 |
| `housing.header.search_view_homes` | {{name}} の家を見る | View {{name}}'s homes | {{name}} 님의 집 보기 | 查看 {{name}} 的房屋 |

ko/zh は仮訳。公開前の i18n parity テストが緑になることを最低条件とし、
訳語の質チェックはユーザー確認 (英/韓/中の目視項目) に回す。

## 5. テスト

### 5.1 `src/__tests__/housing/listingSearch.test.ts` (新規)
`t` は `(key: string) => key` の恒等 mock (タグ i18nKey がそのまま入る) か、
`housing.tag.official_cafe → 'カフェ'` の固定マップ mock を使う。

- `buildListingSearchText`:
  - title / description / server / dc が検索テキストに含まれる
  - 静的タグ (例 `official_cafe`) の表示名が含まれる
  - 個人タグ (`personal_xxx`) は含まれない (getTagById undefined)
  - 住所 (formatHousingAddress の結果) が含まれる
  - 地域表示名 (例 JP→"日本") が含まれる
  - 全体が小文字化されている
- `matchesKeyword`:
  - 空文字 keyword → 常に true
  - 単語部分一致 (大文字小文字無視)
  - 複数語 AND (全語一致で true、1語でも外れると false)
  - 該当なし → false

### 5.2 `src/store/__tests__/useHousingFilterStore` (既存があれば追記、無ければ新規)
- `setKeyword` で keyword が更新される
- `clearAll` で keyword が '' に戻る

### 5.3 回帰
- `applyFilters.test.ts` は不変で緑のまま (applyFilters を変更しないため)。
- 既存の FilterPanel / BrowsePage テストがあれば緑を維持。keyword 未指定時は挙動不変
  (matchesKeyword('', '') === true で全通過)。

### 5.4 コンポーネントテスト (任意・時間があれば)
AppHeader の `showSearch` 分岐 (探すページで検索窓表示 / 他ルートで非表示) は
既存のルーティングテストパターンがあれば追加。無ければ dev 目視に委ねる。

## 6. 受け入れ基準 (dev 目視チェックリスト・ユーザーがローカルで確認)

localhost:5173、探すページ (`/housing`)、要ハードリロード:
- [ ] ヘッダーのブランドと TabBar の間に検索窓が出る (TabBar 中央配置が崩れない)
- [ ] 「カフェ」で一覧が絞られる (タイトル/説明/テーマ・公式タグ名に「カフェ」を含む家)
- [ ] 「ミスト」でエリア一致、サーバー名/DC名/地域名 (例「日本」) でも一致
- [ ] 複数語 (例「カフェ 和風」) は AND (両方含む家だけ)
- [ ] ハウジンガー名を打つと検索窓下に「〇〇 の家を見る」候補 → 押すとその人の家に絞る
      (中央に既存の「ハウジンガーページを見る →」リンクも出る)
- [ ] 空にすると全件に戻る / フィルターの「すべてクリア」で検索も消える
- [ ] 件数バッジ (フィルターパネル) が検索反映後の件数になる
- [ ] お気に入り/ツアー等 他ページのヘッダーには検索窓が出ない
- [ ] 英/韓/中で placeholder と候補見出しが正しい (parity)
- [ ] 地図モードでも keyword で絞られる

## 7. 変更ファイル一覧 (実装の全体像)

新規:
- `src/lib/housing/listingSearch.ts`
- `src/lib/housing/useKeywordFilteredListings.ts`
- `src/__tests__/housing/listingSearch.test.ts`

変更:
- `src/store/useHousingFilterStore.ts` (keyword/setKeyword/clearAll)
- `src/data/housing/regionMap.ts` (pickRegionLocale を export)
- `src/components/housing/workspace/FilterPanel.tsx` (pickLocale を共通関数へ + keyword 絞り込み)
- `src/components/housing/pages/BrowsePage.tsx` (keyword 絞り込み)
- `src/components/housing/shell/AppHeader.tsx` (検索窓 + ハウジンガー候補)
- `src/styles/housing.css` (検索窓/ドロップダウンのスタイル)
- `src/locales/{ja,en,ko,zh}.json` (housing.header の3キー)

## 8. リスクと非目標
- **非目標**: PersonalTagFilter 撤去・通報移設 (本番 PF 確認後のフォローアップ)。
- **リスク**: 検索テキストにタグ i18nKey がそのまま混じる欠落ケース → 実害小 (§3.2 注意)。
- **リスク**: keyword が探すページ離脱後も store に残る → 許容 (§3.5)。
- **パフォーマンス**: buildListingSearchText は絞り込み後の listing にのみ実行 (applyFilters 後段)。
  現状の登録数では問題なし。将来大量化したら searchText の事前計算/メモ化を検討 (今回不要)。
