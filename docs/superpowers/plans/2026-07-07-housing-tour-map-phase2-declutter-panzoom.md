# ハウジングツアー中央地図 Phase 2（地図の撤去 + パン&ズーム）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ツアー中(Nav)ページ本体 `/housing/tour` の中央地図から、番号マーカー・LIVEピル・凡例を撤去し（改善4+6）、地図に指/マウスのパン&ズーム＋「起点エーテライト〜家の経路にフィットする既定表示」を載せる（改善5+7）。

**Architecture:**
- 撤去（改善4+6）は純減。`TourNavMap.tsx` から描画・定数・HUD を消し、対応 CSS と（不要化した）CSS 変数を削除する。i18n の `live`/`legend.*` キーは死にキー化するが本フェーズでは**削除せず残す**（4言語 JSON のカンマ事故を避ける・別掃除タスク）。
- パン&ズーム（改善5+7）は **DEV 経路エディタ（`RouteAuthoringPage.tsx`）で実績のある自前 `src/lib/housing/mapZoom.ts` を流用**。**新規依存パッケージは追加しない**（`react-zoom-pan-pinch` 等は使わない）。地図の中身（host + overlay）を 1 つの `.housing-map-zoom` div に包み `transform: translate() scale()` で一体移動。既定表示は新規純関数 `computeDefaultView`（経路 bbox をパネルいっぱいに収める・見切れ厳禁）で算出し、ステップが変わるたびに自動リセット。手動パン/ズームは次のステップまで保持。

**Tech Stack:** React 18 + TypeScript（strict, `tsc -b`）、Vitest（happy-dom）、`react-i18next`、SVG overlay（`preserveAspectRatio="xMidYMid meet"`）、Pointer Events（PC/タッチ統一）、CSS 変数（`--housing-*` トークン）。

## Global Constraints

- **ハウジング独自トンマナ**（`.claude/rules/housing-design.md`）。既存 LoPo 白黒ルールは対象外。色・寸法・影は `--housing-*` トークン経由、**ハードコード禁止**（`aspect-*` 等の純ユーティリティのみ例外）。新規トークンは `src/styles/housing.css` 上部に定義。
- **文字列は i18n キー経由**（`.claude/rules/i18n.md`）。新規キーは ja/en/ko/zh **4言語 parity 必須**。ロケール JSON は該当ブロックのみ textual 編集（全体 parse→stringify 禁止）。
- **共有コード・DEV を壊さない**: `RouteAuthoringPage.tsx`（DEV 専用）と、DEV と共有する CSS 基底クラス `.housing-tour-map-wrap` の**既存挙動**は変えない。`mapZoom.ts` は既存 `applyWheelZoom` の挙動を保ったまま追加のみ（DEV のホイールズームが変わっていないことをスモーク確認）。
- **完了ゲート**: `npm run build`（tsc -b 厳密）EXIT0 + `npx vitest run`（既知 legacy 5 fail = TopBar4 + HousingWorkspace1 以外の新規 fail ゼロ）。見た目（既定表示・パン/ズーム）は開発者の実画面 CSS `1489x679` / DPR `2.58` でユーザー実機ゲート。
- **座標系（全タスク共通の事実）**: 経路/起点は viewBox 座標 `[0,w]×[0,h]`。overlay は `xMidYMid meet` で viewBox→wrap を等倍レターボックス写像。zoom transform は `.housing-map-zoom`（`transform-origin: 0 0`）に `translate(tx,ty) scale(s)` を wrap-px 空間で適用。`MapView = { scale, tx, ty }`（`mapZoom.ts`）、scale クランプ `[1,8]`。

---

### Task 1: 改善4+6 — 地図から番号マーカー・LIVEピル・凡例を撤去

