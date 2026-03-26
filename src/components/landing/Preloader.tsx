import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const topHalfRef = useRef<HTMLDivElement>(null);
  const bottomHalfRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const lineLeftRef = useRef<HTMLDivElement>(null);
  const lineRightRef = useRef<HTMLDivElement>(null);

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

    // Phase 1: カウンター 0→100（加速感あり）
    tl.to({}, {
      duration: 2.0,
      ease: 'power2.in',
      onUpdate: function () {
        setProgress(Math.round(this.progress() * 100));
      },
    });

    // Phase 2: ロゴ出現（マスクリビール — 下から上へ）
    tl.fromTo(
      logoRef.current,
      { clipPath: 'inset(100% 0 0 0)', opacity: 1 },
      { clipPath: 'inset(0% 0 0 0)', duration: 0.8, ease: 'power3.out' },
      '-=0.3'
    );

    // Phase 3: 水平ラインが中央から左右に伸びる
    tl.fromTo(
      [lineLeftRef.current, lineRightRef.current],
      { scaleX: 0 },
      { scaleX: 1, duration: 0.6, ease: 'power3.inOut' },
      '-=0.2'
    );

    // Phase 4: カウンターとラインをフェードアウト
    tl.to([counterRef.current, lineLeftRef.current, lineRightRef.current], {
      opacity: 0,
      duration: 0.3,
    });

    // Phase 5: 上下スプリットオープン（カーテンが開く演出）
    tl.to(topHalfRef.current, {
      yPercent: -100,
      duration: 0.9,
      ease: 'power4.inOut',
    });
    tl.to(bottomHalfRef.current, {
      yPercent: 100,
      duration: 0.9,
      ease: 'power4.inOut',
    }, '<');

    // ロゴも一緒にフェード
    tl.to(logoRef.current, {
      opacity: 0,
      scale: 1.1,
      duration: 0.5,
      ease: 'power2.in',
    }, '-=0.6');

    return () => { tl.kill(); };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none"
    >
      {/* 上半分 */}
      <div
        ref={topHalfRef}
        className="absolute top-0 left-0 right-0 h-1/2 bg-black"
      />
      {/* 下半分 */}
      <div
        ref={bottomHalfRef}
        className="absolute bottom-0 left-0 right-0 h-1/2 bg-black"
      />

      {/* 中央コンテンツ */}
      <div className="relative z-10 flex flex-col items-center">
        {/* カウンター — 大きなモノスペース数字 */}
        <div ref={counterRef} className="mb-8">
          <div className="font-mono text-[clamp(48px,12vw,120px)] font-extralight text-white/80 tabular-nums leading-none">
            {String(progress).padStart(3, '0')}
          </div>
        </div>

        {/* ロゴ — マスクリビール */}
        <div ref={logoRef} className="opacity-0">
          <div className="text-[clamp(56px,14vw,140px)] font-black tracking-tighter text-white leading-none">
            LoPo
          </div>
        </div>

        {/* 水平ライン（左右に伸びる） */}
        <div className="flex items-center gap-0 mt-6 w-[60vw] max-w-[400px]">
          <div
            ref={lineLeftRef}
            className="flex-1 h-px bg-gradient-to-l from-white/40 to-transparent origin-right"
            style={{ transform: 'scaleX(0)' }}
          />
          <div className="w-1 h-1 rounded-full bg-white/60 mx-1" />
          <div
            ref={lineRightRef}
            className="flex-1 h-px bg-gradient-to-r from-white/40 to-transparent origin-left"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>
      </div>
    </div>
  );
}
