# 同じ秒に 3 つ以上の攻撃 + 攻撃数に応じた行の高さ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同じ秒の敵の攻撃をいくつでも表に表示し、PC の行の高さを「25px × max(1, 攻撃数)」にする。縦位置の計算は新しい「行の配置係」(`rowLayout`)1 か所に集約する。

**Architecture:** 純粋関数 `computeRowLayout` が、各秒の行の上端・高さ・表全体の高さと、座標変換(`topOf` / `bottomOf` / `timeAtY`)を返す。`Timeline.tsx` はこれを `useMemo` で 1 回だけ計算する。表の描画・軽減アイコンと効果時間の帯・フェーズ/ラベルの帯・範囲選択・ジャンプ・リキャスト行・競合矢印は、すべてこれを使う。`pixelsPerSecond` と、50px 行を前提にした固定値(+13 / +24 / −8 など)は廃止する。`TimelineRow` は攻撃 1 つ = 1 段の部品を N 個並べ、スマホは攻撃の数だけカードを並べる。FFLogs 取り込みの同秒ずらしは削除する。

**Tech Stack:** React + TypeScript(`noUnusedLocals` / `noUnusedParameters` 有効)/ Tailwind v4 / Zustand / Vitest(`// @vitest-environment happy-dom` + @testing-library/react)/ Playwright

**Spec:** `docs/superpowers/specs/2026-09-26-multi-attack-rows-design.md`(実装者は必ず先に読むこと)

## Global Constraints

- 1 段の高さ = PC 25px / スマホ 60px(`ROW_UNIT_PX`)。行の高さ = 1 段 × max(1, その秒の攻撃数)。不可視の行(空の行を隠す設定で隠れた秒)は 0。
- 軽減アイコンの大きさ = 24px(`MITI_ICON_PX`)。横方向(`ICON_WIDTH` / `PLACEMENT_STEP` / レーン幅 / 列幅)は触らない。
- 保存データの型と store(`TimelineEvent` など)は変えない。
- 同じ秒の攻撃の並び順(MT → ST → 全体、同じ種類の中は登録順 = `eventsByTime` の既存ソート)とダメージ計算は変えない。
- UI 文言は既存の i18n キーだけを使う(新しいキーは作らない)。「+」のツールチップは `timeline.event_add_here`。
- 型チェックが厳しい(未使用の変数・引数はエラー)。使わなくなった変数・引数・import は必ず消す。
- コマンドの先頭には `rtk` を付ける(例: `rtk npx vitest run src/...`)。
- テストは軽め(ユーザー指示)。
  - 各タスクでは、そのタスクのテストと型チェック(`rtk npx tsc -b`)だけ実行する。
  - 全件テストと build は Task 5 だけで行う。
- テストファイルは必ず `__tests__/` 配下に置く(vitest の include がそれ以外を拾わない)。
- コミットは各タスクの最後に 1 回。
  - メッセージの最後の行は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` にする。
  - `rtk git commit -F -`(標準入力)は失敗する。メッセージはファイルに書いて `-F <file>` で渡す。
- 触ってはいけないもの:
  - 設計書
  - `src/utils/mobileEffectBar.ts`
  - `src/components/Memo/coords.ts`
  - 未追跡の `scripts/milspec-polish/` と `scripts/milspec-sp2/`(`git add -A` / `git add .` は禁止。ファイルを名指しで add する)
  - `docs/.private/`

## Review Focus

1. 攻撃が 3 つ以上ある背の高い行の上で軽減アイコンをドラッグしたとき、アイコンの中心がある行の秒に落ちること(行の境界ちょうどは下の行)→ Task 1 の `timeAtY` テスト。
2. 効果がかかる最後の秒の行に攻撃が 3 つあるとき、帯がその行の下端(の 1px 上)まで届いて 3 つともかかって見え、次の秒の行には入らないこと → Task 1 の `barEndY` テスト。
3. 空の行を隠すモードで、効果の最後の秒が隠れた秒のとき、帯が直前の可視行の下端で止まること → Task 1 の `bottomOf`(不可視の秒)テスト。
4. フェーズ・ラベル・時刻へのジャンプや範囲選択の帯が、行の高さが変わっても正しい行に合うこと(グリッドの外の秒も含む)→ Task 1 の `topOf` テスト。
5. スマホで同じ秒に攻撃が 3 つ以上あるとき、次の 3 点を満たすこと → Task 5 の実機確認(スマホ幅)。
   - カードが全部出る
   - 表の一番下まで届く
   - 2 枚目以降を長押しすると、その攻撃のメニューが開く

---

### Task 1: 行の配置係 `rowLayout`(新規・純粋関数)

**Files:**
- Create: `src/components/timeline/rowLayout.ts`
- Test: `src/components/timeline/__tests__/rowLayout.test.ts`

**Interfaces:**
- Consumes: なし
- Produces(Task 2 以降が使う名前と型。変えないこと):
  - `ROW_UNIT_PX: { readonly pc: 25; readonly mobile: 60 }`
  - `MITI_ICON_PX: number`(= 24)
  - `interface RowLayoutInput { times; eventCountAt; hasMitigationStartAt; hideEmptyRows; maxPopulatedTime; forceVisibleTimes?; unitPx }`
  - `interface RowBox { time: number; top: number; height: number; visible: boolean }`
  - `interface RowLayout { unitPx; rows; totalHeight; timeToY: Map<number, number>; sortedTimeY: [number, number][]; topOf(t); bottomOf(t); timeAtY(y) }`
  - `computeRowLayout(input: RowLayoutInput): RowLayout`
  - `EMPTY_ROW_LAYOUT: RowLayout`
  - `mitiIconOffset(unitPx: number): number`
  - `barStartY(layout: RowLayout, time: number): number`
  - `barEndY(layout: RowLayout, time: number): number`
  - `childIconCutY(layout: RowLayout, childTime: number): number`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/timeline/__tests__/rowLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
    computeRowLayout, EMPTY_ROW_LAYOUT, ROW_UNIT_PX, MITI_ICON_PX,
    mitiIconOffset, barStartY, barEndY, childIconCutY,
} from '../rowLayout';
import type { RowLayoutInput } from '../rowLayout';

/** counts: 秒 → 攻撃数 / mits: 軽減の開始がある秒 */
const make = (
    times: number[],
    counts: Record<number, number>,
    opts: Partial<Omit<RowLayoutInput, 'times' | 'eventCountAt'>> & { mits?: number[] } = {},
) => computeRowLayout({
    times,
    eventCountAt: (t) => counts[t] ?? 0,
    hasMitigationStartAt: (t) => (opts.mits ?? []).includes(t),
    hideEmptyRows: opts.hideEmptyRows ?? false,
    maxPopulatedTime: opts.maxPopulatedTime ?? -11,
    forceVisibleTimes: opts.forceVisibleTimes,
    unitPx: opts.unitPx ?? ROW_UNIT_PX.pc,
});

describe('computeRowLayout', () => {
    it('PC: 行の高さ = 25px × max(1, 攻撃数)', () => {
        const l = make([0, 1, 2, 3], { 1: 1, 2: 2, 3: 3 });
        expect(l.rows.map((r) => r.height)).toEqual([25, 25, 50, 75]);
        expect(l.rows.map((r) => r.top)).toEqual([0, 25, 50, 100]);
        expect(l.totalHeight).toBe(175);
    });

    it('スマホ: 1 段 60px × 攻撃数', () => {
        const l = make([0, 1], { 0: 2 }, { unitPx: ROW_UNIT_PX.mobile });
        expect(l.rows.map((r) => r.height)).toEqual([120, 60]);
        expect(l.totalHeight).toBe(180);
    });

    it('空の行を隠す: 攻撃・軽減開始・最後の空行だけ表示し、隠れた秒は次の可視行の上端を持つ', () => {
        // 1=攻撃1 / 2=軽減開始 / 4=攻撃3 / 5=最後の空行(maxPopulated 4 + 1)/ 0,3=隠れる
        const l = make([0, 1, 2, 3, 4, 5], { 1: 1, 4: 3 }, { hideEmptyRows: true, maxPopulatedTime: 4, mits: [2] });
        expect(l.rows.map((r) => r.visible)).toEqual([false, true, true, false, true, true]);
        expect(l.rows.map((r) => r.height)).toEqual([0, 25, 25, 0, 75, 25]);
        expect(l.timeToY.get(0)).toBe(0);
        expect(l.timeToY.get(3)).toBe(50);
        expect(l.topOf(3)).toBe(l.topOf(4));
        expect(l.totalHeight).toBe(150);
    });

    it('forceVisibleTimes の秒は空でも表示する(チュートリアル)', () => {
        const l = make([0, 1], {}, { hideEmptyRows: true, maxPopulatedTime: -11, forceVisibleTimes: new Set([0]) });
        expect(l.rows[0]).toMatchObject({ time: 0, visible: true, height: 25 });
    });

    it('sortedTimeY は上端の昇順(同じ上端は秒の昇順)', () => {
        const l = make([0, 1, 2, 3, 4, 5], { 1: 1, 4: 3 }, { hideEmptyRows: true, maxPopulatedTime: 4, mits: [2] });
        expect(l.sortedTimeY).toEqual([[0, 0], [1, 0], [2, 25], [3, 50], [4, 50], [5, 125]]);
    });
});

describe('topOf / bottomOf', () => {
    it('グリッドの外: 前は 0、後ろは最後の行の下端から 1 段ずつ', () => {
        const l = make([0, 1], {});
        expect(l.topOf(-5)).toBe(0);
        expect(l.topOf(2)).toBe(50);
        expect(l.topOf(4)).toBe(100);
        expect(l.bottomOf(2)).toBe(75);
    });

    it('bottomOf: 攻撃 3 つの行は 3 段ぶん下', () => {
        const l = make([0, 1, 2], { 1: 3 });
        expect(l.bottomOf(1)).toBe(100);
    });

    it('bottomOf: 隠れた秒は直前の可視行の下端(= 帯がそこで止まる)', () => {
        const l = make([0, 1, 2, 3], { 1: 1, 3: 1 }, { hideEmptyRows: true, maxPopulatedTime: 3 });
        // 2 は隠れる。1 の行 = 0〜25
        expect(l.bottomOf(2)).toBe(25);
        expect(l.bottomOf(2)).toBe(l.bottomOf(1));
    });
});

describe('timeAtY', () => {
    // 0: 攻撃1 [0,25) / 1: 攻撃3 [25,100) / 2: 攻撃1 [100,125)
    const l = make([0, 1, 2], { 0: 1, 1: 3, 2: 1 });

    it('y を含む行の秒(上端を含み下端を含まない)', () => {
        expect(l.timeAtY(0)).toBe(0);
        expect(l.timeAtY(24.9)).toBe(0);
        expect(l.timeAtY(25)).toBe(1);
        expect(l.timeAtY(99)).toBe(1);
        expect(l.timeAtY(100)).toBe(2);
    });

    it('範囲外は最初 / 最後の可視行', () => {
        expect(l.timeAtY(-10)).toBe(0);
        expect(l.timeAtY(500)).toBe(2);
    });

    it('隠れた秒は選ばれない', () => {
        const h = make([0, 1, 2, 3, 4, 5], { 1: 1, 4: 3 }, { hideEmptyRows: true, maxPopulatedTime: 4, mits: [2] });
        expect(h.timeAtY(50)).toBe(4);
        expect(h.timeAtY(0)).toBe(1);
    });

    it('空のレイアウトでも落ちない', () => {
        expect(EMPTY_ROW_LAYOUT.timeAtY(100)).toBe(0);
        expect(EMPTY_ROW_LAYOUT.topOf(5)).toBe(0);
        expect(EMPTY_ROW_LAYOUT.totalHeight).toBe(0);
    });
});

describe('軽減アイコンと帯の位置', () => {
    it('旧 50px 行と同じ値になる(+13 / +25 / +49 / cutY+17)', () => {
        const l = make([0, 1, 2], {}, { unitPx: 50 });
        expect(MITI_ICON_PX).toBe(24);
        expect(mitiIconOffset(50)).toBe(13);
        expect(barStartY(l, 1)).toBe(50 + 25);
        expect(barEndY(l, 1)).toBe(50 + 49);
        expect(childIconCutY(l, 1)).toBe(50 + 17);
    });

    it('PC 25px: アイコンは最上段の縦中央、帯の終点は最後の秒の行の下端 − 1(攻撃 3 つなら 3 段ぶん)', () => {
        const l = make([0, 1, 2], { 1: 3 });
        expect(mitiIconOffset(ROW_UNIT_PX.pc)).toBe(0.5);
        expect(barStartY(l, 1)).toBe(25 + 12.5);
        expect(barEndY(l, 1)).toBe(100 - 1);
    });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `rtk npx vitest run src/components/timeline/__tests__/rowLayout.test.ts`
Expected: FAIL(`../rowLayout` が無い)

- [ ] **Step 3: 実装する**

`src/components/timeline/rowLayout.ts`:

```ts
/**
 * 行の配置係 — タイムラインの縦方向の位置を 1 か所で決める。
 *
 * 各秒の行の「上端・高さ」と表全体の高さを、攻撃の数・「空の行を隠す」設定・1 段の高さ(PC/スマホ)から計算する。
 * 表・軽減アイコンのドラッグ・効果時間の帯・範囲選択・フェーズ/ラベルの帯・ジャンプ・競合の矢印・リキャスト行は、
 * 縦位置をすべてここから得る(独自に秒数 × px の割り算・掛け算をしない)。
 *
 * 行の高さ = 1 段 × max(1, その秒の攻撃数)。空の行を隠す設定で隠れた秒は高さ 0。
 * 設計書: docs/superpowers/specs/2026-09-26-multi-attack-rows-design.md
 */

