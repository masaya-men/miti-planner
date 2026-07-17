/**
 * ハウジンガーページ (/housing/housinger/:uid) 専用 OGP カードのレイアウト定義
 *
 * api/og/index.ts の `type=housinger` 分岐から呼ばれる（新規 Edge Function は作らない）。
 * satori の要素ツリーは実 JSX ではなく、既存 api/og/index.ts と同じくプレーンな
 * オブジェクトリテラル ({ type, props: { style, children } }) で組み立てる流儀に合わせる
 * (index.ts が createElement も .tsx も使っていないため、ここでも .ts のまま踏襲)。
 *
 * トンマナはハウジング独自 (.claude/rules/housing-design.md 系統): 濃紺背景 + ハニーゴールド
 * アクセント。既存 LoPo 本体 OGP (黒背景+白文字) とは別トーン。
 *
 * 重要 (satori の画像フェッチに関する制約): @vercel/og の `ImageResponse` は実際の
 * レンダリング (satori 呼び出し・画像 src の fetch を含む) を `Response` の
 * ReadableStream `start()` 内で遅延実行する。つまり `new ImageResponse(...)` を
 * try/catch で囲んでも、レンダリング中の画像 fetch 失敗はその try/catch では
 * 捕捉できない（Response 生成後の非同期ストリーム内で起きるため）。
 * 既存 index.ts が team ロゴ/favicon を常に base64 data URI で satori に渡している
 * (決して `img src` にリモート URL を直接渡さない) のはこの制約を回避するため。
 * このモジュールも同じ方針を踏襲し、リクエストハンドラ内で avatar/img を
 * 事前に fetch → base64 data URI 化してから要素ツリーに渡す。フェッチに失敗した
 * 画像は無いものとして構築するため、部分成功時も破綻しない。
 */

import { ImageResponse } from '@vercel/og';
import { loadMPlus1Fonts } from './_fonts.js';
import { verifyHousingerOgCardSig } from '../../src/lib/ogpHousingerCard.js';

// ハウジングのトンマナ（正典 docs/.private/housing-tour-mockup/index.html 系統の色）
const BG_COLOR = '#111725';
const ACCENT_HONEY = '#ffc987';
const TEXT_MUTED = 'rgba(255,255,255,0.55)';

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;
const CACHE_HEADERS = {
  // URL に content-derived な sig が入るため、内容が変われば URL 自体が変わる = 実質 immutable。
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};
/** 画像1枚あたりの取得タイムアウト（外部SNS画像等が遅い/無応答でもカード生成全体を巻き込まない）。 */
const IMAGE_FETCH_TIMEOUT_MS = 4000;
/** 異常に大きい画像レスポンスを弾く上限（OGP用途でここまでのサイズは不要）。 */
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * `type=housinger` カード用の要素ツリーを組み立てる。
 * imgs が 0〜3 枚のどのケースでも破綻しないレイアウト。
 */
export function buildHousingerCard(params: {
  name: string;
  avatarSrc: string | null;
  imageSrcs: string[];
}) {
  const { name, avatarSrc, imageSrcs } = params;
  const displayName = name || 'ハウジンガー';

  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        backgroundColor: BG_COLOR, fontFamily: '"M PLUS 1", sans-serif',
      },
      children: [
        buildHeaderRow(displayName, avatarSrc),
        buildImageArea(imageSrcs),
      ],
    },
  };
}

/** アバター＋名前＋「LoPo Housing」マークのヘッダー行。 */
function buildHeaderRow(displayName: string, avatarSrc: string | null) {
  const nameLen = displayName.length;
  const nameFontSize = nameLen > 20 ? 40 : nameLen > 12 ? 48 : 56;

  const avatarNode = avatarSrc
    ? { type: 'img', props: { src: avatarSrc, width: 120, height: 120, style: { borderRadius: 60, objectFit: 'cover' } } }
    // アバター無し: イニシャル風の丸プレースホルダ
    : {
      type: 'div',
      props: {
        style: {
          width: 120, height: 120, borderRadius: 60, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,201,135,0.14)', border: `2px solid ${ACCENT_HONEY}`,
        },
        children: {
          type: 'div',
          props: { style: { fontSize: 48, fontWeight: 900, color: ACCENT_HONEY }, children: displayName.slice(0, 1) },
        },
      },
    };

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '48px 64px', flexShrink: 0,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: 32 },
            children: [
              avatarNode,
              {
                type: 'div',
                props: {
                  style: { fontSize: nameFontSize, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5, lineHeight: 1.2 },
                  children: displayName,
                },
              },
            ],
          },
        },
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

/**
 * 残り面積の画像グリッド。0枚なら装飾テキストのみ、1〜3枚は等分カラムで cover 表示。
 */
function buildImageArea(imageSrcs: string[]) {
  if (imageSrcs.length === 0) {
    return {
      type: 'div',
      props: {
        style: {
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 64px 56px',
        },
        children: {
          type: 'div',
          props: {
            style: { fontSize: 22, color: TEXT_MUTED, letterSpacing: 4, textTransform: 'uppercase' },
            children: 'FF14 Housing Tour',
          },
        },
      },
    };
  }

  return {
    type: 'div',
    props: {
      style: {
        flex: 1, display: 'flex', flexDirection: 'row', gap: 16,
        padding: '0 64px 56px',
      },
      children: imageSrcs.map((src) => ({
        type: 'div',
        props: {
          style: {
            flex: 1, display: 'flex', position: 'relative', borderRadius: 16, overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.04)',
          },
          children: {
            type: 'img',
            props: {
              src, width: 1200, height: 630,
              style: { width: '100%', height: '100%', objectFit: 'cover' },
            },
          },
        },
      })),
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
  const avatarUrl = searchParams.get('avatar');
  const imageUrls = searchParams.getAll('img').slice(0, 3);

  try {
    const [avatarSrc, ...imageSrcs] = await Promise.all([
      avatarUrl ? fetchAsDataUri(avatarUrl) : Promise.resolve(null),
      ...imageUrls.map((u) => fetchAsDataUri(u)),
    ]);
    const resolvedImageSrcs = imageSrcs.filter((s): s is string => !!s);

    const uniqueChars = [...new Set('LoPo Housing FF14 Housing Tour' + name)].join('');
    const fonts = await loadMPlus1Fonts(uniqueChars);

    const element = buildHousingerCard({ name, avatarSrc, imageSrcs: resolvedImageSrcs });
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
