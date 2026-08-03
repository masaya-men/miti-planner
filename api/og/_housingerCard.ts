/**
 * ハウジンガーページ (/housing/housinger/:uid) 専用 OGP カードのレイアウト定義 (v4・2026-08-03刷新)
 *
 * api/og/index.ts の `type=housinger` 分岐から呼ばれる(新規 Edge Function は作らない)。
 * satori の要素ツリーは実 JSX ではなく、既存 api/og/index.ts と同じくプレーンな
 * オブジェクトリテラル ({ type, props: { style, children } }) で組み立てる流儀に合わせる。
 *
 * v4レイアウト(ユーザー作成モックアップの実物SVGをclipPath解析して座標を実測・再現。
 * 目視推定ではない。詳細=docs/.private/2026-08-01-ogp-card-design-mockups.md):
 * 採用2案 (`HousingerCardPattern`) —
 *   - `grid`: 上下2段(各4枚)+中央左右2枚の大判写真。中央の隙間にアバター+横書きブランド文字。
 *   - `sidebar`: 左端に縦書きブランド文字+アバター。右側に写真10枚(上下2枚組×2列+中央大判+下段5枚)。
 * どちらも写真スロットは常に10枚固定。呼び出し側が渡す imageSrcs が10枚に満たない場合は
 * 先頭から巡回コピーして10枚に埋める(0枚なら写真無しのフォールバック表示)。
 * 先頭(imageSrcs[0])は背景兼ヒーロー(ぼかし拡大)としても使う。
 *
 * 重要 (satori の画像フェッチに関する制約): 既存の index.ts / _tourInviteCard.ts と同じく、
 * リモート URL は avatar/img とも事前に fetch → base64 data URI 化してから要素ツリーに渡す
 * (レンダリング中の画像 fetch 失敗は ImageResponse 生成後の非同期ストリーム内で起きるため
 * try/catch で捕捉できない)。
 */

import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts } from './_fonts.js';
import { verifyHousingerOgCardSig } from '../../src/lib/ogpHousingerCard.js';
import type { HousingerCardPattern } from '../../src/lib/ogpHousingerCard.js';
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';

// ハウジングのトンマナ(正典 docs/.private/housing-tour-mockup/index.html 系統の色)。
// 枠線色 #ffeb99 はユーザー提供SVGの実測値(stroke="#ffeb99")。
const BG_COLOR = '#111725';
const ACCENT_HONEY = '#ffeb99';
const TEXT_MUTED = 'rgba(255,255,255,0.6)';
const GLOW_TEXT_SHADOW = '0 0 20px rgba(255,220,140,0.9), 0 0 40px rgba(255,180,80,0.6)';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const BORDER_MARGIN = 16;
/** カード1枚あたり常に埋める写真スロット数(採用2案とも共通)。 */
const GRID_PHOTO_SLOTS = 10;
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};
/** 画像1枚あたりの取得タイムアウト(外部SNS画像等が遅い/無応答でもカード生成全体を巻き込まない)。 */
const IMAGE_FETCH_TIMEOUT_MS = 4000;
/** 異常に大きい画像レスポンスを弾く上限(OGP用途でここまでのサイズは不要)。 */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** grid パターン中央の隙間(アバター+テキスト置き場)だけを暗くする濃さ。カード全体を覆う
 * 暗幕は廃止し、文字が乗る隙間だけをこの値で暗くする(元SVGモックアップの技法、2026-08-04)。 */
const GRID_CENTER_SCRIM_OPACITY = 0.55;

/**
 * `type=housinger` カード用の要素ツリーを組み立てる。
 * imageSrcs は0〜任意枚数のいずれでも破綻しない(0枚なら写真無しフォールバック、
 * 1枚以上なら {@link GRID_PHOTO_SLOTS} 枚に巡回コピーして埋める)。
 */
export function buildHousingerCard(params: {
  pattern: HousingerCardPattern;
  name: string;
  bio: string | null;
  avatarSrc: string | null;
  imageSrcs: string[];
}) {
  const { pattern, name, bio, avatarSrc, imageSrcs } = params;
  const displayName = name || 'ハウジンガー';

  if (imageSrcs.length === 0) {
    return buildNoPhotoCard(displayName, bio, avatarSrc);
  }

  const photos = cycleToLength(imageSrcs, GRID_PHOTO_SLOTS);
  const heroSrc = photos[0];

  return pattern === 'sidebar'
    ? buildSidebarPattern(displayName, avatarSrc, heroSrc, photos)
    : buildGridPattern(displayName, bio, avatarSrc, heroSrc, photos);
}