/** 1 段の高さ(px)。PC = 攻撃 1 つ分(旧「2 つ並び」の 1 段)/ スマホ = カード 1 枚 */
export const ROW_UNIT_PX = { pc: 25, mobile: 60 } as const;

/** PC の軽減アイコンの大きさ(px)。見た目を調整するときはここだけ変える(横方向のレーン幅は別管理) */
export const MITI_ICON_PX = 24;

export interface RowLayoutInput {
    /** グリッドの秒(昇順・連続)。Timeline の gridLines */
    times: readonly number[];
    eventCountAt: (time: number) => number;
    /** autoHidden を除く軽減の開始がある秒か */
    hasMitigationStartAt: (time: number) => boolean;
    hideEmptyRows: boolean;
    /** 攻撃・軽減の最大時刻(空の行を隠すときの「最後の空行」= この +1 の判定用。無ければ -11) */
    maxPopulatedTime: number;
    /** 空でも必ず表示する秒(チュートリアル用) */
    forceVisibleTimes?: ReadonlySet<number>;
    unitPx: number;
}

export interface RowBox {
    time: number;
    /** 行の上端。隠れた秒は次の可視行の上端 */
    top: number;
    /** 行の高さ。隠れた秒は 0 */
    height: number;
    visible: boolean;
}

export interface RowLayout {
    unitPx: number;
    rows: readonly RowBox[];
    totalHeight: number;
    /** 秒 → 行の上端(旧 timeToYMap と同じ意味。メモ・リモートカーソルの座標変換もこれを使う) */
    timeToY: Map<number, number>;
    /** [秒, 上端] を上端の昇順(同じ上端は秒の昇順)に並べたもの */
    sortedTimeY: [number, number][];
    /** その秒の行の上端。グリッドより前は 0、後ろは最後の行の下端から 1 段ずつ */
    topOf(time: number): number;
    /** その秒の行の下端(隠れた秒は直前の可視行の下端) */
    bottomOf(time: number): number;
    /** y を含む可視行の秒(上端を含み下端を含まない)。範囲外は最初 / 最後の可視行 */
    timeAtY(y: number): number;
}

export function computeRowLayout(input: RowLayoutInput): RowLayout {
    const { times, eventCountAt, hasMitigationStartAt, hideEmptyRows, maxPopulatedTime, forceVisibleTimes, unitPx } = input;
    const rows: RowBox[] = [];
    const timeToY = new Map<number, number>();
    const heightByTime = new Map<number, number>();
    let y = 0;
    for (const time of times) {
        const count = eventCountAt(time);
        const visible = !hideEmptyRows
            || count > 0
            || hasMitigationStartAt(time)
            || time === maxPopulatedTime + 1
            || (forceVisibleTimes?.has(time) ?? false);
        const height = visible ? unitPx * Math.max(1, count) : 0;
        rows.push({ time, top: y, height, visible });
        timeToY.set(time, y);
        heightByTime.set(time, height);
        y += height;
    }
    const totalHeight = y;
    const sortedTimeY = Array.from(timeToY.entries()).sort((a, b) => a[1] - b[1]);
    const visibleRows = rows.filter((r) => r.visible);
    const firstTime = times.length > 0 ? times[0] : 0;
    const lastTime = times.length > 0 ? times[times.length - 1] : 0;

    const topOf = (time: number): number => {
        const exact = timeToY.get(time);
        if (exact !== undefined) return exact;
        if (times.length === 0 || time < firstTime) return 0;
        if (time > lastTime) return totalHeight + (time - lastTime - 1) * unitPx;
        // グリッド内の小数秒: その秒の行の中を比例で進める
        const base = Math.floor(time);
        return (timeToY.get(base) ?? 0) + (time - base) * (heightByTime.get(base) ?? 0);
    };

    const bottomOf = (time: number): number => {
        const h = heightByTime.get(time);
        if (h !== undefined) return (timeToY.get(time) ?? 0) + h;
        if (times.length === 0 || time < firstTime) return 0;
        if (time > lastTime) return topOf(time) + unitPx;
        const base = Math.floor(time);
        return (timeToY.get(base) ?? 0) + (heightByTime.get(base) ?? 0);
    };

    const timeAtY = (yPx: number): number => {
        if (visibleRows.length === 0) return times.length > 0 ? times[0] : 0;
        if (yPx < visibleRows[0].top) return visibleRows[0].time;
        // 上端が yPx 以下の最後の可視行(可視行は隙間なく並ぶので、それが yPx を含む行)
        let lo = 0;
        let hi = visibleRows.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (visibleRows[mid].top <= yPx) lo = mid; else hi = mid - 1;
        }
        return visibleRows[lo].time;
    };

    return { unitPx, rows, totalHeight, timeToY, sortedTimeY, topOf, bottomOf, timeAtY };
}

