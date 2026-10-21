// @vitest-environment happy-dom
// 軍事の表の見た目用に TimelineRow が出す data 属性(標準の見た目には効かない印)の検査
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));
const storeState = {
    myMemberId: null, timelineMitigations: [], phases: [],
    updateEvent: vi.fn(), setClipboardEvent: vi.fn(),
};
vi.mock('../../store/useMitigationStore', () => ({
    useMitigationStore: (sel: any) => sel(storeState),
}));
let themeStyle = 'military';
vi.mock('../../store/useThemeStore', () => ({
    useThemeStore: (sel?: any) => {
        const st = { contentLanguage: 'ja', themeStyle };
        return sel ? sel(st) : st;
    },
}));
vi.mock('../../hooks/useSkillsData', () => ({ useJobs: () => [], useMitigations: () => [] }));
vi.mock('../progress/useProgressRecording', () => ({
    useProgressRecording: { getState: () => ({ recordMode: false, commitReachedPos: vi.fn() }) },
}));

import { TimelineRow } from '../TimelineRow';
import type { TimelineEvent } from '../../types';

const ev = (id: string, ty: string): TimelineEvent => ({
    id, time: 10, name: { ja: id, en: id }, damageType: ty, target: 'AoE',
} as TimelineEvent);
const dmg = (mitigated: number) => ({
    unmitigated: 200000, mitigated, mitigationPercent: 0, shieldTotal: 0, isInvincible: false,
}) as any;

const renderRow = (events: TimelineEvent[], damages: any[]) => render(
    <TimelineRow
        time={10} top={0} height={25 * events.length}
        damages={damages} events={events}
        partyMembers={[{ id: 'H1', stats: { hp: 100000 } } as any]}
        visiblePartyMembers={[]} activeMitigations={[]}
        onPhaseAdd={vi.fn()} onAddEventClick={vi.fn()} onEventClick={vi.fn()} onCellClick={vi.fn()}
        phaseColumnCollapsed labelColumnVisible={false}
    />,
);

describe('TimelineRow: 軍事の表の見た目用の data 属性', () => {
    it('致死の段だけ data-lethal が付く(段単位)', () => {
        const { container } = renderRow([ev('a', 'physical'), ev('b', 'magical')], [dmg(50000), dmg(150000)]);
        const slots = container.querySelectorAll('[data-event-slot]');
        expect(slots).toHaveLength(2);
        expect(slots[0].hasAttribute('data-lethal')).toBe(false);
        expect(slots[1].hasAttribute('data-lethal')).toBe(true);
    });
    it('同時刻(2 件以上)の時刻セルに data-stack=件数・1 件なら付かない', () => {
        const two = renderRow([ev('a', 'physical'), ev('b', 'magical')], [dmg(1), dmg(1)]);
        expect(two.container.querySelector('[data-stack]')?.getAttribute('data-stack')).toBe('2');
        two.unmount();
        const one = renderRow([ev('a', 'physical')], [dmg(1)]);
        expect(one.container.querySelector('[data-stack]')).toBeNull();
    });
    it('標準テーマでは印を一切付けない(標準の DOM 不変)', () => {
        themeStyle = 'standard';
        const { container } = renderRow([ev('a', 'physical'), ev('b', 'magical')], [dmg(1), dmg(150000)]);
        themeStyle = 'military';
        expect(container.querySelector('[data-event-slot],[data-lethal],[data-stack],[data-damage-type]')).toBeNull();
    });
    it('種類の切替ボタンに data-damage-type が付く', () => {
        const { container } = renderRow([ev('a', 'physical'), ev('b', 'magical')], [dmg(1), dmg(1)]);
        const types = Array.from(container.querySelectorAll('[data-damage-type]')).map((e) => e.getAttribute('data-damage-type'));
        expect(types).toEqual(['physical', 'magical']);
    });
});
