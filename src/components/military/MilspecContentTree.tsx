import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import {
  getContentById,
  getAllUltimates,
  getSavageForCurrentExpansion,
  getSeriesById,
  getProjectLabel,
} from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import type { ContentDefinition, SavedPlan } from '../../types';
import { PLAN_LIMITS } from '../../types/firebase';
import { loadPlanDataIntoStore } from '../../lib/planLoad';
import { setLastOpened } from '../../utils/lastOpenedStore';
import { showToast } from '../Toast';
import { NewPlanModal } from '../NewPlanModal';
import { useReducedMotion } from '../../lib/housing/useReducedMotion';
import { MilspecLed } from './MilspecDecor';
import { MsIcon } from './milspecIcons';
import { energy } from './fx/engine';
import '../../i18n';

export type MilspecTreeTab = 'savage' | 'ultimate' | 'other' | 'archive';
type Tab = MilspecTreeTab;

/** タブ一覧(ラベルは i18n)。MilspecSidebar 側のタブバーと共有。 */
export function useMilspecTreeTabs(): { id: Tab; label: string }[] {
  const { t } = useTranslation();
  return [
    { id: 'savage', label: t('sidebar.tab_savage') },
    { id: 'ultimate', label: t('sidebar.tab_ultimate') },
    { id: 'other', label: t('sidebar.tab_other') },
    { id: 'archive', label: t('sidebar.tab_archive') },
  ];
}

/** プランのコンテンツ種別からタブを決める(標準 Sidebar と同じ)。 */
export function tabForPlanCategory(cat: string | null | undefined): Tab {
  if (cat === 'ultimate') return 'ultimate';
  if (cat === 'savage') return 'savage';
  if (cat) return 'other';
  return 'savage';
}

