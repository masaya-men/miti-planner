# ハウジング再構築 第1スパン (土台 + 探す) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジングを「1ワークスペース+モーダル」から「上部URLタブで切り替わる7ページ構成のシェル」へ作り替え、その第1弾として **土台(シェル/タブ/共通部品) + 探すページ** を参考UIの洗練度で完成させる。

**Architecture:** Admin の `AdminLayout` + ネストルート + `<Outlet/>` パターンを踏襲し `HousingShell` を新設。既存の zustand store（listings/filter/favorites/tour/view）と pure helper（applyFilters/expandTourWithDuplicates）はそのまま再利用し、UI 層だけ再構成する。質感は既存 `SceneryVideo` + `LiquidGlassPanel` を継承。

**Tech Stack:** React 18 + TypeScript(strict, tsc -b) / react-router-dom(ネストルート) / zustand / react-i18next / vitest(pool='vmThreads') / @dnd-kit(既存) / lucide-react / housing.css design tokens。

## Global Constraints

- **言語**: UI 文字列は必ず i18n キー経由（`.claude/rules/i18n.md`）。日本語基準 + en/ko/zh parity。
- **ハウジング独自トンマナ**（`.claude/rules/housing-design.md`）: 色/font-size/寸法/影は **`--housing-*` トークン経由・ハードコード禁止**。`rgb(`/`rgba(`/`#hex`/`px;` リテラルをコンポーネントに残さない（残してよいのは housing.css 内のみ）。LoPo 既存ルール（白黒のみ/Inter禁止）は**適用外**。
- **正典**: 質感=`docs/.private/housing-tour-mockup/index.html`、構造=`C:/Users/masay/Downloads/HousingTour_theme/` の9枚。GPT画像のフラット見た目は写さず、構造のみ採用。
- **backdrop-filter リテラル禁止**（`.claude/rules/css-rules.md`）: `--tw-backdrop-blur` 変数パターン or `var()` 参照のみ。
- **push 前必須**: `npm run build`（tsc厳密・未使用変数/型で落ちる）+ `vitest run` 緑（[[feedback_vercel_tsc_strict]]）。
- **vitest**: `pool='vmThreads'` 厳守・出力をパイプしない・ハングしたら再実行せず memory `reference_vitest_vmthreads_hang` 手順。
- **ツアーは未公開**（導線ボタン無効化済）=作り替え自由・ユーザー影響なし。
- **AIっぽさ回避**: 装飾999pxピル/過剰glow/honeyグラデ乱用を避ける。機能要素は維持。
- 作業ブランチ = `feat/housing-rebuild-foundation-browse`（既に設計メモをコミット済）。

---

## ファイル構成 (このスパンで触る/作る)

**新規:**
- `src/components/housing/shell/HousingShell.tsx` — 共通レイアウト（背景+ヘッダー+タブ+Outlet+ステータス）
- `src/components/housing/shell/AppHeader.tsx` — ロゴ/検索/TabBar/テーマ/通知/アバター（TopBar を再構成）
- `src/components/housing/shell/TabBar.tsx` — 上部6タブ（URL連動アクティブ+通知バッジ）
- `src/components/housing/shell/housingTabs.ts` — タブ定義（key/labelKey/path）単一ソース
- `src/components/housing/shell/AdSlot.tsx` — 最小広告予約枠
- `src/components/housing/pages/BrowsePage.tsx` — 探すページ本体（3カラム）
- `src/components/housing/browse/ListingGrid.tsx` — 中央グリッド + 一覧/マップ/ルート切替
- `src/components/housing/browse/ListingCard.tsx` — 生きたカード（段階1: 静止+ホバー）
- `src/components/housing/browse/TourTray.tsx` — 右トレイ（既存 TourBuilderPane を昇格）
- テスト: `src/__tests__/housing/HousingShell.test.tsx` / `TabBar.test.tsx`(既存を再定義) / `BrowsePage.test.tsx` / `ListingCard.test.tsx` / `TourTray.test.tsx`

**変更:**
- `src/App.tsx:94-99` — housing ルートを `HousingShell` + ネスト子ルートへ
- `src/styles/housing.css` — 新トークン + シェル/タブ/カード/トレイ/AdSlot クラス

**据え置き（このスパンでは撤去しない）:** `HousingWorkspace.tsx`（`/housing/p/:listingId` 用に残置）/ `FavoritesModal` / `HousingRegisterFormModal` / `HousingDetailPage`。タブからは暫定で既存実装 or「準備中」に接続。

---

### Task 1: タブ定義 + HousingShell の骨格とネストルーティング

