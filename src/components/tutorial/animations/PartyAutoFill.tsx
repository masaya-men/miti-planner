// src/components/tutorial/animations/PartyAutoFill.tsx
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

// チュートリアルで自動埋めに使うプリセットジョブ（戦士・白魔は既に入っている想定）
const AUTO_FILL_JOBS = ['pld', 'ast', 'drg', 'mnk', 'brd', 'smn'];

interface PartyAutoFillProps {
  onComplete: () => void;
}

interface FlyingJob {
  id: string;
  jobId: string;
  iconSrc: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  delay: number;
}

/**
 * パーティ自動埋めアニメーション。
 * パレットのジョブアイコンがスロットへ飛行し、実際にジョブを配置する。
 */
export function PartyAutoFill({ onComplete }: PartyAutoFillProps) {
  const [jobs, setJobs] = useState<FlyingJob[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const filledRef = useRef(false);

  useEffect(() => {
    // 空きスロットとパレットアイコンの座標を取得
    const emptySlots: Element[] = [];
    for (let i = 0; i < 8; i++) {
      const slot = document.getElementById(`party-slot-${i}`);
      if (!slot) continue;
      // ジョブアイコンの <img> がなければ空きスロット
      const hasJob = slot.querySelector('img[src*="job"], img[alt]');
      if (!hasJob) emptySlots.push(slot);
    }

    const flyingJobs: FlyingJob[] = [];

    emptySlots.forEach((slot, i) => {
      const jobId = AUTO_FILL_JOBS[i % AUTO_FILL_JOBS.length];
      const paletteBtn = document.querySelector(`[data-job-id="${jobId}"]`);
      if (!paletteBtn) return;

      const btnRect = paletteBtn.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      const img = paletteBtn.querySelector('img');

      flyingJobs.push({
        id: `fly-${i}`,
        jobId,
        iconSrc: img?.src ?? '',
        fromX: btnRect.left + btnRect.width / 2,
        fromY: btnRect.top + btnRect.height / 2,
        toX: slotRect.left + slotRect.width / 2,
        toY: slotRect.top + slotRect.height / 2,
        delay: i * 0.12,
      });
    });

    if (flyingJobs.length === 0) {
      // 空きスロットがなければ即完了
      onComplete();
      return;
    }

    setJobs(flyingJobs);

    // 実際にジョブを配置（アニメーション開始と同時にクリックをシミュレート）
    flyingJobs.forEach((job) => {
      setTimeout(() => {
        const btn = document.querySelector(`[data-job-id="${job.jobId}"]`) as HTMLElement;
        btn?.click();
      }, (job.delay + 0.5) * 1000);
    });
  }, [onComplete]);

  useEffect(() => {
    if (jobs.length > 0 && completedCount >= jobs.length && !filledRef.current) {
      filledRef.current = true;
      const timer = setTimeout(onComplete, 600);
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
            x: [job.fromX - 16, (job.fromX + job.toX) / 2 + (Math.random() - 0.5) * 100, job.toX - 16],
            y: [job.fromY - 16, Math.min(job.fromY, job.toY) - 40 - Math.random() * 40, job.toY - 16],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 0.6,
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