**Files:**
- Modify: `src/components/housing/tour/TourNavMap.tsx`（`:11` LEGEND_ITEMS 定数 / `:76-80` 番号ノード / `:84` HUD+LIVE / `:86-88` 凡例 ul を削除）
- Modify: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`（`:16` の番号ノード数 2→0、LIVE/凡例の非存在 assertion を追加）
- Modify: `src/styles/housing.css`（`:6031-6048` LIVE / `:6119-6148` 番号ノード / `:6150-6187` 凡例 の CSS ブロックと、不要化した変数 `:192-193` を削除）

**Interfaces:**
- Consumes: 既存 `TourMapModel`（`buildTourMapPlacements.ts:17`）。`model.placed` はモデルとしては残す（DEV も同モデルを算出）— **描画のみ**をやめる（死にコードのモデル撤去は spec §8 非スコープ）。
- Produces: 撤去後も `.housing-tour-map` / `.housing-tour-map-stage` / `.housing-tour-map-wrap` / `.housing-map-svg-host` / `.housing-map-overlay` / `data-testid="tour-map-route"` / `tour-map-origin` / `tour-map-route-jump` は不変（Task 3 と既存テストが依存）。

- [ ] **Step 1: テストを先に更新して失敗させる**

`src/components/housing/tour/__tests__/TourNavMap.test.tsx` の `:13-19` の it を次に置き換える（番号ノードを 0 に、LIVE/凡例の非存在を追加）:

```tsx
  it('ready で host/ゴージャス経路/起点マーカーを描く（番号ノード・LIVE・凡例は撤去済み）', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('.housing-map-svg-host')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-route"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-origin"]')).toBeTruthy();
    // 改善4: 地図上の番号マーカー(①②③/✓)は撤去
    expect(container.querySelectorAll('[data-testid="tour-map-node"]').length).toBe(0);
    // 改善6: LIVEピルと凡例は撤去
    expect(container.querySelector('.housing-tour-map-live')).toBeNull();
    expect(container.querySelector('.housing-tour-map-legend')).toBeNull();
  });
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: FAIL（現状はまだ番号ノード2個・LIVE・凡例を描画しているため上記 it が落ちる）

- [ ] **Step 3: TourNavMap.tsx から撤去（最小実装）**

`:11` の定数行を削除:
```tsx
const LEGEND_ITEMS = ['here', 'next', 'arrived', 'upcoming', 'route'] as const;
```

`:76-80` の番号ノード描画ブロックを削除:
```tsx
              {model?.placed.map((node) => (
                <div key={node.index} data-testid="tour-map-node" data-status={node.status} className={`housing-tour-map-node housing-tour-map-node--${node.status}`} style={{ left: `${((node.x / viewBox.w) * 100).toFixed(3)}%`, top: `${((node.y / viewBox.h) * 100).toFixed(3)}%` }}>
                  {node.status === 'arrived' ? '✓' : node.index + 1}
                </div>
              ))}
```

`:84` の HUD+LIVE 行を削除（HUD の中身は LIVE だけなので `.housing-hud` ごと消す。Task 3 で「全体に戻す」用の HUD を新設する）:
```tsx
        <div className="housing-hud is-top"><div className="pill housing-tour-map-live"><span className="housing-tour-map-live-dot" aria-hidden="true" />{t('housing.tour.nav.live')}</div></div>
```

`:86-88` の凡例 ul を削除:
```tsx
      <ul className="housing-tour-map-legend">
        {LEGEND_ITEMS.map((key) => (<li key={key} className="housing-tour-map-legend-item"><span className={`housing-tour-map-legend-swatch housing-tour-map-legend-swatch--${key}`} aria-hidden="true" />{t(`housing.tour.nav.legend.${key}`)}</li>))}
      </ul>
```

撤去後、`t` は経路の状態文言（`map_error`/`map_none`/`map_alt`）でまだ使うので `useTranslation` の import と `const { t } = useTranslation();` は残す。

- [ ] **Step 4: テスト実行して成功を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: PASS（全 it 緑）

- [ ] **Step 5: 不要化した CSS と変数を削除**

