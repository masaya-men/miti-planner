import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingTagPickerStore } from '../../store/useHousingTagPickerStore';

describe('useHousingTagPickerStore', () => {
    beforeEach(() => {
        useHousingTagPickerStore.setState({ pendingTags: [], lastSyncedCommitted: null });
    });

    it('初期状態は空・未同期', () => {
        const s = useHousingTagPickerStore.getState();
        expect(s.pendingTags).toEqual([]);
        expect(s.lastSyncedCommitted).toBeNull();
    });

    it('syncFromCommitted で pendingTags を確定値から初期化し lastSyncedCommitted を記録する', () => {
        useHousingTagPickerStore.getState().syncFromCommitted(['theme_wafu', 'personal_taro']);
        const s = useHousingTagPickerStore.getState();
        expect(s.pendingTags).toEqual(['theme_wafu', 'personal_taro']);
        expect(s.lastSyncedCommitted).toEqual(['theme_wafu', 'personal_taro']);
    });

    it('toggleTag で追加/削除をトグルする', () => {
        const s = useHousingTagPickerStore.getState();
        s.toggleTag('theme_wafu');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['theme_wafu']);
        s.toggleTag('theme_wafu');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual([]);
    });

    it('clearPending は pendingTags を空にするが lastSyncedCommitted は保つ', () => {
        const s = useHousingTagPickerStore.getState();
        s.syncFromCommitted(['theme_wafu']);
        s.clearPending();
        const after = useHousingTagPickerStore.getState();
        expect(after.pendingTags).toEqual([]);
        expect(after.lastSyncedCommitted).toEqual(['theme_wafu']);
    });

    it('syncFromCommitted は呼ばれるたびに常に上書きする (呼び出し側が差分ガードを持つ規約)', () => {
        const s = useHousingTagPickerStore.getState();
        s.syncFromCommitted(['a']);
        s.toggleTag('b');
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['a', 'b']);
        s.syncFromCommitted(['c']);
        expect(useHousingTagPickerStore.getState().pendingTags).toEqual(['c']);
        expect(useHousingTagPickerStore.getState().lastSyncedCommitted).toEqual(['c']);
    });
});
