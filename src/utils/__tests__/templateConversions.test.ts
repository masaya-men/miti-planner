import {
  parseTimeString,
  formatTime,
  parseTsv,
  guessColumnType,
  parseDamageType,
  parseTarget,
  convertCsvToEvents,
  convertPlanToTemplate,
} from '../templateConversions';
import type { ColumnMapping } from '../templateConversions';

describe('parseTimeString', () => {
  it('"M:SS" 形式をパースする', () => {
    expect(parseTimeString('1:30')).toBe(90);
    expect(parseTimeString('0:05')).toBe(5);
    expect(parseTimeString('10:00')).toBe(600);
  });

  it('"M:SS.x" 形式をパースする（小数切捨て）', () => {
    expect(parseTimeString('1:30.5')).toBe(90);
    expect(parseTimeString('0:03.9')).toBe(3);
  });

  it('負の時間をパースする', () => {
    expect(parseTimeString('-0:10')).toBe(-10);
  });

  it('裸の秒数をパースする', () => {
    expect(parseTimeString('90')).toBe(90);
    expect(parseTimeString('5.7')).toBe(5);
  });

  it('空文字やスペースのみでnullを返す', () => {
    expect(parseTimeString('')).toBeNull();
    expect(parseTimeString('   ')).toBeNull();
  });

  it('パースできない文字列でnullを返す', () => {
    expect(parseTimeString('abc')).toBeNull();
  });
});

describe('formatTime', () => {
  it('秒数を "M:SS" 形式に変換する', () => {
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(600)).toBe('10:00');
  });
});

describe('parseTsv', () => {
  it('TSVをパースする', () => {
    const input = 'a\tb\tc\nd\te\tf';
    const result = parseTsv(input);
    expect(result).toHaveLength(2);
    expect(result[0].cells).toEqual(['a', 'b', 'c']);
    expect(result[1].cells).toEqual(['d', 'e', 'f']);
  });

  it('空行をスキップする', () => {
    const input = 'a\tb\n\nc\td';
    expect(parseTsv(input)).toHaveLength(2);
  });

  it('セルをトリムする', () => {
    const result = parseTsv(' a \t b ');
    expect(result[0].cells).toEqual(['a', 'b']);
  });
});

describe('guessColumnType', () => {
  it('日本語ヘッダーを判定する', () => {
    expect(guessColumnType('時間')).toBe('time');
    expect(guessColumnType('技名')).toBe('name');
    expect(guessColumnType('ダメージ')).toBe('damage');
    expect(guessColumnType('攻撃種別')).toBe('type');
    expect(guessColumnType('対象')).toBe('target');
    expect(guessColumnType('フェーズ')).toBe('phase');
    expect(guessColumnType('ラベル')).toBe('mechanic');
    expect(guessColumnType('ギミック')).toBe('mechanic');
  });

  it('英語ヘッダーを判定する', () => {
    expect(guessColumnType('Time')).toBe('time');
    expect(guessColumnType('Name')).toBe('name');
    expect(guessColumnType('Damage')).toBe('damage');
    expect(guessColumnType('Target')).toBe('target');
    expect(guessColumnType('Phase')).toBe('phase');
    expect(guessColumnType('Label')).toBe('mechanic');
  });

  it('不明なヘッダーは skip', () => {
    expect(guessColumnType('unknown')).toBe('skip');
    expect(guessColumnType('')).toBe('skip');
  });
});

describe('parseDamageType', () => {
  it('種別を判定する', () => {
    expect(parseDamageType('物理')).toBe('physical');
    expect(parseDamageType('physical')).toBe('physical');
    expect(parseDamageType('回避不可')).toBe('unavoidable');
    expect(parseDamageType('時間切れ')).toBe('enrage');
    expect(parseDamageType('魔法')).toBe('magical');
    expect(parseDamageType('')).toBe('magical');
  });
});

describe('parseTarget', () => {
  it('ターゲットを判定する', () => {
    expect(parseTarget('MT')).toBe('MT');
    expect(parseTarget('ST')).toBe('ST');
    expect(parseTarget('AoE')).toBe('AoE');
    expect(parseTarget('')).toBe('AoE');
    expect(parseTarget('全体')).toBe('AoE');
  });
});

