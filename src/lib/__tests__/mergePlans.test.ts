/**
 * mergePlans 単体テスト (2026-06-03)
 *
 * 同期安定化 (業界水準 local-first) の中核となる純粋マージ関数。
 * 「未同期」と「他端末で削除 (墓標)」を明示的に区別する。
 *
 * - 未同期ローカル (リモートに live 無し + 墓標無し) → 残す (= 消失バグの根治)
 * - 墓標があるローカル → 除去 (= 削除→復活バグの根治)
 * - リモートのみ live → 追加 (他端末作成)
 * - 両方に存在 → updatedAt が新しい方
 */
import { describe, it, expect } from 'vitest';
import { mergePlans } from '../mergePlans';
import type { SavedPlan } from '../../types';

const UID = 'user-123';

function makePlan(id: string, ownerId: string, updatedAt = 2000): SavedPlan {
    return {
        id, ownerId, ownerDisplayName: '', title: id, contentId: 'm1s',
        isPublic: false, copyCount: 0, useCount: 0,
        data: {} as any, createdAt: 1000, updatedAt,
    };
}

describe('mergePlans', () => {
    it('未同期ローカル (ownerId=uid・リモートに live 無し・墓標無し) を残す', () => {
        const local = [makePlan('p1', UID)];
        const { merged } = mergePlans(local, [], new Set());
        expect(merged.map(p => p.id)).toContain('p1');
    });

    it('未同期ローカル (ownerId=local) も残す', () => {
        const local = [makePlan('p2', 'local')];
        const { merged } = mergePlans(local, [], new Set());
        expect(merged.map(p => p.id)).toContain('p2');
    });

    it('墓標があるローカルは除去する (削除→復活の根治)', () => {
        const local = [makePlan('p3', UID)];
        const { merged, changed } = mergePlans(local, [], new Set(['p3']));
        expect(merged.map(p => p.id)).not.toContain('p3');
        expect(changed).toBe(true);
    });

    it('リモートのみの live プランは追加する (他端末作成)', () => {
        const remote = [makePlan('p4', UID)];
        const { merged, changed } = mergePlans([], remote, new Set());
        expect(merged.map(p => p.id)).toContain('p4');
        expect(changed).toBe(true);
    });

    it('墓標のみ (ローカルにもリモート live にも無い) は復活させない', () => {
        const { merged, changed } = mergePlans([], [], new Set(['p5']));
        expect(merged.map(p => p.id)).not.toContain('p5');
        expect(changed).toBe(false);
    });

    it('両方に存在: リモートが新しければリモート採用', () => {
        const local = [makePlan('p6', UID, 1000)];
        const remote = [makePlan('p6', UID, 5000)];
        const { merged, changed } = mergePlans(local, remote, new Set());
        expect(merged.find(p => p.id === 'p6')?.updatedAt).toBe(5000);
        expect(changed).toBe(true);
    });

    it('両方に存在: ローカルが新しければローカル採用', () => {
        const local = [makePlan('p7', UID, 9000)];
        const remote = [makePlan('p7', UID, 1000)];
        const { merged } = mergePlans(local, remote, new Set());
        expect(merged.find(p => p.id === 'p7')?.updatedAt).toBe(9000);
    });

    it('墓標があれば両方に存在しても除去 (墓標が最優先)', () => {
        const local = [makePlan('p8', UID, 9000)];
        const remote = [makePlan('p8', UID, 1000)];
        const { merged, changed } = mergePlans(local, remote, new Set(['p8']));
        expect(merged.map(p => p.id)).not.toContain('p8');
        expect(changed).toBe(true);
    });

    it('updatedAt 降順でソートされる', () => {
        const local = [makePlan('a', UID, 1000), makePlan('b', UID, 3000)];
        const remote = [makePlan('c', UID, 2000)];
        const { merged } = mergePlans(local, remote, new Set());
        expect(merged.map(p => p.id)).toEqual(['b', 'c', 'a']);
    });
});
