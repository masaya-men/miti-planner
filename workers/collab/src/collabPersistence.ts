// 共同編集③/⑤ 永続化の HTTP 層(受付係 Vercel API への入出力)。
// DO に依存しない純粋関数として切り出し、fetchMock で決定的にテストする。
// Room(server.ts)はこれを this.collabEnv / this.name(=roomToken) と #saveEnabled ガードで包む。
// ⑤-2a: 受付係は roomToken → planId を解決する。⑤-2b: seed と一緒に maxParticipants も受け取る。
import type { MitigationRecord } from "./yjsMitigations";
import type { PlanDataSeed } from "./yjsPlanData";

export type { MitigationRecord };

const SECRET_HEADER = "x-collab-secret";

/** load の seed 結果。maxParticipants は roomToken 経路のみ付与(レガシー planId 経路では undefined)。 */
export interface SeedResult {
  mitigations: MitigationRecord[];
  maxParticipants?: number;
}

/**
 * 受付係 load を叩き seed(軽減配置 + 最大人数)を取得する。
 * live → SeedResult、墓標(deleted)/不正/障害(非2xx・例外) → null(破壊保存ガードのため seed しない)。
 */
export async function fetchSeed(
  base: string,
  secret: string,
  roomToken: string,
): Promise<SeedResult | null> {
  try {
    const res = await fetch(
      `${base}/api/collab/load?roomToken=${encodeURIComponent(roomToken)}`,
      { headers: { [SECRET_HEADER]: secret } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { deleted?: boolean; mitigations?: MitigationRecord[]; maxParticipants?: number };
    if (body.deleted || !Array.isArray(body.mitigations)) return null;
    return { mitigations: body.mitigations, maxParticipants: body.maxParticipants };
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

// ───────────── ②-b-1: 全 PlanData 授受 ─────────────

/** save に送る全 PlanData(mitigations 必須・他は任意)。SeedResult と対。 */
export type PlanDataPayload = PlanDataSeed;

/** load の全要素 seed 結果(maxParticipants は roomToken 経路のみ)。 */
export interface SeedResultFull extends PlanDataSeed {
  maxParticipants?: number;
}

/** 受付係 load を叩き全 PlanData seed を取得。墓標/障害は null(破壊保存ガード)。 */
export async function fetchSeedFull(
  base: string, secret: string, roomToken: string,
): Promise<SeedResultFull | null> {
  try {
    const res = await fetch(
      `${base}/api/collab/load?roomToken=${encodeURIComponent(roomToken)}`,
      { headers: { [SECRET_HEADER]: secret } },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { deleted?: boolean; mitigations?: unknown[] } & SeedResultFull;
    if (body.deleted || !Array.isArray(body.mitigations)) return null;
    return body;
  } catch {
    return null;
  }
}

/** 受付係 save に全 PlanData を POST。'ok'/'skipped'(墓標)/'error'。 */
export async function postPlanData(
  base: string, secret: string, roomToken: string, payload: PlanDataPayload,
): Promise<"ok" | "skipped" | "error"> {
  try {
    const res = await fetch(`${base}/api/collab/save`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: secret },
      body: JSON.stringify({ roomToken, ...payload }),
    });
    if (!res.ok) return "error";
    const body = (await res.json()) as { skipped?: string };
    return body.skipped ? "skipped" : "ok";
  } catch {
    return "error";
  }
}
