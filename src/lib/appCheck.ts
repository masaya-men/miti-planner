// src/lib/appCheck.ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { app } from './firebase';

/**
 * Firebase App Check初期化
 * reCAPTCHA Enterpriseでアプリの正当性を検証
 * ローカル開発時はデバッグトークンを使用
 */
export function initAppCheck() {
  if (import.meta.env.DEV) {
    // @ts-expect-error — Firebase App Checkデバッグトークン用のグローバル変数
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }

  const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey) {
    console.warn('[AppCheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY が未設定。App Checkを無効化');
    return null;
  }

  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
