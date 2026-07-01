# ハウジング お気に入りページ + 質感土台A案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 参考UIへ寄せた質感(A案)を全ハウジングページに適用しつつ、`/housing/favorites` お気に入りページを新構造で実装する。

**Architecture:** 質感は housing.css のトークン調整(veil濃く/パネル不透明化/liquid弱め)で全ページ一括変更。お気に入りは `HousingShell` の子ルートとして3カラム(左オンボーディング/中央グリッド/右トレイ)を新規実装。既存資産(FavoritesModal のロジック・ListingCard・TourTray・expandTourWithDuplicates)を昇格再利用。

**Tech Stack:** React 18 + TypeScript + Zustand + react-router-dom + react-i18next + Vitest。CSS = `src/styles/housing.css`(独自トンマナ・トークン経由)。

## Global Constraints

- **ハウジング独自トンマナ**: 白黒のみ/Inter禁止 等の LoPo ルールは**適用外**。ハニーゴールド+動画背景+ガラスで作る(`.claude/rules/housing-design.md`)。
- **ハードコード禁止**: 色/font-size/寸法/影は housing.css の `--housing-*` トークン経由。`style={{}}` に rgb/rgba/#hex/px 直書き禁止。最後に `rgb\(|rgba\(|#[0-9a-f]{3,8}|[0-9]px` grep 監査。
- **backdrop-filter 直書き禁止**: `blur(...)` リテラル不可。`var(--liquid-filter,none)` 等の変数参照はOK(`.claude/rules/css-rules.md`)。
- **i18n 4言語 parity**: 新規文言は `housing.favorites.*` で ja/en/ko/zh すべてに追加。ロケールJSONは該当ブロックのみ textual 編集(全体 parse→stringify 禁止)。
- **push 前**: `npm run build`(tsc -b 厳密・未使用変数/型不足が罠)+ `npx vitest run` 緑。
- **探すページ回帰なし**: `ListingCard`・BrowsePage の見た目/挙動を壊さない(prop 追加は非破壊)。
- **merge しない**: 登録ページ完成まで merge/デプロイ保留(TODO 既定)。ローカル確認のみ。
- **確認は実画面**: ユーザーは spec/plan を読まない。区切りで「見て」と声かけ。

---

## Task 1: 質感土台A案(全ページ共通・トークン調整)

視覚チューニング。厳密TDDでなく「トークン変更→build緑→実画面でユーザー確認→反復」。テストは回帰防止(build/render smoke)に限定。

**Files:**
- Modify: `src/styles/housing.css`(veil L227-230 / パネルトークン L24-27 / 必要なら BrowsePage の liquid scale)
- Modify: `src/components/housing/pages/BrowsePage.tsx:54,61,75`(LiquidGlassPanel の scale/edge を下げる場合)

**意図:** 動画背景を後退・パネルを落ち着いた面に・ハニー主/青選択を明確化。世界観(動画+ハニー)は署名として残す。

- [ ] **Step 1: 現状の該当CSSを再読**（憶測禁止）

Read `src/styles/housing.css` L20-70(トークン群), L227-230(veil), L380-460(.housing-panel と ::before/::after 光沢)。light テーマの veil/パネル override があれば併せて確認(grep `data-theme="light"` 周辺)。

- [ ] **Step 2: veil(暗幕)を濃くして動画を後退**

`.housing-scenery-veil`(L227-230)の gradient を引き上げる。開始値の目安:
```css
.housing-scenery-veil {
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.32), rgba(0, 0, 0, 0.5) 70%, rgba(0, 0, 0, 0.58));
}
```
light テーマで白飛びしないか要確認(light override があればそこも同方向に調整)。

- [ ] **Step 3: パネルを落ち着いた面へ(不透明度↑)**

