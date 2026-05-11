# スムーズスクロール導入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC 環境で LP / 全ページの縦スクロール + Timeline / Sidebar 縦スクロールをスムーズ化する。 booklage で実機検証済の Lenis (document mode) + 自前スプリング (scoped) 戦略を移植。

**Architecture:** `src/lib/scroll/` に 3 ファイル新設。 純粋関数 (`smoothScrollLogic.ts`) を切り出して個別 vitest、 Hook (`useSmoothScroll.ts` / `useSmoothWheelScroll.ts`) は純粋関数を組み合わせて DOM に配線。 配線箇所は `App.tsx` (Lenis) と `Timeline.tsx` / `Sidebar.tsx` (自前スプリング) の 3 ファイルのみ。 スマホ / reduce-motion / 横スクロール / ボトムシートは触らない。

**Tech Stack:** lenis ^1.3.21, React 18, Vite, vitest (node 環境 + pool: vmThreads, happy-dom 切替対応)

**設計書:** [docs/superpowers/specs/2026-05-11-smooth-scroll-design.md](../specs/2026-05-11-smooth-scroll-design.md)

---

## File Structure

新規:
- `src/lib/scroll/smoothScrollLogic.ts` — 純粋関数 3 つ (`isSmoothScrollSupported`, `isAtScrollBoundary`, `springStep`)
- `src/lib/scroll/useSmoothScroll.ts` — Lenis 起動 hook (~40 行)
- `src/lib/scroll/useSmoothWheelScroll.ts` — 自前スプリング hook (~130 行)
- `src/lib/scroll/__tests__/smoothScrollLogic.test.ts` — 純粋関数 vitest (14 件)
- `src/lib/scroll/__tests__/useSmoothScroll.test.tsx` — Lenis hook 統合 vitest (2 件、 happy-dom)
- `src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx` — 自前スプリング hook 統合 vitest (3 件、 happy-dom)

修正:
- `package.json` — `lenis` を `dependencies` に追加
- `src/App.tsx` — `useSmoothScroll()` を 1 行呼ぶ
- `src/components/Timeline.tsx` — `useSmoothWheelScroll(scrollContainerRef)` を 1 行追加
- `src/components/Sidebar.tsx` — 4 か所の `flex-1 overflow-y-auto` div それぞれに `useRef` + hook 適用

触らない: ボトムシート全般、 共有プレビュー、 既存スクロールロジック、 `usePlanStore`, `planService`, `silentCompressStale`, `checkPlanLimit`, `MitigationSheet`, `ShareImportSheet`, `LimitResolutionSheet`, `LocalImportDialog`, `useShareImportFlow`。

---

## Task 1: 環境準備 (lenis 依存追加 + ディレクトリ作成)

**Files:**
- Modify: `package.json` (dependencies に `lenis` 追加)
- Create: `src/lib/scroll/` ディレクトリ
- Create: `src/lib/scroll/__tests__/` ディレクトリ

- [ ] **Step 1: lenis をインストール**

```bash
npm install lenis@^1.3.21
```

Expected: `package.json` の dependencies に `"lenis": "^1.3.21"` が追加され、 `package-lock.json` 更新。

- [ ] **Step 2: ディレクトリ作成 (mkdir のみ、 空ファイルは置かない)**

```bash
mkdir -p src/lib/scroll/__tests__
```

- [ ] **Step 3: lenis の型解決確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ (lenis 自体は使っていないので影響なし、 型解決だけ確認)

- [ ] **Step 4: Commit**

```bash
rtk git add package.json package-lock.json
rtk git commit -m "chore(deps): lenis ^1.3.21 追加 (スムーズスクロール導入)"
```

---

## Task 2: `isSmoothScrollSupported` 純粋関数 (TDD, 5 件)

**Files:**
- Create: `src/lib/scroll/__tests__/smoothScrollLogic.test.ts`
- Create: `src/lib/scroll/smoothScrollLogic.ts`

- [ ] **Step 1: 最初の failing test を書く (PC 環境 → true)**

`src/lib/scroll/__tests__/smoothScrollLogic.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import { isSmoothScrollSupported } from '../smoothScrollLogic';

function makeWindow(opts: { hoverHover: boolean; pointerFine: boolean; reduceMotion: boolean; matchMediaUndefined?: boolean }): Window {
    const matchMedia = (query: string): MediaQueryList => {
        let matches = false;
        if (query === '(prefers-reduced-motion: reduce)') matches = opts.reduceMotion;
        else if (query === '(hover: hover) and (pointer: fine)') matches = opts.hoverHover && opts.pointerFine;
        return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    };
    const win: Partial<Window> = {};
    if (!opts.matchMediaUndefined) win.matchMedia = matchMedia;
    return win as Window;
}

describe('isSmoothScrollSupported', () => {
    it('PC (hover + pointer fine + 非 reduce-motion) なら true', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: false });
        expect(isSmoothScrollSupported(win)).toBe(true);
    });
});
```