/** ref の初期値など、まだ計算していないとき用の空のレイアウト */
export const EMPTY_ROW_LAYOUT: RowLayout = computeRowLayout({
    times: [],
    eventCountAt: () => 0,
    hasMitigationStartAt: () => false,
    hideEmptyRows: false,
    maxPopulatedTime: -11,
    unitPx: ROW_UNIT_PX.pc,
});

/** 行の上端から軽減アイコンの上端まで(アイコンは最上段 = 1 つ目の攻撃の段の縦中央)。PC: (25 − 24) / 2 = 0.5 */
export const mitiIconOffset = (unitPx: number): number => (unitPx - MITI_ICON_PX) / 2;

/** 効果時間の帯の始点 = 最上段の中央(= アイコンの中央) */
export const barStartY = (layout: RowLayout, time: number): number => layout.topOf(time) + layout.unitPx / 2;

/** 帯の終点 = その秒の行の下端の 1px 上(効果がかかる最後の秒 / バリア使い切り / 上書き負けで使う) */
export const barEndY = (layout: RowLayout, time: number): number => layout.bottomOf(time) - 1;

/** 親の帯を子アイコン(ホロスコープの発動・アーサリースターの変化・WD)の位置で止める点 = 子アイコンの上端 + 4px */
export const childIconCutY = (layout: RowLayout, childTime: number): number =>
    layout.topOf(childTime) + mitiIconOffset(layout.unitPx) + 4;
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `rtk npx vitest run src/components/timeline/__tests__/rowLayout.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/timeline/rowLayout.ts src/components/timeline/__tests__/rowLayout.test.ts
# メッセージ: feat(timeline): 行の配置係 rowLayout を追加(行の高さ = 1段 × 攻撃数・縦位置の計算を1か所に)
```

---

### Task 2: Timeline の縦位置を全部 rowLayout 経由にする(+ 行の高さ・スマホのカード N 枚)

**Files:**
- Modify: `src/components/Timeline.tsx`(下の 2-1〜2-17。行番号は origin/main `504ff28e` 時点の目安。コードの一致で探すこと)
- Modify: `src/components/TimelineRow.tsx`(`height` prop のみ。2-18)
- Modify: `src/components/MobileTimelineRow.tsx`(長押しの対象と `isSecondEvent` の廃止。2-19)

**Interfaces:**
- Consumes: Task 1 のすべて(`computeRowLayout`, `EMPTY_ROW_LAYOUT`, `ROW_UNIT_PX`, `MITI_ICON_PX`, `mitiIconOffset`, `barStartY`, `barEndY`, `childIconCutY`, `type RowLayout`)
- Produces:
  - `TimelineRow` に必須 prop `height: number`(行の高さ px)が増える(Task 3 はこの前提で段を `flex-1` で並べる)
  - `MobileTimelineRow` から `isSecondEvent` prop が消える(`eventIndex > 0` で判定)

このタスクの完了条件(機械判定):
- `rtk npx tsc -b` が exit 0
- `grep -n "pixelsPerSecond" src/components/Timeline.tsx` が、`computeMobileEffectBars` の引数キー `pixelsPerSecond: rowLayout.unitPx,` の 1 行だけになる
- `grep -nE "top \+ 13|\+ 24\b|\) - 8\)|top-3 w-1.5|getMappedY|getTimeFromY|new Map<number, number>\(\);" src/components/Timeline.tsx` が 0 件
- 下の Step のテストが PASS

- [ ] **Step 1(2-1): import を足す**

`src/components/Timeline.tsx` の `import type { ConflictPoint } from './timeline/conflictArrows';` の直後に次を追加:

```ts
import { computeRowLayout, EMPTY_ROW_LAYOUT, ROW_UNIT_PX, MITI_ICON_PX, mitiIconOffset, barStartY, barEndY, childIconCutY } from './timeline/rowLayout';
import type { RowLayout } from './timeline/rowLayout';
```

- [ ] **Step 2(2-2): `MitigationItemProps`(108 行付近)**

次の 4 行を削除する。
- `pixelsPerSecond: number;`
- `offsetTime: number;`
- `recastHeight?: number;`
- `timeToYMap: Map<number, number>;`

代わりに次を追加する。

```ts
    /** 行の配置係。縦位置(ドラッグのスナップ・帯クリック)はすべてここから得る */
    rowLayout: RowLayout;
```

- [ ] **Step 3(2-3): `MitigationItem` の分割代入と store 購読(228〜252 行付近)**

分割代入を次にする(`pixelsPerSecond` / `offsetTime` / `timeToYMap` を消し、`rowLayout` を足す):

```ts
    const {
        mitigation, rowLayout, onRemove, onUpdateTime,
        top, height, left, partySortOrder,
        scrollContainerRef, activeMitigations, overlapOffset = 0,
        isVirtual = false, iconOverride, layoutReady = true, grayscale = false,
        onCellClick
    } = props;
```

`hideEmptyRows` は使わなくなる。次の store 購読を 1 行に置き換える。

置き換え前:

```ts
    const { myMemberId, hideEmptyRows } = useMitigationStore(
        useShallow(s => ({ myMemberId: s.myMemberId, hideEmptyRows: s.hideEmptyRows }))
    );
```

置き換え後:

```ts
    const myMemberId = useMitigationStore(s => s.myMemberId);
```

(`useShallow` の import はファイル内の他の場所でも使っているので残す。未使用エラーが出た場合だけ消す)

- [ ] **Step 4(2-4): `getTimeFromY` を置き換える(266〜288 行付近)**

`// 👇 追加：Y座標から、コンパクトモード時でも正確に「どの時間の行を指しているか」を逆算する関数` から `getTimeFromY` の終わりの `};` までを、次で置き換える:

```ts
    // 縦位置はすべて rowLayout(行の配置係)から得る。
    // アイコンは行の最上段(1 つ目の攻撃の段)の縦中央に置く。
    const iconOffset = mitiIconOffset(rowLayout.unitPx);
    // ドラッグ中の「行の上端」Y から、アイコンの中央がある行の秒を求める
    // (均一な行では旧実装の「最も近い行の上端」と同じ動き。背の高い行でもアイコンの下の行に落ちる)
    const timeAtDraggedTop = (rowTopY: number): number => rowLayout.timeAtY(rowTopY + rowLayout.unitPx / 2);
```

- [ ] **Step 5(2-5): `handleBarClick`(290〜303 行付近)**

直前のコメント(2026-08-26 の経緯)は残すが、3 行目の `getTimeFromYで棒のクリック位置` を `rowLayout.timeAtY で棒のクリック位置` に、4 行目の `(ratio)から行の時間を逆算し、` を `(ratio)から行の時間を求め、` に書き換える。関数本体を次にする(本体の中の旧コメント 2 行も置き換わる):

```ts
    const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!onCellClick || isVirtual) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
        // 棒の上端 = 行の最上段の中央(アイコン中央)。クリック位置を「含む」行の秒へ転送する
        // (旧実装は最も近い行の上端を選んでいたため、行の下半分をクリックすると 1 秒後になるずれがあった)。
        const barTopY = top + rowLayout.unitPx / 2;
        const time = rowLayout.timeAtY(barTopY + ratio * durationHeight);
        onCellClick(mitigation.ownerId, time, e);
    };
```

- [ ] **Step 6(2-6): ドラッグの位置計算(305〜348 行付近と 470〜471 行付近)**

`updateDragPosition` の中を次のように変える。

置き換え前:

```ts
        const currentY = top + dy;
        containerRef.current.style.top = `${currentY + 13}px`;
```

置き換え後:

```ts
        const currentY = top + dy;
        containerRef.current.style.top = `${currentY + iconOffset}px`;
```

置き換え前:

```ts
        // 修正：スナップ先の時間を計算
        const snappedTime = getTimeFromY(currentY);
        // その時間の正しいY座標（コンパクトモードの圧縮を加味）
        const snappedY = hideEmptyRows ? (timeToYMap.get(snappedTime) ?? currentY) : (snappedTime - offsetTime) * pixelsPerSecond;
```

置き換え後:

```ts
        // スナップ先 = アイコンの中央がある行の秒。その行の上端 Y は rowLayout から
        const snappedTime = timeAtDraggedTop(currentY);
        const snappedY = rowLayout.topOf(snappedTime);
```

`resetDragPosition` の `containerRef.current.style.top = `${top + 13}px`;` を、`containerRef.current.style.top = `${top + iconOffset}px`;` にする。

`handlePointerUp` の `const newTime = getTimeFromY(finalY);` を、`const newTime = timeAtDraggedTop(finalY);` にする。

