import { describe, it, expect } from 'vitest';
import { crossingBetween, firstDestination, canAddToTour, tourAnchorRegion, tourRegionConflict } from '../tourCrossing';
import type { Region } from '../../../data/housing/dcServerMap';
import type { HousingArea } from '../../../types/housing';

const loc = (region: Region, dc: string, server: string, area?: HousingArea, ward?: number) => ({ region, dc, server, area, ward });

describe('crossingBetween', () => {
  it('prev=null(1件目)は none', () => {
    expect(crossingBetween(null, loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('全一致は none', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('別ワールド・同DC は world(着地ワールド名+dc+着地エリア+着地区番号)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Titan'))).toEqual({ kind: 'world', world: 'Titan', dc: 'Mana', area: '', ward: null });
  });
  it('別ワールド・同DC で着地先の area/ward があれば crossing に載る', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima', 'Mist', 5), loc('JP', 'Mana', 'Titan', 'Goblet', 23))).toEqual({ kind: 'world', world: 'Titan', dc: 'Mana', area: 'Goblet', ward: 23 });
  });
  it('別DC・同リージョン は dc(DC名+着地ワールド+着地エリア+着地区番号)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit'))).toEqual({ kind: 'dc', dc: 'Gaia', world: 'Ifrit', area: '', ward: null });
  });
  it('別リージョン(OCE以外同士) は region', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh'))).toEqual({ kind: 'region' });
  });
  it('JP→OCE(Materia) は DCトラベル扱い (dc)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('OCE', 'Materia', 'Bismarck'))).toEqual({ kind: 'dc', dc: 'Materia', world: 'Bismarck', area: '', ward: null });
  });
  it('OCE→JP も DCトラベル扱い (dc・着地は現在地)', () => {
    expect(crossingBetween(loc('OCE', 'Materia', 'Bismarck'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'dc', dc: 'Mana', world: 'Anima', area: '', ward: null });
  });
});

describe('firstDestination (#2: 1件目の出発案内)', () => {
  it('world(server)があれば start(目的地DC/ワールド)を返す', () => {
    expect(firstDestination(loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'start', dc: 'Mana', world: 'Anima' });
  });
  it('server が無い(住所未確定の一時追加等)なら案内を出さない none', () => {
    expect(firstDestination({ region: 'JP', dc: 'Mana', server: undefined } as never)).toEqual({ kind: 'none' });
  });
});

describe('canAddToTour', () => {
  it('空トレイ(null)は何でも可', () => {
    expect(canAddToTour(null, 'NA')).toBe(true);
  });
  it('同リージョンは可', () => {
    expect(canAddToTour('JP', 'JP')).toBe(true);
  });
  it('別リージョン(OCE以外)は不可', () => {
    expect(canAddToTour('JP', 'NA')).toBe(false);
  });
  it('OCE(Materia)は常に追加可 (アンカーが何であれ)', () => {
    expect(canAddToTour('JP', 'OCE')).toBe(true);
    expect(canAddToTour(null, 'OCE')).toBe(true);
  });
});

describe('tourRegionConflict', () => {
  it('単一リージョンは null', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit')])).toBeNull();
  });
  it('空配列は null', () => {
    expect(tourRegionConflict([])).toBeNull();
  });
  it('非OCE混在は相異なる非OCEリージョン配列', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh')])).toEqual(['JP', 'NA']);
  });
  it('JP+OCE(Materia)は混在可 (null)', () => {
    expect(tourRegionConflict([loc('JP', 'Mana', 'Anima'), loc('OCE', 'Materia', 'Bismarck')])).toBeNull();
  });
  it('JP+OCE+NA は非OCEが2種で衝突', () => {
    expect(
      tourRegionConflict([
        loc('JP', 'Mana', 'Anima'),
        loc('OCE', 'Materia', 'Bismarck'),
        loc('NA', 'Aether', 'Gilgamesh'),
      ]),
    ).toEqual(['JP', 'NA']);
  });
});

