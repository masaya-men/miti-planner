/**
 * ハウジンガーページ (/housing/housinger/:uid) 専用 OGP カードのレイアウト定義 (v3・2026-07-31刷新)
 *
 * api/og/index.ts の `type=housinger` 分岐から呼ばれる(新規 Edge Function は作らない)。
 * satori の要素ツリーは実 JSX ではなく、既存 api/og/index.ts と同じくプレーンな
 * オブジェクトリテラル ({ type, props: { style, children } }) で組み立てる流儀に合わせる。
 *
 * v3レイアウト(spec docs/superpowers/specs/2026-07-31-housinger-ogp-card-redesign-design.md):
 * 代表作の1枚目(背景兼ヒーロー) → 拡大+ぼかしでカード全面の背景にし、同じ画像をパネル内
 * 右下にもぼかさず大きめに再表示する。パネルはヘッダー/フッターなしのハウジング意匠(honey accent)。
 * 中央にアイコン+名前+紹介文+「Shared via LoPo Housing」固定英語表記。残り9枚は上4・下4・
 * 中1のグリッドに配置する。画像が1枚も無ければ物件0件用の固定背景(ツアー招待カードと共通)に
 * フォールバックしパネルのみ表示する。
 *
 * 重要 (satori の画像フェッチに関する制約): 既存の index.ts / _tourInviteCard.ts と同じく、
 * リモート URL は avatar/img とも事前に fetch → base64 data URI 化してから要素ツリーに渡す
 * (レンダリング中の画像 fetch 失敗は ImageResponse 生成後の非同期ストリーム内で起きるため
 * try/catch で捕捉できない)。
 */

import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts } from './_fonts.js';
import { verifyHousingerOgCardSig } from '../../src/lib/ogpHousingerCard.js';
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';

// ハウジングのトンマナ(正典 docs/.private/housing-tour-mockup/index.html 系統の色)
const BG_COLOR = '#111725';
const ACCENT_HONEY = '#ffc987';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';
const PANEL_BORDER = 'rgba(255,201,135,0.35)';
const PANEL_BG = 'rgba(17,23,37,0.72)';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const PANEL_MARGIN = 28;
const HERO_SIZE = 220;
const GRID_THUMB = 84;
const GRID_GAP = 10;
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};
/** 画像1枚あたりの取得タイムアウト(外部SNS画像等が遅い/無応答でもカード生成全体を巻き込まない)。 */
const IMAGE_FETCH_TIMEOUT_MS = 4000;
/** 異常に大きい画像レスポンスを弾く上限(OGP用途でここまでのサイズは不要)。 */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * `type=housinger` カード用の要素ツリーを組み立てる。
 * imageSrcs は0〜10枚のいずれでも破綻しない(0枚ならツアー背景+パネルのみ、
 * 1枚以上なら先頭を背景兼ヒーローとして使う)。
 */
export function buildHousingerCard(params: {
  name: string;
  bio: string | null;
  avatarSrc: string | null;
  imageSrcs: string[];
}) {
  const { name, bio, avatarSrc, imageSrcs } = params;
  const displayName = name || 'ハウジンガー';
  const heroSrc = imageSrcs[0] ?? null;
  const gridSrcs = imageSrcs.slice(1, 10); // 残り最大9枚(上4/中1/下4)

  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', position: 'relative',
        backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        buildBackgroundLayer(heroSrc),
        buildScrimLayer(),
        buildPanel(displayName, bio, avatarSrc, heroSrc, gridSrcs),
      ],
    },
  };
}

/** position:absolute の全面フィット指定。satoriは `inset: 0` 省略記法を描画できず
 * (2026-07-31実機+ローカルsatori直呼び出しで再現・特定: 完全に空描画になる)、
 * 4辺を個別指定すれば正しく描画されるため、絶対配置の全面レイヤーは必ずこちらを使う。 */
const FULL_BLEED_ABSOLUTE = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

