import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, Mitigation } from '../../types';
import { computeMobileEffectBars, type MobileEffectBarColors } from '../mobileEffectBar';

const makeDef = (id: string, overrides: Partial<Mitigation> = {}): Mitigation => ({
  id, jobId: 'war', name: { ja: id, en: id }, icon: `/icons/${id}.png`,
  recast: 60, duration: 10, type: 'all', value: 10,
  ...overrides,
});

const makeMit = (id: string, mitigationId: string, ownerId: string, time: number, duration: number): AppliedMitigation => ({
  id, mitigationId, ownerId, time, duration,
});

const DUMMY_COLORS: MobileEffectBarColors = { bg: 'bg-blue-500/80', border: 'border-blue-400/30', shadow: 'shadow-x' };
const getColorClasses = () => DUMMY_COLORS;

const baseArgs = {
  timeToYMap: new Map<number, number>(),
  pixelsPerSecond: 60,
  offsetTime: 0,
  hideEmptyRows: false,
  maxTime: 9999,
  eventsByTime: new Map<number, unknown[]>(),
  mitStartsByTime: new Map<number, boolean>(),
  showPreStart: true,
  maxConcurrent: 8,
  getColorClasses,
};

describe('computeMobileEffectBars', () => {
  it('places a single mitigation with top/height derived from time and duration', () => {
    const def = makeDef('reprisal', { duration: 10 });
    const mit = makeMit('p1', 'reprisal', 'MT', 5, 10);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].ownerId).toBe('MT');
    expect(result[0].slotIndex).toBe(0);
    // top = (5 - 0) * 60 = 300
    expect(result[0].top).toBe(300);
    // effectiveEndTime = 5 + 10 - 1 = 14, endY = (14-0)*60 + 24 = 864, height = 864 - 300 = 564
    expect(result[0].height).toBe(564);
  });

  it('excludes mitigations with duration <= 1', () => {
    const def = makeDef('swiftcast', { duration: 1 });
    const mit = makeMit('p1', 'swiftcast', 'MT', 5, 1);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(0);
  });

  it('excludes mitigations whose def has copiesShield set', () => {
    const def = makeDef('deployment_tactics', { duration: 10, copiesShield: 'adloquium' });
    const mit = makeMit('p1', 'deployment_tactics', 'MT', 5, 10);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(0);
  });

  it('reuses the same slot for non-overlapping mitigations from the same owner', () => {
    const def = makeDef('reprisal', { duration: 10 });
    const mit1 = makeMit('p1', 'reprisal', 'MT', 0, 10); // covers [0,10)
    const mit2 = makeMit('p2', 'reprisal', 'MT', 20, 10); // covers [20,30), starts after p1 ends
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit1, mit2],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'p1')!.slotIndex).toBe(0);
    expect(result.find(r => r.id === 'p2')!.slotIndex).toBe(0);
  });

  it('assigns different slots to overlapping mitigations from different owners', () => {
    const def = makeDef('reprisal', { duration: 10 });
    const mtMit = makeMit('p1', 'reprisal', 'MT', 0, 10); // covers [0,10)
    const stMit = makeMit('p2', 'reprisal', 'ST', 5, 10); // covers [5,15), overlaps p1
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mtMit, stMit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(2);
    const mtSlot = result.find(r => r.id === 'p1')!.slotIndex;
    const stSlot = result.find(r => r.id === 'p2')!.slotIndex;
    expect(mtSlot).not.toBe(stSlot);
  });

  it('drops lower-priority (later PARTY_MEMBER_IDS) mitigations first when maxConcurrent is exceeded', () => {
    const def = makeDef('reprisal', { duration: 100 });
    // 4人が同時刻(time=0)から同じ長さ重ねる。MT/ST/H1が優先、D1は4番目=はみ出し候補。
    const mits = [
      makeMit('mt', 'reprisal', 'MT', 0, 100),
      makeMit('st', 'reprisal', 'ST', 0, 100),
      makeMit('h1', 'reprisal', 'H1', 0, 100),
      makeMit('d1', 'reprisal', 'D1', 0, 100),
    ];
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: mits,
      mitigationDefs: [def],
      maxConcurrent: 3,
    });
    const ids = result.map(r => r.id).sort();
    expect(ids).toEqual(['h1', 'mt', 'st']);
  });

  it('clips effectiveEndTime to the nearest visible row when hideEmptyRows is on', () => {
    const def = makeDef('reprisal', { duration: 20 });
    const mit = makeMit('p1', 'reprisal', 'MT', 0, 20); // covers [0,20), durationEndTime = 19
    const eventsByTime = new Map<number, unknown[]>([[0, [{}]], [8, [{}]]]);
    const mitStartsByTime = new Map<number, boolean>([[0, true]]);
    const result = computeMobileEffectBars({
      ...baseArgs,
      hideEmptyRows: true,
      eventsByTime,
      mitStartsByTime,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    // durationEndTime=19 は可視行でないため、8(直前の可視行)に切り詰め。
    // endY = (8-0)*60 + 24 = 504, top = 0, height = 504
    expect(result[0].height).toBe(504);
  });

  it('passes the mitigation def jobId and owner id to getColorClasses', () => {
    const def = makeDef('reprisal', { jobId: 'pld' });
    const mit = makeMit('p1', 'reprisal', 'MT', 0, 10);
    const seen: { jobId: string | undefined; ownerId: string }[] = [];
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
      getColorClasses: (jobId, ownerId) => {
        seen.push({ jobId, ownerId });
        return DUMMY_COLORS;
      },
    });
    expect(seen).toEqual([{ jobId: 'pld', ownerId: 'MT' }]);
    expect(result[0].colors).toBe(DUMMY_COLORS);
  });
});
