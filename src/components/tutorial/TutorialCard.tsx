// src/components/tutorial/TutorialCard.tsx
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

interface TutorialCardProps {
  messageKey: string;
  descriptionKey?: string;
  image?: string;
  top: number;
  left: number;
  visible: boolean;
  onSkip?: () => void;
}

/**
 * 緑系の吹き出しカード。ピルと統一感のあるデザイン。
 * 画像スロットあり（スクショ等を表示可能）。
 */
export function TutorialCard({
  messageKey,
  descriptionKey,
  image,
  top,
  left,
  visible,
  onSkip,
}: TutorialCardProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <motion.div
      className="fixed z-[10002] pointer-events-auto"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1, top, left }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        top: { type: 'spring', stiffness: 200, damping: 25 },
        left: { type: 'spring', stiffness: 200, damping: 25 },
        opacity: { duration: 0.2 },
        scale: { duration: 0.2 },
      }}
      style={{
        top,
        left,
        maxWidth: 300,
      }}
    >
      <div
        className="rounded-xl p-4 shadow-lg bg-app-bg border border-app-text/15"
      >
        {image && (
          <img
            src={image}
            alt=""
            className="w-full rounded-lg mb-3"
            style={{ maxHeight: 120, objectFit: 'cover' }}
          />
        )}
        <p className="text-sm font-semibold text-app-text">
          {t(messageKey)}
        </p>
        {descriptionKey && (
          <p className="text-xs text-app-text-muted mt-1">
            {t(descriptionKey)}
          </p>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-[10px] text-app-text-muted mt-2 underline underline-offset-2 hover:text-app-text transition-colors"
          >
            {t('tutorial.skip')}
          </button>
        )}
      </div>
    </motion.div>
  );
}