/** 背景兼ヒーロー画像を拡大+ぼかしてカード全面に敷く。画像が無ければツアー招待カードと共通の固定背景。 */
function buildBackgroundLayer(heroSrc: string | null) {
  return {
    type: 'div',
    props: {
      style: {
        ...FULL_BLEED_ABSOLUTE, display: 'flex',
        backgroundImage: `url(${heroSrc ?? TOUR_INVITE_BG_DATA_URI})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        // ヒーロー画像(ユーザー写真)のときだけ強くぼかす。ツアー背景は既にぼかし加工済みの
        // 素材のためここで二重にぼかさない(輪郭が甘くなりすぎるのを防ぐ)。
        ...(heroSrc ? { filter: 'blur(32px)', transform: 'scale(1.15)' } : {}),
      },
    },
  };
}

/** 可読性のための暗幕(ツアー招待カードと同じ考え方)。 */
function buildScrimLayer() {
  return {
    type: 'div',
    props: { style: { ...FULL_BLEED_ABSOLUTE, display: 'flex', backgroundColor: 'rgba(10,14,24,0.55)' } },
  };
}

/** ヘッダー・フッターなしの1枚パネル。左=アイコン+名前+紹介文+ブランド表記、右=代表作グリッド。 */
function buildPanel(
  displayName: string,
  bio: string | null,
  avatarSrc: string | null,
  heroSrc: string | null,
  gridSrcs: string[],
) {
  const nameLen = displayName.length;
  const nameFontSize = nameLen > 20 ? 32 : nameLen > 12 ? 38 : 44;

  const avatarNode = avatarSrc
    ? { type: 'img', props: { src: avatarSrc, width: 88, height: 88, style: { borderRadius: 44, objectFit: 'cover' } } }
    : {
      type: 'div',
      props: {
        style: {
          width: 88, height: 88, borderRadius: 44, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,201,135,0.14)', border: `2px solid ${ACCENT_HONEY}`,
        },
        children: {
          type: 'div',
          props: { style: { fontSize: 36, fontWeight: 900, color: ACCENT_HONEY }, children: displayName.slice(0, 1) },
        },
      },
    };

  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', display: 'flex', flexDirection: 'row',
        top: PANEL_MARGIN, left: PANEL_MARGIN, right: PANEL_MARGIN, bottom: PANEL_MARGIN,
        borderRadius: 24, border: `1px solid ${PANEL_BORDER}`, backgroundColor: PANEL_BG,
        padding: 36, gap: 32,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, minWidth: 0 },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 20 },
                  children: [
                    avatarNode,
                    { type: 'div', props: { style: { fontSize: nameFontSize, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5, lineHeight: 1.2, display: 'flex' }, children: displayName } },
                  ],
                },
              },
              ...(bio ? [{
                type: 'div',
                props: { style: { fontSize: 20, color: TEXT_MUTED, lineHeight: 1.5, display: 'flex', lineClamp: 2 }, children: bio },
              }] : []),
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 16, fontWeight: 700, letterSpacing: 1.5, color: ACCENT_HONEY,
                    textTransform: 'uppercase', display: 'flex',
                  },
                  children: 'Shared via LoPo Housing',
                },
              },
            ],
          },
        },
        ...(heroSrc ? [buildGridColumn(heroSrc, gridSrcs)] : []),
      ],
    },
  };
}

/** 右側の代表作グリッド: 上4・(中1+ヒーロー)・下4。 */
function buildGridColumn(heroSrc: string, gridSrcs: string[]) {
  const top = gridSrcs.slice(0, 4);
  const leftover = gridSrcs[4] ?? null;
  const bottom = gridSrcs.slice(5, 9);

  return {
    type: 'div',
    props: {
      style: { flex: '0 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: GRID_GAP },
      children: [
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: GRID_GAP }, children: top.map((src) => buildGridThumb(src)) } },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'row', gap: GRID_GAP, alignItems: 'flex-end', justifyContent: 'space-between' },
            children: [
              leftover ? buildGridThumb(leftover) : { type: 'div', props: { style: { width: GRID_THUMB, height: GRID_THUMB, display: 'flex' } } },
              buildHeroThumb(heroSrc),
            ],
          },
        },
        { type: 'div', props: { style: { display: 'flex', flexDirection: 'row', gap: GRID_GAP }, children: bottom.map((src) => buildGridThumb(src)) } },
      ],
    },
  };
}

function buildHeroThumb(src: string) {
  return {
    type: 'div',
    props: {
      style: { width: HERO_SIZE, height: HERO_SIZE, borderRadius: 16, overflow: 'hidden', display: 'flex', border: `2px solid ${ACCENT_HONEY}`, flex: '0 0 auto' },
      children: { type: 'img', props: { src, width: HERO_SIZE, height: HERO_SIZE, style: { objectFit: 'cover' } } },
    },
  };
}

function buildGridThumb(src: string) {
  return {
    type: 'div',
    props: {
      style: { width: GRID_THUMB, height: GRID_THUMB, borderRadius: 8, overflow: 'hidden', display: 'flex', flex: '0 0 auto' },
      children: { type: 'img', props: { src, width: GRID_THUMB, height: GRID_THUMB, style: { objectFit: 'cover' } } },
    },
  };
}

/** 画像取得/satoriレンダリング失敗時の最小限フォールバック（名前のみ）。 */
export function buildHousingerFallbackCard(name: string) {
  const displayName = name || 'LoPo Housing';
  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif', gap: 24,
      },
      children: [
        { type: 'div', props: { style: { fontSize: 64, fontWeight: 900, color: '#ffffff', letterSpacing: -1 }, children: displayName } },
        {
          type: 'div',
          props: {
            style: {
              fontSize: 20, fontWeight: 700, letterSpacing: 2, color: ACCENT_HONEY,
              textTransform: 'uppercase', border: `1px solid ${ACCENT_HONEY}`,
              borderRadius: 8, padding: '10px 20px',
            },
            children: 'LoPo Housing',
          },
        },
      ],
    },
  };
}

/** ArrayBuffer → base64 文字列（edge runtime に `Buffer` は無いため `btoa` + チャンク処理で実装）。 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000; // 32KB刻み（String.fromCharCode の引数上限を避けるため一括展開しない）
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * 先頭バイトのマジックナンバーから satori が扱える画像形式か判定する。
 * satori (@vercel/og) は WebP/AVIF 非対応で、渡すとレンダリングが
 * 「TypeError: u2 is not iterable」で落ちて空の 200 PNG が返る実バグを踏んだ
 * (2026-07-17 実測・Firebase Storage のアバターが image/webp)。
 * content-type は CDN によって不正確なことがあるため、実バイトで判定する。
 */
function sniffSupportedImageMime(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf);
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  return null; // WebP (RIFF....WEBP) / AVIF / その他は satori 非対応なので除外
}

/**
 * 画像 URL を fetch して base64 data URI 化する。失敗（ネットワークエラー・非2xx・
 * satori 非対応形式 (WebP等)・タイムアウト・サイズ超過）時は null を返す
 * （呼び出し側は「画像無し」として扱う = アバターならプレースホルダ・一覧画像なら省く）。
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > IMAGE_MAX_BYTES) return null;
    const mime = sniffSupportedImageMime(buf);
    if (!mime) return null;
    return `data:${mime};base64,${arrayBufferToBase64(buf)}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * `type=housinger` リクエストの本体。api/og/index.ts から委譲される。
 * 署名検証 → 画像の事前フェッチ(base64化) → satori レンダリング、失敗時は
 * 名前のみのシンプルカードにフォールバックする（500 を返さない）。
 */
export async function handleHousingerCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // 署名検証用の秘密鍵が未設定 = fail-closed（誰でも任意パラメータで生成できてしまうことを防ぐ）。
    return new Response('OGP card unavailable', { status: 400 });
  }

  const validSig = await verifyHousingerOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const name = (searchParams.get('name') || '').slice(0, 100);
  const bio = (searchParams.get('bio') || '').slice(0, 100) || null;
  const avatarUrl = searchParams.get('avatar');
  const imageUrls = searchParams.getAll('img').slice(0, 10);

  try {
    const [avatarSrc, ...imageSrcs] = await Promise.all([
      avatarUrl ? fetchAsDataUri(avatarUrl) : Promise.resolve(null),
      ...imageUrls.map((u) => fetchAsDataUri(u)),
    ]);
    const resolvedImageSrcs = imageSrcs.filter((s): s is string => !!s);

    const uniqueChars = [...new Set('LoPo Housing Shared via LoPo Housing FF14 Housing Tour' + name + (bio ?? ''))].join('');
    const fonts = await loadMPlus1Fonts(uniqueChars);

    const element = buildHousingerCard({ name, bio, avatarSrc, imageSrcs: resolvedImageSrcs });
    return new ImageResponse(element as any, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts,
      headers: CACHE_HEADERS,
    });
  } catch (err) {
    console.error('Housinger OG card error:', err);
    try {
      const fonts = await loadMPlus1Fonts([...new Set('LoPo Housing' + name)].join('')).catch(() => []);
      const element = buildHousingerFallbackCard(name);
      return new ImageResponse(element as any, {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        fonts,
        headers: CACHE_HEADERS,
      });
    } catch (fallbackErr) {
      console.error('Housinger OG card fallback error:', fallbackErr);
      return new Response('OG image generation failed', { status: 500 });
    }
  }
}