- [ ] **Step 7(2-7): アイコンと帯の描画(531〜631 行付近)**

外側コンテナの style を置き換える。

置き換え前:

```tsx
                    top: `${top + 13}px`,
                    width: '24px',
```

置き換え後:

```tsx
                    top: `${top + iconOffset}px`,
                    width: `${MITI_ICON_PX}px`,
```

アイコン本体の div(`data-myjob-dim={isNotMine ? 'gray' : undefined}` の div)の className から `"w-6 h-6",` の 1 行を削除し、同じ div に次の style を追加する。

```tsx
                    style={{ width: `${MITI_ICON_PX}px`, height: `${MITI_ICON_PX}px` }}
```

効果棒の div は次の 2 点を変える。
- className の `"absolute top-3 w-1.5 z-10 rounded-b-sm border-x pointer-events-auto cursor-pointer",` を `"absolute w-1.5 z-10 rounded-b-sm border-x pointer-events-auto cursor-pointer",` にする。
- style の先頭に `top: `${MITI_ICON_PX / 2}px`,` を追加する。これで棒の上端はアイコンの中央 = 行の最上段の中央になる。

その下のコメント「リキャスト残時間点線は廃止 … 撤去せず保持。」は次にする。

```tsx
                {/* リキャスト残時間点線は廃止 (セッション 18 のリキャスト専用行で代替可能)。 */}
```

- [ ] **Step 8(2-8): `pixelsPerSecond` の定義(759 行)**

`const pixelsPerSecond = isMobileTimeline ? 60 : 50;` を次にする:

```ts
    // 1 段の高さ(PC=攻撃 1 つ分 / スマホ=カード 1 枚)。縦位置は rowLayout(下で計算)から得る
    const rowUnitPx = isMobileTimeline ? ROW_UNIT_PX.mobile : ROW_UNIT_PX.pc;
```

- [ ] **Step 9(2-9): 範囲選択プレビュー `updatePreviewHighlight`(831〜844 行付近)**

`// オーバーレイ位置を直接更新` のブロックと deps を次にする:

```ts
        // オーバーレイ位置を直接更新(縦位置は rowLayout から)
        if (overlayRef.current) {
            const layout = rowLayoutRef.current;
            const offsetTime = showPreStart ? -10 : 0;
            const startTime = Math.max(Math.min(mode.startTime, time), offsetTime);
            const endTime = Math.max(Math.max(mode.startTime, time) + 1, offsetTime);
            const startY = layout.topOf(startTime);
            const endY = layout.topOf(endTime);
            const height = Math.max(0, endY - startY);
            overlayRef.current.style.top = `${startY}px`;
            overlayRef.current.style.height = `${height}px`;
            overlayRef.current.style.display = height > 0 ? '' : 'none';
        }
    }, [timelineSelectMode, labelSelectMode, showPreStart]);
```

- [ ] **Step 10(2-10): `handleNavJump`(967〜979 行付近)**

コメント 2 行と関数を次にする:

```ts
    // useCallback で包む: progress:jump-to-time リスナが最新版を参照するため。
    // 縦位置は rowLayoutRef(常に最新の行の配置)から得るので deps 不要。
    const handleNavJump = useCallback((time: number) => {
        if (!scrollContainerRef.current) return;
        scrollContainerRef.current.scrollTo({ top: rowLayoutRef.current.topOf(time), behavior: 'smooth' });
    }, []);
```

- [ ] **Step 11(2-11): ref を足す(1403〜1410 行付近)**

`const sortedTimeYRef = useRef<[number, number][]>([]);` の直後に次を追加する。

```ts
    // 行の配置係の最新値。コールバック(スクロール同期・ジャンプ・範囲選択)は描画後にこれを読む。
    // 書き込みは rowLayout の useMemo の直後(描画中)で 1 回だけ。
    const rowLayoutRef = useRef<RowLayout>(EMPTY_ROW_LAYOUT);
```

その上のコメント「syncRecastRow (hideEmptyRows時) がスクロール毎に…」の `(hideEmptyRows時)` は削除する(今は常に使うため)。

- [ ] **Step 12(2-12): `syncRecastRow`(1528〜1560 行付近)**

`let currentTime: number;` から deps までを次にする。二分探索の本体と性能のコメントは残す。

```ts
        let currentTime: number;
        if (sortedTimeYRef.current.length > 0) {
            // 上端が scrollTop に最も近い行の時刻を逆引き(行の高さが可変でも、空の行を隠す設定でも同じ方法)。
            // Y昇順ソート済み配列(sortedTimeYRef)を二分探索する。以前はtimeToYMapを毎回
            // forEachで全走査しており、戦闘が長い(=行数が多い)ほどスクロール1回ごとの
            // コストが積み重なりメインスレッドを塞いでいた(2026-08-14ユーザー実機報告
            // 「スマホでスクロールが重い/変身アニメがとびとび」の主因)。
            const arr = sortedTimeYRef.current;
            let lo = 0, hi = arr.length - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (arr[mid][1] < scrollTop) lo = mid + 1; else hi = mid;
            }
            let closestIdx = lo;
            if (lo > 0 && Math.abs(arr[lo - 1][1] - scrollTop) <= Math.abs(arr[lo][1] - scrollTop)) {
                closestIdx = lo - 1;
            }
            currentTime = arr[closestIdx][0];
        } else {
            currentTime = offsetTime;
        }
        recastRowRef.current?.update(currentTime);
    }, [showPreStart, recastRowVisible]);
```

- [ ] **Step 13(2-13): `syncMobilePhaseLabel`(1591〜1637 行付近)**

次の 2 行を置き換える。

置き換え前:

```ts
        const offsetTime = showPreStart ? -10 : 0;
        const yOfTime = (time: number) => timeToYMapRef.current.get(time) ?? ((time - offsetTime) * pixelsPerSecond);
```

置き換え後:

```ts
        const layout = rowLayoutRef.current;
        const yOfTime = (time: number) => layout.topOf(time);
```

`const transitionPx = MOBILE_PHASE_TRANSITION_SECONDS * pixelsPerSecond;` を `const transitionPx = MOBILE_PHASE_TRANSITION_SECONDS * layout.unitPx;` にする。

deps `[showPreStart, pixelsPerSecond, phases, contentLanguage, t]` を `[phases, contentLanguage, t]` にする。

- [ ] **Step 14(2-14): `rowLayout` を計算する(`eventsByTime` の useMemo の直後、1855 行付近)**

`eventsByTime` の `useMemo` の閉じ `}, [timelineEvents]);` の直後に追加:

```ts
    // 行の配置係: 各秒の行の位置と高さ・表全体の高さを 1 か所で決める(縦位置の答えはすべてここから)。
    // 行の高さ = 1 段 × max(1, 攻撃数)。空の行を隠す設定の可視判定もここ(旧: 表全体の高さと描画ループで二重に計算)。
    const forceShowTime0 = useTutorialStore(s => s.isActive && s.getCurrentStep()?.id === 'create-6-add-event');
    const rowLayout = useMemo(() => {
        let maxPopulatedTime = -11;
        if (hideEmptyRows) {
            timelineEvents.forEach(e => { if (e.time > maxPopulatedTime) maxPopulatedTime = e.time; });
            timelineMitigations.forEach(m => { if (m.time > maxPopulatedTime) maxPopulatedTime = m.time; });
        }
        const mitStartTimes = new Set<number>();
        timelineMitigations.forEach(m => { if (!m.autoHidden) mitStartTimes.add(m.time); });
        return computeRowLayout({
            times: gridLines,
            eventCountAt: t => eventsByTime.get(t)?.length ?? 0,
            hasMitigationStartAt: t => mitStartTimes.has(t),
            hideEmptyRows,
            maxPopulatedTime,
            forceVisibleTimes: forceShowTime0 ? new Set([0]) : undefined,
            unitPx: rowUnitPx,
        });
    }, [gridLines, eventsByTime, timelineEvents, timelineMitigations, hideEmptyRows, forceShowTime0, rowUnitPx]);
    // 縦位置を使うコールバック(スクロール同期・ジャンプ・範囲選択・メモ・カーソル)は ref 経由で最新を読む
    rowLayoutRef.current = rowLayout;
    timeToYMapRef.current = rowLayout.timeToY;
    sortedTimeYRef.current = rowLayout.sortedTimeY;
```

- [ ] **Step 15(2-15): 競合矢印 `conflictPoints`(2639〜2679 行付近)**

コメントブロック(`// 画面外ガイド矢印用:` から `//   描画しないことで緩和している。` まで)と `useMemo` を次にする:

