# 見切れ攻撃名のホバー・マーキー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムラインで見切れている攻撃名を、行ホバー時に「一拍→流れる→一拍→戻る」を1往復するマーキーで読めるようにする(名前ホバー時は従来のツールチップ・常に排他)。

**Architecture:** `EventNameSpan` を `src/components/EventNameSpan.tsx` に切り出し、外側クリップ窓 + 内側テキストの二層 DOM にする。見切れ判定とスライド距離は純関数 `computeMarqueeMetrics` が計算し、`EventNameSpan` が既存の `ResizeObserver`(マウント/リサイズ時のみ)から呼んで `data-clipped` 属性と CSS 変数 `--marquee-distance`/`--marquee-duration` を要素に反映する。アニメーション自体は `src/index.css` の `@keyframes lopo-name-marquee` と CSS トリガー(行ホバーで実行・名前ホバーで停止・reduced-motion で静止)が担う。

**Tech Stack:** React + TypeScript / Tailwind v4(Lightning CSS)/ `src/index.css` プレーン CSS / Vitest + happy-dom / framer-motion(既存・本タスクでは不使用)。

## Global Constraints

- 仕様の正典: `docs/superpowers/specs/2026-06-25-clipped-name-hover-marquee-design.md`。
- **ホバー時に `scrollWidth`/`clientWidth` を読まない**(forced reflow 禁止・#59 の教訓)。計測は `ResizeObserver` コールバック内のみ。
- スクロールは **CSS `translateX`** のみ(`scrollLeft` 禁止)。
- **`prefers-reduced-motion: reduce` を尊重**(該当ユーザーには流さない=静止)。
- 連結語等の UI 文言ハードコード禁止だが、本タスクは**新規文言なし**(i18n 変更なし)。
- データモデル・型・他コンポーネントは変更しない。対象は `EventNameSpan` と `src/index.css` のみ。
- push 前に `npm run build`(Vercel tsc -b 厳密・未使用 import/型不足で落ちる)と `vitest run` を通す。
- マーキー定数(実装で固定): 速度 `40 px/sec` / 片道モーション割合 `0.35` / 総時間下限 `1.2s` 上限 `8s`。命名は既存 `lopo-*` 系に合わせる(既存の常時ループ型 `system-notif-marquee` とは別物)。

---

### Task 1: `computeMarqueeMetrics` 純関数

見切れ要否・移動距離(px)・所要時間(秒)を DOM 計測値から算出する純関数。DOM 非依存で単体テストする。

**Files:**
- Create: `src/utils/marquee.ts`
- Test: `src/utils/__tests__/marquee.test.ts`

**Interfaces:**
- Consumes: なし(プリミティブ引数のみ)。
- Produces:
  - `interface MarqueeMetrics { clipped: boolean; distancePx: number; durationSec: number }`
  - `interface MarqueeOptions { speedPxPerSec?: number; motionFraction?: number; minDurationSec?: number; maxDurationSec?: number }`
  - `function computeMarqueeMetrics(textWidth: number, clipWidth: number, opts?: MarqueeOptions): MarqueeMetrics`
  - `distancePx` は負数(translateX 終端値)。非クリップ時は全フィールド 0/false。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/marquee.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computeMarqueeMetrics } from '../marquee';

