import { describe, it, expect, beforeEach } from 'vitest';
import { useMitigationStore } from '../useMitigationStore';
import type { AppliedMitigation, PartyMember } from '../../types';

/**
 * 展開戦術(copiesShield: 'adloquium')の自動リンク解決 (resolveShieldLinks) が、
 * セラフィズム中に鼓舞激励の策から自動変化した「マニフェステーション」のバリアも
 * コピー元として認識することの回帰テスト。
 *
 * マニフェステーションは鼓舞激励の策と同じ「鼓舞」状態を付与するため、展開戦術の
 * コピー対象になるべき(公式仕様確認済み)。MitigationSelector/mitigationTapResolver 側の
 * 候補一覧は既に対応済みだったが、store 内の resolveShieldLinks が別実装で追従しておらず、
 * リンクしても直後に「リンク解除」されてしまう不具合があった。
 */
describe('useMitigationStore: resolveShieldLinks (展開戦術の自動リンク)', () => {
    const manifestation = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
        id: 'manifest1', mitigationId: 'manifestation', time: 10, duration: 30, ownerId: 'H1', targetId: 'MT', ...over,
    });
    const deploymentTactics = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
        id: 'deploy1', mitigationId: 'deployment_tactics', time: 15, duration: 30, ownerId: 'H1', ...over,
    });

    beforeEach(() => {
        useMitigationStore.setState({
            timelineMitigations: [],
            timelineEvents: [],
            phases: [],
            labels: [],
            memos: [],
            partyMembers: [
                { id: 'H1', jobId: 'sch', role: 'healer', stats: {}, computedValues: {} } as unknown as PartyMember,
            ],
            _collabActive: false,
            _collabHandlers: null,
            _collabReadonly: false,
        });
    });

    it('マニフェステーションが唯一の有効なバリアなら展開戦術が自動リンクされる', () => {
        useMitigationStore.getState().addMitigation(manifestation());
        useMitigationStore.getState().addMitigation(deploymentTactics());

        const deploy = useMitigationStore.getState().timelineMitigations.find(m => m.id === 'deploy1');
        expect(deploy?.linkedMitigationId).toBe('manifest1');
    });

    it('マニフェステーションへのリンクは resolveShieldLinks の再実行後も解除されない', () => {
        useMitigationStore.getState().addMitigation(manifestation());
        useMitigationStore.getState().addMitigation(deploymentTactics());
        // 無関係な操作(別の軽減の追加)で resolveShieldLinks が再実行されても、リンクは維持される
        useMitigationStore.getState().addMitigation({ id: 'other1', mitigationId: 'aetherflow', time: 5, duration: 1, ownerId: 'H1' });

        const deploy = useMitigationStore.getState().timelineMitigations.find(m => m.id === 'deploy1');
        expect(deploy?.linkedMitigationId).toBe('manifest1');
    });
});
