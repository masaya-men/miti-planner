// ④-a: 接続者の編集権をサーバ側で確かめるためのグルー。
// (1) 受付係 verify を叩く純関数, (2) worker→DO 信頼ヘッダ定数, (3) 接続認可, (4) editor 判定。
// Firebase Admin は Workers 非対応のため検証は Vercel(verify)へ委譲(③ と同型)。

const SECRET_HEADER = "x-collab-secret";

/** worker→DO へ「この接続は編集者(uid)」を伝える信頼ヘッダ。クライアントは WS で付けられない。 */
export const EDITOR_UID_HEADER = "x-collab-uid";
/** クライアントが ID トークンを載せるクエリパラメータ名(provider params)。 */
export const TOKEN_PARAM = "token";

/**
 * 受付係 verify を叩き、正規ログイン本人なら uid を返す。
 * 不正/障害/到達不能/空トークン → null(呼び出し側は fail-closed で viewer 扱い)。
 */
export async function verifyToken(
  base: string,
  secret: string,
  token: string,
): Promise<string | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${base}/api/collab/verify`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { valid?: boolean; uid?: string };
    return body.valid && typeof body.uid === "string" ? body.uid : null;
  } catch {
    return null;
  }
}
