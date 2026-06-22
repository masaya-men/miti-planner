import { describe, it, expect } from 'vitest';
import { isHiddenFromCheatSheet, filterCheatSheetMitigations } from '../cheatSheetFilters';

describe('isHiddenFromCheatSheet (カンペ除外判定)', () => {
    it('挑発(isTankSwap)は除外する', () => {
        expect(isHiddenFromCheatSheet({ id: 'provoke_pld', isTankSwap: true })).toBe(true);
        expect(isHiddenFromCheatSheet({ id: 'provoke_war', isTankSwap: true })).toBe(true);
    });

    it('エーテルフロー・アストラルドロー・アンブラルドローは除外する', () => {
        expect(isHiddenFromCheatSheet({ id: 'aetherflow' })).toBe(true);
        expect(isHiddenFromCheatSheet({ id: 'astral_draw' })).toBe(true);
        expect(isHiddenFromCheatSheet({ id: 'umbral_draw' })).toBe(true);
    });

    it('通常の軽減スキルは除外しない(表示する)', () => {
        expect(isHiddenFromCheatSheet({ id: 'reprisal' })).toBe(false);
        expect(isHiddenFromCheatSheet({ id: 'rampart', isTankSwap: false })).toBe(false);
        expect(isHiddenFromCheatSheet({ id: 'kerachole' })).toBe(false);
    });
});

describe('filterCheatSheetMitigations (カンペ表示用の置き軽減フィルタ)', () => {
    const defs: Record<string, { id: string; isTankSwap?: boolean }> = {
        provoke_pld: { id: 'provoke_pld', isTankSwap: true },
        aetherflow: { id: 'aetherflow' },
        astral_draw: { id: 'astral_draw' },
        umbral_draw: { id: 'umbral_draw' },
        reprisal: { id: 'reprisal' },
        kerachole: { id: 'kerachole' },
    };
    const findDef = (id: string) => defs[id];

    it('挑発・エーテルフロー・ドロー系を除き、通常軽減だけ残す', () => {
        const placed = [
            { id: 'p1', mitigationId: 'provoke_pld' },
            { id: 'p2', mitigationId: 'aetherflow' },
            { id: 'p3', mitigationId: 'astral_draw' },
            { id: 'p4', mitigationId: 'umbral_draw' },
            { id: 'p5', mitigationId: 'reprisal' },
            { id: 'p6', mitigationId: 'kerachole' },
        ];
        const result = filterCheatSheetMitigations(placed, findDef);
        expect(result.map(r => r.mitigationId)).toEqual(['reprisal', 'kerachole']);
    });

    it('マスターに無い(def 未解決)スキルは残す(従来挙動・icon 側で null 描画)', () => {
        const placed = [{ id: 'x', mitigationId: 'unknown_skill' }];
        expect(filterCheatSheetMitigations(placed, findDef)).toHaveLength(1);
    });
});
