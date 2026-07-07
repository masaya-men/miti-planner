# 経路エディタ 赤線常時表示 + パン/ズーム 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DEV 経路エディタ(`/housing/dev/routes`)で赤いナビ線を常時表示し、マップを Googleマップ式にパン/ズームできるようにする(手動 override 作業の効率化)。

**Architecture:** 赤線は `.housing-dev-tourpreview` スコープの CSS で hide ルールを上書きして可視化(本番非影響)。パン/ズームは地図SVG+オーバーレイを1つのズームコンテナで包み同一 transform をかける(常に整列)。ズーム座標計算は純関数に切り出して単体テスト。点配置は pointerdown→pointerup(動かなければ配置)に変えてパンと分離。

**Tech Stack:** React / TypeScript / Vite / CSS。DEV専用コンポーネント `RouteAuthoringPage.tsx` + `housing.css`。

## Global Constraints

- **DEV エディタのみ**変更。本番ツアーコンポーネント(`TourNavMap`/`TourNavPage`)・ルーティング lib は無改変。赤線は本番では従来通り非表示。
- ハードコード回避: 色/寸法はトークン経由(`housing.css` のハウジング変数ブロックに追加)。設計=[docs/superpowers/specs/2026-07-07-housing-route-editor-redline-panzoom-design.md](../specs/2026-07-07-housing-route-editor-redline-panzoom-design.md)。
- 点配置の座標変換は `svg.getScreenCTM().inverse()`(祖先 transform を含むので pan/zoom 中も正しい)。追加補正しない。
- コメントは日本語。未使用 import/変数を残さない(tsc -b 厳密)。push 前 `npm run build` + `npm run test` 緑。

---

### Task 1: ズーム座標の純関数 `applyWheelZoom` + 単体テスト

**Files:**
- Create: `src/lib/housing/mapZoom.ts`
- Test: `src/lib/housing/__tests__/mapZoom.test.ts`

**Interfaces:**
- Produces: `interface MapView { scale: number; tx: number; ty: number }` と `applyWheelZoom(v: MapView, mx: number, my: number, deltaY: number): MapView`(カーソル(mx,my=ラップ内px)を固定してズーム。scale は [1,8] にクランプ。変化なしなら同一 v を返す)。Task 3 が使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housing/__tests__/mapZoom.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { applyWheelZoom, type MapView } from '../mapZoom';

const contentAt = (v: MapView, mx: number, my: number) => [(mx - v.tx) / v.scale, (my - v.ty) / v.scale];

