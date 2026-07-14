// src/lib/appCheck.ts
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

/**
 * Firebase App Check の「遅延(lazy)初期化」アクセサを生成する。
 *
 * 2026-07-14 (P2): 従来は firebase.ts の import 副作用で全ルート・全訪問者が
 * 無条件初期化していた(= 匿名の閲覧だけでも reCAPTCHA Enterprise アセスメントが
 * 1 回発火し、これが現請求の主犯だった)。
 * 本アクセサは「ログイン試行 / ログイン確定 / 書き込み直前」に ensureAppCheck() が
 * 呼ばれたときだけ initializeAppCheck を 1 回実行する。閲覧のみの匿名は初期化しない。
 *
 * - ensureAppCheck():   まだ初期化していなければ initializeAppCheck を 1 回だけ実行して返す。
 * - getActiveAppCheck(): 既に初期化済みなら返す。まだなら null(初期化しない = peek)。
 *   → 匿名の公開 read 経路(apiFetch)はこちらを使い、初期化を発火させない。
 *
 * 循環 import 回避のため firebaseApp は引数で受け取る(firebase.ts が app を渡す)。
 *
 * @param firebaseApp — 初期化対象の FirebaseApp
 */
export function createLazyAppCheck(firebaseApp: FirebaseApp): {
  ensureAppCheck: () => AppCheck | null;
  getActiveAppCheck: () => AppCheck | null;
} {
  let instance: AppCheck | null = null;
  let initialized = false; // 「初期化を試みたか」(成功/失敗/null 化を問わず二度目を呼ばない)

  const ensureAppCheck = (): AppCheck | null => {
    if (initialized) return instance;
    initialized = true; // 再入(二重 initializeAppCheck)を防ぐため先に立てる

    // テスト環境 (vitest) では初期化しない(happy-dom 上で reCAPTCHA スクリプトのロードと
    // exchangeDebugToken の POST が宙ぶらりんになり teardown を無限に待たせるため)。
    if (import.meta.env.MODE === 'test') {
      return (instance = null);
    }

    if (import.meta.env.DEV) {
      // @ts-expect-error — Firebase App Check デバッグトークン用のグローバル変数
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
    }

    const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;
    if (!siteKey) {
      console.warn('[AppCheck] VITE_RECAPTCHA_ENTERPRISE_SITE_KEY が未設定。App Checkを無効化');
      return (instance = null);
    }

    try {
      instance = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaEnterpriseProvider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      // 二重初期化等で throw しても null で縮退(getToken 側で 403/401 として扱う)
      console.warn('[AppCheck] 初期化に失敗:', err);
      instance = null;
    }
    return instance;
  };

  const getActiveAppCheck = (): AppCheck | null => instance;

  return { ensureAppCheck, getActiveAppCheck };
}
