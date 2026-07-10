import { describe, it, expect } from 'vitest';
import { computeRegisterChecklist, isReadyToPublish } from '../registerChecklist';

describe('registerChecklist', () => {
  it('全部揃えば全 done・公開可', () => {
    const items = computeRegisterChecklist({
      addressOk: true,
      addressConfirmed: true,
      titleOk: true,
      hasImage: true,
    });
    expect(items.every((i) => i.done)).toBe(true);
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('タイトルは任意 (2026-07-10): 未入力でも not done だが公開は可 (住所フォールバック)', () => {
    const items = computeRegisterChecklist({
      addressOk: true,
      addressConfirmed: true,
      titleOk: false,
      hasImage: true,
    });
    expect(items.find((i) => i.key === 'title')?.done).toBe(false);
    expect(items.find((i) => i.key === 'title')?.required).toBe(false);
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('必須 (住所) が揃えばタイトル/画像なしでも公開可 (どちらも推奨)', () => {
    const items = computeRegisterChecklist({
      addressOk: true,
      addressConfirmed: true,
      titleOk: false,
      hasImage: false,
    });
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('住所が欠けると公開不可', () => {
    const items = computeRegisterChecklist({
      addressOk: false,
      addressConfirmed: true,
      titleOk: true,
      hasImage: true,
    });
    expect(isReadyToPublish(items)).toBe(false);
  });

  // 住所確認ゲート (C案・2026-07-10)。
  describe('住所確認ゲート', () => {
    it('妥当 + 未確認 → done=false / missing_address_confirm', () => {
      const items = computeRegisterChecklist({
        addressOk: true,
        addressConfirmed: false,
        titleOk: true,
        hasImage: true,
      });
      const address = items.find((i) => i.key === 'address');
      expect(address?.done).toBe(false);
      expect(address?.missingLabelKey).toBe('housing.register.check.missing_address_confirm');
      expect(isReadyToPublish(items)).toBe(false);
    });

    it('確認済み → done=true', () => {
      const items = computeRegisterChecklist({
        addressOk: true,
        addressConfirmed: true,
        titleOk: true,
        hasImage: true,
      });
      expect(items.find((i) => i.key === 'address')?.done).toBe(true);
      expect(isReadyToPublish(items)).toBe(true);
    });

    it('値が不正なら未確認でも missing_address (確認より入力不備を優先)', () => {
      const items = computeRegisterChecklist({
        addressOk: false,
        addressConfirmed: false,
        titleOk: true,
        hasImage: true,
      });
      expect(items.find((i) => i.key === 'address')?.missingLabelKey).toBe(
        'housing.register.check.missing_address',
      );
    });
  });
});
