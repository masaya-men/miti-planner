/**
 * `type=tour` カード用の要素ツリー + リクエストハンドラ。
 * api/og/index.ts の `type=tour` 分岐から呼ばれる(新規 Edge Function は作らない)。
 * 背景はユーザー提供のツアーナビ画面スクショ(既にぼかし加工済み・ビルド時base64埋め込み・
 * 外部fetch無し=ハウジンガーカードのアバター取得のような失敗点が無い)。
 */
import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts } from './_fonts.js';
import { verifyTourInviteOgCardSig } from '../../src/lib/ogpTourInviteCard.js';
import { SHARED_TOUR_NAME_MAX_LENGTH } from '../../src/types/sharedTour.js';
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';

const ACCENT_HONEY = '#ffc987';
const ACCENT_HONEY_GLOW = '#ffb35a';
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

function buildTourInviteCard(name: string) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
        backgroundImage: `url(${TOUR_INVITE_BG_DATA_URI})`,
        backgroundSize: 'cover',
        fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        // 可読性のための暗幕(背景がぼかし済みでも文字が沈まないよう軽く重ねる)。
        {
          type: 'div',
          props: { style: { position: 'absolute', inset: 0, backgroundColor: 'rgba(10,14,24,0.42)', display: 'flex' } },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'relative', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 20, padding: '0 80px', textAlign: 'center',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 64, fontWeight: 900, letterSpacing: -1, lineHeight: 1.2,
                    backgroundImage: `linear-gradient(135deg, ${ACCENT_HONEY}, ${ACCENT_HONEY_GLOW})`,
                    backgroundClip: 'text', color: 'transparent', display: 'flex',
                  },
                  children: 'LoPo Housing Tour',
                },
              },
              ...(name ? [{
                type: 'div',
                props: {
                  style: { fontSize: 32, fontWeight: 700, color: '#ffffff', display: 'flex' },
                  children: name.slice(0, SHARED_TOUR_NAME_MAX_LENGTH),
                },
              }] : []),
            ],
          },
        },
      ],
    },
  };
}

/** 画像取得/satoriレンダリング失敗時の最小限フォールバック(ブランド文字のみ)。 */
function buildTourInviteFallbackCard() {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#111725', fontFamily: '"M PLUS 1", sans-serif',
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 64, fontWeight: 900, letterSpacing: -1,
            backgroundImage: `linear-gradient(135deg, ${ACCENT_HONEY}, ${ACCENT_HONEY_GLOW})`,
            backgroundClip: 'text', color: 'transparent', display: 'flex',
          },
          children: 'LoPo Housing Tour',
        },
      },
    },
  };
}

export async function handleTourInviteCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return new Response('OGP card unavailable', { status: 400 });
  }
  const validSig = await verifyTourInviteOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const name = (searchParams.get('name') || '').slice(0, SHARED_TOUR_NAME_MAX_LENGTH);

  try {
    const uniqueChars = [...new Set('LoPo Housing Tour' + name)].join('');
    const fonts = await loadMPlus1Fonts(uniqueChars);
    const element = buildTourInviteCard(name);
    return new ImageResponse(element as any, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS });
  } catch (err) {
    console.error('Tour invite OG card error:', err);
    try {
      const fonts = await loadMPlus1Fonts('LoPo Housing Tour').catch(() => []);
      const element = buildTourInviteFallbackCard();
      return new ImageResponse(element as any, { width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS });
    } catch (fallbackErr) {
      console.error('Tour invite OG card fallback error:', fallbackErr);
      return new Response('OG image generation failed', { status: 500 });
    }
  }
}
