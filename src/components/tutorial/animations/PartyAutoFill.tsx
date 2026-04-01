// src/components/tutorial/animations/PartyAutoFill.tsx
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const AUTO_FILL_JOBS = ['pld', 'ast', 'drg', 'mnk', 'brd', 'smn'];

// 飛行パラメータ（固定シード）
const SEEDS = [
  { arcHeight: 95, rot: 25, flyScale: 1.6 },
  { arcHeight: 115, rot: -32, flyScale: 1.4 },
  { arcHeight: 80, rot: 20, flyScale: 1.7 },
  { arcHeight: 130, rot: -24, flyScale: 1.5 },
  { arcHeight: 88, rot: 30, flyScale: 1.55 },
  { arcHeight: 105, rot: -18, flyScale: 1.45 },
];

const APPEAR_INTERVAL = 180;   // アイコン出現間隔(ms)
const APPEAR_START = 300;      // 最初のアイコン出現までの待ち(ms)
const ORBIT_EXTRA = 2400;      // 最後のアイコン出現後の追加回転時間(ms)
const ORBIT_SPEED = 1.0;       // rad/s
const BOB_AMPLITUDE = 3;       // 上下ゆらぎ(px)
const BOB_SPEED = 2.5;         // ゆらぎ周波数
const FLIGHT_DURATION = 650;

interface PartyAutoFillProps {
  onComplete: () => void;
}

interface JobInfo {
  id: string;
  jobId: string;
  iconSrc: string;
  slotId: string;
  btnX: number; btnY: number;
  toX: number; toY: number;
  seed: typeof SEEDS[number];
}

// ── WAAPI 着地エフェクト ──
function fireLandingEffects(x: number, y: number) {
  const c = document.createElement('div');
  Object.assign(c.style, {
    position: 'fixed', top: '0', left: '0', zIndex: '10005',
    pointerEvents: 'none', transform: `translate(${x - 16}px, ${y - 16}px)`,
  });
  document.body.appendChild(c);

  const makeRing = (size: string, border: string, scaleTo: number, dur: number, delay: number) => {
    const el = document.createElement('div');
    Object.assign(el.style, {
      width: size, height: size, borderRadius: '50%', border,
      position: 'absolute', top: '0', left: '0',
    });
    c.appendChild(el);
    el.animate(
      [{ transform: 'scale(1)', opacity: 0.9 }, { transform: `scale(${scaleTo})`, opacity: 0 }],
      { duration: dur, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards', delay },
    );
  };
  makeRing('32px', '2px solid rgba(34,197,94,0.8)', 2.5, 500, 0);
  makeRing('32px', '1.5px solid rgba(34,197,94,0.5)', 3.2, 650, 80);

  const glow = document.createElement('div');
  Object.assign(glow.style, {
    width: '44px', height: '44px', borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(34,197,94,0.6) 0%, transparent 60%)',
    position: 'absolute', top: '-6px', left: '-6px',
  });
  c.appendChild(glow);
  glow.animate(
    [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.8)', opacity: 0 }],
    { duration: 400, easing: 'cubic-bezier(0,0,0.2,1)', fill: 'forwards' },
  );
  setTimeout(() => c.remove(), 800);
}

function bounceSlot(slotId: string) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.animate([
    { transform: 'scale(1)', offset: 0 },
    { transform: 'scale(1.08)', offset: 0.2 },
    { transform: 'scale(0.95)', offset: 0.45 },
    { transform: 'scale(1.03)', offset: 0.7 },
    { transform: 'scale(1)', offset: 1.0 },
  ], { duration: 500, easing: 'cubic-bezier(0.34,1.56,0.64,1)' });
}

