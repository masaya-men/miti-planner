# ハウジングツアー中央地図 Phase 3（レイアウト再編・左右役割入替）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー中(Nav)ページ `/housing/tour` の左右カラムを役割で入れ替える — **左＝目的地ショーケース**（写真＋詳細＋操作＋報告）/ **中央＝地図**（不変）/ **右＝ツアー進行状況**（進捗リング＋到着/残り＋**全ステップ縦リスト**）。ステップ一覧をショーケースから進行状況へ移設し、重複する「次に訪れる場所カード」「最近訪れた場所リスト」を撤去する。

**Architecture:**
- 表示専用の 2 パネル（`TourProgressPanel` / `TourNextDestinationPanel`）とオーケストレーター（`TourNavPage`）の役割付け替え。データ解決・store 配線は `TourNavPage` に集約されたまま（非破壊）。
- ステップ一覧 `TourRouteSteps`（`steps` + `currentIndex` を受け取る表示専用）を、ショーケース側から進行状況側へ「移動」するだけ（コンポーネント自体は不変）。進行状況パネルは `progress` に加えて `steps` + `currentIndex` を受け取るよう prop を拡張。
- カラム幅は **ツアー専用トークン**（`--housing-tour-showcase-w` / `--housing-tour-progress-w`）を新設して `.housing-tour-page` のグリッドを差し替える。共有トークン `--housing-left-w` / `--housing-right-w`（workspace 等が参照）は**変更しない**。
- **見学タイマー**と**生きたカード（スライドショー/動画）**は本フェーズ対象外（それぞれ Phase 4 / Phase 5）。写真枠は静止画のまま。右カラムは flex 縦積みなので、Phase 4 でタイマー節を足す余白は自然に確保される。

**Tech Stack:** React 18 + TypeScript（strict, `tsc -b`）、Vitest（happy-dom）、`react-i18next`、CSS 変数（`--housing-*` トークン）、CSS Grid。

## Global Constraints

- **ハウジング独自トンマナ**（`.claude/rules/housing-design.md`）。既存 LoPo 白黒ルールは対象外。色・寸法・影は `--housing-*` トークン経由、**ハードコード禁止**（`aspect-*` / `gap-N` 等の純ユーティリティのみ例外）。新規トークンは `src/styles/housing.css` の Layout tokens ブロックに定義。
- **文字列は i18n キー経由**（`.claude/rules/i18n.md`）。本フェーズは**新規 UI 文字列を追加しない**（既存キーの再配置のみ）。撤去する「次に訪れる場所 / 最近訪れた場所」の i18n キー（`housing.tour.nav.next_place` / `.recent`）は**死にキー化するが削除しない**（4 言語 JSON のカンマ事故を避ける・別掃除タスク）。
- **共有コード・DEV を壊さない**: `TourRouteSteps` コンポーネントの実装は不変。`.housing-tour-map-*` 系（DEV 経路エディタと共有）には触れない。共有トークン `--housing-left-w` / `--housing-right-w` は不変。
- **完了ゲート**: `npm run build`（tsc -b 厳密）EXIT0 + `npx vitest run`（既知 legacy 5 fail = TopBar4 + HousingWorkspace1 以外の新規 fail ゼロ）。見た目（左右入替後のレイアウト・カラム幅・ステップ一覧の収まり）は開発者の実画面 CSS `1489x679` / DPR `2.58` でユーザー実機ゲート。
- **DEV 変更後はハードリロード必須**（[[reference_dev_editor_hmr_hardreload]]）。

## File Structure

