import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import { usePlanStore } from '../../../store/usePlanStore';
import type { ContentDefinition } from '../../../types';
import { PLAN_LIMITS } from '../../../types/firebase';
import { MilspecLed } from '../MilspecDecor';
import { energy } from '../fx/engine';
import { useDrawer } from './useDrawer';
import { PlanRow } from './MilspecPlanRow';
import type { MilspecTreeSelect } from './milspecTreeTypes';

// ── コンテンツ 1 件 = 層の行(.it) + 引き出しに入ったプラン行 ──────────
export const MilspecContentGroup: React.FC<{
  content: ContentDefinition;
  index: number;
  displayName: string;
  currentContentId: string | null;
  onAdd: (id?: string | null) => void;
  select?: MilspecTreeSelect;
}> = ({ content, index, displayName, currentContentId, onAdd, select }) => {
  const { t } = useTranslation();
  const plans = usePlanStore(useShallow((s) => s.plans.filter((p) => p.contentId === content.id && !p.archived)));
  const isCurrent = currentContentId === content.id;
  const { open: expanded, setOpen, listRef, initialHidden, reduced } = useDrawer(plans.length > 0 && isCurrent);
  const [flickN, setFlickN] = React.useState(0);

  // プラン 0→1 で自動展開
  const prev = React.useRef(plans.length);
  React.useEffect(() => {
    if (prev.current === 0 && plans.length > 0) setOpen(true);
    prev.current = plans.length;
  }, [plans.length, setOpen]);
  React.useEffect(() => {
    if (isCurrent && plans.length > 0) setOpen(true);
  }, [isCurrent, plans.length, setOpen]);

  const atLimit = plans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT;

  // 見本 js:1102-1106: ランプのチラつき + 横の揺れ(460ms) + 光
  const onHeadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const row = e.currentTarget;
    setFlickN((n) => n + 1);
    if (!reduced && typeof row.animate === 'function') {
      row.animate([
        { transform: 'translateX(2px)' },
        { transform: 'translateX(5px)', offset: 0.3, easing: 'cubic-bezier(.3,0,.2,1)' },
        { transform: 'translateX(-1px)', offset: 0.62 },
        { transform: 'translateX(0.4px)', offset: 0.82 },
        { transform: 'none' },
      ], { duration: 460 });
    }
    energy(row);
    if (plans.length > 0) setOpen(!expanded);
    else if (!select) onAdd(content.id); // 選択モード中は新規作成を開かない
  };

  return (
    <div className="milspec-tr-grp">
      <button
        type="button"
        className={clsx('milspec-tr-it', isCurrent && 'is-sel')}
        aria-expanded={plans.length > 0 ? expanded : undefined}
        onClick={onHeadClick}
      >
        <span className="milspec-tr-n">{String(index + 1).padStart(2, '0')}</span>
        <span className="milspec-tr-nm">{displayName || content.id}</span>
        <MilspecLed key={flickN} state={isCurrent ? 'on' : 'off'} size={6} flick={flickN > 0} />
      </button>
      <div className="milspec-tr-plans" ref={listRef} hidden={initialHidden}>
        {plans.map((p) => (
          <PlanRow key={p.id} plan={p} select={select} />
        ))}
        {plans.length > 0 && !atLimit && (
          <button type="button" className="milspec-tr-add" onClick={() => onAdd(content.id)}>
            <i>＋</i> {t('sidebar.add_plan')}
          </button>
        )}
      </div>
    </div>
  );
};
