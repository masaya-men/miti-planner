import { describe, it, expect } from 'vitest';
import { timeSecToY, yToTimeSec, pxToXRatio, xRatioToPx, clampXRatio, reanchorScrollTop } from '../coords';

describe('Memo coords (動的高さ対応)', () => {
    // 想定 timeToYMap: { 0: 0, 10: 100, 11: 130, 12: 200, 20: 300 }
    // = 行高さが場所により異なる (10秒→11秒は30px、 11秒→12秒は70px、 12秒→20秒は12.5px/秒)
    const map = new Map<number, number>([
        [0, 0],
        [10, 100],
        [11, 130],
        [12, 200],
        [20, 300],
    ]);

    describe('timeSecToY', () => {
        it('map に直接ある time の y を返す', () => {
            expect(timeSecToY(0, map)).toBe(0);
            expect(timeSecToY(10, map)).toBe(100);
            expect(timeSecToY(12, map)).toBe(200);
        });
        it('隣接 time の間は線形補間', () => {
            expect(timeSecToY(10.5, map)).toBe(115);  // 100 + 0.5/1 * 30 = 115
            expect(timeSecToY(11.5, map)).toBe(165);  // 130 + 0.5/1 * 70 = 165
        });
        it('範囲外は端の y にクランプ', () => {
            expect(timeSecToY(-5, map)).toBe(0);
            expect(timeSecToY(999, map)).toBe(300);
        });
    });

    describe('yToTimeSec', () => {
        it('map に直接ある y の time を返す', () => {
            expect(yToTimeSec(0, map)).toBe(0);
            expect(yToTimeSec(100, map)).toBe(10);
            expect(yToTimeSec(200, map)).toBe(12);
        });
        it('隣接 y の間は線形補間', () => {
            expect(yToTimeSec(115, map)).toBe(10.5);
            expect(yToTimeSec(165, map)).toBe(11.5);
        });
        it('範囲外は null (= メモ作成不可)', () => {
            expect(yToTimeSec(-5, map)).toBeNull();
            expect(yToTimeSec(999, map)).toBeNull();
        });
        it('round-trip (timeSecToY → yToTimeSec)', () => {
            const t = 11.5;
            const y = timeSecToY(t, map);
            expect(yToTimeSec(y, map)).toBeCloseTo(t);
        });
    });

    describe('pxToXRatio / xRatioToPx', () => {
        it('px=0 → xRatio=0', () => expect(pxToXRatio(0, 800)).toBe(0));
        it('px=width → xRatio=1', () => expect(pxToXRatio(800, 800)).toBe(1));
        it('widthPx<=0 ガード', () => expect(pxToXRatio(100, 0)).toBe(0));
        it('xRatio=0.5 → 半分', () => expect(xRatioToPx(0.5, 800)).toBe(400));
        it('round-trip', () => {
            const r = 0.37;
            expect(pxToXRatio(xRatioToPx(r, 800), 800)).toBeCloseTo(r);
        });
    });

    describe('clampXRatio', () => {
        it('範囲内はそのまま', () => expect(clampXRatio(0.5)).toBe(0.5));
        it('負はクランプ 0', () => expect(clampXRatio(-0.2)).toBe(0));
        it('1 超はクランプ 1', () => expect(clampXRatio(1.5)).toBe(1));
    });

    describe('reanchorScrollTop (展開/折りたたみのアンカー維持)', () => {
        it('同じ時刻が高さ変化後もビューポート中央に来る scrollTop を返す', () => {
            // 折りたたみ時は時刻20が y300、展開時は y600 (高さ倍) になる想定
            const folded = new Map<number, number>([[0, 0], [20, 300]]);
            const expanded = new Map<number, number>([[0, 0], [20, 600]]);
            // 時刻10をビューポート中央 (clientHeight=200) に置く scrollTop
            expect(reanchorScrollTop(10, folded, 200)).toBe(50);    // 150 - 100
            expect(reanchorScrollTop(10, expanded, 200)).toBe(200); // 300 - 100
        });
        it('上端付近は 0 にクランプ', () => {
            const map = new Map<number, number>([[0, 0], [20, 600]]);
            expect(reanchorScrollTop(0, map, 200)).toBe(0); // -100 → 0
        });
    });
});
