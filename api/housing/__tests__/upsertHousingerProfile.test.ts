import { describe, it, expect } from 'vitest';
import { validateUpsertBody } from '../_upsertHousingerProfileHandler.js';

describe('validateUpsertBody', () => {
  it('空 body は ok (全て現状維持 = 同期呼び出し)', () => {
    expect(validateUpsertBody({}).ok).toBe(true);
  });
  it('bio 100 文字以内 ok / 101 文字 invalid_bio', () => {
    expect(validateUpsertBody({ bio: 'あ'.repeat(100) }).ok).toBe(true);
    expect(validateUpsertBody({ bio: 'あ'.repeat(101) })).toEqual({ ok: false, error: 'invalid_bio' });
  });
  it('snsUrl はホワイトリスト検証 (リスト外 = invalid_sns_url)', () => {
    expect(validateUpsertBody({ snsUrl: 'https://x.com/a' }).ok).toBe(true);
    expect(validateUpsertBody({ snsUrl: 'https://evil.com/a' })).toEqual({ ok: false, error: 'invalid_sns_url' });
  });
  it('null は「消す」指定として ok', () => {
    expect(validateUpsertBody({ bio: null, snsUrl: null }).ok).toBe(true);
  });
  it('isPublished は boolean 以外拒否', () => {
    expect(validateUpsertBody({ isPublished: 'yes' }).ok).toBe(false);
  });
  it('ogRepresentativeListingIds は10件以下の文字列配列のみ ok', () => {
    expect(validateUpsertBody({ ogRepresentativeListingIds: ['a', 'b'] }).ok).toBe(true);
    expect(validateUpsertBody({ ogRepresentativeListingIds: [] }).ok).toBe(true);
    expect(validateUpsertBody({ ogRepresentativeListingIds: null }).ok).toBe(true);
    expect(validateUpsertBody({ ogRepresentativeListingIds: Array(11).fill('x') }))
      .toEqual({ ok: false, error: 'invalid_og_representative_ids' });
    expect(validateUpsertBody({ ogRepresentativeListingIds: ['a', 123] }))
      .toEqual({ ok: false, error: 'invalid_og_representative_ids' });
    expect(validateUpsertBody({ ogRepresentativeListingIds: 'not-an-array' }))
      .toEqual({ ok: false, error: 'invalid_og_representative_ids' });
  });
});
