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

/**
 * DO からの共有シークレットを検証。空シークレットは常に拒否(誤設定の素通り防止)。
 * compare は本番ハンドラが node:crypto.timingSafeEqual ベースのタイミング安全比較を
 * 注入できるよう引数化(既定は素の等価比較。純粋関数として node 依存を持たない)。
 */
export function isCollabAuthorized(
  req: Request,
  secret: string,
  compare: (a: string, b: string) => boolean = (a, b) => a === b,
): boolean {
  if (!secret) return false;
  const provided = req.headers.get(COLLAB_SECRET_HEADER);
  if (provided === null) return false;
  return compare(provided, secret);
}

/** Firestore plans/{id} doc の必要フィールドだけを表す snapshot 型(load.ts / save.ts 共用)。 */
export interface PlanDocSnapshot {
  deleted?: boolean;
  version?: number;
  data?: { timelineMitigations?: MitigationRecord[] };
}

export type LoadResult = { deleted: true } | { mitigations: MitigationRecord[] };

/** Firestore プラン doc(または null=不存在)から seed 用 LoadResult を決める。 */
export function decideLoad(plan: PlanDocSnapshot | null): LoadResult {
  if (!plan || plan.deleted === true) return { deleted: true };
  return { mitigations: plan.data?.timelineMitigations ?? [] };
}

export type SaveDecision = { skip: 'deleted' | 'not-found' } | { ok: true; nextVersion: number };

/** 現在の Firestore プラン doc から保存可否を決める。墓標/不存在はスキップ(削除が勝つ)。 */
export function decideSave(plan: PlanDocSnapshot | null): SaveDecision {
  if (!plan) return { skip: 'not-found' };
  if (plan.deleted === true) return { skip: 'deleted' };
  return { ok: true, nextVersion: (plan.version ?? 0) + 1 };
}

// ───────────── ②-b-1: 全 PlanData seed ─────────────

/** 全 b-1 data.* を表す snapshot(decideLoadFull 用)。 */
export interface PlanDocSnapshotFull {
  deleted?: boolean;
  version?: number;
  data?: {
    timelineMitigations?: MitigationRecord[];
    timelineEvents?: unknown[];
    phases?: unknown[];
    labels?: unknown[];
    memos?: unknown[];
    currentLevel?: number;
    aaSettings?: unknown;
    schAetherflowPatterns?: unknown;
    partyMembers?: unknown[];
  };
}

export type LoadResultFull =
  | { deleted: true }
  | {
      mitigations: MitigationRecord[];
      timelineEvents: unknown[];
      phases: unknown[];
      labels: unknown[];
      memos: unknown[];
      currentLevel?: number;
      aaSettings?: unknown;
      schAetherflowPatterns?: unknown;
      partyMembers: unknown[];
    };

/** 全 b-1 要素の seed を決める。墓標/不存在は deleted(削除が勝つ)。配列欠落は []、スカラー欠落は undefined。 */
export function decideLoadFull(plan: PlanDocSnapshotFull | null): LoadResultFull {
  if (!plan || plan.deleted === true) return { deleted: true };
  const d = plan.data ?? {};
  return {
    mitigations: d.timelineMitigations ?? [],
    timelineEvents: d.timelineEvents ?? [],
    phases: d.phases ?? [],
    labels: d.labels ?? [],
    memos: d.memos ?? [],
    currentLevel: d.currentLevel,
    aaSettings: d.aaSettings,
    schAetherflowPatterns: d.schAetherflowPatterns,
    partyMembers: d.partyMembers ?? [],
  };
}
