// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { saveRegisterPrefill, consumeRegisterPrefill } from '../registerPrefill';

describe('registerPrefill — 一時ツアー「この家を登録する」の一回限り受け渡し (計画書 §4.3, Task5)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('save→consume で保存した内容が取れる', () => {
    saveRegisterPrefill({
      area: 'LavenderBeds',
      ward: 29,
      buildingType: 'house',
      plot: 3,
      size: 'L',
    });
    const prefill = consumeRegisterPrefill();
    expect(prefill).toEqual({
      area: 'LavenderBeds',
      ward: 29,
      buildingType: 'house',
      plot: 3,
      size: 'L',
    });
  });

  it('2回目の consume は null (一回限り)', () => {
    saveRegisterPrefill({ area: 'Mist', ward: 1, buildingType: 'house', plot: 1 });
    expect(consumeRegisterPrefill()).not.toBeNull();
    expect(consumeRegisterPrefill()).toBeNull();
  });

  it('何も保存されていなければ null', () => {
    expect(consumeRegisterPrefill()).toBeNull();
  });

  it('壊れた JSON は null (握りつぶす)', () => {
    window.sessionStorage.setItem('housing-register-prefill', '{bad json');
    expect(consumeRegisterPrefill()).toBeNull();
  });

  it('壊れた JSON でも読んだら削除される (2回目呼んでも例外なく null)', () => {
    window.sessionStorage.setItem('housing-register-prefill', '{bad json');
    expect(consumeRegisterPrefill()).toBeNull();
    expect(consumeRegisterPrefill()).toBeNull();
    expect(window.sessionStorage.getItem('housing-register-prefill')).toBeNull();
  });

  it('postUrl 単独 (apartment) も round-trip する', () => {
    saveRegisterPrefill({
      area: 'Shirogane',
      ward: 5,
      buildingType: 'apartment',
      apartmentBuilding: 2,
      roomNumber: 12,
      postUrl: 'https://x.com/a/status/1',
    });
    expect(consumeRegisterPrefill()).toEqual({
      area: 'Shirogane',
      ward: 5,
      buildingType: 'apartment',
      apartmentBuilding: 2,
      roomNumber: 12,
      postUrl: 'https://x.com/a/status/1',
    });
  });
});
