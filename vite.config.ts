import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// ハウジング StatusBar (画面下) に「実行中コードの版」を短 SHA で表示するための診断計器。
// 目的: 古い Service Worker / インストール済み PWA が旧バンドルを配信していないかを
// ユーザー端末で一目判別する (DevTools 不要)。Vercel は VERCEL_GIT_COMMIT_SHA を
// build 時 env に注入する (shallow checkout でも git 不要)。ローカルは git、取得不可時は 'dev'。
// この token (__HOUSING_BUILD__) を参照するのは StatusBar のみ = 軽減表本体には一切影響しない。
function resolveHousingBuild(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA
  if (vercelSha) return vercelSha.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}
const HOUSING_BUILD = resolveHousingBuild()

// https://vite.dev/config/
export default defineConfig({
  // build 時テキスト置換の定数注入 (dev/build/vitest すべてに適用)。
  define: {
    __HOUSING_BUILD__: JSON.stringify(HOUSING_BUILD),
  },
  // ローカル開発専用: Vercel Edge Function (api/*) は vite dev では実行されず
  // vite:esbuild が .ts を変換しようとして失敗する。 /api を本番へプロキシして
  // Twitter 動画 proxy (api/tweet-video) 等をローカルでも利用可能にする。
  // この server 設定は dev サーバ専用で、 vite build (本番) には一切含まれない。
  server: {
    proxy: {
      '/api': {
        target: 'https://lopoly.app',
        changeOrigin: true,
        // クライアントが api/ 配下の純ロジック (.ts) を import するケース
        // (例: OwnerCollabPanel → api/collab/_roomLogic の SYSTEM_MAX_PARTICIPANTS) は
        // dev では URL が /api/collab/_roomLogic.ts になり、この proxy が本番へ転送して
        // HTML を返す → MIME エラーで白画面になる。実 API 呼び出し (/api/collab/room 等・
        // 拡張子なし) のみ本番へ転送し、ソースモジュール (.ts/.tsx) は vite に解決させる。
        bypass: (req) => {
          const url = req.url || '';
          if (/\.(ts|tsx)(\?|$)/.test(url)) return url; // proxy せず vite に処理させる
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon-192x192.png', 'icons/pwa-192x192.png', 'icons/pwa-512x512.png'],
      manifest: {
        name: 'LoPo — FF14 軽減プランナー',
        short_name: 'LoPo',
        description: 'FF14の軽減プランをサクサク作れるウェブアプリ',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MiB
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // /api/ へのリクエストはService Workerを通さない
        navigateFallbackDenylist: [/^\/api\//],
        // 新バージョン検知時にすぐ反映（待たない）
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          },
          // OGP プレビュー画像は SW を経由せず直接 fetch する。
          // 過去デプロイの古い SW が /og/ リクエストを呑んで「生成中」のまま固まる
          // 事象が発生したため、明示的に NetworkOnly を指定して将来の SW でも安全にする。
          {
            urlPattern: /\/og\/[a-f0-9]{16}\.png$/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
})
