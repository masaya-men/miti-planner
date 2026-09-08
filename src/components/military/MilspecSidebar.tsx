import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import clsx from 'clsx';
import { usePlanStore } from '../../store/usePlanStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useLocalImportDialog } from '../../store/useLocalImportDialog';
import { getContentById } from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import type { SavedPlan } from '../../types';
import { loadPlanDataIntoStore } from '../../lib/planLoad';
import { setLastOpened } from '../../utils/lastOpenedStore';
import { formatTime } from '../../utils/templateConversions';
import { showToast } from '../Toast';
import { BackupExportModal } from '../BackupExportModal';
import { BackupRestoreModal } from '../BackupRestoreModal';
import type { MilspecLayoutProps } from './MilspecLayout';
// 副作用 import: i18next の初期化(標準 Sidebar.tsx:35 と同じ理由 — useTranslation() は
// initReactI18next 済みインスタンスが無いとキー文字列をそのまま返す)。実アプリでは
// main.tsx 起動時に既に初期化済みのため重複実行の影響は無い(単体テストの安全網)。
import '../../i18n';

export type MilspecSidebarProps = Pick<MilspecLayoutProps, 'isSidebarOpen' | 'onToggleSidebar' | 'onCloseSidebar'>;

/**
 * サイドバー — SCENARIO(プラン操作) / プラン一覧 / 遭遇名 / PHASES(表示専用) / DOCK(BACKUP・RESTORE) / DEPLOYMENT(装飾)。
 * 正典: docs/.private/theme-refs/milspec-mockup.html DOM 1982-2060(<aside class="sidebar chan">) /
 *       CSS .sidebar 1305- ・.scenario/.s-hd/.s-btns 1320- ・.enc-name 1341- ・
 *       .phases/.phase/.phase-h/.phase-tag/.pi 1352- ・.dock 1394- ・.deployment 1403-。
 *
 * SP1 スコープ縮小(controller訂正・実装時の確定事項):
 * - PHASES パネルは useMitigationStore(s => s.phases) の表示専用(選択・追加は配線先が無いため未実装)。
 * - SCENARIO の TEMPLATE ボタンはユーザー向けテンプレート選択 UI が存在しないため見た目のみ(punch-list)。
 * - 「プラン一覧」はモックアップに専用スロットが無い新規セクション(.milspec-plans)。
 *   視覚語彙は mockup .pi/.pi.sel(ドット+連結線・選択時ピル+シアン菱形+複製/改名アイコン)を転用。
 *   デザイン上の位置づけは Step 9 で masaya に確認(task-5-report.md 参照)。
 */
