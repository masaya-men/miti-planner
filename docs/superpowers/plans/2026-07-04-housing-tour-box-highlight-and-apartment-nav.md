# ハウジングツアー: 実箱ハイライト化 ＋ アパートナビ対応 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー中央地図の「目的地アピール」を、被せ矩形ではなく**実際の区画/アパートのパス（`#plot_N` / `#apart_N`）そのものを光らせる**方式に変え、あわせて**アパートの最寄りエーテライト→玄関のゴージャス経路＋起点マーカー**を出す（棟2の「何も出ない」バグも解消）。

**Architecture:** 純関数側で「SVG要素id（`elementId`）」「アパートの配置/起点」を解決し、`buildTourMapPlacements` がモデルに `targetElId` を載せる。`TourNavMap` は埋め込み済みSVGの該当パスに光らせ用クラスを命令的に付け外しする（被せ矩形は撤去・放射リングは残す）。本街(`plot_*`/`apart_1`)と拡張街(`apart_2`)は `getMapAetherytes(mapKey)` の per-map スコープにより構造的に分離。

**Tech Stack:** TypeScript / React 18 / Zustand / Vitest（`pool: 'vmThreads'` 厳守・happy-dom はファイル先頭注記）。ビルドは `npm run build`（`tsc -b` 厳密）。

## Global Constraints

- 憶測禁止・path:line 引用（CLAUDE.md「推測を抑制する5原則」）。
- 色は `--housing-*` トークン経由（rgb/rgba/hex 直書き禁止）。housing.css 内の幾何値（stroke-width/px）はリテラル可（housing.css の確立規約）。
- 地図 SVG host クラスは `.housing-map-svg-host` 固定（赤線/赤丸隠蔽 CSS がこの配下のみ有効）。
- 本街(plot/apart_1)/拡張街(apart_2)を絶対に混ぜない。テストでクロス0を保証。
- 純関数は元配列/引数を mutate しない。テストは `npx vitest run <path>`（出力パイプ禁止）。
- 各タスク末尾で1コミット（日本語メッセージ）。実装後 `npm run build` EXIT0 を確認。
- 勝手に push / main merge しない。各ステップ末はユーザーのローカル実機確認がゲート。
- spec: `docs/superpowers/specs/2026-07-04-housing-tour-box-highlight-and-apartment-nav-design.md`。

---

# ステップ1（家）: 目的地アピールを「実箱ハイライト」化

## Task 1: `resolveWardMapRef` に `elementId`（SVG要素id）を追加

**Files:**
- Modify: `src/lib/housing/resolveWardMapRef.ts`
- Test: `src/lib/housing/__tests__/resolveWardMapRef.test.ts`（既存6件を elementId 込みに更新 + 追加）

**Interfaces:**
- Produces: `resolveWardMapRef(area, plot, apartmentBuilding, buildingType)` の戻り値に `elementId: string` を追加。区画=`plot_${highlightPlot}`（1-30）、アパート=`apart_1`（本街）/`apart_2`（拡張街）。既存 `mapKey`/`highlightPlot`/`highlightKind` は不変。

- [ ] **Step 1: 既存テストを elementId 込みに更新し、失敗する追加テストを書く** — `src/lib/housing/__tests__/resolveWardMapRef.test.ts` を全置換:

```ts
import { describe, it, expect } from 'vitest';
import { resolveWardMapRef } from '../resolveWardMapRef';

describe('resolveWardMapRef', () => {
  it('本街の家 (plot 1-30) は main マップ・そのままの plot・elementId=plot_N', () => {
    expect(resolveWardMapRef('Mist', 15, null, 'house'))
      .toEqual({ mapKey: 'mist', highlightPlot: 15, highlightKind: 'plot', elementId: 'plot_15' });
  });
  it('拡張街の家 (plot 31-60) は sub マップ・plot-30 読み替え・elementId=plot_(N-30)', () => {
    expect(resolveWardMapRef('Goblet', 45, null, 'house'))
      .toEqual({ mapKey: 'goblet-sub', highlightPlot: 15, highlightKind: 'plot', elementId: 'plot_15' });
  });
  it('アパート本街 (building 1) は main の apart・elementId=apart_1', () => {
    expect(resolveWardMapRef('Shirogane', null, 1, 'apartment'))
      .toEqual({ mapKey: 'shirogane', highlightPlot: 1, highlightKind: 'apart', elementId: 'apart_1' });
  });
  it('アパート拡張街 (building 2) は sub の apart・elementId=apart_2', () => {
    expect(resolveWardMapRef('Empyreum', null, 2, 'apartment'))
      .toEqual({ mapKey: 'empyreum-sub', highlightPlot: 1, highlightKind: 'apart', elementId: 'apart_2' });
  });
  it('エリア不明は null', () => {
    expect(resolveWardMapRef('Unknown', 1, null, 'house')).toBeNull();
  });
  it('plot 未確定は null', () => {
    expect(resolveWardMapRef('Mist', null, null, 'house')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/lib/housing/__tests__/resolveWardMapRef.test.ts`
