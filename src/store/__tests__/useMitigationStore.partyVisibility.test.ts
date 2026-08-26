import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { PlanData } from '../../types';

function snapshot(overrides: Partial<PlanData> = {}): PlanData {
    return {
        currentLevel: 100,
        timelineEvents: [],
        timelineMitigations: [],
        phases: [],
        labels: [],
        partyMembers: [],
        aaSettings: { damage: 0, type: 'physical', target: 'MT' },
        schAetherflowPatterns: {},
        ...overrides,
    } as PlanData;
}

/**
 * パーティ表示/非表示スイッチ(2026-08-19)。hideEmptyRows 等と同じ「見た目だけのブラウザ設定」
 * パターン: toggle で ON/OFF、共同編集の同期対象には一切含まれない(store 内で
 * _collabHandlers 等に触れないことを toggle の実装自体で保証)。
 *
 * 2026-08-26: 当初「ブラウザ全体で1個・プランをまたいで保持」する仕様だったが、
 * 別プランや無関係な共同編集ルームにまで前の設定が意図せず持ち込まれる不具合と判明。
 * プランごとに独立して記憶する(PlanData の一部として保存)仕様に変更、
 * 共同編集ルーム入室時は必ずリセットする仕様は維持。
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

    describe('プランごとの独立性(2026-08-26修正の回帰テスト)', () => {
        beforeEach(() => {
            useMitigationStore.setState({
                _collabActive: false,
                hiddenPartyMemberIds: [],
                timelineSortOrder: 'light_party',
            });
        });

        it('あるプランで非表示にした状態のまま、別プランを開くと持ち越されない(未マイグレプラン=フィールド無し)', () => {
            useMitigationStore.getState().toggleHiddenPartyMember('H1');
            expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual(['H1']);

            useMitigationStore.getState().loadSnapshot(snapshot(), 'plan-B');
            expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]);
            expect(useMitigationStore.getState().timelineSortOrder).toBe('light_party');
        });

        it('プラン自身が保存済みの表示設定を持っていれば、それを復元する', () => {
            useMitigationStore.getState().loadSnapshot(
                snapshot({ hiddenPartyMemberIds: ['D3', 'D4'], timelineSortOrder: 'role' }),
                'plan-C'
            );
            expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual(['D3', 'D4']);
            expect(useMitigationStore.getState().timelineSortOrder).toBe('role');
        });

        it('getSnapshot() が現在の表示設定をプランデータの一部として含む(保存対象)', () => {
            useMitigationStore.getState().toggleHiddenPartyMember('ST');
            useMitigationStore.getState().setTimelineSortOrder('role');
            const data = useMitigationStore.getState().getSnapshot();
            expect(data.hiddenPartyMemberIds).toEqual(['ST']);
            expect(data.timelineSortOrder).toBe('role');
        });

        it('共同編集ルーム入室(enterCollabMode)は、自分のプランの設定を持ち込まず必ずリセットする', () => {
            useMitigationStore.getState().toggleHiddenPartyMember('H2');
            useMitigationStore.getState().setTimelineSortOrder('role');
            useMitigationStore.getState().enterCollabMode({} as never);
            expect(useMitigationStore.getState().hiddenPartyMemberIds).toEqual([]);
            expect(useMitigationStore.getState().timelineSortOrder).toBe('light_party');
            useMitigationStore.getState().exitCollabMode();
        });
    });
});