/** 先頭から巡回コピーして目標件数に埋める(3枚しかなければ 0,1,2,0,1,2,... で10枚)。0枚は空のまま。 */
function cycleToLength(arr: string[], len: number): string[] {
  if (arr.length === 0) return [];
  return Array.from({ length: len }, (_, i) => arr[i % arr.length]);
}

/** position:absolute の全面フィット指定。satoriは `inset: 0` 省略記法を描画できず
 * (2026-07-31実機+ローカルsatori直呼び出しで再現・特定: 完全に空描画になる)、
 * 4辺を個別指定すれば正しく描画されるため、絶対配置の全面レイヤーは必ずこちらを使う。 */
const FULL_BLEED_ABSOLUTE = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

/** 背景兼ヒーロー画像を拡大+ぼかしてカード全面に敷く。画像が無ければツアー招待カードと共通の固定背景。 */
function buildBackdropLayer(heroSrc: string | null) {
  return {
    type: 'div',
    props: {
      style: {
        ...FULL_BLEED_ABSOLUTE, display: 'flex',
        backgroundImage: `url(${heroSrc ?? TOUR_INVITE_BG_DATA_URI})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        ...(heroSrc ? { filter: 'blur(18px)', transform: 'scale(1.1)' } : {}),
      },
    },
  };
}

/** 可読性のための暗幕。 */
function buildScrimLayer(opacity: number) {
  return { type: 'div', props: { style: { ...FULL_BLEED_ABSOLUTE, display: 'flex', backgroundColor: `rgba(10,14,24,${opacity})` } } };
}

/** 金枠(honey border frame)。ユーザー提供SVGの実測値(stroke="#ffeb99" width8→px換算約10、余白約16px)。 */
function buildFrameLayer() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', top: BORDER_MARGIN, right: BORDER_MARGIN, bottom: BORDER_MARGIN, left: BORDER_MARGIN,
        borderRadius: 14, border: `2px solid ${ACCENT_HONEY}`,
        boxShadow: '0 0 20px rgba(255,235,153,0.3)', display: 'flex',
      },
    },
  };
}

function buildAvatarNode(avatarSrc: string | null, displayName: string, size: number) {
  if (avatarSrc) {
    return {
      type: 'div',
      props: {
        style: { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', display: 'flex', border: `3px solid ${ACCENT_HONEY}`, flex: '0 0 auto' },
        children: { type: 'img', props: { src: avatarSrc, width: size, height: size, style: { objectFit: 'cover', width: size, height: size } } },
      },
    };
  }
  return {
    type: 'div',
    props: {
      style: {
        width: size, height: size, borderRadius: size / 2, display: 'flex', flex: '0 0 auto',
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,235,153,0.14)', border: `3px solid ${ACCENT_HONEY}`,
      },
      children: { type: 'div', props: { style: { fontSize: size * 0.42, fontWeight: 900, color: ACCENT_HONEY }, children: displayName.slice(0, 1) } },
    },
  };
}

/** 名前+"Shared via"+"LoPo" の発光3行ブロック。名前が長い場合は自動縮小する。 */
function buildBrandTextBlock(displayName: string, baseFontSize: number, align: 'flex-start' | 'center') {
  const nameLen = displayName.length;
  const fontSize = nameLen > 20 ? baseFontSize * 0.7 : nameLen > 12 ? baseFontSize * 0.85 : baseFontSize;
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', alignItems: align, gap: 2, minWidth: 0 },
      children: [
        { type: 'div', props: { style: { fontSize, fontWeight: 900, color: '#fff6e6', textShadow: GLOW_TEXT_SHADOW, lineHeight: 1.15, display: 'flex' }, children: displayName } },
        { type: 'div', props: { style: { fontSize: fontSize * 0.5, fontWeight: 700, color: ACCENT_HONEY, textShadow: GLOW_TEXT_SHADOW, lineHeight: 1.25, display: 'flex' }, children: 'Shared via' } },
        { type: 'div', props: { style: { fontSize: fontSize * 0.5, fontWeight: 700, color: ACCENT_HONEY, textShadow: GLOW_TEXT_SHADOW, lineHeight: 1.25, display: 'flex' }, children: 'LoPo' } },
      ],
    },
  };
}

function buildPhotoTile(top: number, left: number, width: number, height: number, src: string, radius = 6) {
  return {
    type: 'div',
    props: {
      style: { position: 'absolute', top, left, width, height, borderRadius: radius, overflow: 'hidden', display: 'flex' },
      children: { type: 'img', props: { src, width, height, style: { objectFit: 'cover', width, height } } },
    },
  };
}

function buildBioLine(bio: string | null) {
  if (!bio) return null;
  return { type: 'div', props: { style: { fontSize: 18, color: TEXT_MUTED, lineHeight: 1.4, display: 'flex', maxWidth: 380 }, children: bio } };
}

// =========================================================================
// パターン grid: 上下2段(各4枚)+中央左右2枚の大判写真、中央の隙間にアバター+横書きテキスト。
// 座標は 3.svg の clipPath 実測値(960x540 viewBox → 1200x630へ scaleX1.25/scaleY1.1667)。
// =========================================================================
function buildGridPattern(displayName: string, _bio: string | null, avatarSrc: string | null, heroSrc: string, photos: string[]) {
  const [top1, top2, top3, top4, midL, midR, bot1, bot2, bot3, bot4] = photos;
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif' },
      children: [
        buildBackdropLayer(heroSrc),
        buildFrameLayer(),
        buildPhotoTile(31, 33, 267, 141, top1),
        buildPhotoTile(31, 322, 268, 141, top2),
        buildPhotoTile(31, 611, 267, 141, top3),
        buildPhotoTile(31, 900, 267, 141, top4),
        buildPhotoTile(199, 33, 342, 183, midL),
        buildPhotoTile(199, 819, 349, 183, midR),
        buildPhotoTile(427, 33, 267, 160, bot1),
        buildPhotoTile(427, 322, 268, 160, bot2),
        buildPhotoTile(427, 611, 268, 160, bot3),
        buildPhotoTile(427, 900, 268, 160, bot4),
        // 中央: midL(x33-375)とmidR(x819-1168)の間の隙間にアバター+テキスト(写真には重ねない)。
        // ユーザー実機指摘(2026-08-04): カード全体を覆う暗幕ではなく、この隙間だけ背景を
        // 暗くして文字を読ませる(元SVGモックアップの技法)。全面スクリムは廃止しこの隙間限定にした。
        { type: 'div', props: { style: { position: 'absolute', top: 199, left: 375, width: 444, height: 183, display: 'flex', backgroundColor: `rgba(10,14,24,${GRID_CENTER_SCRIM_OPACITY})` } } },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: 199, left: 375, width: 444, height: 183,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: 20 },
                  children: [buildAvatarNode(avatarSrc, displayName, 76), buildBrandTextBlock(displayName, 32, 'flex-start')],
                },
              },
            ],
          },
        },
      ],
    },
  };
}

// =========================================================================
// パターン sidebar: 左端に縦書きブランド文字+アバター、右側に写真10枚
// (上下2枚組×2列+中央大判+下段5枚)。座標は NoraSieHousing.svg の clipPath 実測値。
// =========================================================================
function buildSidebarPattern(displayName: string, avatarSrc: string | null, heroSrc: string, photos: string[]) {
  const [topLeft, belowTopLeft, topRight, belowTopRight, centerBig, b1, b2, b3, b4, b5] = photos;
  const nameLen = displayName.length;
  const nameFontSize = nameLen > 20 ? 24 : nameLen > 12 ? 28 : 32;

  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif' },
      children: [
        buildBackdropLayer(heroSrc),
        buildFrameLayer(),
        // 左: 縦書きテキスト+アバター(2026-08-04ユーザー実機指摘・モックアップ実測: 見た目の
        // 上から [名前, Shared via, LoPo, アバター] の順)。アバターは円形なので回転させても
        // 見た目は変わらない(satoriは回転した祖先の中のimgを正しく描けない実測バグがあるため、
        // アバターだけは回転させず、視覚的に正しい位置へ直接絶対配置する)。
        // テキスト行: transformOrigin:'left top' でピボット点(top,left)を固定し、
        // rotate(-90deg)でピボットから上方向へ伸びる(satoriのtransform-origin実測挙動)。
        // 回転前の行は左から [LoPo, Shared via, 名前] の順に並べ、回転後に上から
        // [名前, Shared via, LoPo] の順で見えるようにする。
        {
          type: 'div',
          props: {
            style: {
              // 実測値はラッパー撤去分(BORDER_MARGIN=16×2)を足し戻し、かつ名前が上端に
              // つかえないよう pivot を下げてある(nameFontSizeが大きい長い名前でも収まる余白)。
              position: 'absolute', top: 500, left: 68 + BORDER_MARGIN,
              transform: 'rotate(-90deg)', transformOrigin: 'left top',
              display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap',
            },
            children: [
              { type: 'div', props: { style: { fontSize: 17, fontWeight: 700, color: ACCENT_HONEY, textShadow: GLOW_TEXT_SHADOW, display: 'flex' }, children: 'LoPo' } },
              { type: 'div', props: { style: { fontSize: 17, fontWeight: 700, color: ACCENT_HONEY, textShadow: GLOW_TEXT_SHADOW, display: 'flex' }, children: 'Shared via' } },
              { type: 'div', props: { style: { fontSize: nameFontSize, fontWeight: 900, color: '#fff6e6', textShadow: GLOW_TEXT_SHADOW, display: 'flex' }, children: displayName } },
            ],
          },
        },
        { type: 'div', props: { style: { position: 'absolute', top: 516, left: 60, display: 'flex' }, children: buildAvatarNode(avatarSrc, displayName, 84) } },
        // 右: 写真コラージュ(絶対配置・実測座標)
        buildPhotoTile(36, 331, 219, 204, topLeft),
        buildPhotoTile(248, 331, 219, 205, belowTopLeft),
        buildPhotoTile(36, 940, 219, 204, topRight),
        buildPhotoTile(252, 940, 219, 203, belowTopRight),
        buildPhotoTile(78, 571, 347, 324, centerBig),
        buildPhotoTile(465, 331, 145, 135, b1),
        buildPhotoTile(465, 503, 145, 135, b2),
        buildPhotoTile(465, 673, 145, 135, b3),
        buildPhotoTile(465, 844, 145, 135, b4),
        buildPhotoTile(465, 1014, 145, 135, b5),
      ],
    },
  };
}

/** 写真が1枚も無い場合のフォールバック: 固定背景+アバター+ブランド文字を中央配置。 */
function buildNoPhotoCard(displayName: string, bio: string | null, avatarSrc: string | null) {
  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif' },
      children: [
        buildBackdropLayer(null),
        buildScrimLayer(0.42),
        buildFrameLayer(),
        {
          type: 'div',
          props: {
            style: { ...FULL_BLEED_ABSOLUTE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 },
            children: [
              buildAvatarNode(avatarSrc, displayName, 96),
              buildBrandTextBlock(displayName, 44, 'center'),
              buildBioLine(bio),
            ].filter(Boolean),
          },
        },
      ],
    },
  };
}

/** 画像取得/satoriレンダリング失敗時の最小限フォールバック(名前のみ)。 */
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

/** ArrayBuffer → base64 文字列(edge runtime に `Buffer` は無いため `btoa` + チャンク処理で実装)。 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000; // 32KB刻み(String.fromCharCode の引数上限を避けるため一括展開しない)
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
 * 画像 URL を fetch して base64 data URI 化する。失敗(ネットワークエラー・非2xx・
 * satori 非対応形式 (WebP等)・タイムアウト・サイズ超過)時は null を返す
 * (呼び出し側は「画像無し」として扱う = アバターならプレースホルダ・一覧画像なら省く)。
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
 * 名前のみのシンプルカードにフォールバックする(500 を返さない)。
 */
export async function handleHousingerCardRequest(searchParams: URLSearchParams): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // 署名検証用の秘密鍵が未設定 = fail-closed(誰でも任意パラメータで生成できてしまうことを防ぐ)。
    return new Response('OGP card unavailable', { status: 400 });
  }

  const validSig = await verifyHousingerOgCardSig(searchParams, cronSecret);
  if (!validSig) {
    return new Response('Invalid signature', { status: 400 });
  }

  const pattern: HousingerCardPattern = searchParams.get('pattern') === 'sidebar' ? 'sidebar' : 'grid';
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

    const uniqueChars = [...new Set('Shared via LoPo' + name + (bio ?? ''))].join('');
    const fonts = await loadMPlus1Fonts(uniqueChars);

    const element = buildHousingerCard({ pattern, name, bio, avatarSrc, imageSrcs: resolvedImageSrcs });
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
