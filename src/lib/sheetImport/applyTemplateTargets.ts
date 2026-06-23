/**
 * スプシ取込結果に、取込先コンテンツのテンプレ由来の対象(target)を補完する。
 * テンプレが無い/取得失敗/未マッチは何もしない(取込自体は止めない)。
 */
import type { SheetImportResult } from './buildPlanFromSheets';
import { getTemplate } from '../../data/templateLoader';
import { applyTargetsFromTemplate } from './carryOverTargets';

export async function applyTemplateTargetsToResult(
  result: SheetImportResult,
  contentId: string | null,
): Promise<SheetImportResult> {
  if (!contentId) return result;
  let template;
  try {
    template = await getTemplate(contentId);
  } catch {
    return result; // 取得失敗は握る(取込は続行)
  }
  if (!template || !template.timelineEvents || template.timelineEvents.length === 0) return result;
  return {
    ...result,
    timelineEvents: applyTargetsFromTemplate(result.timelineEvents, template.timelineEvents),
  };
}
