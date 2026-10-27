/**
 * src/data/staticTemplates.ts
 *
 * 同梱の静的テンプレート(Vite glob import)の読み込み。useMasterData の fetchTemplate が
 * 最後のフォールバックとして動的 import で読む(templateLoader と分けて循環 import を避ける)。
 */

import type { TemplateData } from './templateLoader';
import { ensureLabels, filterPhantomPhases } from './templateNormalize';

// 静的ファイル（Vite glob import）— フォールバック用に維持
const templateModules = import.meta.glob('./templates/*.json');

/**
 * 静的テンプレートのみを読み込む（useMasterDataのフォールバック用）。
 */
export async function getStaticTemplate(contentId: string): Promise<TemplateData | null> {
  const modulePath = `./templates/${contentId}.json`;

  if (!(modulePath in templateModules)) {
    return null;
  }

  try {
    const module = await templateModules[modulePath]() as { default: TemplateData };
    return filterPhantomPhases(ensureLabels(module.default));
  } catch (error) {
    console.error(`Failed to load template for ${contentId}:`, error);
    return null;
  }
}
