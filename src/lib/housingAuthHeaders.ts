/**
 * /api/housing 系の共通リクエストヘッダビルダー
 *
 * - App Check トークン (X-Firebase-AppCheck) を必ず付与する
 *   → サーバーは ENFORCE_APP_CHECK=true のとき、 このヘッダが無いと 403 で弾く
 * - requireAuth=true で Firebase idToken を Authorization: Bearer に付与する
 *
 * 登録系 (housingApiClient) と Phase 3 系 (通報/編集/削除/通知) で共有し、
 * App Check 付与漏れによる 403 を防ぐ。
 */
import { auth, appCheck } from './firebase';
import { getToken } from 'firebase/app-check';

export async function buildHousingHeaders(requireAuth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // App Check トークン付与 (appCheck は null | AppCheck | Promise<AppCheck>)
  try {
    const ac = appCheck instanceof Promise ? await appCheck : appCheck;
    if (ac) {
      const { token } = await getToken(ac, false);
      headers['X-Firebase-AppCheck'] = token;
    }
  } catch {
    // App Check 取得失敗時はヘッダなしで送る (サーバー側で 403/401 を返す)
  }

  if (requireAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('not_authenticated');
    headers['Authorization'] = `Bearer ${await user.getIdToken()}`;
  }

  return headers;
}
