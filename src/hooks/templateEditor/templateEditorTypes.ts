import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../types/template';

/** TemplateData.labels の要素型 */
export type TemplateLabel = NonNullable<TemplateData['labels']>[number];

/** FFLogs翻訳マッチ結果 */
export interface TranslationMatchResult {
  lang: 'en' | 'zh' | 'ko';
  /** eventId → 翻訳名 */
  translations: Map<string, string>;
  /** eventId → GUID（GUIDが未設定だったイベント用） */
  guids: Map<string, number>;
}

export interface EditState {
  original: TimelineEvent[];
  originalPhases: TemplateData['phases'];
  originalLabels: TemplateLabel[];
  current: TimelineEvent[];
  currentPhases: TemplateData['phases'];
  currentLabels: TemplateLabel[];
  modified: Set<string>;   // "eventId:fieldName"
  autoFilled: Set<string>; // "eventId:fieldName"
  deleted: Set<string>;    // eventId
}