/** ツリーの選択モード(まとめて共有 / 選択削除)。無いときは通常のツリー。 */
export interface MilspecTreeSelect {
  mode: 'share' | 'delete';
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/**
 * 引き出しの開閉(見本 milspec-v11.js の foldTo / js:1120-1134 をそのまま)。
 * 開く = 460ms で高さ 0 → +5px の行き過ぎ → 本来の高さ、子は 110ms + 45ms*i 遅れて左から滑り込む。
 * 閉じる = 340ms で +3px 膨らんでから 0 へ。reduced(または animate 非対応)なら hidden を切り替えるだけ。
 */
function foldDrawer(list: HTMLElement, open: boolean, reduced: boolean): void {
  if (reduced || typeof list.animate !== 'function') { list.hidden = !open; return; }
  if (open) {
    list.hidden = false;
    const h = list.scrollHeight;
    list.style.overflow = 'hidden';
    const a = list.animate([
      { height: '0px', easing: 'cubic-bezier(.7,0,.2,1)' },
      { height: h + 5 + 'px', offset: 0.78, easing: 'ease-in-out' },
      { height: h + 'px' },
    ], { duration: 460 });
    a.onfinish = () => { list.style.overflow = ''; };
    [...list.children].forEach((c, i) => c.animate([
      { transform: 'translateX(-10px)', opacity: 0 },
      { transform: 'translateX(1px)', opacity: 1, offset: 0.7 },
      { transform: 'none', opacity: 1 },
    ], { duration: 360, delay: 110 + i * 45, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  } else {
    const h = list.offsetHeight;
    list.style.overflow = 'hidden';
    const a = list.animate([
      { height: h + 'px', easing: 'cubic-bezier(.5,0,.9,.5)' },
      { height: h + 3 + 'px', offset: 0.15, easing: 'cubic-bezier(.6,0,.9,.4)' },
      { height: '0px' },
    ], { duration: 340 });
    a.onfinish = () => { list.hidden = true; list.style.overflow = ''; };
  }
}

/** 開閉の状態 + 引き出しの実体(hidden は初期値だけ React が決め、以後は foldDrawer が直接動かす) */
function useDrawer(initialOpen: boolean) {
  const reduced = useReducedMotion();
  const [open, setOpenState] = React.useState(initialOpen);
  const openRef = React.useRef(initialOpen);
  const initialHidden = React.useRef(!initialOpen).current;
  const listRef = React.useRef<HTMLDivElement>(null);
  const setOpen = React.useCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);
    if (listRef.current) foldDrawer(listRef.current, next, reduced);
  }, [reduced]);
  return { open, setOpen, listRef, initialHidden, reduced };
}

/**
 * サイドバー中央 = コンテンツツリー(MIL-SPEC v11 見本の .tree)。
 * 外枠の data-ms-tree は fx の energy() が「ツリー内の行か」を見分けて幹線から光を流すための目印。
 *
 * データを触る処理(プラン選択の保存→解凍→切替、作成、削除)は標準の実績コードと同じ手順:
 *  - 選択: 標準 Sidebar.tsx / ContentTreeItem と同じ「保存→再圧縮判定→await 解凍→書き戻し→切替」
 *  - 作成: NewPlanModal(共同編集切断・clearAllMitigations・commitNewPlan の安全な順序を持つ)
 *  - 削除: usePlanStore.deleteFromFirestore / deletePlan
 */
export const MilspecContentTree: React.FC<{ tab: Tab; select?: MilspecTreeSelect }> = ({ tab, select }) => {
  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const { plans, currentPlanId } = usePlanStore(
    useShallow((s) => ({ plans: s.plans, currentPlanId: s.currentPlanId })),
  );
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const currentContentId = currentPlan?.contentId ?? null;

  const [newPlanContentId, setNewPlanContentId] = React.useState<string | null | undefined>(undefined);
  const openNewPlan = (contentId?: string | null) => setNewPlanContentId(contentId ?? null);

  // CONTENT パネルの NEW ボタン(MilspecSidebar)からの合図でコンテンツ未指定の新規作成モーダルを開く。
  React.useEffect(() => {
    const h = () => setNewPlanContentId(null);
    window.addEventListener('milspec:new-plan', h);
    return () => window.removeEventListener('milspec:new-plan', h);
  }, []);

  return (
    <div className="milspec-tr" data-ms-tree>
      {tab === 'savage' && <SavageTree lang={contentLanguage} currentContentId={currentContentId} onAdd={openNewPlan} select={select} />}
      {tab === 'ultimate' && getAllUltimates().map((c, i) => (
        <MilspecContentGroup
          key={c.id}
          content={c}
          index={i}
          displayName={getPhaseName(c.name, contentLanguage)}
          currentContentId={currentContentId}
          onAdd={openNewPlan}
          select={select}
        />
      ))}
      {tab === 'other' && <OtherTree lang={contentLanguage} currentContentId={currentContentId} onAdd={openNewPlan} select={select} />}
      {tab === 'archive' && <ArchiveList select={select} />}

      <NewPlanModal
        isOpen={newPlanContentId !== undefined}
        initialContentId={newPlanContentId ?? null}
        onClose={() => setNewPlanContentId(undefined)}
      />
    </div>
  );
};

type TreeProps = { lang: string; currentContentId: string | null; onAdd: (id?: string | null) => void; select?: MilspecTreeSelect };

// ── 零式タブ: シリーズ見出し(fold ボタン + 文字) + 各層 ──────────────
const SavageTree: React.FC<TreeProps> = ({ lang, currentContentId, onAdd, select }) => {
  const contents = getSavageForCurrentExpansion();
  const seriesIds = [...new Set(contents.map((c) => c.seriesId))];
  // 初期 = 現在プランのシリーズだけ開く(現在のものが無ければ先頭)
  const currentSeriesId = contents.find((c) => c.id === currentContentId)?.seriesId ?? seriesIds[0];
  return (
    <>
      {seriesIds.map((sid) => {
        const inSeries = contents.filter((c) => c.seriesId === sid);
        if (!inSeries.length) return null;
        const series = getSeriesById(sid);
        const seriesName = series?.name[lang as keyof typeof series.name] || series?.name.ja || sid;
        const proj = getProjectLabel(inSeries[0].level, 'savage');
        const sectionLabel = proj ? `${proj[lang as keyof typeof proj] || proj.ja}：${seriesName}` : String(seriesName);
        return (
          <SeriesBlock key={sid} label={sectionLabel} isCurrent={sid === currentSeriesId}>
            {inSeries.map((c, i) => (
              <MilspecContentGroup
                key={c.id}
                content={c}
                index={i}
                displayName={(c.shortName[lang as keyof typeof c.shortName] || c.shortName.ja || '').replace('\n', ' ')}
                currentContentId={currentContentId}
                onAdd={onAdd}
                select={select}
              />
            ))}
          </SeriesBlock>
        );
      })}
    </>
  );
};

/** シリーズ 1 つ = 見出し(.hd + fold ボタン、見本 js:825-827) + 引き出し(.grp-list) */
const SeriesBlock: React.FC<{ label: string; isCurrent: boolean; children: React.ReactNode }> = ({ label, isCurrent, children }) => {
  const { t } = useTranslation();
  const { open, setOpen, listRef, initialHidden } = useDrawer(isCurrent);
  // 現在のプランがこのシリーズに移ってきたら開く(閉じていて選択中が見えない状態を避ける)
  const prevCurrent = React.useRef(isCurrent);
  React.useEffect(() => {
    if (isCurrent && !prevCurrent.current) setOpen(true);
    prevCurrent.current = isCurrent;
  }, [isCurrent, setOpen]);
  return (
    <>
      <div className="milspec-tr-hd">
        <button
          type="button"
          className="milspec-tr-fold"
          aria-expanded={open}
          aria-label={open ? t('milspec.sb_series_fold') : t('milspec.sb_series_unfold')}
          onClick={() => setOpen(!open)}
        >
          <MsIcon.fold />
        </button>
        <span onClick={() => setOpen(!open)}>{label}</span>
      </div>
      <div className="milspec-tr-list" ref={listRef} hidden={initialHidden}>{children}</div>
    </>
  );
};

// ── その他タブ: プランを contentId ごとにまとめる(登録の無いものは「フリープラン」) ─
const OtherTree: React.FC<TreeProps> = ({ lang, currentContentId, onAdd, select }) => {
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

const ArchiveList: React.FC<{ select?: MilspecTreeSelect }> = ({ select }) => {
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

// ── コンテンツ 1 件 = 層の行(.it) + 引き出しに入ったプラン行 ──────────
const MilspecContentGroup: React.FC<{
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

const PlanRow: React.FC<{ plan: SavedPlan; select?: MilspecTreeSelect }> = ({ plan, select }) => {
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
