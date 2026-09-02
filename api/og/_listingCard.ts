/**
 * `type=listing` カード用の要素ツリー + リクエストハンドラ。
 * api/og/index.ts の `type=listing` 分岐から呼ばれる(新規 Edge Function は作らない)。
 *
 * 目的: X 投稿由来の物件を X にシェアしても写真付きカードが出るようにする。
 * X は他サイトのカード画像として pbs.twimg.com(Twitter 自社 CDN)の画像を描画しないため、
 * 物件の代表写真をサーバー側で fetch し、1200×630 に整形した PNG を自ドメインから配る。
 *
 * 整形方式: 背景に同じ写真を cover(はみ出しトリミング)でぼかして敷き、その上に写真全体を
 * contain(切らずに収める)で重ねる。文字・枠・ブランド印は焼き込まない(masaya 指示)。
 * タイトル・住所は og:title / og:description から各 SNS が自前でカード文字部分に出す。
 *
 * satori の要素ツリーは実 JSX ではなくプレーンなオブジェクトリテラルで組み立てる
 * (既存 api/og/index.ts / _housingerCard.ts と同じ流儀)。
 */

import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts, loadInterFonts } from './_fonts.js';
import { fetchAsDataUri } from './_fetchOgImage.js';
import { verifyListingOgCardSig } from '../../src/lib/ogpListingCard.js';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
/** ハウジングの背景色(正典 docs/.private/housing-tour-mockup 系統)。葉書外の下地に使う。 */
const BG_COLOR = '#111725';
/** FFXIV Materials Usage License が認める短縮形 `© SQUARE ENIX` を使用。ゲーム内正式表記より文字数削減。 */
const COPYRIGHT_TEXT = '© SQUARE ENIX';
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

/** satori は `inset: 0` 省略記法を描画できない(空描画になる)。全面レイヤーは 4 辺個別指定。 */
const FULL_BLEED_ABSOLUTE = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

/**
 * 著作権表記(全カード共通・下端中央)。写真の上に乗っても読めるよう強めのシャドウで縁取る。
 * _housingerCard.ts の buildCopyrightLine と同じスタイル方針(11px / Inter / 強シャドウ)。
 */
function buildCopyrightLine() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: 14, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
            fontFamily: '"Inter"', letterSpacing: 0.2,
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)',
            display: 'flex',
          },
          children: COPYRIGHT_TEXT,
        },
      },
    },
  };
}

/**
 * 写真カード: ぼかし背景(cover)+ 軽い暗幕 + 写真本体(contain)+ 下端の © 表記。
 * タイトル・住所・ブランド印は焼き込まない(og:title / og:description が各 SNS のカード文字部分に出る)。
 */
export function buildListingPhotoCard(photoDataUri: string) {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        backgroundColor: BG_COLOR,
      },
      children: [
        {
          type: 'div',
          props: {
            style: {
              ...FULL_BLEED_ABSOLUTE, display: 'flex',
              backgroundImage: `url(${photoDataUri})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'blur(24px)', transform: 'scale(1.15)',
            },
          },
        },
        {
          type: 'div',
          props: { style: { ...FULL_BLEED_ABSOLUTE, display: 'flex', backgroundColor: 'rgba(10,14,24,0.28)' } },
        },
        {
          type: 'img',
          props: {
            src: photoDataUri, width: CARD_WIDTH, height: CARD_HEIGHT,
            style: { position: 'relative', width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: 'contain' },
          },
        },
        buildCopyrightLine(),
      ],
    },
  };
}

/**
 * 代表写真の URL はあるが取得に失敗した場合のフォールバック(「LoPo Housing」+ © 表記)。
 * _listingPageHandler は写真ゼロの物件では type=listing を呼ばない(DEFAULT_OG_IMAGE のまま)ため、
 * これが使われるのは「URL はあるが dead / WebP / timeout」のケースのみ。
 */
export function buildListingBrandFallbackCard() {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { fontSize: 64, fontWeight: 900, color: '#ffffff', letterSpacing: -1, display: 'flex' },
            children: 'LoPo Housing',
          },
        },
        buildCopyrightLine(),
      ],
    },
  };
}

/**
 * `type=listing` リクエストの本体。api/og/index.ts から委譲される。
 * 署名検証 → 写真の事前フェッチ(base64 化) → satori レンダリング。
 * 写真が取れない / レンダリング失敗時はブランドフォールバックカードで 200 を返す(500 を返さない)。
 * © 表記を焼き込むため写真カード経路でもフォントを読み込む(Inter=© 行 / M PLUS 1=フォールバックの見出し。
 * _housingerCard.ts の handleHousingerCardRequest と同じ二種読み込み)。
 */
export async function handleListingCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // 署名検証用の秘密鍵が未設定 = fail-closed(誰でも任意 URL で画像生成できることを防ぐ)。
    return new Response('OGP card unavailable', { status: 400 });
  }
  const validSig = await verifyListingOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const imgUrl = searchParams.get('img') || '';

  const loadFonts = async () => {
    const [mplus1, inter] = await Promise.all([
      loadMPlus1Fonts('LoPo Housing').catch(() => []),
      loadInterFonts([...new Set(COPYRIGHT_TEXT)].join('')).catch(() => []),
    ]);
    return [...mplus1, ...inter];
  };

  try {
    const photoDataUri = imgUrl ? await fetchAsDataUri(imgUrl) : null;
    const fonts = await loadFonts();
    const element = photoDataUri ? buildListingPhotoCard(photoDataUri) : buildListingBrandFallbackCard();
    return new ImageResponse(element as any, {
      width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS,
    });
  } catch (err) {
    console.error('Listing OG card error:', err);
    try {
      const fonts = await loadFonts();
      return new ImageResponse(buildListingBrandFallbackCard() as any, {
        width: CARD_WIDTH, height: CARD_HEIGHT, fonts, headers: CACHE_HEADERS,
      });
    } catch (fallbackErr) {
      console.error('Listing OG card fallback error:', fallbackErr);
      return new Response('OG image generation failed', { status: 500 });
    }
  }
}
