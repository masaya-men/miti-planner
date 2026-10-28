/** 管理画面テンプレート — 一覧・昇格候補の型 */

export interface TemplateItem {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  lockedAt: string | null;
  updatedAt: string;
}

export interface ContentItem {
  id: string;
  nameJa?: string;
  name?: { ja?: string; en?: string };
}