export function PartyAutoFill({ onComplete }: PartyAutoFillProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const [phase, setPhase] = useState<'message' | 'flying'>('message');
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  // 飛行開始位置（円軌道上からキャプチャ）
  const [flyFrom, setFlyFrom] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [landedIds, setLandedIds] = useState<Set<string>>(new Set());
  const [modalRect, setModalRect] = useState<DOMRect | null>(null);

  const filledRef = useRef(false);
  const cancelledRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // 円運動用 refs
  const iconElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const orbitStateRef = useRef({ angle: 0, startTime: 0, frameId: 0 });

  // ── マウント: DOM収集 ──
  useEffect(() => {
    cancelledRef.current = false;
    const modal = document.querySelector('[data-tutorial="party-settings"]');
    if (modal) setModalRect(modal.getBoundingClientRect());

    if (prefersReduced) {
      AUTO_FILL_JOBS.forEach(id => {
        (document.querySelector(`[data-job-id="${id}"]`) as HTMLElement)?.click();
      });
      onCompleteRef.current();
      return;
    }

    let attempts = 0;
    function tryCollect() {
      if (cancelledRef.current) return;
      attempts++;
      const emptySlots: { el: Element; slotId: string }[] = [];
      for (let i = 0; i < 8; i++) {
        const slot = document.getElementById(`party-slot-${i}`);
        if (!slot) continue;
        if (!slot.querySelector('img[src*="job"], img[alt]')) {
          emptySlots.push({ el: slot, slotId: `party-slot-${i}` });
        }
      }
      const firstBtn = document.querySelector(`[data-job-id="${AUTO_FILL_JOBS[0]}"]`);
      if ((emptySlots.length === 0 || !firstBtn) && attempts < 30) {
        setTimeout(tryCollect, 50); return;
      }
      if (emptySlots.length === 0 || !firstBtn) { onCompleteRef.current(); return; }

      const collected: JobInfo[] = emptySlots.map(({ el, slotId }, i) => {
        const jobId = AUTO_FILL_JOBS[i % AUTO_FILL_JOBS.length];
        const paletteBtn = document.querySelector(`[data-job-id="${jobId}"]`)!;
        const br = paletteBtn.getBoundingClientRect();
        const sr = el.getBoundingClientRect();
        const img = paletteBtn.querySelector('img');
        return {
          id: `fly-${i}`, jobId, slotId,
          iconSrc: img?.src ?? '',
          btnX: br.left + br.width / 2, btnY: br.top + br.height / 2,
          toX: sr.left + sr.width / 2, toY: sr.top + sr.height / 2,
          seed: SEEDS[i % SEEDS.length],
        };
      });
      if (collected.length === 0) { onCompleteRef.current(); return; }
      setJobs(collected);
    }
    tryCollect();
    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── メッセージフェーズ: 出現 + 円運動（rAF） ──
  useEffect(() => {
    if (phase !== 'message' || jobs.length === 0) return;

    const paletteEl = document.querySelector('[data-tutorial="job-palette"]');
    if (!paletteEl) return;
    const pr = paletteEl.getBoundingClientRect();
    const cx = pr.left + pr.width / 2;
    const cy = pr.top + pr.height / 2;
    const radius = Math.min(pr.width * 0.38, pr.height * 0.42, 66);

    const startTime = performance.now();
    orbitStateRef.current.startTime = startTime;

    // 各アイコンの出現時刻
    const appearTimes = jobs.map((_, i) => APPEAR_START + i * APPEAR_INTERVAL);
    // 全出現後 + 追加回転 → 飛行フェーズへ
    const totalDuration = appearTimes[jobs.length - 1] + ORBIT_EXTRA;

    const flyTimer = setTimeout(() => {
      if (cancelledRef.current) return;
      // 現在位置をキャプチャ
      const positions = new Map<string, { x: number; y: number }>();
      jobs.forEach((job, i) => {
        const el = iconElsRef.current[i];
        if (el) {
          const r = el.getBoundingClientRect();
          positions.set(job.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
        }
      });
      setFlyFrom(positions);
      setPhase('flying');
    }, totalDuration);

    // rAF ループ
    function tick(now: number) {
      if (cancelledRef.current) return;
      const elapsed = now - startTime;

      // 円は常に6スロット（60°等間隔）— アイコンは自分のスロットに合流するだけ
      const totalSlots = jobs.length;
      const angle = elapsed / 1000 * ORBIT_SPEED;

      for (let i = 0; i < jobs.length; i++) {
        const el = iconElsRef.current[i];
        if (!el) continue;
        const timeSinceAppear = elapsed - appearTimes[i];

        if (timeSinceAppear < 0) {
          el.style.opacity = '0';
          el.style.transform = `translate(${jobs[i].btnX - 16}px, ${jobs[i].btnY - 16}px) scale(0)`;
          continue;
        }

        // ── 出現（0-400ms）: easeOutBack でポンッと弾む ──
        const ap = Math.min(timeSinceAppear / 400, 1);
        const c1 = 2.5;
        const scale = ap < 1
          ? 1 + (c1 + 1) * Math.pow(ap - 1, 3) + c1 * Math.pow(ap - 1, 2)
          : 1;
        const opacity = Math.min(timeSinceAppear / 80, 1);

        // ── 円軌道上の固定スロット位置（常に totalSlots 等間隔）──
        const orbitAngle = angle + (2 * Math.PI / totalSlots) * i;
        const targetX = cx + radius * Math.cos(orbitAngle);
        const targetY = cy + radius * Math.sin(orbitAngle)
          + Math.sin(now / 1000 * BOB_SPEED + i * 1.2) * BOB_AMPLITUDE;

        // ── パレット → 円軌道への合流（0-600ms easeOutQuart）──
        const jp = Math.min(timeSinceAppear / 600, 1);
        const joinEased = 1 - Math.pow(1 - jp, 4);
        const x = jobs[i].btnX + (targetX - jobs[i].btnX) * joinEased;
        const y = jobs[i].btnY + (targetY - jobs[i].btnY) * joinEased;

        el.style.opacity = String(opacity);
        el.style.transform = `translate(${x - 16}px, ${y - 16}px) scale(${scale})`;
      }

      orbitStateRef.current.frameId = requestAnimationFrame(tick);
    }

    orbitStateRef.current.frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(orbitStateRef.current.frameId);
      clearTimeout(flyTimer);
    };
  }, [phase, jobs]);

  // ── 着地ハンドラ ──
  const handleLand = useCallback((job: JobInfo) => {
    if (cancelledRef.current) return;
    (document.querySelector(`[data-job-id="${job.jobId}"]`) as HTMLElement)?.click();
    fireLandingEffects(job.toX, job.toY);
    bounceSlot(job.slotId);
    setLandedIds(prev => new Set(prev).add(job.id));
  }, []);

  // ── 全完了検知 ──
  useEffect(() => {
    if (jobs.length > 0 && landedIds.size >= jobs.length && !filledRef.current) {
      filledRef.current = true;
      const timer = setTimeout(() => onCompleteRef.current(), 800);
      return () => clearTimeout(timer);
    }
  }, [landedIds.size, jobs.length]);

  // ── カード位置 ──
  const cardPos = modalRect
    ? { top: modalRect.top + modalRect.height * 0.38, left: modalRect.left + modalRect.width * 0.5 - 120 }
    : { top: window.innerHeight / 2 - 40, left: window.innerWidth / 2 - 120 };

  if (prefersReduced) return null;

  const isFlying = phase === 'flying';

  return (
    <>
      {/* ── メッセージカード ── */}
      <AnimatePresence>
        {!isFlying && (
          <motion.div
            key="auto-fill-message"
            className="fixed z-[10006] pointer-events-none"
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: [0, -4, 0], scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.5, y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
            style={{ top: cardPos.top, left: cardPos.left, maxWidth: 240 }}
          >
            <div className="rounded-xl overflow-hidden shadow-xl bg-app-bg border border-app-text/10">
              <div className="h-[3px] w-full" style={{ backgroundColor: '#22c55e' }} />
              <div className="px-4 pt-3 pb-3">
                <p className="text-[13px] font-bold text-app-text leading-snug">
                  {t('tutorial.main.auto_fill.message')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── メッセージフェーズ: rAF駆動の円運動アイコン ── */}
      {!isFlying && jobs.map((job, i) => (
        <div
          key={`orbit-${job.id}`}
          ref={el => { iconElsRef.current[i] = el; }}
          className="fixed top-0 left-0 z-[10005] pointer-events-none"
          style={{ opacity: 0, transform: `translate(${job.btnX - 16}px, ${job.btnY - 16}px) scale(0)` }}
        >
          <div className="relative">
            <img
              src={job.iconSrc} alt=""
              className="w-8 h-8 rounded-full relative z-10"
              style={{ filter: 'drop-shadow(0 2px 8px rgba(34, 197, 94, 0.5))' }}
            />
            <div
              className="absolute inset-[-4px] rounded-full z-0"
              style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.35) 0%, transparent 70%)' }}
            />
          </div>
        </div>
      ))}

      {/* ── 飛行フェーズ: 軸分離ネスト motion.div ── */}
      {isFlying && jobs.map((job, i) => {
        const hasLanded = landedIds.has(job.id);
        if (hasLanded) return null;

        const from = flyFrom.get(job.id) ?? { x: job.btnX, y: job.btnY };
        const { seed } = job;

        // 滑らかな放物線: y(t) = from + (to-from)*t - 4*h*t*(1-t)
        // 8点サンプリングで折れ線ではなく滑らかなカーブに
        const SAMPLES = 8;
        const yKeys: number[] = [];
        const yTimes: number[] = [];
        for (let k = 0; k <= SAMPLES; k++) {
          const t = k / SAMPLES;
          yTimes.push(t);
          const base = from.y + (job.toY - from.y) * t;
          const arc = -4 * seed.arcHeight * t * (1 - t); // 放物線: 頂点は t=0.5
          yKeys.push(base + arc - 16);
        }

        return (
          <motion.div
            key={job.id}
            className="fixed top-0 left-0 z-[10005] pointer-events-none"
            initial={{ x: from.x - 16 }}
            animate={{ x: job.toX - 16 }}
            transition={{ duration: FLIGHT_DURATION / 1000, delay: i * 0.16, ease: [0.2, 0.9, 0.3, 1] }}
          >
            <motion.div
              initial={{ y: from.y - 16 }}
              animate={{ y: yKeys }}
              transition={{
                duration: FLIGHT_DURATION / 1000, delay: i * 0.16,
                ease: 'linear', times: yTimes,
              }}
              onAnimationComplete={() => handleLand(job)}
            >
              <motion.div
                initial={{ scale: 1, opacity: 1, rotate: 0 }}
                animate={{ scale: [1, seed.flyScale, 1], opacity: 1, rotate: [0, seed.rot, 0] }}
                transition={{
                  duration: FLIGHT_DURATION / 1000, delay: i * 0.16,
                  scale: { ease: [0.34, 1.56, 0.64, 1], times: [0, 0.35, 1] },
                  rotate: { ease: [0.22, 0.68, 0.36, 1] },
                }}
              >
                <div className="relative">
                  <img
                    src={job.iconSrc} alt=""
                    className="w-8 h-8 rounded-full relative z-10"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(34, 197, 94, 0.5))' }}
                  />
                  <div
                    className="absolute inset-[-4px] rounded-full z-0"
                    style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.35) 0%, transparent 70%)' }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        );
      })}
    </>
  );
}