```ts
    // 画面外ガイド矢印用: 競合中インスタンスの列中央X + コンテンツ内絶対Y を算出。
    // Y は rowLayout(同じレンダーで計算済みの行の配置)から得る。旧実装の「直前レンダーの
    // timeToYMap を ref 経由で読む 1 レンダー分のラグ」は無くなった。
    // 初回マウント時の 1 フレームずれは ConflictOffscreenArrows 側で viewportHeight===0 中は
    // 描画しないことで緩和している。
    const conflictPoints = useMemo<ConflictPoint[]>(() => {
        return timelineMitigations
            // 表示/非表示スイッチで隠したメンバーの競合は、列自体が描画されないため画面外
            // ガイド矢印の対象からも除外する(競合検知=conflictingIds 自体は不変・見た目だけ)。
            .filter(m => conflictingIds.has(m.id) && m.id !== lastPlacedMitigationId && !hiddenPartyMemberIds.includes(m.ownerId))
            .map(m => {
                const y = rowLayout.topOf(m.time);
                if (isMobileTimeline) {
                    // モバイルは担当者ごとの列が無い(1本の行に全員分のアイコンが並ぶ)ため、
                    // ownerId を固定値にして矢印を「上下1個ずつ」に集約する(PCのように
                    // 担当者ごとにバラバラ出ると窮屈になるため)。x は行の水平中央。
                    return { id: m.id, ownerId: '__mobile__', y, columnCenterX: sheetWidth / 2 };
                }
                const layout = memberLayout.get(m.ownerId);
                return {
                    id: m.id,
                    ownerId: m.ownerId,
                    y,
                    // 列幅の中央 (ジョブ種別で列幅が変わるので width の中央)。
                    columnCenterX: layout ? layout.left + layout.width / 2 : 0,
                };
            });
    // memberLayout は Map で参照同一・中身が変化するため refVersion を直接含められない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timelineMitigations, conflictingIds, lastPlacedMitigationId, memberLayout, rowLayout, isMobileTimeline, sheetWidth]);
```

(`hiddenPartyMemberIds` は元の deps に無かったので、元の通り入れない)

- [ ] **Step 16(2-16): 表全体の高さと描画ループ(3131〜3370 行付近)**

(a) シートのコンテナの `style={{ height: `${(() => { … })()}` }}` を、次の style に置き換える。IIFE は丸ごと削除する。

```tsx
                        <div ref={sheetContainerRef} onClick={handleSheetClick} className="relative isolate bg-transparent md:w-max md:min-w-full" style={{
                            // 表全体の高さ = 行の配置係の合計(描画と同じ計算。旧実装は別ループで数えていて、
                            // スマホの同時刻 2 件行を 1 段分少なく数えていた)
                            height: `calc(${rowLayout.totalHeight}px + 50vh)`
                        }}>
```

(b) 描画 IIFE の先頭(`const renderItems: React.ReactElement[] = [];` の直後)にある次のものを削除する。
- `let currentY = 0;`
- `let maxPopulatedTime = -11;` と、それに続く `if (hideEmptyRows) { … }` の 4 行
- `const timeToYMap = new Map<number, number>();`

`mitigationsByTime` / `mitStartsByTime` の計算はそのまま残す(スマホの帯と帯の切り詰めで使う)。

(c) `gridLines.forEach((time) => {` から、ループの終わり(`currentY += pixelsPerSecond;` と `});`)までを、次で置き換える。モバイル用の `mobileSelectHandler` / `mobileHoverHandler` と、PC の `<TimelineRow>` の props は元のまま。変わるのは `top` / `height` / キー / カードの枚数だけ。

```tsx
                                rowLayout.rows.forEach(({ time, top, height, visible }) => {
                                    if (!visible) return;
                                    const rowEvents = eventsByTime.get(time) || [];
                                    const rowDamages = rowEvents.map(event => damageMap.get(event.id) || null);
                                    const activeMitigationsForRow = mitigationsByTime.get(time) || [];

                                    if (isMobileTimeline) {
                                        // Mobile: MobileTimelineRow を使用
                                        const mobileSelectHandler = (time: number) => {
                                            /* ↓ 元のコードをそのまま(labelSelectMode / timelineSelectMode の分岐) */
                                        };
                                        const mobileHoverHandler = (time: number) => {
                                            if (timelineSelectMode || labelSelectMode) throttledUpdatePreview(time);
                                        };

                                        // 攻撃 1 つにつきカード 1 枚(攻撃なしは 1 枚)。行の高さ = 1 段 × 枚数。
                                        // 同じ秒のカードの間には区切り線を引かない(最後のカードだけ下に線)。
                                        const cardCount = Math.max(1, rowEvents.length);
                                        for (let i = 0; i < cardCount; i++) {
                                            renderItems.push(
                                                <MobileTimelineRow
                                                    key={`${time}-${i}`}
                                                    time={time}
                                                    top={top + i * rowLayout.unitPx}
                                                    damages={rowDamages}
                                                    events={rowEvents}
                                                    partyMembers={sortedPartyMembers}
                                                    hiddenPartyMemberIds={hiddenPartyMemberIds}
                                                    activeMitigations={activeMitigationsForRow}
                                                    onMobileDamageClick={handleMobileDamageClick}
                                                    onLongPress={handleMobileLongPress}
                                                    phaseColumnCollapsed={phaseColumnCollapsed}
                                                    hasPhases={phases.length > 0}
                                                    timelineSelectMode={timelineSelectMode}
                                                    labelSelectMode={labelSelectMode}
                                                    onTimelineSelect={mobileSelectHandler}
                                                    onTimelineSelectHover={mobileHoverHandler}
                                                    eventIndex={i}
                                                    hideBottomDivider={i < cardCount - 1}
                                                    rowHeight={rowLayout.unitPx}
                                                    maxMitiIcons={maxMitiIconsPerRow}
                                                    conflictingIds={mobileConflictingIds}
                                                />
                                            );
                                        }
                                    } else {
                                        // PC: TimelineRow (body 行)。高さ = 1 段 × max(1, 攻撃数)
                                        renderItems.push(
                                            <TimelineRow
                                                key={time}
                                                time={time}
                                                top={top}
                                                height={height}
                                                /* ↓ damages 以降の props は元のまま(onTimelineSelect の中身、showRowBorders まで) */
                                            />
                                        );
                                    }
                                });
```

(`/* ↓ 元のまま */` の箇所は、元のコードをそのまま移す。コメントは残さない)

(d) ループ直後の次の 2 行を削除する(Step 14 に移動済み)。
- `timeToYMapRef.current = timeToYMap;`
- `sortedTimeYRef.current = Array.from(timeToYMap.entries()).sort((a, b) => a[1] - b[1]);`

- [ ] **Step 17(2-17): オーバーレイと帯(3391〜3801 行付近)**

(a) スマホの帯 `computeMobileEffectBars({ … })` の引数は、次の 2 つだけ変える。`offsetTime` などの残りの引数は元のまま。
- `timeToYMap,` → `timeToYMap: rowLayout.timeToY,`
- `pixelsPerSecond,` → `pixelsPerSecond: rowLayout.unitPx,`

(b) フェーズ帯。

置き換え前:

```ts
                                            const startY = timeToYMap.get(effectiveStartTime) ?? (Math.max(0, effectiveStartTime - offsetTime) * pixelsPerSecond);
                                            const top = startY;
                                            const height = Math.max(0, (timeToYMap.get(effectiveEndTime) ?? (Math.max(0, effectiveEndTime - offsetTime) * pixelsPerSecond)) - startY);
```

置き換え後:

```ts
                                            const startY = rowLayout.topOf(effectiveStartTime);
                                            const top = startY;
                                            const height = Math.max(0, rowLayout.topOf(effectiveEndTime) - startY);
```

(c) ラベル帯。

置き換え前:

```ts
                                                const startY = timeToYMap.get(effectiveStart) ?? (Math.max(0, effectiveStart - offsetTime) * pixelsPerSecond);
                                                const endY = timeToYMap.get(effectiveEnd) ?? (Math.max(0, effectiveEnd - offsetTime) * pixelsPerSecond);
```

置き換え後:

```ts
                                                const startY = rowLayout.topOf(effectiveStart);
                                                const endY = rowLayout.topOf(effectiveEnd);
```

(d) PC の軽減の帯(3691〜3772 行付近)。次の範囲を置き換える。
- 始まり: `const offsetTime = showPreStart ? -10 : 0;`(`displayItems.forEach(mitigation => {` の直後)
- 終わり: `let height = Math.max(0, Math.round(endY - startY));`

`effectiveEndTime` を決める部分(コンパクトモードの切り詰めと `Math.min(effectiveEndTime, maxTime)`)は変えずに残す。

```ts
                                                    const durationSeconds = Math.max(1, mitigation.duration);
                                                    const durationEndTime = mitigation.time + durationSeconds - 1;

                                                    // コンパクトモード: 終了時間が空行なら、その前の可視行に切り詰める
                                                    /* ↓ effectiveEndTime の計算(元のコードのまま: 切り詰めのループと Math.min(effectiveEndTime, maxTime)) */

                                                    // 縦位置はすべて rowLayout から(行の高さが攻撃数で変わっても帯が正しく伸びる)。
                                                    // top = 開始の秒の行の上端(MitigationItem の基準)。帯は最上段の中央(アイコン中央)から、
                                                    // 「効果がかかる最後の秒」の行の下端の 1px 上まで。
                                                    const top = rowLayout.topOf(mitigation.time);
                                                    const barTop = barStartY(rowLayout, mitigation.time);
                                                    const def = MITIGATIONS.find((m: any) => m.id === mitigation.mitigationId);
                                                    let height = Math.max(0, Math.round(barEndY(rowLayout, effectiveEndTime) - barTop));
```

