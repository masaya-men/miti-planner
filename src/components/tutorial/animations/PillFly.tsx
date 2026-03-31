// src/components/tutorial/animations/PillFly.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { PillLabel } from '../../../data/tutorialDefinitions';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PillFlyProps {
  fromRect: TargetRect | null;
  toSelector: string;
  fromLabel: PillLabel;
  toLabel: PillLabel;
}

const LABEL_TEXT: Record<PillLabel, string> = {
  click: 'CLICK',
  tap: 'TAP',
  check: 'CHECK',
  next: 'NEXT',
};

/**
 * ピル飛行変化アニメーション。
 * CHECK → 3秒アピール → 大げさに上に跳ねる → 飛行先でバウンドして着地 → CLICK
 */
export function PillFly({ fromRect, toSelector, fromLabel, toLabel }: PillFlyProps) {
  const [phase, setPhase] = useState<'check' | 'jump' | 'land'>('check');
  const [toRect, setToRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(toSelector);
    if (el) {
      const r = el.getBoundingClientRect();
      setToRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [toSelector]);

  // 3秒後にジャンプ開始、ジャンプ後にバウンド着地
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('jump'), 3000);
    const t2 = setTimeout(() => setPhase('land'), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const fromPos = fromRect
    ? { top: fromRect.top - 32, left: fromRect.left + fromRect.width / 2 - 28 }
    : { top: -100, left: -100 };

  const toPos = toRect
    ? { top: toRect.top - 32, left: toRect.left + toRect.width / 2 - 28 }
    : fromPos;

  const currentLabel = phase === 'check' ? fromLabel : toLabel;
  const isVisible = !!fromRect;

  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed z-[10003] pointer-events-none"
      animate={
        phase === 'check'
          ? { top: fromPos.top, left: fromPos.left, y: [0, 6, 0] }
          : phase === 'jump'
            ? { top: Math.min(fromPos.top, toPos.top) - 80, left: (fromPos.left + toPos.left) / 2, scale: 1.4 }
            : { top: toPos.top, left: toPos.left, scale: 1, y: [0, -8, 0, -3, 0] }
      }
      transition={
        phase === 'check'
          ? { y: { duration: 1.4, ease: [0.36, 0, 0.66, 1], repeat: Infinity } }
          : phase === 'jump'
            ? { duration: 0.4, ease: [0.2, 0, 0.2, 1] }
            : { duration: 0.5, ease: [0.34, 1.56, 0.64, 1], y: { duration: 0.8, ease: 'easeOut' } }
      }
      style={{ top: fromPos.top, left: fromPos.left }}
    >
      <div
        className="flex items-center gap-[5px] rounded-full px-[11px] py-[3px]"
        style={{
          backgroundColor: '#22c55e',
          boxShadow: '0 2px 10px rgba(34, 197, 94, 0.4)',
        }}
      >
        <motion.span
          key={currentLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] font-bold text-white tracking-[0.8px]"
          style={{ fontFamily: 'system-ui' }}
        >
          {LABEL_TEXT[currentLabel]}
        </motion.span>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 1 L4 4.5 L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.div>
  );
}
