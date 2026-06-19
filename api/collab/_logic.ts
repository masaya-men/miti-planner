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

// ───────────── 空上書きガード(defense in depth) ─────────────

/**
 * 空上書きガードの対象 data.* フィールド(構造データ＝空での置換は事実上 desync しか起きない)。
 * labels / memos は「空が正常」なケースが多いため除外する(誤ブロック回避)。
 */
export const GUARDED_ARRAY_FIELDS = [
  'timelineMitigations',
  'timelineEvents',
  'phases',
  'partyMembers',
] as const;

export interface GuardArrays {
  timelineMitigations?: unknown[];
  timelineEvents?: unknown[];
  phases?: unknown[];
  partyMembers?: unknown[];
}

/**
 * collab の desync で「空配列」が伝播し、Firestore の非空データを破壊する事故を防ぐ。
 * 各構造フィールドについて「incoming が空配列 かつ existing が非空配列」なら、そのフィールドは書かない。
 * 返り値 = 書き込みをスキップすべき data.* フィールド名の集合。
 *
 * 重要: スキップしても save レスポンスは ok を返すこと(DO へ 'skipped' を返すと墓標扱いで
 * バイナリ破棄＝部屋が壊れるため。`postPlanData` は応答に skipped フィールドがあると skipped と解釈する)。
 * トレードオフ: collab 中の「全消し(意図的な空化)」は Firestore に残らない(=次回 seed で復活)。
 * 全消しは稀かつ「データ破壊 > 全消し未反映」なので安全側に倒す。明示意図フラグは将来対応。
 */
export function emptyOverwriteSkips(incoming: GuardArrays, existing: GuardArrays): Set<string> {
  const skip = new Set<string>();
  for (const key of GUARDED_ARRAY_FIELDS) {
    const inc = incoming[key];
    const exi = existing[key];
    if (Array.isArray(inc) && inc.length === 0 && Array.isArray(exi) && exi.length > 0) {
      skip.add(key);
    }
  }
  return skip;
}

// ───────────── ②-b-1: 全 PlanData seed ─────────────

/** 全 b-1 data.* を表す snapshot(decideLoadFull 用)。 */
export interface PlanDocSnapshotFull {
  deleted?: boolean;
  version?: number;
  /** ⑤-3b: ボス/コンテンツ識別子。doc top-level(data.* ではない)。ジョイナーへ seed で配送。 */
  contentId?: string;
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
    progress?: { points?: unknown[]; cleared?: boolean; activeDays?: number; activeHours?: number };
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
      progressPoints: unknown[];
      progressCleared?: boolean;
      progressActiveDays?: number;
      progressActiveHours?: number;
      contentId?: string;
    };

/**
 * 旧形式(id 欠落)の進捗点に id を補完する。
 * worker の dedupeById は id===undefined の点を「先頭1件以外すべて削除」してしまうため、
 * seed に渡す前に id を付与して消滅を防ぐ。
 */
function ensureProgressPointId(p: unknown): unknown {
  if (p && typeof p === 'object' && typeof (p as { id?: unknown }).id === 'string' && (p as { id: string }).id) return p;
  return { ...(p as object), id: `pt_${crypto.randomUUID()}` };
}

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
    progressPoints: (d.progress?.points ?? []).map(ensureProgressPointId),
    progressCleared: d.progress?.cleared,
    progressActiveDays: d.progress?.activeDays,
    progressActiveHours: d.progress?.activeHours,
    contentId: plan.contentId,
  };
}