`src/styles/housing.css` から以下 3 ブロックを削除:
- `:6031-6048`（コメント `/* LIVE ラベル ... */` + `.housing-tour-map-live` + `.housing-tour-map-live-dot` + `@keyframes housing-tour-map-live-pulse`）
- `:6119-6148`（コメント `/* 番号ノード ... */` + `.housing-tour-map-node` と `--arrived/--current/--upcoming`）
- `:6150-6187`（コメント `/* 凡例 */` + `.housing-tour-map-legend` 一式）

`:192-193` の不要化した変数 2 行を削除:
```css
  --housing-tour-map-node-size: 26px;   /* 番号ノードの直径 */
  --housing-tour-map-legend-swatch: 10px; /* 凡例の色見本サイズ */
```

（`.housing-tour-map-live` を消しても `.housing-hud`/`.pill` は他で使うため残す。grep `housing-tour-map-node|housing-tour-map-legend|housing-tour-map-live` が housing.css に残らないこと、`--housing-tour-map-node-size`/`--housing-tour-map-legend-swatch` の参照が 0 になることを確認。）

- [ ] **Step 6: build + 全テスト**

Run: `npm run build`
Expected: EXIT0（tsc -b 緑・未使用 import/変数なし）

Run: `npx vitest run`
Expected: 既知 legacy 5 fail 以外に新規 fail ゼロ

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/tour/TourNavMap.tsx src/components/housing/tour/__tests__/TourNavMap.test.tsx src/styles/housing.css
git commit -m "feat(housing): ツアー中央地図から番号マーカー/LIVE/凡例を撤去(改善4+6)"
```

---

### Task 2: 純関数 `computeDefaultView` + `routeBbox`（見切れ厳禁のフィット計算）

**Files:**
- Create: `src/lib/housing/mapDefaultView.ts`
- Create: `src/lib/housing/__tests__/mapDefaultView.test.ts`

**Interfaces:**
- Consumes: `MapView`（`src/lib/housing/mapZoom.ts:2` `export interface MapView { scale: number; tx: number; ty: number }`）。
- Produces:
  - `export interface Bbox { minX: number; minY: number; maxX: number; maxY: number }`
  - `export function routeBbox(paths: (string | null | undefined)[], extra?: { x: number; y: number }[]): Bbox | null`
  - `export function computeDefaultView(bbox: Bbox, vb: { w: number; h: number }, wrap: { w: number; h: number }, padPx: number): MapView`
  - Task 3 がこの 2 関数を呼ぶ。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/mapDefaultView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { routeBbox, computeDefaultView, type Bbox } from '../mapDefaultView';

// viewBox 点 → 変換後の wrap-px 座標（overlay meet 写像 → zoom transform）。テスト内で見切れ判定に使う。
function project(p: { x: number; y: number }, vb: { w: number; h: number }, wrap: { w: number; h: number }, v: { scale: number; tx: number; ty: number }) {
  const m = Math.min(wrap.w / vb.w, wrap.h / vb.h);
  const ox = (wrap.w - vb.w * m) / 2, oy = (wrap.h - vb.h * m) / 2;
  const X = ox + p.x * m, Y = oy + p.y * m;
  return { x: X * v.scale + v.tx, y: Y * v.scale + v.ty };
}
function within(pt: { x: number; y: number }, wrap: { w: number; h: number }) {
  const e = 0.5; // 端の許容 0.5px
  return pt.x >= -e && pt.x <= wrap.w + e && pt.y >= -e && pt.y <= wrap.h + e;
}

const VB = { w: 470, h: 350 };
const WRAP = { w: 600, h: 450 };

describe('routeBbox', () => {
  it('M/L パスと追加点から bbox を得る', () => {
    const b = routeBbox(['M10 20 L100 40', 'M100 40 L60 200'], [{ x: 5, y: 5 }]);
    expect(b).toEqual({ minX: 5, minY: 5, maxX: 100, maxY: 200 });
  });
  it('空/ null 群は null', () => {
    expect(routeBbox([null, undefined, ''])).toBeNull();
  });
});

describe('computeDefaultView — 見切れ厳禁', () => {
  const cases: Bbox[] = [
    { minX: 50, minY: 40, maxX: 300, maxY: 250 },   // 通常
    { minX: 200, minY: 170, maxX: 210, maxY: 175 }, // 極小（起点と家が近い → 最大ズーム側）
    { minX: 0, minY: 0, maxX: 470, maxY: 350 },      // マップ全体（最小ズーム側）
    { minX: 10, minY: 300, maxX: 460, maxY: 320 },   // 横長で下端
  ];
  it.each(cases)('bbox 四隅は変換後 wrap 内に収まる %#', (bbox) => {
    const v = computeDefaultView(bbox, VB, WRAP, 24);
    const corners = [
      { x: bbox.minX, y: bbox.minY }, { x: bbox.maxX, y: bbox.minY },
      { x: bbox.minX, y: bbox.maxY }, { x: bbox.maxX, y: bbox.maxY },
    ];
    for (const c of corners) expect(within(project(c, VB, WRAP, v), WRAP)).toBe(true);
  });
  it('極小 bbox は scale が上限 8 にクランプ', () => {
    const v = computeDefaultView({ minX: 200, minY: 170, maxX: 201, maxY: 171 }, VB, WRAP, 24);
    expect(v.scale).toBe(8);
  });
  it('マップ全体 bbox は scale が下限 1 にクランプ', () => {
    const v = computeDefaultView({ minX: 0, minY: 0, maxX: 470, maxY: 350 }, VB, WRAP, 24);
    expect(v.scale).toBe(1);
  });
});
```

