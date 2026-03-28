// src/lib/apiClient.ts
import { getToken } from 'firebase/app-check';
import { appCheck } from './firebase';

/**
 * App Checkトークン付きfetchラッパー
 * 全てのVercel API呼び出しはこの関数を使う
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  if (appCheck) {
    try {
      const { token } = await getToken(appCheck, false);
      headers.set('X-Firebase-AppCheck', token);
    } catch (err) {
      console.warn('[AppCheck] トークン取得失敗:', err);
    }
  }

  return fetch(url, { ...options, headers });
}
