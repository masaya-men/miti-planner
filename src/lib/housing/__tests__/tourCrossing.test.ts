import { describe, it, expect } from 'vitest';
import { crossingBetween, firstDestination, canAddToTour, tourAnchorRegion, tourRegionConflict } from '../tourCrossing';
import type { Region } from '../../../data/housing/dcServerMap';

const loc = (region: Region, dc: string, server: string) => ({ region, dc, server });

describe('crossingBetween', () => {
  it('prev=null(1件目)は none', () => {
    expect(crossingBetween(null, loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('全一致は none', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'none' });
  });
  it('別ワールド・同DC は world(着地ワールド名+dc)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Titan'))).toEqual({ kind: 'world', world: 'Titan', dc: 'Mana' });
  });
  it('別DC・同リージョン は dc(DC名+着地ワールド)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Gaia', 'Ifrit'))).toEqual({ kind: 'dc', dc: 'Gaia', world: 'Ifrit' });
  });
  it('別リージョン(OCE以外同士) は region', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('NA', 'Aether', 'Gilgamesh'))).toEqual({ kind: 'region' });
  });
  it('JP→OCE(Materia) は DCトラベル扱い (dc)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('OCE', 'Materia', 'Bismarck'))).toEqual({ kind: 'dc', dc: 'Materia', world: 'Bismarck' });
  });
  it('OCE→JP も DCトラベル扱い (dc・着地は現在地)', () => {
    expect(crossingBetween(loc('OCE', 'Materia', 'Bismarck'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'dc', dc: 'Mana', world: 'Anima' });
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
  it('最初の非null/undefinedリージョンをそのまま返す (C-1: OCEをスキップしない)', () => {
    expect(tourAnchorRegion(['OCE', 'JP'])).toBe('OCE');
    expect(tourAnchorRegion(['JP', 'NA'])).toBe('JP');
  });
  it('OCEのみのトレイは OCE を返す (C-1: OCEも通常のアンカーとして扱う)', () => {
    expect(tourAnchorRegion(['OCE', 'OCE'])).toBe('OCE');
  });
  it('空は null', () => {
    expect(tourAnchorRegion([])).toBeNull();
  });
  it('null/undefined は無視して最初の非null/undefinedを返す', () => {
    expect(tourAnchorRegion([null, undefined, 'OCE', 'EU'])).toBe('OCE');
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
    expect(crossingBetween(loc('OCE', 'Materia', 'Bismarck'), loc('JP', 'Mana', 'Anima'))).toEqual({ kind: 'dc', dc: 'Mana', world: 'Anima' });
  });
});
