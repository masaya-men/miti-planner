import { describe, it, expect } from 'vitest';
import { buildPlanFromSheets } from '../buildPlanFromSheets';
import type { ParsedSheet } from '../types';
import type { Mitigation, Job } from '../../../types';

const M = (id: string, jobId: string, ja: string, duration = 10): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration, type: 'all', value: 0 } as Mitigation);
const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);

const MITS = [
  M('reprisal_pld', 'pld', 'リプライザル', 15),
  M('asylum', 'whm', 'アサイラム', 24),
  M('rampart_war', 'war', 'ランパート', 20),
];
const JOBS = [J('pld', 'tank'), J('whm', 'healer'), J('war', 'tank')];

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

// sheet2: 戦士のランパートが t=20 と t=55 に出現（sheet の t=7/40 と交互になる）
const sheet2: ParsedSheet = {
  columns: [
    { index: 3, job: '戦士', skillNameRaw: 'ランパート' },
  ],
  rows: [
    { phaseLabel: '序章', totalTimeSec: 20, action: 'タンクバスター', damageAmount: 80000, damageType: 'physical', trueColumnIndexes: [3] },
    { phaseLabel: '終章', totalTimeSec: 55, action: '全体攻撃', damageAmount: null, damageType: null, trueColumnIndexes: [3] },
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

  it('フェーズの endTime（中間=次の開始 / 末尾=最終+1）', () => {
    const r = buildPlanFromSheets([sheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.phases.map((p) => [p.name.ja, p.startTime, p.endTime])).toEqual([
      ['開幕', 7, 40],
      ['真偽記憶', 40, 41],
    ]);
  });

  it('複数シートのイベントが Total Time 昇順でインターリーブされ、sheet2 軽減が正しい owner で解決される', () => {
    const r = buildPlanFromSheets([sheet, sheet2], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    // t=7(sheet), t=20(sheet2), t=40(sheet), t=55(sheet2) の順になっているか
    expect(r.timelineEvents.map((e) => e.time)).toEqual([7, 20, 40, 55]);
    // sheet2 の戦士ランパートが両行とも AppliedMitigation として存在し、OT 枠に割り当てられているか
    const warMits = r.timelineMitigations.filter((m) => m.mitigationId === 'rampart_war');
    expect(warMits).toHaveLength(2);
    expect(warMits.map((m) => m.time)).toEqual([20, 55]);
    // 戦士はタンク2枠目=ST に割り当てられるはず（pld が先に MT を占有）
    expect(warMits.every((m) => m.ownerId === 'ST')).toBe(true);
    expect(warMits[0]).toMatchObject({ mitigationId: 'rampart_war', time: 20, duration: 20 });
  });

  it('スプシ仕様(効果時間中ずっとTRUE)→連続TRUEを1回の使用に畳む(duration基準)', () => {
    // リプライザル(duration 15)を 38 で使用→38/43/50 行は同一使用の継続。60 で再使用(>=38+15=53)。
    const durSheet: ParsedSheet = {
      columns: [{ index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' }],
      rows: [
        { phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 43, action: 'b', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 50, action: 'c', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 60, action: 'd', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 63, action: 'e', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
      ],
    };
    const r = buildPlanFromSheets([durSheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    const rep = r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld');
    expect(rep.map((m) => m.time)).toEqual([38, 60]); // 5行TRUEだが2回の使用に畳む
  });
});
