# ハウジング スマホ対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** ハウジング(/housing)の全画面をスマホで使えるようにする（縦持ち基準・ツアーのみ横持ち・「簡単/短時間で動く」最優先）。

**Architecture:** 既存のデスクトップ画面はそのまま使い、(a) 新規モバイルクロム（ボトムナビ/FAB/フィルタ・設定シート）を `useIsMobile()` で条件レンダリング、(b) 既存レイアウトを `@media (max-width:767px)` の上書きで縦積み/全画面化、の2本立て。スマホ専用画面の作り直しはしない。

**Tech Stack:** React + TypeScript + zustand + react-router + react-i18next、CSS は `src/styles/housing.css` の `--housing-*` トークン、framer-motion（既存シート/FAB）。

## Global Constraints
- ブレイクポイント: **スマホ = `max-width: 767px`**。JS判定は既存 `useIsMobile()`（`src/hooks/useIsMobile.ts`, `(max-width:767px)`）を使う。新規CSSも `@media (max-width:767px)` で統一（詳細ページ既存の `min-width:769px` ブロックは触らない）。
- housing 配下は独立トンマナ（`.claude/rules/housing-design.md`）。**色/寸法/影/font-size はハードコード禁止**、`--housing-*` トークン経由。新規トークンは `src/styles/housing.css` の `.housing-workspace` ブロック上部に追加。
- 文字列は**必ず i18n キー経由**、`src/locales/{ja,en,ko,zh}.json` の**4言語同時追加**（parity 維持・該当ブロックだけ textual 編集）。新規は `housing.mobile.*` ネームスペース。
- push 前に `npm run build`（tsc -b 厳密）+ `vitest run` 必須。テストは `__tests__/` 配下。
- 本番反映はユーザーのスマホ実機確認をゲート。勝手に push/デプロイしない。
- 既存の挙動（カード1件ずつ再生・画面内のみ描画）は**変更しない**。

## 主要トークン（T1で追加）
```
--housing-bottomnav-h: 3.5rem;        /* 56px。MobileBottomSheet の bottom:3.5rem と一致させる */
--housing-fab-size: 3.25rem;
--housing-fab-gap: 0.75rem;
```
safe-area は `env(safe-area-inset-bottom)` を各固定要素の bottom/padding に加算。

---

## Task 1: モバイルシェル基盤（ボトムナビ + FAB + シート + シェル配線）

**最初に実装（他タスクの土台）。** 完了時: スマホでヘッダーが最小化し、下にボトムナビ＋右下にFABが出る（ツアー中は消える）、フィルタ/設定シートが開いて機能する、旧フッターの中身が設定シートに入る。

**Files:**
- Create: `src/components/housing/shell/HousingBottomNav.tsx`
- Create: `src/components/housing/shell/HousingRegisterFab.tsx`
- Create: `src/components/housing/shell/HousingFilterSheet.tsx`
- Create: `src/components/housing/shell/HousingSettingsSheet.tsx`
- Create: `src/hooks/__tests__/`（不要・既存フック流用）／ Test: `src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx`
- Modify: `src/components/housing/shell/HousingShell.tsx`（モバイル時にクロムをマウント・sheet 開閉 state を保持）
- Modify: `src/components/housing/shell/AppHeader.tsx`（モバイル時にブランド以外を隠す＝CSSクラス付与）
- Modify: `src/styles/housing.css`（`@media (max-width:767px)` ブロック新設＋トークン追加＋ `.housing-status`/`.housing-app-header` のモバイル調整）
- Modify: `src/locales/{ja,en,ko,zh}.json`（`housing.mobile.*` 追加）

**Interfaces (Produces — 後続タスクが参照):**
- `useIsMobile(): boolean`（既存 `src/hooks/useIsMobile.ts`）。
- `HousingBottomNav` props: `{ onOpenFilter: () => void; onOpenSettings: () => void }`（お気に入り/ツアーは内部で `navigate`、ログインは内部で `openLogin`/`openAccount`）。
- `HousingRegisterFab` props: なし（内部で user 判定→ `navigate('/housing/register')` or `openLogin({ fromRegister: true })`）。
- `HousingFilterSheet` props: `{ isOpen: boolean; onClose: () => void }`。
- `HousingSettingsSheet` props: `{ isOpen: boolean; onClose: () => void }`。

