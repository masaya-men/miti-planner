import { describe, it, expect } from 'vitest';
import { groupAndCapMitigations } from '../MobileTimelineRow';
import type { AppliedMitigation } from '../../types';

const applied = (over: Partial<AppliedMitigation> = {}): AppliedMitigation => ({
    id: 'x1', mitigationId: 'rampart_pld', time: 30, duration: 20, ownerId: 'MT', ...over,
});

/**
 * 表示/非表示スイッチ(2026-08-19): 非表示にしたメンバーの軽減アイコンは、モバイルの
 * 「入りきる/あふれる」グルーピングから完全に除外される。既知のスロットIDである以上、
 * 「+N」あふれ扱い(orphan)には絶対に混ざらないことを確認する回帰テスト
 * (混ざると、隠したはずのメンバーのスキル名が「+N」タップ展開時に見えてしまうバグになる)。
 */
describe('groupAndCapMitigations: 表示/非表示スイッチとの連携', () => {
    it('visibleMemberIds 省略時は全員分そのままグルーピングされる(既存挙動)', () => {
        const mits = [applied({ id: 'a', ownerId: 'MT' }), applied({ id: 'b', ownerId: 'H1' })];
        const { visibleGroups, hiddenMitigations } = groupAndCapMitigations(mits, undefined);
        expect(visibleGroups.map(g => g.key)).toEqual(['MT', 'H1']);
        expect(hiddenMitigations).toHaveLength(0);
    });

    it('非表示メンバーの軽減は visibleGroups から消え、hiddenMitigations(あふれ扱い)にも入らない', () => {
        const mits = [applied({ id: 'a', ownerId: 'MT' }), applied({ id: 'b', ownerId: 'H1' })];
        const { visibleGroups, hiddenMitigations } = groupAndCapMitigations(mits, undefined, ['MT']);
        expect(visibleGroups.map(g => g.key)).toEqual(['MT']);
        // H1 のアイコンは「+N」あふれ扱い(orphan)にもならず、単純に描画対象から消える
        expect(hiddenMitigations).toHaveLength(0);
    });

    it('全員非表示なら groups は空になる(orphan フォールバックしない)', () => {
        const mits = [applied({ id: 'a', ownerId: 'MT' })];
        const { visibleGroups, hiddenMitigations } = groupAndCapMitigations(mits, undefined, []);
        expect(visibleGroups).toHaveLength(0);
        expect(hiddenMitigations).toHaveLength(0);
    });

    it('未知の ownerId(orphan)は非表示スイッチに関わらず常に表示される', () => {
        const mits = [applied({ id: 'a', ownerId: 'UNKNOWN_SLOT' })];
        const { visibleGroups } = groupAndCapMitigations(mits, undefined, ['MT']);
        expect(visibleGroups.map(g => g.key)).toEqual(['orphan']);
    });

    it('maxIcons によるあふれ(+N)判定は非表示メンバー分を除いた件数だけで計算される', () => {
        const mits = [
            applied({ id: 'a', ownerId: 'MT' }),
            applied({ id: 'b', ownerId: 'MT' }),
            applied({ id: 'd', ownerId: 'MT' }),
            applied({ id: 'c', ownerId: 'H1' }),
        ];
        // H1 を非表示にした状態で maxIcons=2。表示対象は MT の3件のみ(H1の1件は数に入れない)。
        const { visibleGroups, hiddenMitigations } = groupAndCapMitigations(mits, 2, ['MT']);
        const visibleIds = visibleGroups.flatMap(g => g.items.map(i => i.id));
        expect(visibleIds).toEqual(['a']);
        // あふれるのは表示対象内の b・d のみ(非表示メンバー c はそもそも集計に入らない)
        expect(hiddenMitigations.map(m => m.id)).toEqual(['b', 'd']);
    });
});
