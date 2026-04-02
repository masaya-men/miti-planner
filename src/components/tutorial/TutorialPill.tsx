// src/components/tutorial/TutorialPill.tsx
import { motion } from 'framer-motion';
import type { PillLabel } from '../../data/tutorialDefinitions';

interface TutorialPillProps {
  label: PillLabel;
  top: number;
  left: number;
  visible: boolean;
  /** 矢印の方向（デフォルト: down） */
  arrow?: 'down' | 'right';
}

const LABEL_TEXT: Record<PillLabel, string> = {
  click: 'CLICK',
  tap: 'TAP',
  check: 'CHECK',
  next: 'NEXT',
};

/**
 * 緑ピルインジケーター
 * ボタン自体のCSSをいじらず、近くに浮かぶ独立した「アピール物体」。
 * #22c55e ビビッドグリーン。ダーク/ライト両対応。
 */
export function TutorialPill({ label, top, left, visible, arrow = 'down' }: TutorialPillProps) {
  if (!visible) return null;

  const isRight = arrow === 'right';
  // 右向きは横にバウンス、下向きは縦にバウンス
  const bounceAxis = isRight ? { x: [0, 6, 0] } : { y: [0, 6, 0] };

  return (
    <motion.div
      className="fixed z-[10003] pointer-events-none"
      animate={{
        top,
        left,
        ...bounceAxis,
      }}
      transition={{
        top: { type: 'spring', stiffness: 200, damping: 25 },
        left: { type: 'spring', stiffness: 200, damping: 25 },
        ...(isRight
          ? { x: { duration: 1.4, ease: [0.36, 0, 0.66, 1], repeat: Infinity } }
          : { y: { duration: 1.4, ease: [0.36, 0, 0.66, 1], repeat: Infinity } }
        ),
      }}
      style={{ top, left }}
    >
      <div
        className="flex items-center gap-[5px] rounded-full px-[11px] py-[3px]"
        style={{
          backgroundColor: '#22c55e',
          boxShadow: '0 2px 10px rgba(34, 197, 94, 0.4)',
        }}
      >
        <motion.span
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="text-app-base font-bold text-white tracking-[0.8px]"
          style={{ fontFamily: 'system-ui' }}
        >
          {LABEL_TEXT[label]}
        </motion.span>
        {isRight ? (
          <svg width="6" height="8" viewBox="0 0 6 8" fill="none">
            <path d="M1 1 L4.5 4 L1 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 1 L4 4.5 L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </motion.div>
  );
}