Expected: FAIL（`elementId` が戻り値に無く toEqual 不一致）

- [ ] **Step 3: 実装** — `src/lib/housing/resolveWardMapRef.ts` を全置換:

```ts
// 住所 → 表示すべき地図 mapKey とハイライト対象を解決する純関数 (spec パートC)。
// FF14 仕様: 拡張街の家は plot 31-60 (SVG は 1-30 命名なので -30 読み替え)。
// アパート棟 1=本街 / 2=拡張。FC 個室は親の家 plot をハイライト (呼び出し側で plot を渡す)。
// elementId = 地図 SVG 内の該当パス id (区画=plot_N / アパート=apart_1|apart_2)。実箱ハイライト用。

const AREA_TO_KEY: Record<string, string> = {
  Mist: 'mist',
  LavenderBeds: 'lavender',
  Goblet: 'goblet',
  Shirogane: 'shirogane',
  Empyreum: 'empyreum',
};

export function resolveWardMapRef(
  area: string,
  plot: number | null | undefined,
  apartmentBuilding: 1 | 2 | null | undefined,
  buildingType: 'house' | 'apartment' | undefined,
): { mapKey: string; highlightPlot: number; highlightKind: 'plot' | 'apart'; elementId: string } | null {
  const baseKey = AREA_TO_KEY[area];
  if (!baseKey) return null;

  if (buildingType === 'apartment') {
    const sub = apartmentBuilding === 2;
    return {
      mapKey: sub ? `${baseKey}-sub` : baseKey,
      highlightPlot: 1,
      highlightKind: 'apart',
      elementId: sub ? 'apart_2' : 'apart_1',
    };
  }

  if (plot == null) return null;
  if (plot >= 1 && plot <= 30) {
    return { mapKey: baseKey, highlightPlot: plot, highlightKind: 'plot', elementId: `plot_${plot}` };
  }
  if (plot >= 31 && plot <= 60) {
    return { mapKey: `${baseKey}-sub`, highlightPlot: plot - 30, highlightKind: 'plot', elementId: `plot_${plot - 30}` };
  }
  return null;
}
```

- [ ] **Step 4: 通過確認** — Run: `npx vitest run src/lib/housing/__tests__/resolveWardMapRef.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: build 確認** — Run: `npm run build`
Expected: EXIT 0（`WardMapPreview.tsx` 等の消費者は個別フィールド分割代入のみ＝後方互換）

- [ ] **Step 6: コミット**

```bash
git add src/lib/housing/resolveWardMapRef.ts src/lib/housing/__tests__/resolveWardMapRef.test.ts
git commit -m "feat(housing): resolveWardMapRef に elementId(SVG要素id plot_N/apart_1|2) を追加"
```

---

## Task 2: `buildTourMapPlacements` のモデルに `targetElId` を追加

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts`
- Test: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`（追加）

**Interfaces:**
- Consumes: `resolveWardMapRef` の戻り値（`elementId` 込み・Task 1）。
- Produces: `TourMapModel` に `targetElId: string | null` を追加（target が解決できた時のみ `ref.elementId`、それ以外 null）。`buildTourMapPlacements` の `ref` 引数型に `elementId: string` を追加。

- [ ] **Step 1: 失敗テストを追記** — `src/lib/housing/__tests__/buildTourMapPlacements.test.ts` の `describe` 内末尾（`});` の前・line 30 付近）に追加:

```ts
  it('target が解決できたら targetElId に ref.elementId を載せる (家)', () => {
    const cur = L({ id: 'a', plot: 6 }); const ref = mistRef(6);
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.targetElId).toBe('plot_6');
  });
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: FAIL（`targetElId` が undefined）

