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
    it('lanesSheetWidth は表示域幅(列の合計幅は使わない)。未計測なら fallback', () => {
        expect(lanesSheetWidth(1188, 1)).toBe(1188);
        expect(lanesSheetWidth(0, 321)).toBe(321);
    });
    it('表示域が広くても、レーン→スプシ→レーンで同じジョブ列の中に戻る(H1 の列に置いたメモ)', () => {
        const wide = lanesSheetWidth(1500, 1);
        const xRatio = (726.8 + 40) / wide; // レーン表示で H1 列の内側に置いたメモ(分母 = 表示域幅)
        const sheetPx = convertMemberX(xRatio * wide, lanes, sheet);
        expect(sheetPx).toBeGreaterThanOrEqual(sheet[1].left);
        expect(sheetPx).toBeLessThan(sheet[1].left + sheet[1].width);
        expect(convertMemberX(sheetPx, sheet, lanes) / wide).toBeCloseTo(xRatio, 6);
    });
    describe('8 人: 列の合計が表示域より広い/狭いの両方で、レーン→スプシ→レーンが同じジョブ列に戻る', () => {
        const members = ['MT', 'H1', 'D1', 'D3', 'ST', 'H2', 'D2', 'D4'].map((id, i) =>
            mk(id, i === 0 || i === 4 ? 'tank' : i === 1 || i === 5 ? 'healer' : 'dps'));
        const lanes8 = lanesBands(members, 570, 151, 53, 2.9);
        // スプシ側: 列数が違う(MT 13 列・H1 11 列・…)
        const counts = [13, 11, 4, 2, 12, 19, 1, 1];
        let left = 570;
        const sheet8 = members.map((m, i) => { const b = { id: m.id, left, width: counts[i] * 28 }; left += b.width; return b; });
        // 実機 1489 幅(容器 1188・列の合計 1432)と、広い画面(容器 2260・列の合計 1432)
        for (const viewport of [1188, 2260]) {
            it(`容器 ${viewport}px: レーンで置いた位置の列 = スプシで出る列 = 戻った列`, () => {
                const w = lanesSheetWidth(viewport, 1);
                for (const b of lanes8) {
                    if (b.left + b.width / 2 >= viewport) continue; // 容器の外は xRatio が 1 を超えて置けない(レーン表示でも同じ)
                    const x = b.left + b.width / 2;
                    const ratio = x / w; // レーン表示で保存される xRatio
                    const sx = convertMemberX(ratio * w, lanes8, sheet8);
                    const sb = sheet8.find(s => s.id === b.id)!;
                    expect(sx).toBeGreaterThanOrEqual(sb.left);
                    expect(sx).toBeLessThan(sb.left + sb.width);
                    const back = convertMemberX(sx, sheet8, lanes8) / w;
                    expect(back * w).toBeGreaterThanOrEqual(b.left);
                    expect(back * w).toBeLessThan(b.left + b.width);
                }
            });
        }
        it('従来の分母(列の合計 1432)だと MT の列のメモが別の列に出ていた(回帰の根拠)', () => {
            const oldW = Math.max(lanes8[lanes8.length - 1].left + lanes8[lanes8.length - 1].width, 1188);
            const ratio = (lanes8[0].left + 80) / 1188; // 実際の保存値(容器 1188 基準)
            const sx = convertMemberX(ratio * oldW, lanes8, sheet8);
            const sb = sheet8.find(s => s.id === 'MT')!;
            expect(sx >= sb.left && sx < sb.left + sb.width).toBe(false);
        });
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
