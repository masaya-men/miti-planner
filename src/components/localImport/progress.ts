/** 1 件あたりに見せる sweep アニメーション秒数 (実 Firestore が早く返ってもこの時間以上はかける) */
export const PER_PLAN_MS = 1200;

/** 各プランの取り込み進捗状態 */
export type PlanProgressStatus = 'pending' | 'uploading' | 'success' | 'failed';