| ファイル | 役割 | 本フェーズの変更 |
|---|---|---|
| `src/components/housing/pages/TourNavPage.tsx` | オーケストレーター（store 購読 + データ解決 + パネルへ配線） | ショーケースを `data-region="left"`、進行状況を `data-region="right"` に入替。進行状況へ `steps` + `currentIndex` を配線、ショーケースから `steps` を外す。import 名を `TourShowcasePanel` に更新 |
| `src/components/housing/tour/TourProgressPanel.tsx` | 右カラム＝進行状況（表示専用） | `steps` + `currentIndex` prop を追加し `<TourRouteSteps>` を描画。「次の場所カード」「最近リスト」を撤去。不要になった import を削除 |
| `src/components/housing/tour/TourShowcasePanel.tsx`（← `TourNextDestinationPanel.tsx` を改名） | 左カラム＝目的地ショーケース（表示専用） | `steps` prop と `<TourRouteSteps>` を撤去（進行状況へ移設）。export/JSDoc を新役割へ更新 |
| `src/components/housing/tour/TourRouteSteps.tsx` | ステップ一覧（表示専用） | **不変**（進行状況パネルから呼ばれるようになるだけ） |
| `src/styles/housing.css` | スタイル | ツアー専用カラム幅トークン新設 + `.housing-tour-page` グリッド差し替え |
| `src/components/housing/tour/__tests__/TourProgressPanel.test.tsx` | 進行状況テスト | `steps`/`currentIndex` を渡すよう更新。ステップ見出しの存在を assert、旧「次に訪れる場所」を撤去確認 |
| `src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx`（← `TourNextDestinationPanel.test.tsx` を改名） | ショーケーステスト | import 名更新、`steps`/`TourRouteSteps` 依存の describe を撤去 |
| `src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`（新設） | ステップ一覧の単体テスト | 旧 NextDest テストにあった `TourRouteSteps` 単体 describe をここへ移設 |

---

### Task 1: 進行状況パネルがステップ一覧を取り込む（「次の場所」「最近」を撤去）

進行状況パネル（右カラム）に全ステップ縦リストを移設し、重複する「次に訪れる場所カード」「最近訪れた場所リスト」を撤去する。ステップ一覧は各ステップの状態（到着済み/次に訪問/未到着）を出すため、次/最近は情報として包含される。

**Files:**
- Modify: `src/components/housing/tour/TourProgressPanel.tsx`（`:1-89` 全体）
- Modify: `src/components/housing/pages/TourNavPage.tsx`（`:164` の `<TourProgressPanel>` 呼び出しに `steps` + `currentIndex` を追加）
- Modify: `src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`（`:35-61` renderPanel と describe を更新）

**Interfaces:**
- Consumes: `TourProgress`（`tourNav.ts`。`{ total, arrivedCount, remainingCount, percent, currentStep, recent }`）、`TourStep[]`（`tourNav.ts`）、`TourRouteSteps`（`./TourRouteSteps`。props `{ steps: TourStep[]; currentIndex: number }`）。
- Produces: 新 prop 型 `TourProgressPanelProps = { progress: TourProgress; steps: TourStep[]; currentIndex: number; onFinish: () => void }`。DOM 上で `.housing-tour-steps`（TourRouteSteps 由来）が進行状況パネル配下に現れる。`.housing-tour-progress-next-card` / `.housing-tour-progress-recent-list` は消える。

- [ ] **Step 1: テストを先に更新して失敗させる**

`src/components/housing/tour/__tests__/TourProgressPanel.test.tsx` の import に `TourStep` と `TourRouteSteps` 見出し検証用の準備を追加する。`:8-9` の下に steps を用意し（`baseProgress` の直後）、`renderPanel` を steps/currentIndex を渡す形へ更新する。

`:9` の import 群の後に追加:
```tsx
import type { TourStep } from '../../../../lib/housing/tourNav';
```

`:24`（`baseProgress` 定義の後）に追加:
```tsx
const steps: TourStep[] = [
  { id: nextListing.id, listing: nextListing },
  { id: recentListing.id, listing: recentListing },
];
```

`:35-41` の `renderPanel` を差し替え:
```tsx
function renderPanel(props: Partial<Parameters<typeof TourProgressPanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourProgressPanel
        progress={baseProgress}
        steps={steps}
        currentIndex={0}
        onFinish={() => {}}
        {...props}
      />
    </I18nextProvider>
  );
}
```

`:57-60` の「次に訪れる場所の住所が出る」テストを、次の 2 テストへ置き換え（旧「次の場所カード」「最近リスト」を撤去し、ステップ一覧が出ることを検証）:
```tsx
  it('全ステップ縦リスト（ルートのステップ）が出る', () => {
    const { container } = renderPanel();
    expect(screen.getByText('ルートのステップ')).toBeInTheDocument();
    expect(container.querySelectorAll('.housing-tour-steps-item')).toHaveLength(steps.length);
  });

  it('旧「次に訪れる場所カード」「最近訪れた場所リスト」は撤去済み', () => {
    const { container } = renderPanel();
    expect(container.querySelector('.housing-tour-progress-next-card')).toBeNull();
    expect(container.querySelector('.housing-tour-progress-recent-list')).toBeNull();
  });
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`
Expected: FAIL（`TourProgressPanel` はまだ `steps` prop を受けず `.housing-tour-steps` を描画しない。かつ `.housing-tour-progress-next-card` がまだ存在するため上記 2 テストが落ちる）

