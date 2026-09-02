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
import { loadMPlus1Fonts, loadInterFonts } from './_fonts.js';
import { verifyHousingerOgCardSig } from '../../src/lib/ogpHousingerCard.js';
import type { HousingerCardPattern } from '../../src/lib/ogpHousingerCard.js';
import { TOUR_INVITE_BG_DATA_URI } from './_tourInviteBg.generated.js';
import { fetchAsDataUri } from './_fetchOgImage.js';

// ハウジングのトンマナ(正典 docs/.private/housing-tour-mockup/index.html 系統の色)。
// 枠線色 #ffeb99 はユーザー提供SVGの実測値(stroke="#ffeb99")。
const BG_COLOR = '#111725';
const ACCENT_HONEY = '#ffeb99';
const TEXT_MUTED = 'rgba(255,255,255,0.6)';
/** ファンサイトポリシー対応の著作権表記。既存フッター (ja.json footer.copyright) と同一文言。 */
const COPYRIGHT_TEXT = '© SQUARE ENIX CO., LTD. All Rights Reserved.';
const GLOW_TEXT_SHADOW = '0 0 20px rgba(255,220,140,0.9), 0 0 40px rgba(255,180,80,0.6)';
/** ブランド文字(名前/Shared via/LoPo)専用の色・フォント(2026-08-04 Artifact確定値)。
 * ハウジング標準のInter・太さ800で統一(縮小はせず、名前が長い場合はmaxWidthで自然に折り返す)。 */
const BRAND_TEXT_COLOR = '#fff3c3';
const BRAND_FONT_FAMILY = '"Inter"';
const BRAND_FONT_WEIGHT = 800;

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const BORDER_MARGIN = 16;
/** カード1枚あたり常に埋める写真スロット数(採用2案とも共通)。 */
const GRID_PHOTO_SLOTS = 10;
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

/** grid パターン中央パッチ(2026-08-04 手本SVG実測): 黒塗りではなく、背景と同じ写真を
 * このbox位置に重ね、写真の不透明度+黒の重ねの2層で暗くする(Artifact確定値)。 */
const GRID_PATCH_TOP = 125;
const GRID_PATCH_LEFT = 248;
const GRID_PATCH_WIDTH = 706;
const GRID_PATCH_HEIGHT = 378;
const GRID_PATCH_PHOTO_OPACITY = 0.72;
const GRID_PATCH_TINT_OPACITY = 0.5;
/** grid パターン: アバター+ブランド文字ブロックの位置・サイズ(Artifact確定値)。 */
const GRID_TEXT_TOP = 213;
const GRID_TEXT_LEFT = 322;
const GRID_FONT_SIZE = 48;
const GRID_AVATAR_SIZE = 70;
const GRID_NAME_MAX_WIDTH = 500;

/** sidebar パターン: 縦書きブロックの位置・サイズ(Artifact確定値)。 */
const SIDEBAR_TEXT_TOP = 572;
const SIDEBAR_TEXT_LEFT = 79;
const SIDEBAR_FONT_SIZE = 43;
const SIDEBAR_ROW_GAP = 0;
const SIDEBAR_AVATAR_SIZE = 70;
/** row1(アバター+名前)内の間隔。2,3行目をこの分だけ右にmarginLeftして名前の頭に揃える。 */
const SIDEBAR_ROW1_GAP = 12;
const SIDEBAR_NAME_MAX_WIDTH = 500;
/** 縦書きテキストの背後の黒帯(手本SVG実測: 平塗りrgba(0,0,0,0.5)で正しい、写真重ねではない)。 */
const SIDEBAR_BAND_LEFT = 67;
const SIDEBAR_BAND_WIDTH = 222;

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
        ...(heroSrc ? { filter: 'blur(2px)', transform: 'scale(1.1)' } : {}),
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

/** grid/sidebarパターン専用のブランド文字1行(Inter/太さ800/#fff3c3で統一、縮小はせず
 * extraStyleのmaxWidthで自然に折り返す)。buildBrandTextBlock(旧2パターン用)とは別物。 */
