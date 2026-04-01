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
  /** ステップ進捗 "3 / 12" 等 */
  stepLabel?: string;
}

/**
 * チュートリアル吹き出しカード。
 * ダーク=黒背景白文字、ライト=白背景黒文字。
 * 左端に緑のアクセントライン。
 */
export function TutorialCard({
  messageKey,
  descriptionKey,
  image,
  top,
  left,
  visible,
  onSkip,
  stepLabel,
}: TutorialCardProps) {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <motion.div
      className="fixed z-[10002] pointer-events-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, top, left }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        top: { type: 'spring', stiffness: 300, damping: 22 },
        left: { type: 'spring', stiffness: 300, damping: 16, mass: 0.8 },
        opacity: { duration: 0.15 },
        y: { duration: 0.2 },
      }}
      style={{ top, left, maxWidth: 280 }}
    >
      <div className="rounded-xl overflow-hidden shadow-xl bg-app-bg border border-app-text/10">
        {/* 緑アクセントバー */}
        <div className="h-[3px] w-full" style={{ backgroundColor: '#22c55e' }} />

        <div className="px-4 pt-3 pb-3">
          {/* ステップカウンター */}
          {stepLabel && (
            <div className="text-[9px] font-bold tracking-widest uppercase text-app-text-muted mb-1.5" style={{ color: '#22c55e' }}>
              STEP {stepLabel}
            </div>
          )}

          {image && (
            <img
              src={image}
              alt=""
              className="w-full rounded-lg mb-2.5"
              style={{ maxHeight: 100, objectFit: 'cover' }}
            />
          )}

          <p className="text-[13px] font-bold text-app-text leading-snug">
            {t(messageKey)}
          </p>
          {descriptionKey && (
            <p className="text-[11px] text-app-text-muted mt-1 leading-relaxed">
              {t(descriptionKey)}
            </p>
          )}

          {onSkip && (
            <button
              onClick={onSkip}
              className="text-[10px] text-app-text-muted mt-2 underline underline-offset-2 hover:text-app-text transition-colors cursor-pointer"
            >
              {t('tutorial.skip')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
