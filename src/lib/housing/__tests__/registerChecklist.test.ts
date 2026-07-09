import { describe, it, expect } from 'vitest';
import { computeRegisterChecklist, isReadyToPublish } from '../registerChecklist';

describe('registerChecklist', () => {
  it('全部揃えば全 done・公開可', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: true, hasImage: true });
    expect(items.every((i) => i.done)).toBe(true);
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('タイトルは任意 (2026-07-10): 未入力でも not done だが公開は可 (住所フォールバック)', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: false, hasImage: true });
    expect(items.find((i) => i.key === 'title')?.done).toBe(false);
    expect(items.find((i) => i.key === 'title')?.required).toBe(false);
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('必須 (住所) が揃えばタイトル/画像なしでも公開可 (どちらも推奨)', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: false, hasImage: false });
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('住所が欠けると公開不可', () => {
    const items = computeRegisterChecklist({ addressOk: false, titleOk: true, hasImage: true });
    expect(isReadyToPublish(items)).toBe(false);
  });
});
