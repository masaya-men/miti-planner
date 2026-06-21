import { describe, it, expect } from 'vitest';
import { parseMitigationSheet } from '../parseMitigationSheet';

const T = (cells: string[]) => cells.join('\t');
const FIXTURE = [
  // --- ブロック1 ---
  T(['Phase','Total Time','Time','Action','Type','Type','Damage','Damage','Damage','Mitigation','Mitigation','Barrier','Heal']),
  T(['TRUE','','','TestBoss','hide','','','','','ナイト','ナイト','hide','白魔道士']),                 // ジョブ行
  T(['FALSE','','','Skill','','','','','','リプライザル','ランパート','ディヴァインヴェール','アサイラム']), // Skill 行
  T(['','','','Assign','','','','','','SELF','SELF','SELF','RANGE_PARTY']),                          // メタ行（col1空→除外）
  T(['','','','Charge','','','','','','1','1','1','1']),                                             // メタ行
  T(['','','','','','','','','','','','','']),                                                       // 空行
  // --- ブロック2（3 行ヘッダー）---
  T(['Phase','Time','','Action','Type','','Damage','','','Mitigation','Mitigation','Barrier','Heal']),
  T(['','','','','','','','','','','','','']),                                                       // ヘッダー2（空）
  T(['','','','','','','Hit','DoT','tick','','','','']),                                             // ヘッダー3（Hit=col6）
  // --- データ行 ---
  T(['戦闘前','-00:05','-00:05','CountdownMarker','','','','','','FALSE','FALSE','FALSE','FALSE']),    // 負時刻→除外
  T(['開幕','00:00','00:00','BattleStart','','','','','','FALSE','FALSE','FALSE','FALSE']),           // time0・dmg/type null
  T(['','00:03','00:03','AA','Physical','','115,000','','','FALSE','FALSE','FALSE','FALSE']),         // 物理115000
  T(['','00:16','00:16','BigBlast','Magic','','1,300,000','','','TRUE','FALSE','FALSE','FALSE']),     // 魔法1.3M・TRUE col9
  T(['PhaseTwo','00:38','00:38','GimmickA','','','','','','FALSE','FALSE','FALSE','TRUE']),           // 無ダメ・TRUE col12・phase変化
  T(['','00:38','00:38','GimmickB','Magic','','220,000','','','TRUE','FALSE','FALSE','FALSE']),       // 同時刻・魔法220000・TRUE col9
  T(['','00:50','00:50','ChargeRow','','','','','','2','◇◇◇','FALSE','FALSE']),                       // 数値/記号→TRUE扱いしない
].join('\n');

describe('parseMitigationSheet (real-geometry synthetic fixture)', () => {
  it('軽減列 (index, job, skillNameRaw) を抽出（hide 列と非ジョブ列を除外）', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.columns).toEqual([
      { index: 9,  job: 'ナイト',   skillNameRaw: 'リプライザル' },
      { index: 10, job: 'ナイト',   skillNameRaw: 'ランパート' },
      { index: 12, job: '白魔道士', skillNameRaw: 'アサイラム' },
    ]);
  });

  it('データ行を Total Time(col1) で抽出し、負時刻・ヘッダー・メタ・空行を除外', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows.map((r) => [r.totalTimeSec, r.action])).toEqual([
      [0, 'BattleStart'],
      [3, 'AA'],
      [16, 'BigBlast'],
      [38, 'GimmickA'],
      [38, 'GimmickB'],
      [50, 'ChargeRow'],
    ]);
  });

  it('damageAmount/damageType（カンマ除去・Physical/Magic/空）', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    const aa = p.rows.find((r) => r.action === 'AA')!;
    expect(aa).toMatchObject({ damageAmount: 115000, damageType: 'physical' });
    const big = p.rows.find((r) => r.action === 'BigBlast')!;
    expect(big).toMatchObject({ damageAmount: 1300000, damageType: 'magical' });
    const start = p.rows.find((r) => r.action === 'BattleStart')!;
    expect(start).toMatchObject({ damageAmount: null, damageType: null });
  });

  it('Phase 列は空行で直前を引き継ぐ', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows.find((r) => r.action === 'AA')!.phaseLabel).toBe('開幕');
    expect(p.rows.find((r) => r.action === 'GimmickB')!.phaseLabel).toBe('PhaseTwo');
  });

  it('TRUE セルのみ trueColumnIndexes に入る（数値/記号/FALSE は無視）', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows.find((r) => r.action === 'BigBlast')!.trueColumnIndexes).toEqual([9]);
    expect(p.rows.find((r) => r.action === 'GimmickA')!.trueColumnIndexes).toEqual([12]);
    expect(p.rows.find((r) => r.action === 'ChargeRow')!.trueColumnIndexes).toEqual([]); // 2 と ◇◇◇ は不採用
  });

  it('同時刻(00:38)の複数イベントを両方保持', () => {
    const p = parseMitigationSheet(FIXTURE)!;
    expect(p.rows.filter((r) => r.totalTimeSec === 38).map((r) => r.action)).toEqual(['GimmickA', 'GimmickB']);
  });

  it('メタ行/データ表が無ければ null', () => {
    expect(parseMitigationSheet('foo\tbar\nbaz\tqux')).toBeNull();
    expect(parseMitigationSheet('')).toBeNull();
  });
});
