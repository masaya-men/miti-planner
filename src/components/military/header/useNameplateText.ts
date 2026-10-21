import { useThemeStore } from '../../../store/useThemeStore';
import { usePlanStore } from '../../../store/usePlanStore';
import { getContentById } from '../../../data/contentRegistry';
import { getPhaseName } from '../../../types';

/** 銘板に出す文字。title = 今のコンテンツ名(表示言語に合わせた名前)・sub = 今のプラン名。
 *  コンテンツ名の取り方は旧 MilspecHeader(contentDef → getPhaseName)と同じ。 */
export function useNameplateText(): { title: string; sub: string } {
  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const plan = usePlanStore((s) => s.plans.find((p) => p.id === s.currentPlanId));
  const contentDef = plan?.contentId ? getContentById(plan.contentId) : null;
  return {
    title: contentDef ? getPhaseName(contentDef.name, contentLanguage) : '',
    sub: plan?.title ?? '',
  };
}