function buildBrandLine(text: string, fontSize: number, extraStyle: Record<string, unknown> = {}) {
  return {
    type: 'div',
    props: {
      style: {
        fontSize, fontWeight: BRAND_FONT_WEIGHT, color: BRAND_TEXT_COLOR,
        fontFamily: BRAND_FONT_FAMILY, textShadow: GLOW_TEXT_SHADOW, display: 'flex',
        ...extraStyle,
      },
      children: text,
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

/** 著作権表記(全パターン共通・カード下端中央)。写真の上に乗っても読めるよう強めのシャドウで縁取る。 */
function buildCopyrightLine() {
  return {
    type: 'div',
    props: {
      style: {
        position: 'absolute', bottom: BORDER_MARGIN + 4, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
      },
      children: {
        type: 'div',
        props: {
          style: {
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.9)',
            fontFamily: BRAND_FONT_FAMILY, letterSpacing: 0.2,
            textShadow: '0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.85)',
            display: 'flex',
          },
          children: COPYRIGHT_TEXT,
        },
      },
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
        // 中央パッチ(2026-08-04 手本SVG実測): 黒塗りではなく、背景と同じ写真をこのbox位置に
        // 重ね、①写真自体の不透明度 ②黒の重ね の2層で暗くする(Artifact確定値そのまま)。
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: GRID_PATCH_TOP, left: GRID_PATCH_LEFT, width: GRID_PATCH_WIDTH, height: GRID_PATCH_HEIGHT,
              display: 'flex', backgroundImage: `url(${heroSrc})`, backgroundSize: 'cover', backgroundPosition: 'center',
              opacity: GRID_PATCH_PHOTO_OPACITY,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: GRID_PATCH_TOP, left: GRID_PATCH_LEFT, width: GRID_PATCH_WIDTH, height: GRID_PATCH_HEIGHT,
              display: 'flex', backgroundColor: '#000', opacity: GRID_PATCH_TINT_OPACITY,
            },
          },
        },
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: GRID_TEXT_TOP, left: GRID_TEXT_LEFT, display: 'flex', alignItems: 'flex-start', gap: 14 },
            children: [
              buildAvatarNode(avatarSrc, displayName, GRID_AVATAR_SIZE),
              {
                type: 'div',
                props: {
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
                  children: [
                    buildBrandLine(displayName, GRID_FONT_SIZE, { maxWidth: GRID_NAME_MAX_WIDTH, lineHeight: 1.15 }),
                    buildBrandLine('Shared via', GRID_FONT_SIZE, { lineHeight: 1.25 }),
                    buildBrandLine('LoPo', GRID_FONT_SIZE, { lineHeight: 1.25 }),
                  ],
                },
              },
            ],
          },
        },
        buildCopyrightLine(),
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

  return {
    type: 'div',
    props: {
      style: { width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif' },
      children: [
        buildBackdropLayer(heroSrc),
        // 縦書きテキストの背後の黒帯(2026-08-04 手本SVG実測: 平塗りrgba(0,0,0,0.5)で正しい。
        // grid側の中央パッチと違いこちらは写真重ねではない)。
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: 0, left: SIDEBAR_BAND_LEFT, width: SIDEBAR_BAND_WIDTH, height: CARD_HEIGHT, display: 'flex', backgroundColor: 'rgba(0,0,0,0.5)' },
          },
        },
        buildFrameLayer(),
        // 左: 縦書きテキスト(名前/Shared via/LoPoの3行、flex-columnをrotate(-90deg)で回転)。
        // アバターはこのブロックに含めない(satoriの実バグ: 回転した祖先の中に画像を2階層以上
        // ネストすると空描画になる。transformOrigin:'left top'指定時に特に顕著・2026-08-04実機確認)。
        // 名前は文字を縮小せず、SIDEBAR_NAME_MAX_WIDTHを超えたら自然に2行目へ折り返す
        // (Shared via/LoPoは1行のまま・アバター分の空きスペースだけ確保して頭を揃える)。
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute', top: SIDEBAR_TEXT_TOP, left: SIDEBAR_TEXT_LEFT,
              transform: 'rotate(-90deg)', transformOrigin: 'left top',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: SIDEBAR_ROW_GAP,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', gap: SIDEBAR_ROW1_GAP, minHeight: SIDEBAR_AVATAR_SIZE },
                  children: [
                    { type: 'div', props: { style: { width: SIDEBAR_AVATAR_SIZE, height: 1, display: 'flex' } } },
                    buildBrandLine(displayName, SIDEBAR_FONT_SIZE, { maxWidth: SIDEBAR_NAME_MAX_WIDTH }),
                  ],
                },
              },
              buildBrandLine('Shared via', SIDEBAR_FONT_SIZE, { marginLeft: SIDEBAR_AVATAR_SIZE + SIDEBAR_ROW1_GAP, lineHeight: 1.25 }),
              buildBrandLine('LoPo', SIDEBAR_FONT_SIZE, { marginLeft: SIDEBAR_AVATAR_SIZE + SIDEBAR_ROW1_GAP, lineHeight: 1.25 }),
            ],
          },
        },
        // アバター: テキストブロックとは別要素で独立回転(transformOrigin省略=中心基準)。
        // 正方形を自身の中心で回転しても見た目のbboxは変わらないため、テキストブロックの
        // row1(アバター分の空きスペース)と同じ位置になるよう算出したtop/leftをそのまま使う。
        {
          type: 'div',
          props: {
            style: { position: 'absolute', top: SIDEBAR_TEXT_TOP - SIDEBAR_AVATAR_SIZE, left: SIDEBAR_TEXT_LEFT, display: 'flex', transform: 'rotate(-90deg)' },
            children: buildAvatarNode(avatarSrc, displayName, SIDEBAR_AVATAR_SIZE),
          },
        },
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
        buildCopyrightLine(),
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
        buildCopyrightLine(),
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
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative',
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
        buildCopyrightLine(),
      ],
    },
  };
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
    const [mplus1Fonts, interFonts] = await Promise.all([
      loadMPlus1Fonts(uniqueChars),
      loadInterFonts(uniqueChars),
    ]);
    const fonts = [...mplus1Fonts, ...interFonts];

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
