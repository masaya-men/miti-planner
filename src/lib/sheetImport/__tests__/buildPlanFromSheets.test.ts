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

// sheet2: 戦士のランパートが t=20 と t=55 で別々に使われる（間の t=42 は非TRUE＝2つの run に分離）。
// 実データのスプシは「2回の使用」を必ず TRUE-run の間に FALSE/欠落行を挟んで表現する。
const sheet2: ParsedSheet = {
  columns: [
    { index: 3, job: '戦士', skillNameRaw: 'ランパート' },
  ],
  rows: [
    { phaseLabel: '序章', totalTimeSec: 20, action: 'タンクバスター', damageAmount: 80000, damageType: 'physical', trueColumnIndexes: [3] },
    { phaseLabel: '序章', totalTimeSec: 42, action: '雑魚処理', damageAmount: null, damageType: null, trueColumnIndexes: [] },
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

  it('シート境界が Total Time で重なってもフェーズは交互化(ピンポン)せず単調', () => {
    // 実データは各タブ(フェーズ)の末尾と次タブの先頭が数秒重なる。
    // 例: sheetA(Alpha) が 10-50、sheetB(Beta) が 45 から始まる→naive な merged 走査だと
    // Alpha→Beta→Alpha→Beta とピンポンする。シート単位でフェーズを作れば単調になる。
    const overlapA: ParsedSheet = {
      columns: [],
      rows: [
        { phaseLabel: 'Alpha', totalTimeSec: 10, action: 'a1', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'Alpha', totalTimeSec: 20, action: 'a2', damageAmount: null, damageType: null, trueColumnIndexes: [] },
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
    const r = buildPlanFromSheets([overlapA, overlapB], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    // Alpha は 1 回だけ、Beta は 1 回だけ。startTime 単調。endTime=次フェーズ開始/末尾+1。
    expect(r.phases.map((p) => [p.name.ja, p.startTime, p.endTime])).toEqual([
      ['Alpha', 10, 45],
      ['Beta', 45, 61],
    ]);
  });

  it('複数シートのイベントが Total Time 昇順でインターリーブされ、sheet2 軽減が正しい owner で解決される', () => {
    const r = buildPlanFromSheets([sheet, sheet2], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    // t=7(sheet), t=20(sheet2), t=40(sheet), t=42(sheet2 gap), t=55(sheet2) の順になっているか
    expect(r.timelineEvents.map((e) => e.time)).toEqual([7, 20, 40, 42, 55]);
    // sheet2 の戦士ランパートは 2 つの run（20 と 55、間の 42 で切れる）として 2 配置
    const warMits = r.timelineMitigations.filter((m) => m.mitigationId === 'rampart_war');
    expect(warMits).toHaveLength(2);
    expect(warMits.map((m) => m.time)).toEqual([20, 55]);
    // 戦士はタンク2枠目=ST に割り当てられるはず（pld が先に MT を占有）
    expect(warMits.every((m) => m.ownerId === 'ST')).toBe(true);
    expect(warMits[0]).toMatchObject({ mitigationId: 'rampart_war', time: 20, duration: 20 });
  });

  it('スプシ仕様(効果時間中ずっとTRUE)→連続TRUE-runは行数・span に関係なく run 先頭で1配置(rising-edge)', () => {
    // リプライザル(duration 15)を 38 で使用。38/43/50/60/63 は途中に FALSE/欠落行が無い＝1つの連続 run。
    // span(63-38=25)が duration(15)を超えても、recast 中に撃ち直せない以上 1 回の使用。
    // → run 先頭 38 に 1 配置のみ（旧 duration 基準だと 60 に余分配置されていた＝効果終端の幽霊配置）。
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
    expect(rep.map((m) => m.time)).toEqual([38]); // 5行連続TRUE = 1回の使用
  });

  it('FALSE/欠落行で切れた別の TRUE-run は別の使用として配置(rising-edge)', () => {
    // 38-43 で TRUE → 50 で非TRUE(切れる) → 60-63 で再び TRUE。2 つの run = 2 配置。
    const reuseSheet: ParsedSheet = {
      columns: [{ index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' }],
      rows: [
        { phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 43, action: 'b', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 50, action: 'c', damageAmount: null, damageType: null, trueColumnIndexes: [] },
        { phaseLabel: 'P', totalTimeSec: 60, action: 'd', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
        { phaseLabel: 'P', totalTimeSec: 63, action: 'e', damageAmount: null, damageType: null, trueColumnIndexes: [5] },
      ],
    };
    const r = buildPlanFromSheets([reuseSheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    const rep = r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld');
    expect(rep.map((m) => m.time)).toEqual([38, 60]); // FALSE で切れた 2 run = 2 配置
  });

  it('同一(技/時刻/枠)の重複配置を排除する(同一技が複数列・同時刻イベント等の保険)', () => {
    // 同じ (ナイト, リプライザル) が 2 列に現れ、同時刻に両方 TRUE のケース
    const dupSheet: ParsedSheet = {
      columns: [
        { index: 5, job: 'ナイト', skillNameRaw: 'リプライザル' },
        { index: 6, job: 'ナイト', skillNameRaw: 'リプライザル' },
      ],
      rows: [
        { phaseLabel: 'P', totalTimeSec: 38, action: 'a', damageAmount: null, damageType: null, trueColumnIndexes: [5, 6] },
        { phaseLabel: 'P', totalTimeSec: 41, action: 'b', damageAmount: null, damageType: null, trueColumnIndexes: [5, 6] },
      ],
    };
    const r = buildPlanFromSheets([dupSheet], { mitigations: MITS, jobs: JOBS }, { includeMitigations: true });
    // 重複列×継続TRUE でも、reprisal_pld@MT@38 は 1 個だけ
    expect(r.timelineMitigations.filter((m) => m.mitigationId === 'reprisal_pld')).toHaveLength(1);
    expect(r.timelineMitigations[0]).toMatchObject({ mitigationId: 'reprisal_pld', ownerId: 'MT', time: 38 });
  });
});