- [ ] **Step 3: 実装** — `src/lib/housing/buildTourMapPlacements.ts` を編集。

(3-a) `TourMapModel` に `targetElId` を追加（interface 内）:

```ts
export interface TourMapModel {
  target: { x: number; y: number } | null;   // 現在の目的地(家)ハイライト中心 (リング用)
  placed: TourMapPlacement[];                  // 同一ワード地図の全ステップ番号ノード
  routePath: string | null;                    // 起点(エーテライト)→家 の道なり (毎回)
  origin: { x: number; y: number } | null;     // エーテライトシャード座標マーカー
  targetElId: string | null;                   // 実箱ハイライト対象の SVG 要素 id (plot_N / apart_1|2)
}
```

(3-b) 関数シグネチャの `ref` 型に `elementId` を追加:

```ts
export function buildTourMapPlacements(
  json: WardMapJson,
  mapKey: string,
  ref: { highlightPlot: number; highlightKind: 'plot' | 'apart'; elementId: string },
  currentListing: MockListing | null,
  steps: TourStep[],
  currentIndex: number,
): TourMapModel {
```

(3-c) `return` 文を `targetElId` 込みに（`target` が非 null の時だけ id を載せる）:

```ts
  return { target, placed, routePath, origin, targetElId: target ? ref.elementId : null };
```

- [ ] **Step 4: 通過確認** — Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: PASS（既存3 + 新規1）

- [ ] **Step 5: build 確認** — Run: `npm run build`
Expected: EXIT 0（`TourNavPage.tsx` は `mapRef`＝resolveWardMapRef 結果を渡す＝elementId 込みで型一致）

- [ ] **Step 6: コミット**

```bash
git add src/lib/housing/buildTourMapPlacements.ts src/lib/housing/__tests__/buildTourMapPlacements.test.ts
git commit -m "feat(housing): TourMapModel に targetElId(実箱ハイライト対象id) を追加"
```

---

## Task 3: `TourNavMap` を実箱ハイライトに（被せ矩形撤去・リング残す）＋ CSS

**Files:**
- Modify: `src/components/housing/tour/TourNavMap.tsx`
- Modify: `src/styles/housing.css`（`.housing-tour-map-legend-swatch--route` 定義の直後・6151行付近に追加）
- Test: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`

**Interfaces:**
- Consumes: `TourMapModel.targetElId`（Task 2）。
- Produces: host 内の `[id="<targetElId>"]` パスに `.housing-tour-target-box` クラスを付与（描画毎に前を除去→今を付与）。被せ `<rect>` は削除。放射リング（`<circle>`）は `target.x/y` 中心で存置。

- [ ] **Step 1: テストを更新（失敗する新テストを含む）** — `src/components/housing/tour/__tests__/TourNavMap.test.tsx` を全置換:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '../../../../i18n';
import type { WardMapJson } from '../../../../data/housing/wardMapManifest';
import mistWardRaw from '../../../../data/housing/mistWard.generated.json';
import type { TourMapModel } from '../../../../lib/housing/buildTourMapPlacements';
import { TourNavMap } from '../TourNavMap';
const mistWard = mistWardRaw as unknown as WardMapJson;
const model: TourMapModel = { target: { x: 100, y: 100 }, placed: [ { index: 0, x: 100, y: 100, status: 'current' }, { index: 1, x: 200, y: 150, status: 'upcoming' } ], routePath: 'M10 10 L100 100', origin: { x: 10, y: 10 }, targetElId: 'plot_6' };

describe('TourNavMap', () => {
  it('ready で host/番号ノード/ゴージャス経路/起点マーカー/放射リングを描く', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('.housing-map-svg-host')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(2);
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-origin"]')).toBeTruthy();
    // 放射リングは circle で残す
    expect(container.querySelectorAll('.housing-map-overlay circle').length).toBeGreaterThan(0);
  });
  it('被せ矩形は撤去 (overlay に rect が無い)', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelectorAll('.housing-map-overlay rect').length).toBe(0);
  });
  it('targetElId に一致する実箱パスに housing-tour-target-box クラスが付く', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /><path id="plot_7" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('#plot_6')?.classList.contains('housing-tour-target-box')).toBe(true);
    expect(container.querySelector('#plot_7')?.classList.contains('housing-tour-target-box')).toBe(false);
  });
  it('none はプレースホルダ・loading はスケルトン', () => {
    const none = render(<TourNavMap status="none" svg={null} viewBox={null} model={null} />);
    expect(none.container.querySelector('[data-testid="tour-map-none"]')).toBeTruthy();
    const load = render(<TourNavMap status="loading" svg={null} viewBox={null} model={null} />);
    expect(load.container.querySelector('[data-testid="tour-map-skeleton"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: FAIL（rect がまだ在る / target-box クラス未実装）

- [ ] **Step 3: 実装** — `src/components/housing/tour/TourNavMap.tsx` を全置換:

```tsx
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
}
const LEGEND_ITEMS = ['here', 'next', 'arrived', 'upcoming', 'route'] as const;