describe('convertCsvToEvents', () => {
  const baseMappings: ColumnMapping[] = [
    { index: 0, type: 'time' },
    { index: 1, type: 'name' },
    { index: 2, type: 'damage' },
  ];

  it('基本的なCSV行をイベントに変換する', () => {
    const rows = [
      { cells: ['0:10', 'テスト攻撃', '50000'] },
      { cells: ['0:20', '二撃目', '30000'] },
    ];
    const { events } = convertCsvToEvents(rows, baseMappings);
    expect(events).toHaveLength(2);
    expect(events[0].time).toBe(10);
    expect(events[0].name.ja).toBe('テスト攻撃');
    expect(events[0].damageAmount).toBe(50000);
    expect(events[1].time).toBe(20);
  });

  it('名前のない行はスキップする', () => {
    const rows = [
      { cells: ['0:10', '', '50000'] },
      { cells: ['0:20', '二撃目', '30000'] },
    ];
    const { events } = convertCsvToEvents(rows, baseMappings);
    expect(events).toHaveLength(1);
  });

  it('フェーズ変化を検出する', () => {
    const mappings: ColumnMapping[] = [
      { index: 0, type: 'time' },
      { index: 1, type: 'name' },
      { index: 2, type: 'phase' },
    ];
    const rows = [
      { cells: ['0:00', '攻撃1', 'P1'] },
      { cells: ['1:00', '攻撃2', 'P2'] },
    ];
    const { phases } = convertCsvToEvents(rows, mappings);
    expect(phases).toHaveLength(2);
    expect(phases[0].startTimeSec).toBe(0);
    expect(phases[1].startTimeSec).toBe(60);
  });

  it('フェーズがない場合はデフォルトを生成する', () => {
    const rows = [{ cells: ['0:10', '攻撃', ''] }];
    const { phases } = convertCsvToEvents(rows, baseMappings);
    expect(phases).toHaveLength(1);
    expect(phases[0].id).toBe(1);
    expect(phases[0].startTimeSec).toBe(0);
  });

  it('ギミックグループをlabelsとして生成する', () => {
    const mappings: ColumnMapping[] = [
      { index: 0, type: 'time' },
      { index: 1, type: 'name' },
      { index: 2, type: 'mechanic' },
    ];
    const rows = [
      { cells: ['0:10', '攻撃1', '散開'] },
      { cells: ['0:20', '攻撃2', ''] },
      { cells: ['0:30', '攻撃3', '頭割り'] },
    ];
    const { events, labels } = convertCsvToEvents(rows, mappings);
    // mechanicGroupはイベントに設定されない
    expect(events[0].mechanicGroup).toBeUndefined();
    expect(events[1].mechanicGroup).toBeUndefined();
    expect(events[2].mechanicGroup).toBeUndefined();
    // labelsとして生成される
    expect(labels).toHaveLength(2);
    expect(labels[0].name.ja).toBe('散開');
    expect(labels[1].name.ja).toBe('頭割り');
  });
});

describe('convertPlanToTemplate', () => {
  it('LocalizedStringのフェーズ名をそのまま使用する', () => {
    const planData = {
      timelineEvents: [] as any[],
      phases: [
        { id: 'phase_1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 60 },
        { id: 'phase_2', name: { ja: '二天竜', en: 'Twin Dragons' }, startTime: 60, endTime: 61 },
      ],
    };
    const result = convertPlanToTemplate(planData, 'test');
    const name0 = result.phases[0].name as { ja: string; en: string };
    expect(name0.ja).toBe('P1');
    expect(name0.en).toBe('P1');
    const name1 = result.phases[1].name as { ja: string; en: string };
    expect(name1.ja).toBe('二天竜');
    expect(name1.en).toBe('Twin Dragons');
  });

  it('フェーズIDを数値に変換する', () => {
    const planData = {
      timelineEvents: [] as any[],
      phases: [{ id: 'phase_3', name: { ja: 'P3', en: 'P3' }, startTime: 30, endTime: 31 }],
    };
    const result = convertPlanToTemplate(planData, 'test');
    expect(result.phases[0].id).toBe(3);
  });

  it('フェーズのstartTimeSecを正しく計算する', () => {
    const planData = {
      timelineEvents: [] as any[],
      phases: [
        { id: 'phase_1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 60 },
        { id: 'phase_2', name: { ja: 'P2', en: 'P2' }, startTime: 60, endTime: 61 },
      ],
    };
    const result = convertPlanToTemplate(planData, 'test');
    expect(result.phases[0].startTimeSec).toBe(0);
    expect(result.phases[1].startTimeSec).toBe(60);
  });

  it('イベントの標準フィールドをコピーする', () => {
    const planData = {
      timelineEvents: [
        {
          id: 'ev1', time: 10,
          name: { ja: 'テスト', en: 'Test' },
          damageType: 'magical' as const,
          damageAmount: 50000,
          target: 'AoE' as const,
        },
      ],
      phases: [{ id: 'phase_1', name: { ja: 'P1', en: 'P1' }, startTime: 0, endTime: 1 }],
    };
    const result = convertPlanToTemplate(planData, 'test');
    const ev = result.timelineEvents[0];
    expect(ev.name.ja).toBe('テスト');
    expect(ev.damageAmount).toBe(50000);
    // mechanicGroupはコピーされない
    expect(ev.mechanicGroup).toBeUndefined();
  });
});