- [ ] **Step 2: テストが「未定義 import」 で FAIL することを確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: FAIL — `Cannot find module '../smoothScrollLogic'` 系のエラー

- [ ] **Step 3: 最小実装を書く**

`src/lib/scroll/smoothScrollLogic.ts` を新規作成:

```ts
export function isSmoothScrollSupported(win: Window): boolean {
    if (typeof win.matchMedia !== 'function') return false;
    if (win.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    if (!win.matchMedia('(hover: hover) and (pointer: fine)').matches) return false;
    return true;
}
```

- [ ] **Step 4: テストが PASS することを確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: PASS (1/1)

- [ ] **Step 5: 残り 4 件のテストを追加**

`src/lib/scroll/__tests__/smoothScrollLogic.test.ts` の `describe('isSmoothScrollSupported', ...)` 内に追加:

```ts
    it('タッチ専用 (hover: none) なら false', () => {
        const win = makeWindow({ hoverHover: false, pointerFine: false, reduceMotion: false });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });

    it('reduce-motion ON なら false (PC でも)', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: true });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });

    it('matchMedia 未対応環境 (SSR / 古い browser) なら false', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: false, matchMediaUndefined: true });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });

    it('PC かつ reduce-motion 両方 ON の場合は reduce-motion 優先で false', () => {
        const win = makeWindow({ hoverHover: true, pointerFine: true, reduceMotion: true });
        expect(isSmoothScrollSupported(win)).toBe(false);
    });
```

- [ ] **Step 6: 全 5 件 PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: PASS (5/5)

- [ ] **Step 7: Commit**

```bash
rtk git add src/lib/scroll/smoothScrollLogic.ts src/lib/scroll/__tests__/smoothScrollLogic.test.ts
rtk git commit -m "feat(scroll): isSmoothScrollSupported 純粋関数 + vitest 5 件"
```

---

## Task 3: `isAtScrollBoundary` 純粋関数 (TDD, 5 件)

**Files:**
- Modify: `src/lib/scroll/__tests__/smoothScrollLogic.test.ts` (describe 追加)
- Modify: `src/lib/scroll/smoothScrollLogic.ts` (関数追加)

- [ ] **Step 1: 最初の failing test を書く (top で上向き → 'top')**

`src/lib/scroll/__tests__/smoothScrollLogic.test.ts` の末尾に追加:

```ts
import { isAtScrollBoundary } from '../smoothScrollLogic';

describe('isAtScrollBoundary', () => {
    it('top で上方向 (deltaY < 0) なら "top"', () => {
        // scrollTop=0, scrollHeight=1000, clientHeight=500, deltaY=-50
        expect(isAtScrollBoundary(0, 1000, 500, -50)).toBe('top');
    });
});
```

注意: 既存の `import { isSmoothScrollSupported } from '../smoothScrollLogic';` 行を `import { isSmoothScrollSupported, isAtScrollBoundary } from '../smoothScrollLogic';` にマージしても OK (同じファイル内なので一本化推奨)。

- [ ] **Step 2: テストが FAIL することを確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: FAIL — `isAtScrollBoundary is not a function` 系

- [ ] **Step 3: 最小実装を書く**

`src/lib/scroll/smoothScrollLogic.ts` の末尾に追加:

```ts
export type ScrollBoundary = 'top' | 'bottom' | null;

export function isAtScrollBoundary(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
    deltaY: number,
): ScrollBoundary {
    const max = scrollHeight - clientHeight;
    if (max <= 0) return null;
    if (scrollTop <= 0 && deltaY < 0) return 'top';
    if (scrollTop >= max - 1 && deltaY > 0) return 'bottom';
    return null;
}
```

- [ ] **Step 4: テスト PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: PASS (6/6 全体)

- [ ] **Step 5: 残り 4 件のテストを追加**

`describe('isAtScrollBoundary', ...)` 内に追加:

```ts
    it('bottom で下方向 (deltaY > 0) なら "bottom"', () => {
        // scrollTop=500 (=max), scrollHeight=1000, clientHeight=500, deltaY=50
        expect(isAtScrollBoundary(500, 1000, 500, 50)).toBe('bottom');
    });

    it('中間 (境界以外) なら null', () => {
        expect(isAtScrollBoundary(200, 1000, 500, 50)).toBeNull();
        expect(isAtScrollBoundary(200, 1000, 500, -50)).toBeNull();
    });

    it('スクロール不能 (max <= 0) なら null', () => {
        // content が viewport より小さい
        expect(isAtScrollBoundary(0, 400, 500, 50)).toBeNull();
        expect(isAtScrollBoundary(0, 400, 500, -50)).toBeNull();
    });

    it('top でも下方向なら null (境界だが反対方向)', () => {
        // scrollTop=0 でも deltaY>0 (下にスクロールしようとしている) → 境界扱いしない
        expect(isAtScrollBoundary(0, 1000, 500, 50)).toBeNull();
        // 同じく bottom で上方向
        expect(isAtScrollBoundary(500, 1000, 500, -50)).toBeNull();
    });
```

