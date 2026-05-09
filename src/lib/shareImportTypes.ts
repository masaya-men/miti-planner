import type { PlanData } from '../types';

export interface ShareImportItem {
  sourceShareId: string;
  contentId: string;
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
