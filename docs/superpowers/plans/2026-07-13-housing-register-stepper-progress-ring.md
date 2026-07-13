# ステッパー円周進捗リング Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 登録ページ左パネルのステッパーの進捗表現を「丸を貫く縦線」から「各丸の円周を下端起点で左回りに描き、接続線でつなぐ連続リング」に置き換える。

**Architecture:** 進捗量の計算はテスト可能な純関数 `computeSegmentFills` に隔離し、`RegisterStepperNav` は丸の位置を ResizeObserver で測って SVG(円=`<circle>` / 接続線=`<line>`)に反映するだけにする。進捗ソース(`stepperProgress`・0..1)は RegisterPage の既存 scroll ハンドラをそのまま流用する。

**Tech Stack:** React + TypeScript / SVG(stroke-dasharray/dashoffset) / CSS カスタムプロパティ / vitest + @testing-library/react(happy-dom)

**設計書(正典):** `docs/superpowers/specs/2026-07-13-housing-register-stepper-progress-ring-design.md`

## Global Constraints

- **トークン経由**: 色・stroke 幅・半径等は `--housing-*` トークンで。ハードコード禁止(housing-design.md)。
- **色 = 青(`--housing-aether`)**: 進行色。ハニーは使わない。未塗りトラックは `--housing-divider` 相当。
- **既存回帰ゼロ**: done→✓ / active→青枠 / idle / クリックで `onJump(id)` / `step_desc.*` 説明文 / `aria-current` を壊さない。
- **reduced-motion 対応**: `@media (prefers-reduced-motion: reduce)` で塗りトランジションを無効化。
- **SVG は装飾**: `aria-hidden="true"`。意味は既存の数字/✓/`aria-current` が担う。
- **vitest は単一ファイル指定で実行**(`reference_vitest_vmthreads_hang`。出力をパイプしない)。
- **実画面目視**: 見た目(下端起点・反時計回り・線幅・色)は開発者実画面(CSS 1489 / DPR 2.58)で確認してから完了とする。happy-dom は実レイアウトを持たない(`getBoundingClientRect`→0)ので、数値の正しさは純関数テストで担保する。

---

## File Structure

- **Create** `src/lib/housing/stepperProgress.ts` — 純関数 `computeSegmentFills`(進捗→各セグメント塗り量)。
- **Create** `src/lib/housing/__tests__/stepperProgress.test.ts` — 上記のテスト。
- **Modify** `src/components/housing/register/RegisterStepperNav.tsx` — 縦線 track を SVG(円+接続線)に置換。座標測定を拡張。
- **Modify** `src/components/housing/register/__tests__/RegisterStepperNav.test.tsx` — `--stepper-progress` 反映テストを SVG ベースに置換。既存回帰は維持。
- **Modify** `src/styles/housing.css` — 円周/接続線 stroke のトークンとスタイル。既存 `.housing-register-stepper-track(-fill)` ルールを置換。

---

## Task 1: 進捗配分の純関数 `computeSegmentFills`

**Files:**
- Create: `src/lib/housing/stepperProgress.ts`
- Test: `src/lib/housing/__tests__/stepperProgress.test.ts`

**Interfaces:**
- Produces: `computeSegmentFills(p: number, segments: number[]): number[]`
  — セグメント列 `[円1, 線1, 円2, 線2, …, 円N]` の各実長(px)を受け、進捗 `p`(0..1)から各セグメントの塗り割合(0..1)を返す。

- [ ] **Step 1: 失敗テストを書く**

