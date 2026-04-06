# テスト基盤構築 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** コア機能（ダメージ計算・テンプレート変換・FFLogsインポート・フェーズ編集）を壊さないためのテスト安全網を構築する

**Architecture:** Vitest（既存設定済み）で5ファイルの純粋関数・フックをテスト。`src/**/__tests__/**/*.test.ts` パターンに従う。外部依存（Firebase等）はモック不要な範囲でテスト。

**Tech Stack:** Vitest 4.1.2（既存）、@testing-library/react（新規追加）

**Spec:** `docs/superpowers/specs/2026-04-06-test-infrastructure-design.md`

---

### Task 1: damageRounding.test.ts

**Files:**
- Create: `src/utils/__tests__/damageRounding.test.ts`
- Tested: `src/utils/damageRounding.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
import { describe, it, expect } from 'vitest';
import { roundDamageCeil } from '../damageRounding';

describe('roundDamageCeil', () => {
  it('999以下はそのまま返す', () => {
    expect(roundDamageCeil(312)).toBe(312);
    expect(roundDamageCeil(999)).toBe(999);
    expect(roundDamageCeil(0)).toBe(0);
    expect(roundDamageCeil(1)).toBe(1);
  });

  it('負の値はそのまま返す', () => {
    expect(roundDamageCeil(-100)).toBe(-100);
  });

  it('4桁: 3有効桁で切り上げ', () => {
    expect(roundDamageCeil(8523)).toBe(8530);
    expect(roundDamageCeil(1000)).toBe(1000);
    expect(roundDamageCeil(1001)).toBe(1010);
  });

  it('5桁: 3有効桁で切り上げ', () => {
    expect(roundDamageCeil(42876)).toBe(42900);
    expect(roundDamageCeil(10000)).toBe(10000);
    expect(roundDamageCeil(10001)).toBe(10100);
  });

  it('6桁: 3有効桁で切り上げ', () => {
    expect(roundDamageCeil(156234)).toBe(157000);
    expect(roundDamageCeil(150000)).toBe(150000);
    expect(roundDamageCeil(100001)).toBe(101000);
  });

  it('ちょうど割り切れる値は変わらない', () => {
    expect(roundDamageCeil(5000)).toBe(5000);
    expect(roundDamageCeil(12300)).toBe(12300);
    expect(roundDamageCeil(456000)).toBe(456000);
  });
});
```

- [ ] **Step 2: テスト実行して全パスを確認**

Run: `npx vitest run src/utils/__tests__/damageRounding.test.ts`
Expected: 全テストPASS

- [ ] **Step 3: コミット**

```bash
git add src/utils/__tests__/damageRounding.test.ts
git commit -m "test: damageRounding の丸め計算テスト追加"
```

---

### Task 2: templateConversions.test.ts

**Files:**
- Create: `src/utils/__tests__/templateConversions.test.ts`
- Tested: `src/utils/templateConversions.ts`

- [ ] **Step 1: テストファイルを作成**

