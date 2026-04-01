// src/components/tutorial/animations/FakeCompletionCard.tsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';

interface FakeCompletionCardProps {
  onFakeDismissed: () => void;
}

export function FakeCompletionCard({ onFakeDismissed }: FakeCompletionCardProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'fake' | 'interrupt' | 'focus-wait'>('fake');

  // 1.5秒後に割り込みフェーズへ
  useEffect(() => {
    const timer = setTimeout(() => setPhase('interrupt'), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 吹き飛ばしアニメーション完了後
  const handleBlowAwayComplete = useCallback(() => {
    setPhase('focus-wait');
    onFakeDismissed();
  }, [onFakeDismissed]);

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/30" />

      <AnimatePresence>
        {/* 偽 CompletionCard */}
        {(phase === 'fake' || phase === 'interrupt') && (
          <motion.div
            key="fake-card"
            className="relative bg-app-bg border border-app-text/15 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl z-10"
            initial={{ scale: 0.9, y: 20 }}
            animate={phase === 'interrupt' ? {
              scaleX: [1, 0.85, 1.1],
              scaleY: [1, 1.15, 0.9],
              rotate: [0, -5, 25],
              x: [0, -20, 600],
              y: [0, 10, -400],
              opacity: [1, 1, 0],
            } : {
              scale: 1, y: 0,
            }}
            transition={phase === 'interrupt' ? {
              duration: 0.8,
              times: [0, 0.2, 1],
              ease: 'easeInOut',
            } : {
              type: 'spring', stiffness: 300, damping: 25,
            }}
            onAnimationComplete={() => {
              if (phase === 'interrupt') handleBlowAwayComplete();
            }}
          >
            <h2 className="text-lg font-bold text-app-text text-center mb-2">
              {t('tutorial.completion.title')}
            </h2>
            <div className="space-y-3 mb-5">
              <div className="flex items-start gap-2.5 text-xs text-app-text-muted">
                <span className="mt-0.5 flex-shrink-0 text-[#22c55e]"><HelpCircle size={14} /></span>
                <span>{t('tutorial.completion.menu_hint')}</span>
              </div>
            </div>
            <button
              disabled
              className="w-full py-2.5 rounded-lg text-sm font-semibold opacity-50 cursor-not-allowed"
              style={{ backgroundColor: '#22c55e', color: 'white' }}
            >
              {t('tutorial.completion.start_button')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 割り込みカード */}
      <AnimatePresence>
        {phase === 'interrupt' && (
          <motion.div
            key="interrupt-card"
            className="absolute bg-app-bg border-2 border-[#22c55e]/50 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl z-20"
            initial={{ x: -500, rotate: -10, opacity: 0 }}
            animate={{ x: 0, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.1 }}
          >
            <p className="text-lg font-black text-app-text text-center">
              {t('tutorial.main.focus_mode.message')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