**実装メモ（正確なアンカー）:**
- 判定: `import { useIsMobile } from '../../../hooks/useIsMobile'`。
- 没入判定（ツアー中はナビ/FAB非表示）: `const mode = useHousingViewStore(s => s.mode)`（`'browse'|'tour'`）／`const joinedToken = useJoinedTourStore(s => s.token)`／`const { pathname } = useLocation()`。`const immersive = mode === 'tour' || (!!joinedToken && pathname === '/housing/tour/' + joinedToken)`。
- HousingShell: `const isMobile = useIsMobile()`。`const [filterOpen,setFilterOpen]=useState(false)`／`const [settingsOpen,setSettingsOpen]=useState(false)`。`.housing-shell-body` の後に:
  - `{isMobile && !immersive && <HousingBottomNav onOpenFilter={()=>setFilterOpen(true)} onOpenSettings={()=>setSettingsOpen(true)} />}`
  - `{isMobile && !immersive && <HousingRegisterFab />}`
  - `{isMobile && <HousingFilterSheet isOpen={filterOpen} onClose={()=>setFilterOpen(false)} />}`
  - `{isMobile && <HousingSettingsSheet isOpen={settingsOpen} onClose={()=>setSettingsOpen(false)} />}`
- `HousingBottomNav`: 5項目 `{id,label,icon,onClick,active}`。項目 = filter(`onOpenFilter`), favorites(`navigate('/housing/favorites')`), tour(`navigate('/housing/tour')`), settings(`onOpenSettings`), login(user? `openAccount()` : `openLogin()`)。アイコンは lucide（例: `SlidersHorizontal, Heart, Route, Settings, User`）。active は `useLocation().pathname` で favorites/tour を判定。login項目に未読バッジ: `const { unreadCount } = useNotifications()`（`src/components/housing/notifications/useNotifications.ts`）を user 時のみ購読し `unreadCount>0` でドット。固定 `position:fixed; bottom:0; height:var(--housing-bottomnav-h); padding-bottom:env(safe-area-inset-bottom)`、`--housing-*` トークンで配色（ハニー=アクティブ）。
- `HousingRegisterFab`: `const user = useAuthStore(s=>s.user)`／`const navigate=useNavigate()`／`const openLogin=useHousingModalStore(s=>s.openLogin)`。`onClick = () => user ? navigate('/housing/register') : openLogin({ fromRegister: true })`。`position:fixed; right:1rem; bottom:calc(var(--housing-bottomnav-h) + var(--housing-fab-gap) + env(safe-area-inset-bottom))`。＋アイコン（lucide `Plus`）。
- `HousingFilterSheet`: 既存 `MobileBottomSheet`（`src/components/MobileBottomSheet.tsx`, props `isOpen/onClose/title/children/height/fillContent`）を流用。`title={t('housing.mobile.filter_title')}`。children = キーワード入力 `<input>`（`value={useHousingFilterStore(s=>s.keyword)}` / `onChange -> useHousingFilterStore.getState().setKeyword(e.target.value)`）＋ `<FilterPanel hideClose onClose={onClose} onRegisterClick={()=>{ onClose(); navigate('/housing/register'); }} />`。入力欄は housing の `.housing-app-search-input` クラスを流用可。
- `HousingSettingsSheet`: `MobileBottomSheet` 流用。`title={t('housing.mobile.settings_title')}`。children = 旧フッター(`StatusBar`)の中身を移植:
  - テーマ: `AppHeader` の `switchTheme` と同じトグル（`useThemeStore` の theme/setTheme、`t('housing.workspace.topbar.theme_light')`/`theme_dark`）。演出は簡易でよい（View Transitions は任意）。
  - 言語: `['ja','en','ko','zh']` を `i18n.changeLanguage(lang)`（`StatusBar.tsx` L57-71 と同じ）。
  - 法的: `t('footer.copyright')` / `<a href="/privacy">`t('footer.privacy_policy')` / `<a href="/terms">`t('footer.terms')` / `<Link to="/support">`t('footer.kofi')`。
- AppHeader モバイル化: ヘッダー `<header className="housing-app-header">` に条件クラスは付けず、**CSSで** `@media (max-width:767px)` にて `.housing-app-header .housing-app-search`, `.housing-tabbar`(TabBar), `.housing-app-header-right` を `display:none`、ブランドのみ残す。※TabBar のクラス名は `TabBar.tsx` を読んで特定（`.housing-tabbar` 等）。
- StatusBar 非表示: `@media (max-width:767px) { .housing-status { display:none; } }`。
- ボトムナビ/FAB のぶん、`.housing-shell-body` にモバイルで `padding-bottom: calc(var(--housing-bottomnav-h) + env(safe-area-inset-bottom))` を足して最下部が隠れないように。

- [ ] **Step 1: 失敗するテストを書く** — `src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HousingBottomNav } from '../HousingBottomNav';
import { HousingRegisterFab } from '../HousingRegisterFab';

