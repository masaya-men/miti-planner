// src/components/tutorial/animations/CompletionCard.tsx
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Share2, PlusCircle, HelpCircle } from 'lucide-react';

interface CompletionCardProps {
  onDismiss: () => void;
}

/**
 * チュートリアル完了画面。
 * お祝いメッセージ + 機能紹介リスト + チュートリアルメニューの場所案内。
 */
export function CompletionCard({ onDismiss }: CompletionCardProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      className="fixed inset-0 z-[10005] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" onClick={onDismiss} />

      {/* カード */}
      <motion.div
        className="relative bg-app-bg border border-app-text/15 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <h2 className="text-lg font-bold text-app-text text-center mb-2">
          {t('tutorial.completion.title')}
        </h2>
        <p className="text-sm text-app-text-muted text-center mb-4">
          {t('tutorial.completion.subtitle')}
        </p>

        <div className="space-y-3 mb-5">
          <FeatureHint
            icon={<Share2 size={14} />}
            text={t('tutorial.completion.share_hint')}
          />
          <FeatureHint
            icon={<PlusCircle size={14} />}
            text={t('tutorial.completion.new_plan_hint')}
          />
          <FeatureHint
            icon={<HelpCircle size={14} />}
            text={t('tutorial.completion.menu_hint')}
          />
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80 cursor-pointer"
          style={{ backgroundColor: '#22c55e', color: 'white' }}
        >
          {t('tutorial.completion.start_button')}
        </button>
      </motion.div>
    </motion.div>
  );
}

function FeatureHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2.5 text-xs text-app-text-muted">
      <span className="mt-0.5 flex-shrink-0 text-[#22c55e]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
