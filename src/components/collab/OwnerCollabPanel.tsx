// src/components/collab/OwnerCollabPanel.tsx
// 共同編集⑤-3a: オーナーが共同編集リンクを管理するパネル。
// 警告(機能色 赤=app-red)・情報・リンク+コピー・入れる人数・失効/再発行。useCollabSessionStore に委譲。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Minus, Plus, Link2 } from 'lucide-react';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { SYSTEM_MAX_PARTICIPANTS } from '../../../api/collab/_roomLogic';

interface OwnerCollabPanelProps {
  planId: string;
  onClose: () => void;
}

export const OwnerCollabPanel: React.FC<OwnerCollabPanelProps> = ({ planId, onClose }) => {
  const { t } = useTranslation();
  const { roomToken, maxParticipants, setMax, revoke, reissue } = useCollabSessionStore();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // ⑤-3c: 任意の部屋名(ジョイナーのバナーに「○○ の本物の表」と表示)。空欄なら汎用文言。
  const [label, setLabel] = React.useState('');

  const url = roomToken ? `${window.location.origin}/collab/${roomToken}` : '';
  const roster = useCollabPresenceStore(s => s.roster);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* クリップボード不可環境は無視 */ }
  };

  const step = (delta: number) => {
    const next = Math.max(1, Math.min(SYSTEM_MAX_PARTICIPANTS, maxParticipants + delta));
    if (next !== maxParticipants) void setMax(planId, next);
  };

  const handleRevoke = async () => {
    setBusy(true);
    try { await revoke(planId); onClose(); } finally { setBusy(false); }
  };

  const handleReissue = async () => {
    setBusy(true);
    try { await reissue(planId, label); } finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="relative glass-tier3 rounded-2xl shadow-2xl w-[360px] max-w-[90vw] overflow-hidden"
        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-app-border bg-app-surface2/40">
          <h3 className="text-app-2xl font-bold text-app-text">{t('collab.panel_title')}</h3>
          <span className="ml-auto inline-flex items-center gap-1.5 text-app-xs text-app-text-muted">
            <span className="w-2 h-2 rounded-full bg-app-text" /> {t('collab.participants_solo')}
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-app-text border border-transparent hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* 警告(赤=危険) */}
          <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-red/40 bg-app-red/15 text-app-red">
            {t('collab.warning')}
          </p>
          {/* 情報(中立) */}
          <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-border bg-app-surface2/40 text-app-text-muted">
            {t('collab.info', { max: SYSTEM_MAX_PARTICIPANTS })}
          </p>

          {/* リンク */}
          <div>
            <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.link_label')}</div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 flex items-center gap-2 px-2.5 rounded-lg border border-app-border bg-app-surface2/60 text-app-text-muted overflow-hidden">
                <Link2 size={13} className="shrink-0" />
                <input readOnly value={url} className="flex-1 bg-transparent outline-none text-app-sm font-mono truncate" />
              </div>
              <button onClick={handleCopy} className="px-3 h-9 rounded-lg bg-app-text text-app-bg font-bold text-app-sm active:scale-95 transition-transform">
                {copied ? t('collab.copied') : t('collab.copy')}
              </button>
            </div>
          </div>

          {/* 部屋名(任意・⑤-3c) */}
          <div>
            <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.label_field')}</div>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={40}
              placeholder={t('collab.label_placeholder')}
              className="w-full h-9 px-2.5 rounded-lg border border-app-border bg-app-surface2/60 text-app-text text-app-sm outline-none placeholder:text-app-text-muted"
            />
          </div>

          {/* 人数 */}
          <div>
            <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.people_label')}</div>
            <div className="flex items-center gap-3">
              <button aria-label="dec-people" onClick={() => step(-1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text active:scale-95"><Minus size={15} /></button>
              <span className="text-app-xl font-bold text-app-text min-w-[1.5rem] text-center">{maxParticipants}</span>
              <button aria-label="inc-people" onClick={() => step(1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text active:scale-95"><Plus size={15} /></button>
              <span className="text-app-sm text-app-text-muted">{t('collab.people_unit')}</span>
            </div>
            <div className="text-app-xs text-app-text-muted mt-1">{t('collab.people_hint', { max: SYSTEM_MAX_PARTICIPANTS })}</div>
          </div>

          {/* 参加者(④-b-1) */}
          {roster.length > 0 && (
            <div>
              <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.roster_title')}</div>
              <ul className="space-y-1.5">
                {roster.map((m) => (
                  <li key={m.clientId} className="flex items-center gap-2 text-app-sm text-app-text">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="flex-1 truncate">{m.isLocal ? t('collab.roster_you') : `#${m.clientId}`}</span>
                    <span className={`text-app-xs px-1.5 py-0.5 rounded ${m.isEditor ? 'text-app-text border border-app-border' : 'text-app-text-muted'}`}>
                      {m.isEditor ? t('collab.roster_editor') : t('collab.roster_viewer')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* アクション */}
          <div className="flex gap-2 pt-3 border-t border-app-border">
            <button disabled={busy} onClick={handleReissue} className="flex-1 h-8 rounded-lg border border-app-border bg-app-surface2/60 text-app-text text-app-sm active:scale-95 disabled:opacity-50">
              {t('collab.reissue')}
            </button>
            <button disabled={busy} onClick={handleRevoke} className="flex-1 h-8 rounded-lg border border-app-red/40 bg-app-red-dim text-app-red font-bold text-app-sm active:scale-95 disabled:opacity-50">
              {t('collab.revoke')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
