/**
 * /api/housing 系の共通リクエストヘッダビルダー
 *
 * - App Check トークン (X-Firebase-AppCheck) は、 認証必須 (requireAuth=true) または
 *   既にログイン済みの場合のみ初期化して付与する。 匿名の read 経路 (requireAuth=false かつ未ログイン)
 *   では初期化せず、 ヘッダも付与しない (該当エンドポイントはサーバー側で App Check を課さない設計)
 *   → サーバーは ENFORCE_APP_CHECK=true のとき、 必須経路でこのヘッダが無いと 403 で弾く
 * - requireAuth=true で Firebase idToken を Authorization: Bearer に付与する
 *
 * 登録系 (housingApiClient) と Phase 3 系 (通報/編集/削除/通知) で共有し、
 * App Check 付与漏れによる 403 を防ぐ。
 */
import { auth, ensureAppCheck, getActiveAppCheck } from './firebase';
import { getToken } from 'firebase/app-check';

export async function buildHousingHeaders(requireAuth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  // App Check トークン付与 (2026-07-14 P2: 遅延初期化)。
  // housing の書き込みは認証必須。requireAuth または既ログインなら初期化を保証 (ensure)、
  // 万一の匿名 read 経路 (requireAuth=false かつ未ログイン) では初期化しない (peek)。
  try {
    const ac = (requireAuth || auth.currentUser) ? ensureAppCheck() : getActiveAppCheck();
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