- [ ] **Step 6: 全件 PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: PASS (10/10 全体)

- [ ] **Step 7: Commit**

```bash
rtk git add src/lib/scroll/smoothScrollLogic.ts src/lib/scroll/__tests__/smoothScrollLogic.test.ts
rtk git commit -m "feat(scroll): isAtScrollBoundary 純粋関数 + vitest 5 件"
```

---

## Task 4: `springStep` 純粋関数 (TDD, 4 件)

**Files:**
- Modify: `src/lib/scroll/__tests__/smoothScrollLogic.test.ts`
- Modify: `src/lib/scroll/smoothScrollLogic.ts`

- [ ] **Step 1: 最初の failing test を書く (通常更新)**

`src/lib/scroll/__tests__/smoothScrollLogic.test.ts` の末尾に追加:

```ts
import { springStep } from '../smoothScrollLogic';

describe('springStep', () => {
    it('通常: targetDy > 0 のとき velY と stepY が正方向に更新される', () => {
        const result = springStep({ targetDy: 100, velY: 0 }, 1 / 60, 200, 2 * Math.sqrt(200), 0.05);
        expect(result.atRest).toBe(false);
        expect(result.state.velY).toBeGreaterThan(0);
        expect(result.stepY).toBeGreaterThan(0);
        // targetDy は stepY 分だけ減る
        expect(result.state.targetDy).toBeLessThan(100);
    });
});
```

(冒頭の import 行を `import { isSmoothScrollSupported, isAtScrollBoundary, springStep } from '../smoothScrollLogic';` 1 本に統合してもよい)

- [ ] **Step 2: FAIL 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: FAIL — `springStep is not a function`

- [ ] **Step 3: 最小実装**

`src/lib/scroll/smoothScrollLogic.ts` の末尾に追加:

```ts
export interface SpringState {
    targetDy: number;
    velY: number;
}

export interface SpringStepResult {
    state: SpringState;
    stepY: number;
    atRest: boolean;
}

export function springStep(
    state: SpringState,
    dt: number,
    stiffness: number,
    damping: number,
    maxDt: number,
): SpringStepResult {
    if (state.targetDy === 0 && state.velY === 0) {
        return { state: { targetDy: 0, velY: 0 }, stepY: 0, atRest: true };
    }
    const dtClamped = Math.min(maxDt, dt);
    const a = stiffness * state.targetDy - damping * state.velY;
    const velY = state.velY + a * dtClamped;
    const stepY = velY * dtClamped;
    const targetDy = state.targetDy - stepY;
    const atRest = Math.abs(targetDy) < 0.05 && Math.abs(velY) < 0.5;
    if (atRest) {
        return { state: { targetDy: 0, velY: 0 }, stepY, atRest: true };
    }
    return { state: { targetDy, velY }, stepY, atRest: false };
}
```

- [ ] **Step 4: PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: PASS (11/11)

- [ ] **Step 5: 残り 3 件のテストを追加**

```ts
    it('静止状態: targetDy=0 && velY=0 なら atRest=true で何もしない', () => {
        const result = springStep({ targetDy: 0, velY: 0 }, 1 / 60, 200, 2 * Math.sqrt(200), 0.05);
        expect(result.atRest).toBe(true);
        expect(result.stepY).toBe(0);
        expect(result.state).toEqual({ targetDy: 0, velY: 0 });
    });

    it('dt clamp: dt > maxDt の場合は maxDt に丸める (スパイク防止)', () => {
        const stiff = 200;
        const damp = 2 * Math.sqrt(stiff);
        const big = springStep({ targetDy: 100, velY: 0 }, 1.0, stiff, damp, 0.05);  // dt=1.0
        const max = springStep({ targetDy: 100, velY: 0 }, 0.05, stiff, damp, 0.05);  // dt=maxDt
        // dt が同じ値に丸められるので velY も stepY も同一
        expect(big.state.velY).toBe(max.state.velY);
        expect(big.stepY).toBe(max.stepY);
    });

    it('静止判定: targetDy が 0.05 未満かつ velY が 0.5 未満で atRest=true、 state は完全に 0 にリセット', () => {
        const result = springStep({ targetDy: 0.01, velY: 0.1 }, 1 / 60, 200, 2 * Math.sqrt(200), 0.05);
        expect(result.atRest).toBe(true);
        expect(result.state).toEqual({ targetDy: 0, velY: 0 });
    });
```

