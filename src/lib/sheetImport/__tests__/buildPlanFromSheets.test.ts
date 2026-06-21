import { describe, it, expect } from 'vitest';
import { buildPlanFromSheets } from '../buildPlanFromSheets';
import type { ParsedSheet } from '../types';
import type { Mitigation, Job } from '../../../types';

const M = (id: string, jobId: string, ja: string, duration = 10): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration, type: 'all', value: 0 } as Mitigation);
const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);

const MITS = [M('reprisal_pld', 'pld', 'リプライザル', 15), M('asylum', 'whm', 'アサイラム', 24)];
const JOBS = [J('pld', 'tank'), J('whm', 'healer')];

const sheet: ParsedSheet = {
  columns: [
    { index: 8, job: 'ナイト', skillNameRaw: 'リプライザル' },
    { index: 9, job: '白魔道士', skillNameRaw: 'ベネディクション' }, // 未対応
  ],
  rows: [
    { phaseLabel: '開幕', totalTimeSec: 7, action: 'AA', damageAmount: 115000, damageType: 'physical', trueColumnIndexes: [8] },
    { phaseLabel: '真偽記憶', totalTimeSec: 40, action: 'なぞなぞ', damageAmount: null, damageType: null, trueColumnIndexes: [9] },
  ],
};

describe('buildPlanFromSheets', () => {
  it('TimelineEvent を Total Time 順に作る（damageType 既定 magical・name.ja=action）', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineEvents.map((e) => [e.time, e.name.ja, e.damageType])).toEqual([
      [7, 'AA', 'physical'], [40, 'なぞなぞ', 'magical'],
    ]);
  });
  it('TRUE セル→AppliedMitigation（owner=枠・time=通し・duration=スナップショット）', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations).toHaveLength(1); // ナイトのリプライザルのみ（ベネは skip）
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'MT', time: 7, duration: 15 });
  });
  it('未対応技は skipped に集約', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.skipped).toContainEqual({ job: '白魔道士', skillName: 'ベネディクション' });
  });
  it('フェーズを Phase 列ラベルの塊で作る', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.phases.map((p) => [p.name.ja, p.startTime])).toEqual([['開幕', 7], ['真偽記憶', 40]]);
  });
  it('includeMitigations=false なら軽減もパーティも空（イベントは出る）', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: false });
    expect(r.timelineMitigations).toEqual([]);
    expect(r.party).toEqual([]);
    expect(r.timelineEvents).toHaveLength(2);
  });
});
