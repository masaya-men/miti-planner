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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
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
          className="relative w-[min(520px,calc(100vw-32px))] h-[min(520px,calc(100vh-64px))] rounded-lg border border-app-text/15 bg-app-bg text-app-text shadow-xl flex flex-col"
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
            className="absolute top-3 right-3 p-1 rounded text-app-text-muted hover:text-app-text hover:bg-app-text/10 transition-colors z-10"
          >
            <X size={20} aria-hidden="true" />
          </button>

          {/* 上半身 (タイトル + 本文 + 投稿日、 スクロール可) */}
          <div className="flex-1 min-h-0 overflow-auto p-6">
            {/* タイトル */}
            <h2 id="system-notif-title" className="text-app-2xl font-bold pr-8">
              📢 {title}
            </h2>

            {/* 本文 (改行保持) */}
            <div className="mt-4 text-app-md whitespace-pre-wrap leading-relaxed">{body}</div>

            {/* 投稿日 */}
            <div className="mt-4 text-app-sm text-app-text-muted">{dateStr}</div>
          </div>

          {/* 下半身 (X/Discord + 既読、 常に下端固定) */}
          <div className="shrink-0 px-6 pb-6 pt-4 border-t border-app-text/10">
            <div className="text-app-md text-app-text-muted mb-2">
              {t('system_notif.modal.footer_info')}
            </div>
            <div className="flex gap-3 mb-4">
              <a
                href={LOPO_X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded border border-app-text/20 text-app-md hover:bg-app-text/5 transition-colors"
              >
                {t('system_notif.modal.x')}
              </a>
              <a
                href={LOPO_DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded border border-app-text/20 text-app-md hover:bg-app-text/5 transition-colors"
              >
                {t('system_notif.modal.discord')}
              </a>
            </div>

            {/* 既読にする (= 閉じる) */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-app-text text-app-bg text-app-md font-bold hover:opacity-90 transition-opacity"
              >
                {t('system_notif.modal.mark_read')}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
};
