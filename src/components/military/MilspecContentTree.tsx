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

/**
 * サイドバー中央 = コンテンツツリー。masaya 2026-09-09 の指定:
 *  「上部にタブ(零式/絶/その他/アーカイブ) → コンテンツ名が縦に並ぶ(独立してへこんだプレート)
 *   → プランがあるコンテンツは開いてプランが並ぶ(＋追加)」= 標準 Sidebar.tsx と同じ木。
 * SP1 実装(フェーズ表示 + 平置きプラン一覧)は誤りだったので撤去して作り直したもの。
 *
 * データを触る処理(プラン選択の保存→解凍→切替、作成、削除)は標準の実績コードと同じ手順:
 *  - 選択: 標準 Sidebar.tsx / ContentTreeItem と同じ「保存→再圧縮判定→await 解凍→書き戻し→切替」
 *  - 作成: NewPlanModal(共同編集切断・clearAllMitigations・commitNewPlan の安全な順序を持つ)
 *  - 削除: usePlanStore.deleteFromFirestore / deletePlan
 * 見た目だけ mockup の .enc-name(コンテンツ名) / .pi(プラン行) 意匠に寄せる。
 */
export const MilspecContentTree: React.FC<{ tab: Tab }> = ({ tab }) => {
  const contentLanguage = useThemeStore((s) => s.contentLanguage);
  const { plans, currentPlanId } = usePlanStore(
    useShallow((s) => ({ plans: s.plans, currentPlanId: s.currentPlanId })),
  );
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;

  const [newPlanContentId, setNewPlanContentId] = React.useState<string | null | undefined>(undefined);
  const openNewPlan = (contentId?: string | null) => setNewPlanContentId(contentId ?? null);

  // CONTENT パネルの NEW ボタン(MilspecSidebar)からの合図でコンテンツ未指定の新規作成モーダルを開く。
  React.useEffect(() => {
    const h = () => setNewPlanContentId(null);
    window.addEventListener('milspec:new-plan', h);
    return () => window.removeEventListener('milspec:new-plan', h);
  }, []);

  return (
    <div className="milspec-hp milspec-tree recess stack" style={{ '--ms-sh': 'var(--ms-sh-tl)' } as React.CSSProperties}>
      <span className="milspec-ao-mark" /><span className="milspec-grime-mark" />
      <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
      <span className="milspec-sc tr" style={{ right: 22 }}>IDX-BLK</span>

      <div className="milspec-tree-body">
        {tab === 'savage' && <SavageTree lang={contentLanguage} currentContentId={currentPlan?.contentId ?? null} onAdd={openNewPlan} />}
        {tab === 'ultimate' && (
          <div className="milspec-tree-list">
            {getAllUltimates().map((c) => (
              <MilspecContentGroup
                key={c.id}
                content={c}
                displayName={getPhaseName(c.name, contentLanguage)}
                currentContentId={currentPlan?.contentId ?? null}
                onAdd={openNewPlan}
              />
            ))}
          </div>
        )}
        {tab === 'other' && <OtherTree lang={contentLanguage} currentContentId={currentPlan?.contentId ?? null} onAdd={openNewPlan} />}
        {tab === 'archive' && <ArchiveList lang={contentLanguage} />}
      </div>

      <NewPlanModal
        isOpen={newPlanContentId !== undefined}
        initialContentId={newPlanContentId ?? null}
        onClose={() => setNewPlanContentId(undefined)}
      />
    </div>
  );
};

