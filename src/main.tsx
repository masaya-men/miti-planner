import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import './i18n'
import './styles/housing.css'
import { isAdminSandbox } from './dev/sandboxMode'
import { installPreloadErrorReload } from './lib/preloadErrorReload'
import { installServiceWorkerAutoUpdate } from './lib/serviceWorkerAutoUpdate'

// 管理画面サンドボックス: 偽管理者を注入してから描画する。
// 先頭の import.meta.env.DEV は本番でこのブロック(動的importごと)を dead-code 除去するために必須。
if (import.meta.env.DEV && isAdminSandbox()) {
  void import('./dev/adminSandbox/bootstrap').then((m) => m.initAdminSandbox())
}

// 本番: デプロイ直後の古いタブが遅延チャンク(古いハッシュ)を取りに行って 404 になる
// 問題を、vite:preloadError 検知 → 1回だけ自動リロードで回復する。
if (import.meta.env.PROD) {
  installPreloadErrorReload()
  // 新バージョンの SW が有効化されたら 1 回だけ自動リロードして最新コードを確実に表示する。
  installServiceWorkerAutoUpdate()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
