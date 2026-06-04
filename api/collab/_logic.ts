// 共同編集③: DO(受付係 client)↔Vercel(受付係 server)間の純粋ロジック。
// firebase-admin に依存しない(handler が wrap する)。テスト容易性のため分離。

export const COLLAB_SECRET_HEADER = 'x-collab-secret';

/** 1個の軽減配置(Firestore data.timelineMitigations の要素 = AppliedMitigation 相当)。 */
export interface MitigationRecord {
  id: string;
  mitigationId: string;
  time: number;
  duration: number;
  ownerId: string;
  targetId?: string;
  linkedMitigationId?: string;
  autoHidden?: boolean;
}

/** DO からの共有シークレットを検証。空シークレットは常に拒否(誤設定の素通り防止)。 */
export function isCollabAuthorized(req: Request, secret: string): boolean {
  if (!secret) return false;
  return req.headers.get(COLLAB_SECRET_HEADER) === secret;
}

export type LoadResult = { deleted: true } | { mitigations: MitigationRecord[] };

/** Firestore プラン doc(または null=不存在)から seed 用 LoadResult を決める。 */
export function decideLoad(plan: { deleted?: boolean; data?: { timelineMitigations?: MitigationRecord[] } } | null): LoadResult {
  if (!plan || plan.deleted === true) return { deleted: true };
  return { mitigations: plan.data?.timelineMitigations ?? [] };
}

export type SaveDecision = { skip: 'deleted' | 'not-found' } | { ok: true; nextVersion: number };

/** 現在の Firestore プラン doc から保存可否を決める。墓標/不存在はスキップ(削除が勝つ)。 */
export function decideSave(plan: { deleted?: boolean; version?: number } | null): SaveDecision {
  if (!plan) return { skip: 'not-found' };
  if (plan.deleted === true) return { skip: 'deleted' };
  return { ok: true, nextVersion: (plan.version ?? 0) + 1 };
}