- [ ] **Step 3: TourProgressPanel を実装（ステップ一覧を取り込み、次/最近を撤去）**

`src/components/housing/tour/TourProgressPanel.tsx` を次で全置換:
```tsx
import { useTranslation } from 'react-i18next';
import { ProgressRing } from './ProgressRing';
import { TourRouteSteps } from './TourRouteSteps';
import type { TourProgress, TourStep } from '../../../lib/housing/tourNav';

export interface TourProgressPanelProps {
  progress: TourProgress;
  steps: TourStep[];
  currentIndex: number;
  onFinish: () => void;
}

/**
 * 右カラム: ツアー進行状況パネル (表示専用)。
 * リング + 到着済み/残り軒数 + 全ステップ縦リスト (TourRouteSteps) + 「ツアーを終了」。
 * Phase 3 で左右役割を入替え、ステップ一覧をここ (旧 NextDestination) から移設した。
 * store 配線・データ解決は TourNavPage が担う。ここは progress/steps/currentIndex を渡されるだけ。
 */
export const TourProgressPanel: React.FC<TourProgressPanelProps> = ({
  progress,
  steps,
  currentIndex,
  onFinish,
}) => {
  const { t } = useTranslation();
  const { total, arrivedCount, remainingCount, percent } = progress;

  return (
    <div className="housing-tour-progress">
      <div className="housing-tour-progress-head">
        <span className="housing-tour-progress-title">{t('housing.tour.nav.progress.label')}</span>
        <span className="housing-tour-progress-count">
          {t('housing.tour.nav.progress.done_of_total', { done: arrivedCount, total })}
        </span>
      </div>

      <ProgressRing percent={percent} />

      <div className="housing-tour-progress-stats">
        <div className="housing-tour-progress-stat">
          <span className="housing-tour-progress-stat-value">{arrivedCount}</span>
          <span className="housing-tour-progress-stat-label">
            {t('housing.tour.nav.progress.arrived')}
          </span>
        </div>
        <div className="housing-tour-progress-stat">
          <span className="housing-tour-progress-stat-value">{remainingCount}</span>
          <span className="housing-tour-progress-stat-label">
            {t('housing.tour.nav.progress.remaining')}
          </span>
        </div>
      </div>

      <TourRouteSteps steps={steps} currentIndex={currentIndex} />

      <button type="button" className="housing-tour-progress-finish" onClick={onFinish}>
        {t('housing.tour.nav.finish')}
      </button>
    </div>
  );
};
```

（撤去した import: `formatHousingAddress` / `representativeImage`。撤去した描画: `next_place` セクション + `recent` セクション。`currentStep` / `recent` は `progress` 型には残るが本パネルでは未使用。）

- [ ] **Step 4: TourNavPage の呼び出しへ steps/currentIndex を配線**

`src/components/housing/pages/TourNavPage.tsx` `:162-166` の左カラム `<TourProgressPanel>` 呼び出しを更新（この時点では進行状況はまだ左カラム。region 入替は Task 3）:
```tsx
      <section className="housing-tour-page-panel" data-region="left">
        <div className="housing-tour-page-col">
          <TourProgressPanel progress={progress} steps={steps} currentIndex={currentIndex} onFinish={onFinish} />
        </div>
      </section>
```

- [ ] **Step 5: テスト実行して緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourProgressPanel.test.tsx`
Expected: PASS（percent / 到着済み・残り / ステップ一覧 / 次・最近の撤去 / ツアー終了 の全テスト緑）

- [ ] **Step 6: 全体ビルドで型を確認**

Run: `npm run build`
Expected: EXIT0（`TourNavPage` が `steps`/`currentIndex` を渡すため型不整合なし）

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/tour/TourProgressPanel.tsx src/components/housing/pages/TourNavPage.tsx src/components/housing/tour/__tests__/TourProgressPanel.test.tsx
git commit -m "feat(housing-tour): 進行状況パネルへ全ステップ縦リストを移設し次/最近カードを撤去 (Phase3-1)"
```

---

### Task 2: ショーケースパネルへ改名し、ステップ一覧を手放す