**Files:**
- Create: `src/components/housing/shell/housingTabs.ts`
- Create: `src/components/housing/shell/HousingShell.tsx`
- Modify: `src/App.tsx:94-99`
- Test: `src/__tests__/housing/HousingShell.test.tsx`

**Interfaces:**
- Produces: `HOUSING_TABS: ReadonlyArray<{ key: string; labelKey: string; path: string; end?: boolean }>`（TabBar/AppHeader が消費）
- Produces: `HousingShell`（default 相当の named export）— 背景/ヘッダー/`<Outlet/>`/ステータスを描画

- [ ] **Step 1: タブ定義を書く**

```ts
// src/components/housing/shell/housingTabs.ts
export interface HousingTab {
  key: string;
  labelKey: string;   // i18n キー
  path: string;       // 絶対パス
  end?: boolean;      // 完全一致のみ active (index タブ用)
}

export const HOUSING_TABS: readonly HousingTab[] = [
  { key: 'browse',    labelKey: 'housing.tabs.browse',    path: '/housing', end: true },
  { key: 'favorites', labelKey: 'housing.tabs.favorites', path: '/housing/favorites' },
  { key: 'plan',      labelKey: 'housing.tabs.plan',      path: '/housing/plan' },
  { key: 'tour',      labelKey: 'housing.tabs.tour',      path: '/housing/tour' },
  { key: 'register',  labelKey: 'housing.tabs.register',  path: '/housing/register' },
  { key: 'mypage',    labelKey: 'housing.tabs.mypage',    path: '/housing/mypage' },
] as const;
```

- [ ] **Step 2: HousingShell を書く（まず Outlet が描画されるだけの最小形）**

```tsx
// src/components/housing/shell/HousingShell.tsx
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { SceneryVideo } from '../workspace/SceneryVideo';
import { AppHeader } from './AppHeader';
import { StatusBar } from '../workspace/StatusBar';
import '../../../styles/housing.css';

export const HousingShell: React.FC = () => {
  const theme = useThemeStore((s) => s.theme);

  // 物件データを 1 回だけロード（冪等・全ページ共有）
  useEffect(() => { void useHousingListingsStore.getState().load(); }, []);

  // 固定ビューポート（body スクロールロック）— 既存 workspace の踏襲
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <main className="housing-shell-root" data-theme={theme}>
      <SceneryVideo theme={theme} />
      <div className="housing-shell">
        <AppHeader />
        <div className="housing-shell-body">
          <Outlet />
        </div>
        <StatusBar />
      </div>
    </main>
  );
};
```

> 注: `AppHeader` は Task 3、`BrowsePage` は Task 8 で実体化する。本 Task では両者を「最小スタブ」で先に作り、ルートが通ることを確認する（下記 Step 3 でスタブ AppHeader、BrowsePage は既存 `HousingWorkspace` を暫定 index に置いてもよいが、本プランでは空スタブで通す）。

- [ ] **Step 3: 最小スタブを置く**（このタスクの緑化用。Task3/8 で本実装に差し替え）

```tsx
// src/components/housing/shell/AppHeader.tsx  (stub — Task 3 で本実装)
export const AppHeader: React.FC = () => <header className="housing-app-header" data-region="header" />;
```
```tsx
// src/components/housing/pages/BrowsePage.tsx  (stub — Task 8 で本実装)
export const BrowsePage: React.FC = () => <div data-testid="browse-page" />;
```

- [ ] **Step 4: 失敗するテストを書く**

```tsx
// src/__tests__/housing/HousingShell.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';

// firebase 依存を持つ子は mock（listings load を無害化）
vi.mock('../../lib/housingListingsService', () => ({ getGalleryListings: () => Promise.resolve([]) }));

import { HousingShell } from '../../components/housing/shell/HousingShell';
import { BrowsePage } from '../../components/housing/pages/BrowsePage';

describe('HousingShell', () => {
  it('renders header region and nested route outlet', () => {
    render(
      <MemoryRouter initialEntries={['/housing']}>
        <Routes>
          <Route path="/housing" element={<HousingShell />}>
            <Route index element={<BrowsePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-region="header"]')).toBeTruthy();
    expect(screen.getByTestId('browse-page')).toBeTruthy();
  });
});
```

- [ ] **Step 5: テストを実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/HousingShell.test.tsx`
Expected: FAIL（モジュール未作成 or Outlet 未描画）

- [ ] **Step 6: App.tsx のルートを差し替える**

```tsx
// src/App.tsx — 既存 94-99 行を置換
// import 追加: HousingShell, BrowsePage（後続タスクで pages を増やす）
<Route path="/housing" element={<HousingShell />}>
  <Route index element={<BrowsePage />} />
  {/* 後続タスク/スパンで favorites/plan/tour/register/mypage を追加 */}
