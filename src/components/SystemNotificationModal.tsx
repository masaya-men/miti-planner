import React from 'react';
import { useTranslation } from 'react-i18next';
import { resolveLocalized } from '../lib/localizedText';
import { LOPO_X_URL, LOPO_DISCORD_URL } from '../lib/systemNotifLinks';
import type { SystemNotification } from '../types/systemNotification';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton } from './ui/ModalParts';

interface Props {
  isOpen: boolean;
  notif: SystemNotification | null;
  /** モーダル閉じ操作 (× / ESC / backdrop / 「既読にする」 ボタン)。 既読化処理は親側で。 */
  onClose: () => void;
}

export type SupportedLang = 'ja' | 'en' | 'ko' | 'zh' | 'zh-Hant';

export function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang === 'zh-Hant' || lang.toLowerCase().startsWith('zh-hant')) return 'zh-Hant';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}

/** フッターのリンク(X / Discord)。ModalButton の「キャンセル」と同じ見た目の <a> */
const LINK_CLASS =
  'inline-flex items-center justify-center px-4 py-1.5 rounded-md border border-transparent text-app-lg font-bold text-app-text transition-colors duration-150 hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle';

export const SystemNotificationModal: React.FC<Props> = ({ isOpen, notif, onClose }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);

  if (!isOpen || !notif) return null;

  const title = resolveLocalized(notif.title, lang);
  const body = resolveLocalized(notif.body, lang);
  const dateStr = new Date(notif.createdAt).toLocaleDateString();

  // z は他の中央モーダル/シート慣習に合わせて高く取る。
  // スマホではこのモーダルがメニューのボトムシート (z-301) 内の通知ベルから開くため、
  // 低いとシートの裏に隠れて既読操作できない。殻の既定(z-10000)で足りる。
  return (
    <ModalShell
      isOpen
      onClose={onClose}
      className="w-[360px] h-[420px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)]"
      panelProps={{ 'aria-label': title }}
    >
      <ModalHeader title={title} onClose={onClose} closeLabel={t('common.close')} />

      <div className="flex-1 min-h-0 flex flex-col gap-3 p-5">
        {/* 内側ボックス (本文 + 日付、 スクロール可) */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-app-text/10 bg-app-text/[0.02] p-3">
          <div className="text-app-md whitespace-pre-wrap leading-relaxed">{body}</div>
          <div className="mt-3 text-app-sm text-app-text-muted">{dateStr}</div>
        </div>

        {/* ラベル (ボタンの上、 固定) */}
        <div className="shrink-0 text-app-md text-app-text-muted">
          {t('system_notif.modal.footer_info')}
        </div>
      </div>

      {/* フッター 1 行: X / Discord / spacer / 既読にする */}
      <ModalFooter>
        <div className="mr-auto flex items-center gap-1">
          <a href={LOPO_X_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {t('system_notif.modal.x')}
          </a>
          <a href={LOPO_DISCORD_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {t('system_notif.modal.discord')}
          </a>
        </div>
        <ModalButton variant="primary" onClick={onClose}>
          {t('system_notif.modal.mark_read')}
        </ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};