- [ ] **Step 2: テスト実行して失敗を確認**

Run: `npx vitest run src/lib/housing/__tests__/mapDefaultView.test.ts`
Expected: FAIL（`../mapDefaultView` が存在しない）

- [ ] **Step 3: 純関数を実装**

`src/lib/housing/mapDefaultView.ts`:

```ts
import type { MapView } from './mapZoom';

const MIN_SCALE = 1;
const MAX_SCALE = 8;

export interface Bbox { minX: number; minY: number; maxX: number; maxY: number }

/**
 * 経路パス文字列群（+ 追加点）を走査し viewBox 座標系の bbox を返す純関数。
 * パスは "M x y L x y ..."（弧 Q/C 含む場合も可）を前提に、数値を順に x,y ペアとして拾う。
 * 弧の制御点が混ざっても bbox は安全側に広がるだけで、見切れ厳禁の不変条件は保たれる。
 */
export function routeBbox(paths: (string | null | undefined)[], extra: { x: number; y: number }[] = []): Bbox | null {
  const nums: number[] = [];
  for (const p of paths) {
    if (!p) continue;
    const found = p.match(/-?\d+(?:\.\d+)?/g);
    if (found) for (const s of found) nums.push(parseFloat(s));
  }
  const pts: { x: number; y: number }[] = [...extra];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  if (pts.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of pts) {
    if (q.x < minX) minX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.x > maxX) maxX = q.x;
    if (q.y > maxY) maxY = q.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * 経路 bbox（viewBox 座標）を wrap（px）いっぱいに収める MapView を返す純関数。
 * overlay は xMidYMid meet なので viewBox→wrap は等倍レターボックス写像。その上へ zoom transform（translate→scale, origin 0,0）を載せる。
 * padPx: 経路が端に貼り付かないための余白。scale は [1,8] にクランプ。
 * 不変条件: bbox の四隅（起点エーテライトと家を含む）は変換後 [0,wrap.w]×[0,wrap.h] に必ず収まる（見切れ厳禁）。
 */
export function computeDefaultView(bbox: Bbox, vb: { w: number; h: number }, wrap: { w: number; h: number }, padPx: number): MapView {
  const m = Math.min(wrap.w / vb.w, wrap.h / vb.h);
  const ox = (wrap.w - vb.w * m) / 2;
  const oy = (wrap.h - vb.h * m) / 2;
  const X0 = ox + bbox.minX * m, Y0 = oy + bbox.minY * m;
  const X1 = ox + bbox.maxX * m, Y1 = oy + bbox.maxY * m;
  const bw = Math.max(1, X1 - X0), bh = Math.max(1, Y1 - Y0);
  const availW = Math.max(1, wrap.w - 2 * padPx), availH = Math.max(1, wrap.h - 2 * padPx);
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(availW / bw, availH / bh)));
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  return { scale: s, tx: wrap.w / 2 - cx * s, ty: wrap.h / 2 - cy * s };
}
```