- [ ] **Step 6: 全 14 件 PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/smoothScrollLogic.test.ts
```

Expected: PASS (14/14)

- [ ] **Step 7: Commit**

```bash
rtk git add src/lib/scroll/smoothScrollLogic.ts src/lib/scroll/__tests__/smoothScrollLogic.test.ts
rtk git commit -m "feat(scroll): springStep 純粋関数 + vitest 4 件 (純粋関数 14 件完了)"
```

---

## Task 5: `useSmoothScroll` hook + 統合テスト (2 件)

**Files:**
- Create: `src/lib/scroll/useSmoothScroll.ts`
- Create: `src/lib/scroll/__tests__/useSmoothScroll.test.tsx`

- [ ] **Step 1: hook 統合テストを書く (reduce-motion で Lenis 未生成)**

`src/lib/scroll/__tests__/useSmoothScroll.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSmoothScroll } from '../useSmoothScroll';

// Lenis をモック化して呼ばれた回数 / destroy 呼び出しを観測
const lenisCtor = vi.fn();
const lenisDestroy = vi.fn();
vi.mock('lenis', () => {
    return {
        default: vi.fn().mockImplementation((opts: unknown) => {
            lenisCtor(opts);
            return {
                raf: vi.fn(),
                destroy: lenisDestroy,
            };
        }),
    };
});

function setMatchMedia(opts: { hover: boolean; pointer: boolean; reduce: boolean }): void {
    window.matchMedia = ((query: string) => {
        let matches = false;
        if (query === '(prefers-reduced-motion: reduce)') matches = opts.reduce;
        else if (query === '(hover: hover) and (pointer: fine)') matches = opts.hover && opts.pointer;
        return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    }) as Window['matchMedia'];
}

