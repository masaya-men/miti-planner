// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import type { AppliedMitigation, Mitigation, PartyMember, PlayerStats } from '../../types';
import { RecastRow, type RecastRowHandle } from '../RecastRow';

const EMPTY_STATS: PlayerStats = { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 };

const mitigations: Mitigation[] = [
    { id: 'holmgang', jobId: 'WAR', name: { ja: '鬨', en: 'Holmgang' }, icon: '/h.png', recast: 240, duration: 8,  type: 'all', value: 0,  isInvincible: true },
    { id: 'thrill',   jobId: 'WAR', name: { ja: '原初', en: 'Thrill' }, icon: '/t.png', recast: 90,  duration: 15, type: 'all', value: 10 },
];

const partyMembers: PartyMember[] = [
    { id: 'MT', jobId: 'WAR', role: 'tank',   stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'ST', jobId: 'PLD', role: 'tank',   stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'H1', jobId: 'SCH', role: 'healer', stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'H2', jobId: 'WHM', role: 'healer', stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D1', jobId: 'MNK', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D2', jobId: 'RPR', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D3', jobId: 'BLM', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D4', jobId: 'BRD', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
];

const mkPlacement = (id: string, mitigationId: string, time: number, ownerId: string): AppliedMitigation => ({
    id, mitigationId, time, ownerId, duration: 0,
});

type RecastRowOverrides = Partial<React.ComponentProps<typeof RecastRow>> & {
    ref?: React.Ref<RecastRowHandle>;
};

/** RecastRow を最小 prop で render するヘルパ。 個別テストで上書き可。 */
const renderRecastRow = (overrides: RecastRowOverrides = {}) => {
    return render(
        <RecastRow
            partyMembers={partyMembers}
            placements={[]}
            mitigationDefs={mitigations}
            {...overrides}
        />,
    );
};

describe('RecastRow (セッション 18 ツールバー統合版)', () => {
    it('renders one member cell per member (8 cells)', () => {
        const { container } = renderRecastRow();
        expect(container.querySelectorAll('.recast-cell[data-member]').length).toBe(8);
    });

    it('does NOT render legacy left-side column cells (phase / label / time / mechanic / counter)', () => {
        const { container } = renderRecastRow();
        // 旧 .recast-col-* / .recast-label / .recast-chev は撤去済み
        expect(container.querySelector('.recast-col-phase')).toBeNull();
        expect(container.querySelector('.recast-col-label')).toBeNull();
        expect(container.querySelector('.recast-col-time')).toBeNull();
        expect(container.querySelector('.recast-col-mechanic')).toBeNull();
        expect(container.querySelectorAll('.recast-col-counter').length).toBe(0);
        expect(container.querySelector('.recast-label-text')).toBeNull();
        expect(container.querySelector('.recast-chev')).toBeNull();
    });

    it('member cell uses paddingLeft 2px (VISUAL_OFFSET 整合) and paddingRight 0', () => {
        const { container } = renderRecastRow();
        const cells = Array.from(container.querySelectorAll('.recast-cell[data-member]')) as HTMLDivElement[];
        expect(cells.length).toBeGreaterThan(0);
        for (const cell of cells) {
            expect(cell.style.paddingLeft).toBe('2px');
            expect(cell.style.paddingRight).toBe('0px');
        }
    });

    it('renders one RecastIcon per placed mitigation species per member', () => {
        const placements: AppliedMitigation[] = [
            mkPlacement('p1', 'holmgang', 30, 'MT'),
            mkPlacement('p2', 'thrill',   60, 'MT'),
            mkPlacement('p3', 'thrill',   100, 'MT'), // same species → 1 icon
        ];
        const { container } = renderRecastRow({ placements });
        const mtCell = container.querySelector('[data-member="MT"]') as HTMLDivElement;
        expect(mtCell.querySelectorAll('.recast-icon').length).toBe(2);
    });

    it('each icon is wrapped by a Tooltip (recast-tooltip-wrap) with the skill name as content/alt', () => {
        const placements: AppliedMitigation[] = [
            mkPlacement('p1', 'holmgang', 30, 'MT'),
        ];
        const { container } = renderRecastRow({ placements });
        const mtCell = container.querySelector('[data-member="MT"]') as HTMLDivElement;
        // Tooltip wrapper (display: contents) が間に挟まる
        const wrap = mtCell.querySelector('.recast-tooltip-wrap');
        expect(wrap).not.toBeNull();
        const img = wrap?.querySelector('img');
        expect(img?.getAttribute('alt')).toBe('鬨');
    });

    it('on update(currentTime), sets --cd-display=flex for active recasts', () => {
        const placements: AppliedMitigation[] = [
            mkPlacement('p1', 'thrill',   0, 'MT'), // at t=60 remaining=30
            mkPlacement('p2', 'holmgang', 0, 'MT'), // at t=60 remaining=180
        ];
        const ref = createRef<RecastRowHandle>();
        const { container } = renderRecastRow({ placements, ref });
        ref.current?.update(60);

        const mtCell = container.querySelector('[data-member="MT"]') as HTMLDivElement;
        const icons = Array.from(mtCell.querySelectorAll('.recast-icon')) as HTMLDivElement[];
        expect(icons.length).toBe(2);
        expect(icons.every(el => el.style.getPropertyValue('--cd-display') === 'flex')).toBe(true);
    });

    it('on update(currentTime), hides icons whose recast expired', () => {
        const placements = [mkPlacement('p1', 'thrill', 0, 'MT')];
        const ref = createRef<RecastRowHandle>();
        const { container } = renderRecastRow({ placements, ref });
        ref.current?.update(100); // thrill recast 90 → expired

        const icon = container.querySelector('[data-member="MT"] .recast-icon') as HTMLDivElement;
        expect(icon.style.getPropertyValue('--cd-display')).toBe('none');
    });

    it('respects T/H limit (6) and DPS limit (2)', () => {
        const many: Mitigation[] = [
            ...Array.from({ length: 7 }).map((_, i) => ({
                id: 'tk' + i, jobId: 'WAR', name: { ja: 't' + i, en: 't' + i }, icon: '/x.png',
                recast: 60 + i * 10, duration: 10, type: 'all' as const, value: 0,
            })),
            ...Array.from({ length: 3 }).map((_, i) => ({
                id: 'dp' + i, jobId: 'MNK', name: { ja: 'd' + i, en: 'd' + i }, icon: '/x.png',
                recast: 60 + i * 10, duration: 10, type: 'all' as const, value: 0,
            })),
        ];
        const placements: AppliedMitigation[] = [
            ...Array.from({ length: 7 }).map((_, i) => mkPlacement('pT' + i, 'tk' + i, 0, 'MT')),
            ...Array.from({ length: 3 }).map((_, i) => mkPlacement('pD' + i, 'dp' + i, 0, 'D1')),
        ];

        const ref = createRef<RecastRowHandle>();
        const { container } = renderRecastRow({ placements, mitigationDefs: many, ref });
        ref.current?.update(20);

        const mtCell = container.querySelector('[data-member="MT"]') as HTMLDivElement;
        const d1Cell = container.querySelector('[data-member="D1"]') as HTMLDivElement;
        const mtVisible = Array.from(mtCell.querySelectorAll('.recast-icon'))
            .filter(el => (el as HTMLElement).style.getPropertyValue('--cd-display') === 'flex');
        const d1Visible = Array.from(d1Cell.querySelectorAll('.recast-icon'))
            .filter(el => (el as HTMLElement).style.getPropertyValue('--cd-display') === 'flex');
        expect(mtVisible.length).toBe(6);
        expect(d1Visible.length).toBe(2);
    });
});
