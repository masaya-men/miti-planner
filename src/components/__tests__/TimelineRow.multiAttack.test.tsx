// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

const storeState = {
    myMemberId: null,
    timelineMitigations: [],
    phases: [],
    updateEvent: vi.fn(),
    setClipboardEvent: vi.fn(),
};
vi.mock('../../store/useMitigationStore', () => ({
    useMitigationStore: (sel: any) => sel(storeState),
}));
vi.mock('../../store/useThemeStore', () => ({
    useThemeStore: () => ({ contentLanguage: 'ja' }),
}));
vi.mock('../../hooks/useSkillsData', () => ({
    useJobs: () => [],
    useMitigations: () => [],
}));
vi.mock('../progress/useProgressRecording', () => ({
    useProgressRecording: { getState: () => ({ recordMode: false, commitReachedPos: vi.fn() }) },
}));

import { TimelineRow } from '../TimelineRow';
import type { TimelineEvent } from '../../types';

const ev = (id: string, name: string): TimelineEvent => ({
    id, time: 10, name: { ja: name, en: name }, damageType: 'magical', target: 'AoE',
} as TimelineEvent);

const renderRow = (events: TimelineEvent[], onAddEventClick = vi.fn(), onEventClick = vi.fn()) => render(
    <TimelineRow
        time={10}
        top={0}
        height={25 * Math.max(1, events.length)}
        damages={events.map(() => null)}
        events={events}
        partyMembers={[]}
        visiblePartyMembers={[]}
        activeMitigations={[]}
        onPhaseAdd={vi.fn()}
        onAddEventClick={onAddEventClick}
        onEventClick={onEventClick}
        onCellClick={vi.fn()}
        phaseColumnCollapsed
        labelColumnVisible={false}
    />,
);

describe('TimelineRow: 同じ秒に 3 つ以上の攻撃', () => {
    it('3 件の攻撃が 3 つとも表示され、行の高さは 75px', () => {
        const { container } = renderRow([ev('a', '攻撃A'), ev('b', '攻撃B'), ev('c', '攻撃C')]);
        expect(screen.getByText('攻撃A')).toBeTruthy();
        expect(screen.getByText('攻撃B')).toBeTruthy();
        expect(screen.getByText('攻撃C')).toBeTruthy();
        expect((container.firstChild as HTMLElement).style.height).toBe('75px');
    });

    it('各段の「+」で onAddEventClick(その秒)が呼ばれ、攻撃名クリックのメニューは開かない', () => {
        const onAdd = vi.fn();
        const onEventClick = vi.fn();
        renderRow([ev('a', '攻撃A'), ev('b', '攻撃B'), ev('c', '攻撃C')], onAdd, onEventClick);
        const addButtons = screen.getAllByLabelText('timeline.event_add_here');
        expect(addButtons).toHaveLength(3);
        fireEvent.click(addButtons[1]);
        expect(onAdd).toHaveBeenCalledTimes(1);
        expect(onAdd.mock.calls[0][0]).toBe(10);
        expect(onEventClick).not.toHaveBeenCalled();
    });

    it('攻撃 1 つの行の下の細い「+」(高さ 12px の帯)は無い', () => {
        const { container } = renderRow([ev('a', '攻撃A')]);
        expect(container.querySelector('[class*="h-[12px]"]')).toBeNull();
        expect(screen.getAllByLabelText('timeline.event_add_here')).toHaveLength(1);
    });
});
