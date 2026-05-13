// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import type { Job, PartyMember, PlayerStats } from '../../types';
import { JobPickerRow } from '../JobPickerRow';

// react-i18next の TFunction を満たす最小スタブ (`(key, fallback) => fallback ?? key`)
const tStub: any = (key: string, fallback?: string) => fallback ?? key;

const EMPTY_STATS: PlayerStats = { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 };

const partyMembers: PartyMember[] = [
    { id: 'MT', jobId: 'WAR', role: 'tank',   stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'ST', jobId: 'PLD', role: 'tank',   stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'H1', jobId: 'SCH', role: 'healer', stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'H2', jobId: null,  role: 'healer', stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D1', jobId: 'MNK', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D2', jobId: 'RPR', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D3', jobId: 'BLM', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
    { id: 'D4', jobId: 'BRD', role: 'dps',    stats: { ...EMPTY_STATS }, computedValues: {} },
];

const jobs: Job[] = [
    { id: 'WAR', name: { ja: '戦士', en: 'Warrior' }, role: 'tank',   icon: '/icons/war.png' },
    { id: 'PLD', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank',   icon: '/icons/pld.png' },
    { id: 'SCH', name: { ja: '学者', en: 'Scholar' }, role: 'healer', icon: '/icons/sch.png' },
    { id: 'MNK', name: { ja: 'モンク', en: 'Monk' },    role: 'dps',    icon: '/icons/mnk.png' },
    { id: 'RPR', name: { ja: 'リーパー', en: 'Reaper' }, role: 'dps',    icon: '/icons/rpr.png' },
    { id: 'BLM', name: { ja: '黒魔道士', en: 'Black Mage' }, role: 'dps',    icon: '/icons/blm.png' },
    { id: 'BRD', name: { ja: '吟遊詩人', en: 'Bard' },  role: 'dps',    icon: '/icons/brd.png' },
];

const getJobIcon = (jobId: string | null) => {
    if (!jobId) return null;
    return jobs.find(j => j.id === jobId)?.icon ?? null;
};

const renderJobPickerRow = (overrides: Partial<React.ComponentProps<typeof JobPickerRow>> = {}) => {
    return render(
        <JobPickerRow
            partyMembers={partyMembers}
            partySortOrder="role"
            getJobIcon={getJobIcon}
            jobs={jobs}
            handleJobIconClick={() => {}}
            getMemberRefCallback={() => () => {}}
            t={tStub}
            {...overrides}
        />,
    );
};

describe('JobPickerRow', () => {
    it('renders 8 member divs with matching data-member-id', () => {
        const { container } = renderJobPickerRow();
        const cells = Array.from(container.querySelectorAll('[data-member-id]'));
        expect(cells.length).toBe(8);
        const ids = cells.map(c => c.getAttribute('data-member-id'));
        expect(ids).toEqual(['MT', 'ST', 'H1', 'H2', 'D1', 'D2', 'D3', 'D4']);
    });

    it('each member with a jobId shows an img for the job icon', () => {
        const { container } = renderJobPickerRow();
        const mtCell = container.querySelector('[data-member-id="MT"]') as HTMLElement;
        const img = mtCell.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.getAttribute('src')).toBe('/icons/war.png');
        expect(img?.getAttribute('alt')).toBe('WAR');
    });

    it('each member without a jobId shows the placeholder (no img, has a Plus icon container)', () => {
        const { container } = renderJobPickerRow();
        const h2Cell = container.querySelector('[data-member-id="H2"]') as HTMLElement;
        expect(h2Cell.querySelector('img')).toBeNull();
        // Plus アイコン (lucide-react) は svg として描画される
        expect(h2Cell.querySelector('svg')).not.toBeNull();
    });

    it('clicking on a member cell calls handleJobIconClick with the member id', () => {
        const onClick = vi.fn();
        const { container } = renderJobPickerRow({ handleJobIconClick: onClick });
        const mtCell = container.querySelector('[data-member-id="MT"]') as HTMLElement;
        // クリックターゲットは内側の onClick 付き div
        const clickable = mtCell.querySelector('[class*="cursor-pointer"]') as HTMLElement;
        expect(clickable).not.toBeNull();
        fireEvent.click(clickable);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(onClick.mock.calls[0][0]).toBe('MT');
    });

    it('passes member id and role into data-* attributes (used by other code)', () => {
        const { container } = renderJobPickerRow();
        const cell = container.querySelector('[data-member-id="D2"]') as HTMLElement;
        expect(cell.getAttribute('data-member-role')).toBe('dps');
    });
});
