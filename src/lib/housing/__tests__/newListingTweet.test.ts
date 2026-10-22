import { describe, it, expect } from 'vitest';
import { buildNewListingNotification } from '../newListingTweet';

const base = {
  listingId: 'AbC123',
  visibility: 'public' as const,
  housingerUid: 'hashed:d34d9c12abcdef00',
  housingerName: 'ミコッテ太郎',
  housingerProfilePublished: true,
};

describe('buildNewListingNotification', () => {
  it('本文ツイートリンクに固定リード+2ハッシュタグ+物件URLが入る', () => {
    const { discordContent } = buildNewListingNotification({ ...base, title: 'サンドリア風の隠れ家' });
    // intent URL は text= に全部入る (url= は使わない)
    const m = discordContent.match(/<https:\/\/twitter\.com\/intent\/tweet\?text=([^>]+)>/);
    expect(m).toBeTruthy();
    const decoded = decodeURIComponent(m![1]);
    expect(decoded).toContain('新しいハウジングが投稿されました🏠');
    expect(decoded).toContain('#FF14ハウジング #FFXIVHousing');
    // リード文とハッシュタグの間は改行 + 空白行 1 行
    expect(decoded).toContain('新しいハウジングが投稿されました🏠\n\n#FF14ハウジング #FFXIVHousing');
    expect(decoded).toContain('https://lopoly.app/housing/listing/AbC123');
  });

  it('投稿元URLがあれば本文の最後の行に付く (物件URLより後)', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/mikotetaro/status/1234567890',
    });
    const decoded = decodeURIComponent(
      discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1],
    );
    const listingIdx = decoded.indexOf('https://lopoly.app/housing/listing/AbC123');
    const srcIdx = decoded.indexOf('https://x.com/mikotetaro/status/1234567890');
    expect(listingIdx).toBeGreaterThan(-1);
    expect(srcIdx).toBeGreaterThan(listingIdx);
  });

  it('投稿元URLが無ければ本文に物件URLだけ', () => {
    const { discordContent } = buildNewListingNotification({ ...base, title: 'x', postUrl: null });
    const decoded = decodeURIComponent(
      discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1],
    );
    expect(decoded).not.toContain('x.com/');
  });

  it('プロフィール公開時はリプ用コードブロック (リード + /h/ 短縮URL) を出す', () => {
    const { discordContent } = buildNewListingNotification({ ...base, title: 'x' });
    expect(discordContent).toContain('ミコッテ太郎さんの他のハウジングはこちら👇');
    expect(discordContent).toMatch(/https:\/\/lopoly\.app\/h\/[^\s`]*d34d9c12/);
    expect(discordContent).toContain('```'); // コードブロック
  });

  it('プロフィール未公開ならリプ用ブロックを出さず「未公開」と明記', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', housingerProfilePublished: false,
    });
    expect(discordContent).toContain('※ハウジンガーページ未公開のためリプはスキップ');
    expect(discordContent).not.toContain('他のハウジングはこちら');
  });

  it('登録者名に # が含まれていても除去する (投稿時に意図せずハッシュタグ化するのを防ぐ)', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', housingerName: '#ハウジングパパ',
    });
    expect(discordContent).toContain('登録者: ハウジングパパ');
    expect(discordContent).toContain('ハウジングパパさんの他のハウジングはこちら👇');
    expect(discordContent).not.toContain('#ハウジングパパ');
  });

  it('登録者名が空なら「名無しさん」にフォールバック', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', housingerName: '', housingerProfilePublished: false,
    });
    expect(discordContent).toContain('登録者: 名無しさん');
  });

  it('タイトル未入力なら見出しに住所を出す (public)', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: '   ',
      dc: 'Elemental', server: 'Carbuncle', area: 'Mist', ward: 5, plot: 12, buildingType: 'house',
    });
    expect(discordContent).toContain('🏠 新着ハウジング: ');
    expect(discordContent).not.toContain('🏠 新着ハウジング: \n');
  });

  it('unlisted は見出しに「（住所非公開）」を付ける', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: '白基調のアパルトメント', visibility: 'unlisted',
    });
    expect(discordContent).toContain('白基調のアパルトメント（住所非公開）');
  });

  it('確認用の物件ページURLを必ず含める / 投稿元があれば併記', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/a/status/1',
    });
    expect(discordContent).toContain('https://lopoly.app/housing/listing/AbC123');
    expect(discordContent).toContain('https://x.com/a/status/1');
  });

  // 2026-10-12: HOUSING SNAP は twitter:card="photo"(X で廃止済み)のためカードが出ず、LoPo のカードが
  // 目立ってしまう。X のポストが見つかればそれを最後(=引用先)にし、無ければ本文に制作者名を出す。
  const bodyOf = (discordContent: string) =>
    decodeURIComponent(discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1]);

  it('投稿元が HOUSING SNAP でも登録データに X のポストがあれば、それを最後の行(引用先)にする', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x',
      postUrl: 'https://housingsnap.com/47813',
      sourcePostUrls: ['https://housingsnap.com/47813', 'https://x.com/Ryndessa/status/2108137760611565932?s=20'],
    });
    const lines = bodyOf(discordContent).split('\n');
    expect(lines.at(-1)).toBe('https://x.com/Ryndessa/status/2108137760611565932');
    expect(bodyOf(discordContent)).not.toContain('housingsnap.com');
    // 確認用には元の投稿元も残す
    expect(discordContent).toContain('https://housingsnap.com/47813');
  });

  it('HOUSING SNAP のページから拾った本人の X ポスト (creatorPostUrl) を引用先にする', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x',
      postUrl: 'https://housingsnap.com/47818',
      creatorPostUrl: 'https://x.com/Ryndessa/status/2109303140176499156',
      creatorName: 'Ryndessa',
    });
    const body = bodyOf(discordContent);
    expect(body.split('\n').at(-1)).toBe('https://x.com/Ryndessa/status/2109303140176499156');
    expect(body).not.toContain('housingsnap.com');
    // 引用で本人が見えるので文字のクレジットは付けない
    expect(body).not.toContain('制作:');
  });

  it('HOUSING SNAP で X ポストが無ければ、本文に「制作: ○○さん（HOUSING SNAP）」を入れる', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x',
      postUrl: 'https://housingsnap.com/47818',
      creatorName: 'Ryn#des@sa',
    });
    const body = bodyOf(discordContent);
    expect(body).toContain('新しいハウジングが投稿されました🏠\n制作: Ryndessaさん（HOUSING SNAP）\n\n#FF14ハウジング');
    expect(body.split('\n').at(-1)).toBe('https://housingsnap.com/47818');
  });

  // 2026-10-22: Studio XIV でも LoPo のカードが目立った(masaya)。引用できる X ポストが無いときは
  // 本文から LoPo の URL を外してリプへ回し、本文の URL を投稿元 1 本だけにする。
  it('X ポストを引用できない投稿元 (studio-xiv 等) は本文に LoPo の URL を入れず、投稿元だけにする', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://studio-xiv.com/studio/101158/', creatorName: 'someone',
    });
    const body = bodyOf(discordContent);
    expect(body.split('\n').at(-1)).toBe('https://studio-xiv.com/studio/101158/');
    expect(body).not.toContain('lopoly.app');
    expect(body).not.toContain('制作:');
    // LoPo の URL はリプ用に回る (ハウジンガーページのリンクより前)
    const listingIdx = discordContent.indexOf('LoPo で行き方ナビつきで見る👇\nhttps://lopoly.app/housing/listing/AbC123');
    expect(listingIdx).toBeGreaterThan(discordContent.indexOf('リプ用'));
    expect(discordContent.indexOf('さんの他のハウジングはこちら👇')).toBeGreaterThan(listingIdx);
  });

  it('HOUSING SNAP で X ポストが無いときも本文に LoPo の URL を入れない', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://housingsnap.com/47818', creatorName: 'Ryndessa',
    });
    expect(bodyOf(discordContent)).not.toContain('lopoly.app');
  });

  it('LoPo の URL をリプへ回すとき、ハウジンガーページ未公開でもリプ用ブロックを出す', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://studio-xiv.com/studio/101158/', housingerProfilePublished: false,
    });
    expect(discordContent).toContain('LoPo で行き方ナビつきで見る👇\nhttps://lopoly.app/housing/listing/AbC123');
    expect(discordContent).not.toContain('他のハウジングはこちら');
  });

  it('X ポストを引用できるときは従来どおり本文に LoPo の URL を残す', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/a/status/1',
    });
    expect(bodyOf(discordContent)).toContain('https://lopoly.app/housing/listing/AbC123');
    expect(discordContent).not.toContain('LoPo で行き方ナビつきで見る');
  });

  it('生成されるツイート本文は280文字以内', () => {
    const { discordContent } = buildNewListingNotification({
      ...base, title: 'x', postUrl: 'https://x.com/verylongusername/status/1234567890123456789',
    });
    const decoded = decodeURIComponent(
      discordContent.match(/intent\/tweet\?text=([^>]+)>/)![1],
    );
    // URL は t.co 換算 23 だが、ここでは素の長さでも十分余裕がある想定
    expect(decoded.length).toBeLessThanOrEqual(280);
  });
});
