// ④-b-2 / ②③ブラッシュアップ: カーソル ON/OFF トグル + 自分のアイコン選択。
// - トグル自身が状態(英語 ON/OFF)を表示する(②表記ゆれ統一・動作カタカナ/状態注釈の二重表記を廃止)。
// - アイコン選択ボタンは ON のときだけ表示(③ゲート化)。ON 中はいつでも変更可。
// - OFF→ON はオプトイン説明モーダル(IP 露出の同意)→ 続けてアイコン選択ピッカーを自動で開く(②導線)。
//   ピッカーを閉じれば「アイコン無し」(= jobId null = 素の矢印)。ON→OFF は即時。
// - compact / 非 compact は見た目サイズの違いのみ(オーナーパネルと閲覧者ヘッダーで表示を揃える③)。
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

export const PresenceControls: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { t } = useTranslation();
  const cursorEnabled = useCollabPresenceStore(s => s.cursorEnabled);
  const cursorFallback = useCollabPresenceStore(s => s.cursorFallback);
  const setCursorEnabled = useCollabPresenceStore(s => s.setCursorEnabled);
  const jobId = useCollabPresenceStore(s => s.jobId);
  const setJobId = useCollabPresenceStore(s => s.setJobId);
  const [optInOpen, setOptInOpen] = React.useState(false);
  const [pickerPos, setPickerPos] = React.useState<{ x: number; y: number } | null>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  const jobs = useJobs();
  const myJobIcon = jobId ? jobs.find(j => j.id === jobId)?.icon ?? null : null;

  const toggle = () => {
    if (cursorEnabled) setCursorEnabled(false);   // ON→OFF は即時
    else setOptInOpen(true);                        // OFF→ON は説明を挟む
  };

  // ②導線: OptIn 同意 → ON にして、続けて「自分のアイコン」を選ばせる。
  // ピッカーはトグル(常に DOM にある)を基準に開く。閉じれば jobId は null のまま=アイコン無し。
  const confirmOptIn = () => {
    setCursorEnabled(true);
    setOptInOpen(false);
    const r = toggleRef.current?.getBoundingClientRect();
    setPickerPos(r ? { x: r.left, y: r.bottom } : { x: 0, y: 0 });
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
        <CursorOptInModal onConfirm={confirmOptIn} onCancel={() => setOptInOpen(false)} />
      )}
    </>
  );

  // 状態トグル: ON=塗りつぶし / OFF=枠線のみ。文言はトグル自身が状態を示す(英語 ON/OFF)。
  const toggleBtn = (
    <button
      ref={toggleRef}
      aria-label="cursor-toggle"
      onClick={toggle}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap cursor-pointer active:scale-95 transition-all border',
        compact ? 'px-2.5 h-7 text-app-xs' : 'px-3 h-8 text-app-sm',
        cursorEnabled
          ? 'bg-app-text text-app-bg border-app-text'
          : 'bg-transparent border-app-border text-app-text-muted',
      )}
    >
      <MousePointer2 size={compact ? 12 : 13} />
      {cursorEnabled ? t('collab.cursor_share_on') : t('collab.cursor_share_off')}
    </button>
  );

  // アイコン選択ボタンは ON のときだけ(③ゲート化)。ON 中はいつでも変更可。
  const iconBtn = cursorEnabled && (
    <Tooltip content={t('collab.cursor_job_label')}>
      <button
        aria-label="job-select"
        onClick={openPicker}
        className={clsx(
          'rounded-full border border-app-border bg-app-surface2/60 flex items-center justify-center overflow-hidden cursor-pointer active:scale-95 transition-transform',
          compact ? 'w-7 h-7' : 'w-8 h-8',
        )}
      >
        {myJobIcon
          ? <img src={myJobIcon} alt="" className={compact ? 'w-5 h-5 object-contain' : 'w-6 h-6 object-contain'} />
          : <User size={compact ? 13 : 15} className="text-app-text-muted" />}
      </button>
    </Tooltip>
  );

  // ヘッダークラスタ用 1 行版(compact): トグル + アイコン。
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {toggleBtn}
        {iconBtn}
        {overlays}
      </div>
    );
  }

  // オーナーパネル用: 閲覧者ヘッダーと同じ並び(トグル + アイコン)+ フォールバック注記。
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {toggleBtn}
        {iconBtn}
      </div>
      {cursorEnabled && cursorFallback && (
        <p className="text-app-xs text-app-text-muted">{t('collab.cursor_fallback')}</p>
      )}
      {overlays}
    </div>
  );
};