`TourNextDestinationPanel` は Phase 3 で左カラムの「目的地ショーケース」になる。ステップ一覧は Task 1 で進行状況へ移設済みのため、本パネルからは `steps` prop と `<TourRouteSteps>` を外す。役割が変わるので `TourShowcasePanel` へ改名する。

**Files:**
- Rename: `src/components/housing/tour/TourNextDestinationPanel.tsx` → `TourShowcasePanel.tsx`（`git mv`）
- Modify: 上記（`steps` prop / `TourRouteSteps` を撤去、export/JSDoc 更新）
- Modify: `src/components/housing/pages/TourNavPage.tsx`（`:15` import、`:181-189` 呼び出しから `steps` を外す）
- Rename: `src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx` → `TourShowcasePanel.test.tsx`（`git mv`）
- Modify: 上記（import 名更新・`steps` 依存 describe を撤去）
- Create: `src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`（`TourRouteSteps` 単体 describe をここへ移設）

**Interfaces:**
- Consumes: `TourStep`（`currentStep` 用に維持）、`formatHousingAddress` / `representativeImage` / `getPlotDirections`（詳細カード用に維持）。
- Produces: 新コンポーネント `TourShowcasePanel`、prop 型 `TourShowcasePanelProps = { currentStep: TourStep | null; currentIndex: number; isLast: boolean; onPrev: () => void; onPrimary: () => void; onOpenReport: () => void }`（`steps` を削除）。`.housing-tour-dest-*` の CSS クラス名は**不変**（内部クラスのため改名しない・CSS 差分を最小化）。

- [ ] **Step 1: TourRouteSteps 単体テストを新ファイルへ移設**

新規作成 `src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`。旧 `TourNextDestinationPanel.test.tsx` `:170-220` の `describe('TourRouteSteps — 状態バッジ / 注記', ...)` をそのまま移す（import は自己完結にする）:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../../../locales/ja.json';
import { MOCK_LISTINGS } from '../../../../data/housing/mockListings';
import type { TourStep } from '../../../../lib/housing/tourNav';

import { TourRouteSteps } from '../TourRouteSteps';

const currentListing = MOCK_LISTINGS[0];
const mistListing = MOCK_LISTINGS[4];

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
});

describe('TourRouteSteps — 状態バッジ / 注記', () => {
  const mixedSteps: TourStep[] = [
    { id: mistListing.id, listing: mistListing }, // index0: 到着済み (ミスト・plotあり→配置可能)
    { id: currentListing.id, listing: currentListing }, // index1: 次に訪問 (シロガネ・plotあり→配置可能)
    { id: 'missing-1', listing: null }, // index2: 未到着 (欠落)
  ];

  function renderSteps(currentIndex = 1) {
    return render(
      <I18nextProvider i18n={i18n}>
        <TourRouteSteps steps={mixedSteps} currentIndex={currentIndex} />
      </I18nextProvider>
    );
  }

  it('各ステップの状態が stepStatus 通りに data-status / class へ反映される', () => {
    const { container } = renderSteps(1);
    const items = container.querySelectorAll('.housing-tour-steps-item');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('data-status', 'arrived');
    expect(items[0]).toHaveClass('housing-tour-steps-item--arrived');
    expect(items[1]).toHaveAttribute('data-status', 'current');
    expect(items[1]).toHaveClass('housing-tour-steps-item--current');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[2]).toHaveAttribute('data-status', 'upcoming');
    expect(items[2]).toHaveClass('housing-tour-steps-item--upcoming');
  });

  it('plot無しhouse (地図に解決できない) のステップに map_pending 注記が出る', () => {
    const noPlotHouse = { ...currentListing, buildingType: 'house' as const, plot: undefined };
    const noPlotSteps: TourStep[] = [{ id: noPlotHouse.id, listing: noPlotHouse }];
    render(
      <I18nextProvider i18n={i18n}>
        <TourRouteSteps steps={noPlotSteps} currentIndex={0} />
      </I18nextProvider>
    );
    expect(screen.getByText('地図データなし（区画情報なし）')).toBeInTheDocument();
  });

  it('listing===null のステップに missing 注記が出る (address の代わりに表示)', () => {
    renderSteps(1);
    expect(screen.getByText('このハウジングは見つかりません')).toBeInTheDocument();
  });

  it('plotありのステップ (全エリア) には map_pending 注記が出ない', () => {
    const { container } = renderSteps(1);
    const items = container.querySelectorAll('.housing-tour-steps-item');
    expect(items[0].querySelector('.housing-tour-steps-note')).toBeNull(); // Mist
    expect(items[1].querySelector('.housing-tour-steps-note')).toBeNull(); // Shirogane (非ミスト)
  });
});
```

- [ ] **Step 2: コンポーネントとテストを git mv で改名**

```bash
git mv src/components/housing/tour/TourNextDestinationPanel.tsx src/components/housing/tour/TourShowcasePanel.tsx
git mv src/components/housing/tour/__tests__/TourNextDestinationPanel.test.tsx src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx
```

- [ ] **Step 3: TourShowcasePanel から steps/TourRouteSteps を撤去し改名**

`src/components/housing/tour/TourShowcasePanel.tsx` を次で全置換:
```tsx
import { useTranslation } from 'react-i18next';
import type { TourStep } from '../../../lib/housing/tourNav';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import { representativeImage } from '../../../lib/housing/representativeImage';
import { getPlotDirections } from '../../../lib/housing/wardDirections';

