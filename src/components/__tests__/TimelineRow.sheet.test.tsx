// @vitest-environment happy-dom
// スプシ表示: TimelineRow のメンバー要素の幅 = 列数 × --sheet-col-w
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
vi.mock('../../store/useThemeStore', () => ({
    useThemeStore: (sel?: any) => {
        const st = { contentLanguage: 'ja', themeStyle: 'standard' };
        return sel ? sel(st) : st;
    },
}));
vi.mock('../../hooks/useSkillsData', () => ({ useJobs: () => [], useMitigations: () => [] }));
vi.mock('../progress/useProgressRecording', () => ({
    useProgressRecording: { getState: () => ({ recordMode: false, commitReachedPos: vi.fn() }) },
}));

import { TimelineRow } from '../TimelineRow';
import type { TimelineEvent } from '../../types';

const ev = { id: 'a', time: 10, name: { ja: 'a', en: 'a' }, damageType: 'physical', target: 'AoE' } as TimelineEvent;
const members = [
    { id: 'MT', role: 'tank', stats: { hp: 100000 } },
    { id: 'H1', role: 'healer', stats: { hp: 100000 } },
] as any[];

const renderRow = (sheetCols?: ReadonlyMap<string, number>) => render(
    <TimelineRow
        time={10} top={0} height={25}
        damages={[null]} events={[ev]}
        partyMembers={members} visiblePartyMembers={members} activeMitigations={[]}
        onPhaseAdd={vi.fn()} onAddEventClick={vi.fn()} onEventClick={vi.fn()} onCellClick={vi.fn()}
        phaseColumnCollapsed labelColumnVisible={false}
        sheetCols={sheetCols}
    />,
);

describe('TimelineRow: sheetCols', () => {
    it('未指定なら width は getColumnCssVar のまま・data-sheet-cols 無し', () => {
        const { container } = renderRow();
        expect(container.querySelector('[data-sheet-cols]')).toBeNull();
        // 従来のメンバー要素(border-app-border)が 1 人 1 個
        expect(Array.from(container.querySelectorAll('div')).filter(d => d.className.includes('group/cell') && d.className.includes('border-app-border'))).toHaveLength(2);
    });
    it('sheetCols={MT:9} なら calc(var(--sheet-col-w) * 9)・padding 0・data-sheet-cols。1 人 1 個のまま', () => {
        const { container } = renderRow(new Map([['MT', 9], ['H1', 0]]));
        const cells = container.querySelectorAll('[data-sheet-cols]');
        expect(cells).toHaveLength(2);
        const mt = cells[0] as HTMLElement;
        expect(mt.getAttribute('data-sheet-cols')).toBe('9');
        // 幅の式そのものは sheetStyle.test.ts(happy-dom は calc(var()) の inline style を保持しない)
        expect(mt.style.paddingLeft).toBe('0px');
        const h1 = cells[1] as HTMLElement;
        expect(h1.getAttribute('data-sheet-cols')).toBe('0');
    });
});
