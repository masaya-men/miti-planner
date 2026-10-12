/**
 * 新着ハウジングの「ワンクリックツイート下書き」Discord 通知の本文を組み立てる純関数。
 * Firebase 非依存。文面はすべて日本語固定 (設計書 §5)。
 * 設計書: docs/superpowers/specs/2026-08-28-housing-new-listing-tweet-draft-notification-design.md
 */
import { buildHousingerShortSlug } from './housingerProfile.js';
import { formatFullHousingAddress } from './formatHousingAddress.js';
import { regionForDC } from '../../data/housing/dcServerMap.js';
import type { HousingArea } from '../../types/housing.js';
import { isHousingSnapPostUrl, normalizeXStatusUrl } from './housingSnapCreator.js';

const SITE_ORIGIN = 'https://lopoly.app';
/** 設計書 §5 で確定。ここだけ書き換えれば全ツイートに反映される。 */
const HASHTAGS = '#FF14ハウジング #FFXIVHousing';
const BODY_LEAD = '新しいハウジングが投稿されました🏠';
const NAME_FALLBACK = '名無しさん';
const replyLead = (name: string) => `${name}さんの他のハウジングはこちら👇`;

export interface NewListingNotificationInput {
  listingId: string;
  title?: string | null;
  visibility: 'public' | 'unlisted' | 'private';
  dc?: string;
  server?: string;
  area?: string;
  ward?: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  apartmentBuilding?: 1 | 2;
  roomNumber?: number;
  postUrl?: string | null;
  /** 登録時の投稿元一覧。postUrl が X 以外でも、ここに X のポストがあれば引用先に使う */
  sourcePostUrls?: string[];
  /** HOUSING SNAP のページから拾った作者本人の X ポスト (api/housing/_housingSnapCreator.ts) */
  creatorPostUrl?: string | null;
  /** HOUSING SNAP のページから拾った作者名 (X ポストが無いときの文字クレジット用) */
  creatorName?: string | null;
  housingerUid: string;
  housingerName: string | null;
  housingerProfilePublished: boolean;
}

/** タイトル未入力時のフォールバック住所文字列 (出せなければ null)。 */
function addressText(input: NewListingNotificationInput): string | null {
  if (
    typeof input.area === 'string'
    && typeof input.ward === 'number'
    && typeof input.dc === 'string'
    && typeof input.server === 'string'
  ) {
    return formatFullHousingAddress(
      {
        area: input.area as HousingArea,
        ward: input.ward,
        buildingType: input.buildingType,
        plot: input.plot,
        apartmentBuilding: input.apartmentBuilding,
        roomNumber: input.roomNumber,
        region: regionForDC(input.dc),
        dc: input.dc,
        server: input.server,
      },
      'ja',
    );
  }
  return null;
}

export function buildNewListingNotification(input: NewListingNotificationInput): { discordContent: string } {
  const listingUrl = `${SITE_ORIGIN}/housing/listing/${input.listingId}`;

  // --- 本文ツイート (Web Intent。URL はすべて text= に入れる) ---
  // X は最後の URL で引用/カードを決める。作者の手柄を取らないよう、作者の X ポストがあれば必ずそれを最後に置く
  // (投稿元が HOUSING SNAP 等でも、登録データ or ページ内に X ポストがあればそちらを引用)。
  const quoteUrl = [input.creatorPostUrl, input.postUrl, ...(input.sourcePostUrls ?? [])]
    .map((u) => (typeof u === 'string' ? normalizeXStatusUrl(u) : null))
    .find((u): u is string => !!u) ?? null;
  const lastUrl = quoteUrl ?? input.postUrl ?? null;
  // HOUSING SNAP は twitter:card="photo"(X で廃止済み)でカードが出ず LoPo のカードが目立つ。
  // 引用もできないときは、本文に作者名を出して作者を先に見せる。
  const creatorName = (input.creatorName ?? '').replace(/[#@]/g, '').trim();
  const credit = !quoteUrl && lastUrl && isHousingSnapPostUrl(lastUrl) && creatorName
    ? `\n制作: ${creatorName}さん（HOUSING SNAP）`
    : '';
  // リード文とハッシュタグの間は改行 + 空白行 1 行 (2026-08-31 実機テスト後のユーザー指定)。
  const bodyLines = [`${BODY_LEAD}${credit}\n\n${HASHTAGS}`, listingUrl];
  if (lastUrl) bodyLines.push(lastUrl);
  const bodyText = bodyLines.join('\n');
  const bodyIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(bodyText)}`;

  // --- 見出し ---
  const trimmedTitle = (input.title ?? '').trim();
  let heading = trimmedTitle || addressText(input) || '(タイトル・住所なし)';
  if (input.visibility === 'unlisted') heading += '（住所非公開）';

  // --- 登録者名 / リプ ---
  // "#" が残っていると "{name}さんの他のハウジングはこちら" が投稿時にそのままハッシュタグとして
  // 機能してしまう(2026-09-15 masaya 指摘)ため、リプ文面に使う前に除去する。
  const rawName = (input.housingerName ?? '').replace(/#/g, '');
  const name = rawName.trim() || NAME_FALLBACK;

  let replyBlock = '';
  let registrantNote = '';
  if (input.housingerProfilePublished) {
    const slug = buildHousingerShortSlug(rawName, input.housingerUid);
    const housingerUrl = `${SITE_ORIGIN}/h/${slug}`;
    replyBlock =
      '\n▶ リプ用 (本文を投稿したあと、自分のツイートに「返信」して貼り付け):\n'
      + '```\n'
      + `${replyLead(name)}\n${housingerUrl}\n`
      + '```\n';
  } else {
    registrantNote = ' ※ハウジンガーページ未公開のためリプはスキップ';
  }

  // --- 確認用 ---
  const confirmLines = [`物件ページ  ${listingUrl}`];
  if (input.postUrl) confirmLines.push(`投稿元      ${input.postUrl}`);
  if (quoteUrl && quoteUrl !== normalizeXStatusUrl(input.postUrl ?? '')) confirmLines.push(`引用先      ${quoteUrl}`);

  const discordContent =
    `🏠 新着ハウジング: ${heading}\n`
    + `登録者: ${name}${registrantNote}\n`
    + `\n▶ 本文ツイートを作成 (クリックで投稿画面):\n`
    + `<${bodyIntentUrl}>\n`
    + replyBlock
    + `\n確認用:\n`
    + confirmLines.join('\n');

  return { discordContent };
}