`--housing-panel-bg`(L24)を上げる。現 `rgba(255,255,255,0.04)` は透けすぎ。参考UIの「濃紺の面」に寄せるため、白透過ではなく**暗い面**を新トークンで用意して panel 背景に使う:
```css
/* L24 付近に追加 */
--housing-panel-bg: rgba(20, 26, 38, 0.55);        /* 濃紺・半不透明。読みやすさ優先 */
--housing-panel-bg-solid: rgba(16, 22, 34, 0.72);  /* さらに濃い面(中央グリッド等) */
```
※実際の色相・不透明度は実画面で微調整。狙いは本文テキストが参考UI級に読めること。

- [ ] **Step 4: liquid glass の変位を弱める**

BrowsePage の `LiquidGlassPanel edge={160} scale={49}` を弱める(例 `scale={18} edge={120}`)。または `.housing-panel.is-liquid` の displacement 依存を減らす。光沢(`::before`/`::after`/corner/sheen)が強すぎる場合は不透明パネル上で控えめに。

- [ ] **Step 5: 2アクセントの確認**

主アクション(ツアー開始/登録/アクティブタブ)=ハニー、選択/進行/リンク=青(`--housing-aether` 系 or 機能青)。既存トークンで足りるか確認。不足なら選択用の青トークンを追加(例 `--housing-select: #4ea3ff` 系)。

- [ ] **Step 6: build + 探すページ render smoke**

Run: `npm run build`
Expected: 成功(tsc/vite エラーなし)。

既存の BrowsePage テストがあれば実行:
Run: `npx vitest run src/components/housing`
Expected: 既存緑を維持(質感変更で壊れない)。

- [ ] **Step 7: 実画面確認(ユーザー声かけ)**

`npm run dev` → `/housing`(探す)を開く。ユーザーに「探すページの質感A案を見て」と声かけ。OK が出るまで Step 2-5 を反復。**ここはゲート**:探すで質感が固まってからお気に入りに進む。

- [ ] **Step 8: Commit**

```bash
rtk git add src/styles/housing.css src/components/housing/pages/BrowsePage.tsx
rtk git commit -m "feat(housing): 質感土台A案(動画後退+パネル不透明化+2アクセント)を探すへ適用"
```

---

## Task 2: FavoritesPage の骨組みとルート

**Files:**
- Create: `src/components/housing/pages/FavoritesPage.tsx`
- Modify: `src/components/housing/shell/HousingShell` 周辺のルート定義(お気に入りルートを ComingSoon→FavoritesPage に差替。ルートは App.tsx か shell 付近 — 実装時に grep `housing/favorites` / `ComingSoonPage` で特定)
- Modify: 中央ローディング/エラー/空の i18n は既存 `housing.gallery.*` 流用
- Test: `src/components/housing/pages/__tests__/FavoritesPage.test.tsx`

**Interfaces:**
- Produces: `FavoritesPage: React.FC`(default export でなく named)。3カラム構成のオーケストレータ。
- Consumes: `useHousingFavoritesStore().ids`, `useHousingListingsStore().listings/status`。

- [ ] **Step 1: ルートの現状を特定**

Grep `favorites` と `ComingSoonPage` で、お気に入りタブが今どこで `ComingSoonPage` にルーティングされているか特定(App.tsx or shell)。TabBar の href も確認。

- [ ] **Step 2: 失敗するテストを書く(空状態)**

```tsx
// FavoritesPage.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FavoritesPage } from '../FavoritesPage';
import { useHousingFavoritesStore } from '../../../../store/useHousingFavoritesStore';

test('お気に入りが空なら空状態を表示', () => {
  useHousingFavoritesStore.setState({ ids: [] });
  render(<MemoryRouter><FavoritesPage /></MemoryRouter>);
  expect(screen.getByTestId('housing-favorites-empty')).toBeInTheDocument();
});
```

- [ ] **Step 3: 実行して落ちることを確認**

Run: `npx vitest run src/components/housing/pages/__tests__/FavoritesPage.test.tsx`
Expected: FAIL(FavoritesPage 未定義)。

- [ ] **Step 4: FavoritesPage 最小実装(3カラム枠+空状態)**