</Route>
{/* 既存の詳細/旧ルートは据え置き */}
<Route path="/housing/p/:listingId" element={<HousingWorkspace />} />
<Route path="/housing/legacy" element={<HousingPage />} />
<Route path="/housing/listing/:listingId" element={<HousingDetailPage />} />
```

> `/housing/tour/:tourId` は tour ページ実装スパンで shell 子ルートへ移す。第1スパンでは既存 `HousingWorkspace` 版を残置して衝突を避ける（`/housing/tour` タブは Task 2 で「準備中」着地）。

- [ ] **Step 7: テストを実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/HousingShell.test.tsx`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/components/housing/shell/ src/components/housing/pages/BrowsePage.tsx src/App.tsx src/__tests__/housing/HousingShell.test.tsx
git commit -m "feat(housing): HousingShell + ネストルーティングの骨格"
```

---

### Task 2: TabBar（URL連動アクティブ + 通知バッジ）

**Files:**
- Create: `src/components/housing/shell/TabBar.tsx`
- Test: `src/__tests__/housing/TabBar.test.tsx`（既存があれば再定義）

**Interfaces:**
- Consumes: `HOUSING_TABS`（Task 1）
- Produces: `TabBar`（props なし。`NavLink` で自己完結）

- [ ] **Step 1: 失敗するテストを書く**

```tsx
// src/__tests__/housing/TabBar.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { TabBar } from '../../components/housing/shell/TabBar';

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><TabBar /></MemoryRouter>);
}

