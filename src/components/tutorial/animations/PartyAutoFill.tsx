// src/components/tutorial/animations/PartyAutoFill.tsx
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface PartyAutoFillProps {
  onComplete: () => void;
}

interface FlyingJob {
  id: string;
  iconSrc: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
}

/**
 * パーティ自動埋めアニメーション。
 * パレットのジョブアイコンの「分身」がスロットへ飛行する。
 * 残り6枠分のプリセットジョブを使用。
 */
export function PartyAutoFill({ onComplete }: PartyAutoFillProps) {
  const [jobs, setJobs] = useState<FlyingJob[]>([]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    // パレット上の未配置ジョブアイコンと空きスロットの座標を取得
    const paletteIcons = document.querySelectorAll('[data-tutorial="job-palette"] [data-job-id]');
    const emptySlots = document.querySelectorAll('[data-tutorial="party-slots-target"] [data-slot-empty="true"]');

    const flyingJobs: FlyingJob[] = [];
    const slotsArray = Array.from(emptySlots);

    slotsArray.forEach((slot, i) => {
      const icon = paletteIcons[i % paletteIcons.length];
      if (!icon) return;

      const iconRect = icon.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      const img = icon.querySelector('img');

      flyingJobs.push({
        id: `fly-${i}`,
        iconSrc: img?.src ?? '',
        fromX: iconRect.left + iconRect.width / 2,
        fromY: iconRect.top + iconRect.height / 2,
        toX: slotRect.left + slotRect.width / 2,
        toY: slotRect.top + slotRect.height / 2,
        delay: i * 0.15,
      });
    });

    setJobs(flyingJobs);
  }, []);

  useEffect(() => {
    if (jobs.length > 0 && completedCount >= jobs.length) {
      // 全ジョブが着地したら少し待ってから完了
      const timer = setTimeout(onComplete, 400);
      return () => clearTimeout(timer);
    }
  }, [completedCount, jobs.length, onComplete]);

  return (
    <>
      {jobs.map(job => (
        <motion.div
          key={job.id}
          className="fixed z-[10005] pointer-events-none"
          initial={{ x: job.fromX - 16, y: job.fromY - 16, scale: 1, opacity: 1 }}
          animate={{
            x: [job.fromX - 16, job.fromX + (Math.random() - 0.5) * 200, job.toX - 16],
            y: [job.fromY - 16, job.fromY - 80 - Math.random() * 60, job.toY - 16],
            scale: [1, 1.3, 1],
            opacity: [1, 1, 1],
          }}
          transition={{
            duration: 0.7,
            delay: job.delay,
            ease: [0.34, 1.56, 0.64, 1],
          }}
          onAnimationComplete={() => setCompletedCount(c => c + 1)}
        >
          {job.iconSrc && (
            <img src={job.iconSrc} alt="" className="w-8 h-8 rounded-full" />
          )}
        </motion.div>
      ))}
    </>
  );
}
