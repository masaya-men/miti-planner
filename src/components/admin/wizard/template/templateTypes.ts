export interface ContentItem {
  id: string;
  name: { ja: string; en: string };
}

// JSONテンプレートの最低限の型
export interface ParsedTemplate {
  timelineEvents: unknown[];
  phases?: unknown[];
}
export interface StepTProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
}