export const MilspecSidebar: React.FC<MilspecSidebarProps> = ({ isSidebarOpen, onToggleSidebar }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const contentLanguage = useThemeStore((s) => s.contentLanguage);

  const { plans, currentPlanId } = usePlanStore(
    useShallow((s) => ({ plans: s.plans, currentPlanId: s.currentPlanId })),
  );
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
  const encName = contentDef ? getPhaseName(contentDef.name, contentLanguage) : '';

  const phases = useMitigationStore((s) => s.phases);

  const [editingPlanId, setEditingPlanId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState('');
  const editInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmScenarioDelete, setConfirmScenarioDelete] = React.useState(false);
  const [backupExportOpen, setBackupExportOpen] = React.useState(false);
  const [backupRestoreOpen, setBackupRestoreOpen] = React.useState(false);

  // 改名: 標準 Sidebar.tsx のコンテキストメニュー(:1907)と同じ 'sidebar:start-rename' カスタム
  // イベントで開始する(controller指定・同じ detail 形状 { planId })。ここでは自己完結で
  // dispatch + listen する(SP1 では右クリックメニュー自体は punch-list のため)。
  React.useEffect(() => {
    const handler = (e: Event) => {
      const planId = (e as CustomEvent<{ planId?: string }>).detail?.planId;
      if (!planId) return;
      const plan = usePlanStore.getState().plans.find((p) => p.id === planId);
      if (plan) {
        setEditingPlanId(planId);
        setEditingTitle(plan.title);
        setTimeout(() => editInputRef.current?.select(), 0);
      }
    };
    window.addEventListener('sidebar:start-rename', handler);
    return () => window.removeEventListener('sidebar:start-rename', handler);
  }, []);

  React.useEffect(() => {
    if (!confirmScenarioDelete) return;
    const timer = setTimeout(() => setConfirmScenarioDelete(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmScenarioDelete]);

  const startRename = (planId: string) => {
    window.dispatchEvent(new CustomEvent('sidebar:start-rename', { detail: { planId } }));
  };

  const finishEditing = () => {
    if (editingPlanId && editingTitle.trim()) {
      usePlanStore.getState().updatePlan(editingPlanId, { title: editingTitle.trim() });
    }
    setEditingPlanId(null);
  };

  // プラン選択: 標準 Sidebar.tsx(:355-381 相当)と全く同じ手順を移植。
  // 【Fix round 1】以前の実装は loadPlanDataIntoStore を await せず setCurrentPlanId を
  // 同一 tick で呼んでいたが、これは非圧縮プラン限定でしか安全ではなかった。
  // silentCompressStale()(usePlanStore.ts)は「7日以上開いていない非アーカイブプラン」を
  // archived フラグを変えずに compressedData 化するため、通常のフラットなプラン一覧にも
  // 圧縮プランが普通に混在しうる(アーカイブタブ限定のエッジケースではない)。圧縮プランの
  // 解凍は本当に非同期(DecompressionStream)なので、await せず setCurrentPlanId を呼ぶと
  // 「作業ストアは旧プランのデータのまま・currentPlanId だけ新プランを指す」瞬間が生まれ、
  // その間に自動保存(500ms デバウンス)が発火すると旧データが新プランIDの下に誤って
  // 保存されるおそれがある。標準と同じ「保存→再圧縮判定→await 解凍→書き戻し→
  // エラーハンドリング→ID切替→lastOpened更新」を丸ごと踏襲して解消する。
  // runTransition(オーバーレイ演出)はラップしない — Task4 で発生した Provider ネストの
  // 副作用(ロック分裂)をこれ以上増やさないため、データ安全性の手順のみ移植する。
  const handleSelectPlan = async (plan: SavedPlan) => {
    const store = usePlanStore.getState();
    if (store.currentPlanId === plan.id) return;

    const snap = useMitigationStore.getState().getSnapshot();
    if (store.currentPlanId) {
      store.updatePlan(store.currentPlanId, { data: snap });
      // 離れるプランがアーカイブ/サイレント圧縮対象なら再圧縮(標準 Sidebar.tsx と同じ)。
      const currentPlan = store.plans.find((p) => p.id === store.currentPlanId);
      if (currentPlan?.archived || currentPlan?.compressedData) {
        store.archivePlan(store.currentPlanId);
      }
    }

    try {
      const loaded = await loadPlanDataIntoStore(plan);
      if (loaded && plan.compressedData) {
        store.updatePlan(plan.id, { data: loaded, compressedData: undefined });
      }
    } catch {
      showToast(t('app.decompress_error') || 'データの読み込みに失敗しました。ページを更新してください。ログインしていない場合、データが復元できないことがあります。', 'error');
      return;
    }

    store.setCurrentPlanId(plan.id);
    setLastOpened(plan.id, Date.now());
  };

  const handleDuplicate = async (planId: string) => {
    const newPlan = await usePlanStore.getState().duplicatePlan(planId);
    if (!newPlan) showToast(t('sidebar.duplicate_limit_reached'), 'error');
  };

  const handleDeletePlan = (planId: string) => {
    const ps = usePlanStore.getState();
    const plan = ps.plans.find((p) => p.id === planId);
    const authUser = useAuthStore.getState().user;
    if (authUser) {
      ps.deleteFromFirestore(planId, authUser.uid, plan?.contentId ?? null);
    } else {
      ps.deletePlan(planId);
    }
  };

  // SCENARIO の DELETE = 現在選択中プランの削除(controller訂正#2)。行単位の削除 UI は
  // 持たない(mockup の .pi にゴミ箱アイコンが無いことに対応)。2段階確認は標準 Sidebar.tsx の
  // 行削除(confirmDeletePlanId パターン・:444-460)と同じ「クリックで武装 → 3秒以内に再クリックで実行」。
  const handleScenarioDeleteClick = () => {
    if (!currentPlanId) return;
    if (!confirmScenarioDelete) {
      setConfirmScenarioDelete(true);
      return;
    }
    handleDeletePlan(currentPlanId);
    setConfirmScenarioDelete(false);
  };

  const handleNew = () => navigate('/');
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
      <span className="milspec-sc" style={{ top: 3, right: 14, opacity: 0.35 }}>ENCOUNTER PHASE INDEX · RETRACTABLE</span>

      {/* SCENARIO — mockup .scenario(DOM 1986-2001) */}
      <div className="milspec-hp milspec-scenario recess stack" style={{ '--ms-sh': 'var(--ms-sh-br)' } as React.CSSProperties}>
        <span className="milspec-ao-mark" /><span className="milspec-grime-mark" />
        <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
        <span className="milspec-sc bl">SCN-01</span>
        <span className="milspec-pl h" style={{ left: 10, right: 10, top: 36, opacity: 0.6 }} />
        <div className="milspec-s-hd">
          <span className="en">Scenario</span><span className="jp">シナリオ</span>
          <span className="milspec-hash milspec-s-decal" style={{ top: 1, right: 0, left: 'auto', width: 36, height: 7 }} />
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
          {/* TEMPLATE: ユーザー向けテンプレート選択 UI が存在しないため見た目のみ(controller訂正#2・punch-list) */}
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

      {/* 遭遇名 — mockup .enc-name(DOM 2003) */}
      <div className="milspec-enc-name"><span className="milspec-rub-mark" />{encName || t('sidebar.no_content')}</div>

      {/* プラン一覧 — モックアップに専用スロットが無い新規セクション。視覚語彙は mockup .pi を転用。 */}
      <div className="milspec-hp milspec-plans recess stack" style={{ '--ms-sh': 'var(--ms-sh-tl-tr)' } as React.CSSProperties}>
        <span className="milspec-ao-mark" /><span className="milspec-grime-mark" />
        <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
        <span className="milspec-sc bl">PLN-03</span>
        <div className="milspec-plans-list">
          {plans.length === 0 && <div className="milspec-plans-empty">NO ACTIVE PLANS</div>}
          {plans.map((plan) => (
            <div
              key={plan.id}
              role="button"
              tabIndex={0}
              className={clsx('milspec-pi', plan.id === currentPlanId && 'sel')}
              onClick={() => { void handleSelectPlan(plan); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void handleSelectPlan(plan); }
              }}
            >
              <span className="bl" />
              {editingPlanId === plan.id ? (
                <input
                  ref={editInputRef}
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={finishEditing}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') finishEditing();
                    if (e.key === 'Escape') setEditingPlanId(null);
                  }}
                  className="milspec-pi-rename-input"
                />
              ) : (
                <span className="lbl">{plan.title}</span>
              )}
              <span className="ac">
                <button
                  type="button"
                  title={t('app.rename')}
                  onClick={(e) => { e.stopPropagation(); startRename(plan.id); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                </button>
                <button
                  type="button"
                  title={t('sidebar.duplicate_plan')}
                  onClick={(e) => { e.stopPropagation(); void handleDuplicate(plan.id); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="11" height="11" rx="1" /><path d="M5 15V5a1 1 0 011-1h10" /></svg>
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* PHASES — 表示専用(controller訂正#1)。mockup .phases/.phase/.phase-h/.phase-tag(DOM 2005-2036) */}
      <div className="milspec-hp milspec-phases recess stack" style={{ '--ms-sh': 'var(--ms-sh-tl)' } as React.CSSProperties}>
        <span className="milspec-ao-mark" /><span className="milspec-grime-mark" />
        <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
        <span className="milspec-sc tr" style={{ right: 22 }}>PHS-BLK</span>
        {phases.length === 0 && <div className="milspec-phases-empty">{t('timeline.nav_no_phases')}</div>}
        {phases.map((phase, idx) => {
          const name = getPhaseName(phase.name, contentLanguage);
          return (
            <div className="milspec-phase" key={phase.id}>
              <div className="milspec-phase-h">
                <span className="num disp">{idx + 1}</span>
                <span className="cv">層</span>
                <span className="cv dn">⌄</span>
              </div>
              <div className="milspec-phase-tag">
                <span className="t">{t('timeline.phase_prefix', { index: String(idx + 1).padStart(2, '0') })}</span>
                {name && <span className="sub">{name}</span>}
                <span className="ln" />
                <span className="milspec-phase-time">{formatTime(phase.startTime)}</span>
              </div>
            </div>
          );
        })}
      </div>

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
    </aside>
  );
};
