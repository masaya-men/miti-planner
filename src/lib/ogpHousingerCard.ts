/**
 * ハウジンガーページ (/housing/housinger/:uid) 専用 OGP カード — URL 組み立て + 署名ヘルパー
 *
 * カード画像は `/api/og?type=housinger&...` (既存 Edge Function `/api/og` の拡張分岐、
 * api/og/_housingerCard.ts が担当) で生成する。新規 Serverless/Edge Function は増やさない。
 *
 * 署名方式:
 * - api/share/_housingerPageHandler.ts (Node) が `buildHousingerOgCardUrl()` で
 *   URL を組み立てる。パラメータ (name/avatar/img) を `sig` 抜きで安定順に並べ、
 *   HMAC-SHA256(secret=process.env.CRON_SECRET) を hex 24 桁に切って `sig` に載せる。
 * - api/og/index.ts (Edge) は `verifyHousingerOgCardSig()` で同じ手順を踏んで検証し、
 *   不一致なら 400 を返す（誰でも任意の name/avatar/img で画像生成させない = DoW対策）。
 *
 * Web Crypto (`crypto.subtle`) のみを使用（Node 18+/Edge 双方で `globalThis.crypto` 経由
 * で動作するため、Node 専用 API (`node:crypto`) を避けて Edge 互換を保つ。単体テストも
 * Node のテストランナー上でそのまま通る）。
 *
 * パラメータ順序（固定・sig を除く）: type → ver → pattern → name → bio → avatar? → img (0〜10個、順に複数指定)。
 * URLSearchParams は挿入順を保持して `toString()` するため、署名対象の文字列は
 * ビルド側・検証側の両方で同じ手順 (URLSearchParams 経由) を踏む限り一致する。
 */

const SIG_PARAM = 'sig';
/**
 * v4: ユーザー作成モックアップ2案(グリッド+オーバーレイ / 縦書きサイドバー)への全面刷新
 * (2026-08-03)に伴い更新。`pattern` パラメータを追加したため、旧v3キャッシュを一切踏まない
 * ようversionを必ず上げる。
 * v5: 見た目の微調整(手本SVG実測での中央パッチ修正・ブランド文字をInter/#fff3c3に統一・
 * 長い名前は縮小せず折り返し、2026-08-04)。パラメータ形状は不変だが生成済み画像を
 * 更新させるためversionのみ上げる。
 */
const CARD_VERSION = '5';
/** hex 24桁 = 96bit。DoW対策の署名としては十分な長さ（URLを短く保つため sha256 の先頭を切る）。 */
const SIG_HEX_LENGTH = 24;
/** カードに載せる公開ハウジング画像の最大枚数(代表作10件、先頭=背景兼ヒーロー)。 */
const MAX_CARD_IMAGES = 10;

/**
 * 採用デザイン2案の識別子。`grid`=上下グリッド+中央オーバーレイ、`sidebar`=縦書きテキスト帯。
 * どちらを配信するかは呼び出し側(api/share/_housingerPageHandler.ts)がランダムに選ぶが、
 * 両方とも事前に生成・キャッシュしておくため、パラメータとしては両方の値が使われる。
 */
export type HousingerCardPattern = 'grid' | 'sidebar';

export interface HousingerOgCardInput {
  /** 採用デザイン2案のどちらを描画するか。 */
  pattern: HousingerCardPattern;
  /** ハウジンガー表示名。空文字/未指定でも可(フォールバックは呼び出し側の表示ロジックに委ねる)。 */
  name: string;
  /** 紹介文(ひとこと)。未指定/nullは空文字として扱う。 */
  bio?: string | null;
  /** アバター画像 URL。無ければ省略。 */
  avatarUrl?: string | null;
  /** 代表作(公開ハウジング)の画像 URL 一覧。先頭が背景兼ヒーロー。最大 {@link MAX_CARD_IMAGES} 枚まで使用。 */
  imageUrls?: (string | null | undefined)[];
}

/**
 * クエリパラメータを安定順で組み立てる(`sig` は含まない)。
 * ビルド側・検証側の両方がこの関数(または同じ挿入順の手順)を通ることで
 * 署名対象の文字列表現を一致させる。
 */
export function buildHousingerOgCardParams(input: HousingerOgCardInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set('type', 'housinger');
  params.set('ver', CARD_VERSION);
  params.set('pattern', input.pattern);
  params.set('name', input.name || '');
  params.set('bio', input.bio || '');
  if (input.avatarUrl) params.set('avatar', input.avatarUrl);
  const imgs = (input.imageUrls || [])
    .filter((u): u is string => typeof u === 'string' && u.length > 0)
    .slice(0, MAX_CARD_IMAGES);
  for (const url of imgs) params.append('img', url);
  return params;
}

/** UTF-8 文字列 → hex 文字列（Web Crypto の ArrayBuffer 結果を可読な hex に変換）。 */
function bufferToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bufferToHex(sigBuf);
}

/** 定数時間比較（タイミング攻撃対策。長さが違う時点で即 false = 長さ情報のみ漏れるが hex 固定長なので実害なし）。 */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** `sig` を除いたパラメータから署名 (hex {@link SIG_HEX_LENGTH} 桁) を計算する。 */
export async function signHousingerOgCardParams(params: URLSearchParams, secret: string): Promise<string> {
  const base = params.toString();
  const fullHex = await hmacSha256Hex(secret, base);
  return fullHex.slice(0, SIG_HEX_LENGTH);
}

/**
 * `/api/og?type=housinger&...&sig=...` の絶対 URL を組み立てる（Node 側専用。呼び出しは
 * api/share/_housingerPageHandler.ts）。
 */
export async function buildHousingerOgCardUrl(
  origin: string,
  input: HousingerOgCardInput,
  secret: string,
): Promise<string> {
  const params = buildHousingerOgCardParams(input);
  const sig = await signHousingerOgCardParams(params, secret);
  params.set(SIG_PARAM, sig);
  return `${origin}/api/og?${params.toString()}`;
}

/**
 * Edge 側 (api/og/index.ts) で受け取った searchParams の `sig` を検証する。
 * `sig` が無い/不一致なら false。
 */
export async function verifyHousingerOgCardSig(searchParams: URLSearchParams, secret: string): Promise<boolean> {
  const sig = searchParams.get(SIG_PARAM);
  if (!sig) return false;
  const withoutSig = new URLSearchParams(searchParams);
  withoutSig.delete(SIG_PARAM);
  const expected = await signHousingerOgCardParams(withoutSig, secret);
  return timingSafeEqualHex(expected, sig);
}
