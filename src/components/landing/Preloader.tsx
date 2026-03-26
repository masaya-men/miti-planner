import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem('lopo-visited')) {
      onComplete();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        sessionStorage.setItem('lopo-visited', '1');
        onComplete();
      },
    });

    // Phase 1: Progress 0→100
    tl.to({}, {
      duration: 1.5,
      onUpdate: function() {
        setProgress(Math.round(this.progress() * 100));
      },
    });

    // Phase 2: Logo appear
    tl.fromTo(
      logoRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out' },
      1.2
    );

    // Phase 3: Clip-path expand
    tl.to(containerRef.current, {
      clipPath: 'circle(150% at 50% 50%)',
      duration: 0.8,
      ease: 'power2.inOut',
    });

    return () => { tl.kill(); };
  }, [onComplete]);

  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100000] bg-black flex flex-col items-center justify-center"
      style={{ clipPath: 'circle(100% at 50% 50%)' }}
    >
      <svg width="80" height="80" viewBox="0 0 80 80" className="mb-4" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <circle
          cx="40" cy="40" r="36"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="font-mono text-sm text-white/50 mb-6">{progress}%</div>
      <div ref={logoRef} className="opacity-0">
        <div className="text-5xl font-black tracking-tighter text-white">LoPo</div>
        <div className="text-[11px] text-white/30 tracking-[3px] uppercase text-center mt-1">FF14 Tool Portal</div>
      </div>
    </div>
  );
}
