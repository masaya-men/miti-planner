// src/lib/apiClient.ts
import { getToken } from 'firebase/app-check';
import { getActiveAppCheck, auth } from './firebase';
import { isAdminSandbox } from '../dev/sandboxMode';

/**
 * App Checkトークン + Firebase IDトークン付きfetchラッパー
 * 全てのVercel API呼び出しはこの関数を使う
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // 管理画面サンドボックス: dev かつ admin-sandbox モードのときだけダミー応答にすり替える。
  // 先頭の import.meta.env.DEV は本番ビルドでこのブロック(動的importごと)を dead-code 除去するために必須。
  if (import.meta.env.DEV && isAdminSandbox()) {
    const { mockApiFetch } = await import('../dev/adminSandbox/mockApi');
    const mocked = await mockApiFetch(url, options);
    if (mocked) return mocked;
  }

  const headers = new Headers(options.headers);

  // App Checkトークン付与(2026-07-14 P2: peek。匿名の公開 read では初期化を発火させない。
  // ログイン試行/確定で初期化済みなら getActiveAppCheck() が返す = write にトークンが載る)
  const appCheck = getActiveAppCheck();
  if (appCheck) {
    try {
      const { token } = await getToken(appCheck, false);
      headers.set('X-Firebase-AppCheck', token);
    } catch (err) {
      console.warn('[AppCheck] トークン取得失敗:', err);
    }
  }

  // ログイン済みユーザーのIDトークン付与
  const user = auth.currentUser;
  if (user) {
    try {
      const idToken = await user.getIdToken();
      headers.set('Authorization', `Bearer ${idToken}`);
    } catch {
      // トークン取得失敗時は付与しない（未ログインとして扱われる）
    }
  }

  return fetch(url, { ...options, headers });
}
