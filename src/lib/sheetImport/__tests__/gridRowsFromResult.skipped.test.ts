import { describe, it, expect } from 'vitest';
import { gridRowsFromResult } from '../gridRowsFromResult';
import type { SheetImportResult } from '../buildPlanFromSheets';
import type { Mitigation, Job } from '../../../types/index';

// ─── Task 5: skipped 注入テスト ──────────────────────────────────────────────

const JOBS_SKIP: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' },
];
const MITS_SKIP: Mitigation[] = [
  {
    id: 'rampart_pld',
    jobId: 'pld',
    name: { ja: 'ランパート', en: 'Rampart' },
    icon: '',
    recast: 0,
    duration: 20,
    type: 'all',
    value: 0,
  },
];

describe('gridRowsFromResult skipped 注入', () => {
  it('skipped の生テキストを (slot,time) セルに出す', () => {
    const result: SheetImportResult = {
      timelineEvents: [
        { id: 'e1', name: { ja: 'AA', en: 'AA' }, time: 20, damageType: 'magical' } as any,
      ],
      timelineMitigations: [],
      phases: [],
      labels: [],
      party: [{ slot: 'MT', jobId: 'pld' }],
      skipped: [{ job: 'ナイト', skillName: 'ベネ', slot: 'MT', times: [20] }],
    };
    const t = gridRowsFromResult(result, { mitigations: MITS_SKIP, jobs: JOBS_SKIP }, 'ja');
    const memberColIdx = t.columns.findIndex((c) => c.field === 'member' && c.slot === 'MT');
    const row = t.rows.find((r) => r[t.columns.findIndex((c) => c.field === 'time')] === '0:20')!;
    expect(row[memberColIdx]).toBe('ベネ');
  });

  it('解決済みスキル + skipped が / 区切りで連結される', () => {
    const result: SheetImportResult = {
      timelineEvents: [
        { id: 'e1', name: { ja: 'AA', en: 'AA' }, time: 20, damageType: 'magical' } as any,
      ],
      timelineMitigations: [
        { id: 'm1', mitigationId: 'rampart_pld', time: 20, duration: 20, ownerId: 'MT' },
      ],
      phases: [],
      labels: [],
      party: [{ slot: 'MT', jobId: 'pld' }],
      skipped: [{ job: 'ナイト', skillName: 'ベネ', slot: 'MT', times: [20] }],
    };
    const t = gridRowsFromResult(result, { mitigations: MITS_SKIP, jobs: JOBS_SKIP }, 'ja');
    const memberColIdx = t.columns.findIndex((c) => c.field === 'member' && c.slot === 'MT');
    const row = t.rows.find((r) => r[t.columns.findIndex((c) => c.field === 'time')] === '0:20')!;
    expect(row[memberColIdx]).toBe('ランパート / ベネ');
  });

  it('slot が違う skipped はそのセルに出ない', () => {
    const result: SheetImportResult = {
      timelineEvents: [
        { id: 'e1', name: { ja: 'AA', en: 'AA' }, time: 20, damageType: 'magical' } as any,
      ],
      timelineMitigations: [],
      phases: [],
      labels: [],
      party: [
        { slot: 'MT', jobId: 'pld' },
      ],
      skipped: [{ job: 'ナイト', skillName: 'ベネ', slot: 'ST', times: [20] }],
    };
    const t = gridRowsFromResult(result, { mitigations: MITS_SKIP, jobs: JOBS_SKIP }, 'ja');
    const memberColIdx = t.columns.findIndex((c) => c.field === 'member' && c.slot === 'MT');
    const row = t.rows.find((r) => r[t.columns.findIndex((c) => c.field === 'time')] === '0:20')!;
    expect(row[memberColIdx]).toBe('');
  });

  it('time が合わない skipped は出ない', () => {
    const result: SheetImportResult = {
      timelineEvents: [
        { id: 'e1', name: { ja: 'AA', en: 'AA' }, time: 20, damageType: 'magical' } as any,
      ],
      timelineMitigations: [],
      phases: [],
      labels: [],
      party: [{ slot: 'MT', jobId: 'pld' }],
      skipped: [{ job: 'ナイト', skillName: 'ベネ', slot: 'MT', times: [30] }],
    };
    const t = gridRowsFromResult(result, { mitigations: MITS_SKIP, jobs: JOBS_SKIP }, 'ja');
    const memberColIdx = t.columns.findIndex((c) => c.field === 'member' && c.slot === 'MT');
    const row = t.rows.find((r) => r[t.columns.findIndex((c) => c.field === 'time')] === '0:20')!;
    expect(row[memberColIdx]).toBe('');
  });
});
