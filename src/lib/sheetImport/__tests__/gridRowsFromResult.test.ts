import { describe, it, expect } from 'vitest';
import { gridRowsFromResult } from '../gridRowsFromResult';
import type { SheetImportResult } from '../buildPlanFromSheets';
import type { Mitigation, Job } from '../../../types/index';

// ─── テスト用フィクスチャ ───────────────────────────────────────────────────

const JOBS: Job[] = [
  { id: 'pld', name: { ja: 'ナイト', en: 'Paladin' }, role: 'tank', icon: '' },
  { id: 'whm', name: { ja: '白魔道士', en: 'White Mage' }, role: 'healer', icon: '' },
];

const MITIGATIONS: Mitigation[] = [
  {
    id: 'sentinel',
    jobId: 'pld',
    name: { ja: 'センチネル', en: 'Sentinel' },
    icon: '',
    recast: 120,
    duration: 15,
    type: 'all',
    value: 30,
  },
  {
    id: 'medica2',
    jobId: 'whm',
    name: { ja: 'メディカラ', en: 'Medica II', ko: '메디카라' },
    icon: '',
    recast: 60,
    duration: 15,
    type: 'all',
    value: 10,
  },
];

/** 最小限の SheetImportResult を組み立てる */
function makeResult(overrides: Partial<SheetImportResult> = {}): SheetImportResult {
  return {
    timelineEvents: [],
    timelineMitigations: [],
    phases: [],
    labels: [],
    party: [],
    skipped: [],
    ...overrides,
  };
}

// ─── テスト ────────────────────────────────────────────────────────────────

