import { mapFFLogsToTimeline } from '../fflogsMapper';
import type { MapperResult } from '../fflogsMapper';

const BASE_TIME = 1000000;

function makeFight(overrides?: Record<string, any>) {
  return {
    id: 1, startTime: BASE_TIME, endTime: BASE_TIME + 300000,
    name: 'Test Boss', kill: true, ...overrides,
  } as any;
}

function makePlayers(tankIds: number[] = [1, 2]) {
  return {
    tanks: tankIds.map(id => ({ id, name: `Tank${id}`, type: 'Unknown', server: '' })),
    healers: [
      { id: 3, name: 'H1', type: 'Unknown', server: '' },
      { id: 4, name: 'H2', type: 'Unknown', server: '' },
    ],
    dps: [
      { id: 5, name: 'D1', type: 'Unknown', server: '' },
      { id: 6, name: 'D2', type: 'Unknown', server: '' },
      { id: 7, name: 'D3', type: 'Unknown', server: '' },
      { id: 8, name: 'D4', type: 'Unknown', server: '' },
    ],
  };
}

let packetSeq = 1;
function dmg(timeSec: number, guid: number, name: string, targetID: number, amount: number, extra?: Record<string, any>) {
  return {
    timestamp: BASE_TIME + timeSec * 1000,
    type: 'damage',
    ability: { guid, name, type: 64 },
    targetID, amount, unmitigatedAmount: amount,
    multiplier: 1, packetID: packetSeq++, ...extra,
  } as any;
}

function cast(timeSec: number, guid: number, name: string) {
  return {
    timestamp: BASE_TIME + timeSec * 1000,
    type: 'begincast',
    ability: { guid, name, type: 64 },
    targetID: -1,
  } as any;
}

function jpDmg(timeSec: number, guid: number, name: string, targetID: number, amount: number) {
  return {
    timestamp: BASE_TIME + timeSec * 1000,
    type: 'damage',
    ability: { guid, name, type: 64 },
    targetID, amount, unmitigatedAmount: amount,
    multiplier: 1, packetID: packetSeq++,
  } as any;
}

beforeEach(() => { packetSeq = 1; });

describe('mapFFLogsToTimeline', () => {
  it('空の入力で空の結果とデフォルトフェーズを返す', () => {
    const r = mapFFLogsToTimeline([], [], makeFight(), [], [], [], makePlayers());
    expect(r.events).toHaveLength(0);
    expect(r.phases).toHaveLength(1);
    expect(r.phases[0].name).toBe('P1');
  });

  it('AoE（3人以上被弾）を正しく検出する', () => {
    const rawEn = [
      dmg(10, 100, 'Megaflare', 3, 80000),
      dmg(10, 100, 'Megaflare', 4, 80000),
      dmg(10, 100, 'Megaflare', 5, 80000),
      dmg(10, 100, 'Megaflare', 6, 80000),
    ];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    const ev = r.events.find(e => e.name.en === 'Megaflare');
    expect(ev).toBeDefined();
    expect(ev!.target).toBe('AoE');
  });

  it('タンクのみ被弾をTBとして検出する', () => {
    // Tank1 にAAを多く打たせてMT判定
    const aaHits = Array.from({ length: 10 }, (_, i) =>
      dmg(i, 999, 'Attack', 1, 5000),
    );
    const tbHit = dmg(15, 200, 'Tankbuster', 1, 120000);
    const r = mapFFLogsToTimeline([...aaHits, tbHit], [], makeFight(), [], [], [], makePlayers());
    const tb = r.events.find(e => e.name.en.includes('Tankbuster'));
    expect(tb).toBeDefined();
    expect(tb!.target).toBe('MT');
  });

  it('JP名マッピングが機能する', () => {
    const rawEn = [
      dmg(10, 100, 'Megaflare', 3, 80000),
      dmg(10, 100, 'Megaflare', 4, 80000),
      dmg(10, 100, 'Megaflare', 5, 80000),
    ];
    const rawJp = [jpDmg(10, 100, 'メガフレア', 3, 80000)];
    const r = mapFFLogsToTimeline(rawEn, rawJp, makeFight(), [], [], [], makePlayers());
    const ev = r.events.find(e => e.name.en === 'Megaflare');
    expect(ev).toBeDefined();
    expect(ev!.name.ja).toBe('メガフレア');
  });

  it('ダメージなしキャストを追加する（GUIDがダメージに存在しない場合のみ）', () => {
    const rawEn = [
      dmg(10, 100, 'Megaflare', 3, 80000),
      dmg(10, 100, 'Megaflare', 4, 80000),
      dmg(10, 100, 'Megaflare', 5, 80000),
    ];
    const castEn = [cast(5, 200, 'Enrage Warning')];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], castEn, [], makePlayers());
    expect(r.events.find(e => e.name.en === 'Enrage Warning')).toBeDefined();
  });

  it('ダメージGUIDと同じキャストは追加しない', () => {
    const rawEn = [
      dmg(10, 100, 'Megaflare', 3, 80000),
      dmg(10, 100, 'Megaflare', 4, 80000),
      dmg(10, 100, 'Megaflare', 5, 80000),
    ];
    const castEn = [cast(8, 100, 'Megaflare')];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], castEn, [], makePlayers());
    const megaflares = r.events.filter(e => e.name.en === 'Megaflare');
    expect(megaflares).toHaveLength(1);
  });

  it('フェーズ遷移を反映する', () => {
    const fight = makeFight({
      phaseTransitions: [
        { id: 1, startTime: BASE_TIME },
        { id: 2, startTime: BASE_TIME + 120000 },
      ],
    });
    const rawEn = [
      dmg(10, 100, 'Skill', 3, 50000),
      dmg(10, 100, 'Skill', 4, 50000),
      dmg(10, 100, 'Skill', 5, 50000),
    ];
    const r = mapFFLogsToTimeline(rawEn, [], fight, [], [], [], makePlayers());
    expect(r.phases).toHaveLength(2);
    expect(r.phases[1].startTimeSec).toBe(120);
  });

  it('同秒イベントは最大2件に制限される', () => {
    const rawEn = [
      dmg(10, 100, 'A', 3, 50000), dmg(10, 100, 'A', 4, 50000), dmg(10, 100, 'A', 5, 50000),
      dmg(10, 200, 'B', 3, 60000), dmg(10, 200, 'B', 4, 60000), dmg(10, 200, 'B', 5, 60000),
      dmg(10, 300, 'C', 3, 70000), dmg(10, 300, 'C', 4, 70000), dmg(10, 300, 'C', 5, 70000),
    ];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    const byTime = new Map<number, number>();
    for (const ev of r.events) byTime.set(ev.time, (byTime.get(ev.time) ?? 0) + 1);
    for (const count of byTime.values()) expect(count).toBeLessThanOrEqual(2);
  });

  it('statsを正しく返す', () => {
    const rawEn = [
      dmg(10, 100, 'Skill', 3, 50000),
      dmg(10, 100, 'Skill', 4, 50000),
      dmg(10, 100, 'Skill', 5, 50000),
    ];
    const r = mapFFLogsToTimeline(rawEn, [], makeFight(), [], [], [], makePlayers());
    expect(r.stats.totalRawEvents).toBe(3);
    expect(r.stats.timelineEventCount).toBeGreaterThan(0);
  });
});
