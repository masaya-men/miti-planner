import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { usePlanStore } from '../../store/usePlanStore';
import { useLocalImportDialog } from '../../store/useLocalImportDialog';
import { getContentById } from '../../data/contentRegistry';
import { BackupExportModal } from '../BackupExportModal';
import { BackupRestoreModal } from '../BackupRestoreModal';
import { ShareModal } from '../ShareModal';
import { usePlanMultiSelect, MULTI_SHARE_LIMIT } from '../../hooks/usePlanMultiSelect';
import { MilspecContentTree } from './MilspecContentTree';
import { type MilspecTreeTab } from './milspecContentTreeModel';
import { useMilspecTreeTabs, tabForPlanCategory } from './milspecContentTreeModel';
import { MilspecArmor } from './MilspecArmor';
import { MilspecKey } from './MilspecKey';
import { MilspecPlanCore } from './MilspecPlanCore';
import { MilspecNotifBeacon } from './MilspecNotifBeacon';
import { MilspecFxLayer } from './fx/MilspecFxLayer';
import { energy, emit } from './fx/engine';
import { MilspecStencil, MilspecMark, MilspecScrew, MilspecRivet, MilspecMaintPlate, MilspecBarcode } from './MilspecDecor';
import { MsIcon } from './milspecIcons';
import { bbox, chamRect } from './armor/geom';
import type { CapSpec } from './armor/types';
import { SB_FRAME, SB_PANELS, SB_KEY_ROWS, SB_TREE_BOX, SB_DECOR, SB_TRACES, sbY, sbPath } from './sidebarGeometry';
import type { MilspecLayoutProps } from './milspecLayoutTypes';
// 副作用 import: i18next の初期化(標準 Sidebar.tsx:35 と同じ理由)。
import '../../i18n';

export type MilspecSidebarProps = Pick<MilspecLayoutProps, 'isSidebarOpen' | 'onToggleSidebar' | 'onCloseSidebar'>;

/** 選択の帯(ツリー箱の上端)の高さと、その中のキーの形 */
const SELBAR_H = 22;
// 実行キーの幅はモード別(共有は刻印が短いので件数に広く譲る・削除は武装中の長い刻印が入る幅)。
// en/ko/zh の最長(件数「10/10」・武装「もう一度押すと 10 件」)で測って決めた値(task-7-report.md)。
const SEL_EXEC_W = { share: 90, delete: 116 } as const;
const SEL_CANCEL_W = 46;
const selCap = (w: number): CapSpec => ({ pts: chamRect(w, 16, 3, 3, 3, 3) });
const SEL_EXEC_CAP = { share: selCap(SEL_EXEC_W.share), delete: selCap(SEL_EXEC_W.delete) };
const SEL_CANCEL_CAP = selCap(SEL_CANCEL_W);

/** 列の中のキー 1 個の位置(キーの左上 = 形の bbox。列の箱は幅高さ 0 で、見本の cluster と同じ) */
const capPos = (cap: CapSpec): React.CSSProperties => {
  const b = bbox(cap.pts);
  return { left: b.x, top: b.y };
};

/**
 * サイドバー(v11 の S1〜S3)。区画の全面に装甲・基板・光の層を敷き、その上に
 * キー(コンテンツ切替 / 新規作成・まとめて共有・選択削除 / 取り込み / バックアップ・復元)と
 * プランツリーを置く。座標は見本どおり区画座標で、y が 300 より下のものは区画の実高 H に追従する。
 */
