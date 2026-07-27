import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';

describe('useHousingTagPickerStore', () => {
    beforeEach(() => {
        useHousingTagPickerStore.setState({ pendingTags: [], initialized: false });
    });

    it('初期状態は空・未初期化', () => {
        const s = useHousingTagPickerStore.getState();
        expect(s.pendingTags).toEqual([]);
        expect(s.initialized).toBe(false);
    });

    it('syncFromCommitted で pendingTags を確定値から初期化し initialized=true にする', () => {
        useHousingTagPickerStore.getState().syncFromCommitted(['theme_wafu', 'personal_taro']);
        const s = useHousingTagPickerStore.getState();
        expect(s.pendingTags).toEqual(['theme_wafu', 'personal_taro']);
        expect(s.initialized).toBe(true);
    });

    it('toggleTag で追加/削除をトグルする', () => {
        const s = useHousingTagPickerStore.getState();
        s.toggleTag('theme_wafu');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
        s.toggleTag('theme_wafu');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual([]);
    });

    it('clearPending は pendingTags を空にするが initialized は保つ', () => {
        const s = useHousingTagPickerStore.getState();
        s.syncFromCommitted(['theme_wafu']);
        s.clearPending();
        const after = useHousingTagPickerStore.getState();
        expect(after.pendingTags).toEqual([]);
        expect(after.initialized).toBe(true);
    });

    it('syncFromCommitted は呼ばれるたびに常に上書きする (呼び出し側が !initialized ガードを持つ規約)', () => {
        const s = useHousingTagPickerStore.getState();
        s.syncFromCommitted(['a']);
        s.toggleTag('b');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['a', 'b']);
        s.syncFromCommitted(['c']);
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['c']);
    });
});