BrowsePage を雛形に、左/中央/右の `LiquidGlassPanel` 3カラムを作る。中央は favorites 空なら `data-testid="housing-favorites-empty"` の空状態、そうでなければ後続タスクの Grid を差す(この段階では件数見出しのみでよい)。左右は後続タスクで中身を足すプレースホルダ。

- [ ] **Step 5: テスト緑を確認**

Run: `npx vitest run src/components/housing/pages/__tests__/FavoritesPage.test.tsx`
Expected: PASS。

- [ ] **Step 6: ルート差替(ComingSoon→FavoritesPage)**

お気に入りルートを `FavoritesPage` に差替。`npm run dev` で `/housing/favorites` が3カラム枠で立つことを確認。

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/housing/pages/FavoritesPage.tsx src/components/housing/pages/__tests__/FavoritesPage.test.tsx <route file>
rtk git commit -m "feat(housing): お気に入りページの骨組み+ルート差替(3カラム枠/空状態)"
```

---

## Task 3: FavoriteGridCard(ListingCard 拡張)+ 中央グリッド

**Files:**
- Modify: `src/components/housing/browse/ListingCard.tsx`(optional 選択 props を非破壊追加)
- Create: `src/components/housing/favorites/FavoritesGrid.tsx`
- Test: `src/components/housing/browse/__tests__/ListingCard.test.tsx`(選択トグルの追加)

**Interfaces:**
- ListingCard 追加 props: `selectable?: boolean; selected?: boolean; onToggleSelect?: (id: string) => void;`。未指定なら現状の見た目/挙動を完全維持(探す回帰なし)。
- `FavoritesGrid: React.FC<{ listings: MockListing[]; selected: Set<string>; onToggleSelect: (id:string)=>void; onAddToTour: (id:string)=>void; }>`

- [ ] **Step 1: 失敗するテスト(選択トグルと♡の独立)**

```tsx
test('selectable時: チェックで onToggleSelect が呼ばれ、♡とは独立', () => {
  const onToggle = vi.fn();
  render(<ListingCard listing={mockListing} onAddToTour={()=>{}} selectable selected={false} onToggleSelect={onToggle} />);
  fireEvent.click(screen.getByTestId('housing-card-select'));
  expect(onToggle).toHaveBeenCalledWith(mockListing.id);
});
```
(mockListing は既存テストの雛形 or `mockListings` から1件)

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: FAIL(select ボックス無し)。

- [ ] **Step 3: ListingCard に選択チェックボックスを非破壊追加**

`selectable` が true のときだけ media 左上に `data-testid="housing-card-select"` のチェックボックスを描画。`selected` で `is-selected` クラス。クリックは `onToggleSelect(listing.id)`、♡ の onClick とは stopPropagation で分離。CSS は `.housing-card-select` を housing.css に追加(青=選択トークン)。

- [ ] **Step 4: テスト緑 + 既存 ListingCard テスト緑(回帰確認)**

Run: `npx vitest run src/components/housing/browse/__tests__/ListingCard.test.tsx`
Expected: PASS(新規+既存すべて)。

- [ ] **Step 5: FavoritesGrid 実装**

`ListingCard` を `selectable` で並べる。`contentVisibility` は ListingCard 側が既に持つ。空は Task2 の空状態が担うのでここは非空前提。

- [ ] **Step 6: FavoritesPage に Grid を結線**

FavoritesPage に `selected: Set<string>` state を持たせ、favorites(ids→listings)を Grid に渡す。dev で選択が青くトグルするのを確認。

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/housing/browse/ListingCard.tsx src/components/housing/favorites/FavoritesGrid.tsx src/components/housing/pages/FavoritesPage.tsx src/styles/housing.css src/components/housing/browse/__tests__/ListingCard.test.tsx
rtk git commit -m "feat(housing): 選択可カード(ListingCard拡張)+お気に入りグリッド"
```

---

## Task 4: FavoritesTabs(すべて/最近追加)+ 並び

**Files:**
- Create: `src/components/housing/favorites/FavoritesTabs.tsx`
- Modify: `src/components/housing/pages/FavoritesPage.tsx`
- Test: `src/components/housing/favorites/__tests__/favoritesOrder.test.ts`(並び関数の単体)

