// src/components/tutorial/animations/FakeCompletionCard.tsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { HelpCircle } from 'lucide-react';
interface FakeCompletionCardProps {
  onComplete: () => void;
}

/**
 * 偽CompletionCard → 割り込み → Fキー体験 → 自動進行。
 * 1つのコンポーネントで全フローを管理し、ステップ遷移によるちらつきを防ぐ。
 *
 * フェーズ:
 * 1. fake:    偽CompletionCard表示（ボタン無効、~1.5秒）
 * 2. blow:    割り込みカードが左から飛来 + 偽CompletionCardが右上に吹き飛ぶ
 * 3. prompt:  割り込みカードが残り、Fキー案内を表示（Fキーのみ受付）
 * 4. pressed: 「集中したいときはこれ！」表示（全操作ブロック、2秒後に自動進行）
 */
export function FakeCompletionCard({ onComplete }: FakeCompletionCardProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'fake' | 'blow' | 'prompt' | 'pressed'>('fake');

  // 1.5秒後に吹き飛ばしフェーズへ
  useEffect(() => {
    const timer = setTimeout(() => setPhase('blow'), 1500);
    return () => clearTimeout(timer);
  }, []);

  // 偽カードの吹き飛びアニメ完了後 → prompt へ
  const handleBlowComplete = useCallback(() => {
    setPhase('prompt');
  }, []);

  // prompt フェーズでFキー待ち
  useEffect(() => {
    if (phase !== 'prompt') return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        setPressed(true);
      }
    };
    const setPressed = (_: boolean) => setPhase('pressed');
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase]);

  // pressed フェーズ: キーボード全ブロック + 2秒後に完了
  useEffect(() => {
    if (phase !== 'pressed') return;
    const blockKeys = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', blockKeys, true);
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    return () => {
      window.removeEventListener('keydown', blockKeys, true);
      clearTimeout(timer);
    };
  }, [phase, onComplete]);

  return (
    <div className="fixed inset-0 z-[10005] flex items-center justify-center">
      {/* 背景オーバーレイ */}
      <div className={`absolute inset-0 ${phase === 'pressed' ? 'bg-black/10' : 'bg-black/30'}`} />

      {/* ── 偽 CompletionCard ── */}
      <AnimatePresence>
        {(phase === 'fake' || phase === 'blow') && (
          <motion.div
            key="fake-card"
            className="relative bg-app-bg border border-app-text/15 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl z-10"
            initial={{ scale: 0.9, y: 20 }}
            animate={phase === 'blow' ? {
              scaleX: [1, 0.85, 1.1],
              scaleY: [1, 1.15, 0.9],
              rotate: [0, -5, 25],
              x: [0, -20, 600],
              y: [0, 10, -400],
              opacity: [1, 1, 0],
            } : {
              scale: 1, y: 0,
            }}
            transition={phase === 'blow' ? {
              duration: 0.8,
              times: [0, 0.2, 1],
              ease: 'easeInOut',
            } : {
              type: 'spring', stiffness: 300, damping: 25,
            }}
            onAnimationComplete={() => {
              if (phase === 'blow') handleBlowComplete();
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

      {/* ── 割り込みカード（最初から完成形で飛来 → そのまま残る） ── */}
      {(phase === 'blow' || phase === 'prompt' || phase === 'pressed') && (
        <motion.div
          className="absolute z-20"
          style={{ maxWidth: 280 }}
          initial={{ x: -500, rotate: -10, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="rounded-xl overflow-hidden shadow-xl bg-app-bg border border-app-text/10">
            <div className="h-[3px] w-full" style={{ backgroundColor: '#22c55e' }} />
            <div className="px-4 pt-3 pb-3">
              <p className="text-[13px] font-bold text-app-text leading-snug">
                {phase !== 'pressed'
                  ? t('tutorial.main.focus_mode.message')
                  : t('tutorial.main.focus_done.message')
                }
              </p>
              <p className="text-[11px] text-app-text-muted mt-1 leading-relaxed">
                {phase !== 'pressed'
                  ? t('tutorial.main.focus_mode.description')
                  : t('tutorial.main.focus_done.description')
                }
              </p>
              {/* Fキーアイコン（pressed 以外で常に表示） */}
              {phase !== 'pressed' && (
                <div className="flex items-center justify-center mt-3">
                  <motion.div
                    className="w-10 h-10 rounded-lg border-2 border-app-text/30 flex items-center justify-center text-base font-black text-app-text"
                    animate={phase === 'prompt' ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                  >
                    F
                  </motion.div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
