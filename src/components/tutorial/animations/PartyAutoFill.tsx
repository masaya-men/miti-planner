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

  // ブーメランのように弧を描いてスロットにはまるアニメーション
  // まずふわっと分身が出現→右に膨らんだ弧を描いて→スロットにカチャッと着地
  return (
    <>
      {jobs.map(job => {
        const dx = job.toX - job.fromX;
        const dy = job.toY - job.fromY;
        // 弧の頂点: 右方向にずらして放物線を描く
        const arcX = job.fromX + dx * 0.5 + Math.abs(dy) * 0.4 * (Math.random() > 0.5 ? 1 : -1);
        const arcY = Math.min(job.fromY, job.toY) - 60 - Math.random() * 40;

        return (
          <motion.div
            key={job.id}
            className="fixed z-[10005] pointer-events-none"
            initial={{ x: job.fromX - 16, y: job.fromY - 16, scale: 0.3, opacity: 0 }}
            animate={{
              x: [job.fromX - 16, arcX - 16, job.toX - 16],
              y: [job.fromY - 16, arcY - 16, job.toY - 16],
              scale: [0.3, 1.3, 1],
              opacity: [0, 1, 1],
              rotate: [0, 15, 0],
            }}
            transition={{
              duration: 0.8,
              delay: job.delay,
              ease: [0.25, 0.46, 0.45, 0.94],
              scale: { times: [0, 0.4, 1] },
              opacity: { times: [0, 0.15, 1] },
            }}
            onAnimationComplete={() => setCompletedCount(c => c + 1)}
          >
            {job.iconSrc && (
              <img src={job.iconSrc} alt="" className="w-8 h-8 rounded-full drop-shadow-lg" />
            )}
          </motion.div>
        );
      })}
    </>
  );
}
