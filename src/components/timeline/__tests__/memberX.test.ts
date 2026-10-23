import { describe, it, expect } from 'vitest';
import { convertMemberX, lanesBands, sheetBands, lanesSheetWidth, memoCreateXRatio } from '../sheet/memberX';
import type { PartyMember } from '../../../types';

const lanes = [{ id: 'MT', left: 570, width: 156.8 }, { id: 'H1', left: 726.8, width: 156.8 }];
const sheet = [{ id: 'MT', left: 570, width: 28 * 13 }, { id: 'H1', left: 934, width: 28 * 14 }];

const mk = (id: string, role: string) => ({ id, role }) as unknown as PartyMember;

describe('memberX', () => {
    it('帯の中は同じ割合に移る', () => {
        expect(convertMemberX(726.8 + 78.4, lanes, sheet)).toBeCloseTo(934 + 196, 6);
    });
    it('帯の外(左の情報列)はそのまま', () => {
        expect(convertMemberX(100, lanes, sheet)).toBe(100);
    });
    it('相手側に無い帯(非表示)はそのまま', () => {
        expect(convertMemberX(726.8 + 10, lanes, [sheet[0]])).toBe(736.8);
    });
    it('往復で元に戻る', () => {
        expect(convertMemberX(convertMemberX(600, lanes, sheet), sheet, lanes)).toBeCloseTo(600, 6);
    });
    it('lanesBands は getColumnCssVar と同じ幅(T/H 151+5.8、DPS 53+5.8)', () => {
        const b = lanesBands([mk('MT', 'tank'), mk('H1', 'healer'), mk('D1', 'dps')], 570, 151, 53, 2.9);
        expect(b[0]).toEqual({ id: 'MT', left: 570, width: 156.8 });
        expect(b[1].left).toBeCloseTo(726.8, 6);
        expect(b[1].width).toBeCloseTo(156.8, 6);
        expect(b[2].left).toBeCloseTo(883.6, 6);
        expect(b[2].width).toBeCloseTo(58.8, 6);
    });
    it('sheetBands は memberLayout が無いメンバーを飛ばす', () => {
        const b = sheetBands([mk('MT', 'tank'), mk('H1', 'healer')], new Map([['H1', { left: 5, width: 7 }]]));
        expect(b).toEqual([{ id: 'H1', left: 5, width: 7 }]);
    });
    it('lanesSheetWidth は最後の帯の右端、無ければ fallback', () => {
        expect(lanesSheetWidth(lanes, 1)).toBeCloseTo(883.6, 6);
        expect(lanesSheetWidth([], 321)).toBe(321);
    });
    it('lanesSheetWidth は表示域のほうが広ければ表示域幅(表が min-w-full で伸びる)', () => {
        expect(lanesSheetWidth(lanes, 1, 1500)).toBe(1500);
        expect(lanesSheetWidth(lanes, 1, 500)).toBeCloseTo(883.6, 6);
    });
    it('表示域が広くても、レーン→スプシ→レーンで同じジョブ列の中に戻る(H1 の列に置いたメモ)', () => {
        const wide = lanesSheetWidth(lanes, 1, 1500); // 1500 > 最後の列の右端 883.6
        const xRatio = (726.8 + 40) / wide; // レーン表示で H1 列の内側に置いたメモ(分母 = 表示域幅)
        const sheetPx = convertMemberX(xRatio * wide, lanes, sheet);
        expect(sheetPx).toBeGreaterThanOrEqual(sheet[1].left);
        expect(sheetPx).toBeLessThan(sheet[1].left + sheet[1].width);
        expect(convertMemberX(sheetPx, sheet, lanes) / wide).toBeCloseTo(xRatio, 6);
    });
    it('null の帯(レーン表示)では x のまま', () => {
        expect(convertMemberX(700, [], sheet)).toBe(700);
    });
    it('レーン表示のメモ作成は rect.width 基準(sheetWidth や列変換を使わない)', () => {
        expect(memoCreateXRatio(400, 800, false, () => 999)).toBe(0.5);
    });
    it('スプシ表示のメモ作成は列変換を使う', () => {
        expect(memoCreateXRatio(400, 800, true, () => 0.25)).toBe(0.25);
    });
});
