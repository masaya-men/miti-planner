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
