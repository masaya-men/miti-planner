import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLocalImportDialog } from '../../store/useLocalImportDialog';
import { getContentById } from '../../data/contentRegistry';
import { BackupExportModal } from '../BackupExportModal';
import { BackupRestoreModal } from '../BackupRestoreModal';
import { MilspecContentTree, useMilspecTreeTabs, tabForPlanCategory, type MilspecTreeTab } from './MilspecContentTree';
import type { MilspecLayoutProps } from './MilspecLayout';
// 副作用 import: i18next の初期化(標準 Sidebar.tsx:35 と同じ理由)。
import '../../i18n';

export type MilspecSidebarProps = Pick<MilspecLayoutProps, 'isSidebarOpen' | 'onToggleSidebar' | 'onCloseSidebar'>;

/**
 * サイドバー — SCENARIO(プラン操作) / 遭遇名 / コンテンツツリー / DOCK(BACKUP・RESTORE) / DEPLOYMENT(装飾)。
 * 正典: docs/.private/theme-refs/milspec-mockup.html DOM 1982-2060。
 *
 * 2026-09-09 masaya 指摘で作り直し: 中央は「今開いてるプランのフェーズ一覧」ではなく
 * 標準 Sidebar.tsx と同じ **コンテンツツリー**(タブ 零式/絶/… → コンテンツ名が並ぶ →
 * プランがあるコンテンツは開いてプランが並ぶ)。実体は MilspecContentTree.tsx。
 */
