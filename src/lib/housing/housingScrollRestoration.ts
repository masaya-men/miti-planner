/**
 * ハウジング画面では、ブラウザによる「再読み込み時のスクロール位置の復元」を止める。
 *
 * 2026-10-22 iPhone Safari: /housing のトップで画面全体が上にずれ、再読み込みしても直らない
 * (お気に入り等の別ページで再読み込みすると直る)。ハウジングは body スクロールをロックした
 * アプリ型の画面で、文書自体のスクロール位置に意味は無い。ずれた位置が復元され続けるのを断つ。
 * useIOSViewportFix のマウント時補正 (scrollTo(0,0)) は、Safari が読み込み完了後に位置を
 * 復元するため、その後で上書きされていた可能性がある。
 */
export function isHousingPath(pathname: string): boolean {
  return pathname === '/housing' || pathname.startsWith('/housing/') || pathname.startsWith('/h/');
}

export function installHousingScrollRestoration(pathname: string, history: History = window.history): void {
  if (!isHousingPath(pathname)) return;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
}
