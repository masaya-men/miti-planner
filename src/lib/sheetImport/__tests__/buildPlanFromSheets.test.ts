import { describe, it, expect } from 'vitest';
import { buildPlanFromSheets } from '../buildPlanFromSheets';
import type { ParsedSheet, ImportSheet } from '../types';
import type { Mitigation, Job } from '../../../types';

const M = (id: string, jobId: string, ja: string, duration = 10): Mitigation =>
  ({ id, jobId, name: { ja, en: ja }, recast: 0, duration, type: 'all', value: 0 } as Mitigation);
const J = (id: string, role: 'tank' | 'healer' | 'dps'): Job =>
  ({ id, name: { ja: id, en: id }, role, icon: '' } as Job);
const IS = (parsed: ParsedSheet, phaseName: string): ImportSheet => ({ parsed, phaseName });

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

const sheet2: ParsedSheet = {
  columns: [{ index: 3, job: '戦士', skillNameRaw: 'ランパート' }],
  rows: [
    { phaseLabel: '序章', totalTimeSec: 20, action: 'タンクバスター', damageAmount: 80000, damageType: 'physical', trueColumnIndexes: [3] },
    { phaseLabel: '序章', totalTimeSec: 42, action: '雑魚処理', damageAmount: null, damageType: null, trueColumnIndexes: [] },
    { phaseLabel: '終章', totalTimeSec: 55, action: '全体攻撃', damageAmount: null, damageType: null, trueColumnIndexes: [3] },
  ],
};