削除されるもの:
- `getMappedY`
- `startY` / `endY`
- `recast` / `recastEndTime` / `recastEndY` / `calculatedRecastHeight`
- 後ろにある重複した `const top = startY;`

リキャスト点線は既に廃止されており、`recastHeight` は `MitigationItem` の中で使われていなかったので、消して問題ない。

(e) 帯の切れ目(同じブロックの `if (!mitigation.isVirtual) { … }`)の 5 か所を置き換える。

- ホロスコープ: `const cutY = getMappedY(heliosInHoro[0].time);` と次の行を、次の 1 行にする。

  ```ts
  height = Math.max(0, Math.round(childIconCutY(rowLayout, heliosInHoro[0].time) - barTop));
  ```
- アーサリースター: `const cutY = getMappedY(mitigation.time + 10);` と次の行を、次の 1 行にする。

  ```ts
  height = Math.max(0, Math.round(childIconCutY(rowLayout, mitigation.time + 10) - barTop));
  ```
- WD: `const cutY = getMappedY(wd.time);` と次の行を、次の 1 行にする。

  ```ts
  height = Math.max(0, Math.round(childIconCutY(rowLayout, wd.time) - barTop));
  ```
- バリア使い切り: 2 行を、次の 1 行にする。

  ```ts
  height = Math.min(height, Math.max(0, Math.round(barEndY(rowLayout, shieldExhaustedAt.get(mitigation.id)!) - barTop)));
  ```
- 上書き負け: 2 行を、次の 1 行にする。

  ```ts
  height = Math.min(height, Math.max(0, Math.round(barEndY(rowLayout, barrierOverwrittenAt.get(mitigation.id)!) - barTop)));
  ```

(f) `<MitigationItem …>` の props を変える。
- 次の 4 つを削除する。
  - `pixelsPerSecond={pixelsPerSecond}`
  - `recastHeight={…}`
  - `offsetTime={offsetTime}`
  - `timeToYMap={timeToYMap}`
- `mitigation={mitigation}` の直後に `rowLayout={rowLayout}` を追加する。
- `top={top}` と `height={height}` はそのまま。

- [ ] **Step 18(2-18): `TimelineRow` に `height` prop を足す**

`src/components/TimelineRow.tsx`:
- `TimelineRowProps` の `top: number;` の直後に次を追加する。

  ```ts
      /** 行の高さ(px)= 1 段 × max(1, 攻撃数)。Timeline の rowLayout が決める */
      height: number;
  ```
- 分割代入の `top,` の直後に `height,` を追加する。
- ルート div の className を変える。
  - `"absolute left-0 w-full md:w-fit flex h-[50px] group  duration-75",` を `"absolute left-0 w-full md:w-fit flex group duration-75",` にする。
  - 次の 2 行を置き換える。

    置き換え前:

    ```ts
                    // perf #59: ビューポート外行を style/layout/paint からスキップ。 行 height は h-[50px] と一致
                    "[content-visibility:auto] [contain-intrinsic-size:auto_50px]",
    ```

    置き換え後:

    ```ts
                    // perf #59: ビューポート外行を style/layout/paint からスキップ。仮の高さ(contain-intrinsic-size)は style の height と一致させる
                    "[content-visibility:auto]",
    ```
- ルート div の `style={{` の先頭に、次の 2 行を追加する。

  ```ts
                  height: `${height}px`,
                  containIntrinsicSize: `auto ${height}px`,
  ```
- memo の比較関数の `if (prevProps.top !== nextProps.top) return false;` の直後に、次を追加する。

  ```ts
      if (prevProps.height !== nextProps.height) return false;
  ```

(この段階では攻撃列の中身はまだ 2 件までの描き方のまま。Task 3 で N 件にする)

- [ ] **Step 19(2-19): `MobileTimelineRow` の長押しと `isSecondEvent`**

`src/components/MobileTimelineRow.tsx`:
- props の型から `isSecondEvent?: boolean;` とその上のコメント行を削除する。
- `hideBottomDivider` のコメントを `/** true の場合、下部区切り線を出さない(同時刻の複数カードのうち最後以外) */` にする。
- 分割代入から `isSecondEvent,` を削除する。
- 長押しの `onLongPress(events[0] ?? null, time);` を、次の 2 行にする。

  ```ts
  // 押したカードの攻撃のメニューを開く(旧: 常に 1 件目が開く不具合)
  onLongPress(event ?? null, time);
  ```

  `event` は 279 行付近の `const event = events[idx] …`。
- 時刻の文字色の `isSecondEvent ? "text-app-text-muted opacity-85" : "text-app-text opacity-85"` を、`idx > 0 ? "text-app-text-muted opacity-85" : "text-app-text opacity-85"` にする。直前のコメントの「同時刻2件目」は「同時刻 2 件目以降」にする。
- 395 行付近のコメント `(同時刻2件の1件目は2件目との間の罫線を出さない)` は `(同時刻の複数カードは最後のカード以外、間の罫線を出さない)` にする。
- memo の比較関数を変える。
  - `if (prevProps.isSecondEvent !== nextProps.isSecondEvent) return false;` を削除する。
  - 代わりに `if (prevProps.hideBottomDivider !== nextProps.hideBottomDivider) return false;` を追加する。

- [ ] **Step 20: 型チェックと関連テスト**

Run: `rtk npx tsc -b`
Expected: exit 0。未使用の変数・引数のエラーが出たら、それを消して再実行する(例: 使わなくなった `offsetTime` のローカル変数)。

Run: `rtk npx vitest run src/components/timeline src/components/__tests__/Timeline.layout.test.tsx src/components/__tests__/Timeline.readonly.test.tsx src/components/__tests__/Timeline.contentId.test.tsx src/components/__tests__/Timeline.shieldAbsorption.test.ts src/utils/__tests__/mobileEffectBar.test.ts src/components/Memo/__tests__/coords.test.ts`
Expected: 全部 PASS

完了条件の grep 2 つ(このタスクの冒頭)も実行して確認する。

- [ ] **Step 21: コミット**

```bash
rtk git add src/components/Timeline.tsx src/components/TimelineRow.tsx src/components/MobileTimelineRow.tsx
# メッセージ: refactor(timeline): 縦位置の計算を rowLayout に一本化(行の高さ=1段×攻撃数・スマホは攻撃の数だけカード・長押しの対象ずれを修正)
```

---

### Task 3: PC の攻撃を N 段で並べる +「+」ボタン + AA モードの件数制限をなくす

**Files:**
- Modify: `src/components/TimelineRow.tsx`(攻撃列・RAW 列・TAKEN 列と新しい小部品 2 つ)
- Modify: `src/components/Timeline.tsx`(`handleAddClick` の AA モード部分だけ)
- Test: `src/components/__tests__/TimelineRow.multiAttack.test.tsx`(新規)

**Interfaces:**
- Consumes: Task 2 の `TimelineRow` の `height` prop(行の高さ = 1 段 × 攻撃数。段は `flex-1` で等分するので 1 段 = 25px になる)
- Produces: なし(画面の変更だけ)

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/TimelineRow.multiAttack.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

const storeState = {
    myMemberId: null,
    timelineMitigations: [],
    phases: [],
    updateEvent: vi.fn(),
    setClipboardEvent: vi.fn(),
};
vi.mock('../../store/useMitigationStore', () => ({
    useMitigationStore: (sel: any) => sel(storeState),
}));
vi.mock('../../store/useThemeStore', () => ({
    useThemeStore: () => ({ contentLanguage: 'ja' }),
}));
vi.mock('../../hooks/useSkillsData', () => ({
    useJobs: () => [],
    useMitigations: () => [],
}));
vi.mock('../progress/useProgressRecording', () => ({
    useProgressRecording: { getState: () => ({ recordMode: false, commitReachedPos: vi.fn() }) },
}));

import { TimelineRow } from '../TimelineRow';
import type { TimelineEvent } from '../../types';

const ev = (id: string, name: string): TimelineEvent => ({
    id, time: 10, name: { ja: name, en: name }, damageType: 'magical', target: 'AoE',
} as TimelineEvent);

const renderRow = (events: TimelineEvent[], onAddEventClick = vi.fn(), onEventClick = vi.fn()) => render(
    <TimelineRow
        time={10}
        top={0}
        height={25 * Math.max(1, events.length)}
        damages={events.map(() => null)}
        events={events}
        partyMembers={[]}
        visiblePartyMembers={[]}
        activeMitigations={[]}
        onPhaseAdd={vi.fn()}
        onAddEventClick={onAddEventClick}
        onEventClick={onEventClick}
        onCellClick={vi.fn()}
        phaseColumnCollapsed
        labelColumnVisible={false}
    />,
);

