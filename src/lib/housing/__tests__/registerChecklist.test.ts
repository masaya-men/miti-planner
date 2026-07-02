import { describe, it, expect } from 'vitest';
import { computeRegisterChecklist, isReadyToPublish } from '../registerChecklist';

describe('registerChecklist', () => {
  it('全部揃えば全 done・公開可', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: true, hasImage: true });
    expect(items.every((i) => i.done)).toBe(true);
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('タイトル未入力は not done・公開不可', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: false, hasImage: true });
    expect(items.find((i) => i.key === 'title')?.done).toBe(false);
    expect(isReadyToPublish(items)).toBe(false);
  });
  it('必須 (住所/タイトル) が揃えば画像なしでも公開可 (画像は推奨)', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: true, hasImage: false });
    expect(isReadyToPublish(items)).toBe(true);
  });
});