```typescript
import { describe, it, expect } from 'vitest';
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

// ── parseTimeString ──
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

  it('空文字やnullでnullを返す', () => {
    expect(parseTimeString('')).toBeNull();
    expect(parseTimeString('   ')).toBeNull();
  });

  it('パースできない文字列でnullを返す', () => {
    expect(parseTimeString('abc')).toBeNull();
    expect(parseTimeString('1:2:3')).toBeNull();
  });
});

// ── formatTime ──
describe('formatTime', () => {
  it('秒数を "M:SS" 形式に変換する', () => {
    expect(formatTime(90)).toBe('1:30');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(600)).toBe('10:00');
  });
});

// ── parseTsv ──
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

// ── guessColumnType ──
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

// ── parseDamageType ──
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

// ── parseTarget ──
describe('parseTarget', () => {
  it('ターゲットを判定する', () => {
    expect(parseTarget('MT')).toBe('MT');
    expect(parseTarget('ST')).toBe('ST');
    expect(parseTarget('mt')).toBe('MT');
    expect(parseTarget('AoE')).toBe('AoE');
    expect(parseTarget('')).toBe('AoE');
    expect(parseTarget('全体')).toBe('AoE');
  });
});

// ── convertCsvToEvents ──
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
    const { events, phases } = convertCsvToEvents(rows, baseMappings);
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

  it('ギミックグループを継承する', () => {
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
    const { events } = convertCsvToEvents(rows, mappings);
    expect(events[0].mechanicGroup?.ja).toBe('散開');
    expect(events[1].mechanicGroup?.ja).toBe('散開');
    expect(events[2].mechanicGroup?.ja).toBe('頭割り');
  });
});

// ── convertPlanToTemplate ──
describe('convertPlanToTemplate', () => {
  it('フェーズ名の改行をストリップする（string型）', () => {
    const planData = {
      timelineEvents: [],
      phases: [
        { id: 'phase_1', name: 'Phase 1\nP1', endTime: 60 },
        { id: 'phase_2', name: 'Phase 2\n二天竜', endTime: 120 },
      ],
    };
    const result = convertPlanToTemplate(planData, 'test');
    expect(result.phases[0].name).toBe('P1');
    expect(result.phases[1].name).toBe('二天竜');
  });

  it('フェーズ名の改行をストリップする（LocalizedString型）', () => {
    const planData = {
      timelineEvents: [],
      phases: [
        {
          id: 'phase_1',
          name: { ja: 'Phase 1\n散開', en: 'Phase 1\nSpread' },
          endTime: 60,
        },
      ],
    };
    const result = convertPlanToTemplate(planData, 'test');
    const name = result.phases[0].name as { ja: string; en: string };
    expect(name.ja).toBe('散開');
    expect(name.en).toBe('Spread');
  });

  it('改行なしのフェーズ名はそのまま', () => {
    const planData = {
      timelineEvents: [],
      phases: [{ id: 'phase_1', name: 'テスト', endTime: 60 }],
    };
    const result = convertPlanToTemplate(planData, 'test');
    expect(result.phases[0].name).toBe('テスト');
  });

  it('フェーズIDを数値に変換する', () => {
    const planData = {
      timelineEvents: [],
      phases: [
        { id: 'phase_3', name: 'P3', endTime: 60 },
      ],
    };
    const result = convertPlanToTemplate(planData, 'test');
    expect(result.phases[0].id).toBe(3);
  });

  it('フェーズのstartTimeSecを正しく計算する', () => {
    const planData = {
      timelineEvents: [],
      phases: [
        { id: 'phase_1', name: 'P1', endTime: 60 },
        { id: 'phase_2', name: 'P2', endTime: 120 },
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
          id: 'ev1',
          time: 10,
          name: { ja: 'テスト', en: 'Test' },
          damageType: 'magical' as const,
          damageAmount: 50000,
          target: 'AoE' as const,
          mechanicGroup: { ja: '散開', en: 'Spread' },
        },
      ],
      phases: [{ id: 'phase_1', name: 'P1', endTime: 60 }],
    };
    const result = convertPlanToTemplate(planData, 'test');
    const ev = result.timelineEvents[0];
    expect(ev.name.ja).toBe('テスト');
    expect(ev.damageAmount).toBe(50000);
    expect(ev.mechanicGroup?.ja).toBe('散開');
  });
});
```

- [ ] **Step 2: テスト実行して全パスを確認**

Run: `npx vitest run src/utils/__tests__/templateConversions.test.ts`
Expected: 全テストPASS

- [ ] **Step 3: コミット**

```bash
git add src/utils/__tests__/templateConversions.test.ts
git commit -m "test: templateConversions のパース・変換テスト追加"
```

---

### Task 3: calculator.test.ts

**Files:**
- Create: `src/utils/__tests__/calculator.test.ts`
- Tested: `src/utils/calculator.ts`

- [ ] **Step 1: テストファイルを作成**

Lv100のモディファイアは既知定数: `{ level: 100, main: 440, sub: 420, div: 2780 }`。
`calculatePotencyValue` は `LevelModifier` を引数で受け取るのでストア依存なし。

