import { describe, it, expect } from 'vitest';
import { canConfirmImport } from '../canConfirmImport';

describe('canConfirmImport', () => {
  it('全条件OK かつ 未追加draftなし → true', () => {
    expect(canConfirmImport({ hasPreviewEvents: true, partyComplete: true, hasPendingDraft: false })).toBe(true);
  });
  it('未追加draftあり → false(他がOKでも)', () => {
    expect(canConfirmImport({ hasPreviewEvents: true, partyComplete: true, hasPendingDraft: true })).toBe(false);
  });
  it('プレビューにイベント無し → false', () => {
    expect(canConfirmImport({ hasPreviewEvents: false, partyComplete: true, hasPendingDraft: false })).toBe(false);
  });
  it('パーティ未完 → false', () => {
    expect(canConfirmImport({ hasPreviewEvents: true, partyComplete: false, hasPendingDraft: false })).toBe(false);
  });
});