export interface TourShowcasePanelProps {
  currentStep: TourStep | null;
  currentIndex: number;
  isLast: boolean;
  onPrev: () => void;
  onPrimary: () => void;
  onOpenReport: () => void;
}

/**
 * 左カラム: 目的地ショーケース (表示専用)。
 *
 * 今向かうハウジングの魅力を大きく見せる — 写真 + 詳細 (タイトル/住所/サイズ/ワールド/
 * ひとことメモ/行き方) + 操作 (前へ/主ボタン/報告)。
 * Phase 3 で右カラム「次の目的地」から左カラム「ショーケース」へ役割変更。ステップ一覧は
 * 進行状況パネル (右) へ移設した。写真は静止画 (生きたカードは Phase 5)。
 * store 配線・データ解決・onPrev/onPrimary/onOpenReport の中身は TourNavPage が担う。
 */
export const TourShowcasePanel: React.FC<TourShowcasePanelProps> = ({
  currentStep,
  currentIndex,
  isLast,
  onPrev,
  onPrimary,
  onOpenReport,
}) => {
  const { t, i18n } = useTranslation();
  const listing = currentStep?.listing ?? null;
  const isApartment = listing?.buildingType === 'apartment';
  const directions = getPlotDirections(listing?.area ?? '', listing?.plot);

  return (
    <div className="housing-tour-dest">
      {listing && (
        <div className="housing-tour-dest-card">
          <img
            className="housing-tour-dest-thumb"
            src={representativeImage(listing)}
            alt=""
            loading="lazy"
          />
          <div className="housing-tour-dest-head">
            <h2 className="housing-tour-dest-title">
              {listing.title?.trim() || formatHousingAddress(listing, i18n.language)}
            </h2>
            <span className="housing-tour-dest-world">
              {listing.dc} / {listing.server}
            </span>
          </div>

          <dl className="housing-tour-dest-facts">
            <div className="housing-tour-dest-fact">
              <dt className="housing-tour-dest-fact-label">
                {t('housing.tour.nav.dest.address')}
              </dt>
              <dd className="housing-tour-dest-fact-value">
                {formatHousingAddress(listing, i18n.language)}
              </dd>
            </div>
            {!isApartment && listing.size && (
              <div className="housing-tour-dest-fact">
                <dt className="housing-tour-dest-fact-label">
                  {t('housing.tour.nav.dest.size')}
                </dt>
                <dd className="housing-tour-dest-fact-value">{listing.size}</dd>
              </div>
            )}
            <div className="housing-tour-dest-fact">
              <dt className="housing-tour-dest-fact-label">
                {t('housing.tour.nav.dest.world')}
              </dt>
              <dd className="housing-tour-dest-fact-value">{listing.server}</dd>
            </div>
            <div className="housing-tour-dest-fact">
              <dt className="housing-tour-dest-fact-label">
                {t('housing.tour.nav.dest.memo')}
              </dt>
              <dd className="housing-tour-dest-fact-value">
                {listing.description?.trim() ? listing.description : t('housing.tour.nav.dest.no_memo')}
              </dd>
            </div>
          </dl>

          {directions && (
            <div className="housing-tour-dest-route">
              <span className="housing-tour-dest-route-label">
                {t('housing.tour.nav.dest.directions')}
              </span>
              <p className="housing-tour-dest-route-teleport">
                {t('housing.tour.nav.dest.teleport_to', { aetheryte: directions.aetheryte })}
              </p>
              {directions.directions && (
                <p className="housing-tour-dest-route-walk">{directions.directions}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="housing-tour-dest-actions">
        <button
          type="button"
          className="housing-tour-dest-prev"
          onClick={onPrev}
          disabled={currentIndex === 0}
        >
          {t('housing.tour.nav.actions.prev')}
        </button>
        <button type="button" className="housing-tour-dest-primary" onClick={onPrimary}>
          {t(isLast ? 'housing.tour.nav.actions.complete' : 'housing.tour.nav.actions.arrive_next')}
        </button>
      </div>

      <button type="button" className="housing-tour-dest-report" onClick={onOpenReport}>
        {t('housing.tour.nav.report_button')}
      </button>
    </div>
  );
};
```

- [ ] **Step 4: TourNavPage の import と呼び出しを更新**

`src/components/housing/pages/TourNavPage.tsx` `:15` の import を更新:
```tsx
import { TourShowcasePanel } from '../tour/TourShowcasePanel';
```

`:179-191` の右カラム呼び出しから `steps` を外し、コンポーネント名を更新（region 入替は Task 3。ここでは名前と props のみ）:
```tsx
      <section className="housing-tour-page-panel" data-region="right">
        <div className="housing-tour-page-col">
          <TourShowcasePanel
            currentStep={progress.currentStep}
            currentIndex={currentIndex}
            isLast={isLast}
            onPrev={prev}
            onPrimary={onPrimary}
            onOpenReport={onOpenReport}
          />
        </div>
      </section>
```

- [ ] **Step 5: ショーケーステストを更新（import 名・steps 依存の describe 撤去）**

`src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx` を編集:

(a) `:13-14` の import を更新（`TourRouteSteps` import と `within` は不要になる場合があるが、`within` は詳細カード検証で使うため残す）:
```tsx
import { TourShowcasePanel } from '../TourShowcasePanel';
```
（`import { TourRouteSteps } from '../TourRouteSteps';` の行を削除）

(b) `:23-26` の `steps` 配列定義と `:37-52` の `renderPanel` を更新（`steps` prop を渡さない）:
```tsx
const singleStep: TourStep = { id: currentListing.id, listing: currentListing };

// ...

function renderPanel(props: Partial<Parameters<typeof TourShowcasePanel>[0]> = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TourShowcasePanel
        currentStep={singleStep}
        currentIndex={0}
        isLast={false}
        onPrev={() => {}}
        onPrimary={() => {}}
        onOpenReport={() => {}}
        {...props}
      />
    </I18nextProvider>
  );
}
```

(c) `no_memo` テスト（`:81-88`）の `steps` 上書きを削除（`currentStep` のみ渡す）:
```tsx
  it('メモが無いときは no_memo が出る', () => {
    const noMemoListing = { ...currentListing, description: undefined };
    renderPanel({ currentStep: { id: noMemoListing.id, listing: noMemoListing } });
    expect(screen.getByText('メモはありません')).toBeInTheDocument();
  });
```

(d) `plot 無し(アパート等)` テスト（`:106-113`）の `steps` 上書きを削除:
```tsx
  it('plot 無し(アパート等)では行き方ブロックが出ない', () => {
    const apt = { ...currentListing, buildingType: 'apartment' as const, plot: undefined };
    const { container } = renderPanel({ currentStep: { id: apt.id, listing: apt } });
    expect(container.querySelector('.housing-tour-dest-route')).toBeNull();
  });
```

(e) `describe('TourNextDestinationPanel — TourRouteSteps 連携', ...)`（`:153-158`）を**丸ごと削除**（ステップ見出しは Task 1 の進行状況テストで検証済み）。

(f) `describe('TourRouteSteps — 状態バッジ / 注記', ...)`（`:170-220`）を**丸ごと削除**（Step 1 で `TourRouteSteps.test.tsx` へ移設済み）。

(g) 残る describe 名の `TourNextDestinationPanel` を `TourShowcasePanel` に置換（表示名のみ・任意だが推奨）。`mistListing`（`:21`）は本ファイルで未使用になるため削除。

- [ ] **Step 6: テスト実行して緑を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourShowcasePanel.test.tsx src/components/housing/tour/__tests__/TourRouteSteps.test.tsx`
Expected: PASS（ショーケースの詳細/操作/報告/防御、TourRouteSteps 単体の状態バッジ/注記 が全て緑）

- [ ] **Step 7: 全体ビルド + 全テスト**

Run: `npm run build`
Expected: EXIT0

Run: `npx vitest run`
Expected: 既知 legacy 5 fail（TopBar4 + HousingWorkspace1）以外の新規 fail ゼロ

- [ ] **Step 8: コミット**

```bash
git add -A src/components/housing/tour src/components/housing/pages/TourNavPage.tsx
git commit -m "refactor(housing-tour): NextDestinationPanel を ShowcasePanel へ改名しステップ一覧を手放す (Phase3-2)"
```

---

### Task 3: レイアウト左右入替（ショーケース＝左 / 進行状況＝右）+ カラム幅トークン

役割の付け替えを完成させる。JSX 上でショーケースを左・進行状況を右へ配置し、カラム幅をツアー専用トークンで「左（ショーケース）広め・右（進行状況）狭め」に差し替える。共有トークンは触らない。**このタスクは見た目が変わるため実機ゲート必須。**

**Files:**
- Modify: `src/components/housing/pages/TourNavPage.tsx`（3 カラム return の root div に modifier class 付与 + 左右 `<section>` の中身を入替）
- Modify: `src/styles/housing.css`（`:173` の直後にツアー専用トークン追加、`.housing-tour-page` ブロック直後に **新規 modifier ルール** `.housing-tour-page--reorg` を追加。共有 `.housing-tour-page` のグリッドは**不変**）

**⚠ 重要な事実（着手前に必読）**: `.housing-tour-page` は本番ツアー(`TourNavPage`)だけでなく **DEV 経路エディタ `RouteAuthoringPage.tsx`（左=進捗 / 中央=地図エディタ / 右=ショーケース）も使う共有クラス**。DEV tour-preview は `<TourNavPage />` を無改変再利用するため自動追従する（別対応不要）。共有 `.housing-tour-page` の grid を直接書き換えると RouteAuthoringPage の左右幅まで勝手に反転する（[[feedback_scope_discipline]] 違反）。→ **幅入替は TourNavPage だけが付ける modifier `.housing-tour-page--reorg` にスコープし、共有グリッドは触らない**。

**Interfaces:**
- Consumes: 新トークン `--housing-tour-showcase-w` / `--housing-tour-progress-w`。
- Produces: 新 modifier `.housing-tour-page--reorg`（TourNavPage の 3 カラム return 専用）でグリッドが「ショーケース幅 1fr 進行状況幅」。共有 `.housing-tour-page`（RouteAuthoringPage が使用）は不変。`data-region="left"` = ショーケース、`data-region="right"` = 進行状況。

- [ ] **Step 1: ツアー専用カラム幅トークンを追加**

`src/styles/housing.css` `:173`（`--housing-right-w: 300px;`）の直後に追加:
```css
  /* ツアー中ページ Phase3: 左=目的地ショーケース(広め) / 右=進行状況(狭め)。
     共有の --housing-left-w/--housing-right-w とは独立 (workspace 等に波及させない)。 */
  --housing-tour-showcase-w: 300px;
  --housing-tour-progress-w: 240px;
```

- [ ] **Step 2: 幅入替を TourNavPage 専用 modifier にスコープ（共有グリッドは不変）**

`.housing-tour-page` の共有ルール（`:6469-6475`）は**変更しない**。`.housing-tour-page { … }` ブロックの閉じ `}`（`:6475` 付近）の**直後**に新規ルールを追加:
```css
/* Phase3: 本番ツアーページ (TourNavPage) のみ 左=ショーケース(広め)/右=進行状況(狭め)。
   DEV RouteAuthoringPage が使う共有 .housing-tour-page には波及させない。 */
.housing-tour-page--reorg {
  grid-template-columns: var(--housing-tour-showcase-w) 1fr var(--housing-tour-progress-w);
}
```

- [ ] **Step 3a: 3 カラム return の root div に modifier を付与**

`src/components/housing/pages/TourNavPage.tsx` の**3 カラム表示の `return`**（左/中央/右 section を含む `<div className="housing-tour-page">`。`listingIds.length === 0` の空状態と `completed` 完了画面の early return は `housing-tour-page-panel-solo` で中央寄せ = **対象外**）の root を差し替え:
```tsx
    <div className="housing-tour-page housing-tour-page--reorg">
```
（空状態・完了画面の `<div className="housing-tour-page">` は **触らない** = solo 中央寄せのまま）

- [ ] **Step 3b: 左右 section の中身を入替**

同 `return` 内、左右 2 つの `<section>` を次へ差し替え（中央 `<section data-region="center">` は不変）。**左＝ショーケース / 右＝進行状況**:
```tsx
      <section className="housing-tour-page-panel" data-region="left">
        <div className="housing-tour-page-col">
          <TourShowcasePanel
            currentStep={progress.currentStep}
            currentIndex={currentIndex}
            isLast={isLast}
            onPrev={prev}
            onPrimary={onPrimary}
            onOpenReport={onOpenReport}
          />
        </div>
      </section>

      <section className="housing-tour-page-panel" data-region="center">
        <div className="housing-tour-page-col">
          <TourNavMap
            status={mapStatus}
            svg={asset.status === 'ready' ? asset.svg : null}
            viewBox={asset.status === 'ready' ? asset.json.viewBox : null}
            model={mapModel}
          />
        </div>
      </section>

      <section className="housing-tour-page-panel" data-region="right">
        <div className="housing-tour-page-col">
          <TourProgressPanel progress={progress} steps={steps} currentIndex={currentIndex} onFinish={onFinish} />
        </div>
      </section>
```

- [ ] **Step 4: ビルド + テスト**

Run: `npm run build`
Expected: EXIT0

Run: `npx vitest run`
Expected: 既知 legacy 5 fail 以外の新規 fail ゼロ

- [ ] **Step 5: 実機ゲート（ユーザー）**

開発者の実画面（CSS `1489x679` / DPR `2.58`）で `/housing/tour` を開き、次を目視確認:
- **左＝ショーケース**（大きな写真＋タイトル/住所/サイズ/ワールド/メモ＋行き方＋前へ/主ボタン/報告）が広めのカラムに収まる
- **中央＝地図**が従来通り（パン&ズーム含め挙動不変）
- **右＝進行状況**（リング＋到着/残り＋全ステップ縦リスト）が狭めのカラムに収まり、ステップ一覧が窮屈すぎない
- 左右の情報の重複（次の場所/最近）が無い

> カラム幅（showcase 300 / progress 240）は実画面で見て要調整ならトークン値を詰める。窮屈・余白過多があればここで報告 → 微調整。
> **DEV 非回帰**: modifier スコープにより `/housing/dev/routes`（RouteAuthoringPage）の左右幅は従来通り（左=進捗 / 右=ショーケース・幅不変）のはず。`/housing/dev/tour-preview` は本番同様に入れ替わる（`<TourNavPage/>` 再利用）。

- [ ] **Step 6: コミット（実機 OK 後）**

```bash
git add src/components/housing/pages/TourNavPage.tsx src/styles/housing.css
git commit -m "feat(housing-tour): 左右役割入替(左=ショーケース/右=進行状況)+ツアー専用カラム幅 (Phase3-3)"
```

---

## 完了後（本フェーズのスコープ外・次フェーズ）

- **Phase 4**: 進行モデル拡張（移動節目 / 「見学を始める」2 ボタン化 / 見学タイマー）。見学タイマー節は本フェーズで作った右カラム（flex 縦積み）にそのまま足せる。着手前に FF14 移動判定をユーザー確認（spec §5 D-1 / §7）。
- **Phase 5**: 生きたカード段階 2（ショーケース写真をスライドショー/動画化・Allmarks 流用）。

## Self-Review

- **Spec coverage（§4 グループ C 改善 9）**: 左＝ショーケース（Task 2 で役割確定 + Task 3 で左配置）/ 中央＝地図（不変）/ 右＝進行状況に専念（Task 1 で全ステップ縦リスト移設 + 次・最近撤去、Task 3 で右配置）を全てカバー。見学タイマー（§4 「見学タイマー(グループ D)」）はユーザー合意で Phase 4 送り（本フェーズは余白確保のみ）。写真枠は静止（§4 「静止画で用意」）= ショーケースの `representativeImage` を維持。
- **Placeholder scan**: 各 step に実コード/実コマンド/期待値を明記。TBD なし。
- **Type consistency**: `TourProgressPanelProps`（progress/steps/currentIndex/onFinish）と `TourShowcasePanelProps`（currentStep/currentIndex/isLast/onPrev/onPrimary/onOpenReport）を Task 間で一致。`TourRouteSteps` の props（steps/currentIndex）は不変で両所参照が一致。`--housing-tour-showcase-w` / `--housing-tour-progress-w` は定義（Task3 Step1）と参照（Step2）で一致。
