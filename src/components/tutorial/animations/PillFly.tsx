// src/components/tutorial/animations/PillFly.tsx
import { useEffect, useState, useRef } from 'react';
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
  /** フェーズ変化時にオーバーレイ側へ通知 */
  onPhaseChange?: (phase: 'check' | 'fly' | 'land') => void;
}

const LABEL_TEXT: Record<PillLabel, string> = {
  click: 'CLICK',
  tap: 'TAP',
  check: 'CHECK',
  next: 'NEXT',
};

// ピルの推定サイズ（px-[11px]*2 + テキスト + gap + SVG）
const PILL_WIDTH_HALF = 32;
const PILL_HEIGHT = 22;

/**
 * ピル飛行変化アニメーション。
 * CHECK → 3秒アピール → 飛行（crossfadeでCLICKに変化）→ バウンド着地
 */
export function PillFly({ fromRect, toSelector, fromLabel, toLabel, onPhaseChange }: PillFlyProps) {
  const [phase, setPhase] = useState<'check' | 'fly' | 'land'>('check');
  const [toRect, setToRect] = useState<TargetRect | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  // toSelector のDOM要素をポーリングで取得（モーダル描画待ち対応）
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    function tryFind() {
      if (cancelled) return;
      const el = document.querySelector(toSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        setToRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else if (++attempts < 30) {
        setTimeout(tryFind, 50);
      }
    }
    tryFind();
    return () => { cancelled = true; };
  }, [toSelector]);

  // 3秒後に飛行開始、飛行後にバウンド着地
  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('fly');
      onPhaseChange?.('fly');
    }, 3000);
    // 飛行0.39s + バウンス0.5s 後にland報告（ブロッカー解除）
    const t2 = setTimeout(() => {
      setPhase('land');
    }, 3400);
    const t3 = setTimeout(() => {
      onPhaseChange?.('land');
    }, 3950);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onPhaseChange]);

  // セルの上にピルを配置（CLICKピルと高さを揃える）
  const fromPos = fromRect
    ? {
        top: fromRect.top - PILL_HEIGHT - 10,
        left: fromRect.left + fromRect.width / 2 - PILL_WIDTH_HALF,
      }
    : { top: -100, left: -100 };

  // 飛行先: セルの上に配置（CLICK表示でクリックを促す）
  const toPos = toRect
    ? {
        top: toRect.top - PILL_HEIGHT - 10,
        left: toRect.left + toRect.width / 2 - PILL_WIDTH_HALF,
      }
    : fromPos;

  const isVisible = !!fromRect;

  if (!isVisible) return null;

  return (
    <motion.div
      ref={pillRef}
      className="fixed z-[10003] pointer-events-none"
      animate={
        phase === 'check'
          ? {
              top: fromPos.top,
              left: fromPos.left,
              // ぷるぷるバウンス: 上下 + 横揺れ + スケールパルス
              y: [0, -10, 2, -6, 0],
              x: [0, -3, 3, -2, 0],
              scale: [1, 1.15, 0.95, 1.08, 1],
              rotate: [0, -4, 4, -2, 0],
            }
          : phase === 'fly'
            ? { top: toPos.top, left: toPos.left, y: 0, x: 0, scale: [1, 1.4, 1], rotate: [0, 8, 0] }
            : {
                top: toPos.top, left: toPos.left,
                x: [0, 10, -4, 2, 0],
                y: [0, 6, 0],
                scale: 1, rotate: 0,
              }
      }
      transition={
        phase === 'check'
          ? {
              y: { duration: 1.2, ease: [0.36, 0, 0.66, 1], repeat: Infinity },
              x: { duration: 1.2, ease: [0.36, 0, 0.66, 1], repeat: Infinity },
              scale: { duration: 1.2, ease: [0.36, 0, 0.66, 1], repeat: Infinity },
              rotate: { duration: 1.2, ease: [0.36, 0, 0.66, 1], repeat: Infinity },
            }
          : phase === 'fly'
            ? { duration: 0.39, ease: [0.34, 1.2, 0.64, 1], scale: { times: [0, 0.4, 1] } }
            : {
                x: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
                y: { duration: 1.4, delay: 0.55, ease: [0.36, 0, 0.66, 1], repeat: Infinity },
                scale: { duration: 0.2 },
                rotate: { duration: 0.2 },
              }
      }
      style={{ top: fromPos.top, left: fromPos.left }}
    >
      {/* 外側の光る輪（check中のみ） */}
      {phase === 'check' && (
        <motion.div
          className="absolute -inset-1.5 rounded-full"
          style={{ border: '1.5px solid rgba(34, 197, 94, 0.3)' }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div
        className="flex items-center gap-[5px] rounded-full px-[11px] py-[3px] relative"
        style={{
          backgroundColor: '#22c55e',
          boxShadow: phase === 'check'
            ? '0 2px 16px rgba(34, 197, 94, 0.5), 0 0 24px rgba(34, 197, 94, 0.2)'
            : '0 2px 10px rgba(34, 197, 94, 0.4)',
        }}
      >
        {/* 飛行中にcrossfadeでラベル変化 — 両ラベルを中央揃えで重ねる */}
        <div className="relative flex items-center justify-center" style={{ minWidth: 36 }}>
          <motion.span
            animate={{ opacity: phase === 'check' ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="text-[10px] font-bold text-white tracking-[0.8px] text-center"
            style={{ fontFamily: 'system-ui' }}
          >
            {LABEL_TEXT[fromLabel]}
          </motion.span>
          <motion.span
            animate={{ opacity: phase === 'check' ? 0 : 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white tracking-[0.8px]"
            style={{ fontFamily: 'system-ui' }}
          >
            {LABEL_TEXT[toLabel]}
          </motion.span>
        </div>
        <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
          <path d="M1 1 L4 4.5 L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </motion.div>
  );
}
