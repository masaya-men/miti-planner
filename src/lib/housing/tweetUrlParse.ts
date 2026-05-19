const TWEET_URL_REGEX = /^https?:\/\/(?:x|twitter)\.com\/[\w-]+\/status\/(\d{1,20})(?:[/?#]|$)/i;

export function parseTweetUrl(input: string): string | null {
  if (!input) return null;
  const m = input.trim().match(TWEET_URL_REGEX);
  return m ? m[1] : null;
}