describe('tourAnchorRegion', () => {
  it('非OCEがあれば先頭の非OCEを返す (M-1: OCE先頭でも追加時に即ブロックできる)', () => {
    expect(tourAnchorRegion(['OCE', 'JP'])).toBe('JP');
    expect(tourAnchorRegion(['JP', 'NA'])).toBe('JP');
    // OCE先頭トレイ [OCE, NA] に JP: アンカー=NA なので追加時点で不可 (開始ガード頼みにしない)
    expect(canAddToTour(tourAnchorRegion(['OCE', 'NA']), 'JP')).toBe(false);
  });
  it('OCEのみのトレイは OCE を返す (C-1: KR/CN を混ぜさせないアンカー)', () => {
    expect(tourAnchorRegion(['OCE', 'OCE'])).toBe('OCE');
    expect(canAddToTour(tourAnchorRegion(['OCE']), 'KR')).toBe(false);
  });
  it('空は null', () => {
    expect(tourAnchorRegion([])).toBeNull();
  });
  it('null/undefined は無視する', () => {
    expect(tourAnchorRegion([null, undefined, 'OCE', 'EU'])).toBe('EU');
    expect(tourAnchorRegion([null, undefined, 'EU'])).toBe('EU');
  });
});

describe('KR/CN リージョン分離', () => {
  it('KR アンカーのトレイに JP は追加できない', () => {
    expect(canAddToTour('KR', 'JP')).toBe(false);
  });
  it('JP アンカーのトレイに KR/CN は追加できない', () => {
    expect(canAddToTour('JP', 'KR')).toBe(false);
    expect(canAddToTour('JP', 'CN')).toBe(false);
  });
  it('CN 同士は追加できる(4DC を 1 地域として扱う)', () => {
    expect(canAddToTour('CN', 'CN')).toBe(true);
  });
  it('KR/CN と OCE の混在は移動可能圏が異なるため不可(C-1: OCE ワイルドカードより KR/CN 分離が優先)', () => {
    // travelGroupOf('OCE')='GLOBAL' / travelGroupOf('KR')='KR' で移動可能圏が異なるため、
    // candidateRegion==='OCE' のワイルドカード分岐に到達する前に false になる。
    expect(canAddToTour('OCE', 'KR')).toBe(false);
    expect(canAddToTour('KR', 'OCE')).toBe(false);
  });
  it('OCEのみトレイ(アンカー=OCE)にKRは追加不可', () => {
    expect(canAddToTour('OCE', 'KR')).toBe(false);
  });
  it('OCEのみトレイ(アンカー=OCE)にJPは追加可(従来維持)', () => {
    expect(canAddToTour('OCE', 'JP')).toBe(true);
  });
  it('tourRegionConflict: OCEとKRの混在は衝突(distinct region 配列)', () => {
    expect(
      tourRegionConflict([loc('OCE', 'Materia', 'Bismarck'), loc('KR', 'Neptune', 'Chocobo')]),
    ).toEqual(['OCE', 'KR']);
  });
  it('crossingBetween(OCE↔KR)は region(防御表示)', () => {
    expect(crossingBetween(loc('OCE', 'Materia', 'Bismarck'), loc('KR', 'Neptune', 'Chocobo'))).toEqual({ kind: 'region' });
    expect(crossingBetween(loc('KR', 'Neptune', 'Chocobo'), loc('OCE', 'Materia', 'Bismarck'))).toEqual({ kind: 'region' });
  });
  it('crossingBetween(OCE↔JP)はdc(従来維持)', () => {
    expect(crossingBetween(loc('OCE', 'Materia', 'Bismarck'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'dc', dc: 'Mana', world: 'Anima', area: '', ward: null });
  });
});

describe('TWリージョン分離', () => {
  it('TW アンカーのトレイに JP/KR/CN は追加できない', () => {
    expect(canAddToTour('TW', 'JP')).toBe(false);
    expect(canAddToTour('TW', 'KR')).toBe(false);
    expect(canAddToTour('TW', 'CN')).toBe(false);
  });
  it('JP アンカーのトレイに TW は追加できない', () => {
    expect(canAddToTour('JP', 'TW')).toBe(false);
  });
  it('TW 同士は追加できる', () => {
    expect(canAddToTour('TW', 'TW')).toBe(true);
  });
  it('TW と OCE はどちらの向きでも混在できない(KR/CNと同じ物理分離)', () => {
    expect(canAddToTour('TW', 'OCE')).toBe(false);
    expect(canAddToTour('OCE', 'TW')).toBe(false);
  });
});
