// デプロイ直後の「古いタブ」問題への自動回復。
//
// このアプリは PWA(autoUpdate + skipWaiting + clientsClaim)で、新デプロイ時に
// 新しい Service Worker が即座に有効化し古いキャッシュを掃除する。一方 PipView 等は
// React.lazy で遅延読み込みされるため、古いタブのまま遅延画面を開くと「もう存在しない
// 古いハッシュのチャンク」を取りに行って 404 になり "Failed to fetch dynamically
// imported module" エラーで開けない（ハードリロードすると直る）。
//
// Vite が発火する `vite:preloadError` を拾い、ユーザー操作なしで 1 回だけページを
// リロードして新バージョンを取り直す。これで失敗したクリックが一瞬の更新を経て成功に変わる。

const RELOAD_FLAG = 'lopo_preload_reloaded';

/**
 * preloadError 発生時にページをリロードすべきか判定する。
 * 副作用: 初回のみ storage にフラグを立てる。
 * 1 セッションにつき最初の 1 回だけ true を返す（リロード後もチャンクが取れない
 * 壊れたデプロイ等で無限リロードに陥らないためのループ防止）。
 */
export function shouldReloadOnPreloadError(storage: Storage): boolean {
  if (storage.getItem(RELOAD_FLAG)) return false;
  storage.setItem(RELOAD_FLAG, '1');
  return true;
}

/**
 * アプリ起動時に 1 回呼ぶ。遅延チャンクの読込失敗を検知して自動リロードする。
 */
export function installPreloadErrorReload(): void {
  window.addEventListener('vite:preloadError', () => {
    if (shouldReloadOnPreloadError(window.sessionStorage)) {
      window.location.reload();
    }
  });
}
