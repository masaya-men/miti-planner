/**
 * src/data/templateLoader.ts
 *
 * テンプレートデータの読み込み。
 * Firestore → localStorage → 静的ファイルの順で取得する。
 * 静的ファイル（Vite glob import）はフォールバック用に維持。
 */

import type { TimelineEvent, LocalizedString } from '../types';
import { fetchTemplate as fetchFromFirestore } from '../hooks/useMasterData';

export interface TemplateData {
  contentId: string;
  generatedAt: string;
  sourceLogsCount: number;
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: string | LocalizedString; }[];
  _warning?: string;
}

// 静的ファイル（Vite glob import）— フォールバック用に維持
const templateModules = import.meta.glob('./templates/*.json');

/**
 * Checks synchronously if a static template is available for the given contentId.
 */
export function hasTemplate(contentId: string): boolean {
  return `./templates/${contentId}.json` in templateModules;
}

/**
 * 静的テンプレートのみを読み込む（useMasterDataのフォールバック用）。
 * 循環参照を避けるため、fetchTemplateからはこちらを呼ぶ。
 */
export async function getStaticTemplate(contentId: string): Promise<TemplateData | null> {
  const modulePath = `./templates/${contentId}.json`;

  if (!(modulePath in templateModules)) {
    return null;
  }

  try {
    const module = await templateModules[modulePath]() as { default: TemplateData };
    return module.default;
  } catch (error) {
    console.error(`Failed to load template for ${contentId}:`, error);
    return null;
  }
}

/**
 * テンプレートデータを取得する。
 * Firestore → localStorage → 静的ファイルの順でフォールバック。
 */
export async function getTemplate(contentId: string): Promise<TemplateData | null> {
  return fetchFromFirestore(contentId);
}
