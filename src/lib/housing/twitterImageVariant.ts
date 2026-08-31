/**
 * X (Twitter) の画像 URL をサイズ指定付きに加工する純関数(保存はしない)。
 * `pbs.twimg.com/media/xxxxx.jpg` → `...jpg?name=small`(680px・実測約46KB)。
 * `/media/` 以外(amplify_video_thumb 等)や pbs.twimg.com 以外はそのまま返す。
 * カード / 詳細サムネで縮小版('small')を、詳細メインステージでは加工なし(原寸1200px)を使う。
 */
export type TwitterImageName = 'thumb' | 'small' | 'medium' | 'large' | 'orig';

export function twitterImageVariant(url: string, name: TwitterImageName): string {
  try {
    const u = new URL(url);
    if (u.hostname !== 'pbs.twimg.com' || !u.pathname.startsWith('/media/')) return url;
    u.searchParams.set('name', name);
    return u.toString();
  } catch {
    return url;
  }
}