- [ ] **Step 4: テスト実行して成功を確認**

Run: `npx vitest run src/lib/housing/__tests__/mapDefaultView.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/mapDefaultView.ts src/lib/housing/__tests__/mapDefaultView.test.ts
git commit -m "feat(housing): 経路フィット既定表示の純関数 computeDefaultView/routeBbox(改善7・見切れ厳禁テスト)"
```

---

### Task 3: パン&ズームを本番 TourNavMap に配線（改善5+7）

**Files:**
- Modify: `src/lib/housing/mapZoom.ts`（ピンチ用に `zoomAt` を切り出し・`applyWheelZoom` は挙動不変で内部委譲）
- Modify: `src/components/housing/tour/TourNavMap.tsx`（view state / ResizeObserver / ネイティブ wheel / pointer パン+ピンチ / `.housing-map-zoom` ラッパ / ステップ変更で既定表示リセット / 「全体に戻す」ボタン）
- Modify: `src/styles/housing.css`（本番 nav 用に wrap をステージ充填する modifier + 「全体に戻す」ボタンの見た目トークン）
- Modify: `src/components/housing/tour/__tests__/TourNavMap.test.tsx`（`.housing-map-zoom` と「全体に戻す」ボタンの存在を追加）
- Modify: `src/locales/{ja,en,ko,zh}.json`（`housing.tour.nav.reset_view` を 4 言語追加）

**Interfaces:**
- Consumes: `computeDefaultView` / `routeBbox`（Task 2）、`applyWheelZoom` / 新 `zoomAt` / `MapView`（`mapZoom.ts`）、`TourMapModel`（`routePath`/`routeJumpPath`/`origin`）。
- Produces: 本番地図に `.housing-map-zoom`（transform 済み）と HUD 内の `[data-testid="tour-map-reset"]` ボタン。DEV は不変。

- [ ] **Step 1: i18n キーを 4 言語に追加（textual・該当ブロックのみ）**

各 `src/locales/*.json` の `housing.tour.nav` ブロック内、`"map_none"` の隣に `"reset_view"` を足す（既存 `"live"`/`"legend"` は死にキーとして**残す**）:
- `ja.json`: `"reset_view": "全体に戻す",`
- `en.json`: `"reset_view": "Reset view",`
- `ko.json`: `"reset_view": "전체 보기",`
- `zh.json`: `"reset_view": "重置视图",`

（4 ファイルとも `housing.tour.nav` 配下・同じキー名で parity を保つ。ko/zh は暫定訳で可、TODO の翻訳実値タスクで最終化。）

- [ ] **Step 2: `mapZoom.ts` にピンチ用 `zoomAt` を追加（挙動不変）**

`src/lib/housing/mapZoom.ts` を次に置き換え（`applyWheelZoom` の出力は現行と同一・DEV に影響なし）:

```ts
/** DEV 経路エディタ / 本番ツアー地図のパン/ズーム状態。tx/ty はラップ px、scale は倍率。 */
export interface MapView { scale: number; tx: number; ty: number }

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.1;

/** カーソル/ピンチ中心 (mx,my=ラップ内 px) を固定したまま目標倍率へズームした新しい MapView を返す純関数。scale は [1,8] クランプ。変化なしなら同一参照。 */
export function zoomAt(v: MapView, mx: number, my: number, nextScaleRaw: number): MapView {
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScaleRaw));
  if (newScale === v.scale) return v;
  const k = newScale / v.scale;
  return { scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
}

/** ホイールでカーソル位置 (mx,my) を固定したままズーム。deltaY<0 で拡大。 */
export function applyWheelZoom(v: MapView, mx: number, my: number, deltaY: number): MapView {
  return zoomAt(v, mx, my, v.scale * (deltaY < 0 ? STEP : 1 / STEP));
}
```

