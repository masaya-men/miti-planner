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

/** ImageResponse が受ける要素型(satori 用の素のオブジェクトを渡すためのキャスト先) */
type ImageResponseElement = ConstructorParameters<typeof ImageResponse>[0];
import { loadMPlus1Fonts, loadInterFonts } from './_fonts.js';
import { verifyHousingerOgCardSig } from '../../src/lib/ogpHousingerCard.js';
import type { HousingerCardPattern } from '../../src/lib/ogpHousingerCard.js';
import { fetchAsDataUri } from './_fetchOgImage.js';
import { ACCENT_HONEY, BG_COLOR, CACHE_HEADERS, CARD_HEIGHT, CARD_WIDTH, GRID_PHOTO_SLOTS } from './_housingerCardTokens.js';
import { FULL_BLEED_ABSOLUTE, buildAvatarNode, buildBackdropLayer, buildBioLine, buildBrandTextBlock, buildCopyrightLine, buildFrameLayer, buildScrimLayer } from './_housingerCardParts.js';
import { buildGridPattern } from './_housingerCardGrid.js';
import { buildSidebarPattern } from './_housingerCardSidebar.js';


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
    return new ImageResponse(element as unknown as ImageResponseElement, {
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
      return new ImageResponse(element as unknown as ImageResponseElement, {
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
