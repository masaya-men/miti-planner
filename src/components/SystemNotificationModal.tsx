import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { resolveLocalized } from '../lib/localizedText';
import { LOPO_X_URL, LOPO_DISCORD_URL } from '../lib/systemNotifLinks';
import type { SystemNotification } from '../types/systemNotification';

interface Props {
  isOpen: boolean;
  notif: SystemNotification | null;
  /** モーダル閉じ操作 (× / ESC / backdrop / 「既読にする」 ボタン)。 既読化処理は親側で。 */
  onClose: () => void;
}

type SupportedLang = 'ja' | 'en' | 'ko' | 'zh';

function normalizeLang(lang: string): SupportedLang {
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh';
  return 'ja';
}

export const SystemNotificationModal: React.FC<Props> = ({ isOpen, notif, onClose }) => {
  const { t, i18n } = useTranslation();
  const lang = normalizeLang(i18n.language);

  // ESC で閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !notif) return null;

  const title = resolveLocalized(notif.title, lang);
  const body = resolveLocalized(notif.body, lang);
  const dateStr = new Date(notif.createdAt).toLocaleDateString();

  const modal = (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        // z は他の中央モーダル/シート慣習に合わせて高く取る。
        // スマホではこのモーダルがメニューのボトムシート (z-301) 内の通知ベルから開くため、
        // z-100 のままだとシートの裏に隠れて既読操作できない (PC は常設サイドバーから開くので可視)。
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-notif-title"
          className="relative w-[360px] h-[420px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-64px)] rounded-lg border border-app-text/15 bg-app-bg text-app-text shadow-xl flex flex-col p-5 gap-3"
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
        >
          {/* × 閉じる */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="absolute top-2.5 right-2.5 p-1 rounded text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors z-10"
          >
            <X size={20} aria-hidden="true" />
          </button>

          {/* ヘッダー (タイトル、 固定) */}
          <header className="shrink-0 pr-8">
            <h2 id="system-notif-title" className="text-app-2xl font-bold leading-snug">
              {title}
            </h2>
          </header>

          {/* 内側ボックス (本文 + 日付、 スクロール可) */}
          <div className="flex-1 min-h-0 overflow-y-auto rounded-md border border-app-text/10 bg-app-text/[0.02] p-3">
            <div className="text-app-md whitespace-pre-wrap leading-relaxed">{body}</div>
            <div className="mt-3 text-app-sm text-app-text-muted">{dateStr}</div>
          </div>

          {/* ラベル (ボタンの上、 固定) */}
          <div className="shrink-0 text-app-md text-app-text-muted">
            {t('system_notif.modal.footer_info')}
          </div>

          {/* フッター 1 行: X / Discord / spacer / 既読にする */}
          <footer className="shrink-0 flex gap-2 items-center">
            <a
              href={LOPO_X_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded border border-app-text/20 text-app-md hover:bg-app-text/5 transition-colors"
            >
              {t('system_notif.modal.x')}
            </a>
            <a
              href={LOPO_DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded border border-app-text/20 text-app-md hover:bg-app-text/5 transition-colors"
            >
              {t('system_notif.modal.discord')}
            </a>
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded bg-app-text text-app-bg text-app-md font-bold hover:opacity-90 transition-opacity"
            >
              {t('system_notif.modal.mark_read')}
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
};
