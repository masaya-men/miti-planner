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
        expect(s.keyword).toBe('');
        expect(s.resultCount).toBe(0);
        expect(s.totalCount).toBe(0);
    });

    it('setKeyword updates keyword', () => {
        useHousingFilterStore.getState().setKeyword('cafe');
        expect(useHousingFilterStore.getState().keyword).toBe('cafe');
    });

    it('clearAll resets keyword to empty', () => {
        const s = useHousingFilterStore.getState();
        s.setKeyword('cafe');
        s.clearAll();
        expect(useHousingFilterStore.getState().keyword).toBe('');
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

describe('言語別の地域初期値', () => {
    // 注: clearAll は regions を localeDefaultRegions に戻し touched を false にする
    // (=言語既定への復帰)。テストの前提を明示的に固定するため直接 setState でもリセットする。
    beforeEach(() => useHousingFilterStore.getState().clearAll());
    it('ko は KR、zh は CN、ja/en は全グローバル', () => {
        useHousingFilterStore.setState({ regions: [], regionsTouched: false });
        useHousingFilterStore.getState().applyLocaleDefaultRegions('ko');
        expect(useHousingFilterStore.getState().regions).toEqual(['KR']);
        useHousingFilterStore.setState({ regions: [], regionsTouched: false });
        useHousingFilterStore.getState().applyLocaleDefaultRegions('ja');
        expect(useHousingFilterStore.getState().regions).toEqual(['JP', 'NA', 'EU', 'OCE']);
    });
    it('ユーザーが触った後は言語切替で上書きしない', () => {
        useHousingFilterStore.setState({ regions: [], regionsTouched: false });
        useHousingFilterStore.getState().toggleRegion('JP');
        useHousingFilterStore.getState().applyLocaleDefaultRegions('ko');
        expect(useHousingFilterStore.getState().regions).toEqual(['JP']);
    });
});

describe('クリア = 言語既定への復帰 (regionsTouched の往復)', () => {
    beforeEach(() => useHousingFilterStore.getState().clearAll());

    it('clearAll 後は regions=言語既定・touched=false (hasActiveFilter が false に戻る)', () => {
        const s = useHousingFilterStore.getState();
        s.applyLocaleDefaultRegions('ko'); // localeDefaultRegions = ['KR'], regions = ['KR']
        s.toggleRegion('JP'); // ユーザー操作 → touched=true, regions = ['KR', 'JP']
        s.setDC('Mana');
        expect(useHousingFilterStore.getState().regions).toEqual(['KR', 'JP']);
        expect(useHousingFilterStore.getState().regionsTouched).toBe(true);

        s.clearAll();
        const after = useHousingFilterStore.getState();
        expect(after.regions).toEqual(['KR']); // 言語既定 (localeDefaultRegions) へ復帰
        expect(after.regionsTouched).toBe(false);
        expect(after.dc).toBeNull();
    });

    it('チップ全外し (toggleRegion で空にする) では touched=true のまま (自動では言語既定に戻らない)', () => {
        const s = useHousingFilterStore.getState();
        s.applyLocaleDefaultRegions('ja'); // regions = ['JP', 'NA', 'EU', 'OCE']
        for (const region of ['JP', 'NA', 'EU', 'OCE']) {
            s.toggleRegion(region);
        }
        const after = useHousingFilterStore.getState();
        expect(after.regions).toEqual([]);
        expect(after.regionsTouched).toBe(true);
    });
});
