import { describe, it, expect } from 'vitest';
import { isHiddenFromCheatSheet } from '../cheatSheetFilters';

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
