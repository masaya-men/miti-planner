// コンテンツのテンプレート(攻撃の並び・フェーズ・ラベル)の型。
// 取得側(templateLoader / useMasterData / staticTemplates)と保存側(ストア・管理画面)の両方が使うため、
// 取得のファイルに置かず型の置き場に分けている(型だけの循環 import を避ける)。
import type { TimelineEvent, LocalizedString } from './index';

export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: LocalizedString; }[];
  labels?: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
  _warning?: string;
}
