import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';

/**
 * パーティ表示/非表示スイッチ(2026-08-19)。hideEmptyRows 等と同じ「見た目だけのブラウザ設定」
 * パターン: toggle で ON/OFF、共同編集の同期対象には一切含まれない(store 内で
 * _collabHandlers 等に触れないことを toggle の実装自体で保証)。
 */
describe('useMitigationStore: hiddenPartyMemberIds (表示/非表示スイッチ)', () => {
    beforeEach(() => {
        useMitigationStore.setState({ hiddenPartyMemberIds: [] });
    });

    it('初期状態は空配列(全員表示)', () => {
        expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]);
    });

    it('toggleHiddenPartyMember でメンバーIDを追加できる', () => {
        useMitigationStore.getState().toggleHiddenPartyMember('H1');
        expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual(['H1']);
    });

    it('もう一度呼ぶと解除される(トグル)', () => {
        useMitigationStore.getState().toggleHiddenPartyMember('H1');
        useMitigationStore.getState().toggleHiddenPartyMember('H1');
        expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]);
    });

    it('複数メンバーを独立に非表示にできる', () => {
        useMitigationStore.getState().toggleHiddenPartyMember('MT');
        useMitigationStore.getState().toggleHiddenPartyMember('D3');
        const ids = useMitigationStore.getState().hiddenPartyMemberIds;
        expect(ids).toContain('MT');
        expect(ids).toContain('D3');
        expect(ids).toHaveLength(2);
    });
});
