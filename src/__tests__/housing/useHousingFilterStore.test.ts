import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingFilterStore } from '../../store/useHousingFilterStore';

describe('useHousingFilterStore', () => {
    beforeEach(() => useHousingFilterStore.getState().clearAll());

    it('defaults to empty filters', () => {
        const s = useHousingFilterStore.getState();
        expect(s.dc).toBeNull();
        expect(s.regions).toEqual([]);
        expect(s.servers).toEqual([]);
        expect(s.areas).toEqual([]);
        expect(s.sizes).toEqual([]);
        expect(s.tags).toEqual([]);
        expect(s.resultCount).toBe(0);
        expect(s.totalCount).toBe(0);
    });

    it('sets DC (single select)', () => {
        useHousingFilterStore.getState().setDC('Mana');
        expect(useHousingFilterStore.getState().dc).toBe('Mana');
    });

    it('setDC で DC が変わったら servers をクリアする (残留フィルタバグの根治)', () => {
        const s = useHousingFilterStore.getState();
        // 地図モードのゲート相当: DC を選び、その配下のワールドを1件に絞る
        s.setDC('Mana');
        s.setServerExclusive('Anima');
        expect(useHousingFilterStore.getState().servers).toEqual(['Anima']);

        // 一覧に戻り DC=すべて (null) にすると servers も消える → 裏で絞り続けない
        s.setDC(null);
        expect(useHousingFilterStore.getState().dc).toBeNull();
        expect(useHousingFilterStore.getState().servers).toEqual([]);
    });

    it('setDC で別 DC に変えても servers をクリアする', () => {
        const s = useHousingFilterStore.getState();
        s.setDC('Mana');
        s.setServerExclusive('Anima');
        s.setDC('Gaia');
        expect(useHousingFilterStore.getState().dc).toBe('Gaia');
        expect(useHousingFilterStore.getState().servers).toEqual([]);
    });

    it('setDC で同じ DC を再指定したときは servers を保持する (地図ゲートの setDC→setServerExclusive 手順を壊さない)', () => {
        const s = useHousingFilterStore.getState();
        s.setDC('Mana');
        s.toggleServer('Anima');
        s.toggleServer('Asura');
        expect(useHousingFilterStore.getState().servers).toEqual(['Anima', 'Asura']);
        s.setDC('Mana');
        expect(useHousingFilterStore.getState().servers).toEqual(['Anima', 'Asura']);
    });

    it('toggles area (multi select)', () => {
        const s = useHousingFilterStore.getState();
        s.toggleArea('Shirogane');
        expect(useHousingFilterStore.getState().areas).toEqual(['Shirogane']);
        s.toggleArea('LavenderBeds');
        expect(useHousingFilterStore.getState().areas).toEqual(['Shirogane', 'LavenderBeds']);
        s.toggleArea('Shirogane');
        expect(useHousingFilterStore.getState().areas).toEqual(['LavenderBeds']);
    });

    it('clearAll resets filters but keeps result/total counts intact', () => {
        const s = useHousingFilterStore.getState();
        s.setDC('Mana');
        s.toggleArea('Shirogane');
        s.setCounts(37, 300);
        s.clearAll();
        expect(useHousingFilterStore.getState().dc).toBeNull();
        expect(useHousingFilterStore.getState().areas).toEqual([]);
        expect(useHousingFilterStore.getState().resultCount).toBe(37);
        expect(useHousingFilterStore.getState().totalCount).toBe(300);
    });
});
