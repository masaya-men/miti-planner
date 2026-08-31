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
    // top = (5 - 0) * 60 + MOBILE_EFFECT_BAR_ICON_ROW_OFFSET(38) = 338
    expect(result[0].top).toBe(338);
    // effectiveEndTime = 5 + 10 - 1 = 14, endY = (14-0)*60 + 24 = 864, height = 864 - 300 = 564
    // (heightにはICON_ROW_OFFSETは乗らない。startY/endYどちらもオフセット無しの値のまま差分を取るため)
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

  it('includes 展開戦術(copiesShield) bars (PC と揃える・2026-08-27 解禁)', () => {
    const def = makeDef('deployment_tactics', { duration: 10, copiesShield: 'adloquium' });
    const mit = makeMit('p1', 'deployment_tactics', 'MT', 5, 10);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    // reprisal と同じ幾何: effectiveEndTime = 14, endY = 14*60+24 = 864, startY = 5*60 = 300 → height 564
    expect(result[0].height).toBe(564);
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

  it('drops lower-priority (later MOBILE_EFFECT_BAR_FILL_ORDER) mitigations first when maxConcurrent is exceeded', () => {
    const def = makeDef('reprisal', { duration: 100 });
    // 4人が同時刻(time=0)から同じ長さ重ねる。FILL_ORDER上の優先順位はST(3)<D1(5)<H1(6)<MT(7)
    // なので、4番目=優先順位が最も低いMTがはみ出し候補になる。
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
    expect(ids).toEqual(['d1', 'h1', 'st']);
  });

  it('does not drop a chronologically-early low-priority mitigation just because a higher-priority owner has unrelated later-fight casts (regression, 2026-08-17)', () => {
    const def = makeDef('reprisal', { duration: 15 });
    // D4/D2/H2(FILL_ORDER上の優先順位が高い)がそれぞれ終盤(t=500)に1回だけ使う → 3枠
    // (maxConcurrent)を消費する。MT(優先順位が最も低い)はt=39に1回だけ使い、他の誰とも
    // 実際には時間が重なっていない。旧実装ではオーナーごとにまとめて処理していたため、
    // D4/D2/H2の枠が「t=515まで埋まっている」と記録され、時系列的に無関係なMTのt=39が
    // 弾かれてしまっていた。
    const mits = [
      makeMit('d4_late', 'reprisal', 'D4', 500, 15),
      makeMit('d2_late', 'reprisal', 'D2', 500, 15),
      makeMit('h2_late', 'reprisal', 'H2', 500, 15),
      makeMit('mt_early', 'reprisal', 'MT', 39, 15),
    ];
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: mits,
      mitigationDefs: [def],
      maxConcurrent: 3,
    });
    const ids = result.map(r => r.id).sort();
    expect(ids).toEqual(['d2_late', 'd4_late', 'h2_late', 'mt_early']);
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

  describe('shieldExhaustedAt (バリア吸収し切りで棒を早期終了)', () => {
    it('シールドが尽きた時刻で棒を短く切る', () => {
      const def = makeDef('divine_veil', { duration: 30, isShield: true, value: 0 });
      const mit = makeMit('p1', 'divine_veil', 'MT', 0, 30); // durationEndTime = 29
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
        shieldExhaustedAt: new Map([['p1', 10]]),
      });
      // effectiveEndTime = min(29, 10) = 10 → endY = 10*60 + 24 = 624, top = 0
      expect(result[0].height).toBe(624);
    });

    it('shieldExhaustedAt が無ければ本来の duration いっぱい', () => {
      const def = makeDef('divine_veil', { duration: 30, isShield: true, value: 0 });
      const mit = makeMit('p1', 'divine_veil', 'MT', 0, 30);
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
      });
      // effectiveEndTime = 29 → endY = 29*60 + 24 = 1764
      expect(result[0].height).toBe(1764);
    });

    it('def.isShield でない軽減は shieldExhaustedAt があってもクランプしない', () => {
      const def = makeDef('reprisal', { duration: 30, isShield: false });
      const mit = makeMit('p1', 'reprisal', 'MT', 0, 30);
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
        shieldExhaustedAt: new Map([['p1', 10]]),
      });
      expect(result[0].height).toBe(1764);
    });

    it('バリア + 持続 % 軽減の複合スキル(ホーリズム相当)は shieldExhaustedAt があってもクランプしない', () => {
      // ホーリズム: バリア + 10% 軽減 20 秒。バリアが初弾で割れても % 軽減は 20 秒間効き続けるので
      // 棒は効果時間いっぱい出す(2026-08-31 実機報告の修正)。
      const def = makeDef('holos', { duration: 20, isShield: true, value: 10 });
      const mit = makeMit('p1', 'holos', 'MT', 0, 20); // durationEndTime = 19
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
        shieldExhaustedAt: new Map([['p1', 3]]),
      });
      // クランプされない: effectiveEndTime = 19 → endY = 19*60 + 24 = 1164
      expect(result[0].height).toBe(1164);
    });

    it('尽きた時刻が本来の終端より後なら短くならない(Math.min)', () => {
      const def = makeDef('divine_veil', { duration: 10, isShield: true, value: 0 });
      const mit = makeMit('p1', 'divine_veil', 'MT', 0, 10); // durationEndTime = 9
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
        shieldExhaustedAt: new Map([['p1', 50]]),
      });
      // effectiveEndTime = min(9, 50) = 9 → endY = 9*60 + 24 = 564
      expect(result[0].height).toBe(564);
    });

    it('別インスタンスの尽き時刻は流用しない(id 一致のみ)', () => {
      const def = makeDef('divine_veil', { duration: 30, isShield: true, value: 0 });
      const mit = makeMit('p1', 'divine_veil', 'MT', 0, 30);
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
        shieldExhaustedAt: new Map([['other-id', 10]]),
      });
      expect(result[0].height).toBe(1764);
    });
  });

  describe('barrierOverwrittenAt (上書き負けしたバリアの棒を負けた時刻で終了)', () => {
    it('barrierOverwrittenAt: 上書き負けした時刻で棒を止める', () => {
      const def = makeDef('adloquium', { duration: 30, isShield: true });
      const mit = makeMit('p1', 'adloquium', 'MT', 0, 30);
      const result = computeMobileEffectBars({
        ...baseArgs,
        timelineMitigations: [mit],
        mitigationDefs: [def],
        barrierOverwrittenAt: new Map([['p1', 8]]),
      });
      // effectiveEndTime = min(29, 8) = 8 → endY = 8*60 + 24 = 504
      expect(result[0].height).toBe(504);
    });
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
