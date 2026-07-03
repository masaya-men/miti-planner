/**
 * 自動リロードを許可するパス接頭辞。
 *
 * ★安全上の最重要ポリシー (2026-07-03 ユーザー厳命):
 * 軽減表 (/ や /miti /collab 等) では **絶対に自動リロードしない**。作業中の
 * 軽減表データへ 100% 影響を与えないため、自動リロードはハウジング配下に限定する。
 * ハウジングは登録フォームがオートセーブ済み + データ破棄可能なので安全。
 * 軽減表は従来どおり (新版は手動リロード or 既存の vite:preloadError 回復) を維持し、
 * 本機能によって挙動が一切変わらない。
 */
const AUTO_RELOAD_PATH_PREFIXES = ['/housing'];

function isAutoReloadAllowedPath(pathname: string): boolean {
  return AUTO_RELOAD_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

/**
 * サービスワーカーの更新を「確実に・自動で」画面へ反映させる (ハウジング配下のみ)。
 *
 * 背景 (2026-07-03 に顕在化した事象):
 * vite-plugin-pwa は skipWaiting + clientsClaim 済みで、新しい sw.js が来ると
 * 新 SW が即座に制御を奪う。しかし *表示中のページ* は既に読み込んだ古い JS/CSS の
 * ままなので、「新 SW が古いアセットを配る」不整合が起き、ログイン等の通常遷移で
 * 古い版に戻って見える。registerSW.js は登録するだけで controllerchange→reload を
 * 持たないため、この不整合が解消されなかった。
 *
 * ここでは:
 * - controllerchange (新 SW が制御を奪った) を検知し、**ハウジング配下にいる時だけ**
 *   1 回 reload して最新コードを表示する。軽減表では reload しない (上記ポリシー)。
 * - 初回登録 (それまで controller が居ない) では reload しない (無限リロード防止)。
 * - タブ復帰時と定期タイマーで sw.js の更新を能動的に取りに行く (update() 自体は
 *   reload もデータ変更も伴わない安全な確認のみ)。
 */
export function installServiceWorkerAutoUpdate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // スクリプト実行時点で既に制御 SW が居たか。居た状態から別 SW へ差し替わった時だけ reload する。
  const hadControllerAtStart = !!navigator.serviceWorker.controller;
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtStart) return; // 初回クレーム (null → SW) は通常のロードなので無視
    if (reloading) return;
    // ★軽減表では絶対に自動リロードしない。ハウジング配下にいる時のみ許可。
    if (!isAutoReloadAllowedPath(window.location.pathname)) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.ready
    .then((reg) => {
      const check = () => {
        // ★軽減表ページにいる間は更新チェックすら走らせない = このコードが軽減表では
        //   完全に無活動。ハウジング配下にいる時だけ最新 sw.js を確認する。
        if (!isAutoReloadAllowedPath(window.location.pathname)) return;
        void reg.update().catch(() => {
          /* オフライン等の update 失敗は無視 (次回チェックで拾う) */
        });
      };
      // タブに戻ってきたら最新 sw.js を確認 (デプロイ直後の反映を早める)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
      // 長時間開きっぱなしのタブ向けの保険 (1 時間毎)
      window.setInterval(check, 60 * 60 * 1000);
    })
    .catch(() => {
      /* SW 未対応/未登録なら何もしない */
    });
}
