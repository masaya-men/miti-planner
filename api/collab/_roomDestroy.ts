// 失効/再発行で旧部屋(DO)のバイナリを破棄するよう worker に通知する（best-effort）。
// collabBase は worker のホスト（例: https://lopo-collab.xxx.workers.dev）。env から渡す。
export async function destroyRoomBinary(
  collabBase: string,
  secret: string,
  roomToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!collabBase || !secret || !roomToken) return;
  try {
    await fetchImpl(`${collabBase}/parties/room/${encodeURIComponent(roomToken)}/destroy`, {
      method: "POST",
      headers: { "x-collab-secret": secret },
    });
  } catch {
    // best-effort: 失敗しても失効自体は成立済み。GC cron が後で拾う。
  }
}

/**
 * 動いている DO の人数上限を即時更新する（best-effort）。
 * Firestore 更新(set-max action)の後に呼ぶ。部屋が再起動するまで待たず新しい上限を有効にする。
 * 失敗しても Firestore 側の変更は成立済みのため API レスポンスには影響させない。
 */
export async function liveUpdateRoomMax(
  collabBase: string,
  secret: string,
  roomToken: string,
  maxParticipants: number,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!collabBase || !secret || !roomToken) return;
  try {
    await fetchImpl(
      `${collabBase}/parties/room/${encodeURIComponent(roomToken)}/set-max?n=${encodeURIComponent(maxParticipants)}`,
      {
        method: "POST",
        headers: { "x-collab-secret": secret },
      },
    );
  } catch {
    // best-effort: 失敗しても次の DO 起動時に Firestore の値が反映される。
  }
}
