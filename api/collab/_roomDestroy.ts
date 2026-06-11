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
