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
  it('別ワールド・同DC は world(着地ワールド名)', () => {
    expect(crossingBetween(loc('JP', 'Mana', 'Anima'), loc('JP', 'Mana', 'Titan'))).toEqual({ kind: 'world', world: 'Titan' });
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
  it('非OCEアンカーを返す (OCEが先頭でも取り違えない)', () => {
    expect(tourAnchorRegion(['OCE', 'JP'])).toBe('JP');
    expect(tourAnchorRegion(['JP', 'NA'])).toBe('JP');
  });
  it('空 / OCEのみ は null', () => {
    expect(tourAnchorRegion([])).toBeNull();
    expect(tourAnchorRegion(['OCE', 'OCE'])).toBeNull();
  });
  it('null/undefined は無視して最初の非OCEを返す', () => {
    expect(tourAnchorRegion([null, undefined, 'OCE', 'EU'])).toBe('EU');
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
  it('KR/CN と OCE の混在は許さない方向のみ許可される(OCE 候補は常に可の既存仕様)', () => {
    // 既存仕様: candidateRegion==='OCE' は常に true。KR アンカーに OCE 候補が乗るのは
    // ゲーム的に誤りだが、既存 OCE 例外の挙動変更はスコープ外 (spec §4)。KR 候補側は弾かれることを固定。
    expect(canAddToTour('OCE', 'KR')).toBe(false);
  });
});