describe('gridRowsFromResult', () => {
  it('列順: canonical 7 列 → party の member 列が続く', () => {
    const result = makeResult({
      party: [
        { slot: 'MT', jobId: 'pld' },
        { slot: 'H1', jobId: 'whm' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');

    expect(table.columns.map((c) => c.field)).toEqual([
      'phase', 'label', 'time', 'action', 'damage', 'target', 'damageType',
      'member', 'member',
    ]);
    // member 列の jobId と header (ローカライズ済みジョブ名)
    expect(table.columns[7].jobId).toBe('pld');
    expect(table.columns[7].header).toBe('ナイト');
    expect(table.columns[8].jobId).toBe('whm');
    expect(table.columns[8].header).toBe('白魔道士');
  });

  it('en lang で member 列 header がジョブ英語名になる', () => {
    const result = makeResult({
      party: [{ slot: 'MT', jobId: 'pld' }],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'en');
    expect(table.columns[7].header).toBe('Paladin');
  });

  it('time セルが M:SS 形式になる(正の秒)', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e1', time: 43, name: { ja: '波動砲', en: 'Photon Ray' }, damageType: 'magical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    // time 列 index=2
    expect(table.rows[0][2]).toBe('0:43');
  });

  it('damageType セルが ja でローカライズされる', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '魔法攻撃', en: 'Magic Attack' }, damageType: 'magical' },
        { id: 'e2', time: 20, name: { ja: '物理攻撃', en: 'Physical Attack' }, damageType: 'physical' },
        { id: 'e3', time: 30, name: { ja: '時間切れ', en: 'Enrage' }, damageType: 'enrage' },
        { id: 'e4', time: 40, name: { ja: '回避不可', en: 'Unavoidable' }, damageType: 'unavoidable' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    // damageType 列 = index 6
    expect(table.rows[0][6]).toBe('魔法');
    expect(table.rows[1][6]).toBe('物理');
    expect(table.rows[2][6]).toBe('時間切れ');
    expect(table.rows[3][6]).toBe('回避不可');
  });

  it('damageType セルが en でローカライズされる', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '魔法攻撃', en: 'Magic Attack' }, damageType: 'magical' },
        { id: 'e2', time: 20, name: { ja: '回避不可', en: 'Unavoidable' }, damageType: 'unavoidable' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'en');
    expect(table.rows[0][6]).toBe('Magic');
    expect(table.rows[1][6]).toBe('Unavoidable');
  });

  it('time セルが M:SS 形式になる(60 秒以上)', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e2', time: 125, name: { ja: '攻撃', en: 'Attack' }, damageType: 'physical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][2]).toBe('2:05');
  });

  it('time セルが M:SS 形式になる(負の秒)', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e3', time: -10, name: { ja: 'プリキャスト', en: 'Precast' }, damageType: 'magical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][2]).toBe('-0:10');
  });

  it('member セルにマッチ時刻のスキル名 (ja) が入る', () => {
    const result = makeResult({
      party: [{ slot: 'MT', jobId: 'pld' }],
      timelineEvents: [
        { id: 'e1', time: 20, name: { ja: '波動砲', en: 'Blast' }, damageType: 'magical' },
      ],
      timelineMitigations: [
        { id: 'm1', mitigationId: 'sentinel', time: 20, duration: 15, ownerId: 'MT' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    // member 列 = index 7
    expect(table.rows[0][7]).toBe('センチネル');
  });

  it('member セルに複数スキルが " / " 区切りで入る', () => {
    const result = makeResult({
      party: [{ slot: 'MT', jobId: 'pld' }],
      timelineEvents: [
        { id: 'e1', time: 20, name: { ja: '波動砲', en: 'Blast' }, damageType: 'magical' },
      ],
      timelineMitigations: [
        { id: 'm1', mitigationId: 'sentinel', time: 20, duration: 15, ownerId: 'MT' },
        { id: 'm2', mitigationId: 'sentinel', time: 20, duration: 15, ownerId: 'MT' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][7]).toBe('センチネル / センチネル');
  });

  it('時刻が合わない member セルは空文字', () => {
    const result = makeResult({
      party: [{ slot: 'MT', jobId: 'pld' }],
      timelineEvents: [
        { id: 'e1', time: 20, name: { ja: '波動砲', en: 'Blast' }, damageType: 'magical' },
      ],
      timelineMitigations: [
        { id: 'm1', mitigationId: 'sentinel', time: 30, duration: 15, ownerId: 'MT' }, // 時刻ズレ
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][7]).toBe('');
  });

  it('phase セルがバンド内の名前になる', () => {
    const result = makeResult({
      phases: [
        { id: 'ph1', name: { ja: 'フェーズ1', en: 'Phase 1' }, startTime: 0, endTime: 60 },
        { id: 'ph2', name: { ja: 'フェーズ2', en: 'Phase 2' }, startTime: 60, endTime: 200 },
      ],
      timelineEvents: [
        { id: 'e1', time: 43, name: { ja: '波動砲', en: 'Blast' }, damageType: 'magical' },
        { id: 'e2', time: 80, name: { ja: '全体攻撃', en: 'AoE' }, damageType: 'magical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][0]).toBe('フェーズ1');
    expect(table.rows[1][0]).toBe('フェーズ2');
  });

  it('en lang で phase セルが英語名になる', () => {
    const result = makeResult({
      phases: [
        { id: 'ph1', name: { ja: 'フェーズ1', en: 'Phase 1' }, startTime: 0, endTime: 100 },
      ],
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '攻撃', en: 'Attack' }, damageType: 'magical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'en');
    expect(table.rows[0][0]).toBe('Phase 1');
  });

  it('label セルがバンド内の名前になる', () => {
    const result = makeResult({
      labels: [
        { id: 'lb1', name: { ja: '散会', en: 'Spread' }, startTime: 0, endTime: 50 },
      ],
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '攻撃', en: 'Attack' }, damageType: 'magical' },
        { id: 'e2', time: 60, name: { ja: '攻撃2', en: 'Attack2' }, damageType: 'magical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][1]).toBe('散会'); // startTime <= 10 < 50
    expect(table.rows[1][1]).toBe('');     // 60 はバンド外
  });

  it('イベントが time 昇順でソートされる', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e2', time: 50, name: { ja: 'B', en: 'B' }, damageType: 'magical' },
        { id: 'e1', time: 10, name: { ja: 'A', en: 'A' }, damageType: 'magical' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][3]).toBe('A');
    expect(table.rows[1][3]).toBe('B');
  });

  it('damage セルが toLocaleString された文字列', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '攻撃', en: 'Attack' }, damageType: 'magical', damageAmount: 128000 },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    // damageAmount あり → toLocaleString
    expect(table.rows[0][4]).toBe((128000).toLocaleString());
  });

  it('damage セルが undefined なら空文字', () => {
    const result = makeResult({
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '攻撃', en: 'Attack' }, damageType: 'unavoidable' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ja');
    expect(table.rows[0][4]).toBe('');
  });

  it('ko lang で member セルのスキル名が ko になる', () => {
    const result = makeResult({
      party: [{ slot: 'H1', jobId: 'whm' }],
      timelineEvents: [
        { id: 'e1', time: 10, name: { ja: '攻撃', en: 'Attack' }, damageType: 'magical' },
      ],
      timelineMitigations: [
        { id: 'm1', mitigationId: 'medica2', time: 10, duration: 15, ownerId: 'H1' },
      ],
    });
    const table = gridRowsFromResult(result, { mitigations: MITIGATIONS, jobs: JOBS }, 'ko');
    expect(table.rows[0][7]).toBe('메디카라');
  });
});

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