describe('TimelineRow: 同じ秒に 3 つ以上の攻撃', () => {
    it('3 件の攻撃が 3 つとも表示され、行の高さは 75px', () => {
        const { container } = renderRow([ev('a', '攻撃A'), ev('b', '攻撃B'), ev('c', '攻撃C')]);
        expect(screen.getByText('攻撃A')).toBeTruthy();
        expect(screen.getByText('攻撃B')).toBeTruthy();
        expect(screen.getByText('攻撃C')).toBeTruthy();
        expect((container.firstChild as HTMLElement).style.height).toBe('75px');
    });

    it('各段の「+」で onAddEventClick(その秒)が呼ばれ、攻撃名クリックのメニューは開かない', () => {
        const onAdd = vi.fn();
        const onEventClick = vi.fn();
        renderRow([ev('a', '攻撃A'), ev('b', '攻撃B'), ev('c', '攻撃C')], onAdd, onEventClick);
        const addButtons = screen.getAllByLabelText('timeline.event_add_here');
        expect(addButtons).toHaveLength(3);
        fireEvent.click(addButtons[1]);
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd.mock.calls[0][0]).toBe(10);
        expect(onEventClick).not.toHaveBeenCalled();
    });

    it('攻撃 1 つの行の下の細い「+」(高さ 12px の帯)は無い', () => {
        const { container } = renderRow([ev('a', '攻撃A')]);
        expect(container.querySelector('[class*="h-[12px]"]')).toBeNull();
        expect(screen.getAllByLabelText('timeline.event_add_here')).toHaveLength(1);
    });
});
```

- [ ] **Step 2: 失敗を確認する**

Run: `rtk npx vitest run src/components/__tests__/TimelineRow.multiAttack.test.tsx`
Expected: FAIL(3 件目の「攻撃C」が見つからない / `timeline.event_add_here` のボタンが無い)

- [ ] **Step 3: 小部品 2 つを足す(`TimelineRow.tsx`)**

import の `import type { PartyMember, TimelineEvent, AppliedMitigation } from '../types';` に `Phase` を追加する。

```ts
import type { PartyMember, TimelineEvent, AppliedMitigation, Phase } from '../types';
```

`PcCopyButton` の定義の直後(`export const TimelineRow = memo(` の前)に追加:

```tsx
// PC用: イベント追加ボタン — コピーの左隣。ホバー時だけ出る(コピーと同じ動き)。
// 動きは空の行の「+」と同じ onAddEventClick(コピー中は貼り付け / AA モード中は AA 追加 / それ以外は追加モーダル)。
const PcAddEventButton: React.FC<{ time: number; onAddEventClick: (time: number, e: React.MouseEvent) => void }> = ({ time, onAddEventClick }) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={t('timeline.event_add_here')} position="top">
            <button
                type="button"
                aria-label={t('timeline.event_add_here')}
                onClick={(e) => {
                    e.stopPropagation();
                    onAddEventClick(time, e);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-sm text-app-text-muted hover:text-app-accent cursor-pointer opacity-0 pointer-events-none group-hover/slot:opacity-100 group-hover/slot:pointer-events-auto transition-opacity active:scale-95"
            >
                <Plus size={14} />
            </button>
        </Tooltip>
    );
};

// PC用: 1 段ぶんの TAKEN(軽減後ダメージ)。致死判定は挑発によるタンクスイッチ後の実効ターゲットで行う
const DamageTakenCell: React.FC<{
    event: TimelineEvent;
    damage: DamageInfo | null | undefined;
    partyMembers: PartyMember[];
    swapMarkers: AppliedMitigation[];
    phases: Phase[];
}> = ({ event, damage, partyMembers, swapMarkers, phases }) => {
    const { t } = useTranslation();
    if (!damage || !(damage.unmitigated > 0 || damage.isInvincible)) return null;
    const evtEff = getEffectiveTarget(event, swapMarkers, phases);
    let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
    if (evtEff === 'MT' || evtEff === 'ST') {
        maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
    }
    const isLethal = damage.mitigated >= maxHp;
    const colorClass = isLethal ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
    return (
        <>
            <AnimatedDamage value={damage.mitigated} isLethal={isLethal} className={`${colorClass} !h-[16px]`} />
            {damage.isInvincible ? (
                <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap">
                    {t('timeline.invuln', 'Invuln')}
                </div>
            ) : (damage.mitigationPercent > 0 || damage.shieldTotal > 0) ? (
                <div className="text-app-sm text-app-text-muted font-normal tracking-tighter scale-90 whitespace-nowrap hidden md:flex flex-row items-center justify-center gap-1 w-full px-1 truncate leading-none">
                    {damage.mitigationPercent > 0 && <span>▼ {damage.mitigationPercent}%</span>}
                    {damage.mitigationPercent > 0 && damage.shieldTotal > 0 && <span className="opacity-50">|</span>}
                    {damage.shieldTotal > 0 && (
                        <span className="flex items-center gap-0.5">
                            🛡️ {damage.shieldTotal.toLocaleString()}
                        </span>
                    )}
                </div>
            ) : null}
        </>
    );
};
```

- [ ] **Step 4: 攻撃列を N 段にする(416〜540 行付近)**

`{events.length === 0 ? (` の 0 件の分岐(空の行の「+」・`data-tutorial` 付き)は、そのまま残す。

`) : events.length === 1 ? (` から、攻撃列の閉じ `)}` の手前(2 件の `</>` の終わり)までを、次で置き換える。1 件の分岐・細い「+」・2 件の分岐は丸ごと削除する。

```tsx
                ) : (
                    /* 1 件以上: 攻撃 1 つ = 1 段。段を攻撃の数だけ縦に並べる(行の高さ = 1 段 × 攻撃数・各段は flex-1 で等分) */
                    events.map((event, idx) => (
                        <div key={event.id} className={clsx("flex-1 min-h-0 w-full relative group/slot", idx < events.length - 1 && showRowBorders && "border-b border-app-border")}>
                            <div
                                className="w-full h-full flex items-center px-2 gap-1 md:gap-2 cursor-pointer hover:bg-app-surface2"
                                onClick={(e) => {
                                    if (window.innerWidth < 768) {
                                        handleMobileTap(e);
                                    } else {
                                        onEventClick(event, e);
                                    }
                                }}
                            >
                                {/* 種別: PC=クリックで循環 / モバイル=表示のみ(両方とも赤箱印あり) */}
                                <PcTypeToggle event={event} />
                                <DamageTypeIcon damageType={event.damageType} ignoresDebuffMitigation={event.ignoresDebuffMitigation} size="w-3 h-3" className="md:hidden" />

                                {/* 攻撃名（省略時にネイティブツールチップ表示） */}
                                <EventNameSpan name={getEventName(event)} className="text-app-base md:text-app-lg" />

                                {/* スマホ専用: 対象バッジ */}
                                <div className="md:hidden flex-shrink-0">
                                    <MobileTargetBadge partyMembers={partyMembers} effTarget={getEffectiveTarget(event, swapMarkers, phases)} />
                                </div>

                                {/* スマホ専用: 軽減アイコン */}
                                <MobileMitiIcons
                                    mitigations={activeMitigations}
                                    contentLanguage={contentLanguage}
                                    myMemberId={myMemberId}
                                    size="w-2.5 h-2.5"
                                />

                                {/* PC専用: Target(右端固定・クリックで MT⇄ST トグル)。「+」とコピーはホバー時だけ幅を開く
                                    (非ホバー=w-0で攻撃名フル幅 / ホバー=w-16で名前が縮み「+」とコピーが重ならず収まる)。対象が無い(AoE)行は右端に出る */}
                                <div className="hidden md:flex items-center flex-shrink-0 ml-auto">
                                    <div className="w-0 overflow-hidden flex justify-start group-hover/slot:w-16 transition-[width] duration-150">
                                        <PcAddEventButton time={time} onAddEventClick={onAddEventClick} />
                                        <PcCopyButton event={event} />
                                    </div>
                                    <PcTargetToggle event={event} partyMembers={partyMembers} effTarget={getEffectiveTarget(event, swapMarkers, phases)} badgeTextClass="text-app-sm" />
                                </div>
                            </div>
                        </div>
                    ))
                )}
```

- [ ] **Step 5: RAW 列と TAKEN 列を N 段にする(555〜668 行付近)**

RAW(U.Dmg)列の中身(`{events.length === 1 ? ( … ) : ( … )}`)を、次で置き換える。

```tsx
                {events.map((event, idx) => (
                    <div key={event.id} className={clsx("flex-1 min-h-0 w-full flex items-center justify-center", idx < events.length - 1 && showRowBorders && "border-b border-app-border")}>
                        {damages[idx] && damages[idx]!.unmitigated > 0 ? formatDmg(damages[idx]!.unmitigated) : ''}
                    </div>
                ))}
```

TAKEN(Dmg)列の中身(`{events.length === 1 ? ( … ) : ( … )}`)を、次で置き換える。列の外側の div と `data-tutorial` はそのまま残す。

```tsx
                {events.map((event, idx) => (
                    <div key={event.id} className={clsx("flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-0 leading-none",
                        idx < events.length - 1 && showRowBorders && "border-b border-app-border"
                    )}>
                        <DamageTakenCell event={event} damage={damages[idx]} partyMembers={partyMembers} swapMarkers={swapMarkers} phases={phases} />
                    </div>
                ))}
