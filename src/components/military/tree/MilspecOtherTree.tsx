import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../../../store/usePlanStore';
import { getContentById } from '../../../data/contentRegistry';
import { getPhaseName } from '../../../types';
import type { SavedPlan } from '../../../types';
import { MilspecContentGroup } from './MilspecContentGroup';
import { PlanRow } from './MilspecPlanRow';
import type { TreeProps } from './milspecTreeTypes';

// ── その他タブ: プランを contentId ごとにまとめる(登録の無いものは「フリープラン」) ─
export const OtherTree: React.FC<TreeProps> = ({ lang, currentContentId, onAdd, select }) => {
  const { t } = useTranslation();
  const plans = usePlanStore((s) => s.plans);
  const otherPlans = plans.filter((p) => {
    if (p.archived) return false;
    const cat = p.contentId ? getContentById(p.contentId)?.category : (p.category ?? 'custom');
    return cat !== 'savage' && cat !== 'ultimate';
  });
  const byContent = new Map<string, SavedPlan[]>();
  for (const p of otherPlans) {
    const key = (p.contentId && getContentById(p.contentId)) ? p.contentId : '__free__';
    if (!byContent.has(key)) byContent.set(key, []);
    byContent.get(key)!.push(p);
  }
  if (byContent.size === 0) {
    return <div className="milspec-tree-empty">{t('sidebar.no_content')}</div>;
  }
  return (
    <>
      {[...byContent.entries()].map(([key, list], i) => {
        if (key === '__free__') {
          return (
            <div className="milspec-tr-grp" key={key}>
              <div className="milspec-tr-it is-static">
                <span className="milspec-tr-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="milspec-tr-nm">{t('sidebar.custom_plans')}</span>
              </div>
              <div className="milspec-tr-plans">
                {list.map((p) => (<PlanRow key={p.id} plan={p} select={select} />))}
              </div>
            </div>
          );
        }
        const c = getContentById(key)!;
        return (
          <MilspecContentGroup
            key={key}
            content={c}
            index={i}
            displayName={getPhaseName(c.name, lang)}
            currentContentId={currentContentId}
            onAdd={onAdd}
            select={select}
          />
        );
      })}
    </>
  );
};
