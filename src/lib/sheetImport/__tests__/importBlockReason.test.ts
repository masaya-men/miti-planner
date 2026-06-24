import { describe, it, expect } from 'vitest';
import { importBlockReason } from '../importBlockReason';

describe('importBlockReason', () => {
  it('イベント無し→no_phases', () => {
    expect(importBlockReason({ hasPreviewEvents: false, partyComplete: true })).toBe('no_phases');
  });
  it('パーティ未完→party_incomplete', () => {
    expect(importBlockReason({ hasPreviewEvents: true, partyComplete: false })).toBe('party_incomplete');
  });
  it('全部OK→null', () => {
    expect(importBlockReason({ hasPreviewEvents: true, partyComplete: true })).toBeNull();
  });
});