```ts
// src/lib/housing/__tests__/stepperProgress.test.ts
import { describe, it, expect } from 'vitest';
import { computeSegmentFills } from '../stepperProgress';

describe('computeSegmentFills', () => {
  it('p=0 で全て 0', () => {
    expect(computeSegmentFills(0, [10, 5, 10])).toEqual([0, 0, 0]);
  });
  it('p=1 で全て 1', () => {
    expect(computeSegmentFills(1, [10, 5, 10])).toEqual([1, 1, 1]);
  });
  it('途中は実長で按分される (total30, p=0.5 → 15px 塗り)', () => {
    // [10,10,10]: 15px 塗り → 円1=満(10) / 線1=半分(5/10) / 円2=0
    expect(computeSegmentFills(0.5, [10, 10, 10])).toEqual([1, 0.5, 0]);
  });
  it('セグメント境界ちょうど', () => {
    expect(computeSegmentFills(10 / 30, [10, 10, 10])).toEqual([1, 0, 0]);
  });
  it('p は 0..1 にクランプされる', () => {
    expect(computeSegmentFills(-1, [10, 10])).toEqual([0, 0]);
    expect(computeSegmentFills(2, [10, 10])).toEqual([1, 1]);
  });
  it('空配列は空を返す', () => {
    expect(computeSegmentFills(0.5, [])).toEqual([]);
  });
  it('総長 0 は全 0 (ゼロ除算しない)', () => {
    expect(computeSegmentFills(0.5, [0, 0])).toEqual([0, 0]);
  });
  it('長さ 0 のセグメントは 0、他は正しく塗る', () => {
    expect(computeSegmentFills(1, [10, 0, 10])).toEqual([1, 0, 1]);
  });
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk vitest run src/lib/housing/__tests__/stepperProgress.test.ts`
Expected: FAIL(`computeSegmentFills` is not a function / モジュール未存在)

- [ ] **Step 3: 最小実装**