beforeEach(() => {
    lenisCtor.mockClear();
    lenisDestroy.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useSmoothScroll', () => {
    it('reduce-motion ON のときは Lenis インスタンスを作らない', () => {
        setMatchMedia({ hover: true, pointer: true, reduce: true });
        renderHook(() => useSmoothScroll());
        expect(lenisCtor).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: FAIL 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/useSmoothScroll.test.tsx
```

Expected: FAIL — `Cannot find module '../useSmoothScroll'`

- [ ] **Step 3: hook を実装**

`src/lib/scroll/useSmoothScroll.ts` を新規作成:

```ts
import { useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { isSmoothScrollSupported } from './smoothScrollLogic';

const EASE_OUT_EXPO = (t: number): number => Math.min(1, 1.001 - Math.pow(2, -10 * t));

/**
 * Lenis をページ全体 (document) に適用するスムーズスクロール hook。
 * PC + 非 reduce-motion 環境のみ起動。 触り心地は booklage と同じ。
 */
export function useSmoothScroll(): React.RefObject<Lenis | null> {
    const lenisRef = useRef<Lenis | null>(null);

    useEffect(() => {
        if (!isSmoothScrollSupported(window)) return;

        const lenis = new Lenis({
            duration: 1.2,
            easing: EASE_OUT_EXPO,
            touchMultiplier: 2,
        });
        lenisRef.current = lenis;

        let rafId = 0;
        const raf = (time: number): void => {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);

        return () => {
            cancelAnimationFrame(rafId);
            lenis.destroy();
            lenisRef.current = null;
        };
    }, []);

    return lenisRef;
}
```

- [ ] **Step 4: PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/useSmoothScroll.test.tsx
```

Expected: PASS (1/1)

- [ ] **Step 5: 2 件目のテストを追加 (通常時 cleanup で destroy 呼ばれる)**

```tsx
    it('PC + 非 reduce-motion で Lenis 生成 + unmount で destroy 呼ばれる', () => {
        setMatchMedia({ hover: true, pointer: true, reduce: false });
        const { unmount } = renderHook(() => useSmoothScroll());
        expect(lenisCtor).toHaveBeenCalledOnce();
        expect(lenisDestroy).not.toHaveBeenCalled();
        unmount();
        expect(lenisDestroy).toHaveBeenCalledOnce();
    });
```

- [ ] **Step 6: PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/useSmoothScroll.test.tsx
```

Expected: PASS (2/2)

- [ ] **Step 7: tsc 確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ

- [ ] **Step 8: Commit**

```bash
rtk git add src/lib/scroll/useSmoothScroll.ts src/lib/scroll/__tests__/useSmoothScroll.test.tsx
rtk git commit -m "feat(scroll): useSmoothScroll hook + 統合テスト 2 件 (Lenis document mode)"
```

---

## Task 6: `useSmoothWheelScroll` hook + 統合テスト (3 件)

**Files:**
- Create: `src/lib/scroll/useSmoothWheelScroll.ts`
- Create: `src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx`

- [ ] **Step 1: hook 統合テスト 1 件目を書く (境界で preventDefault 呼ばない)**

`src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useSmoothWheelScroll } from '../useSmoothWheelScroll';

function setMatchMediaPc(): void {
    window.matchMedia = ((query: string) => {
        let matches = false;
        if (query === '(hover: hover) and (pointer: fine)') matches = true;
        return { matches, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    }) as Window['matchMedia'];
}

function makeScrollableEl(scrollHeight: number, clientHeight: number, initialScrollTop = 0): HTMLDivElement {
    const el = document.createElement('div');
    document.body.appendChild(el);
    Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
    el.scrollTop = initialScrollTop;
    return el;
}

beforeEach(() => {
    setMatchMediaPc();
    document.body.innerHTML = '';
});

describe('useSmoothWheelScroll', () => {
    it('境界 (scrollTop=0 で上方向) では preventDefault を呼ばない (親に伝播させる)', () => {
        const el = makeScrollableEl(1000, 500, 0);
        const refObj = { current: el };
        renderHook(() => useSmoothWheelScroll(refObj as React.RefObject<HTMLElement | null>));

        const event = new WheelEvent('wheel', { deltaY: -50, bubbles: true, cancelable: true });
        const preventSpy = (event.preventDefault = (() => { (event as unknown as { _prevented: boolean })._prevented = true; }) as () => void);
        el.dispatchEvent(event);
        expect((event as unknown as { _prevented?: boolean })._prevented).not.toBe(true);
    });
});
```

- [ ] **Step 2: FAIL 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx
```

Expected: FAIL — `Cannot find module '../useSmoothWheelScroll'`

- [ ] **Step 3: hook を実装**

`src/lib/scroll/useSmoothWheelScroll.ts` を新規作成:

```ts
import { useEffect, useRef, type RefObject } from 'react';
import { isAtScrollBoundary, isSmoothScrollSupported, springStep } from './smoothScrollLogic';

type Options = {
    readonly stiffness?: number;
    readonly disabled?: boolean;
};

const MAX_DT = 0.05;
const EXTERNAL_SCROLL_DIFF_THRESHOLD = 10;

/**
 * 特定要素のホイール縦スクロールを critical-damped spring で補間する hook。
 * 横スクロール (deltaX) と境界 (top/bottom で対応方向) ではネイティブに任せる。
 * 外部から scrollTop が大幅変動 (>10px) したら内部 state をリセット → JS scrollTo/scrollIntoView との干渉防止。
 */
export function useSmoothWheelScroll(
    ref: RefObject<HTMLElement | null>,
    options: Options = {},
): void {
    const { stiffness = 200, disabled = false } = options;
    const stateRef = useRef<{ targetDy: number; velY: number; lastTime: number }>({ targetDy: 0, velY: 0, lastTime: 0 });
    const rafRef = useRef<number | null>(null);
    const lastAppliedScrollTopRef = useRef<number>(0);

    useEffect(() => {
        if (disabled) return;
        if (!isSmoothScrollSupported(window)) return;
        const el = ref.current;
        if (!el) return;

        const damping = 2 * Math.sqrt(stiffness);
        lastAppliedScrollTopRef.current = el.scrollTop;

        const step = (now: number): void => {
            const s = stateRef.current;
            const dt = s.lastTime === 0 ? 1 / 60 : (now - s.lastTime) / 1000;
            s.lastTime = now;

            const result = springStep({ targetDy: s.targetDy, velY: s.velY }, dt, stiffness, damping, MAX_DT);
            s.targetDy = result.state.targetDy;
            s.velY = result.state.velY;

            if (result.atRest) {
                s.lastTime = 0;
                rafRef.current = null;
                return;
            }

            const max = el.scrollHeight - el.clientHeight;
            const next = el.scrollTop + result.stepY;
            if (next <= 0) {
                el.scrollTop = 0;
                lastAppliedScrollTopRef.current = 0;
                s.targetDy = 0; s.velY = 0; s.lastTime = 0;
                rafRef.current = null;
                return;
            }
            if (next >= max) {
                el.scrollTop = max;
                lastAppliedScrollTopRef.current = max;
                s.targetDy = 0; s.velY = 0; s.lastTime = 0;
                rafRef.current = null;
                return;
            }
            el.scrollTop = next;
            lastAppliedScrollTopRef.current = next;

            rafRef.current = requestAnimationFrame(step);
        };

        const onWheel = (e: WheelEvent): void => {
            let dy = e.deltaY;
            if (e.deltaMode === 1) dy *= 16;
            else if (e.deltaMode === 2) dy *= window.innerHeight;
            if (dy === 0) return;

            const boundary = isAtScrollBoundary(el.scrollTop, el.scrollHeight, el.clientHeight, dy);
            if (boundary !== null) return;

            e.preventDefault();
            stateRef.current.targetDy += dy;

            if (rafRef.current === null) {
                rafRef.current = requestAnimationFrame(step);
            }
        };

        const onScroll = (): void => {
            const current = el.scrollTop;
            if (Math.abs(current - lastAppliedScrollTopRef.current) > EXTERNAL_SCROLL_DIFF_THRESHOLD) {
                stateRef.current.targetDy = 0;
                stateRef.current.velY = 0;
                stateRef.current.lastTime = 0;
                if (rafRef.current !== null) {
                    cancelAnimationFrame(rafRef.current);
                    rafRef.current = null;
                }
            }
            lastAppliedScrollTopRef.current = current;
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        el.addEventListener('scroll', onScroll, { passive: true });

        return (): void => {
            el.removeEventListener('wheel', onWheel);
            el.removeEventListener('scroll', onScroll);
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            stateRef.current.targetDy = 0;
            stateRef.current.velY = 0;
            stateRef.current.lastTime = 0;
        };
    }, [ref, stiffness, disabled]);
}
```

- [ ] **Step 4: PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx
```

Expected: PASS (1/1)

- [ ] **Step 5: 2 件目のテスト追加 (wheel で scrollTop が更新)**

```tsx
    it('中間位置で wheel → preventDefault が呼ばれて scrollTop が変化する (raf 1 フレーム後)', async () => {
        const el = makeScrollableEl(1000, 500, 200);
        const refObj = { current: el };
        renderHook(() => useSmoothWheelScroll(refObj as React.RefObject<HTMLElement | null>));

        const event = new WheelEvent('wheel', { deltaY: 50, bubbles: true, cancelable: true });
        el.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        // raf 駆動なので 1 フレーム進める
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        expect(el.scrollTop).toBeGreaterThan(200);  // 下方向に進んだ
    });
```

- [ ] **Step 6: 3 件目のテスト追加 (外部 scrollTop 急変で state リセット)**

```tsx
    it('外部 scrollTop 急変 (>10px) で内部 state がリセットされる', async () => {
        const el = makeScrollableEl(1000, 500, 200);
        const refObj = { current: el };
        renderHook(() => useSmoothWheelScroll(refObj as React.RefObject<HTMLElement | null>));

        // wheel で spring を起動
        el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));

        // 外部から大きく scrollTop を書き換える (scrollIntoView 等を想定)
        const before = el.scrollTop;
        el.scrollTop = 600;  // 大きくジャンプ
        el.dispatchEvent(new Event('scroll'));

        // state リセットされたので、 raf が止まる → scrollTop はそれ以上動かない
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
        expect(el.scrollTop).toBe(600);  // 外部設定値から動かない (前の spring の慣性が消えた)
        expect(before).not.toBe(600);  // sanity: before は 600 でなかった
    });
```

- [ ] **Step 7: PASS 確認**

```bash
rtk npx vitest run src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx
```

Expected: PASS (3/3)

- [ ] **Step 8: tsc 確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ

- [ ] **Step 9: Commit**

```bash
rtk git add src/lib/scroll/useSmoothWheelScroll.ts src/lib/scroll/__tests__/useSmoothWheelScroll.test.tsx
rtk git commit -m "feat(scroll): useSmoothWheelScroll hook + 統合テスト 3 件 (自前スプリング + 外部 scrollTop 検知)"
```

---

## Task 7: `App.tsx` に `useSmoothScroll()` 配線

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 既存の App.tsx を読んで配線位置を確認**

```bash
rtk read src/App.tsx
```

参考: 既に `useEffect` などで初期化処理が書かれている。 `useSmoothScroll()` は他の hook と並べて呼ぶ。

- [ ] **Step 2: import 追加 + hook 呼び出し追加**

`src/App.tsx` の import セクションに追加:

```ts
import { useSmoothScroll } from './lib/scroll/useSmoothScroll';
```

`function App()` の冒頭 (`useMasterDataInit();` の直後あたり) に追加:

```ts
    useSmoothScroll();
```

最終的にこんな感じ (該当部分):

```ts
function App() {
    const theme = useThemeStore((state) => state.theme);
    const { i18n } = useTranslation();
    useMasterDataInit();
    useSmoothScroll();
    // ... 以下既存のまま
```

- [ ] **Step 3: tsc 確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ

- [ ] **Step 4: 既存 vitest 全件 PASS 確認**

```bash
rtk npx vitest run
```

Expected: 既存 589 + 新規 19 = 608 件 PASS

- [ ] **Step 5: 開発サーバーで動作確認 (ブラウザ手動確認、 commit 前)**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/` を開き、 PC のホイールでスクロール → スルッと滑らかに動くことを確認。 OK なら dev server を Ctrl+C で停止。

Expected: LP, /miti, /support 等で縦スクロールが Lenis 経由になる。 ガタつきが消える。 スマホエミュレーション (DevTools) では従来通り。

- [ ] **Step 6: Commit**

```bash
rtk git add src/App.tsx
rtk git commit -m "feat(App): Lenis (document mode) で全ページの縦スクロールをスムーズ化"
```

---

## Task 8: `Timeline.tsx` に `useSmoothWheelScroll` 配線

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: scrollContainerRef 定義位置を確認**

`src/components/Timeline.tsx` 行 973 付近:

```ts
const scrollContainerRef = useRef<HTMLDivElement>(null);
```

の直後に hook を追加する。

- [ ] **Step 2: import 追加 + hook 呼び出し追加**

`src/components/Timeline.tsx` の既存 import 群 (ファイル先頭) に追加:

```ts
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
```

`scrollContainerRef` 定義の直後に追加:

```ts
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(scrollContainerRef);
```

- [ ] **Step 3: tsc 確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ

- [ ] **Step 4: 既存 vitest 全件 PASS 確認**

```bash
rtk npx vitest run
```

Expected: 608 件 PASS

- [ ] **Step 5: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/miti` を開き:
- Timeline の縦スクロール (ホイール) → スルッと滑らか
- Timeline の横スクロール (トラックパッドの左右スワイプ or shift+wheel) → ネイティブ動作維持 (ガタつくが今回スコープ外)
- イベントモーダル開閉 / イベント中心スクロール (再生時の自動追従) → 既存挙動互換

OK なら dev server 停止。

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(Timeline): 自前スプリングで縦スクロールをスムーズ化 (横はネイティブ維持)"
```

---

## Task 9: `Sidebar.tsx` の 4 か所の `overflow-y-auto` div に ref + hook 配線

**Files:**
- Modify: `src/components/Sidebar.tsx`

Sidebar には 4 つの `<div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">` がある (タブ別、 表示は同時に 1 つだけ):
- [Sidebar.tsx:1284](src/components/Sidebar.tsx#L1284)
- [Sidebar.tsx:1335](src/components/Sidebar.tsx#L1335)
- [Sidebar.tsx:1365](src/components/Sidebar.tsx#L1365)
- [Sidebar.tsx:1417](src/components/Sidebar.tsx#L1417)

各 div に個別 ref を当てて hook 適用。 表示中の 1 つだけ wheel listener が実際に動く (他の 3 つは ref が null で hook 内 useEffect は早期 return)。

- [ ] **Step 1: import 追加**

`src/components/Sidebar.tsx` の既存 import 群に追加:

```ts
import { useSmoothWheelScroll } from '../lib/scroll/useSmoothWheelScroll';
```

- [ ] **Step 2: 4 つの ref を関数コンポーネント先頭で宣言**

Sidebar 関数コンポーネント (`export function Sidebar(...) {` の直後の hook 群) に追加:

```ts
    const savageListRef = useRef<HTMLDivElement>(null);
    const ultimateListRef = useRef<HTMLDivElement>(null);
    const otherListRef = useRef<HTMLDivElement>(null);
    const sharedListRef = useRef<HTMLDivElement>(null);
    useSmoothWheelScroll(savageListRef);
    useSmoothWheelScroll(ultimateListRef);
    useSmoothWheelScroll(otherListRef);
    useSmoothWheelScroll(sharedListRef);
```

注意:
- `useRef` は既に他箇所で使われているので import は不要なはず (要確認、 既存に `useRef` が import されていなければ追加)。
- 4 つのうちどの ref がどの div に当たるかは、 行番号順で「カテゴリ別タブ」 と推測される。 実装時は各 div の文脈 (周囲のコード) を見て、 適切な名前を割り当てる。 上記の `savage / ultimate / other / shared` は仮命名で、 実コードのタブカテゴリに合わせて修正する。

- [ ] **Step 3: 4 つの div にそれぞれ ref を付与**

各行を以下のように変更:

```diff
- <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
+ <div ref={savageListRef} className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 custom-scrollbar">
```

(行ごとに `savageListRef` → `ultimateListRef` → `otherListRef` → `sharedListRef` の順で適用)

- [ ] **Step 4: tsc 確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ

- [ ] **Step 5: 既存 vitest 全件 PASS 確認**

```bash
rtk npx vitest run
```

Expected: 608 件 PASS

- [ ] **Step 6: 開発サーバーで動作確認**

```bash
npm run dev
```

ブラウザで `http://localhost:5173/miti` を開き:
- サイドバーのコンテンツリスト (どのタブでも) を縦スクロール → スルッと滑らか
- タブ切替 (絶 / 高難易度 / 異聞 等) → 切替後も同じく滑らか
- 新規プラン作成後の「該当コンテンツへ自動スクロール」 (Sidebar.tsx:1630 の scrollIntoView) → 動作維持

OK なら dev server 停止。

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/Sidebar.tsx
rtk git commit -m "feat(Sidebar): 4 つのコンテンツリストに自前スプリングを配線"
```

---

## Task 10: 全体検証 + push + デプロイ

**Files:** なし (検証のみ)

- [ ] **Step 1: vitest 全件 PASS 確認**

```bash
rtk npx vitest run
```

Expected: 608 件 PASS (既存 589 + 新規 19)

- [ ] **Step 2: tsc 全体確認**

```bash
rtk npx tsc --noEmit
```

Expected: エラーゼロ

- [ ] **Step 3: vite build 成功確認**

```bash
rtk npm run build
```

Expected: build success、 バンドルサイズ増加 4KB 程度

- [ ] **Step 4: 触らない範囲の diff = 0 確認**

```bash
rtk git diff origin/main -- src/store/usePlanStore.ts src/lib/planService.ts src/utils/silentCompressStale.ts src/utils/checkPlanLimit.ts src/lib/buildShareImportItems.ts src/components/MitigationSheet.tsx src/components/LocalImportDialog.tsx src/components/ShareImportSheet.tsx src/components/LimitResolutionSheet.tsx src/store/useShareImportFlow.ts
```

Expected: 出力ゼロ (これらのファイルは 0 行 diff)

- [ ] **Step 5: 最終 dev サーバー総合確認**

```bash
npm run dev
```

実機検証チェックリスト (設計書 4.5 と同じ):

1. LP をホイールでスクロール → スルッと減速
2. /miti でサイドバーをホイール → 同上
3. /miti で Timeline をホイール → 同上 (縦のみ)
4. Timeline をトラックパッド横スワイプ → ネイティブ動作維持
5. /miti でボトムシート (MitigationSheet 等) を開いてホイール → 元の挙動のまま
6. iPhone Safari / Android Chrome (DevTools エミュレーション) → ネイティブ慣性のまま
7. OS 「視差効果を減らす」 ON → 全画面でネイティブ動作
8. Timeline でイベント中心スクロール (再生ボタン、 tutorial) → 既存挙動互換
9. ページ遷移 (LP → /miti、 /miti → /support) → scrollTop が即時 0 に戻る
10. PC のホイールを高速回転 → 短時間で目的の行に到達、 「待たされ感」 なし

全部 OK なら dev server 停止。 NG が出たら設計書 §6 のロールバック手順で commit を revert して再検討。

- [ ] **Step 6: push (Vercel 自動デプロイ)**

```bash
rtk git push origin main
```

Expected: Vercel が自動デプロイ開始。

- [ ] **Step 7: ユーザーに本番実機検証を依頼**

push 後、 ユーザーに「Vercel デプロイ完了次第、 上記 10 項目を本番で実機検証してください」 と伝える。

---

## Self-Review チェックリスト (プラン作成者向け)

✅ **Spec coverage**:
- 1.3 スコープ外: Task 7 (App.tsx) で全ページ Lenis 適用、 Task 8/9 で Timeline/Sidebar に自前スプリング、 ボトムシート系は明示的に触らない (Task 10 diff=0 で担保)
- 2.1 触る箇所: Task 1 (lenis 追加) / Task 5 (useSmoothScroll) / Task 6 (useSmoothWheelScroll) / Task 7 (App.tsx) / Task 8 (Timeline.tsx) / Task 9 (Sidebar.tsx) → 全 6 ファイルカバー
- 2.2 触らない箇所: Task 10 Step 4 で diff=0 を機械的に確認
- 3.3 LoPo 追加機能 (外部 scrollTop 変動検知): Task 6 Step 3 の `onScroll` listener で実装、 Step 6 のテストで検証
- 3.4 純粋関数の切り出し: Task 2-4 で 3 つ各個 TDD
- 3.5 PC/スマホ判定: Task 2 で `isSmoothScrollSupported` をテスト
- 3.6 既存 scrollTo/scrollIntoView 互換: Task 6 の外部 scrollTop 検知でカバー + Task 7-9 の実機確認で検証
- 4.1-4.3 テスト: Task 2-6 で純粋関数 14 件 + Hook 統合 5 件 (計 19 件) を vitest 追加
- 4.5 実機検証チェックリスト: Task 10 Step 5 で完全コピー

✅ **Placeholder scan**: TBD / TODO / vague は無し。 各 Step に actual code と exact command。

✅ **Type consistency**:
- `SpringState` (Task 4 で定義) → Task 6 の hook で使用、 一貫
- `isAtScrollBoundary` 返り値 `'top' | 'bottom' | null` (Task 3 定義) → Task 6 の hook で `boundary !== null` 判定、 一貫
- `useSmoothWheelScroll(ref)` シグネチャ (Task 6 定義) → Task 8/9 の使用箇所と一貫

問題なし。
