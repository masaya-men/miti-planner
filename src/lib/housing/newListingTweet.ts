/**
 * 新着ハウジングの「ワンクリックツイート下書き」Discord 通知の本文を組み立てる純関数。
 * Firebase 非依存。文面はすべて日本語固定 (設計書 §5)。
 * 設計書: docs/superpowers/specs/2026-08-28-housing-new-listing-tweet-draft-notification-design.md
 */
import { buildHousingerShortSlug } from './housingerProfile.js';
import { formatFullHousingAddress } from './formatHousingAddress.js';
import { regionForDC } from '../../data/housing/dcServerMap.js';
import type { HousingArea } from '../../types/housing.js';

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
  const bodyLines = [`${BODY_LEAD} ${HASHTAGS}`, listingUrl];
  if (input.postUrl) bodyLines.push(input.postUrl);
  const bodyText = bodyLines.join('\n');
  const bodyIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(bodyText)}`;

  // --- 見出し ---
  const trimmedTitle = (input.title ?? '').trim();
  let heading = trimmedTitle || addressText(input) || '(タイトル・住所なし)';
  if (input.visibility === 'unlisted') heading += '（住所非公開）';

  // --- 登録者名 / リプ ---
  const rawName = input.housingerName ?? '';
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
