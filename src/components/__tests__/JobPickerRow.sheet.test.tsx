// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Job, PartyMember } from '../../types';
import { JobPickerRow } from '../JobPickerRow';

const tStub: any = (key: string, fallback?: string) => fallback ?? key;
const S = { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 };
const members: PartyMember[] = [
    { id: 'MT', jobId: 'WAR', role: 'tank', stats: { ...S }, computedValues: {} },
    { id: 'D1', jobId: 'MNK', role: 'dps', stats: { ...S }, computedValues: {} },
];
const jobs: Job[] = [
    { id: 'WAR', name: { ja: '戦士', en: 'Warrior' }, role: 'tank', icon: '/icons/war.png' },
    { id: 'MNK', name: { ja: 'モンク', en: 'Monk' }, role: 'dps', icon: '/icons/mnk.png' },
];

const renderRow = (sheetCols?: ReadonlyMap<string, number>) => render(
    <JobPickerRow
        partyMembers={members} partySortOrder="role"
        getJobIcon={(id) => jobs.find(j => j.id === id)?.icon ?? null}
        jobs={jobs} handleJobIconClick={vi.fn()} getMemberRefCallback={() => () => {}} t={tStub}
        sheetCols={sheetCols}
    />,
);

describe('JobPickerRow: sheetCols', () => {
    it('未指定なら data-sheet-cols 無し・ジョブ名の文字は出ない', () => {
        const { container } = renderRow();
        expect(container.querySelector('[data-sheet-cols]')).toBeNull();
        expect(container.textContent).toBe('');
    });
    it('3 列以上はジョブ名と位置の文字がある、2 列以下はアイコンだけ', () => {
        const { container } = renderRow(new Map([['MT', 5], ['D1', 2]]));
        const [mt, d1] = Array.from(container.querySelectorAll('[data-member-id]')) as HTMLElement[];
        expect(mt.getAttribute('data-sheet-cols')).toBe('5');
        expect(mt.textContent).toContain('戦士');
        expect(mt.textContent).toContain('MT');
        expect(mt.querySelector('img')).not.toBeNull();
        expect(d1.textContent).toBe('');
        expect(d1.querySelector('img')).not.toBeNull();
    });
});
