import { describe, it, expect } from 'vitest';
import { selectFight } from '../fflogs';
import type { FFLogsFight } from '../fflogs';

/** テスト用の最小 fight を作る。 */
function fight(id: number, kill: boolean): FFLogsFight {
    return { id, startTime: id * 1000, endTime: id * 1000 + 500, name: 'Boss', kill };
}

describe('selectFight', () => {
    it('空配列はエラー', () => {
        expect(() => selectFight([], null)).toThrow();
    });

    it('数値 id 指定で該当 fight を返す (全滅 pull も取れる)', () => {
        const fights = [fight(1, false), fight(2, false), fight(3, true)];
        expect(selectFight(fights, '2')).toBe(fights[1]);
    });

    it('該当しない id はエラー (利用可能 ID を列挙)', () => {
        const fights = [fight(1, false), fight(2, true)];
        expect(() => selectFight(fights, '99')).toThrow(/1, 2/);
    });

    it('fightId 未指定 (null) は最後の撃破を返す', () => {
        const fights = [fight(1, false), fight(2, true), fight(3, false)];
        // pull 3 は全滅だが、最後の「撃破」である pull 2 を優先
        expect(selectFight(fights, null)).toBe(fights[1]);
    });

    it('複数撃破がある場合は最後の撃破を返す', () => {
        const fights = [fight(1, true), fight(2, false), fight(3, true)];
        expect(selectFight(fights, 'last')).toBe(fights[2]);
    });

    it('全滅のみのログは最後の pull を返す', () => {
        const fights = [fight(1, false), fight(2, false), fight(3, false)];
        expect(selectFight(fights, null)).toBe(fights[2]);
    });
});