describe('computeMarqueeMetrics', () => {
  it('テキストがクリップ窓に収まる → clipped=false・全0', () => {
    expect(computeMarqueeMetrics(100, 200)).toEqual({ clipped: false, distancePx: 0, durationSec: 0 });
  });

  it('同幅(はみ出し0) → clipped=false', () => {
    expect(computeMarqueeMetrics(100, 100)).toEqual({ clipped: false, distancePx: 0, durationSec: 0 });
  });

  it('はみ出しあり → clipped=true・距離は負・所要時間を算出', () => {
    // overflow=100 → 100/40/0.35 = 7.142… → [1.2,8] 内 → 7.14
    expect(computeMarqueeMetrics(200, 100)).toEqual({ clipped: true, distancePx: -100, durationSec: 7.14 });
  });

  it('はみ出し大 → durationSec は上限8でクランプ', () => {
    // overflow=900 → 900/40/0.35=64.2… → 8 にクランプ
    expect(computeMarqueeMetrics(1000, 100)).toEqual({ clipped: true, distancePx: -900, durationSec: 8 });
  });

  it('はみ出し極小 → durationSec は下限1.2でクランプ', () => {
    // overflow=5 → 5/40/0.35=0.357 → 1.2 にクランプ
    expect(computeMarqueeMetrics(105, 100)).toEqual({ clipped: true, distancePx: -5, durationSec: 1.2 });
  });

  it('opts で速度・割合・上下限を上書きできる', () => {
    // overflow=100 → 100/100/0.5=2 → [0,100] 内 → 2
    expect(
      computeMarqueeMetrics(200, 100, { speedPxPerSec: 100, motionFraction: 0.5, minDurationSec: 0, maxDurationSec: 100 }),
    ).toEqual({ clipped: true, distancePx: -100, durationSec: 2 });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/marquee.test.ts`
Expected: FAIL（`computeMarqueeMetrics` が存在しない / モジュール未解決）

- [ ] **Step 3: 純関数を実装**

`src/utils/marquee.ts`:
```ts
/** ホバー・マーキー(見切れ攻撃名の横スクロール)の計測結果。 */
export interface MarqueeMetrics {
  /** 見切れているか(= マーキー対象か)。 */
  clipped: boolean;
  /** translateX の終端値(px・負数)。非クリップ時 0。 */
  distancePx: number;
  /** アニメーション総時間(秒)。非クリップ時 0。 */
  durationSec: number;
}

export interface MarqueeOptions {
  /** 読みやすいスクロール速度(px/秒)。既定 40。 */
  speedPxPerSec?: number;
  /** keyframes 上で片道スクロールに充てる時間割合(0..1)。既定 0.35。 */
  motionFraction?: number;
  /** 総時間の下限(秒)。既定 1.2。 */
  minDurationSec?: number;
  /** 総時間の上限(秒)。既定 8。 */
  maxDurationSec?: number;
}

/**
 * 内側テキスト全幅と外側クリップ窓幅から、マーキー要否・移動距離・所要時間を算出する純関数。
 * DOM 計測値(scrollWidth / clientWidth)を引数で受け取り、ホバー時ではなく
 * ResizeObserver コールバック内で1回だけ呼ぶ前提(forced reflow 回避)。
 */
export function computeMarqueeMetrics(
  textWidth: number,
  clipWidth: number,
  opts: MarqueeOptions = {},
): MarqueeMetrics {
  const {
    speedPxPerSec = 40,
    motionFraction = 0.35,
    minDurationSec = 1.2,
    maxDurationSec = 8,
  } = opts;

  const overflow = textWidth - clipWidth;
  if (overflow <= 0) {
    return { clipped: false, distancePx: 0, durationSec: 0 };
  }

  const rawDuration = overflow / speedPxPerSec / motionFraction;
  const durationSec = Math.min(maxDurationSec, Math.max(minDurationSec, rawDuration));

  return {
    clipped: true,
    distancePx: -Math.round(overflow),
    durationSec: Math.round(durationSec * 100) / 100,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/marquee.test.ts`
Expected: PASS（6件）

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/marquee.ts src/utils/__tests__/marquee.test.ts
rtk git commit -m "feat(marquee): 見切れ攻撃名マーキーの計測純関数 computeMarqueeMetrics"
```

---

### Task 2: `EventNameSpan` を専用ファイルへ切り出し + 二層 DOM 化

`EventNameSpan` を `src/components/TimelineRow.tsx` から `src/components/EventNameSpan.tsx` へ移動し、外側クリップ窓 + 内側テキストの二層に。Task 1 の純関数を `ResizeObserver` から呼んで `data-clipped` と CSS 変数を反映。CSS のフック用マーカークラス `lopo-name-clip`/`lopo-name-text` を付ける。

**Files:**
- Create: `src/components/EventNameSpan.tsx`
- Create: `src/components/__tests__/EventNameSpan.test.tsx`
- Modify: `src/components/TimelineRow.tsx`(`EventNameSpan` 定義 `:20-45` を削除し import に置換。使用箇所 `:478`/`:534` は変更なし)

**Interfaces:**
- Consumes: `computeMarqueeMetrics`, `MarqueeMetrics`(Task 1)/ `Tooltip`（`./ui/Tooltip`・既存）。
- Produces: `export const EventNameSpan: React.FC<{ name: string; className?: string }>`。
  - レンダー: `<Tooltip content={clipped ? name : ''}>` の中に `<span class="lopo-name-clip …" data-clipped style="--marquee-distance/-duration">` → `<span class="lopo-name-text …">{name}</span>`。
  - `data-clipped` は clipped 時のみ存在(非 clipped 時は属性なし)。CSS 変数も clipped 時のみ設定。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/EventNameSpan.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { EventNameSpan } from '../EventNameSpan';

// Tooltip は内部で hover state のみ。描画に影響しないので素通しモック。
vi.mock('../ui/Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

afterEach(() => cleanup());

/** ResizeObserver をモックしコールバックを捕捉。指定 DOM 寸法で再計測を発火させる。 */
function setup(name: string, textWidth: number, clipWidth: number) {
  const callbacks: ResizeObserverCallback[] = [];
  (global as any).ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) { callbacks.push(cb); }
    observe() {}
    disconnect() {}
  };
  const { container } = render(<EventNameSpan name={name} />);
  const clip = container.querySelector('.lopo-name-clip') as HTMLElement;
  const text = container.querySelector('.lopo-name-text') as HTMLElement;
  Object.defineProperty(text, 'scrollWidth', { configurable: true, value: textWidth });
  Object.defineProperty(clip, 'clientWidth', { configurable: true, value: clipWidth });
  act(() => callbacks[0]?.([], {} as ResizeObserver));
  return { clip, text };
}

describe('EventNameSpan', () => {
  it('二層構造で名前を描画する', () => {
    const { clip, text } = setup('ヴァーティカル', 50, 100);
    expect(clip).toBeTruthy();
    expect(text.textContent).toBe('ヴァーティカル');
  });

  it('見切れていない → data-clipped 無し・CSS変数無し', () => {
    const { clip } = setup('短い', 50, 100);
    expect(clip.hasAttribute('data-clipped')).toBe(false);
    expect(clip.style.getPropertyValue('--marquee-distance')).toBe('');
  });

  it('見切れている → data-clipped 付与・CSS変数(距離/時間)を設定', () => {
    const { clip } = setup('とても長い攻撃名ホリゾンタルクロス', 200, 100);
    expect(clip.hasAttribute('data-clipped')).toBe(true);
    expect(clip.style.getPropertyValue('--marquee-distance')).toBe('-100px');
    // overflow=100 → durationSec=7.14
    expect(clip.style.getPropertyValue('--marquee-duration')).toBe('7.14s');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/EventNameSpan.test.tsx`
Expected: FAIL（`../EventNameSpan` が存在しない）

- [ ] **Step 3: `EventNameSpan` を新規ファイルで実装**

`src/components/EventNameSpan.tsx`:
```tsx
import React from 'react';
import clsx from 'clsx';
import { Tooltip } from './ui/Tooltip';
import { computeMarqueeMetrics, type MarqueeMetrics } from '../utils/marquee';

/** 攻撃名スパン。
 *  - 見切れ時のみ: 行(group)ホバーで内側テキストが1往復マーキー / 名前ホバーでツールチップ(排他)。
 *  - 見切れ判定とスライド距離は ResizeObserver(マウント/リサイズ時)で計測し data-clipped + CSS 変数に反映。
 *    perf #59: onMouseEnter 毎の scrollWidth 読みは forced reflow になるため禁止。hover 時は CSS 参照のみ。 */
export const EventNameSpan: React.FC<{ name: string; className?: string }> = ({ name, className }) => {
    const clipRef = React.useRef<HTMLSpanElement>(null);
    const textRef = React.useRef<HTMLSpanElement>(null);
    const [metrics, setMetrics] = React.useState<MarqueeMetrics>({ clipped: false, distancePx: 0, durationSec: 0 });

    React.useEffect(() => {
        const clip = clipRef.current;
        const text = textRef.current;
        if (!clip || !text) return;
        const measure = () => setMetrics(computeMarqueeMetrics(text.scrollWidth, clip.clientWidth));
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(clip);
        return () => ro.disconnect();
    }, [name]);

    return (
        <Tooltip content={metrics.clipped ? name : ''} wrapperClassName="!w-auto min-w-0">
            <span
                ref={clipRef}
                data-clipped={metrics.clipped ? '' : undefined}
                className="lopo-name-clip block min-w-0 overflow-hidden"
                style={metrics.clipped ? ({
                    '--marquee-distance': `${metrics.distancePx}px`,
                    '--marquee-duration': `${metrics.durationSec}s`,
                } as React.CSSProperties) : undefined}
            >
                <span
                    ref={textRef}
                    className={clsx(className, 'lopo-name-text block truncate font-black text-app-text leading-none pt-0.5')}
                >
                    {name}
                </span>
            </span>
        </Tooltip>
    );
};
```

- [ ] **Step 4: `TimelineRow.tsx` の旧定義を import に置換**

`src/components/TimelineRow.tsx`:
- `:20-45` の `EventNameSpan` 定義ブロック(JSDoc コメント含む)を削除。
- import 群(`:15` 付近 `import { Tooltip } from './ui/Tooltip';` の近く)に追加:
```tsx
import { EventNameSpan } from './EventNameSpan';
```
- 使用箇所 `:478`/`:534` の `<EventNameSpan ... />` はそのまま(props 互換)。

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run src/components/__tests__/EventNameSpan.test.tsx`
Expected: PASS（3件）

- [ ] **Step 6: 既存 TimelineRow 周辺テストの回帰ゼロを確認**

Run: `npx vitest run src/components`
Expected: 本変更による新規 FAIL なし(既知の `HousingWorkspace.test.tsx` 1件は無関係なので除外して判断)

- [ ] **Step 7: コミット**

```bash
rtk git add src/components/EventNameSpan.tsx src/components/__tests__/EventNameSpan.test.tsx src/components/TimelineRow.tsx
rtk git commit -m "feat(marquee): EventNameSpan を専用ファイル化+二層DOM・計測を data-clipped/CSS変数に反映"
```

---

### Task 3: CSS アニメーション(keyframes + 行ホバー実行 / 名前ホバー停止 / reduced-motion 静止)

`src/index.css` に keyframes と CSS トリガーを追加して、Task 2 が出力する `data-clipped`/CSS 変数を実際の動きに変える。CSS アニメは単体テスト不可のため、検証は `npm run build` + 実機。

**Files:**
- Modify: `src/index.css`（既存 `system-notif-marquee`(`:1582` 付近)の近くに追記。別 keyframe）

**Interfaces:**
- Consumes: Task 2 が出力する `.lopo-name-clip[data-clipped]`・CSS 変数 `--marquee-distance`/`--marquee-duration`・`.lopo-name-text`、および行コンテナの既存 `group` クラス(`TimelineRow.tsx:448` 等で使用)。
- Produces: なし(視覚効果のみ)。

- [ ] **Step 1: keyframes とトリガールールを追記**

`src/index.css`（末尾付近・`system-notif-marquee` ブロックの後ろなど分かりやすい位置）:
```css
/* 見切れ攻撃名のホバー・マーキー(TimelineRow / EventNameSpan)
   - 行(group)ホバーで、見切れている攻撃名だけが1往復スクロール(ループしない)。
   - 名前そのものにホバー → 停止しツールチップに譲る(排他)。
   - 距離/時間は EventNameSpan が ResizeObserver 計測で --marquee-distance/-duration に注入。
   - prefers-reduced-motion では静止。
   既存の常時ループ型 system-notif-marquee とは別物。 */
@keyframes lopo-name-marquee {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(0); }                       /* 開始前に一拍 */
  50%  { transform: translateX(var(--marquee-distance, 0)); } /* 端まで流す */
  65%  { transform: translateX(var(--marquee-distance, 0)); } /* 端で一拍 */
  100% { transform: translateX(0); }                       /* 戻る */
}

/* 行ホバー中=見切れ名を1往復(名前ホバー以外の行領域) */
.group:hover .lopo-name-clip[data-clipped] .lopo-name-text {
  overflow: visible;
  text-overflow: clip;
  animation: lopo-name-marquee var(--marquee-duration, 4s) ease-in-out 1;
}

/* 名前そのものにホバー → マーキー停止(ツールチップに譲る)。
   行ホバー実行ルールより高い詳細度で上書き。 */
.group:hover .lopo-name-clip[data-clipped]:hover .lopo-name-text {
  animation: none;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .lopo-name-text {
    animation: none !important;
  }
}
```

- [ ] **Step 2: ビルドが通ることを確認(Lightning CSS で keyframes/var が落ちない)**

Run: `npm run build`
Expected: 成功。`dist` の CSS に `lopo-name-marquee` が残っていること(Lightning CSS が未使用判定で消さないか確認)。
確認: `rtk grep "lopo-name-marquee" dist/assets/*.css`（ヒットすれば OK）

- [ ] **Step 3: 実機確認(ユーザー)**

`npm run dev` → タイムラインで:
1. 長い攻撃名の行をなぞる(名前以外の行領域)→ 一拍→流れる→一拍→戻る が1回で停止。
2. 攻撃名そのものにホバー → 流れが止まり吹き出しで全文表示(排他)。
3. 見切れていない短い名前 → 何も起きない。
4. OS の「視差効果を減らす/アニメーション減」を ON → 流れず静止、名前ホバーの吹き出しのみ。
5. 1イベント行 / 2イベント行 両方で確認。DPR 2.58(本人画面)と一般 1920 の両方を意識。
6. 縦位置ズレ(二層化による pt-0.5/leading-none の崩れ)が無いか目視。

- [ ] **Step 4: コミット**

```bash
rtk git add src/index.css
rtk git commit -m "feat(marquee): 見切れ攻撃名の行ホバー・マーキー CSS(1往復/排他/reduced-motion)"
```

---

## Self-Review

**Spec coverage:**
- §3.1 二層 DOM → Task 2。 §3.2 ResizeObserver 計測+data-clipped+CSS変数(ホバー時非計測)→ Task 1(計算)+Task 2(配線)。 §3.3 keyframes/1往復/排他/reduced-motion → Task 3。 §3.4 ツールチップ維持 → Task 2(`content={clipped?name:''}`)。 §6 テスト計画 → Task 1/2 のユニット+Task 3 の build/実機。全カバー。

**Placeholder scan:** TBD/TODO/「適切に」なし。各コード step は実コードを記載。OK。

**Type consistency:** `MarqueeMetrics`{clipped,distancePx,durationSec} を Task 1 で定義 → Task 2 が同名で消費。`computeMarqueeMetrics(textWidth, clipWidth, opts?)` のシグネチャ一致。`.lopo-name-clip`/`.lopo-name-text`/`data-clipped`/`--marquee-distance`/`--marquee-duration` を Task 2 出力 ↔ Task 3 消費で一致。`EventNameSpan` props `{name, className?}` は既存使用箇所(`:478`/`:534`)と互換。OK。

**注記:** CSS の詳細度前提 — 「行ホバー実行」(`.group:hover .lopo-name-clip[data-clipped] .lopo-name-text` = 0,5,0)より「名前ホバー停止」(`…[data-clipped]:hover…` = 0,6,0)が高く、名前ホバー時は停止が勝つ(A案=排他)。Tailwind の `truncate`/`block` は単一クラス(0,1,0)で、index.css のプレーン CSS が上書きする(既存 `system-notif-marquee` と同様レイヤ外)。