export const MilspecSidebar: React.FC<MilspecSidebarProps> = ({ isSidebarOpen }) => {
  const { t, i18n } = useTranslation();
  // 英語は副題を持たない(空文字が ja にフォールバックして日本語が出るのを防ぐ)
  const isEn = (i18n.resolvedLanguage ?? i18n.language ?? '').startsWith('en');

  const { plans, currentPlanId } = usePlanStore(
    useShallow((s) => ({ plans: s.plans, currentPlanId: s.currentPlanId })),
  );
  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;
  const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;

  const [backupExportOpen, setBackupExportOpen] = React.useState(false);
  const [backupRestoreOpen, setBackupRestoreOpen] = React.useState(false);

  // コンテンツツリーのタブ(零式/絶/その他/アーカイブ)。S1 の 4 キーで切り替える。
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

  // 区画の実高 H(0 は無視)。既定は基準の高さ
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [H, setH] = React.useState(SB_FRAME.h0);
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const en = entries[0];
      if (!en) return;
      const bb = Array.isArray(en.borderBoxSize) ? en.borderBoxSize[0] : en.borderBoxSize;
      const h = bb ? bb.blockSize : en.contentRect.height;
      if (h <= 0) return;
      setH((prev) => (prev === h ? prev : h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isSidebarOpen]);

  // 複数選択(まとめて共有・選択削除)
  const ms = usePlanMultiSelect();
  const { multiSelect } = ms;
  const selMode = multiSelect.isEnabled ? (multiSelect.mode ?? 'share') : null;
  const selCount = multiSelect.selectedIds.length;

  // 選択削除のカバー付き 2 段(1 回目で武装・3 秒で解除・2 回目で実行)
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [armed]);
  // 件数・モードが変わったら武装を外す(違う件数を巻き込んで消さない)
  React.useEffect(() => { setArmed(false); }, [selCount, selMode]);

  // 選択モード中の Escape で抜ける(共有・バックアップ・復元のモーダルや、開いている他のダイアログがあれば触らない)
  const { reset } = ms;
  React.useEffect(() => {
    if (!multiSelect.isEnabled || ms.bundleOpen || backupExportOpen || backupRestoreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // 新規作成・取り込みなど、どのダイアログが開いていても選択を消さない
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [multiSelect.isEnabled, ms.bundleOpen, backupExportOpen, backupRestoreOpen, reset]);

  const handleTab = (id: MilspecTreeTab, el: Element) => {
    // 押すたびに s1 へ光(見本 data-bus="s1" js:807, 1022-1023)。タブが変わらなくても流す
    emit(el, 's1', { both: true, len: 14 });
    if (id === tab) return;
    setTab(id);
    energy(el); // energy は切り替わったときだけ(見本 js:1017-1019)
  };
  const handleNew = (e: React.MouseEvent<HTMLButtonElement>) => {
    window.dispatchEvent(new CustomEvent('milspec:new-plan'));
    emit(e.currentTarget, 's1', { both: true, len: 14 });
  };
  const handleMode = (mode: 'share' | 'delete') => (e: React.MouseEvent<HTMLButtonElement>) => {
    ms.toggleMode(mode);
    emit(e.currentTarget, 's1', { both: true, len: 14 });
  };
  const handleDeleteExec = () => {
    if (selCount === 0) return;
    if (!armed) { setArmed(true); return; }
    setArmed(false);
    void ms.deleteSelected();
  };
  const handleImport = () => useLocalImportDialog.getState().open();

  const rowOf = (id: 'content' | 'actions' | 'service' | 'dock') => SB_KEY_ROWS.find((r) => r.id === id)!;
  const colStyle = (id: 'content' | 'actions' | 'service' | 'dock'): React.CSSProperties => {
    const row = rowOf(id);
    return { left: row.x, top: sbY(row.y, H) };
  };
  const treeTop = SB_TREE_BOX.y;
  const treeH = sbY(590, H) - treeTop;
  const coreTop = 138.4;
  const coreH = sbY(589.6, H) - coreTop;
  const traces = React.useMemo(() => SB_TRACES.map((tr) => ({ ...tr, d: sbPath(tr.d, H) })), [H]);

  const tabKeyLabel = (label: string) => <b>{label}</b>;
  const plate = SB_DECOR.plate;

  return (
    <>
      {isSidebarOpen && (
        <div ref={rootRef} className="milspec-sbx">
          <MilspecArmor id="sb" frame={SB_FRAME} panels={SB_PANELS} />
          {/* 基板 PLAN CORE(ツリー箱の下の黒い床) */}
          <div className="milspec-sb-core" style={{ left: 12.4, top: coreTop, width: 249.2, height: coreH }}>
            <MilspecPlanCore />
          </div>
          <MilspecFxLayer traces={traces} />

          <div className="milspec-sbx-top">
            {/* 飾り(刻印・型番・ネジ・リベット・点検板・バーコード) */}
            {SB_DECOR.engraves.map((g, i) => (
              <MilspecStencil
                key={g.text}
                en={g.text}
                hi={i < 2}
                sub={isEn ? undefined : i === 0 ? t('milspec.sb_content_sub') : i === 1 ? t('milspec.sb_service_sub') : undefined}
                style={{ left: g.x, top: sbY(g.y, H) }}
              />
            ))}
            {SB_DECOR.ids.map((g) => <MilspecMark key={g.text} text={g.text} style={{ left: g.x, top: sbY(g.y, H) }} />)}
            {SB_DECOR.screws.map((s, i) => <MilspecScrew key={i} rotate={s.rot} style={{ left: s.x, top: sbY(s.y, H) }} />)}
            {SB_DECOR.rivets.map((s, i) => <MilspecRivet key={i} style={{ left: s.x, top: sbY(s.y, H) }} />)}
            <MilspecMaintPlate title="MAINT LOG · 07" bars={[88, 62, 76]} width={54} style={{ left: plate.x, top: sbY(plate.y, H) }} />
            <MilspecBarcode h={6} style={{ left: SB_DECOR.barcode.x, top: sbY(SB_DECOR.barcode.y, H) }} />

            {/* S1 コンテンツ種別(連動キー 4 つ) */}
            <div className="milspec-sb-kc" role="group" aria-label={t('milspec.sb_content_group')} style={colStyle('content')}>
              {tabs.map((tb, i) => {
                const cap = rowOf('content').caps[i];
                return (
                  <MilspecKey
                    key={tb.id}
                    cap={cap}
                    style={capPos(cap)}
                    latch
                    pressed={tab === tb.id}
                    label={tabKeyLabel(tb.label)}
                    onClick={(e) => handleTab(tb.id, e.currentTarget)}
                  />
                );
              })}
            </div>

            {/* S1 操作(新規作成 / まとめて共有 / 選択削除) */}
            <div className="milspec-sb-kc" style={colStyle('actions')}>
              {([
                { cap: rowOf('actions').caps[0], icon: MsIcon.plus(), text: t('sidebar.new_plan'), onClick: handleNew, pressed: undefined },
                { cap: rowOf('actions').caps[1], icon: MsIcon.share(), text: t('sidebar.multi_select_mode'), onClick: handleMode('share'), pressed: selMode === 'share' },
                { cap: rowOf('actions').caps[2], icon: MsIcon.multi(), text: t('sidebar.select_delete'), onClick: handleMode('delete'), pressed: selMode === 'delete' },
              ]).map((k, i) => (
                <MilspecKey
                  key={i}
                  cap={k.cap}
                  style={capPos(k.cap)}
                  latch={k.pressed !== undefined}
                  pressed={k.pressed}
                  label={<>{k.icon}<b>{k.text}</b></>}
                  onClick={k.onClick}
                />
              ))}
            </div>

            {/* S2 プランツリー(選択モード中は上端に選択の帯) */}
            <div className="milspec-sb-treebox" style={{ left: SB_TREE_BOX.x, top: treeTop, width: SB_TREE_BOX.w, height: treeH }}>
              {selMode && (
                <div className="milspec-sb-selbar" data-mode={selMode} style={{ height: SELBAR_H }}>
                  <span className="milspec-sb-selcount">
                    {t('milspec.sb_select_count', { count: selCount })}
                    {selMode === 'share' && <span className="milspec-sb-sellimit">/{MULTI_SHARE_LIMIT}</span>}
                  </span>
                  {selMode === 'share' ? (
                    <MilspecKey
                      cap={SEL_EXEC_CAP.share}
                      className="milspec-key-ic"
                      style={{ left: 250 - SEL_CANCEL_W - 4 - SEL_EXEC_W.share, top: 3 }}
                      disabled={selCount === 0}
                      label={<>{MsIcon.share()}<b>{t('sidebar.share_together')}</b></>}
                      onClick={() => { void ms.openBundleShare(); }}
                    />
                  ) : (
                    <MilspecKey
                      cap={SEL_EXEC_CAP.delete}
                      className="milspec-key-ic milspec-key-dng"
                      style={{ left: 250 - SEL_CANCEL_W - 4 - SEL_EXEC_W.delete, top: 3 }}
                      disabled={selCount === 0}
                      data-armed={armed ? '' : undefined}
                      label={<>{MsIcon.close()}<b>{armed ? t('milspec.sb_bulk_delete_armed', { count: selCount }) : t('sidebar.select_delete')}</b></>}
                      onClick={handleDeleteExec}
                    />
                  )}
                  <MilspecKey
                    cap={SEL_CANCEL_CAP}
                    className="milspec-key-cancel"
                    style={{ left: 250 - SEL_CANCEL_W, top: 3 }}
                    label={<b>{t('sidebar.cancel')}</b>}
                    onClick={reset}
                  />
                </div>
              )}
              <div className="milspec-sb-treebody" style={{ height: selMode ? treeH - SELBAR_H : treeH }}>
                <MilspecContentTree
                  tab={tab}
                  select={selMode ? { mode: selMode, selectedIds: multiSelect.selectedIds, onToggle: ms.toggleId } : undefined}
                />
              </div>
            </div>

            {/* S3 取り込み(見本の「アップデート」の位置) */}
            <div className="milspec-sb-kc" style={colStyle('service')}>
              {(() => {
                const cap = rowOf('service').caps[0];
                return (
                  <MilspecKey cap={cap} style={capPos(cap)} label={<>{MsIcon.imp()}<b>{t('nav.import')}</b></>} onClick={handleImport} />
                );
              })()}
            </div>

            {/* S3 バックアップ / 復元 */}
            <div className="milspec-sb-kc" style={colStyle('dock')}>
              {([
                { cap: rowOf('dock').caps[0], icon: MsIcon.save(), text: t('backup.backup_button'), onClick: () => setBackupExportOpen(true) },
                { cap: rowOf('dock').caps[1], icon: MsIcon.rest(), text: t('backup.restore_button'), onClick: () => setBackupRestoreOpen(true) },
              ]).map((k, i) => (
                <MilspecKey key={i} cap={k.cap} style={capPos(k.cap)} label={<>{k.icon}<b>{k.text}</b></>} onClick={k.onClick} />
              ))}
            </div>

            {/* 運営通知のマーク(未読があるときだけ。ツリー箱の右下と S3 右上の隙間) */}
            <MilspecNotifBeacon H={H} />
          </div>
        </div>
      )}

      <BackupExportModal isOpen={backupExportOpen} onClose={() => setBackupExportOpen(false)} />
      <BackupRestoreModal isOpen={backupRestoreOpen} onClose={() => setBackupRestoreOpen(false)} />
      {/* まとめて共有(Sidebar.tsx と同じ渡し方) */}
      <ShareModal
        isOpen={ms.bundleOpen}
        onClose={ms.closeBundleShare}
        contentLabel={null}
        currentPlan={undefined}
        bundlePlans={ms.bundlePlans}
      />
    </>
  );
};