// ── 零式タブ: シリーズ見出し + 各層(shortName) ──────────────────────
const SavageTree: React.FC<{ lang: string; currentContentId: string | null; onAdd: (id?: string | null) => void }> = ({ lang, currentContentId, onAdd }) => {
  const contents = getSavageForCurrentExpansion();
  const seriesIds = [...new Set(contents.map((c) => c.seriesId))];
  return (
    <div className="milspec-tree-list">
      {seriesIds.map((sid) => {
        const inSeries = contents.filter((c) => c.seriesId === sid);
        if (!inSeries.length) return null;
        const series = getSeriesById(sid);
        const seriesName = series?.name[lang as keyof typeof series.name] || series?.name.ja || sid;
        const proj = getProjectLabel(inSeries[0].level, 'savage');
        const sectionLabel = proj ? `${proj[lang as keyof typeof proj] || proj.ja}：${seriesName}` : String(seriesName);
        return (
          <div key={sid} className="milspec-tree-series">
            <div className="milspec-tree-series-hd">{sectionLabel}</div>
            {inSeries.map((c) => (
              <MilspecContentGroup
                key={c.id}
                content={c}
                displayName={(c.shortName[lang as keyof typeof c.shortName] || c.shortName.ja || '').replace('\n', ' ')}
                currentContentId={currentContentId}
                onAdd={onAdd}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ── その他タブ: プランを contentId ごとにまとめる(登録の無いものは「フリープラン」) ─
const OtherTree: React.FC<{ lang: string; currentContentId: string | null; onAdd: (id?: string | null) => void }> = ({ lang, currentContentId, onAdd }) => {
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
    <div className="milspec-tree-list">
      {[...byContent.entries()].map(([key, list]) => {
        if (key === '__free__') {
          return (
            <div className="milspec-tree-series" key={key}>
              <div className="milspec-tree-series-hd">{t('sidebar.custom_plans')}</div>
              {list.map((p) => (
                <FreePlanRow key={p.id} plan={p} />
              ))}
            </div>
          );
        }
        const c = getContentById(key)!;
        return (
          <MilspecContentGroup
            key={key}
            content={c}
            displayName={getPhaseName(c.name, lang)}
            currentContentId={currentContentId}
            onAdd={onAdd}
          />
        );
      })}
    </div>
  );
};

const ArchiveList: React.FC<{ lang: string }> = () => {
  const { t } = useTranslation();
  const plans = usePlanStore((s) => s.plans);
  const archived = plans.filter((p) => p.archived);
  if (!archived.length) return <div className="milspec-tree-empty">{t('sidebar.archive_empty')}</div>;
  return (
    <div className="milspec-tree-list">
      {archived.map((p) => (
        <FreePlanRow key={p.id} plan={p} />
      ))}
    </div>
  );
};

// ── コンテンツ 1 件 = へこんだ名前プレート + 展開したプラン行 ────────────
const MilspecContentGroup: React.FC<{
  content: ContentDefinition;
  displayName: string;
  currentContentId: string | null;
  onAdd: (id?: string | null) => void;
}> = ({ content, displayName, currentContentId, onAdd }) => {
  const { t } = useTranslation();
  const plans = usePlanStore(useShallow((s) => s.plans.filter((p) => p.contentId === content.id && !p.archived)));
  const isCurrent = currentContentId === content.id;
  const [expanded, setExpanded] = React.useState(plans.length > 0 && isCurrent);

  // プラン 0→1 で自動展開
  const prev = React.useRef(plans.length);
  React.useEffect(() => {
    if (prev.current === 0 && plans.length > 0) setExpanded(true);
    prev.current = plans.length;
  }, [plans.length]);
  React.useEffect(() => {
    if (isCurrent && plans.length > 0) setExpanded(true);
  }, [isCurrent, plans.length]);

  const atLimit = plans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT;

  const onHeadClick = () => {
    if (plans.length > 0) setExpanded((v) => !v);
    else onAdd(content.id);
  };

  return (
    <div className={clsx('milspec-tree-group', isCurrent && 'current')}>
      <button type="button" className="milspec-enc-name milspec-tree-head" onClick={onHeadClick}>
        <span className="milspec-rub-mark" />
        <span className="milspec-tree-head-name">{displayName || content.id}</span>
        {plans.length > 0 && <span className="milspec-tree-head-count">{plans.length}</span>}
        {plans.length > 0 && <span className={clsx('milspec-tree-head-cv', expanded && 'open')}>›</span>}
      </button>
      {expanded && plans.length > 0 && (
        <div className="milspec-tree-plans">
          {plans.map((p) => (
            <PlanRow key={p.id} plan={p} />
          ))}
          {!atLimit && (
            <button type="button" className="milspec-pi add" onClick={() => onAdd(content.id)}>
              <span className="bl" />+ {t('sidebar.add_plan')}
            </button>
          )}
        </div>
      )}
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

const PlanRow: React.FC<{ plan: SavedPlan }> = ({ plan }) => {
  const { t } = useTranslation();
  const currentPlanId = usePlanStore((s) => s.currentPlanId);
  const { selectPlan, duplicate, remove } = usePlanRowActions();
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(plan.title);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sel = currentPlanId === plan.id;

  React.useEffect(() => {
    if (!confirmDel) return;
    const tm = setTimeout(() => setConfirmDel(false), 3000);
    return () => clearTimeout(tm);
  }, [confirmDel]);

  const finish = () => {
    if (title.trim() && title.trim() !== plan.title) usePlanStore.getState().updatePlan(plan.id, { title: title.trim() });
    setEditing(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={clsx('milspec-pi', sel && 'sel')}
      onClick={() => { if (!editing) void selectPlan(plan); }}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !editing) { e.preventDefault(); void selectPlan(plan); } }}
    >
      <span className="bl" />
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={finish}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') finish(); if (e.key === 'Escape') { setTitle(plan.title); setEditing(false); } }}
          className="milspec-pi-rename-input"
        />
      ) : (
        <span className="lbl">{plan.title}</span>
      )}
      <span className="ac">
        <button type="button" title={t('app.rename')} onClick={(e) => { e.stopPropagation(); setTitle(plan.title); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
        </button>
        <button type="button" title={t('sidebar.duplicate_plan')} onClick={(e) => { e.stopPropagation(); void duplicate(plan.id); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="11" height="11" rx="1" /><path d="M5 15V5a1 1 0 011-1h10" /></svg>
        </button>
        <button
          type="button"
          className={clsx(confirmDel && 'armed')}
          title={confirmDel ? t('sidebar.delete_single_confirm_click') : t('sidebar.delete_single')}
          onClick={(e) => { e.stopPropagation(); if (confirmDel) { remove(plan.id); setConfirmDel(false); } else setConfirmDel(true); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
        </button>
      </span>
    </div>
  );
};

// アーカイブ / フリープラン用の軽い行(展開グループ無し)
const FreePlanRow: React.FC<{ plan: SavedPlan }> = ({ plan }) => <PlanRow plan={plan} />;
