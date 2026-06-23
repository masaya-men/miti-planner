import { describe, it, expect } from 'vitest';
import { importBlockReason } from '../importBlockReason';

describe('importBlockReason', () => {
  it('全条件OK → null(作成可)', () => {
    expect(importBlockReason({ hasPreviewEvents: true, partyComplete: true, hasPendingDraft: false })).toBe(null);
  });
  it('未追加draftが最優先 → pending_draft', () => {
    // 他の問題があっても、まず未追加draftを促す
    expect(importBlockReason({ hasPreviewEvents: false, partyComplete: false, hasPendingDraft: true })).toBe('pending_draft');
  });
  it('draft無し・フェーズ未追加 → no_phases', () => {
    expect(importBlockReason({ hasPreviewEvents: false, partyComplete: true, hasPendingDraft: false })).toBe('no_phases');
  });
  it('draft無し・フェーズ有り・パーティ未完 → party_incomplete', () => {
    expect(importBlockReason({ hasPreviewEvents: true, partyComplete: false, hasPendingDraft: false })).toBe('party_incomplete');
  });
});