- [ ] **Step 3: 失敗するテストを追加**

`src/components/housing/tour/__tests__/TourNavMap.test.tsx` に it を追加（`describe` 内末尾）:

```tsx
  it('ready でパン/ズーム用の .housing-map-zoom と「全体に戻す」ボタンを持つ', () => {
    const { container } = render(<TourNavMap status="ready" svg={'<svg><path id="plot_6" /></svg>'} viewBox={{ w: mistWard.viewBox.w, h: mistWard.viewBox.h }} model={model} />);
    expect(container.querySelector('.housing-map-zoom')).toBeTruthy();
    expect(container.querySelector('[data-testid="tour-map-reset"]')).toBeTruthy();
  });
```

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: FAIL（`.housing-map-zoom`/reset ボタン未実装）

- [ ] **Step 4: TourNavMap.tsx にパン&ズームを実装**

`src/components/housing/tour/TourNavMap.tsx` を次の全文に置き換える（Task 1 の撤去反映済み前提。host/overlay を `.housing-map-zoom` で包み、wrap にパン+ピンチ、HUD に「全体に戻す」、ステップ変更で既定表示へリセット）:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';
import { applyWheelZoom, zoomAt, type MapView } from '../../../lib/housing/mapZoom';
import { computeDefaultView, routeBbox } from '../../../lib/housing/mapDefaultView';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
}

const FIT_PAD_PX = 28; // 既定表示で経路が端に貼り付かない余白（実画面ゲートで調整可）

/** ツアー中(Nav) 中央: 表示専用の LIVE 地図。実エーテライト起点→家の経路をアニメし、目的地の実区画(#plot_N/#apart_N)を光らせる。
 * 地図は指/マウスでパン&ズーム可。既定は起点〜家の経路にフィット（見切れ厳禁）、ステップが変わると自動で既定へ戻る。 */
