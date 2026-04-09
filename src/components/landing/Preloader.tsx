import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';

interface PreloaderProps {
  onComplete: () => void;
  sceneReady: boolean;
}

export function Preloader({ onComplete, sceneReady }: PreloaderProps) {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const topHalfRef = useRef<HTMLDivElement>(null);
  const bottomHalfRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneReadyRef = useRef(sceneReady);
  const phase1TweenRef = useRef<gsap.core.Tween | null>(null);
  const completedRef = useRef(false);

  // sceneReady を ref に同期（コールバック内から参照するため）
  sceneReadyRef.current = sceneReady;

  useEffect(() => {
    const hasVisited = !!sessionStorage.getItem('lopo-visited');

    // 訪問済み: アニメーションをスキップするが sceneReady を待つ
    if (hasVisited) {
      if (sceneReady) {
        sessionStorage.setItem('lopo-visited', '1');
        onComplete();
      }
      return;
    }

    // フェーズ2以降を実行する関数（sceneReady後に呼ばれる）
    const runPhase2 = () => {
      if (completedRef.current) return;
      completedRef.current = true;

      const tl = gsap.timeline({
        onComplete: () => {
          sessionStorage.setItem('lopo-visited', '1');
          onComplete();
        },
      });

      // カウンターを 100 に確定
      tl.to({}, {
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: function () {
          setProgress(80 + Math.round(this.progress() * 20));
        },
        onStart: function () {
          // バーを 100% に
          if (barRef.current) {
            gsap.to(barRef.current, { scaleX: 1, duration: 0.3, ease: 'power2.out' });
          }
        },
      });

      // ロゴ出現（マスクリビール — 下から上へ）
      tl.fromTo(
        logoRef.current,
        { clipPath: 'inset(100% 0 0 0)', opacity: 1 },
        { clipPath: 'inset(0% 0 0 0)', duration: 0.7, ease: 'power3.out' },
        '-=0.1'
      );

      // カウンター + バー フェードアウト
      tl.to([counterRef.current, barRef.current?.parentElement], {
        opacity: 0,
        duration: 0.3,
      });

      // 上下スプリットオープン
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

      // ロゴも一緒にフェードアウト
      tl.to(logoRef.current, {
        opacity: 0,
        scale: 1.08,
        duration: 0.5,
        ease: 'power2.in',
      }, '-=0.6');
    };

    // フェーズ1: カウンター 0→80（sceneReadyを待つ）
    const obj = { val: 0 };
    phase1TweenRef.current = gsap.to(obj, {
      val: 80,
      duration: 2.0,
      ease: 'power1.in',
      onUpdate: () => {
        const v = Math.round(obj.val);
        setProgress(v);
        if (barRef.current) {
          barRef.current.style.transform = `scaleX(${v / 100})`;
        }
      },
      onComplete: () => {
        // 80まで到達後、sceneReadyを確認
        if (sceneReadyRef.current) {
          runPhase2();
        } else {
          // sceneReady を待つ（ポーリング）
          const check = () => {
            if (sceneReadyRef.current) {
              runPhase2();
            } else {
              requestAnimationFrame(check);
            }
          };
          requestAnimationFrame(check);
        }
      },
    });

    return () => {
      phase1TweenRef.current?.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 訪問済みチェック後に sceneReady が変わった場合のハンドリング
  useEffect(() => {
    const hasVisited = !!sessionStorage.getItem('lopo-visited');
    if (hasVisited && sceneReady && !completedRef.current) {
      completedRef.current = true;
      sessionStorage.setItem('lopo-visited', '1');
      onComplete();
    }
  }, [sceneReady, onComplete]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100000] flex items-center justify-center pointer-events-none"
    >
      {/* 上半分 */}
      <div
        ref={topHalfRef}
        className="absolute top-0 left-0 right-0 h-1/2"
        style={{ backgroundColor: 'var(--color-lp-bg)' }}
      />
      {/* 下半分 */}
      <div
        ref={bottomHalfRef}
        className="absolute bottom-0 left-0 right-0 h-1/2"
        style={{ backgroundColor: 'var(--color-lp-bg)' }}
      />

      {/* 中央コンテンツ */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-xs px-6">
        {/* カウンター */}
        <div ref={counterRef} className="mb-6 w-full">
          <div
            className="font-mono text-[clamp(48px,12vw,96px)] font-extralight tabular-nums leading-none text-right"
            style={{ color: 'var(--color-lp-text)', opacity: 0.85 }}
          >
            {String(progress).padStart(3, '0')}
          </div>

          {/* ローディングバー（シアン→アンバーグラデーション） */}
          <div
            className="mt-3 w-full h-px overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <div
              ref={barRef}
              className="h-full origin-left"
              style={{
                background: 'linear-gradient(to right, var(--color-portal-cyan), var(--color-portal-amber))',
                transform: 'scaleX(0)',
              }}
            />
          </div>
        </div>

        {/* ロゴ — マスクリビール */}
        <div ref={logoRef} style={{ opacity: 1, clipPath: 'inset(100% 0 0 0)' }}>
          <div
            className="text-[clamp(56px,14vw,120px)] font-black tracking-tighter leading-none"
            style={{ color: 'var(--color-lp-text)' }}
          >
            LoPo
          </div>
        </div>
      </div>
    </div>
  );
}
