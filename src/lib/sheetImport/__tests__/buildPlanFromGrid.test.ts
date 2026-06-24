import { describe, it, expect } from 'vitest';
import { buildPlanFromGrid } from '../buildPlanFromGrid';
import type { GridTable } from '../gridTypes';
import type { Job, Mitigation } from '../../../types';

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' } as Job,
  { id: 'whm', name: { ja: '白魔道士', en: 'White Mage' }, role: 'healer', icon: '' } as Job,
];
const MITS: Mitigation[] = [
  { id: 'rampart_pld', jobId: 'pld', name: { ja: 'ランパート', en: 'Rampart' }, recast: 0, duration: 20, type: 'all', value: 0 } as Mitigation,
];

const table: GridTable = {
  columns: [
    { field: 'phase', header: 'フェーズ' },
    { field: 'label', header: 'ラベル' },
    { field: 'time', header: '時間' },
    { field: 'action', header: '敵の攻撃' },
    { field: 'damage', header: 'ダメージ' },
    { field: 'target', header: '攻撃の対象' },
    { field: 'damageType', header: 'ダメージ種別' },
    { field: 'member', header: 'ナイト', jobId: 'pld', slot: 'MT' },
  ],
  rows: [
    ['P1', '前半', '0:10', 'AA', '1,000', 'MT', '物理', ''],
    ['', '', '0:20', '強攻撃', '220000', '全体', '魔法', 'ランパート'],
  ],
};

describe('buildPlanFromGrid', () => {
  it('events/phase/label/target/damageType を構築', () => {
    const r = buildPlanFromGrid(table, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineEvents.map((e) => e.time)).toEqual([10, 20]);
    expect(r.timelineEvents[0].name.ja).toBe('AA');
    expect(r.timelineEvents[0].damageAmount).toBe(1000);
    expect(r.timelineEvents[0].target).toBe('MT');
    expect(r.timelineEvents[0].damageType).toBe('physical');
    expect(r.timelineEvents[1].damageType).toBe('magical');
    expect(r.phases.map((p) => p.name.ja)).toEqual(['P1']);
    expect(r.labels.map((l) => l.name.ja)).toEqual(['前半']);
  });
  it('member セルのスキルを枠 owner で配置(立ち上がり)', () => {
    const r = buildPlanFromGrid(table, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations).toHaveLength(1);
    expect(r.timelineMitigations[0].mitigationId).toBe('rampart_pld');
    expect(r.timelineMitigations[0].ownerId).toBe('MT');
    expect(r.timelineMitigations[0].time).toBe(20);
    expect(r.party).toContainEqual({ slot: 'MT', jobId: 'pld' });
  });
  it('解決不能スキルは skipped・includeMitigations=false で軽減ゼロ', () => {
    const t2: GridTable = { ...table, rows: [['', '', '0:20', 'x', '', '', '魔法', '存在しない技']] };
    const r = buildPlanFromGrid(t2, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.skipped).toContainEqual(expect.objectContaining({ job: 'ナイト', skillName: '存在しない技' }));
    const r2 = buildPlanFromGrid(table, { mitigations: MITS, jobs: JOBS }, { includeMitigations: false });
    expect(r2.timelineMitigations).toHaveLength(0);
  });
  it('skipped に slot と times が付く', () => {
    const t2: GridTable = { ...table, rows: [['', '', '0:20', 'x', '', '', '魔法', '存在しない技']] };
    const r = buildPlanFromGrid(t2, { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    const s = r.skipped.find((x) => x.skillName === '存在しない技');
    expect(s?.slot).toBe('MT');      // table の member 列 slot
    expect(s?.times).toEqual([20]);  // 0:20
  });
});
