import { describe, it, expect } from 'vitest';
import { validateImage, buildListingImageFields } from '../../utils/housingImageValidation';
import type { RegistrationDraft } from '../../utils/housingRegistrationTypes';

const baseSnsDraft: RegistrationDraft = {
  dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane', ward: 3,
  buildingType: 'house', plot: 12, size: 'S',
  tags: [],
  imageMode: 'sns',
  postUrl: 'https://x.com/foo/status/111',
  ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
  tweetId: '111',
  sourceImageUrls: ['https://pbs.twimg.com/media/a.jpg'],
};

describe('validateImage: sourcePostUrls (Batch2)', () => {
  it('5件以内なら ok', () => {
    const r = validateImage({
      ...baseSnsDraft,
      sourcePostUrls: [
        'https://x.com/foo/status/111',
        'https://x.com/foo/status/222',
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('6件以上は too_many エラー', () => {
    const r = validateImage({
      ...baseSnsDraft,
      sourcePostUrls: Array.from({ length: 6 }, (_, i) => `https://x.com/foo/status/${i}`),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.sourcePostUrls).toBe('too_many');
  });

  it('不正な host が混ざっていたら invalid_url エラー', () => {
    const r = validateImage({
      ...baseSnsDraft,
      sourcePostUrls: ['https://x.com/foo/status/111', 'https://evil.example.com/x'],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.sourcePostUrls).toBe('invalid_url');
  });

  it('sourcePostUrls 未指定でも既存の単一 postUrl 検証は影響を受けない', () => {
    const r = validateImage(baseSnsDraft);
    expect(r.ok).toBe(true);
  });

  it('imageMode!=="sns" (none) でも sourcePostUrls の不正ホストは弾かれる (バイパス回帰テスト)', () => {
    const r = validateImage({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane', ward: 3,
      buildingType: 'house', plot: 12, size: 'S',
      tags: [],
      sourcePostUrls: ['https://evil.example.com/x'],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.sourcePostUrls).toBe('invalid_url');
  });
});

describe('buildListingImageFields: sourcePostUrls (Batch2)', () => {
  it('sourcePostUrls があれば結果に含まれ、postUrl は先頭と一致する', () => {
    const fields = buildListingImageFields(
      {
        ...baseSnsDraft,
        sourcePostUrls: ['https://x.com/foo/status/111', 'https://x.com/foo/status/222'],
      },
      1_700_000_000_000,
    );
    expect(fields).toMatchObject({
      postUrl: 'https://x.com/foo/status/111',
      sourcePostUrls: ['https://x.com/foo/status/111', 'https://x.com/foo/status/222'],
    });
  });

  it('sourcePostUrls 未指定なら sourcePostUrls キー自体を持たない(後方互換)', () => {
    const fields = buildListingImageFields(baseSnsDraft, 1_700_000_000_000);
    expect('sourcePostUrls' in fields).toBe(false);
  });
});