**Interfaces:**
- `type FavTab = 'all' | 'recent';`
- 純関数 `orderFavorites(ids: string[], listings: MockListing[], tab: FavTab): MockListing[]`。
  - `all` = `sortByAddress`(既存 `lib/housing/sortByAddress`)。
  - `recent` = ids 逆順(add で末尾 push のため新しい順)。
- `FavoritesTabs: React.FC<{ tab: FavTab; onChange:(t:FavTab)=>void; counts: {all:number; recent:number} }>`

- [ ] **Step 1: 失敗するテスト(orderFavorites)**

```ts
test('recent は追加順の逆(新しい順)', () => {
  const listings = [mk('a'), mk('b'), mk('c')]; // mk = id だけのヘルパ
  expect(orderFavorites(['a','b','c'], listings, 'recent').map(l=>l.id)).toEqual(['c','b','a']);
});
```

- [ ] **Step 2: 実行して落ちる → 実装 → 緑**

Run: `npx vitest run src/components/housing/favorites/__tests__/favoritesOrder.test.ts`
`orderFavorites` を実装(all=sortByAddress / recent=[...ids].reverse() を listings 解決)。Expected: PASS。

- [ ] **Step 3: FavoritesTabs UI(2タブ)+ 件数**

アクティブタブ=ハニー下線(参考UI)。すべて/最近追加のラベルは i18n。

- [ ] **Step 4: FavoritesPage に tab state を結線**

`tab` state → `orderFavorites` → Grid。dev でタブ切替が並びに反映されるのを確認。

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/housing/favorites/FavoritesTabs.tsx src/components/housing/favorites/__tests__/favoritesOrder.test.ts src/components/housing/pages/FavoritesPage.tsx
rtk git commit -m "feat(housing): お気に入りタブ(すべて/最近追加)+並び"
```

---

## Task 5: FavoritesBulkBar + 選択→トレイ配線 + 重複自動追加

**Files:**
- Create: `src/components/housing/favorites/FavoritesBulkBar.tsx`
- Modify: `src/components/housing/pages/FavoritesPage.tsx`
- Test: `src/components/housing/favorites/__tests__/FavoritesBulkBar.test.tsx`

**Interfaces:**
- `FavoritesBulkBar: React.FC<{ total:number; selectedCount:number; onSelectAll:()=>void; onClearSelect:()=>void; onAddAll:()=>void; onAddSelected:()=>void; onRemoveFromFav:()=>void; }>`
- FavoritesPage 側に `trayIds: string[]` state。トレイ投入は `expandTourWithDuplicates`(既存 `lib/housing/expandTourWithDuplicates`)を通す。

- [ ] **Step 1: 失敗するテスト(選択だけ追加でトレイに入る)**

FavoritesPage レベルで「2件選択→選択だけ追加→右トレイに2件(+重複自動)」を検証。BulkBar 単体は onAddSelected 発火を検証:
```tsx
test('選択だけ追加ボタンで onAddSelected 発火', () => {
  const fn = vi.fn();
  render(<FavoritesBulkBar total={5} selectedCount={2} onSelectAll={()=>{}} onClearSelect={()=>{}} onAddAll={()=>{}} onAddSelected={fn} onRemoveFromFav={()=>{}} />);
  fireEvent.click(screen.getByRole('button', { name: /選択だけ/ }));
  expect(fn).toHaveBeenCalled();
});
```

- [ ] **Step 2: 実行して落ちる → BulkBar 実装 → 緑**

一括バーを実装。`selectedCount===0` のとき「選択だけ追加/選択解除/外す」は disabled。Expected: PASS。

- [ ] **Step 3: FavoritesPage に配線**

- `addToTray(ids: string[])`: 各 id を `expandTourWithDuplicates(prevTray, id, listings)` で畳み込み、自動追加合計>0 なら1トースト(`housing.workspace.tour.auto_added_toast` 既存流用)。
- `onAddSelected` = addToTray(Array.from(selected))、`onAddAll` = addToTray(全 favorites)、カードの `onAddToTour` = addToTray([id])。
- `onSelectAll`/`onClearSelect` = selected Set 更新。`onRemoveFromFav` = 選択 id を favorites store から remove。

- [ ] **Step 4: FavoritesPage 統合テスト(選択→追加→トレイ反映)**

```tsx
test('2件選択→選択だけ追加でトレイに反映', () => { /* store seed → render → 選択 → 追加 → トレイ item 2 */ });
```
Run: `npx vitest run src/components/housing/favorites`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/housing/favorites/FavoritesBulkBar.tsx src/components/housing/favorites/__tests__/FavoritesBulkBar.test.tsx src/components/housing/pages/FavoritesPage.tsx
rtk git commit -m "feat(housing): 一括バー+選択→トレイ配線(重複自動追加/トースト)"
```

