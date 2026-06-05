// 共同編集③/⑤ 永続化の HTTP 層(受付係 Vercel API への入出力)。
// DO に依存しない純粋関数として切り出し、fetchMock で決定的にテストする。
// Room(server.ts)はこれを this.collabEnv / this.name(=roomToken) と #saveEnabled ガードで包む。
// ⑤-2a: 受付係は roomToken → planId を解決する(load/save は ⑤-1 で対応済)。
import type { MitigationRecord } from "./yjsMitigations";

export type { MitigationRecord };

const SECRET_HEADER = "x-collab-secret";

/**
 * 受付係 load を叩き seed 用 mitigations を取得する。
 * live → 配列、墓標(deleted)/不正/障害(非2xx・例外) → null(破壊保存ガードのため seed しない)。
 */
export async function fetchMitigations(
  base: string,
  secret: string,
  roomToken: string,
): Promise<MitigationRecord[] | null> {
  try {
    const res = await fetch(
      `${base}/api/collab/load?roomToken=${encodeURIComponent(roomToken)}`,
      { headers: { [SECRET_HEADER]: secret } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { deleted?: boolean; mitigations?: MitigationRecord[] };
    if (body.deleted || !Array.isArray(body.mitigations)) return null;
    return body.mitigations;
  } catch {
    return null;
  }
}

/**
 * 受付係 save に mitigations を POST する。
 * 'ok' = 保存された / 'skipped' = 墓標等で書かれなかった(削除が勝つ) / 'error' = 非2xx・例外。
 */
export async function postMitigations(
  base: string,
  secret: string,
  roomToken: string,
  mitigations: MitigationRecord[],
): Promise<"ok" | "skipped" | "error"> {
  try {
    const res = await fetch(`${base}/api/collab/save`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ roomToken, mitigations }),
    });
    if (!res.ok) return "error";
    const body = (await res.json()) as { skipped?: string };
    return body.skipped ? "skipped" : "ok";
  } catch {
    return "error";
  }
}
