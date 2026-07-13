import { describe, it, expect } from 'vitest';
import { crossingBetween, canAddToTour, tourRegionConflict } from '../tourCrossing';
import type { Region } from '../../../data/housing/dcServerMap';

const loc = (region: Region, dc: string, server: string) => ({ region, dc, server });

describe('crossingBetween', () => {
  it('prev=null(1件目)は none', () => {
    expect(crossingBetween(null, loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('全一致は none', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('別ワールド・同DC は world(着地ワールド名)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Titan'))).toEqual({ kind: 'world', world: 'Titan' });
  });
  it('別DC・同リージョン は dc(DC名+着地ワールド)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit'))).toEqual({ kind: 'dc', dc: 'Gaia', world: 'Ifrit' });
  });
  it('別リージョン は region', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh'))).toEqual({ kind: 'region' });
  });
});

describe('canAddToTour', () => {
  it('空トレイ(null)は何でも可', () => {
    expect(canAddToTour(null, 'NA')).toBe(true);
  });
  it('同リージョンは可', () => {
    expect(canAddToTour('JP', 'JP')).toBe(true);
  });
  it('別リージョンは不可', () => {
    expect(canAddToTour('JP', 'NA')).toBe(false);
  });
});

describe('tourRegionConflict', () => {
  it('単一リージョンは null', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit')])).toBeNull();
  });
  it('空配列は null', () => {
    expect(tourRegionConflict([])).toBeNull();
  });
  it('混在は相異なるリージョン配列', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh')])).toEqual(['JP', 'NA']);
  });
});
