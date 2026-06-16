import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import './i18n'
import './styles/housing.css'
import { isAdminSandbox } from './dev/sandboxMode'

// 管理画面サンドボックス: 偽管理者を注入してから描画する。
// 先頭の import.meta.env.DEV は本番でこのブロック(動的importごと)を dead-code 除去するために必須。
if (import.meta.env.DEV && isAdminSandbox()) {
  void import('./dev/adminSandbox/bootstrap').then((m) => m.initAdminSandbox())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