```ts
// src/lib/housing/stepperProgress.ts
/**
 * ステッパー連続進捗リングの塗り量計算 (純関数)。
 * セグメント列 [円1, 線1, 円2, 線2, …, 円N] の各実長 (px) を受け、
 * スクロール進捗 p (0..1) から各セグメントの塗り割合 (0..1) を返す。
 *
 * total*p の長さを先頭から順にセグメントへ按分する (ペンが一定速度で進む感覚)。
 * total が 0 / 空配列 / 長さ 0 のセグメントはゼロ除算せず 0 を返す。
 */
export function computeSegmentFills(p: number, segments: number[]): number[] {
  const clamped = Math.min(1, Math.max(0, p));
  const total = segments.reduce((sum, len) => sum + len, 0);
  if (total <= 0) return segments.map(() => 0);
  let remaining = total * clamped;
  return segments.map((len) => {
    if (len <= 0) return 0;
    const fillHere = Math.min(len, Math.max(0, remaining));
    remaining -= fillHere;
    return fillHere / len;
  });
}
```

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk vitest run src/lib/housing/__tests__/stepperProgress.test.ts`
Expected: PASS(8件)

- [ ] **Step 5: コミット**

```bash
rtk git add src/lib/housing/stepperProgress.ts src/lib/housing/__tests__/stepperProgress.test.ts
rtk git commit -m "feat(housing): ステッパー進捗リングの塗り量計算 純関数 computeSegmentFills"
```

---

## Task 2: RegisterStepperNav に SVG 進捗レイヤーを追加(静的表示 + 座標測定)

このタスクでは SVG の円+接続線を丸に重ねて描画し、丸の中心 y を ResizeObserver で測って反映する所までを作る(progress 連動は Task 3)。既存の縦線 track はまだ残し、SVG は `progress` を受けても静的(全周 dash なし)で表示して座標が合うことを確認する。

**Files:**
- Modify: `src/components/housing/register/RegisterStepperNav.tsx`
- Test: `src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`

**Interfaces:**
- Consumes: `computeSegmentFills`(Task 1・Task 3 で使用)。
- Produces: SVG 要素 `.housing-register-stepper-ring`(各丸の円周・N 個)/ `.housing-register-stepper-connector`(接続線・N-1 個)。`data-testid="housing-register-stepper-svg"` を持つ `<svg>` ラッパー。

**定数(トークンと一致させる。実画面で微調整):**
- 丸中心 x = `21`(= item padding-left 10 + num 半径 11)
- 丸の描画半径 `R = 10`(num 22px の縁の内側に stroke が乗るよう、実画面で 10〜11 を調整)
- 円周長 `C = 2 * Math.PI * R`

- [ ] **Step 1: 失敗テストを書く**(SVG ラッパーと円・接続線の本数)

```tsx
// RegisterStepperNav.test.tsx の describe 内に追加
it('SVG レイヤーに円 (ステップ数) と接続線 (ステップ数-1) を描く', () => {
  const { container } = render(
    <I18nextProvider i18n={i18n}>
      <RegisterStepperNav steps={steps} onJump={() => {}} progress={0} />
    </I18nextProvider>,
  );
  expect(screen.getByTestId('housing-register-stepper-svg')).toBeInTheDocument();
  expect(container.querySelectorAll('.housing-register-stepper-ring').length).toBe(3);
  expect(container.querySelectorAll('.housing-register-stepper-connector').length).toBe(2);
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx -t "SVG レイヤー"`
Expected: FAIL(`housing-register-stepper-svg` が存在しない)

- [ ] **Step 3: RegisterStepperNav に SVG レイヤーと座標 state を実装**

`RegisterStepperNav.tsx` を次のように変更する(既存 track は Task 3 で消すのでこの段階では残置)。丸の中心 y を測る state を追加し、既存の `useLayoutEffect`(measure)を拡張する。

```tsx
import { useLayoutEffect, useRef, useState } from 'react';
// ... 既存 import はそのまま。CSSProperties import は不要になれば削除。

const RING_CX = 21;      // 丸中心 x
const RING_R = 10;       // 円周の描画半径 (実画面で 10〜11 調整)
const RING_C = 2 * Math.PI * RING_R;

export const RegisterStepperNav: React.FC<Props> = ({ steps, onJump, progress = 0 }) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 各丸の中心 y (stepper-body 基準・px) と body の全高。SVG 座標に使う。
  const [centers, setCenters] = useState<number[]>([]);
  const [svgHeight, setSvgHeight] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    const body = bodyRef.current;
    if (!list || !body) return;
    const measure = () => {
      const badges = list.querySelectorAll<HTMLElement>('.housing-register-stepper-num');
      const bodyRect = body.getBoundingClientRect();
      const ys: number[] = [];
      badges.forEach((b) => {
        const r = b.getBoundingClientRect();
        ys.push(r.top + r.height / 2 - bodyRect.top);
      });
      setCenters(ys);
      setSvgHeight(bodyRect.height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  }, [steps.length]);

  // 接続線 = 丸の縁から縁 (中心間距離 - 2R)。SVG 描画にだけ使う。
  const connectors = centers.slice(0, -1).map((cy, i) => {
    const next = centers[i + 1];
    return { y1: cy + RING_R, y2: next - RING_R, len: Math.max(0, next - cy - 2 * RING_R) };
  });

  return (
    <nav className="housing-register-stepper" aria-label={t('housing.register.stepper_aria_label')}>
      <div ref={bodyRef} className="housing-register-stepper-body">
        <svg
          className="housing-register-stepper-svg"
          data-testid="housing-register-stepper-svg"
          width="100%"
          height={svgHeight}
          aria-hidden="true"
        >
          {/* 接続線 (丸の後ろ) */}
          {connectors.map((c, i) => (
            <line
              key={`c-${i}`}
              className="housing-register-stepper-connector"
              x1={RING_CX}
              y1={c.y1}
              x2={RING_CX}
              y2={c.y2}
            />
          ))}
          {/* 円周リング */}
          {centers.map((cy, i) => (
            <circle
              key={`r-${i}`}
              className="housing-register-stepper-ring"
              cx={RING_CX}
              cy={cy}
              r={RING_R}
            />
          ))}
        </svg>
        <ol ref={listRef} className="housing-register-stepper-list">
          {/* 既存の li/button/num/content はそのまま (変更しない) */}
          {steps.map((step) => (
            /* ↓ 既存 JSX を維持 */
            <li key={step.id}>{/* …既存のまま… */}</li>
          ))}
        </ol>
      </div>
    </nav>
  );
};
```

> 注: 上の `li` は既存の中身(button / num / digit / check svg / content / label / desc)を **そのまま残す**。差し替えるのは「track の div を SVG に置換」「trackRef→bodyRef」「centers/svgHeight state と measure の中身」のみ。既存 track の div は Task 3 で削除する。

- [ ] **Step 4: テストが通るのを確認**

Run: `rtk vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`
Expected: PASS(既存 + 新規「SVG レイヤー」。happy-dom では centers が空でも円/接続線の**本数**は steps 由来なので通る。※本数を steps から描くため、centers 未測定でも circle は steps.length 個描く実装にすること。下記補足参照)

> **happy-dom 補足**: `getBoundingClientRect` が 0 を返すので `centers` が `[0,0,0]` になる。円は `centers.map` で描くと 3 個になり本数テストは通る。接続線は `centers.slice(0,-1)` で 2 個。座標は 0 でもテストは本数のみ検証するので問題ない。実画面では正しい y が入る。

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/housing/register/RegisterStepperNav.tsx src/components/housing/register/__tests__/RegisterStepperNav.test.tsx
rtk git commit -m "feat(housing): ステッパーに円周+接続線のSVGレイヤーと座標測定を追加"
```

---

## Task 3: progress 連動(dashoffset で塗る)+ 既存 track 廃止

**Files:**
- Modify: `src/components/housing/register/RegisterStepperNav.tsx`
- Test: `src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`

**Interfaces:**
- Consumes: `computeSegmentFills`(Task 1)。

- [ ] **Step 1: 失敗テストを書く**(progress で円の dashoffset が変わる / 既存 `--stepper-progress` テストを置換)

既存の `it('progress prop が --stepper-progress カスタムプロパティに反映される', …)` を **削除**し、次に置き換える。happy-dom では長さが 0 なので、`getBoundingClientRect` をスタブして中心 y を与えてから検証する。

```tsx
it('progress を上げると先頭の円の stroke-dashoffset が減る (塗りが増える)', () => {
  // happy-dom は実レイアウト非対応 → num の矩形をスタブして中心 y を与える。
  const rects = new Map<Element, DOMRect>();
  const orig = Element.prototype.getBoundingClientRect;
  let yCursor = 0;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('housing-register-stepper-num')) {
      const y = (yCursor += 40);
      return { top: y, height: 22, bottom: y + 22, left: 0, right: 22, width: 22, x: 0, y, toJSON: () => ({}) } as DOMRect;
    }
    if (this.classList.contains('housing-register-stepper-body')) {
      return { top: 0, height: 200, bottom: 200, left: 0, right: 40, width: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    }
    return rects.get(this) ?? ({ top: 0, height: 0, bottom: 0, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
  });

  const renderAt = (p: number) =>
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterStepperNav steps={steps} onJump={() => {}} progress={p} />
      </I18nextProvider>,
    );

  const { container: c0 } = renderAt(0);
  const ring0 = c0.querySelector('.housing-register-stepper-ring') as SVGCircleElement;
  const off0 = parseFloat(ring0.style.strokeDashoffset);

  const { container: c1 } = renderAt(0.5);
  const ring1 = c1.querySelector('.housing-register-stepper-ring') as SVGCircleElement;
  const off1 = parseFloat(ring1.style.strokeDashoffset);

  expect(off1).toBeLessThan(off0); // 塗りが増える = dashoffset が減る
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(orig);
});
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `rtk vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx -t "dashoffset"`
Expected: FAIL(dashoffset が未設定で `NaN` / 常に同じ)

- [ ] **Step 3: progress → 塗り量 → dashoffset を実装**

`RegisterStepperNav.tsx` に以下を追加。`segments` を `[円, 線, 円, 線, …, 円]` の順で組み、`computeSegmentFills` に通す。

```tsx
import { computeSegmentFills } from '../../../lib/housing/stepperProgress';

// centers/connectors 算出の後に:
const segments: number[] = [];
centers.forEach((_, i) => {
  segments.push(RING_C);                       // 円 i
  if (i < connectors.length) segments.push(connectors[i].len); // 線 i
});
const fills = computeSegmentFills(progress, segments);
const ringFill = (i: number) => fills[i * 2] ?? 0;       // 円 i
const connectorFill = (i: number) => fills[i * 2 + 1] ?? 0; // 線 i
```

各 `<line>` / `<circle>` に dash を適用:

```tsx
<line
  className="housing-register-stepper-connector"
  x1={RING_CX} y1={c.y1} x2={RING_CX} y2={c.y2}
  style={{ strokeDasharray: c.len, strokeDashoffset: c.len * (1 - connectorFill(i)) }}
/>
```

```tsx
<circle
  className="housing-register-stepper-ring"
  cx={RING_CX} cy={cy} r={RING_R}
  style={{ strokeDasharray: RING_C, strokeDashoffset: RING_C * (1 - ringFill(i)) }}
/>
```

※ 各リングの塗り済み部分だけ青くするため、CSS で未塗りトラック用の円/線をリングの下に敷くか、
`stroke` を塗り色にして未塗り側は透明にする。Task 4 で未塗りトラック(divider 色の全周円/全長線)を CSS/SVG に足す。この Task では「進むと dashoffset が減る」ことだけ通ればよい。

- [ ] **Step 4: 既存 track を廃止**

`RegisterStepperNav.tsx` から旧 `.housing-register-stepper-track` / `.housing-register-stepper-track-fill` の div と `--stepper-progress` style を削除(SVG に完全移行)。

- [ ] **Step 5: テストが通るのを確認 + 既存回帰**

Run: `rtk vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`
Expected: PASS(done/active/idle/onJump/step_desc/新 dashoffset すべて)

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/housing/register/RegisterStepperNav.tsx src/components/housing/register/__tests__/RegisterStepperNav.test.tsx
rtk git commit -m "feat(housing): ステッパーリングをprogress連動で塗る + 旧縦線track廃止"
```

---

## Task 4: CSS 仕上げ(未塗りトラック / 下端起点・反時計回り / 色 / reduced-motion)+ 実画面調整

**Files:**
- Modify: `src/styles/housing.css`

- [ ] **Step 1: 旧 track ルールを削除し、SVG リング/接続線のスタイルを追加**

`housing.css` の `.housing-register-stepper-track` と `.housing-register-stepper-track-fill`(と関連 `@media reduce`)を削除。代わりに以下を追加(トークン経由・色は `--housing-aether`)。

```css
/* SVG 進捗レイヤー: リストの丸に重ねる (絶対配置)。 */
.housing-register-stepper-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
/* 円周リング / 接続線: 塗り済み(前景) */
.housing-register-stepper-ring,
.housing-register-stepper-connector {
  fill: none;
  stroke: var(--housing-aether);
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.4s var(--housing-tour-step-spring);
}
/* 円周は下端(6時)起点・反時計回り: rotate で開始点を下へ、scale で向きを反転。
   ※ transform-box/transform-origin を circle 個別に効かせるため per-element の
   transform-origin を cx,cy に合わせる。実画面で向きを確認し、必要なら 90deg/scaleX を調整。 */
.housing-register-stepper-ring {
  transform-box: fill-box;
  transform-origin: center;
  transform: rotate(90deg) scaleX(-1);
}
@media (prefers-reduced-motion: reduce) {
  .housing-register-stepper-ring,
  .housing-register-stepper-connector {
    transition: none;
  }
}
```

- [ ] **Step 2: 未塗りトラック(下地)を SVG に追加**

塗り済みリングの下に、全周・全長の下地(divider 色)を敷いて「これから塗る道筋」を薄く見せる。`RegisterStepperNav.tsx` の SVG 内、前景リング/線の**手前**に下地の `<circle>`/`<line>`(`className` に `-track` サフィックス)を描画し、CSS を追加:

```css
.housing-register-stepper-ring-track,
.housing-register-stepper-connector-track {
  fill: none;
  stroke: var(--housing-divider);
  stroke-width: 2;
}
```

> 下地円は `transform` 不要(全周なので向き無関係)。下地線は全長。前景は Step 1 のリング/接続線。

- [ ] **Step 3: build + 全テスト**

Run: `rtk npm run build`
Expected: 成功(tsc -b 厳密で未使用 import なし。旧 `CSSProperties` import を消したか確認)

Run: `rtk vitest run src/lib/housing/__tests__/stepperProgress.test.ts src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`
Expected: PASS

- [ ] **Step 4: 実画面で目視調整(開発者画面 CSS 1489 / DPR 2.58)**

登録ページ(本番ログイン必須)で確認:
- 円周が**下端から左回り**に塗られる(向きが逆なら `.housing-register-stepper-ring` の `rotate`/`scaleX` を調整)
- 円周一周後に**接続線が上→下**に塗られ、次の円へ連続する
- 丸を貫く線が無い / 塗り色が青 / 未塗り下地が薄く見える
- done の✓、active の青枠、クリックジャンプ、説明文開閉が従来どおり
- `R`(10〜11)と `stroke-width` を実画面で微調整して円が num の縁にきれいに乗るようにする

- [ ] **Step 5: コミット**

```bash
rtk git add src/styles/housing.css src/components/housing/register/RegisterStepperNav.tsx
rtk git commit -m "style(housing): ステッパーリングの色/下端起点左回り/未塗り下地/reduced-motion"
```

---

## 完了条件

- `computeSegmentFills` の 8 テストが緑。
- `RegisterStepperNav` の既存回帰 + 新 SVG/dashoffset テストが緑。
- `rtk npm run build` 成功。
- 実画面で「下端起点・左回りの円周 → 接続線 → 次の円」の連続塗りが確認でき、丸を貫く線が無い。
- ②(復元通知)①(ヘッダー固定)と合わせて本番へ push し、登録ページで目視(本番ログイン必須)。
