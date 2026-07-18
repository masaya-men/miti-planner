import { buildTourInviteOgCardParams, buildTourInviteOgCardUrl, verifyTourInviteOgCardSig } from '../ogpTourInviteCard';

describe('buildTourInviteOgCardParams', () => {
  it('type/ver/nameを含む', () => {
    const params = buildTourInviteOgCardParams({ name: '休日ハウジング巡り' });
    expect(params.get('type')).toBe('tour');
    expect(params.get('name')).toBe('休日ハウジング巡り');
  });
  it('nameが未指定/空文字なら空文字になる', () => {
    const params = buildTourInviteOgCardParams({ name: '' });
    expect(params.get('name')).toBe('');
  });
});

describe('buildTourInviteOgCardUrl / verifyTourInviteOgCardSig', () => {
  const secret = 'test-secret-value';

  it('組み立てたURLの署名が検証を通る', async () => {
    const url = await buildTourInviteOgCardUrl('https://lopoly.app', { name: 'テスト' }, secret);
    const parsed = new URL(url);
    expect(parsed.pathname).toBe('/api/og');
    expect(await verifyTourInviteOgCardSig(parsed.searchParams, secret)).toBe(true);
  });

  it('パラメータ改ざんで署名検証が失敗する', async () => {
    const url = await buildTourInviteOgCardUrl('https://lopoly.app', { name: 'テスト' }, secret);
    const parsed = new URL(url);
    parsed.searchParams.set('name', '改ざん');
    expect(await verifyTourInviteOgCardSig(parsed.searchParams, secret)).toBe(false);
  });

  it('secretが違えば検証は失敗する', async () => {
    const url = await buildTourInviteOgCardUrl('https://lopoly.app', { name: 'テスト' }, secret);
    const parsed = new URL(url);
    expect(await verifyTourInviteOgCardSig(parsed.searchParams, 'different-secret')).toBe(false);
  });

  it('sigが無ければ検証は失敗する', async () => {
    const params = buildTourInviteOgCardParams({ name: 'A' });
    expect(await verifyTourInviteOgCardSig(params, secret)).toBe(false);
  });
});
