/**
 * FB第6弾follow-up改良3: X 投稿元 URL の正規化。
 *
 * SNS モードで投稿元 URL (`?s=20&t=xxx` 等の追跡クエリ付き) をそのまま X intent に渡すと
 * URL が長大になる。 X (x.com / twitter.com) の投稿 URL に限り search / hash を除去し、
 * origin + pathname のみへ正規化する。 他ホストや不正な URL 文字列は入力のまま返す
 * (安全側フォールバック — 挙動を変えない)。
 */

const CANONICALIZED_HOSTS: readonly string[] = [
  'x.com',
  'www.x.com',
  'twitter.com',
  'www.twitter.com',
  'mobile.twitter.com',
];

export function canonicalPostUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  if (!CANONICALIZED_HOSTS.includes(parsed.hostname.toLowerCase())) return raw;
  return `${parsed.origin}${parsed.pathname}`;
}
