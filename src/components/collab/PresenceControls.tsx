// ④-b-2: ジョブ自己選択(将来)+ カーソル ON/OFF トグル。OwnerCollabPanel/ジョイナー UI に組み込む。
// OFF→ON はオプトイン説明モーダルを挟む(IP 露出の同意)。ON→OFF は即時。
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { CursorOptInModal } from './CursorOptInModal';

export const PresenceControls: React.FC = () => {
  const { t } = useTranslation();
  const cursorEnabled = useCollabPresenceStore(s => s.cursorEnabled);
  const cursorFallback = useCollabPresenceStore(s => s.cursorFallback);
  const setCursorEnabled = useCollabPresenceStore(s => s.setCursorEnabled);
  const [optInOpen, setOptInOpen] = React.useState(false);

  const toggle = () => {
    if (cursorEnabled) setCursorEnabled(false);   // ON→OFF は即時
    else setOptInOpen(true);                        // OFF→ON は説明を挟む
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-app-sm text-app-text flex-1">{t('collab.cursor_share_label')}</span>
        <button
          aria-label="cursor-toggle"
          onClick={toggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${cursorEnabled ? 'bg-app-text' : 'bg-app-surface2 border border-app-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-app-bg transition-transform ${cursorEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {cursorEnabled && cursorFallback && (
        <p className="text-app-xs text-app-text-muted">{t('collab.cursor_fallback')}</p>
      )}
      {optInOpen && (
        <CursorOptInModal
          onConfirm={() => { setCursorEnabled(true); setOptInOpen(false); }}
          onCancel={() => setOptInOpen(false)}
        />
      )}
    </div>
  );
};
