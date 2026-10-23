// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
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

describe('JobPickerRow スプシ表示の見た目', () => {
    const cols = new Map<string, number>([['MT', 3], ['ST', 1], ['H1', 2], ['H2', 0], ['D1', 1], ['D2', 1], ['D3', 1], ['D4', 1]]);

    it('最後のメンバーにも標準の border-app-border を足さない(スプシの罫線色とぶつかるため)', () => {
        const { container } = renderJobPickerRow({ sheetCols: cols });
        const last = container.querySelector('[data-member-id="D4"]') as HTMLElement;
        expect(last.className).not.toContain('border-app-border');
        expect(last.className).toContain('border-app-text/20');
    });

    it('レーン表示では最後のメンバーに従来どおり border-app-border が付く', () => {
        const { container } = renderJobPickerRow();
        const last = container.querySelector('[data-member-id="D4"]') as HTMLElement;
        expect(last.className).toContain('border-app-border');
    });

    it('1〜2 列のメンバーはホバー拡大するアイコンを切らない(overflow-hidden なし)。3 列以上は切り詰める', () => {
        const { container } = renderJobPickerRow({ sheetCols: cols });
        const box = (id: string) => (container.querySelector(`[data-member-id="${id}"] .cursor-pointer`) as HTMLElement);
        expect(box('ST').className).not.toContain('overflow-hidden');
        expect(box('H1').className).not.toContain('overflow-hidden');
        expect(box('MT').className).toContain('overflow-hidden');
    });
});
