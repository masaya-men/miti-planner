// src/components/tutorial/animations/PillFly.tsx
import { useEffect, useState } from 'react';
import { TutorialPill } from '../TutorialPill';
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

/**
 * ピル飛行変化アニメーション。
 * CHECK → 1.5秒待ち → 飛行 → CLICK に変化。
 */
export function PillFly({ fromRect, toSelector, fromLabel, toLabel }: PillFlyProps) {
  const [phase, setPhase] = useState<'check' | 'fly'>('check');
  const [toRect, setToRect] = useState<TargetRect | null>(null);

  // 飛行先の座標を取得
  useEffect(() => {
    const el = document.querySelector(toSelector);
    if (el) {
      const r = el.getBoundingClientRect();
      setToRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [toSelector]);

  // 3秒後に飛行開始
  useEffect(() => {
    const timer = setTimeout(() => setPhase('fly'), 3000);
    return () => clearTimeout(timer);
  }, []);

  const currentRect = phase === 'check' ? fromRect : toRect;
  const currentLabel = phase === 'check' ? fromLabel : toLabel;

  const pos = currentRect
    ? { top: currentRect.top - 32, left: currentRect.left + currentRect.width / 2 - 28 }
    : { top: -100, left: -100 };

  return (
    <TutorialPill
      label={currentLabel}
      top={pos.top}
      left={pos.left}
      visible={!!currentRect}
    />
  );
}
