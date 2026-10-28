import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { usePlanStore } from '../../../store/usePlanStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useMitigationStore } from '../../../store/useMitigationStore';
import type { SavedPlan } from '../../../types';
import { loadPlanDataIntoStore } from '../../../lib/planLoad';
import { setLastOpened } from '../../../utils/lastOpenedStore';
import { showToast } from '../../toastBus';
import { MilspecLed } from '../MilspecDecor';
import { MsIcon } from '../milspecIcons';
import { energy } from '../fx/engine';
import type { MilspecTreeSelect } from './milspecTreeTypes';

// ── プラン行(選択 / 改名 / 複製 / 削除) — mockup .pi ────────────────
function usePlanRowActions() {
  const { t } = useTranslation();

  // 標準 Sidebar.tsx(:355-381)/ MilspecSidebar と同じデータ安全な切替手順。
  const selectPlan = React.useCallback(async (plan: SavedPlan) => {
    const store = usePlanStore.getState();
    if (store.currentPlanId === plan.id) return;
    const snap = useMitigationStore.getState().getSnapshot();
    if (store.currentPlanId) {
      store.updatePlan(store.currentPlanId, { data: snap });
      const cur = store.plans.find((p) => p.id === store.currentPlanId);
      if (cur?.archived || cur?.compressedData) store.archivePlan(store.currentPlanId);
    }
    try {
      const loaded = await loadPlanDataIntoStore(plan);
      if (loaded && plan.compressedData) store.updatePlan(plan.id, { data: loaded, compressedData: undefined });
    } catch {
      showToast(t('app.decompress_error') || 'データの読み込みに失敗しました。ページを更新してください。', 'error');
      return;
    }
    store.setCurrentPlanId(plan.id);
    setLastOpened(plan.id, Date.now());
  }, [t]);

  const duplicate = React.useCallback(async (planId: string) => {
    const np = await usePlanStore.getState().duplicatePlan(planId);
    if (!np) showToast(t('sidebar.duplicate_limit_reached'), 'error');
  }, [t]);

  const remove = React.useCallback((planId: string) => {
    const ps = usePlanStore.getState();
    const plan = ps.plans.find((p) => p.id === planId);
    const authUser = useAuthStore.getState().user;
    if (authUser) ps.deleteFromFirestore(planId, authUser.uid, plan?.contentId ?? null);
    else ps.deletePlan(planId);
  }, []);

  return { selectPlan, duplicate, remove };
}

export const PlanRow: React.FC<{ plan: SavedPlan; select?: MilspecTreeSelect }> = ({ plan, select }) => {
  const { t } = useTranslation();
  const currentPlanId = usePlanStore((s) => s.currentPlanId);
  const { selectPlan, duplicate, remove } = usePlanRowActions();
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(plan.title);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sel = currentPlanId === plan.id;
  const picked = !!select && select.selectedIds.includes(plan.id);

  React.useEffect(() => {
    if (!confirmDel) return;
    const tm = setTimeout(() => setConfirmDel(false), 3000);
    return () => clearTimeout(tm);
  }, [confirmDel]);

  const finish = () => {
    if (title.trim() && title.trim() !== plan.title) usePlanStore.getState().updatePlan(plan.id, { title: title.trim() });
    setEditing(false);
  };

  // 選択モードではプランを切り替えず、選択の入/切だけ。通常時は見本 js:1097-1100(光 + 切替)
  const activate = (row: HTMLElement) => {
    if (editing) return;
    if (select) { select.onToggle(plan.id); return; }
    energy(row);
    void selectPlan(plan);
  };

  return (
    <div
      role={select ? 'checkbox' : 'button'}
      aria-checked={select ? picked : undefined}
      tabIndex={0}
      className={clsx('milspec-tr-plan', (select ? picked : sel) && 'is-sel', select && 'is-pick')}
      onClick={(e) => activate(e.currentTarget)}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if ((e.key === 'Enter' || e.key === ' ') && !editing) { e.preventDefault(); activate(e.currentTarget); } }}
    >
      {select && <MilspecLed state={picked ? 'on' : 'off'} size={6} />}
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={finish}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') finish(); if (e.key === 'Escape') { setTitle(plan.title); setEditing(false); } }}
          className="milspec-tr-rename"
        />
      ) : (
        <span className="milspec-tr-pn">{plan.title}</span>
      )}
      {!select && (
        <span className="milspec-tr-ops">
          <button type="button" aria-label={t('sidebar.duplicate_plan')} title={t('sidebar.duplicate_plan')} onClick={(e) => { e.stopPropagation(); void duplicate(plan.id); }}>
            <MsIcon.dup />
          </button>
          <button type="button" aria-label={t('app.rename')} title={t('app.rename')} onClick={(e) => { e.stopPropagation(); setTitle(plan.title); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}>
            <MsIcon.rename />
          </button>
          <button
            type="button"
            className={clsx('is-del', confirmDel && 'is-armed')}
            aria-label={confirmDel ? t('sidebar.delete_single_confirm_click') : t('sidebar.delete_single')}
            title={confirmDel ? t('sidebar.delete_single_confirm_click') : t('sidebar.delete_single')}
            onClick={(e) => { e.stopPropagation(); if (confirmDel) { remove(plan.id); setConfirmDel(false); } else setConfirmDel(true); }}
          >
            <MsIcon.close />
          </button>
        </span>
      )}
    </div>
  );
};
