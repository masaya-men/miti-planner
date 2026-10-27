/**
 * src/data/templateLoader.ts
 *
 * テンプレートデータの読み込み。
 * Firestore → localStorage → 静的ファイルの順で取得する。
 * 静的ファイル（Vite glob import）はフォールバック用に維持。
 */

import type { TimelineEvent, LocalizedString } from '../types';
import { fetchTemplate as fetchFromFirestore } from '../hooks/useMasterData';
import { ensureLabels, filterPhantomPhases } from './templateNormalize';

export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: LocalizedString; }[];
  labels?: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
  _warning?: string;
}

/**
 * テンプレートデータを取得する。
 * Firestore → localStorage → 静的ファイルの順でフォールバック。
 */
export async function getTemplate(contentId: string): Promise<TemplateData | null> {
  const tpl = await fetchFromFirestore(contentId);
  return tpl ? filterPhantomPhases(ensureLabels(tpl)) : null;
}