---

## Task 6: 右トレイ(TourTray 昇格)+ ツアー開始配線

**Files:**
- Modify: `src/components/housing/browse/TourTray.tsx`(暫定推定時間の見出し枠を追加 — 実距離は M2)
- Modify: `src/components/housing/pages/FavoritesPage.tsx`
- Test: `src/components/housing/pages/__tests__/FavoritesPage.test.tsx`(開始で tour store 反映)

**Interfaces:**
- TourTray は既存 `{ listingIds, onChange, onStart }` を維持。見出しに件数 + 暫定推定(例「推定 N分」= 件数ベースの簡易目安・後日実データ)を足す(暫定と分かる表現)。
- ツアー開始 = `useHousingTourStore.getState().setListings(trayIds); .start(); useHousingViewStore.getState().enterTourMode(); navigate('/housing/tour')`(BrowsePage と同一)。マナー通知(`MannerNoticeDialog`)を挟む。

- [ ] **Step 1: 失敗するテスト(開始で tour store に trayIds が入る)**

```tsx
test('トレイに2件→開始で tourStore.listings に反映', () => {
  // favorites seed → 選択 → 追加 → 開始ボタン → useHousingTourStore.getState().listingIds に2件
});
```

- [ ] **Step 2: 実行して落ちる → 配線 → 緑**

FavoritesPage に TourTray を結線、`onStart` で上記シーケンス。マナー通知は既存踏襲(未dismiss時のみ表示)。Expected: PASS。

- [ ] **Step 3: 暫定推定の枠を TourTray に追加(実データは M2 と明記)**

推定時間の見出しを枠として出す。実ルート距離/最適化/効率スコアは**出さない or "—" 表示**にして誤解を防ぐ(数値を偽らない)。

- [ ] **Step 4: dev 実機で 選択→追加→開始→/housing/tour 遷移を確認**

- [ ] **Step 5: Commit**

```bash
rtk git add src/components/housing/browse/TourTray.tsx src/components/housing/pages/FavoritesPage.tsx src/components/housing/pages/__tests__/FavoritesPage.test.tsx
rtk git commit -m "feat(housing): お気に入り右トレイ+ツアー開始配線(マナー通知/暫定推定枠)"
```

---

## Task 7: 左オンボーディング + 広告予約枠 + i18n 4言語 + 仕上げ

**Files:**
- Create: `src/components/housing/favorites/FavoritesOnboarding.tsx`
- Modify: `src/components/housing/pages/FavoritesPage.tsx`(左カラムに Onboarding + AdSlot)
- Modify: `src/i18n/locales/{ja,en,ko,zh}/*.json`(`housing.favorites.*` を4言語)
- Test: `src/components/housing/favorites/__tests__/i18nParity.test.ts`(4言語キー一致・既存 parity テスト様式があれば踏襲)

- [ ] **Step 1: FavoritesOnboarding(3ステップ・教育のみ)**

「1 保存する / 2 選択する / 3 ツアー化する」。**✅進捗ではない**([[feedback_form_ux_progress]] 遵守=最初から✅を付けない)。番号は青(進行)アクセント。ワンポイント文も参考UI準拠。

