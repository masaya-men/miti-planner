import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../../../store/usePlanStore';
import { PlanRow } from './MilspecPlanRow';
import type { MilspecTreeSelect } from './milspecTreeTypes';

export const ArchiveList: React.FC<{ select?: MilspecTreeSelect }> = ({ select }) => {
  const { t } = useTranslation();
  const plans = usePlanStore((s) => s.plans);
  const archived = plans.filter((p) => p.archived);
  if (!archived.length) return <div className="milspec-tree-empty">{t('sidebar.archive_empty')}</div>;
  // アーカイブはシリーズ・層の見出しなしでプラン行を直接並べる
  return (
    <div className="milspec-tr-plans is-flat">
      {archived.map((p) => (<PlanRow key={p.id} plan={p} select={select} />))}
    </div>
  );
};
