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
