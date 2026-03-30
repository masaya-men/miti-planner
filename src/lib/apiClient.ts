// src/lib/apiClient.ts
import { getToken } from 'firebase/app-check';
import { appCheck, auth } from './firebase';

/**
 * App Checkトークン + Firebase IDトークン付きfetchラッパー
 * 全てのVercel API呼び出しはこの関数を使う
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // App Checkトークン付与
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
