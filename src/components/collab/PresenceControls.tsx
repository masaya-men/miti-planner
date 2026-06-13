// ④-b-2: ジョブ自己選択 + カーソル ON/OFF トグル。OwnerCollabPanel/ジョイナー UI に組み込む。
// OFF→ON はオプトイン説明モーダルを挟む(IP 露出の同意)。ON→OFF は即時。
// ジョブは「自分を表すアイコン」(実名なし・パーティ編成枠とは無関係)。roster/カーソルに反映。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { User, MousePointer2 } from 'lucide-react';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { useJobs } from '../../hooks/useSkillsData';
import { JobPicker } from '../JobPicker';
import { CursorOptInModal } from './CursorOptInModal';
import { Tooltip } from '../ui/Tooltip';

/**
 * compact: ヘッダーの共同編集中クラスタ用の 1 行横並び版(カーソルトグル + ジョブアイコン)。
 *   状態はトグルのラベル(cursor_share_on/off)で明示。縦パネル版はオーナーパネル用(既定)。
 */
export const PresenceControls: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useTranslation();
  const cursorEnabled = useCollabPresenceStore(s => s.cursorEnabled);
  const cursorFallback = useCollabPresenceStore(s => s.cursorFallback);
  const setCursorEnabled = useCollabPresenceStore(s => s.setCursorEnabled);
  const jobId = useCollabPresenceStore(s => s.jobId);
  const setJobId = useCollabPresenceStore(s => s.setJobId);
  const [optInOpen, setOptInOpen] = React.useState(false);
  const [pickerPos, setPickerPos] = React.useState<{ x: number; y: number } | null>(null);

  const jobs = useJobs();
  const myJobIcon = jobId ? jobs.find(j => j.id === jobId)?.icon ?? null : null;

  const toggle = () => {
    if (cursorEnabled) setCursorEnabled(false);   // ON→OFF は即時
    else setOptInOpen(true);                        // OFF→ON は説明を挟む
  };

  const openPicker = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPickerPos({ x: r.left, y: r.bottom });
  };

  // JobPicker / OptIn モーダルは compact / 通常で共通(body へ portal)。
  const overlays = (
    <>
      {pickerPos && createPortal(
        <JobPicker
          isOpen
          position={pickerPos}
          currentJobId={jobId}
          onSelect={(id) => { setJobId(id); setPickerPos(null); }}
          onClose={() => setPickerPos(null)}
        />,
        document.body,
      )}
      {optInOpen && (
        <CursorOptInModal
          onConfirm={() => { setCursorEnabled(true); setOptInOpen(false); }}
          onCancel={() => setOptInOpen(false)}
        />
      )}
    </>
  );

  // ヘッダークラスタ用 1 行版: [カーソルトグル(状態ラベル)] [ジョブアイコン]。
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          aria-label="cursor-toggle"
          onClick={toggle}
          className={clsx(
            "inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-app-xs font-bold whitespace-nowrap cursor-pointer active:scale-95 transition-all border",
            cursorEnabled
              ? "bg-app-text text-app-bg border-app-text"
              : "bg-transparent border-app-border text-app-text-muted",
          )}
        >
          <MousePointer2 size={12} />
          {cursorEnabled ? t('collab.cursor_share_on') : t('collab.cursor_share_off')}
        </button>
        <Tooltip content={t('collab.cursor_job_label')}>
          <button
            aria-label="job-select"
            onClick={openPicker}
            className="w-7 h-7 rounded-full border border-app-border bg-app-surface2/60 flex items-center justify-center overflow-hidden cursor-pointer active:scale-95 transition-transform"
          >
            {myJobIcon
              ? <img src={myJobIcon} alt="" className="w-5 h-5 object-contain" />
              : <User size={13} className="text-app-text-muted" />}
          </button>
        </Tooltip>
        {overlays}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 自己表現ジョブ */}
      <div className="flex items-center gap-2">
        <span className="text-app-sm text-app-text flex-1">{t('collab.cursor_job_label')}</span>
        <button
          aria-label="job-select"
          onClick={openPicker}
          className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center overflow-hidden cursor-pointer active:scale-95 transition-transform"
        >
          {myJobIcon
            ? <img src={myJobIcon} alt="" className="w-6 h-6 object-contain" />
            : <User size={15} className="text-app-text-muted" />}
        </button>
      </div>

      {/* カーソル ON/OFF: ボタン + 状態テキストはボタンのすぐ下に赤字で(枠 w-[190px] に収める) */}
      <div className="flex items-start gap-2">
        <span className="text-app-sm text-app-text flex-1 pt-1.5">{t('collab.cursor_share_label')}</span>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            aria-label="cursor-toggle"
            onClick={toggle}
            className={`px-2.5 h-7 rounded-lg text-app-xs font-bold cursor-pointer active:scale-95 transition-all ${cursorEnabled ? 'bg-app-surface2 border border-app-border text-app-text' : 'bg-app-text text-app-bg'}`}
          >
            {cursorEnabled ? t('collab.cursor_turn_off') : t('collab.cursor_turn_on')}
          </button>
          <p className="text-app-xs text-app-red text-right">
            {cursorEnabled ? t('collab.cursor_status_on') : t('collab.cursor_status_off')}
          </p>
        </div>
      </div>

      {cursorEnabled && cursorFallback && (
        <p className="text-app-xs text-app-text-muted">{t('collab.cursor_fallback')}</p>
      )}

      {/* JobPicker / OptIn は body へ portal(glass-tier の backdrop-filter 内で fixed が画面外に出るのを回避)。 */}
      {overlays}
    </div>
  );
};
