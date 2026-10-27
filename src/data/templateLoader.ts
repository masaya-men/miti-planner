/**
 * src/data/templateLoader.ts
 *
 * テンプレートデータの読み込み。
 * Firestore → localStorage → 静的ファイルの順で取得する。
 * 静的ファイル（Vite glob import）はフォールバック用に維持。
 */

import type { TemplateData } from '../types/template';
import { fetchTemplate as fetchFromFirestore } from '../hooks/useMasterData';
import { ensureLabels, filterPhantomPhases } from './templateNormalize';

/**
 * テンプレートデータを取得する。
 * Firestore → localStorage → 静的ファイルの順でフォールバック。
 */
export async function getTemplate(contentId: string): Promise<TemplateData | null> {
  const tpl = await fetchFromFirestore(contentId);
  return tpl ? filterPhantomPhases(ensureLabels(tpl)) : null;
}