/** ツアー中(Nav) 中央: 表示専用の LIVE 地図(全5エリア)。現在の家のワード地図を描き、実エーテライト起点→家の経路をゴージャスにアニメ。
 * 目的地アピールは被せ矩形ではなく、地図SVG内の実際の区画/アパートのパス(#plot_N/#apart_N)自体を光らせる。host は必ず .housing-map-svg-host。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ status, svg, viewBox, model }) => {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const target = model?.target ?? null;
  const route = model?.routePath ?? null;
  const origin = model?.origin ?? null;
  const targetElId = model?.targetElId ?? null;

  // 目的地アピール: 埋め込み済みSVGの該当パスに光らせ用クラスを付け外し。
  // svg 差し替え(マップ切替) / targetElId 変化(ステップ移動) 両方で再適用し stale ハイライトを残さない。
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll('.housing-tour-target-box').forEach((el) => el.classList.remove('housing-tour-target-box'));
    if (!targetElId) return;
    const el = host.querySelector(`[id="${targetElId}"]`);
    if (el) el.classList.add('housing-tour-target-box');
  }, [status, svg, targetElId]);

  return (
    <div className="housing-tour-map" data-region="tour-map">
      <div className="housing-tour-map-stage">
        <div className="housing-tour-map-wrap">
          {status === 'loading' && <div className="housing-tour-map-skeleton" data-testid="tour-map-skeleton" aria-hidden="true" />}
          {(status === 'none' || status === 'error') && (
            <div className="housing-tour-map-none" data-testid="tour-map-none">
              <p className="housing-tour-map-none-text">{t(status === 'error' ? 'housing.tour.nav.map_error' : 'housing.tour.nav.map_none')}</p>
            </div>
          )}
          {status === 'ready' && svg && viewBox && (
            <>
              <div ref={hostRef} className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: svg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {/* 光らせるのは「ユーザーが実際に歩く経路」だけ (車のナビと同じ)。 */}
                {route && (
                  <>
                    {/* 下地グロー */}
                    <path className="housing-tour-route-glow" d={route} fill="none" />
                    {/* コア光線 + 流れ */}
                    <path data-testid="tour-map-route" className="housing-tour-route-core" d={route} fill="none">
                      <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                    </path>
                    {/* コメット */}
                    <circle className="housing-tour-route-comet" r="10">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path={route} rotate="auto" />
                    </circle>
                  </>
                )}
                {origin && (
                  <g data-testid="tour-map-origin" className="housing-tour-map-origin-mark">
                    <circle className="housing-tour-map-origin-pulse" cx={origin.x} cy={origin.y} r="14">
                      <animate attributeName="r" from="14" to="30" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle className="housing-tour-map-origin-core" cx={origin.x} cy={origin.y} r="7" />
                  </g>
                )}
                {/* 目的地の放射リング (箱中心から広がる波紋)。箱本体のハイライトは上の useEffect で実パスに付与。 */}
                {target && (
                  <g aria-hidden="true">
                    {[0, 0.9].map((begin) => (
                      <circle key={begin} cx={target.x} cy={target.y} r="60" fill="none" stroke="var(--housing-candle)" strokeWidth="6" style={{ filter: 'drop-shadow(0 0 10px var(--housing-honey))' }}>
                        <animate attributeName="r" from="60" to="170" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                        <animate attributeName="stroke-opacity" from="0.95" to="0" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                      </circle>
                    ))}
                  </g>
                )}
              </svg>
              {model?.placed.map((node) => (
                <div key={node.index} data-testid="tour-map-node" data-status={node.status} className={`housing-tour-map-node housing-tour-map-node--${node.status}`} style={{ left: `${((node.x / viewBox.w) * 100).toFixed(3)}%`, top: `${((node.y / viewBox.h) * 100).toFixed(3)}%` }}>
                  {node.status === 'arrived' ? '✓' : node.index + 1}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="housing-hud is-top"><div className="pill housing-tour-map-live"><span className="housing-tour-map-live-dot" aria-hidden="true" />{t('housing.tour.nav.live')}</div></div>
      </div>
      <ul className="housing-tour-map-legend">
        {LEGEND_ITEMS.map((key) => (<li key={key} className="housing-tour-map-legend-item"><span className={`housing-tour-map-legend-swatch housing-tour-map-legend-swatch--${key}`} aria-hidden="true" />{t(`housing.tour.nav.legend.${key}`)}</li>))}
      </ul>
    </div>
  );
};
```

- [ ] **Step 4: CSS を追加** — `src/styles/housing.css` の `.housing-tour-map-legend-swatch--route { … }` ブロック（6148-6151行付近）の直後に追加:

```css

/* 目的地アピール: 被せ矩形を廃し、地図SVG内の実際の区画/アパートのパス自体を光らせる。
 * .housing-map-svg-host 配下の該当パスに JS でクラス付与 (TourNavMap の useEffect)。
 * CSS はプレゼンテーション属性 (fill="white"/stroke="black") に優先するため上書き可能。 */
.housing-map-svg-host svg .housing-tour-target-box {
  fill: var(--housing-honey);
  stroke: var(--housing-candle);
  stroke-width: 6;
  animation: housing-tour-target-breathe 1.8s ease-in-out infinite;
}
@keyframes housing-tour-target-breathe {
  0%, 100% { fill-opacity: 0.28; filter: drop-shadow(0 0 6px var(--housing-honey)); }
  50%      { fill-opacity: 0.6; filter: drop-shadow(0 0 18px var(--housing-honey)); }
}
```

- [ ] **Step 5: 通過確認** — Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: PASS（4件）

- [ ] **Step 6: build 確認** — Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/tour/TourNavMap.tsx src/components/housing/tour/__tests__/TourNavMap.test.tsx src/styles/housing.css
git commit -m "feat(housing): 目的地アピールを実箱ハイライト化(被せ矩形撤去・放射リング存置・#plot_N/#apart_N を灯す)"
```

- [ ] **Step 8: ステップ1 実機ゲート（ユーザー）** — `npm run dev` → `/housing/favorites` から家(house)を含むツアー開始 → `/housing/tour` を DPR2.58/CSS1489 で目視。確認: 目的地の**実際の区画の箱そのものがハニーで灯って呼吸する**・被せ矩形が消えた・放射リングは残る・経路/起点は不変。**OK が出るまで次ステップに進まない。**

---

# ステップ2（アパート）: 最寄りエーテライト→アパートのナビ配線

## Task 4: `apartToPlacementIn`（アパート配置・番号非依存）

**Files:**
- Modify: `src/lib/housing/wardRoute.ts`
- Test: `src/lib/housing/__tests__/wardRoute.test.ts`（追加）

**Interfaces:**
- Produces: `apartToPlacementIn(json: WardMapJson): { x: number; y: number; nodeId: string | null } | null`。各マップに1つだけの `kind==='apart'` エントリを plot 番号に依存せず返す（棟2の plot=2 でも取れる）。

- [ ] **Step 1: 失敗テストを追記** — `src/lib/housing/__tests__/wardRoute.test.ts` に import 追加と describe を追記。

> 注意（既存 import の実態）: line 3 の `import mistWard from '...mistWard.generated.json'` は**未キャストの生JSON**（`WardMapJson` として使えない）。line 5 で `WardMapJson` 型・line 7 で `gobletWard`（cast 済）を既に import 済み。よって **本街テストは cast 済みの `gobletWard` を使い**、sub は新規 cast import を足す。`mistWard` は使わない（型不一致回避）。

ファイル冒頭 import 群の近く（line 7 の `const gobletWard = ...` の直後）に追加:

```ts
import { apartToPlacementIn } from '../wardRoute';
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
const mistSubWard = mistSubWardRaw as unknown as WardMapJson;
```

ファイル末尾に describe を追加:

```ts
describe('apartToPlacementIn (アパート配置・番号非依存)', () => {
  it('本街マップの apart(apart_1) を返す', () => {
    const p = apartToPlacementIn(gobletWard);
    expect(p).not.toBeNull(); expect(p!.x).toBeGreaterThan(0); expect(p!.nodeId).toBeTruthy();
  });
  it('拡張街マップの apart(apart_2) も番号に依存せず返す (棟2バグ回避)', () => {
    const p = apartToPlacementIn(mistSubWard);
    expect(p).not.toBeNull(); expect(p!.x).toBeGreaterThan(0); expect(p!.nodeId).toBeTruthy();
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/lib/housing/__tests__/wardRoute.test.ts`
Expected: FAIL（`apartToPlacementIn` 未定義）

- [ ] **Step 3: 実装** — `src/lib/housing/wardRoute.ts` の `plotToPlacementIn`（26行付近）の直後に追加:

```ts
/** 各マップに1つだけ存在する apart エントリ → viewBox px 座標(番号非依存)。無ければ null。 */
export function apartToPlacementIn(json: WardMapJson): Placement | null {
  const h = json.houses.find((x) => x.kind === 'apart'); if (!h) return null;
  return { x: h.x * json.viewBox.w, y: h.y * json.viewBox.h, nodeId: h.node };
}
```

- [ ] **Step 4: 通過確認** — Run: `npx vitest run src/lib/housing/__tests__/wardRoute.test.ts`
Expected: PASS

- [ ] **Step 5: build 確認** — Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 6: コミット**

```bash
git add src/lib/housing/wardRoute.ts src/lib/housing/__tests__/wardRoute.test.ts
git commit -m "feat(housing): apartToPlacementIn(各マップ唯一の apart を番号非依存で配置解決)"
```

---

## Task 5: `getApartmentOrigin`（アパートの最寄りエーテライト起点・幾何最寄り）

**Files:**
- Create: `src/lib/housing/apartmentOrigin.ts`
- Test: `src/lib/housing/__tests__/apartmentOrigin.test.ts`

**Interfaces:**
- Consumes: `getMapAetherytes(mapKey)`（`wardAetherytes.ts`）, `WardMapJson`。
- Produces: `getApartmentOrigin(json: WardMapJson, mapKey: string): { node: string; aetheryte: string; x: number; y: number } | null`。json の唯一の apart エントリに最も近い同一地図のシャードを返す（`getPlotOriginNode` と同形）。本街/拡張は `getMapAetherytes(mapKey)` の per-map スコープで構造分離。

- [ ] **Step 1: 失敗テスト** — `src/lib/housing/__tests__/apartmentOrigin.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { WardMapJson } from '../../../data/housing/wardMapManifest';
import { getApartmentOrigin } from '../apartmentOrigin';
import mistWardRaw from '../../../data/housing/mistWard.generated.json';
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
import lavenderSubWardRaw from '../../../data/housing/lavenderSubWard.generated.json';
import gobletSubWardRaw from '../../../data/housing/gobletSubWard.generated.json';
import shiroganeSubWardRaw from '../../../data/housing/shiroganeSubWard.generated.json';
import empyreumSubWardRaw from '../../../data/housing/empyreumSubWard.generated.json';

const asJson = (j: unknown) => j as unknown as WardMapJson;
const SUBS: Array<[string, WardMapJson]> = [
  ['mist-sub', asJson(mistSubWardRaw)],
  ['lavender-sub', asJson(lavenderSubWardRaw)],
  ['goblet-sub', asJson(gobletSubWardRaw)],
  ['shirogane-sub', asJson(shiroganeSubWardRaw)],
  ['empyreum-sub', asJson(empyreumSubWardRaw)],
];

describe('getApartmentOrigin', () => {
  it('本街(mist)の apart 起点は解決でき node 非空・非[拡張街]', () => {
    const o = getApartmentOrigin(asJson(mistWardRaw), 'mist');
    expect(o).not.toBeNull();
    expect(o!.node.length).toBeGreaterThan(0);
    expect(o!.aetheryte.startsWith('[拡張街]')).toBe(false);
  });
  it('全拡張街マップの apart 起点は node 非空・必ず[拡張街]シャード (クロス0)', () => {
    for (const [mapKey, json] of SUBS) {
      const o = getApartmentOrigin(json, mapKey);
      expect(o, mapKey).not.toBeNull();
      expect(o!.node.length, mapKey).toBeGreaterThan(0);
      expect(o!.aetheryte.startsWith('[拡張街]'), `${mapKey} ${o!.aetheryte}`).toBe(true);
    }
  });
  it('未知 mapKey (シャード無し) は null', () => {
    expect(getApartmentOrigin(asJson(mistWardRaw), 'nowhere')).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/lib/housing/__tests__/apartmentOrigin.test.ts`
Expected: FAIL（`getApartmentOrigin` 未定義）

- [ ] **Step 3: 実装** — `src/lib/housing/apartmentOrigin.ts`:

```ts
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import { getMapAetherytes } from './wardAetherytes';

/**
 * アパートの「最寄りエーテネットシャード起点」を解決する純関数。
 * 家は per-plot 名で正典指定(getPlotOriginNode)だが、アパートは正典データが無いため、
 * 同一地図(mapKey)のシャードから幾何的に最寄りの1つを選ぶ。
 * getMapAetherytes(mapKey) は当該マップのシャードのみ(本街=非[拡張街]/sub=[拡張街])＝クロス0は構造保証。
 */
export function getApartmentOrigin(
  json: WardMapJson,
  mapKey: string,
): { node: string; aetheryte: string; x: number; y: number } | null {
  const apart = json.houses.find((h) => h.kind === 'apart');
  if (!apart) return null;
  const shards = getMapAetherytes(mapKey);
  let best: { name: string; x: number; y: number; node: string } | null = null;
  let bd = Infinity;
  for (const s of shards) {
    const d = Math.hypot(s.x - apart.x, s.y - apart.y);
    if (d < bd) { bd = d; best = s; }
  }
  if (!best || !best.node) return null;
  return { node: best.node, aetheryte: best.name, x: best.x, y: best.y };
}
```

- [ ] **Step 4: 通過確認（クロス0）** — Run: `npx vitest run src/lib/housing/__tests__/apartmentOrigin.test.ts`
Expected: PASS

- [ ] **Step 5: build 確認** — Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 6: コミット**

```bash
git add src/lib/housing/apartmentOrigin.ts src/lib/housing/__tests__/apartmentOrigin.test.ts
git commit -m "feat(housing): getApartmentOrigin(アパート最寄りエーテライト起点・同一地図幾何最寄り・クロス0保証)"
```

---

## Task 6: `buildTourMapPlacements` をアパート対応に配線（target/origin/placed）

**Files:**
- Modify: `src/lib/housing/buildTourMapPlacements.ts`
- Test: `src/lib/housing/__tests__/buildTourMapPlacements.test.ts`（追加）

**Interfaces:**
- Consumes: `apartToPlacementIn`（Task 4）, `getApartmentOrigin`（Task 5）。
- Produces: アパート（棟1/棟2）で `target`/`routePath`/`origin`/`targetElId` が揃い、`placed` にアパートステップも含まれる。家の既存挙動は不変。

- [ ] **Step 1: 失敗テストを追記** — `src/lib/housing/__tests__/buildTourMapPlacements.test.ts` の import 群に追加:

```ts
import mistSubWardRaw from '../../../data/housing/mistSubWard.generated.json';
const mistSubWard = mistSubWardRaw as unknown as WardMapJson;
```

`describe` 内末尾に追加:

```ts
  it('アパート本街(棟1)は target/経路/起点/targetElId が揃う', () => {
    const cur = L({ id: 'ap1', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 1, roomNumber: 5 });
    const ref = resolveWardMapRef('Mist', null, 1, 'apartment')!;
    const m = buildTourMapPlacements(mistWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.target).not.toBeNull();
    expect(m.routePath).toMatch(/^M/);
    expect(m.origin).not.toBeNull();
    expect(m.targetElId).toBe('apart_1');
  });
  it('アパート拡張街(棟2)も target/経路/起点/targetElId が揃う (棟2バグ解消)', () => {
    const cur = L({ id: 'ap2', buildingType: 'apartment', plot: undefined, size: undefined, apartmentBuilding: 2, roomNumber: 5 });
    const ref = resolveWardMapRef('Mist', null, 2, 'apartment')!;
    const m = buildTourMapPlacements(mistSubWard, ref.mapKey, ref, cur, [step(cur)], 0);
    expect(m.target).not.toBeNull();
    expect(m.routePath).toMatch(/^M/);
    expect(m.origin).not.toBeNull();
    expect(m.targetElId).toBe('apart_2');
    expect(m.placed.map((p) => p.index)).toEqual([0]); // アパートステップも placed に載る
  });
```

- [ ] **Step 2: 失敗確認** — Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: FAIL（棟2 target=null / apartment 起点未対応で routePath/origin=null）

- [ ] **Step 3: 実装** — `src/lib/housing/buildTourMapPlacements.ts` を編集。

(3-a) import に追加（先頭の import 群）:

```ts
import { plotToPlacementIn, apartToPlacementIn, buildRoutePathIn } from './wardRoute';
import { getPlotOriginNode } from './plotOrigin';
import { getApartmentOrigin } from './apartmentOrigin';
```

（既存の `import { plotToPlacementIn, buildRoutePathIn } from './wardRoute';` を上記へ差し替え。`getPlotOriginNode` import は既存を保持。）

(3-b) ref から配置を得るヘルパを関数外(module scope)に追加（`refOf` の直後）:

```ts
/** ワード地図 ref → 配置。apart は番号非依存で唯一の apart を、plot は plot 番号で解決。 */
function placementForRef(json: WardMapJson, r: { highlightPlot: number; highlightKind: 'plot' | 'apart' }) {
  return r.highlightKind === 'apart'
    ? apartToPlacementIn(json)
    : plotToPlacementIn(json, r.highlightPlot, 'plot');
}
```

(3-c) `targetPlacement` の行を差し替え:

```ts
  const targetPlacement = placementForRef(json, ref);
  const target = targetPlacement ? { x: targetPlacement.x, y: targetPlacement.y } : null;
```

(3-d) `placed` ループ内の `plotToPlacementIn(...)` 行を差し替え:

```ts
    const p = placementForRef(json, r);
```

(3-e) 起点 `originInfo` の行を apartment 分岐に差し替え:

```ts
  const originInfo = currentListing
    ? (currentListing.buildingType === 'apartment'
        ? getApartmentOrigin(json, mapKey)
        : getPlotOriginNode(currentListing.area, currentListing.plot))
    : null;
```

- [ ] **Step 4: 通過確認（家の既存3件 + Task2の1件 + 新規2件）** — Run: `npx vitest run src/lib/housing/__tests__/buildTourMapPlacements.test.ts`
Expected: PASS（全件・家の既存挙動が回帰しないこと）

- [ ] **Step 5: build + 全体テスト確認** — Run: `npm run build` then `npx vitest run`
Expected: build EXIT 0 / 全体は既知 legacy 5 fail(TopBar4 + HousingWorkspace1)のみ・新規ゼロ・parity緑

- [ ] **Step 6: コミット**

```bash
git add src/lib/housing/buildTourMapPlacements.ts src/lib/housing/__tests__/buildTourMapPlacements.test.ts
git commit -m "feat(housing): buildTourMapPlacements をアパート対応(最寄りエーテライト起点→玄関の経路・棟2バグ解消)"
```

- [ ] **Step 7: ステップ2 実機ゲート（ユーザー）** — `npm run dev` → アパート(棟1/棟2)を含むツアーで `/housing/tour` を目視。確認: **アパートの実箱(`apart_N`)が灯る**・最寄りエーテライトから玄関へゴージャス経路+起点マーカーが出る・棟2(拡張街)でも表示される。OK なら `superpowers:finishing-a-development-branch` で main merge → 本番。

---

## Self-Review（この計画）

- **Spec coverage**: ①実箱ハイライト=Task1-3 / ②アパート最寄りエーテライト→経路=Task4-6 / ③棟2バグ解消=Task4(apartToPlacementIn)+Task6(placed/target) / クロス0=Task5。放射リング存置=Task3。被せ矩形撤去=Task3。全項目にタスク対応あり。
- **Placeholder scan**: TBD/TODO/「適切な〜」なし。各コード steps は実コードを掲載。
- **Type consistency**: `elementId`(Task1) → `ref` 型/`targetElId`(Task2) → `TourMapModel.targetElId`(Task2) → TourNavMap 消費(Task3)。`apartToPlacementIn`(Task4)/`getApartmentOrigin`(Task5) → buildTourMapPlacements 配線(Task6) でシグネチャ一致。`Placement`/`WardMapJson` は既存型を使用。
- **注意（実装者向け）**: `buildTourMapPlacements.test.ts` は Task2 で `targetElId` テストを足し、Task6 で apartment テストを足す（同ファイルを2回編集）。`wardRoute.test.ts` は既存の `WardMapJson`/`mistWard` import を再利用（重複 import しない）。