export const MilspecSidebar: React.FC<MilspecSidebarProps> = ({ isSidebarOpen, onToggleSidebar }) => {
  const { t } = useTranslation();

  const { plans, currentPlanId } = usePlanStore(
    useShallow((s) => ({ plans: s.plans, currentPlanId: s.currentPlanId })),
  );
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;

  const [confirmScenarioDelete, setConfirmScenarioDelete] = React.useState(false);
  const [backupExportOpen, setBackupExportOpen] = React.useState(false);
  const [backupRestoreOpen, setBackupRestoreOpen] = React.useState(false);

  // コンテンツツリーのタブ(零式/絶/その他/アーカイブ)。CONTENT パネル内に置く(masaya 指定)。
  const tabs = useMilspecTreeTabs();
  const [tab, setTab] = React.useState<MilspecTreeTab>(() =>
    tabForPlanCategory(contentDef?.category ?? currentPlan?.category ?? null),
  );
  // currentPlanId が変わったらタブを追従(標準 Sidebar と同じ・plans 配列変化では追従しない)
  const prevPlanIdRef = React.useRef(currentPlanId);
  React.useEffect(() => {
    if (currentPlanId && currentPlanId !== prevPlanIdRef.current) {
      const p = usePlanStore.getState().plans.find((x) => x.id === currentPlanId);
      const cat = p?.contentId ? getContentById(p.contentId)?.category : (p?.category ?? null);
      if (cat) setTab(tabForPlanCategory(cat));
    }
    prevPlanIdRef.current = currentPlanId;
  }, [currentPlanId]);

  React.useEffect(() => {
    if (!confirmScenarioDelete) return;
    const timer = setTimeout(() => setConfirmScenarioDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmScenarioDelete]);

  // SCENARIO の DELETE = 現在選択中プランの削除。2 段階確認(標準 Sidebar と同じ「武装 → 3 秒以内に再クリック」)。
  const handleScenarioDeleteClick = () => {
    if (!currentPlanId) return;
    if (!confirmScenarioDelete) {
      setConfirmScenarioDelete(true);
      return;
    }
    const ps = usePlanStore.getState();
    const authUser = useAuthStore.getState().user;
    if (authUser) ps.deleteFromFirestore(currentPlanId, authUser.uid, currentPlan?.contentId ?? null);
    else ps.deletePlan(currentPlanId);
    setConfirmScenarioDelete(false);
  };

  const handleNew = () => window.dispatchEvent(new CustomEvent('milspec:new-plan'));
  const handleImport = () => useLocalImportDialog.getState().open();

  return (
    <aside className="milspec-sb milspec-chan">
      <button
        type="button"
        className="milspec-sb-collapse"
        title={t(isSidebarOpen ? 'sidebar.close_menu' : 'sidebar.open_menu')}
        onClick={onToggleSidebar}
      >
        {isSidebarOpen ? '‹' : '›'}
      </button>
      {isSidebarOpen && (
        <>
          <span className="milspec-sc" style={{ top: 3, right: 14, opacity: 0.35 }}>ENCOUNTER INDEX · RETRACTABLE</span>

          {/* CONTENT — コンテンツ選択(タブ 零式/絶/… + プラン操作ボタン)。
              mockup .scenario の位置。見出しは masaya 指定で「シナリオ」→「コンテンツ」。 */}
          <div className="milspec-hp milspec-scenario recess stack" style={{ '--ms-sh': 'var(--ms-sh-br)' } as React.CSSProperties}>
            <span className="milspec-ao-mark" /><span className="milspec-grime-mark" />
            <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
            <span className="milspec-sc bl">CNT-01</span>
            <div className="milspec-s-hd">
              <span className="en">Content</span><span className="jp">コンテンツ</span>
              <span className="milspec-hash milspec-s-decal" style={{ top: 1, right: 0, left: 'auto', width: 36, height: 7 }} />
            </div>
            <div className="milspec-tree-tabs" role="tablist">
              {tabs.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === tb.id}
                  className={clsx('milspec-tree-tab', tab === tb.id && 'active')}
                  onClick={() => setTab(tb.id)}
                >
                  {tb.label}
                </button>
              ))}
            </div>
            <div className="milspec-s-btns">
              <button type="button" className="milspec-s-btn" onClick={handleNew}>
                <span className="en milspec-echo" data-text={t('sidebar.new_plan', { lng: 'en' })}>{t('sidebar.new_plan', { lng: 'en' })}</span>
                <span className="jp">{t('sidebar.new_plan', { lng: 'ja' })}</span>
              </button>
              <button type="button" className="milspec-s-btn imp" onClick={handleImport}>
                <span className="en milspec-echo" data-text={t('nav.import', { lng: 'en' })}>{t('nav.import', { lng: 'en' })}</span>
                <span className="jp">{t('nav.import', { lng: 'ja' })}</span>
              </button>
              {/* TEMPLATE: ユーザー向けテンプレート選択 UI が無いため見た目のみ(punch-list) */}
              <button type="button" className="milspec-s-btn">
                <span className="en milspec-echo" data-text="Template">Template</span>
                <span className="jp">テンプレート</span>
              </button>
              <button
                type="button"
                className={clsx('milspec-s-btn', 'danger', confirmScenarioDelete && 'armed')}
                onClick={handleScenarioDeleteClick}
                disabled={!currentPlanId}
              >
                <span className="en milspec-echo" data-text={t(confirmScenarioDelete ? 'sidebar.delete_single_confirm_click' : 'sidebar.delete', { lng: 'en' })}>
                  {t(confirmScenarioDelete ? 'sidebar.delete_single_confirm_click' : 'sidebar.delete', { lng: 'en' })}
                </span>
                <span className="jp">{t(confirmScenarioDelete ? 'sidebar.delete_single_confirm_click' : 'sidebar.delete', { lng: 'ja' })}</span>
              </button>
            </div>
          </div>

          {/* コンテンツツリー(コンテンツごとの沈んだサブプレート = 名前 + プラン)。
              タブは上の CONTENT パネル側。単独の遭遇名表示はタブがあれば冗長なので撤去(masaya)。 */}
          <MilspecContentTree tab={tab} />

          {/* DOCK: BACKUP / RESTORE — mockup .dock(DOM 2038-2045) */}
          <div className="milspec-hp milspec-dock recess" style={{ '--ms-sh': 'var(--ms-sh-slab)' } as React.CSSProperties}>
            <span className="milspec-ao-mark" /><span className="milspec-grime-mark" />
            <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
            <span className="milspec-sc bl">DCK-02</span>
            <span className="milspec-pl v" style={{ left: '50%', top: 8, bottom: 8, opacity: 0.55 }} />
            <button type="button" onClick={() => setBackupExportOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="18" height="13" rx="1" /><path d="M3 11h18M3 15h18" /></svg>
              <span className="tx">
                <span className="en">{t('backup.backup_button', { lng: 'en' })}</span>
                <span className="jp">{t('backup.backup_button', { lng: 'ja' })}</span>
              </span>
            </button>
            <button type="button" onClick={() => setBackupRestoreOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 3v11M8 10l4 4 4-4M5 20h14" /></svg>
              <span className="tx">
                <span className="en">{t('backup.restore_button', { lng: 'en' })}</span>
                <span className="jp">{t('backup.restore_button', { lng: 'ja' })}</span>
              </span>
            </button>
          </div>

          {/* DEPLOYMENT — 完全装飾。mockup .deployment(DOM 2047-2059) */}
          <div className="milspec-hp milspec-deployment recess" style={{ '--ms-sh': 'var(--ms-sh-tr)' } as React.CSSProperties}>
            <span className="milspec-bolt bl" />
            <span className="milspec-sc br">DPL-X · DO NOT REMOVE</span>
            <div className="milspec-hazard milspec-deployment-hz" />
            <span className="milspec-drip" style={{ left: 26, top: 9, height: 17 }} />
            <span className="milspec-drip" style={{ left: '62%', top: 9, height: 11 }} />
            <span className="milspec-drip" style={{ right: 34, top: 9, height: 14 }} />
            <div className="milspec-deployment-bd">
              <svg className="mk" viewBox="0 0 40 40">
                <path d="M8 8 L32 32 M32 8 L8 32" stroke="currentColor" strokeWidth="5" strokeLinecap="square" />
                <path d="M4 13 L4 4 L13 4 M27 4 L36 4 L36 13 M36 27 L36 36 L27 36 M13 36 L4 36 L4 27" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <div className="tx"><span className="en">Deployment</span><span className="jp">展開を支援する</span></div>
            </div>
          </div>

          <BackupExportModal isOpen={backupExportOpen} onClose={() => setBackupExportOpen(false)} />
          <BackupRestoreModal isOpen={backupRestoreOpen} onClose={() => setBackupRestoreOpen(false)} />
        </>
      )}
    </aside>
  );
};
