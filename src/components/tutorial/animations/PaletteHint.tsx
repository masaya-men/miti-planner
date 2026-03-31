// src/components/tutorial/animations/PaletteHint.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TutorialPill } from '../TutorialPill';

interface PaletteHintProps {
  onComplete: () => void;
}

/**
 * 戦士と白魔導士のスロット上にCHECKピルを順番に表示して3秒後に自動進行。
 */
export function PaletteHint({ onComplete }: PaletteHintProps) {
  const [positions, setPositions] = useState<{ top: number; left: number }[]>([]);

  useEffect(() => {
    // 配置済みの戦士と白魔のスロットを探す
    const slots: { top: number; left: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const slot = document.getElementById(`party-slot-${i}`);
      if (!slot) continue;
      const img = slot.querySelector('img');
      const src = img?.getAttribute('src') || '';
      if (src.includes('Warrior') || src.includes('WhiteMage')) {
        const r = slot.getBoundingClientRect();
        slots.push({ top: r.top - 32, left: r.left + r.width / 2 - 28 });
      }
    }
    setPositions(slots);

    // 3秒後に自動進行
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <>
      {positions.map((pos, i) => (
        <motion.div
          key={i}
          className="fixed z-[10005] pointer-events-none"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.3, duration: 0.3 }}
        >
          <TutorialPill
            label="check"
            top={pos.top}
            left={pos.left}
            visible={true}
          />
        </motion.div>
      ))}
    </>
  );
}