```typescript
import { describe, it, expect } from 'vitest';
import {
  calculatePotencyValue,
  calculateCriticalValue,
  calculateHpValue,
  getColumnWidth,
  CRIT_MULTIPLIER,
} from '../calculator';
import type { LevelModifier } from '../../data/levelModifiers';

const LV100_MODS: LevelModifier = {
  level: 100,
  main: 440,
  sub: 420,
  div: 2780,
};

// ヒーラー相当のステータス
const healerStats = {
  mainStat: 4800,
  det: 2200,
  crt: 2800,
  ten: 420,
  ss: 650,
  wd: 141,
};

// タンク相当のステータス
const tankStats = {
  mainStat: 4600,
  det: 2100,
  crt: 2700,
  ten: 900,
  ss: 500,
  wd: 141,
};

describe('calculatePotencyValue', () => {
  it('ヒーラーのポテンシー計算が正の整数を返す', () => {
    const result = calculatePotencyValue(healerStats, 300, 'healer', LV100_MODS);
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('タンクのポテンシー計算にテナシティが反映される', () => {
    const withoutTen = calculatePotencyValue(
      { ...tankStats, ten: LV100_MODS.sub },
      300,
      'tank',
      LV100_MODS,
    );
    const withTen = calculatePotencyValue(tankStats, 300, 'tank', LV100_MODS);
    expect(withTen).toBeGreaterThan(withoutTen);
  });

  it('非タンクはテナシティが無効', () => {
    const result1 = calculatePotencyValue(
      { ...healerStats, ten: 420 },
      300,
      'healer',
      LV100_MODS,
    );
    const result2 = calculatePotencyValue(
      { ...healerStats, ten: 9999 },
      300,
      'healer',
      LV100_MODS,
    );
    expect(result1).toBe(result2);
  });

  it('ポテンシーが高いほど値が大きい', () => {
    const low = calculatePotencyValue(healerStats, 100, 'healer', LV100_MODS);
    const high = calculatePotencyValue(healerStats, 500, 'healer', LV100_MODS);
    expect(high).toBeGreaterThan(low);
  });

  it('武器ダメージが高いほど値が大きい', () => {
    const low = calculatePotencyValue({ ...healerStats, wd: 100 }, 300, 'healer', LV100_MODS);
    const high = calculatePotencyValue({ ...healerStats, wd: 200 }, 300, 'healer', LV100_MODS);
    expect(high).toBeGreaterThan(low);
  });
});

describe('calculateCriticalValue', () => {
  it('クリティカル倍率が適用される', () => {
    const base = 10000;
    const result = calculateCriticalValue(base);
    expect(result).toBe(Math.floor(base * CRIT_MULTIPLIER));
  });

  it('0の場合は0', () => {
    expect(calculateCriticalValue(0)).toBe(0);
  });
});

describe('calculateHpValue', () => {
  it('HP割合計算が正しい', () => {
    expect(calculateHpValue(100000, 10)).toBe(10000);
    expect(calculateHpValue(100000, 25)).toBe(25000);
  });

  it('端数は切り捨て', () => {
    expect(calculateHpValue(100001, 10)).toBe(10000);
  });
});

describe('getColumnWidth', () => {
  it('タンク/ヒーラーは125px', () => {
    expect(getColumnWidth('tank')).toBe(125);
    expect(getColumnWidth('healer')).toBe(125);
  });

  it('DPSは50px', () => {
    expect(getColumnWidth('dps')).toBe(50);
  });
});
```

- [ ] **Step 2: テスト実行して全パスを確認**

Run: `npx vitest run src/utils/__tests__/calculator.test.ts`
Expected: 全テストPASS

- [ ] **Step 3: コミット**

```bash
git add src/utils/__tests__/calculator.test.ts
git commit -m "test: calculator のポテンシー・HP計算テスト追加"
```

---

### Task 4: fflogsMapper.test.ts

**Files:**
- Create: `src/utils/__tests__/fflogsMapper.test.ts`
- Tested: `src/utils/fflogsMapper.ts`

- [ ] **Step 1: テストデータヘルパーとテストファイルを作成**