describe('buildPlanFromSheets', () => {
  it('TimelineEvent を Total Time 順に作る（damageType 既定 magical・name.ja=action）', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineEvents.map((e) => [e.time, e.name.ja, e.damageType])).toEqual([
      [7, 'AA', 'physical'], [40, 'なぞなぞ', 'magical'],
    ]);
  });

  it('TRUE セル→AppliedMitigation（owner=枠・time=通し・duration=スナップショット）', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations).toHaveLength(1);
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'MT', time: 7, duration: 15 });
  });

  it('未対応技は skipped に集約', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.skipped).toContainEqual(expect.objectContaining({ job: '白魔道士', skillName: 'ベネディクション' }));
  });

  it('skipped に slot と times が付く', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    const s = r.skipped.find((x) => x.skillName === 'ベネディクション');
    expect(s?.slot).toBe('H1');       // 白魔道士=whm=healer→H1
    expect(s?.times).toEqual([40]);   // totalTimeSec=40 の行が TRUE
  });

  it('phases はユーザー入力フェーズ名（1 シート 1 フェーズ・シート時間範囲）', () => {
    const r = buildPlanFromSheets(
      [IS(sheet, 'P1 ケフカ'), IS(sheet2, 'P2 ゴッドケフカ')],
      { mitigations: MITS, jobs: JOBS }, { includeMitigations: true },
    );
    expect(r.phases.map((p) => [p.name.ja, p.startTime, p.endTime])).toEqual([
      ['P1 ケフカ', 7, 20],   // sheet 開始7 → 次シート開始20
      ['P2 ゴッドケフカ', 20, 56], // sheet2 開始20 → maxTime(55)+1
    ]);
  });

  it('labels はスプシ Phase 列由来（連続同名チャンク・endTime=次/末尾+1・空ラベルは作らない）', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.labels.map((l) => [l.name.ja, l.startTime, l.endTime])).toEqual([
      ['開幕', 7, 40],
      ['真偽記憶', 40, 41],
    ]);
  });

  it('includeMitigations=false でも phases/labels は出る・軽減とパーティは空', () => {
    const r = buildPlanFromSheets([IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: false });
    expect(r.timelineMitigations).toEqual([]);
    expect(r.party).toEqual([]);
    expect(r.timelineEvents).toHaveLength(2);
    expect(r.phases.map((p) => p.name.ja)).toEqual(['P1']);
    expect(r.labels.map((l) => l.name.ja)).toEqual(['開幕', '真偽記憶']);
  });

  it('シート境界が重なっても labels は交互化(ピンポン)せず単調', () => {
    const overlapA: ParsedSheet = {
      columns: [],
      rows: [
        { phaseLabel: 'Alpha', totalTimeSec: 10, action: 'a1', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'Alpha', totalTimeSec: 50, action: 'a3', damageAmount: null, damageType: null, trueColumnIndexes: [] },
      ],
    };
    const overlapB: ParsedSheet = {
      columns: [],
      rows: [
        { phaseLabel: 'Beta', totalTimeSec: 45, action: 'b1', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'Beta', totalTimeSec: 60, action: 'b2', damageAmount: null, damageType: null, trueColumnIndexes: [] },
      ],
    };
    const r = buildPlanFromSheets(
      [IS(overlapA, 'Pa'), IS(overlapB, 'Pb')],
      { mitigations: MITS, jobs: JOBS }, { includeMitigations: true },
    );
    expect(r.labels.map((l) => [l.name.ja, l.startTime, l.endTime])).toEqual([
      ['Alpha', 10, 45],
      ['Beta', 45, 61],
    ]);
  });

  it('複数シートのイベントが Total Time 昇順・sheet2 軽減が正しい owner(ST) で解決', () => {
    const r = buildPlanFromSheets(
      [IS(sheet, 'P1'), IS(sheet2, 'P2')],
      { mitigations: MITS, jobs: JOBS }, { includeMitigations: true },
    );
    expect(r.timelineEvents.map((e) => e.time)).toEqual([7, 20, 40, 42, 55]);
    const warMits = r.timelineMitigations.filter((m) => m.mitigationId === 'rampart_war');
    expect(warMits).toHaveLength(2);
    expect(warMits.map((m) => m.time)).toEqual([20, 55]);
    expect(warMits.every((m) => m.ownerId === 'ST')).toBe(true);
  });

  it('連続TRUE-run は run 先頭で1配置(rising-edge)', () => {
    const durSheet: ParsedSheet = {
      columns: [{ index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' }],
      rows: [38, 43, 50, 60, 63].map((t) => ({
        phaseLabel: 'P', totalTimeSec: t, action: String(t), damageAmount: null, damageType: null, trueColumnIndexes: [5],
      })),
    };
    const r = buildPlanFromSheets([IS(durSheet, 'P')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld').map((m) => m.time)).toEqual([38]);
  });

  it('FALSE/欠落行で切れた別 run は別配置(rising-edge)', () => {
    const reuseSheet: ParsedSheet = {
      columns: [{ index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' }],
      rows: [
        { phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 50, action: 'c', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'P', totalTimeSec: 60, action: 'd', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
      ],
    };
    const r = buildPlanFromSheets([IS(reuseSheet, 'P')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld').map((m) => m.time)).toEqual([38, 60]);
  });

  it('同一(技/時刻/枠)の重複配置を排除', () => {
    const dupSheet: ParsedSheet = {
      columns: [
        { index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' },
        { index: 6, job: 'ナイト', skillNameRaw: 'リプライザル' },
      ],
      rows: [{ phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5, 6] }],
    };
    const r = buildPlanFromSheets([IS(dupSheet, 'P')], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld')).toHaveLength(1);
  });

  it('partyOverride を渡すと owner がそれに従う（軽減数は不変）', () => {
    // 通常 pld=MT だが override で pld=ST にすると owner が ST になる
    const r = buildPlanFromSheets(
      [IS(sheet, 'P1')], { mitigations: MITS, jobs: JOBS },
      { includeMitigations: true, partyOverride: [{ slot: 'ST', jobId: 'pld' }] },
    );
    expect(r.timelineMitigations).toHaveLength(1);
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'ST' });
    expect(r.party).toEqual([{ slot: 'ST', jobId: 'pld' }]);
  });
});