describe('TabBar', () => {
  it('marks the browse tab active on /housing', () => {
    renderAt('/housing');
    const browse = screen.getByRole('link', { name: /housing\.tabs\.browse|探す/ });
    expect(browse.getAttribute('aria-current')).toBe('page');
  });
  it('marks favorites active on /housing/favorites and browse NOT active', () => {
    renderAt('/housing/favorites');
    const fav = screen.getByRole('link', { name: /housing\.tabs\.favorites|お気に入り/ });
    expect(fav.getAttribute('aria-current')).toBe('page');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/TabBar.test.tsx`
Expected: FAIL（TabBar 未作成）

- [ ] **Step 3: TabBar を実装**

```tsx
// src/components/housing/shell/TabBar.tsx
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HOUSING_TABS } from './housingTabs';

export const TabBar: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav className="housing-tabbar" aria-label={t('housing.tabs.aria')}>
      {HOUSING_TABS.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.path}
          end={tab.end}
          className={({ isActive }) => `housing-tab${isActive ? ' is-active' : ''}`}
        >
          {t(tab.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
};
```

> `NavLink` は active 時に自動で `aria-current="page"` を付与する（テストはこれを検証）。見た目のアクティブ下線は `.housing-tab.is-active` に CSS（Task 4）。

- [ ] **Step 4: テストを実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/TabBar.test.tsx`
Expected: PASS

- [ ] **Step 5: i18n キーを追加**（Task 10 で全言語 parity。ここでは ja を追加して緑を保つ）

`housing.tabs.browse/favorites/plan/tour/register/mypage/aria` を ja ロケールに追加（該当ブロックだけ textual 編集・[[feedback_locale_json_textual_edit]]）。

- [ ] **Step 6: コミット**

```bash
git add src/components/housing/shell/TabBar.tsx src/__tests__/housing/TabBar.test.tsx src/i18n/locales/ja/*
git commit -m "feat(housing): 上部タブバー(URL連動アクティブ)"
```

---

### Task 3: AppHeader（TopBar を再構成 = ロゴ/検索/TabBar/テーマ/通知/アバター）

**Files:**
- Modify: `src/components/housing/shell/AppHeader.tsx`（Task 1 のスタブを本実装）
- Reference: `src/components/housing/workspace/TopBar.tsx`（流用元・パネルトグルは削除、TabBar を中央に）
- Test: 既存 `AppHeader` は視覚主体のため render smoke のみ

**Interfaces:**
- Consumes: `TabBar`（Task 2）、`NotificationBell`（既存）、`useThemeStore`/`useAuthStore`/`useHousingModalStore`（既存）
- Produces: `AppHeader`（`data-region="header"` を維持）

- [ ] **Step 1: AppHeader を実装**（TopBar からパネルトグル/breadcrumb を除き、中央に TabBar・右にテーマ/通知/アバター・左にブランド・検索）

```tsx
// src/components/housing/shell/AppHeader.tsx
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../../../store/useThemeStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingModalStore } from '../../../store/useHousingModalStore';
import { NotificationBell } from '../notifications/NotificationBell';
import { TabBar } from './TabBar';

export const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);
  const profileAvatarUrl = useAuthStore((s) => s.profileAvatarUrl);
  const openLogin = useHousingModalStore((s) => s.openLogin);
  const openAccount = useHousingModalStore((s) => s.openAccount);

  return (
    <header className="housing-app-header" data-region="header">
      <button type="button" className="housing-brand" onClick={() => navigate('/')}
        aria-label={t('housing.workspace.topbar.home_aria')}>
        <span className="housing-brand-mark" aria-hidden="true" />
        <span>LoPo&nbsp;<span className="housing-brand-sub">/ {t('housing.workspace.topbar.subtitle')}</span></span>
      </button>

      {/* グローバル検索（第1スパンは見た目 + 探すのフィルタ store に将来接続。まず非機能プレースホルダで可） */}
      <div className="housing-app-search">
        <input type="search" className="housing-app-search-input"
          placeholder={t('housing.header.search_placeholder')}
          aria-label={t('housing.header.search_placeholder')} />
      </div>

      <TabBar />

      <div className="housing-app-header-right">
        {user && <NotificationBell />}
        <div className="housing-theme-toggle" role="tablist" aria-label={t('housing.workspace.topbar.theme_toggle_label')}>
          <button type="button" role="tab" aria-selected={theme === 'light'}
            className={theme === 'light' ? 'is-on' : ''} onClick={() => setTheme('light')}>
            <span aria-hidden="true">☀</span>{t('housing.workspace.topbar.theme_light')}
          </button>
          <button type="button" role="tab" aria-selected={theme === 'dark'}
            className={theme === 'dark' ? 'is-on' : ''} onClick={() => setTheme('dark')}>
            <span aria-hidden="true">☾</span>{t('housing.workspace.topbar.theme_dark')}
          </button>
        </div>
        {user ? (
          <button type="button" className="housing-top-avatar-btn" onClick={() => openAccount()}
            aria-label={t('housing.topbar.account')}>
            {profileAvatarUrl ? <img src={profileAvatarUrl} alt="" /> : <span className="housing-avatar-fallback">👤</span>}
          </button>
        ) : (
          <button type="button" className="housing-top-login-btn" onClick={() => openLogin()}>
            {t('housing.topbar.login')}
          </button>
        )}
      </div>
    </header>
  );
};
```

- [ ] **Step 2: render smoke テスト**（既存 `HousingShell.test.tsx` に header 内の TabBar リンクが出ることを 1 アサート追加）

```tsx
// HousingShell.test.tsx に追記
it('renders tab links inside header', () => {
  render(<MemoryRouter initialEntries={['/housing']}><Routes>
    <Route path="/housing" element={<HousingShell />}><Route index element={<BrowsePage />} /></Route>
  </Routes></MemoryRouter>);
  expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(6);
});
```

- [ ] **Step 3: 実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/HousingShell.test.tsx`
Expected: PASS

- [ ] **Step 4: i18n `housing.header.search_placeholder` を ja に追加してコミット**

```bash
git add src/components/housing/shell/AppHeader.tsx src/__tests__/housing/HousingShell.test.tsx src/i18n/locales/ja/*
git commit -m "feat(housing): AppHeader(ブランド/検索/タブ/テーマ/通知/アバター)"
```

---

### Task 4: デザイントークン + シェル/タブの chrome CSS（質感の土台）

**Files:**
- Modify: `src/styles/housing.css`（`.housing-workspace` 上部トークンブロックに追加 + 新クラス）

**視覚方針（具体・vague 禁止）:**
- レイアウト: `.housing-shell` は既存 workspace と同じ 3 段グリッド（ヘッダー / 1fr 本体 / ステータス）。ヘッダー高さトークン `--housing-header-h` を新設。
- ヘッダー内: `grid-template-columns: auto 1fr auto auto`（ブランド / 検索 / タブ / 右群）。タブは中央寄せ。
- タブ active 下線: `.housing-tab.is-active` に下線 + `color: var(--housing-candle)`。下線色は `--housing-honey`。既存の theme-toggle `.is-on` と同じ発色トークンを流用。
- パネル chrome（ガラス）は既存 `LiquidGlassPanel` を各ページで使うので、ここではヘッダー/タブ/ステータスの薄いガラス地のみ定義。
- 新トークン追加（値は mockup `index.html` の該当値を移植 + 実画面で微調整）: `--housing-header-h`, `--housing-tab-active`, `--housing-card-radius`, `--housing-tray-w`, `--housing-filter-w`, `--housing-ad-bg`, `--housing-step-blue`, `--housing-step-green`, `--housing-star-gold`。
- **ハードコード禁止厳守**: 追加 class 内の色/寸法/影は上記トークン参照。リテラルは housing.css の `:root`/`.housing-workspace` 定義箇所のみ許容。

- [ ] **Step 1: トークンを追加**（`src/styles/housing.css` の既存トークンブロックへ。mockup の対応値を移植）
- [ ] **Step 2: `.housing-shell-root` / `.housing-shell` / `.housing-shell-body` / `.housing-app-header` / `.housing-app-search` / `.housing-tabbar` / `.housing-tab(.is-active)` / `.housing-app-header-right` のレイアウト CSS を追加**
- [ ] **Step 3: ローカルで見た目確認**（`npm run dev` → `/housing`。ユーザーとヘッダー/タブの質感・間隔を実画面で調整）
- [ ] **Step 4: `npm run build` で tsc + Lightning CSS が通ることを確認**

Run: `npm run build`
Expected: 成功（backdrop-filter リテラル混入で警告が出たら変数パターンへ修正）

- [ ] **Step 5: コミット**

```bash
git add src/styles/housing.css
git commit -m "style(housing): シェル/タブの design token と chrome CSS"
```

---

### Task 5: ListingCard（生きたカード・段階1 = 静止代表画像 + ホバー演出）

**Files:**
- Create: `src/components/housing/browse/ListingCard.tsx`
- Test: `src/__tests__/housing/ListingCard.test.tsx`
- Reference: 既存カード（`RightPanelListItem` / `HousingCard` 系）の代表画像解決・`useHousingCardPlayback`

**Interfaces:**
- Consumes: `MockListing`（`src/data/housing/mockListings`）、`useHousingFavoritesStore`（`ids` / `toggle` 等の既存 API）
- Produces: `ListingCard: React.FC<{ listing: MockListing; onAddToTour: (id: string) => void }>`

- [ ] **Step 1: 失敗するテストを書く**（♡トグルと「ツアーに追加」ハンドラ）

```tsx
// src/__tests__/housing/ListingCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListingCard } from '../../components/housing/browse/ListingCard';
import { useHousingFavoritesStore } from '../../store/useHousingFavoritesStore';
import type { MockListing } from '../../data/housing/mockListings';

const L = { id: 'x1', area: 'Mist', ward: 5, plot: 10, size: 'M', imageMode: 'none', tags: [] } as unknown as MockListing;

beforeEach(() => { useHousingFavoritesStore.setState({ ids: [] } as never); });

describe('ListingCard', () => {
  it('calls onAddToTour with listing id', () => {
    const onAdd = vi.fn();
    render(<ListingCard listing={L} onAddToTour={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /ツアーに追加|add_to_tour/ }));
    expect(onAdd).toHaveBeenCalledWith('x1');
  });
  it('toggles favorite on heart click', () => {
    render(<ListingCard listing={L} onAddToTour={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /favorite|お気に入り/ }));
    expect(useHousingFavoritesStore.getState().ids).toContain('x1');
  });
});
```

> 実行前に `useHousingFavoritesStore` の実 API（`toggle`/`add`/`ids` の正確な名前）を確認し、テストと実装を合わせる。名前が違えば本 Step のテストを実 API 名に合わせて修正（推測で進めない・[[feedback_evidence_based_work]]）。

- [ ] **Step 2: 実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/ListingCard.test.tsx`
Expected: FAIL

- [ ] **Step 3: ListingCard を実装**（代表画像 or プレースホルダ + タイトル/住所/タグ + ♡ + 「ツアーに追加」。住所表示は既存 `formatHousingAddress` を使用）

```tsx
// src/components/housing/browse/ListingCard.tsx  （骨格。視覚詳細は Task 4 のトークン + 参考画像1枚目で live 調整）
import { useTranslation } from 'react-i18next';
import { Heart, Plus } from 'lucide-react';
import type { MockListing } from '../../../data/housing/mockListings';
import { useHousingFavoritesStore } from '../../../store/useHousingFavoritesStore';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';

export interface ListingCardProps { listing: MockListing; onAddToTour: (id: string) => void; }

export const ListingCard: React.FC<ListingCardProps> = ({ listing, onAddToTour }) => {
  const { t } = useTranslation();
  const favIds = useHousingFavoritesStore((s) => s.ids);
  const toggleFav = useHousingFavoritesStore((s) => s.toggle); // ← 実 API 名に合わせる
  const isFav = favIds.includes(listing.id);

  return (
    <article className="housing-listing-card" style={{ contentVisibility: 'auto' } as React.CSSProperties}>
      <div className="housing-listing-card-media">
        {/* 段階1: 静止代表画像。段階2で spotlight 動画（Task 外/次段階） */}
        <button type="button" className={`housing-card-fav${isFav ? ' is-on' : ''}`}
          aria-label={t('housing.card.favorite')} aria-pressed={isFav}
          onClick={() => toggleFav(listing.id)}>
          <Heart size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="housing-listing-card-body">
        <div className="housing-listing-card-title">{formatHousingAddress(listing, t)}</div>
        <div className="housing-listing-card-tags">
          {listing.tags.slice(0, 3).map((tag) => <span key={tag} className="housing-pill">{tag}</span>)}
        </div>
        <button type="button" className="housing-card-add-btn" onClick={() => onAddToTour(listing.id)}>
          <Plus size={14} aria-hidden="true" />{t('housing.card.add_to_tour')}
        </button>
      </div>
    </article>
  );
};
```

> `contentVisibility:'auto'` は多数カードの描画スキップ（[[reference_perf_content_visibility]]）。`contain-intrinsic-size` は CSS 側（`.housing-listing-card`）で高さ見積を与える。`formatHousingAddress` の正確な引数シグネチャを実ファイルで確認して合わせる。

- [ ] **Step 4: 実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/ListingCard.test.tsx`
Expected: PASS

- [ ] **Step 5: i18n `housing.card.favorite`/`housing.card.add_to_tour` を ja 追加 → コミット**

```bash
git add src/components/housing/browse/ListingCard.tsx src/__tests__/housing/ListingCard.test.tsx src/i18n/locales/ja/*
git commit -m "feat(housing): 生きたカード段階1(静止+♡+ツアー追加)"
```

---

### Task 6: TourTray（既存 TourBuilderPane を昇格 = 番号/並べ替え/×/開始/推定時間）

**Files:**
- Create: `src/components/housing/browse/TourTray.tsx`
- Reference: `src/components/housing/workspace/TourBuilderPane.tsx`（既存の並べ替え/自動ソート/DnD ロジックを流用）
- Test: `src/__tests__/housing/TourTray.test.tsx`

**Interfaces:**
- Consumes: `MockListing[]`、`useHousingTourStore`（`setListings`/`start`）、`useHousingViewStore`（`enterTourMode`）
- Produces: `TourTray: React.FC<{ listingIds: string[]; onChange: (ids: string[]) => void; onStart: () => void }>`

- [ ] **Step 1: 失敗するテストを書く**（開始ハンドラが呼ばれる / 空なら無効）

```tsx
// src/__tests__/housing/TourTray.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TourTray } from '../../components/housing/browse/TourTray';

vi.mock('../../store/useHousingListingsStore', () => ({
  useHousingListingsStore: (sel: (s: unknown) => unknown) => sel({ listings: [
    { id: 'a', area: 'Mist', ward: 1, plot: 1, size: 'M', imageMode: 'none', tags: [] },
  ] }),
}));

describe('TourTray', () => {
  it('disables start when empty', () => {
    render(<TourTray listingIds={[]} onChange={() => {}} onStart={() => {}} />);
    expect((screen.getByRole('button', { name: /開始|start/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('calls onStart when items present', () => {
    const onStart = vi.fn();
    render(<TourTray listingIds={['a']} onChange={() => {}} onStart={onStart} />);
    fireEvent.click(screen.getByRole('button', { name: /開始|start/ }));
    expect(onStart).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/TourTray.test.tsx`
Expected: FAIL

- [ ] **Step 3: TourTray を実装**（listingIds → listings 解決、番号付きリスト、× 削除で onChange、「この内容で開始」で onStart。DnD 並べ替えは TourBuilderPane の実装を移植。推定時間は既存があれば流用、なければ件数表示のみ）

> 実装は TourBuilderPane を読み、DnD/自動ソート部分を抽出して TourTray に載せる。第1スパンでは並べ替え + 削除 + 開始が動けば十分（推定時間の精緻化は組むスパン）。

- [ ] **Step 4: 実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/TourTray.test.tsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/browse/TourTray.tsx src/__tests__/housing/TourTray.test.tsx
git commit -m "feat(housing): TourTray(番号/並べ替え/削除/開始)"
```

---

### Task 7: AdSlot（最小広告予約枠）

**Files:**
- Create: `src/components/housing/shell/AdSlot.tsx`

**Interfaces:**
- Produces: `AdSlot: React.FC<{ slot: string }>`（`slot` = 配置識別子。今は "Sponsored" プレースホルダ表示のみ）

- [ ] **Step 1: 実装**

```tsx
// src/components/housing/shell/AdSlot.tsx
import { useTranslation } from 'react-i18next';
export const AdSlot: React.FC<{ slot: string }> = ({ slot }) => {
  const { t } = useTranslation();
  return (
    <div className="housing-ad-slot" data-ad-slot={slot} aria-hidden="true">
      <span className="housing-ad-slot-label">{t('housing.ad.sponsored')}</span>
    </div>
  );
};
```

- [ ] **Step 2: i18n `housing.ad.sponsored` を ja 追加、CSS `.housing-ad-slot` を housing.css に（薄い予約枠・`--housing-ad-bg`）**
- [ ] **Step 3: コミット**

```bash
git add src/components/housing/shell/AdSlot.tsx src/styles/housing.css src/i18n/locales/ja/*
git commit -m "feat(housing): 最小の広告予約枠 AdSlot"
```

---

### Task 8: BrowsePage 組み立て（3カラム + 実データ配線）

**Files:**
- Modify: `src/components/housing/pages/BrowsePage.tsx`（Task 1 スタブを本実装）
- Create: `src/components/housing/browse/ListingGrid.tsx`
- Reference: 既存 `CenterArea` / `FilterPanel` / `applyFilters` / `EmptyResult`
- Test: `src/__tests__/housing/BrowsePage.test.tsx`

**Interfaces:**
- Consumes: `useHousingListingsStore`(status/listings)、`useHousingFilterStore`(dc/regions/servers/areas/sizes/tags)、`applyFilters`、`ListingCard`(Task5)、`TourTray`(Task6)、`FilterPanel`(既存)、`AdSlot`(Task7)
- Produces: `BrowsePage`（3カラム: 左フィルター / 中央グリッド / 右トレイ）

- [ ] **Step 1: 失敗するテストを書く**（実データを store に注入 → カードが件数分出る）

```tsx
// src/__tests__/housing/BrowsePage.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { BrowsePage } from '../../components/housing/pages/BrowsePage';
import { useHousingListingsStore } from '../../store/useHousingListingsStore';

const mk = (id: string) => ({ id, area: 'Mist', ward: 1, plot: 1, size: 'M', imageMode: 'none', tags: [] });

beforeEach(() => {
  useHousingListingsStore.setState({ status: 'ready', listings: [mk('a'), mk('b')], error: null } as never);
});

describe('BrowsePage', () => {
  it('renders a card per filtered listing', () => {
    render(<MemoryRouter><BrowsePage /></MemoryRouter>);
    expect(screen.getAllByRole('article').length).toBe(2);
  });
});
```

- [ ] **Step 2: 実行して失敗を確認**

Run: `npx vitest run src/__tests__/housing/BrowsePage.test.tsx`
Expected: FAIL

- [ ] **Step 3: ListingGrid を実装**（一覧/マップ/ルート切替を出すが、第1スパンは「一覧」のみ実装。マップ/ルートは disabled or 「準備中」。filtered listings を ListingCard で描画）
- [ ] **Step 4: BrowsePage を実装**（左 `FilterPanel`(既存を GlassPanel でラップ) / 中央 `ListingGrid` / 右 `TourTray`。tourIds はローカル state or tour store のドラフト。空/loading/error は既存表示を流用。左右下部に `AdSlot`）

```tsx
// BrowsePage 骨格（抜粋）
const filtered = useMemo(() => applyFilters(listings, { dc, regions, servers, areas, sizes, tags }),
  [listings, dc, regions, servers, areas, sizes, tags]);
// grid: filtered.map((l) => <ListingCard key={l.id} listing={l} onAddToTour={addToTray} />)
```

- [ ] **Step 5: 実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/BrowsePage.test.tsx`
Expected: PASS

- [ ] **Step 6: ローカル実画面確認**（`npm run dev` → `/housing`。グリッド/フィルター/トレイの見た目をユーザーと調整）
- [ ] **Step 7: コミット**

```bash
git add src/components/housing/pages/BrowsePage.tsx src/components/housing/browse/ListingGrid.tsx src/__tests__/housing/BrowsePage.test.tsx
git commit -m "feat(housing): 探すページ(3カラム+実データ配線)"
```

---

### Task 9: 「この内容で開始」→ ツアー組成 + /housing/tour へ遷移

**Files:**
- Modify: `src/components/housing/pages/BrowsePage.tsx`（onStart 実装）
- Test: `src/__tests__/housing/BrowsePage.test.tsx`（開始で tour store がセットされる）

**Interfaces:**
- Consumes: `useHousingTourStore.setListings/start`、`useHousingViewStore.enterTourMode`、`useNavigate`

- [ ] **Step 1: 失敗するテストを追記**（onStart で tour store の listingIds がセットされる）

```tsx
it('sets tour listings and enters tour mode on start', () => {
  // トレイに a を積んだ状態を作り、開始ボタン押下 → useHousingTourStore.getState().listingIds が ['a']
  // （実装に合わせてトレイ追加操作 or 初期 tourIds を注入）
});
```

- [ ] **Step 2: onStart を実装**

```tsx
const navigate = useNavigate();
const onStart = () => {
  if (trayIds.length === 0) return;
  useHousingTourStore.getState().setListings(trayIds);
  useHousingTourStore.getState().start();
  useHousingViewStore.getState().enterTourMode();
  navigate('/housing/tour');   // ナビ画面本体は次スパン。既存 tour 表示 or 準備中に着地
};
```

- [ ] **Step 3: 実行して通過を確認**

Run: `npx vitest run src/__tests__/housing/BrowsePage.test.tsx`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add src/components/housing/pages/BrowsePage.tsx src/__tests__/housing/BrowsePage.test.tsx
git commit -m "feat(housing): 探すからツアー組成→/housing/tour 遷移"
```

---

### Task 10: 未実装タブの暫定着地 + i18n parity + 全体緑化

**Files:**
- Modify: `src/App.tsx`（favorites/plan/tour/register/mypage の暫定子ルート）
- Create: `src/components/housing/pages/ComingSoonPage.tsx`（「準備中」プレースホルダ）
- Modify: `src/i18n/locales/{en,ko,zh}/*`（ja に追加したキーの parity）

- [ ] **Step 1: ComingSoonPage を作成**（i18n `housing.coming_soon`。中央にメッセージ）
- [ ] **Step 2: App.tsx に暫定子ルートを追加**

```tsx
<Route path="/housing" element={<HousingShell />}>
  <Route index element={<BrowsePage />} />
  <Route path="favorites" element={<ComingSoonPage tab="favorites" />} />
  <Route path="plan" element={<ComingSoonPage tab="plan" />} />
  <Route path="tour" element={<ComingSoonPage tab="tour" />} />
  <Route path="register" element={<ComingSoonPage tab="register" />} />
  <Route path="mypage" element={<ComingSoonPage tab="mypage" />} />
</Route>
```

> 各タブは次スパンで本実装に差し替え。register は当面 `HousingRegisterFormModal` を開くだけでもよいが、本プランでは ComingSoon に統一（実装スパンで置換）。

- [ ] **Step 3: 追加した全 i18n キーを en/ko/zh に parity 追加**（該当ブロックのみ textual 編集・[[feedback_locale_json_textual_edit]]。ko/zh 訳は既存語彙に合わせる）
- [ ] **Step 4: 全テスト + ビルド**

Run: `npx vitest run` （pool='vmThreads'・パイプしない）
Expected: 緑（既知 failing だった `HousingWorkspace.test.tsx`/`TopBar.test.tsx` は本再構成で解消 or 再定義済み。残存があれば追従修正）

Run: `npm run build`
Expected: 成功（tsc 厳密・未使用 import 掃除）

- [ ] **Step 5: ハードコード自己監査**

Run: `git grep -nE "rgb\(|rgba\(|#[0-9a-fA-F]{3,8}|[0-9]px;" -- src/components/housing/shell src/components/housing/browse src/components/housing/pages`
Expected: コンポーネント側にリテラルが残っていない（housing.css のみ許容）。残っていれば token 化。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat(housing): 未実装タブの暫定着地 + i18n parity + 緑化"
```

---

## Self-Review 結果（spec との突き合わせ）

- **spec §3 IA/ルーティング** → Task 1（HousingShell+ネスト）/ Task 2（TabBar）/ Task 10（暫定子ルート）で網羅。
- **spec §4 デザインシステム/部品** → Task 3(AppHeader) / 4(トークン+chrome) / 5(ListingCard) / 6(TourTray) / 7(AdSlot)。
- **spec §5 探すレイアウト** → Task 8 / 9。
- **spec §6 生きたカード段階導入** → Task 5 が段階1（静止+content-visibility）。段階2（動画spotlight）は明示的に本スパン外（spec §2 スコープ外と一致）。
- **spec §7 移行方針** → 据え置き（HousingWorkspace/FavoritesModal/Register 残置）を Task 1 Step 6 / Task 10 で担保。
- **spec §8 成功基準** → Task 10 Step 4/5 でビルド緑・ハードコード監査。タブ6/探す実動は Task 2/8/9。
- **未解決の前提**: `useHousingFavoritesStore` の toggle API 名・`formatHousingAddress` シグネチャ・`TourBuilderPane` の DnD 実装は、各 Task の Step で**実ファイル確認してから**合わせる（推測禁止・[[feedback_evidence_based_work]]）。
- **型整合**: `ListingCard`(onAddToTour: (id)=>void) / `TourTray`(onStart:()=>void, onChange:(ids)=>void) は Task 5/6/8/9 で一貫。