```

(攻撃 0 件の行では RAW 列と TAKEN 列の中身が空になる。旧実装では 0 件でも空の 2 段と中央の罫線が出ていた。これは意図した変更)

`PcCopyButton` の上のコメントは次にする。

```ts
// PC用: コピーボタン — 「+」の右隣、対象トグルの左に同サイズ(w-6 h-6)で並べる。
// ホバー時だけ幅を開いて可視化(攻撃名はその分だけ縮む)。対象アイコンが無い(AoE)行では親の ml-auto により右端へ寄る。
```

- [ ] **Step 6: AA モードの件数制限をなくす(`Timeline.tsx` の `handleAddClick`、1879〜1903 行付近)**

置き換え前:

```ts
        if (isAaModeEnabled) {
            const existingEvents = eventsByTime.get(time) || [];
            if (existingEvents.length < 2) {
                …(addEvent して return)…
            } else {
                setIsAaModeEnabled(false);
            }
        }
```

置き換え後(同じ秒に何件あっても AA を追加する):

```ts
        if (isAaModeEnabled) {
            // 同じ秒に何件あっても AA を追加する(旧: 2 件あると AA モードを解除してモーダルを開いていた)
            const currentAaSettings = useMitigationStore.getState().aaSettings;
            const newId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9);
            useMitigationStore.getState().addEvent({
                id: newId,
                time: time,
                name: { ja: 'AA', en: 'AA' },
                damageAmount: currentAaSettings.damage,
                damageType: currentAaSettings.type,
                target: currentAaSettings.target
            });
            return;
        }
```

`useCallback` の deps `[isAaModeEnabled, eventsByTime]` を `[isAaModeEnabled]` にする。

- [ ] **Step 7: テストと型チェック**

Run: `rtk npx vitest run src/components/__tests__/TimelineRow.multiAttack.test.tsx src/components/__tests__/PcTypeToggle.test.tsx`
Expected: PASS

Run: `rtk npx tsc -b`
Expected: exit 0

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/TimelineRow.tsx src/components/Timeline.tsx src/components/__tests__/TimelineRow.multiAttack.test.tsx
# メッセージ: feat(timeline): 同じ秒の攻撃をいくつでも表示(1攻撃=1段)・攻撃セルのホバーでコピーの左に「+」・細い「+」を廃止・AAモードの件数制限を撤廃
```

---

### Task 4: FFLogs 取り込みで同じ秒の攻撃をずらさない

**Files:**
- Modify: `src/utils/fflogsMapper.ts`(406〜407 行の呼び出しと 653〜708 行の関数を削除)
- Modify: `src/utils/__tests__/fflogsMapper.test.ts`(146〜156 行のテストを置き換える + 1 件追加)
- Modify: `docs/superpowers/specs/2026-04-05-fflogs-import-v2.md`(Step 11 に廃止の注記を 1 行)

**Interfaces:**
- Consumes: なし(Task 1〜3 と独立)
- Produces: なし

- [ ] **Step 1: 失敗するテストに置き換える**

`src/utils/__tests__/fflogsMapper.test.ts` の `it('同秒イベントは最大2件に制限される', () => { … });` を、次の 2 件に置き換える:

```ts
  it('同じ秒の攻撃は 3 つ以上でもずらさず、全部その秒に残る', () => {
    const rawEn = [
      dmg(10, 100, 'A', 3, 50000), dmg(10, 100, 'A', 4, 50000), dmg(10, 100, 'A', 5, 50000),
      dmg(10, 200, 'B', 3, 60000), dmg(10, 200, 'B', 4, 60000), dmg(10, 200, 'B', 5, 60000),
      dmg(10, 300, 'C', 3, 70000), dmg(10, 300, 'C', 4, 70000), dmg(10, 300, 'C', 5, 70000),
    ];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    const names = r.events.filter(e => e.time === 10).map(e => e.name.en).sort();
    expect(names).toEqual(['A', 'B', 'C']);
    expect(r.events.some(e => e.time === 11)).toBe(false);
  });

  it('タンクへの攻撃と全体攻撃が同じ秒でも、全体攻撃をずらさない', () => {
    // Tank1 にAAを多く打たせてMT判定
    const aaHits = Array.from({ length: 10 }, (_, i) => dmg(i, 999, 'Attack', 1, 5000));
    const tbHit = dmg(15, 200, 'Tankbuster', 1, 120000);
    const aoe = [3, 4, 5, 6].map(id => dmg(15, 100, 'Megaflare', id, 80000));
    const r = mapFFLogsToTimeline([...aaHits, tbHit, ...aoe], [], makeFight(), [], [], [], makePlayers());
    const tb = r.events.find(e => e.name.en.includes('Tankbuster'));
    const mf = r.events.find(e => e.name.en === 'Megaflare');
    expect(tb!.time).toBe(15);
    expect(mf!.time).toBe(15);
  });
```

- [ ] **Step 2: 失敗を確認する**

Run: `rtk npx vitest run src/utils/__tests__/fflogsMapper.test.ts`
Expected: FAIL(3 つ目が 11 秒へずれている / Megaflare が 16 秒へずれている)

- [ ] **Step 3: ずらし処理を削除する**

`src/utils/fflogsMapper.ts`:
- 次の 2 行(と前の空行 1 行)を削除する。以降の Step 番号のコメントは変えない。

  ```ts
      // ── Step 8: スケジューリング（同秒競合解消） ──
      resolveSchedulingConflicts(tl);
  ```
- `/** 同秒競合を解消（V5.0） */` から `function resolveSchedulingConflicts` の終わりの `}` までを、丸ごと削除する(`/** フェーズ自動生成（V5.1: report.phasesからボス名取得） */` の直前まで)。

`docs/superpowers/specs/2026-04-05-fflogs-import-v2.md` の `### Step 11: スケジューリング（現行維持）` の直後の行に、次の 1 行を追加する。

```md
> **2026-09-26 廃止**: 同じ秒に 3 つ以上の攻撃を表示できるようになったため、ずらしをやめて本当の秒のまま取り込む(`docs/superpowers/specs/2026-09-26-multi-attack-rows-design.md`)。
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `rtk npx vitest run src/utils/__tests__/fflogsMapper.test.ts src/lib/fflogs/__tests__/fetchAndMapFflogs.test.ts`
Expected: PASS(全件)

Run: `rtk npx tsc -b`
Expected: exit 0

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/fflogsMapper.ts src/utils/__tests__/fflogsMapper.test.ts docs/superpowers/specs/2026-04-05-fflogs-import-v2.md
# メッセージ: feat(fflogs): 同じ秒の攻撃をずらさず本当の秒のまま取り込む(同秒3つ以上・タンク攻撃+全体・全体+AAのずらしを廃止)
```

---

### Task 5: 公開前のゲートと画面での確認(司令塔が実施)

**Files:** なし(確認用のスクリプトは scratchpad に置き、リポジトリには入れない)

- [ ] **Step 1: build と全件テスト**

Run: `rtk npm run build` → Expected: exit 0
Run: `rtk npx vitest run` → Expected: 全件 PASS(件数を記録する)
Run: `rtk npx eslint src/components/Timeline.tsx src/components/TimelineRow.tsx src/components/MobileTimelineRow.tsx src/components/timeline/rowLayout.ts` → Expected: エラー 0

- [ ] **Step 2: 画面での確認(Playwright・dev サーバー)**

PC(1489×679):
1. 同じ秒に攻撃を 3 つ置く(攻撃セルのホバーで出る「+」から追加する)。確認すること:
   - その行の高さが 75px
   - 3 つの名前・RAW・TAKEN が段ごとに出る
2. 攻撃 1 つの行の高さが 25px で、細い「+」が無い。
3. 軽減アイコンを 3 攻撃の行の上へドラッグし、アイコン中央がある行の秒に落ちる(ドロップ後の時刻を確認する)。
4. 効果の最後の秒が 3 攻撃の行になる軽減で、帯の下端がその行の下端 − 1px に来る。
5. 帯をクリックし、クリック位置を含む行の秒に配置メニューが出る。
6. 空の行を隠す ON / OFF の両方で、1〜5 に崩れが無い。

スマホ(390×844):
1. 同じ秒に 3 攻撃あるとき、カードが 3 枚並び、表の一番下の行までスクロールで届く。
2. 2 枚目・3 枚目のカードを長押しすると、そのカードの攻撃名のメニューが開く。

- [ ] **Step 3: ユーザーのローカル確認**

dev サーバーの URL を渡して、次を見てもらう。
- 行の高さ(1 段 25px)と軽減アイコンの大きさ(24px): 変えるなら `ROW_UNIT_PX.pc` / `MITI_ICON_PX` の 1 か所
- 「+」の出方
- 3 つ以上の行の見え方

OK が出てから main へマージ → push(Vercel 自動デプロイ)→ ユーザーに Cloudflare「Purge Everything」を依頼する。
