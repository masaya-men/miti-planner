import type { PlanData } from '../types';

// 共有 API (`/api/share?id=...`) のレスポンス型。
// 単一プラン (SharedSingle) と複数プランバンドル (SharedBundle) の union。
// SharePage / useShareImportFlow から共通参照される。
export interface SharedSingle {
  shareId: string;
  title: string;
  contentId: string | null;
  planData: PlanData;
  createdAt: number;
}

export interface SharedBundlePlan {
  contentId: string | null;
  title: string;
  planData: PlanData;
}

export interface SharedBundle {
  shareId: string;
  type: 'bundle';
  plans: SharedBundlePlan[];
  createdAt: number;
}

export type SharedData = SharedSingle | SharedBundle;

// SharedBundle 判定の型ガード
export function isSharedBundle(data: SharedData): data is SharedBundle {
  return 'type' in data && data.type === 'bundle';
}

export interface ShareImportItem {
  sourceShareId: string;
  contentId: string | null;
  title: string;
  planData: PlanData;
  sourcePlanId?: string; // バンドル内の元 plan id (ログ用)
}

export type ProgressStage = 'check' | 'local' | 'server';
export type ProgressStatus = 'in_progress' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface ProgressEvent {
  planId: string; // ShareImportItem 内で一意な識別子 (sourcePlanId or sourceShareId)
  stage: ProgressStage;
  status: ProgressStatus;
  error?: string;
}

export type DeleteProgressStage = 'local_delete' | 'server_delete' | 'capacity_freed';

export interface DeleteProgressEvent {
  planId: string;
  stage: DeleteProgressStage;
  status: ProgressStatus;
  error?: string;
}

export interface ImportResult {
  itemPlanId: string;
  newPlanId?: string;
  status: 'success' | 'failed' | 'cancelled';
  error?: string;
}

// 上限ヒット時に LimitResolutionSheet へ渡すコンテキスト。
// reason により表示モード (per content / 総上限) を分岐する。
export type LimitReason = 'max_per_content' | 'max_total';

export interface LimitContext {
  reason: LimitReason;
  /** max_total のときは null。 max_per_content のときは対象 contentId */
  contentId: string | null;
  /** 解消に必要な削除件数 (≧1) */
  neededCount: number;
  /** max_total のときは null。 max_per_content のときはヒットした取り込み対象の planId (= ShareImportItem.sourcePlanId ?? sourceShareId) */
  planId: string | null;
  resolve: (decision: 'resolved' | 'cancelled') => void;
}
