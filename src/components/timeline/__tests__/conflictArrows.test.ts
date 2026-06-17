import { describe, it, expect } from 'vitest';
import { computeConflictArrows, type ConflictPoint } from '../conflictArrows';

const pt = (id: string, ownerId: string, y: number, x = 100): ConflictPoint =>
    ({ id, ownerId, y, columnCenterX: x });

describe('computeConflictArrows', () => {
    // viewport: scrollTop=200, height=300 → 可視は y∈[200,500]
    const view = { scrollTop: 200, viewportHeight: 300 };

    it('可視範囲内の競合は矢印を出さない', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 300)], view);
        expect(arrows).toEqual([]);
    });

    it('上に外れた競合 → up 矢印(targetY はその競合のy)', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 50)], view);
        expect(arrows).toHaveLength(1);
        expect(arrows[0].direction).toBe('up');
        expect(arrows[0].ownerId).toBe('MT');
        expect(arrows[0].targetY).toBe(50);
    });

    it('下に外れた競合 → down 矢印', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 800)], view);
        expect(arrows).toHaveLength(1);
        expect(arrows[0].direction).toBe('down');
        expect(arrows[0].targetY).toBe(800);
    });

    it('同じ列・同じ方向に複数 → 一番近いものを指す(上は最大y)', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 10), pt('b', 'MT', 150)], view);
        expect(arrows).toHaveLength(1);
        expect(arrows[0].targetY).toBe(150); // 端に最も近い
    });

    it('列ごとに分かれる', () => {
        const arrows = computeConflictArrows([pt('a', 'MT', 50), pt('b', 'ST', 800)], view);
        expect(arrows.map(a => a.ownerId).sort()).toEqual(['MT', 'ST']);
    });
});