- [ ] **Step 2: 左カラムに Onboarding + AdSlot(最小予約)**

`AdSlot slot="favorites-left"`。右にも `AdSlot slot="favorites-right"`(参考UI準拠・最小)。

- [ ] **Step 3: i18n 4言語追加(該当ブロックのみ textual 編集)**

`housing.favorites.title/onboarding_step1_2_3/tab_all/tab_recent/bulk_*/tray_*/estimate_hint` 等を ja/en/ko/zh に追加。ja を正、en/ko/zh は既存訳語ソース([[reference_ff14_jobguide_urls]])に沿う。ko/zh 未確定は暫定訳+TODO。

- [ ] **Step 4: parity テスト緑**

Run: `npx vitest run <i18n parity テスト>`
Expected: 4言語で `housing.favorites.*` キー一致。

- [ ] **Step 5: dev 実機で全体を確認(ユーザー声かけ)**

`/housing/favorites` を en/ja で開き、左3ステップ/中央グリッド+タブ+一括バー/右トレイ/質感A案 が参考UI相当か確認。ユーザーに「お気に入りページ全体を見て」と声かけ。

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/housing/favorites/FavoritesOnboarding.tsx src/components/housing/pages/FavoritesPage.tsx src/i18n/locales src/components/housing/favorites/__tests__/i18nParity.test.ts
rtk git commit -m "feat(housing): お気に入り左オンボーディング+広告予約枠+i18n 4言語"
```

---

## Task 8: ルール更新 + 監査 + TODO 記録

**Files:**
- Modify: `.claude/rules/housing-design.md`(質感A案条項を追記)
- Modify: `docs/TODO.md`(第2スパン完了を記録)

- [ ] **Step 1: housing-design.md に質感A案を明文化**

「採用デザイン規約」に追記: **質感A案(2026-07-01)= 参考UIへ寄せる。動画背景は暗幕で後退・パネルは濃紺不透明寄り・ハニー=主アクション/青=選択・進行。モックアップの"濃いガラス+明るい動画"から意図的に更新済(ユーザー承認)。** 以後の新規ページはA案を基準にする。

- [ ] **Step 2: 全体監査**

Run: `npm run build`(Expected: 成功)
Run: `npx vitest run`(Expected: 新規緑・既存回帰なし。legacy TopBar/HousingWorkspace の既知5件fail は対象外)
Run(grep 監査): 新規 favorites/ 各ファイルに `rgb\(|rgba\(|#[0-9a-f]{3,8}` の直書きが無いこと(housing.css 内のみ許容)。

- [ ] **Step 3: TODO.md 更新**

「次の作業順」#1 のスパン記録を更新(第2スパン=お気に入り+質感A案 完了・ローカル確認OK・未merge)。次スパン候補=登録ページ(merge解禁の最後の1枚)or ツアー中ナビ。TODO は 100 行以内維持。

- [ ] **Step 4: Commit**

```bash
rtk git add .claude/rules/housing-design.md docs/TODO.md
rtk git commit -m "docs(housing): 質感A案をルール明文化+第2スパン(お気に入り)完了を記録"
```

---

## Self-Review(記入済)

- **Spec coverage**: パートA質感=Task1 / ルート+骨組み=Task2 / カード+グリッド=Task3 / タブ=Task4 / 一括バー+選択トレイ配線=Task5 / 右トレイ+開始=Task6 / オンボーディング+広告+i18n=Task7 / ルール+監査+TODO=Task8。spec 全節にタスク対応あり。
- **Placeholder scan**: 質感の実 rgba は「実画面で微調整」を明示した意図的な開始値(視覚チューニングの性質上、固定不可)。それ以外に TBD/TODO 無し。
- **Type consistency**: `FavTab='all'|'recent'`、`orderFavorites`、`addToTray`、ListingCard 追加 props、TourTray 既存シグネチャ — タスク間で名称一致。
- **既知の非目標**: 実ルート距離/効率スコア/最適化(M2)、コレクション/ツアー候補タブ、生きたカード段階2、スマホ(M6)は今回やらない。
