import { describe, it, expect } from 'vitest';
import { validateAddress, type AddressInput } from '../../utils/housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
};

describe('validateAddress: 3 パターン正常系', () => {
  it('家全体 (本街、 plot 12)', () => {
    // Shirogane plot 12 の区画サイズは S (wardPlotSizes 表で確定)。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'S' });
    expect(r.ok).toBe(true);
  });

  it('家全体 (拡張街、 plot 45)', () => {
    // Shirogane plot 45 (=本街 plot 15) の区画サイズは M。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 45, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('FC 個室 (親 plot 12、 個室 5)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'S', // 親 plot 12 (Shirogane) のサイズ = S
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート部屋 (号棟 1 + 部屋 42)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート 号棟 1/2 以外は out_of_range', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      // @ts-expect-error 検証目的で意図的に範囲外の値を渡す
      apartmentBuilding: 3,
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentBuilding).toBe('out_of_range');
  });

  it('アパート 号棟未指定は out_of_range', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentBuilding).toBe('out_of_range');
  });
});

describe('validateAddress: 境界値', () => {
  it('plot 31 (拡張街最初) は正常', () => {
    // Shirogane plot 31 (=本街 plot 1) の区画サイズは M。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 31, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('plot 60 (拡張街最後) は正常', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 60, size: 'L' });
    expect(r.ok).toBe(true);
  });

  it('plot 61 は範囲外', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 61, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('plot 0 は範囲外', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 0, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });
});

describe('validateAddress: 不正組合せ reject', () => {
  it('アパートに plot は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      plot: 12,
      roomKind: 'apartment_room',
      roomNumber: 42,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('FC 個室の roomNumber 範囲外 (513) は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'S', // 親 plot 12 (Shirogane) のサイズ = S (roomNumber エラーを単独で検証)
      roomKind: 'private_chamber',
      roomNumber: 513,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('アパ部屋 roomNumber 範囲外 (91) は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 91,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('house なのに size 未指定は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12 } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });

  it('FC 個室で size 未指定は不可 (親 plot のサイズが必要)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      roomKind: 'private_chamber',
      roomNumber: 5,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });
});

describe('validateAddress: size と区画サイズの整合 (mismatch_with_plot)', () => {
  it('size が区画から決まるサイズと食い違うと mismatch_with_plot', () => {
    // Shirogane plot 12 の正しいサイズは S。M を渡すと不一致。
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBe('mismatch_with_plot');
  });

  it('size が区画から決まるサイズと一致すれば ok', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'S' });
    expect(r.ok).toBe(true);
  });

  it('FC個室でも親 plot のサイズと食い違えば mismatch_with_plot', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 16, // Shirogane plot 16 = L
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBe('mismatch_with_plot');
  });

  it('plot が範囲外のときは mismatch を出さず plot エラーのみ (二重エラー回避)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 61, size: 'M' });
    expect(r.errors.plot).toBeDefined();
    expect(r.errors.size).not.toBe('mismatch_with_plot');
  });

  it('size 未指定のときは invalid のまま (mismatch で上書きしない)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12 } as AddressInput);
    expect(r.errors.size).toBe('invalid');
  });

  it('apartment は size 整合チェック対象外 (従来どおり ok)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      apartmentBuilding: 1,
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });
});

describe('validateAddress: DC/ワールド実在検証 (中韓対応)', () => {
  // Mist plot 1 の実サイズは M (wardPlotSizes.ts PLOT_SIZE_BY_AREA.Mist[0])。
  // size を S にすると mismatch_with_plot が別途発生し「正しい組は通る」テストが成立しないため M を使う。
  const base = { area: 'Mist', ward: 1, buildingType: 'house', plot: 1, size: 'M' } as const;

  it('実在しない DC を弾く', () => {
    const r = validateAddress({ ...base, dc: 'Nonexistent', server: 'Aegis' });
    expect(r.ok).toBe(false);
    expect(r.errors.dc).toBe('unknown');
  });

  it('DC 配下に無いワールドを弾く (KR の Carbuncle を JP DC で名乗る等)', () => {
    const r = validateAddress({ ...base, dc: 'Korea', server: 'Aegis' });
    expect(r.ok).toBe(false);
    expect(r.errors.server).toBe('unknown');
  });

  it('KR/CN の正しい組は通る', () => {
    expect(validateAddress({ ...base, dc: 'Korea', server: 'Carbuncle' }).ok).toBe(true);
    expect(validateAddress({ ...base, dc: 'ChocoboCN', server: 'RubySea' }).ok).toBe(true);
  });
});