`mapFFLogsToTimeline` に渡す最小限のテストデータを使って統合テスト。
内部関数（computeAoEDamage等）はexportされていないため、メイン関数経由でカバー。

```typescript
import { describe, it, expect } from 'vitest';
import { mapFFLogsToTimeline } from '../fflogsMapper';
import type { FFLogsRawEvent, FFLogsFight, DeathEvent, PlayerDetails } from '../../api/fflogs';

// ── テストデータヘルパー ──

const BASE_TIME = 1000000; // fight.startTime

function makeFight(overrides?: Partial<FFLogsFight>): FFLogsFight {
  return {
    id: 1,
    startTime: BASE_TIME,
    endTime: BASE_TIME + 300000,
    name: 'Test Boss',
    kill: true,
    ...overrides,
  } as FFLogsFight;
}

function makePlayers(tanks: number[] = [1, 2]): PlayerDetails {
  return {
    tanks: tanks.map((id) => ({ id, name: `Tank${id}`, type: 'Unknown', server: '' })),
    healers: [
      { id: 3, name: 'Healer1', type: 'Unknown', server: '' },
      { id: 4, name: 'Healer2', type: 'Unknown', server: '' },
    ],
    dps: [
      { id: 5, name: 'DPS1', type: 'Unknown', server: '' },
      { id: 6, name: 'DPS2', type: 'Unknown', server: '' },
      { id: 7, name: 'DPS3', type: 'Unknown', server: '' },
      { id: 8, name: 'DPS4', type: 'Unknown', server: '' },
    ],
  };
}

function dmgEvent(
  timeSec: number,
  guid: number,
  enName: string,
  targetID: number,
  amount: number,
  opts?: Partial<FFLogsRawEvent>,
): FFLogsRawEvent {
  return {
    timestamp: BASE_TIME + timeSec * 1000,
    type: 'damage',
    ability: { guid, name: enName, type: 64 },
    targetID,
    amount,
    unmitigatedAmount: amount,
    multiplier: 1,
    packetID: Math.floor(Math.random() * 100000),
    ...opts,
  } as FFLogsRawEvent;
}

function castEvent(
  timeSec: number,
  guid: number,
  enName: string,
): FFLogsRawEvent {
  return {
    timestamp: BASE_TIME + timeSec * 1000,
    type: 'begincast',
    ability: { guid, name: enName, type: 64 },
    targetID: -1,
  } as FFLogsRawEvent;
}

function jpDmgEvent(
  timeSec: number,
  guid: number,
  jpName: string,
  targetID: number,
  amount: number,
): FFLogsRawEvent {
  return {
    timestamp: BASE_TIME + timeSec * 1000,
    type: 'damage',
    ability: { guid, name: jpName, type: 64 },
    targetID,
    amount,
    unmitigatedAmount: amount,
    multiplier: 1,
    packetID: Math.floor(Math.random() * 100000),
  } as FFLogsRawEvent;
}

// ── テスト ──

describe('mapFFLogsToTimeline', () => {
  it('空の入力で空の結果を返す', () => {
    const result = mapFFLogsToTimeline([], [], makeFight(), [], [], [], makePlayers());
    expect(result.events).toHaveLength(0);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].name).toBe('P1');
  });

  it('AoE（3人以上被弾）を正しく検出する', () => {
    const rawEn = [
      dmgEvent(10, 100, 'Megaflare', 3, 80000),
      dmgEvent(10, 100, 'Megaflare', 4, 80000),
      dmgEvent(10, 100, 'Megaflare', 5, 80000),
      dmgEvent(10, 100, 'Megaflare', 6, 80000),
    ];
    const result = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    const megaflare = result.events.find((e) => e.name.en === 'Megaflare');
    expect(megaflare).toBeDefined();
    expect(megaflare!.target).toBe('AoE');
  });

  it('タンクのみ被弾をTBとして検出する', () => {
    // Tank 1 にAA を多く打たせてMT判定させる
    const aaHits = Array.from({ length: 10 }, (_, i) =>
      dmgEvent(i, 999, 'Attack', 1, 5000),
    );
    const tbHit = dmgEvent(15, 200, 'Tankbuster', 1, 120000);

    const result = mapFFLogsToTimeline(
      [...aaHits, tbHit], [], makeFight(), [], [], [], makePlayers(),
    );
    const tb = result.events.find((e) => e.name.en.includes('Tankbuster'));
    expect(tb).toBeDefined();
    expect(tb!.target).toBe('MT');
  });

  it('JP名マッピングが機能する', () => {
    const rawEn = [
      dmgEvent(10, 100, 'Megaflare', 3, 80000),
      dmgEvent(10, 100, 'Megaflare', 4, 80000),
      dmgEvent(10, 100, 'Megaflare', 5, 80000),
    ];
    const rawJp = [
      jpDmgEvent(10, 100, 'メガフレア', 3, 80000),
    ];
    const result = mapFFLogsToTimeline(rawEn, rawJp, makeFight(), [], [], [], makePlayers());
    const ev = result.events.find((e) => e.name.en === 'Megaflare');
    expect(ev).toBeDefined();
    expect(ev!.name.ja).toBe('メガフレア');
  });

  it('ダメージなしキャストを追加する（GUIDがダメージに存在しない場合のみ）', () => {
    const rawEn = [
      dmgEvent(10, 100, 'Megaflare', 3, 80000),
      dmgEvent(10, 100, 'Megaflare', 4, 80000),
      dmgEvent(10, 100, 'Megaflare', 5, 80000),
    ];
    // GUID 200 はダメージイベントに存在しない → キャストとして追加される
    const castEn = [castEvent(5, 200, 'Enrage Warning')];
    const result = mapFFLogsToTimeline(rawEn, [], makeFight(), [], castEn, [], makePlayers());
    const cast = result.events.find((e) => e.name.en === 'Enrage Warning');
    expect(cast).toBeDefined();
  });

  it('ダメージGUIDと同じキャストは追加しない', () => {
    const rawEn = [
      dmgEvent(10, 100, 'Megaflare', 3, 80000),
      dmgEvent(10, 100, 'Megaflare', 4, 80000),
      dmgEvent(10, 100, 'Megaflare', 5, 80000),
    ];
    // GUID 100 はダメージイベントに存在する → 重複キャストとして除外
    const castEn = [castEvent(8, 100, 'Megaflare')];
    const result = mapFFLogsToTimeline(rawEn, [], makeFight(), [], castEn, [], makePlayers());
    const megaflares = result.events.filter((e) => e.name.en === 'Megaflare');
    expect(megaflares).toHaveLength(1); // ダメージ版のみ
  });

  it('フェーズ遷移を反映する', () => {
    const fight = makeFight({
      phaseTransitions: [
        { id: 1, startTime: BASE_TIME },
        { id: 2, startTime: BASE_TIME + 120000 },
      ],
    });
    const rawEn = [
      dmgEvent(10, 100, 'Attack1', 3, 50000),
      dmgEvent(10, 100, 'Attack1', 4, 50000),
      dmgEvent(10, 100, 'Attack1', 5, 50000),
    ];
    const result = mapFFLogsToTimeline(rawEn, [], fight, [], [], [], makePlayers());
    expect(result.phases).toHaveLength(2);
    expect(result.phases[0].startTimeSec).toBe(0);
    expect(result.phases[1].startTimeSec).toBe(120);
  });

  it('同秒に3イベント以上ある場合、ずらして最大2/秒にする', () => {
    const rawEn = [
      dmgEvent(10, 100, 'Skill1', 3, 50000),
      dmgEvent(10, 100, 'Skill1', 4, 50000),
      dmgEvent(10, 100, 'Skill1', 5, 50000),
      dmgEvent(10, 200, 'Skill2', 3, 60000),
      dmgEvent(10, 200, 'Skill2', 4, 60000),
      dmgEvent(10, 200, 'Skill2', 5, 60000),
      dmgEvent(10, 300, 'Skill3', 3, 70000),
      dmgEvent(10, 300, 'Skill3', 4, 70000),
      dmgEvent(10, 300, 'Skill3', 5, 70000),
    ];
    const result = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    const byTime = new Map<number, number>();
    for (const ev of result.events) {
      byTime.set(ev.time, (byTime.get(ev.time) ?? 0) + 1);
    }
    for (const count of byTime.values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
  });

  it('statsを正しく返す', () => {
    const rawEn = [
      dmgEvent(10, 100, 'Skill', 3, 50000),
      dmgEvent(10, 100, 'Skill', 4, 50000),
      dmgEvent(10, 100, 'Skill', 5, 50000),
    ];
    const result = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    expect(result.stats.totalRawEvents).toBe(3);
    expect(result.stats.timelineEventCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: テスト実行して全パスを確認**

Run: `npx vitest run src/utils/__tests__/fflogsMapper.test.ts`
Expected: 全テストPASS（一部テストデータの調整が必要な場合がある）

- [ ] **Step 3: 失敗するテストがあれば、テストデータを調整して再実行**

fflogsMapperは複雑なので、テストデータがロジックと合わない場合がある。
失敗したテストのエラーを読み、テストデータの人数・ダメージ量・タイミングを調整する。
**実装コードは変更しない** — テストデータ側を修正する。

- [ ] **Step 4: コミット**

```bash
git add src/utils/__tests__/fflogsMapper.test.ts
git commit -m "test: fflogsMapper の統合テスト追加"
```

---

### Task 5: useTemplateEditor.test.ts

**Files:**
- Modify: `package.json` — devDependencies に @testing-library/react 追加
- Modify: `vitest.config.ts` — environment を jsdom に変更
- Create: `src/hooks/__tests__/useTemplateEditor.test.ts`
- Tested: `src/hooks/useTemplateEditor.ts`

- [ ] **Step 1: @testing-library/react をインストール**

Run: `npm install -D @testing-library/react jsdom`

- [ ] **Step 2: vitest.config.ts を更新**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/__tests__/**/*.test.ts'],
    },
});
```