describe('applyWheelZoom', () => {
  it('ズームインしてもカーソル下の内容座標は不変', () => {
    const v: MapView = { scale: 1, tx: 0, ty: 0 };
    const before = contentAt(v, 100, 80);
    const nv = applyWheelZoom(v, 100, 80, -100); // deltaY<0 = zoom in
    expect(nv.scale).toBeCloseTo(1.1, 5);
    const after = contentAt(nv, 100, 80);
    expect(after[0]).toBeCloseTo(before[0], 4);
    expect(after[1]).toBeCloseTo(before[1], 4);
  });

  it('ズームアウトでもカーソル下の内容座標は不変', () => {
    const v: MapView = { scale: 4, tx: -120, ty: -60 };
    const before = contentAt(v, 200, 150);
    const nv = applyWheelZoom(v, 200, 150, +100); // zoom out
    expect(nv.scale).toBeCloseTo(4 / 1.1, 5);
    const after = contentAt(nv, 200, 150);
    expect(after[0]).toBeCloseTo(before[0], 4);
    expect(after[1]).toBeCloseTo(before[1], 4);
  });

  it('最小(1)より縮小しない=同一 v を返す', () => {
    const v: MapView = { scale: 1, tx: 0, ty: 0 };
    expect(applyWheelZoom(v, 50, 50, +100)).toBe(v);
  });

  it('最大(8)より拡大しない=同一 v を返す', () => {
    const v: MapView = { scale: 8, tx: -10, ty: -10 };
    expect(applyWheelZoom(v, 50, 50, -100)).toBe(v);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/lib/housing/__tests__/mapZoom.test.ts`
Expected: FAIL(`mapZoom.ts` 無し)

- [ ] **Step 3: 実装**

`src/lib/housing/mapZoom.ts`:

```ts
/** DEV 経路エディタのパン/ズーム状態。tx/ty はラップ px、scale は倍率。 */
export interface MapView { scale: number; tx: number; ty: number }

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const STEP = 1.1;

/**
 * ホイールでカーソル位置(mx,my=ラップ内 px)を固定したままズームした新しい MapView を返す純関数。
 * scale は [1,8] にクランプ。クランプで scale が変わらない時は同一参照を返す(無駄な再描画回避)。
 */
export function applyWheelZoom(v: MapView, mx: number, my: number, deltaY: number): MapView {
  const factor = deltaY < 0 ? STEP : 1 / STEP;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
  if (newScale === v.scale) return v;
  const k = newScale / v.scale;
  return { scale: newScale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/lib/housing/__tests__/mapZoom.test.ts`
Expected: PASS(4件)

- [ ] **Step 5: コミット**

```bash
git add src/lib/housing/mapZoom.ts src/lib/housing/__tests__/mapZoom.test.ts
git commit -m "feat(housing): DEV地図ズームの純関数 applyWheelZoom + 単体テスト"
```

---

### Task 2: 赤線の常時表示(エディタ限定 CSS + トークン)

**Files:**
- Modify: `src/styles/housing.css`(ハウジング変数ブロックにトークン2つ / `.housing-map-svg-host svg [stroke="#FF0000"]` 非表示ルール付近に上書きルール)

**Interfaces:** なし(CSSのみ)。

- [ ] **Step 1: トークンを追加**

`src/styles/housing.css` のハウジング変数を定義しているブロック(`--housing-*` が並ぶ箇所、例 `.housing-workspace` の上部)に追加:

```css
  /* DEV 経路エディタ: ナビ赤線の可視化(本番非表示・DEVのみ)。 */
  --housing-dev-navline: #ff3b3b;
  --housing-dev-navline-w: 1.5px;
```

- [ ] **Step 2: エディタ限定の可視化ルールを追加**

`housing.css` の非表示ルール `.housing-map-svg-host svg [stroke="#FF0000"] { display: none; }`(909行付近)の**直後**に追加:

```css
/* DEV 経路エディタでのみナビ赤線を可視化(本番ツアーは .housing-dev-tourpreview を持たないので非表示のまま)。 */
.housing-dev-tourpreview .housing-map-svg-host svg [stroke="#FF0000"] {
  display: inline;
  stroke: var(--housing-dev-navline);
  stroke-width: var(--housing-dev-navline-w);
  fill: none;
  opacity: 0.85;
}
```

- [ ] **Step 3: ビルドが通ることを確認**

Run: `npx tsc -b`
Expected: エラー無し(CSSはtscに影響しないが、後続タスクと合わせて型健全性を確認)

- [ ] **Step 4: コミット**

```bash
git add src/styles/housing.css
git commit -m "feat(dev): 経路エディタでナビ赤線を常時表示(エディタ限定・本番非影響)"
```

> 赤線が実際に描画されることの目視は Task 4(Playwright)で確認する。

---

### Task 3: パン/ズームを RouteAuthoringPage に統合

**Files:**
- Modify: `src/components/housing/dev/RouteAuthoringPage.tsx`
- Modify: `src/styles/housing.css`(`.housing-map-zoom` と エディタ限定の wrap クリップ)

**Interfaces:**
- Consumes: `applyWheelZoom`, `MapView`(Task 1)。

- [ ] **Step 1: CSS を追加**

`src/styles/housing.css` に追加(`.housing-tour-map-wrap` 定義付近):

```css
/* DEV 経路エディタ: 地図SVG+オーバーレイを一体でパン/ズームするコンテナ。 */
.housing-map-zoom { position: absolute; inset: 0; transform-origin: 0 0; }
/* ズーム時に地図がパネル外へはみ出さないよう DEV エディタのみクリップ。 */
.housing-dev-tourpreview .housing-tour-map-wrap { overflow: hidden; }
```

- [ ] **Step 2: import と state を追加**

`RouteAuthoringPage.tsx` の import に追加:

```ts
import { applyWheelZoom, type MapView } from '../../../lib/housing/mapZoom';
```

コンポーネント冒頭の state 群(`const [dragIdx, ...]` 付近)に追加:

```ts
  const [view, setView] = useState<MapView>({ scale: 1, tx: 0, ty: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ sx: number; sy: number; tx0: number; ty0: number; moved: boolean } | null>(null);
```

- [ ] **Step 3: wheel ネイティブリスナ(passive:false)を追加**

`RouteAuthoringPage.tsx` の既存 `useEffect`(箱ハイライト)付近に追加。React onWheel は passive で preventDefault が効かないためネイティブ登録:

```ts
  // ホイールズーム(カーソル位置固定)。passive:false でページスクロールを止める。
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
  }, []);
```

- [ ] **Step 4: pointer ハンドラをパン対応に改修(配置を pointerup 化)**

`RouteAuthoringPage.tsx` の `onStageDown` / `onStageMove` と pointerup を次に置き換える:

```ts
  // pointerdown: パン開始候補として記録(まだ配置しない)。点の circle は stopPropagation でここに来ない。
  function onStageDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx !== null) return;
    panRef.current = { sx: e.clientX, sy: e.clientY, tx0: view.tx, ty0: view.ty, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onStageMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx !== null) {
      const kind = points[dragIdx]?.kind ?? 'road';
      const n = clientToNorm(e.clientX, e.clientY, snap && kind === 'road');
      if (!n) return;
      setPointsFn((prev) => { const next = prev.slice(); if (!next[dragIdx]) return prev; next[dragIdx] = { ...next[dragIdx], x: n[0], y: n[1] }; return next; });
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
    if (!pan.moved && Math.hypot(dx, dy) > 5) pan.moved = true;
    if (pan.moved) setView((v) => ({ ...v, tx: pan.tx0 + dx, ty: pan.ty0 + dy }));
  }
  // pointerup: 点ドラッグ解除 / パン未発生(=クリック)なら点を配置。
  function onStageUp(e: ReactPointerEvent<SVGSVGElement>) {
    if (dragIdx !== null) { setDragIdx(null); return; }
    const pan = panRef.current;
    panRef.current = null;
    if (pan && !pan.moved) {
      const n = clientToNorm(e.clientX, e.clientY, snap && mode === 'road');
      if (n) setPointsFn((prev) => [...prev, { x: n[0], y: n[1], kind: mode }]);
    }
  }
```

- [ ] **Step 5: JSX を改修(ズームコンテナ + overlay ハンドラ差し替え + ラップ ref + リセットボタン)**

(a) `.housing-tour-map-wrap` に `ref={wrapRef}` を付ける:

```tsx
                <div className="housing-tour-map-wrap" ref={wrapRef}>
```

(b) その内側、`asset.status === 'ready' && json` の `<>` 内で host と overlay を `.housing-map-zoom` で包む。overlay の `onPointerUp` を `onStageUp` に、`onPointerLeave` を削除し `onPointerCancel={onStageUp}` を追加(パン/配置の後始末を一本化):

```tsx
                    <div className="housing-map-zoom" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}>
                      <div ref={hostRef} className="housing-map-svg-host" dangerouslySetInnerHTML={{ __html: asset.svg }} />
                      <svg
                        ref={svgRef}
                        className="housing-map-overlay"
                        viewBox={`0 0 ${w} ${h}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ pointerEvents: 'auto', cursor: 'crosshair', touchAction: 'none' }}
                        onPointerDown={onStageDown}
                        onPointerMove={onStageMove}
                        onPointerUp={onStageUp}
                        onPointerCancel={onStageUp}
                      >
                        {/* ...(既存の displayRoad / displayJump / origin / door / points はそのまま)... */}
                      </svg>
                    </div>
```

(c) ツールバー(`.housing-dev-tourpreview-bar`)の保存ボタン付近に「等倍に戻す」を追加:

```tsx
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}>等倍に戻す</button>
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し(未使用の旧 `onPointerLeave` 参照や未使用 import が残っていないこと)

- [ ] **Step 7: コミット**

```bash
git add src/components/housing/dev/RouteAuthoringPage.tsx src/styles/housing.css
git commit -m "feat(dev): 経路エディタにパン/ズーム(Googleマップ式・クリック配置はpointerup化)"
```

---

### Task 4: Playwright 実機検証 + build/vitest ゲート

**Files:** なし(検証のみ)

- [ ] **Step 1: dev 起動確認**

dev が動いていなければ `npm run dev`(バックグラウンド)。URL: `http://localhost:<port>/housing/dev/routes`。

- [ ] **Step 2: Playwright で赤線・パン・ズームを検証**

Playwright スクリプト(scratchpad)で以下を確認しスクショ保存:
- `[stroke="#FF0000"]` がエディタで可視(`display` が `none` でない)= 赤線が出ている(mist と もう1エリアで確認)。
- ホイールで `.housing-map-zoom` の transform の scale が増える(カーソル付近が拡大)。
- overlay をドラッグ → transform の translate が変わる(パン)/ ドラッグ後は点が増えない。
- overlay を動かさずクリック → 点が1つ増える。
- 「等倍に戻す」→ transform が `scale(1)` に戻る。
- 赤線・金線・点がズーム/パンで一体移動(スクショ目視)。
実行: playwright-skill 経由(`cd <skill_dir> && node run.js <script>`)。

- [ ] **Step 3: 本番ツアーで赤線が非表示のままを確認**

`/housing/dev/tour-preview`(または本番ツアー画面)で `[stroke="#FF0000"]` が `display:none` のまま(赤線が出ない)ことを Playwright で確認。

- [ ] **Step 4: フルビルド + 全テスト**

Run: `npm run build`
Expected: 成功(exit 0)
Run: `npm run test`
Expected: 既知 legacy 5件(TopBar4+HousingWorkspace1)以外は緑。mapZoom 4件が新規緑。出力はパイプせずファイルへ(memory `reference_vitest_appcheck_teardown`)。

- [ ] **Step 5: ユーザーへ引き渡し**

dev URL とスクショで「赤線表示 + パン/ズーム完成」を報告。ユーザーが全家を手動 override → 保存 → Claude が git diff 確認、の運用へ。

## Self-Review

- **Spec coverage**: 赤線常時表示(Task2・エディタ限定 CSS)/ パン=ドラッグ・ズーム=ホイールカーソル固定(Task1純関数+Task3配線)/ クリック配置の pointerup 化でパンと分離(Task3)/ 等倍リセット(Task3)/ 一体移動=ズームコンテナ(Task3)/ 本番非影響(スコープ CSS・Task4で確認)/ getScreenCTM で座標頑健(補正なし)。全て対応。
- **Placeholder scan**: TBD/TODO 無し。純関数の全コード・CSS全文・JSX差分・実コマンドあり。Task3-5(b) の「既存はそのまま」は既存 JSX を指し新規コードではないので可(囲みは構造提示)。
- **Type consistency**: `MapView`/`applyWheelZoom` を Task1 で定義、Task3 で同名使用。`view.{scale,tx,ty}` 一貫。`ReactPointerEvent<SVGSVGElement>` は既存 import を流用。