import { validateImage, buildListingImageFields } from '../../utils/housingValidation';

describe('validateImage', () => {
  const base = { imageMode: 'sns' as const, postUrl: 'https://x.com/u/status/123', ogImageUrl: 'https://pbs.twimg.com/media/abc.jpg', tweetId: '123' };

  it('imageMode が sns 以外 + postUrl 無しなら ok', () => {
    expect(validateImage({ imageMode: 'none' } as any).ok).toBe(true);
    expect(validateImage({} as any).ok).toBe(true);
  });

  // 2026-07-20: 直接画像アップロード時 (imageMode!=='sns') でも postUrl を保持できるようになった
  // ため、その場合は host を検証する (実ユーザー報告: postUrl ごと消えるバグの修正に伴う)。
  describe('imageMode!==\'sns\' でも postUrl があるケース (2026-07-20)', () => {
    it('X の投稿URLなら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://x.com/foo/status/123' } as any).ok).toBe(true);
      expect(validateImage({ postUrl: 'https://twitter.com/foo/status/123' } as any).ok).toBe(true);
    });

    it('YouTube の URL なら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://youtu.be/dQw4w9WgXcQ' } as any).ok).toBe(true);
      expect(validateImage({ postUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } as any).ok).toBe(true);
    });

    it('OGP allowlist の URL なら ok', () => {
      expect(validateImage({ imageMode: 'none', postUrl: 'https://housingsnap.com/12345' } as any).ok).toBe(true);
    });

    it('どれにも該当しない URL は invalid', () => {
      const result = validateImage({ imageMode: 'none', postUrl: 'https://evil.example.com/x' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.postUrl).toBeDefined();
    });

    it('https でない postUrl は invalid', () => {
      const result = validateImage({ imageMode: 'none', postUrl: 'http://x.com/foo/status/123' } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.postUrl).toBeDefined();
    });
  });

  it('正常な sns 入力は ok', () => {
    expect(validateImage(base as any).ok).toBe(true);
  });

  it('postUrl が https でないと invalid', () => {
    expect(validateImage({ ...base, postUrl: 'http://x.com/u/status/123' } as any).ok).toBe(false);
  });

  it('ogImageUrl が pbs.twimg.com 以外のホストだと invalid', () => {
    expect(validateImage({ ...base, ogImageUrl: 'https://evil.example.com/a.jpg' } as any).ok).toBe(false);
  });

  it('tweetId が数字でないと invalid', () => {
    expect(validateImage({ ...base, tweetId: 'abc' } as any).ok).toBe(false);
  });

  it('sns なのにフィールド欠落は invalid', () => {
    expect(validateImage({ imageMode: 'sns' } as any).ok).toBe(false);
  });

  // 2026-05-27: OGP 経路 (sourceImageUrls) の検証
  describe('OGP 経路 (sourceImageUrls)', () => {
    const ogpBase = {
      imageMode: 'sns' as const,
      postUrl: 'https://housingsnap.com/12345',
      ogImageUrl: 'https://cdn.example.com/a.jpg',
      sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    };

    it('正常な OGP 入力は ok', () => {
      expect(validateImage(ogpBase as any).ok).toBe(true);
    });

    it('postUrl が OGP allowlist 外だと invalid', () => {
      expect(
        validateImage({ ...ogpBase, postUrl: 'https://evil.example.com/x' } as any).ok,
      ).toBe(false);
    });

    it('sourceImageUrls の URL が https でないと invalid', () => {
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: 'http://cdn.example.com/a.jpg',
          sourceImageUrls: ['http://cdn.example.com/a.jpg'],
        } as any).ok,
      ).toBe(false);
    });

    it('sourceImageUrls が private IP だと invalid (SSRF guard)', () => {
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: 'https://10.0.0.5/a.jpg',
          sourceImageUrls: ['https://10.0.0.5/a.jpg'],
        } as any).ok,
      ).toBe(false);
    });

    it('sourceImageUrls 10 件 (上限) は ok (2026-05-27 4→10 拡大)', () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: urls[0],
          sourceImageUrls: urls,
        } as any).ok,
      ).toBe(true);
    });

    it('sourceImageUrls 11 件は too_many (2026-05-27 4→10 拡大、 サニティ上限維持)', () => {
      const urls = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
      const result = validateImage({
        ...ogpBase,
        ogImageUrl: urls[0],
        sourceImageUrls: urls,
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBe('too_many');
    });

    it('sourceImageUrls に重複があると invalid', () => {
      expect(
        validateImage({
          ...ogpBase,
          sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/a.jpg'],
        } as any).ok,
      ).toBe(false);
    });

    it('ogImageUrl が sourceImageUrls[0] と一致しないと invalid', () => {
      expect(
        validateImage({
          ...ogpBase,
          ogImageUrl: 'https://cdn.example.com/other.jpg',
        } as any).ok,
      ).toBe(false);
    });

    it('youtubeVideoId と sourceImageUrls の同居は conflict (2026-05-27 引き続き禁止)', () => {
      expect(
        validateImage({ ...ogpBase, youtubeVideoId: 'abcdefghijk' } as any).ok,
      ).toBe(false);
    });
  });

  // 2026-05-27: tweetId + sourceImageUrls 排他緩和 (Twitter 静止画ツイート 1-4 枚)
  describe('Twitter 静止画ツイート (tweetId + sourceImageUrls 同居)', () => {
    it('tweetId と pbs.twimg.com の sourceImageUrls 4 枚は ok', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
          'https://pbs.twimg.com/media/C.jpg',
          'https://pbs.twimg.com/media/D.jpg',
        ],
        tags: [],
      } as any);
      expect(result.ok).toBe(true);
    });

    it('tweetId + sourceImageUrls で pbs.twimg.com 以外のホストは reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: ['https://evil.example.com/A.jpg'],
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBeDefined();
    });

    it('tweetId + sourceImageUrls で ogImageUrl が sourceImageUrls[0] と一致しないと invalid', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/X.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
        ],
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
    });

    it('tweetId + sourceImageUrls で重複は invalid', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/A.jpg',
        ],
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.sourceImageUrls).toBe('duplicate');
    });
  });

  // 2026-05-27: Twitter 動画ツイート (tweetId + videoUrl/Poster/AspectRatio)
  describe('Twitter 動画ツイート (videoUrl)', () => {
    it('videoUrl + videoPosterUrl + videoAspectRatio が正常なら ok', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/ext_tw_video/123/pu/vid/avc1/1280x720/xxx.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: 1.78,
        tags: [],
      } as any);
      expect(result.ok).toBe(true);
    });

    it('videoUrl の host が video.twimg.com 以外なら reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://evil.example.com/video.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.videoUrl).toBe('invalid_host');
    });

    it('videoPosterUrl の host が pbs.twimg.com 以外なら reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://evil.example.com/poster.jpg',
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.videoPosterUrl).toBe('invalid_host');
    });

    it('videoAspectRatio が負数なら reject', () => {
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: -1,
        tags: [],
      } as any);
      expect(result.ok).toBe(false);
      expect(result.errors.videoAspectRatio).toBe('invalid');
    });

    it('videoUrl と sourceImageUrls の同居は OK (Twitter は実は photos + video が同居する mediaDetails 構造)', () => {
      // 2026-05-27 hotfix: 当初「Twitter 仕様上 photos と video は排他」 と仮定したが、
      // 実際の syndication JSON では mediaDetails:[video, photo, photo] のように同居する。
      // 同居許可で 「画像 + 動画ツイート」 (= ② パターン) が正しく保存されるようになる。
      const result = validateImage({
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: ['https://pbs.twimg.com/media/A.jpg'],
        tags: [],
      } as any);
      expect(result.ok).toBe(true);
    });
  });
});

