// src/components/collab/OwnerCollabPanel.tsx
// 共同編集⑤-3a: オーナーが共同編集リンクを管理するパネル。
// レイアウト: 上=警告/情報、中=設定(左)/参加者(右・スクロール)、下=リンク(配るのがゴール)、最下=操作。
// 参加者の表示名は nameForClient(clientId)で生成(awareness の生 ID を隠す・個人情報なし)。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Minus, Plus, Link2 } from 'lucide-react';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { usePlanStore } from '../../store/usePlanStore';
import { nameForClient } from '../../lib/collab/presence';
import { PresenceControls } from './PresenceControls';
import { ConfirmDialog } from '../ConfirmDialog';
import { SYSTEM_MAX_PARTICIPANTS } from '../../../api/collab/_roomLogic';

interface OwnerCollabPanelProps {
  planId: string;
  onClose: () => void;
}

export const OwnerCollabPanel: React.FC<OwnerCollabPanelProps> = ({ planId, onClose }) => {
  const { t, i18n } = useTranslation();
  const { active, roomToken, maxParticipants, setMax, revoke, reissue } = useCollabSessionStore();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [confirmOff, setConfirmOff] = React.useState(false);
  // ⑤-3c: 任意の部屋名(ジョイナーのバナーに「○○ の本物の表」と表示)。空欄なら汎用文言。
  const [label, setLabel] = React.useState('');

  // リンクはプラン保存トークン(Task4)へフォールバック=接続前でも即生成・空欄にしない(A案・業界水準)。
  const planToken = usePlanStore(s => s.plans.find(p => p.id === planId)?.activeCollabRoomToken);
  const effectiveToken = roomToken || planToken;
  const url = effectiveToken ? `${window.location.origin}/collab/${effectiveToken}` : '';
  const roster = useCollabPresenceStore(s => s.roster);

  // 表示名の材料(i18n)。ja/zh は区切りなし、en/ko は半角スペース。
  const adjectives = React.useMemo(() => t('collab.name_adjectives').split(','), [t]);
  const nouns = React.useMemo(() => t('collab.name_nouns').split(','), [t]);
  const sep = ['ja', 'zh'].includes(i18n.language) ? '' : ' ';

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
    <>
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div
        className="relative glass-tier3 rounded-2xl shadow-2xl w-[600px] max-w-[94vw] max-h-[90vh] flex flex-col overflow-hidden"
        style={{ '--glass-tier3-bg': 'var(--share-modal-bg)' } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-app-border bg-app-surface2/40 shrink-0">
          <h3 className="text-app-2xl font-bold text-app-text flex-1">{t('collab.panel_title')}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-app-text border border-transparent cursor-pointer hover:bg-app-toggle hover:text-app-toggle-text transition-all duration-200 active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        {/* 本体(スクロール) */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {/* 警告(赤=危険) */}
          <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-red/40 bg-app-red/15 text-app-red">
            {t('collab.warning')}
          </p>
          {/* 情報(中立) */}
          <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-border bg-app-surface2/40 text-app-text-muted">
            {t('collab.info', { max: SYSTEM_MAX_PARTICIPANTS })}
          </p>

          {/* 設定(左) / 参加者(右) */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* 左: 設定 */}
            <div className="space-y-3">
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
                  <button aria-label="dec-people" onClick={() => step(-1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text cursor-pointer active:scale-95"><Minus size={15} /></button>
                  <span className="text-app-xl font-bold text-app-text min-w-[1.5rem] text-center">{maxParticipants}</span>
                  <button aria-label="inc-people" onClick={() => step(1)} className="w-8 h-8 rounded-lg border border-app-border bg-app-surface2/60 flex items-center justify-center text-app-text cursor-pointer active:scale-95"><Plus size={15} /></button>
                  <span className="text-app-sm text-app-text-muted">{t('collab.people_unit')}</span>
                </div>
                <div className="text-app-xs text-app-text-muted mt-1">{t('collab.people_hint', { max: SYSTEM_MAX_PARTICIPANTS })}</div>
              </div>

              {/* ジョブ + カーソル共有(④-b-2) */}
              {roster.length > 0 && <PresenceControls />}
            </div>

            {/* 右: 参加者(④-b-1・名前表示・スクロール) */}
            <div>
              <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.roster_title')}</div>
              {roster.length > 0 ? (
                <ul className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                  {roster.map((m) => (
                    <li key={m.clientId} className="flex items-center gap-2 text-app-sm text-app-text">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                      <span className="flex-1 truncate">{m.isLocal ? t('collab.roster_you') : nameForClient(m.clientId, adjectives, nouns, sep)}</span>
                      <span className={`text-app-xs px-1.5 py-0.5 rounded ${m.isEditor ? 'text-app-text border border-app-border' : 'text-app-text-muted'}`}>
                        {m.isEditor ? t('collab.roster_editor') : t('collab.roster_viewer')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                // 接続が確立するまでは「接続中…」(業界水準のローディング)。確立後に一人なら solo 文言。
                <p className="text-app-sm text-app-text-muted">{active ? t('collab.participants_solo') : t('collab.connecting')}</p>
              )}
            </div>
          </div>

          {/* リンク(配るのがゴール・最後) */}
          <div>
            <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.link_label')}</div>
            <div className="flex gap-2">
              <div className="flex-1 h-9 flex items-center gap-2 px-2.5 rounded-lg border border-app-border bg-app-surface2/60 text-app-text-muted overflow-hidden">
                <Link2 size={13} className="shrink-0" />
                <input readOnly value={url} className="flex-1 bg-transparent outline-none text-app-sm font-mono truncate" />
              </div>
              <button onClick={handleCopy} className="px-3 h-9 rounded-lg bg-app-text text-app-bg font-bold text-app-sm cursor-pointer active:scale-95 transition-transform">
                {copied ? t('collab.copied') : t('collab.copy')}
              </button>
            </div>
          </div>
        </div>

        {/* フッター: 操作 */}
        <div className="flex gap-2 px-5 py-3 border-t border-app-border bg-app-surface2/20 shrink-0">
          <button disabled={busy} onClick={handleReissue} className="flex-1 h-9 rounded-lg border border-app-border bg-app-surface2/60 text-app-text text-app-sm cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {t('collab.reissue')}
          </button>
          <button disabled={busy} onClick={() => setConfirmOff(true)} className="flex-1 h-9 rounded-lg border border-app-red/40 bg-app-red-dim text-app-red font-bold text-app-sm cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
            {t('collab.turn_off')}
          </button>
        </div>
      </div>
    </div>

      {/* OFF(失効)は確認 1 枚を挟む(誤操作で全員を締め出さない)。
          パネル本体の onClick(onClose) に伝播しないよう fragment 直下(パネルの外)に置く。
          React portal はReactツリーで伝播するため、パネル内に置くとダイアログのクリックで
          パネルごと閉じてしまう。 */}
      <ConfirmDialog
        isOpen={confirmOff}
        title={t('collab.off_confirm_title')}
        message={t('collab.off_confirm_body')}
        confirmLabel={t('collab.off_confirm_ok')}
        variant="danger"
        onCancel={() => setConfirmOff(false)}
        onConfirm={() => { setConfirmOff(false); void handleRevoke(); }}
      />
    </>,
    document.body,
  );
};