// useIsMobile は各コンポーネントを直接テストするので不要。ここでは
// 「FABが未ログインでログイン誘導」「ログイン済で登録遷移」を検証する。
const navigate = vi.fn();
const openLogin = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

describe('HousingRegisterFab', () => {
  beforeEach(() => { navigate.mockClear(); openLogin.mockClear(); });

  it('未ログインならログイン誘導(fromRegister)', () => {
    // useAuthStore.user=null, useHousingModalStore.openLogin=openLogin をモック
    // (実装のストア形状に合わせて vi.mock で差し込む)
    render(<MemoryRouter><HousingRegisterFab /></MemoryRouter>);
    screen.getByRole('button').click();
    expect(openLogin).toHaveBeenCalledWith({ fromRegister: true });
    expect(navigate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストが落ちるのを確認** — `npx vitest run src/components/housing/shell/__tests__/HousingMobileChrome.test.tsx`（Expected: FAIL: モジュール未作成）
- [ ] **Step 3: 4コンポーネント＋シェル配線＋CSS＋i18nを実装**（上記メモどおり。ストアのモック形状はテスト側で実装に合わせる）
- [ ] **Step 4: テスト緑を確認**（同コマンド Expected: PASS）
- [ ] **Step 5: `npm run build` が通ることを確認**（tsc 厳密・未使用 import 注意）
- [ ] **Step 6: commit** — `rtk git add -A && rtk git commit -m "feat(housing): モバイルシェル基盤(ボトムナビ/FAB/フィルタ・設定シート)"`

---

## Task 2: 探す/お気に入り 2列グリッド + マップ非表示

**Files:**
- Modify: `src/styles/housing.css`（`@media (max-width:767px)` に `.housing-browse` 単一カラム化＋`.housing-listing-grid` 2列＋左右パネル非表示）
- Modify: `src/components/housing/pages/BrowsePage.tsx`（モバイルは list 強制＋トグル非表示）
- Modify: `src/components/housing/browse/BrowseViewToggle.tsx`（or CSS で `.housing-view-toggle` を非表示）
- Test: 既存 `BrowsePage.test.tsx` に「モバイルで map トグルが出ない/list 固定」を1件追加

**実装メモ:**
- CSS（`@media (max-width:767px)`）:
  - `.housing-browse { grid-template-columns: 1fr; }`
  - `.housing-browse-panel[data-region="left"], .housing-browse-panel[data-region="right"] { display:none; }`（左=フィルタ→シートへ、右=トレイ/詳細→別導線）
  - `.housing-listing-grid { grid-template-columns: repeat(2, 1fr); }`（現状 `minmax(198px,1fr)` の auto-fill を上書き）
  - `.housing-view-toggle { display:none; }`
- BrowsePage: `const isMobile = useIsMobile()`。`const effectiveView = isMobile ? 'list' : browseView`。描画分岐（BrowsePage.tsx:178-189）の `browseView` を `effectiveView` に置換（マップ分岐に入らせない）。
- FavoritesPage は同じ `.housing-listing-grid` を使うので CSS 変更だけで2列化する（確認）。
- [ ] Step1: `BrowsePage.test.tsx` に失敗テスト追加（`useIsMobile` を true にモック→ `BrowseViewToggle` が描画されない）
- [ ] Step2: 落ちる確認
- [ ] Step3: 実装
- [ ] Step4: テスト緑
- [ ] Step5: `npm run build`
- [ ] Step6: commit — `feat(housing): 探す/お気に入りのスマホ2列グリッド+マップ非表示`

---

## Task 3: 詳細/登録/編集/ハウジンガーPF 全画面仕上げ

**Files:**
- Modify: `src/styles/housing.css`（各ページのルートラッパを `@media (max-width:767px)` で全幅・単一カラム化）
- Modify（必要時）: `src/components/housing/listing/HousingDetailPage.tsx`（戻るボタンの存在確認・全画面化）
- 対象ラッパのクラスは各ページを読んで特定（`HousingerPage.tsx` / `RegisterPage.tsx` / `HousingEditPage.tsx` / `HousingDetailPage.tsx`）。

**実装メモ:**
- 詳細は既に `@media (min-width:769px)` で md+ 3カラム化する mobile-first 構造（`housing.css:3182` 付近のコメント）。スマホでは既に縦積みになるはずなので、**戻るボタンが表示され機能するか**を確認し、全画面（ヘッダー下いっぱい）に。足りなければ調整。
- 登録/編集: フォームのルートを `@media (max-width:767px)` で `width:100%`・左右余白最小・3カラム的グリッドがあれば単一カラムに。
- PF: 同様に全幅・縦積み。
- これらは主にCSS。テストは付けにくいので `npm run build` 緑＋実機チェックリストに委ねる。
- [ ] Step1: 各ページのラッパクラスを grep で特定（`housing-detail` / `housing-register` / `housing-edit` / `housinger` 等）
- [ ] Step2: `@media (max-width:767px)` の単一カラム/全幅CSSを追加
- [ ] Step3: 詳細の戻るボタン確認（無ければ追加）
- [ ] Step4: `npm run build`
- [ ] Step5: commit — `feat(housing): 詳細/登録/編集/PFのスマホ全画面化`

---

## Task 4: ツアー横持ち（案A・操作バー・見学オーバーレイ・横にしてヒント）

**Files:**
- Create: `src/components/housing/tour/TourMobileBar.tsx`（下部の細い操作バー）
- Create: `src/components/housing/tour/TourOrientationHint.tsx`（縦持ち時「横にして」）
- Modify: `src/components/housing/pages/TourNavPage.tsx`（モバイル時に下部バー＋ヒントを追加描画）
- Modify: `src/styles/housing.css`（`@media (max-width:767px)`: 左右パネル非表示・中央地図全画面・完了/跨ぎはそのまま）
- Test: `TourNavPage.test.tsx` に「モバイルで TourMobileBar が出る」1件

**Interfaces:**
- `TourMobileBar` props: `{ directionsText: string; canPrev: boolean; canView: boolean; isLast: boolean; onPrev: () => void; onView: () => void; onNext: () => void; onInvite?: () => void; showInvite?: boolean }`。
- `TourOrientationHint` props: なし（内部で `matchMedia('(orientation: portrait)')` を購読して縦持ちのみ表示）。

**実装メモ:**
- TourNavPage は既に `directions`, `prev`, `startViewing`(見学), `onPrimary`(次へ/ack/完了), `isLast`, `canView`, `progress` を算出済み（TourNavPage.tsx:75-89, 213-228, 300-306）。モバイルバーはこれらを**そのまま渡すだけ**（新ロジック不要）。
- `const isMobile = useIsMobile()`。return 内、既存3パネルの後に:
  - `{isMobile && <TourOrientationHint />}`
  - `{isMobile && listingIds.length>0 && !completed && <TourMobileBar directionsText={directions?.text ?? ''} canPrev={currentIndex>0} canView={canView} isLast={isLast} onPrev={prev} onView={startViewing} onNext={onPrimary} showInvite onInvite={onInvite} />}`
  - ※ `directions` の正確な形は `useTourRenderModel` の戻りを確認（`directions.text` 等）。
- 見学(onView=startViewing)は phase を 'viewing' にする既存挙動。モバイルでは家の写真を見せるため、`phase==='viewing'` のとき `TourShowcasePanel` の内容を**オーバーレイ/シート**で重ねる（左パネルはCSS非表示なので、`isMobile && phase==='viewing'` で `MobileBottomSheet` か全画面オーバーレイに `TourShowcasePanel` を出す）。閉じるで戻る。
- CSS（`@media (max-width:767px)`）:
  - `.housing-tour-page-panel[data-region="left"], .housing-tour-page-panel[data-region="right"] { display:none; }`
  - `.housing-tour-page { grid-template-columns: 1fr; }`（現状の3カラム定義を上書き。実際のクラス/定義は `housing.css` で `.housing-tour-page` を grep して特定）
  - 中央地図パネルを全画面高に。
  - `TourMobileBar` は `position:fixed; bottom:0; padding-bottom:env(safe-area-inset-bottom)` の細いバー、`--housing-*` トークン配色。行き方テキストは1行省略（`text-overflow:ellipsis`）、右に [前へ][見学][次へ] 小ボタン、隅に招待。
- 縦持ちヒント: `TourOrientationHint` は `position:fixed; inset:0` の半透明面に「端末を横にしてください」＋回転アイコン。i18n `housing.mobile.rotate_hint`。
- [ ] Step1: `TourNavPage.test.tsx` に失敗テスト（`useIsMobile`=true で `TourMobileBar` の testid が出る）
- [ ] Step2: 落ちる確認
- [ ] Step3: 2コンポーネント＋TourNavPage配線＋CSS＋i18n実装
- [ ] Step4: テスト緑
- [ ] Step5: `npm run build`
- [ ] Step6: commit — `feat(housing): ツアーのスマホ横持ちUI(案A)`

---

## Task 5: 共有ツアー参加（JoinTourPage）横持ち

**Files:**
- Modify: `src/components/housing/pages/JoinTourPage.tsx`（モバイル時の横持ち・操作なしバー）
- Modify: `src/styles/housing.css`（JoinTourPage のパネル構造に応じた `@media (max-width:767px)` — TourNavPage と同型なら共通クラスで済む）
- Test: `JoinTourPage.test.tsx` に「モバイルで地図＋行き方のみ・操作ボタン無し」1件

**実装メモ:**
- まず `JoinTourPage.tsx` を読み、TourNavPage と同じパネルクラス（`.housing-tour-page-panel` data-region）を使っているか確認。使っていれば Task4 のCSSがそのまま効く。
- 参加者は幹事に追従＝**操作ボタン(前へ/見学/次へ)を出さない**。モバイルバーは `TourMobileBar` を流用しつつ、`canPrev=false` 等ではなく**操作を出さないモード**が要るなら `TourMobileBar` に `readOnly?: boolean`（true で行き方テキストのみ表示）を足す。
- Task4 の `TourMobileBar` に `readOnly?: boolean` を追加（true=行き方のみ）。JoinTourPage は `<TourMobileBar directionsText=... readOnly />`。
- ボトムナビ/FAB は T1 の `immersive` 判定で既に非表示（joinedToken && tour route）。
- [ ] Step1: `JoinTourPage.test.tsx` に失敗テスト（モバイルで next/prev ボタンが無い）
- [ ] Step2: 落ちる確認
- [ ] Step3: `TourMobileBar` に `readOnly` 追加＋JoinTourPage配線＋CSS
- [ ] Step4: テスト緑
- [ ] Step5: `npm run build`
- [ ] Step6: commit — `feat(housing): 共有ツアー参加のスマホ横持ち(追従・操作なし)`

---

## Task 6: i18n 4言語総点検 + build + vitest 緑

**Files:**
- Modify: `src/locales/{ja,en,ko,zh}.json`（`housing.mobile.*` の欠けを埋める・parity）
- 全体: `npm run build` + `vitest run`

**必要な `housing.mobile.*` キー（4言語）:**
`nav_filter` / `nav_favorites` / `nav_tour` / `nav_settings` / `nav_login` / `filter_title` / `settings_title` / `settings_theme` / `settings_language` / `rotate_hint` / `tour_prev` / `tour_view` / `tour_next` / `tour_invite`（既存 `housing.tour.*` に相当があれば流用可）。

- [ ] Step1: 4ファイルで `housing.mobile.*` が全キー揃っているか grep で確認（`i18nParity` テストがあれば実行）
- [ ] Step2: 欠け/不一致を textual 編集で補完（全体 stringify しない）
- [ ] Step3: `vitest run`（vmThreads 手順・出力パイプ禁止）緑
- [ ] Step4: `npm run build` 緑
- [ ] Step5: commit — `chore(housing): スマホ対応 i18n parity + build/test 緑`

---

## Self-Review（対 spec）
- 共通クロム（ボトムナビ/FAB/フィルタ/設定/アカウント/フッター移設）→ **T1** ✅
- 探す2列・マップ非表示・お気に入り → **T2** ✅
- 詳細全画面+戻る・登録/編集/PF → **T3** ✅
- ツアー横持ち案A（操作バー/見学/横にして/招待/完了/跨ぎ）→ **T4** ✅
- 共有ツアー参加 追従・操作なし → **T5** ✅
- i18n 4言語 + build/test → 各タスク + **T6** で総点検 ✅
- 通知バッジ（ログイン項目）→ T1 に含む ✅
- safe-area/没入時ナビ非表示/未ログインFAB誘導 → T1 ✅
- 非目標（タブレット/スマホマップ探す/中韓）は各タスクで触れない ✅
- 型整合: `HousingBottomNav`/`Fab`/`Sheet` props、`TourMobileBar`（T4定義→T5で `readOnly` 拡張）一貫 ✅

## 依存と並列
- **T1 が土台（最初・単独）**。
- T1 後に **T2 / T3 / T4 を並列**可。
- **T5 は T4 の後**（`TourMobileBar` 流用）。
- **T6 は最後**（全タスク合流後の総点検）。