export const TourNavMap: React.FC<TourNavMapProps> = ({ status, svg, viewBox, model }) => {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const route = model?.routePath ?? null;
  const routeJump = model?.routeJumpPath ?? null;
  const origin = model?.origin ?? null;
  const targetElId = model?.targetElId ?? null;

  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const [wrapSize, setWrapSize] = useState<{ w: number; h: number } | null>(null);

  // wrap の実 px を観測（forced reflow 回避のため ResizeObserver）。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setWrapSize({ w: r.width, h: r.height });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [status]);

  // 既定表示へリセット（起点〜家の経路にフィット）。ステップ変更(route/target)と wrap リサイズで再計算。手動パン/ズームは次のステップまで保持。
  const resetView = useCallback(() => {
    if (!viewBox || !wrapSize) return;
    const bbox = routeBbox([route, routeJump], origin ? [origin] : []);
    if (!bbox) { setView({ scale: 1, tx: 0, ty: 0 }); return; }
    setView(computeDefaultView(bbox, viewBox, wrapSize, FIT_PAD_PX));
  }, [viewBox, wrapSize, route, routeJump, origin]);

  useEffect(() => { resetView(); }, [resetView]);

  // ホイールズーム（カーソル位置固定）。React onWheel は passive で preventDefault が効かないためネイティブ登録。
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      setView((v) => applyWheelZoom(v, e.clientX - r.left, e.clientY - r.top, e.deltaY));
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [status, svg]); // ready の DOM 出現時にアタッチ

  // パン(1本指/ドラッグ) + ピンチ(2本指)。pointer events で PC/タッチ統一。
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pan = useRef<{ sx: number; sy: number; tx0: number; ty0: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);

  const localXY = (clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: clientX - (r?.left ?? 0), y: clientY - (r?.top ?? 0) };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size === 1) {
      pan.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty };
      pinch.current = null;
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      pan.current = null;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = localXY((a.x + b.x) / 2, (a.y + b.y) / 2);
      const base = pinch.current;
      setView((v) => zoomAt(v, mid.x, mid.y, base.scale * (dist / base.dist)));
    } else if (pan.current) {
      const p = pan.current;
      setView((v) => ({ ...v, tx: p.tx0 + (e.clientX - p.sx), ty: p.ty0 + (e.clientY - p.sy) }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
    if (ptrs.current.size === 0) pan.current = null;
  };

  // 目的地アピール: 埋め込み済み SVG の該当パスに光らせ用クラスを付け外し。svg 差し替え/targetElId 変化の両方で再適用し stale を残さない。
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
        <div
          className="housing-tour-map-wrap is-nav"
          ref={wrapRef}
          onPointerDown={status === 'ready' ? onPointerDown : undefined}
          onPointerMove={status === 'ready' ? onPointerMove : undefined}
          onPointerUp={status === 'ready' ? onPointerUp : undefined}
          onPointerCancel={status === 'ready' ? onPointerUp : undefined}
        >
          {status === 'loading' && <div className="housing-tour-map-skeleton" data-testid="tour-map-skeleton" aria-hidden="true" />}
          {(status === 'none' || status === 'error') && (
            <div className="housing-tour-map-none" data-testid="tour-map-none">
              <p className="housing-tour-map-none-text">{t(status === 'error' ? 'housing.tour.nav.map_error' : 'housing.tour.nav.map_none')}</p>
            </div>
          )}
          {status === 'ready' && svg && viewBox && (
            <div className="housing-map-zoom" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}>
              <div ref={hostRef} className="housing-map-svg-host" role="img" aria-label={t('housing.workspace.center.map_alt')} dangerouslySetInnerHTML={{ __html: svg }} />
              <svg className="housing-map-overlay" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                {route && (
                  <>
                    <path className="housing-tour-route-glow" d={route} fill="none" />
                    <path data-testid="tour-map-route" className="housing-tour-route-core" d={route} fill="none">
                      <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="1.1s" repeatCount="indefinite" />
                    </path>
                    <circle className="housing-tour-route-comet" r="10">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path={route} rotate="auto" />
                    </circle>
                  </>
                )}
                {routeJump && (
                  <path data-testid="tour-map-route-jump" className="housing-tour-route-jump" d={routeJump} fill="none" />
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
              </svg>
            </div>
          )}
        </div>
        {status === 'ready' && (
          <div className="housing-hud is-top">
            <button type="button" data-testid="tour-map-reset" className="housing-tour-map-reset" onClick={resetView}>
              {t('housing.tour.nav.reset_view')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 5: CSS — nav 用 wrap 充填 modifier + 「全体に戻す」ボタン**

`src/styles/housing.css` の `.housing-tour-map-wrap {...}`（`:6017-6024`）直後に追記（基底クラスは DEV と共有なので**触らず**、本番 nav 用 modifier を足す）:

```css
/* 本番ツアー(Nav)地図: ステージいっぱいに充填し、既定表示(経路フィット)を活かす。DEV(.housing-dev-tourpreview)は基底のまま。 */
.housing-tour-map-wrap.is-nav {
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  transform: none;
  overflow: hidden;
  touch-action: none; /* パン/ピンチをブラウザのスクロール/ズームに奪われない */
  cursor: grab;
}
.housing-tour-map-wrap.is-nav:active { cursor: grabbing; }

/* 「全体に戻す」ボタン(HUD 内)。トークン経由・装飾ピルにしない(落ち着いたガラス面)。 */
.housing-tour-map-reset {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--housing-panel-border);
  background: var(--housing-chip-bg);
  color: var(--housing-text-dim);
  font-size: var(--housing-text-xs);
  cursor: pointer;
  transition: background 0.2s;
}
.housing-tour-map-reset:hover { background: var(--housing-chip-bg-hover); }
.housing-tour-map-reset:active { transform: scale(0.98); }
```

（`--housing-chip-bg`/`--housing-chip-bg-hover`/`--housing-panel-border`/`--housing-text-dim`/`--housing-text-xs` は既存トークン。存在を grep 確認し、無ければ最寄りの既存トークンに合わせる。`.housing-map-zoom` は `:6027` の既存定義を本番でも流用。）

- [ ] **Step 6: テスト実行して成功を確認**

Run: `npx vitest run src/components/housing/tour/__tests__/TourNavMap.test.tsx`
Expected: PASS（Step 3 の it 含め全緑。happy-dom に ResizeObserver が無い場合はテスト setup の polyfill を確認 — 無ければ `src/test/setup` に `global.ResizeObserver` の簡易 polyfill を追加してから再実行）

- [ ] **Step 7: build + 全テスト + DEV スモーク**

Run: `npm run build`
Expected: EXIT0

Run: `npx vitest run`
Expected: 既知 legacy 5 fail 以外に新規 fail ゼロ

DEV 回帰の確認（mapZoom リファクタが DEV のホイールズームを壊していないこと）:
Run: `npm run dev`（別ターミナル）→ ブラウザで `/housing/dev/routes` を開き、ホイールズーム/ドラッグパン/「等倍に戻す」が従来通り動くことを目視（[[reference_dev_editor_hmr_hardreload]] によりハードリロード必須）。

- [ ] **Step 8: コミット**

```bash
git add src/lib/housing/mapZoom.ts src/components/housing/tour/TourNavMap.tsx src/components/housing/tour/__tests__/TourNavMap.test.tsx src/styles/housing.css src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): ツアー中央地図にパン&ズーム+経路フィット既定表示(改善5+7・自前mapZoom流用/新規依存なし)"
```

---

### Task 4: 実機ゲート（ユーザー・コードなし）

Phase 2 は見た目の変更を含むため、merge/デプロイ前にユーザーの実画面（CSS `1489x679` / DPR `2.58`）で確認する。確認観点:

- [ ] **地図の見た目**: 番号マーカー・LIVEピル・凡例が消えて、光る箱＋経路だけのカーナビ然とした地図になっている。
- [ ] **既定表示（改善7）**: ステップを進めるたびに、起点エーテライトと向かう家が**必ず両方見える**（上下左右どこも見切れない）。地図が小さく浮かず、パネルを埋めている。余白（`FIT_PAD_PX`）が窮屈/緩すぎないか。
- [ ] **パン&ズーム（改善5）**: マウスホイールでカーソル中心にズーム、ドラッグでパン、「全体に戻す」で既定へ復帰。スマホ実機でピンチズーム＋1本指ドラッグ。
- [ ] **リセット挙動**: 手動でパン/ズームした後に「次へ」で次ステップへ進むと、既定表示へ自動リセットされる。

調整ノブ: 余白 = `TourNavMap.tsx` の `FIT_PAD_PX`。色/ボタン見た目 = `housing.css` の `.housing-tour-map-reset`。ズーム上限/下限 = `mapZoom.ts` の `MAX_SCALE`/`MIN_SCALE`。

OK が出たら `superpowers:finishing-a-development-branch` で merge ゲートへ（Phase 3/4 は別プラン）。

---

## Self-Review 結果

- **Spec coverage**: 改善4（番号撤去）=Task1 / 改善6（LIVE+凡例撤去）=Task1 / 改善5（パン&ズーム）=Task3 / 改善7（経路フィット既定・見切れ厳禁）=Task2+Task3。spec §9 テスト方針の「見切れ厳禁テスト」=Task2 Step1。改善1/2/3/8（Phase1）は実装済のため本プラン対象外（事前調査で確認）。
- **Placeholder scan**: TBD/TODO/「適切に処理」等なし。全コード実体あり。
- **Type consistency**: `MapView`（mapZoom）を Task2/3 で一貫使用。`computeDefaultView`/`routeBbox`/`zoomAt` のシグネチャは Interfaces と本文で一致。`Bbox` は mapDefaultView で export しテストが import。
- **依存追加**: なし（自前 mapZoom 流用）。spec §7「ライブラリ vs 自前」は事実調査で自前に確定。
- **共有影響**: `.housing-tour-map-wrap` 基底は不変（`.is-nav` modifier 追加のみ）、`mapZoom.applyWheelZoom` は挙動不変、DEV は Task3 Step7 でスモーク回帰。