describe('buildListingImageFields', () => {
  it('sns + 全フィールド揃いで sns モードのフィールドを返す', () => {
    const out = buildListingImageFields(
      { imageMode: 'sns', postUrl: 'https://x.com/u/status/123', ogImageUrl: 'https://pbs.twimg.com/media/a.jpg', tweetId: '123' } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://x.com/u/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/a.jpg',
      tweetId: '123',
      lastTweetCheckAt: 1000,
    });
  });

  // 2026-05-27: OGP 経路 (sourceImageUrls) の buildListingImageFields
  it('OGP 経路 (sourceImageUrls あり) で sourceImageUrls を含めて返す', () => {
    const out = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://housingsnap.com/12345',
        ogImageUrl: 'https://cdn.example.com/a.jpg',
        sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
      } as any,
      1000,
    );
    expect(out).toEqual({
      imageMode: 'sns',
      postUrl: 'https://housingsnap.com/12345',
      ogImageUrl: 'https://cdn.example.com/a.jpg',
      sourceImageUrls: ['https://cdn.example.com/a.jpg', 'https://cdn.example.com/b.jpg'],
    });
  });

  it('OGP 経路で sourceImageUrls が 11 件来ても先頭 10 件で保存 (2026-05-27 4→10 拡大)', () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.jpg`);
    const out = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://housingsnap.com/12345',
        ogImageUrl: urls[0],
        sourceImageUrls: urls,
      } as any,
      1000,
    );
    if (out.imageMode !== 'sns' || !('sourceImageUrls' in out)) throw new Error('expected OGP sns');
    expect(out.sourceImageUrls).toHaveLength(10);
    expect(out.sourceImageUrls).toEqual(urls.slice(0, 10));
  });

  it('sns 以外は none を返す', () => {
    expect(buildListingImageFields({} as any, 1000)).toEqual({ imageMode: 'none' });
  });

  // 2026-05-27: Twitter 静止画ツイート (tweetId + sourceImageUrls)
  it('Twitter 静止画ツイートは tweetId + sourceImageUrls + lastTweetCheckAt を返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        sourceImageUrls: [
          'https://pbs.twimg.com/media/A.jpg',
          'https://pbs.twimg.com/media/B.jpg',
        ],
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toMatchObject({
      imageMode: 'sns',
      tweetId: '123',
      lastTweetCheckAt: 1700000000000,
      sourceImageUrls: [
        'https://pbs.twimg.com/media/A.jpg',
        'https://pbs.twimg.com/media/B.jpg',
      ],
    });
    expect('videoUrl' in result).toBe(false);
  });

  // 2026-05-27: Twitter 動画ツイート (tweetId + videoUrl/Poster/AspectRatio)
  it('Twitter 動画ツイートは tweetId + video 3 フィールド + lastTweetCheckAt を返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoUrl: 'https://video.twimg.com/x.mp4',
        videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
        videoAspectRatio: 1.78,
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toMatchObject({
      imageMode: 'sns',
      tweetId: '123',
      lastTweetCheckAt: 1700000000000,
      videoUrl: 'https://video.twimg.com/x.mp4',
      videoPosterUrl: 'https://pbs.twimg.com/media/A.jpg',
      videoAspectRatio: 1.78,
    });
    expect('sourceImageUrls' in result).toBe(false);
  });

  it('Twitter テキストツイート (画像も動画も無し) は tweetId のみ返す', () => {
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
        tags: [],
      } as any,
      1700000000000,
    );
    expect(result).toEqual({
      imageMode: 'sns',
      postUrl: 'https://twitter.com/foo/status/123',
      ogImageUrl: 'https://pbs.twimg.com/media/A.jpg',
      tweetId: '123',
      lastTweetCheckAt: 1700000000000,
    });
  });

  it('Twitter 静止画ツイートで sourceImageUrls 11 件は先頭 10 件で保存', () => {
    const urls = Array.from({ length: 11 }, (_, i) => `https://pbs.twimg.com/media/${i}.jpg`);
    const result = buildListingImageFields(
      {
        imageMode: 'sns',
        postUrl: 'https://twitter.com/foo/status/123',
        tweetId: '123',
        ogImageUrl: urls[0],
        sourceImageUrls: urls,
        tags: [],
      } as any,
      1700000000000,
    );
    if (result.imageMode !== 'sns' || !('sourceImageUrls' in result)) {
      throw new Error('expected sns + sourceImageUrls');
    }
    expect(result.sourceImageUrls).toHaveLength(10);
  });
});
