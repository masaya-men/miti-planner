import { buildListingOgCardParams, buildListingOgCardUrl, verifyListingOgCardSig } from '../ogpListingCard';

describe('buildListingOgCardParams', () => {
  it('type/ver/img を挿入順で含む', () => {
    const params = buildListingOgCardParams({ img: 'https://pbs.twimg.com/media/abc.jpg' });
    expect(params.get('type')).toBe('listing');
    expect(params.get('ver')).toBe('1');
    expect(params.get('img')).toBe('https://pbs.twimg.com/media/abc.jpg');
    expect(params.toString()).toBe('type=listing&ver=1&img=https%3A%2F%2Fpbs.twimg.com%2Fmedia%2Fabc.jpg');
  });
});

describe('buildListingOgCardUrl / verifyListingOgCardSig', () => {
  const secret = 'test-secret-value';

  it('組み立てた URL の署名が検証を通る', async () => {
    const url = await buildListingOgCardUrl('https://lopoly.app', { img: 'https://x.test/a.jpg' }, secret);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/api/og');
    expect(parsed.searchParams.get('type')).toBe('listing');
    expect(await verifyListingOgCardSig(parsed.searchParams, secret)).toBe(true);
  });

  it('img 改ざんで署名検証が失敗する', async () => {
    const url = await buildListingOgCardUrl('https://lopoly.app', { img: 'https://x.test/a.jpg' }, secret);
    const parsed = new URL(url);
    parsed.searchParams.set('img', 'https://evil.test/b.jpg');
    expect(await verifyListingOgCardSig(parsed.searchParams, secret)).toBe(false);
  });

  it('secret が違えば検証は失敗する', async () => {
    const url = await buildListingOgCardUrl('https://lopoly.app', { img: 'https://x.test/a.jpg' }, secret);
    const parsed = new URL(url);
    expect(await verifyListingOgCardSig(parsed.searchParams, 'different-secret')).toBe(false);
  });

  it('sig が無ければ検証は失敗する', async () => {
    const params = buildListingOgCardParams({ img: 'https://x.test/a.jpg' });
    expect(await verifyListingOgCardSig(params, secret)).toBe(false);
  });
});