注意: `node` → `jsdom` に変更。既存の ogpHelpers.test.ts は DOM 非依存なので jsdom でも動く。

- [ ] **Step 3: テストファイルを作成**

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTemplateEditor } from '../useTemplateEditor';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';

// ── テストデータ ──

function makeEvents(): TimelineEvent[] {
  return [
    {
      id: 'ev1', time: 3,
      name: { ja: 'テスト攻撃', en: 'Test Attack' },
      damageType: 'magical', target: 'AoE',
      mechanicGroup: { ja: 'テスト', en: 'Test' },
    },
    {
      id: 'ev2', time: 10,
      name: { ja: 'テスト攻撃', en: 'Test Attack' },
      damageType: 'magical', target: 'AoE',
      mechanicGroup: { ja: 'テスト', en: 'Test' },
    },
    {
      id: 'ev3', time: 20,
      name: { ja: '二撃目', en: 'Second Hit' },
      damageType: 'physical', target: 'MT',
    },
  ];
}

function makePhases(): TemplateData['phases'] {
  return [
    { id: 1, startTimeSec: 0, name: { ja: 'フェーズ1', en: 'Phase 1' } },
  ];
}

// ── テスト ──

describe('useTemplateEditor', () => {
  it('loadEvents でデータをロードできる', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => {
      result.current.loadEvents(makeEvents(), makePhases());
    });
    expect(result.current.visibleEvents).toHaveLength(3);
    expect(result.current.hasChanges).toBe(false);
  });

  it('updateCell でセル値を更新し modified を記録する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev1', 'name.ja', '変更後'));
    expect(result.current.state.current.find((e) => e.id === 'ev1')?.name.ja).toBe('変更後');
    expect(result.current.hasChanges).toBe(true);
  });

  it('翻訳自動伝播: 同じJA名のイベントにEN翻訳が伝播する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    // ev1 と ev2 は同じ name.ja = 'テスト攻撃'
    act(() => result.current.updateCell('ev1', 'name.en', 'Updated Attack'));
    const ev2 = result.current.state.current.find((e) => e.id === 'ev2');
    expect(ev2?.name.en).toBe('Updated Attack');
  });

  it('deleteEvent でイベントを削除し visibleEvents から除外する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.deleteEvent('ev1'));
    expect(result.current.visibleEvents).toHaveLength(2);
    expect(result.current.visibleEvents.find((e) => e.id === 'ev1')).toBeUndefined();
  });

  it('undo でオリジナル状態に戻る', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateCell('ev1', 'name.ja', '変更後'));
    act(() => result.current.deleteEvent('ev2'));
    act(() => result.current.undo());
    expect(result.current.visibleEvents).toHaveLength(3);
    expect(result.current.state.current.find((e) => e.id === 'ev1')?.name.ja).toBe('テスト攻撃');
    expect(result.current.hasChanges).toBe(false);
  });

  it('setPhaseAtTime でフェーズ境界を追加する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(10, { ja: '新フェーズ', en: 'New Phase' }));
    expect(result.current.state.currentPhases).toHaveLength(2);
    expect(result.current.state.currentPhases[1].startTimeSec).toBe(10);
    expect(result.current.state.currentPhases[1].name).toEqual({ ja: '新フェーズ', en: 'New Phase' });
  });

  it('setPhaseAtTime で既存フェーズの名前を更新する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(0, { ja: '更新名', en: 'Updated' }));
    expect(result.current.state.currentPhases).toHaveLength(1);
    expect(result.current.state.currentPhases[0].name).toEqual({ ja: '更新名', en: 'Updated' });
  });

  it('setPhaseAtTime で空名でフェーズを削除する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(0, { ja: '', en: '' }));
    expect(result.current.state.currentPhases).toHaveLength(0);
  });

  it('setPhaseAtTime で null でフェーズを削除する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.setPhaseAtTime(0, null));
    expect(result.current.state.currentPhases).toHaveLength(0);
  });

  it('updateLabel でラベル名を一括更新する', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.updateLabel('テスト', { ja: '更新ラベル', en: 'Updated Label' }));
    const ev1 = result.current.state.current.find((e) => e.id === 'ev1');
    const ev2 = result.current.state.current.find((e) => e.id === 'ev2');
    expect(ev1?.mechanicGroup?.ja).toBe('更新ラベル');
    expect(ev2?.mechanicGroup?.ja).toBe('更新ラベル');
    // ev3 はラベルなし → 変更されない
    const ev3 = result.current.state.current.find((e) => e.id === 'ev3');
    expect(ev3?.mechanicGroup).toBeUndefined();
  });

  it('getSaveData で削除済みイベントを除外したデータを返す', () => {
    const { result } = renderHook(() => useTemplateEditor());
    act(() => result.current.loadEvents(makeEvents(), makePhases()));
    act(() => result.current.deleteEvent('ev2'));
    const saveData = result.current.getSaveData();
    expect(saveData.events).toHaveLength(2);
    expect(saveData.events.find((e) => e.id === 'ev2')).toBeUndefined();
    expect(saveData.phases).toHaveLength(1);
  });
});
```

- [ ] **Step 4: テスト実行して全パスを確認**

Run: `npx vitest run src/hooks/__tests__/useTemplateEditor.test.ts`
Expected: 全テストPASS

- [ ] **Step 5: 全テストをまとめて実行**

Run: `npx vitest run`
Expected: 全ファイルのテストがPASS（既存の ogpHelpers.test.ts 含む）

- [ ] **Step 6: コミット**

```bash
git add package.json package-lock.json vitest.config.ts src/hooks/__tests__/useTemplateEditor.test.ts
git commit -m "test: useTemplateEditor のフェーズ・ラベル編集テスト追加"
```

---

### Task 6: 最終確認とTODO.md更新

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全テストPASS、失敗0件

- [ ] **Step 2: docs/TODO.md を更新**

「テスト基盤」を完了済みに移動:
- 「進行中: テスト基盤構築」を削除
- 「未着手」セクションから「テスト基盤（planService.ts等の純粋関数から）」を削除

- [ ] **Step 3: コミット**

```bash
git add docs/TODO.md
git commit -m "docs: テスト基盤構築完了をTODO.mdに反映"
```
