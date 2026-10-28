// 本番 collab Worker(段取り①でデプロイ済)。dev でもここに直接 WebSocket する(/api/* と同様)。
// ローカル完全スタック検証(⑤-3d)用に VITE_COLLAB_HOST で上書き可能。
// 本番は env 未設定 → ハードコード値にフォールバック(挙動無変更)。
export const COLLAB_HOST =
  (import.meta.env.VITE_COLLAB_HOST as string | undefined) || 'lopo-collab.masaya-maeno0106.workers.dev';

/**
 * #3d: 確実な人数を取得する。サーバの /count は getConnections() 由来(ハイバネを越えて保持=Cloudflare 公式)。
 * 入退室(awareness の add/removed)時 + 接続時にだけ呼ぶ(カーソル更新では呼ばない)→ アイドル中は
 * DO を起こさず $0 を維持。失敗は null(呼び出し側は roster.length にフォールバック)。
 */
export async function fetchRoomCount(roomToken: string): Promise<number | null> {
  try {
    const res = await fetch(`https://${COLLAB_HOST}/parties/room/${encodeURIComponent(roomToken)}/count`);
    if (!res.ok) return null;
    const data = (await res.json()) as { count?: number };
    return typeof data.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}

/**
 * ④-a: provider params。ログイン中なら現在の Firebase ID トークンを載せ、未ログインは空(viewer)。
 * 関数なので再接続のたびに最新トークンを取り直す(約1時間の期限を自然に解決)。
 * getToken を注入式にして純粋にテストする(firebase を静的 import せず、呼び出し側で動的に渡す)。
 */
export async function buildCollabParams(
  getToken: () => Promise<string | null>,
): Promise<Record<string, string>> {
  try {
    const token = await getToken();
    return token ? { token } : {};
  } catch {
    return {}; // 取得失敗 → viewer(編集権はサーバが拒否するだけ・閲覧は維持)
  }
}
