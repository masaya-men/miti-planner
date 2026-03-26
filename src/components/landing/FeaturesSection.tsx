import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_KEYS = ['auto_plan', 'fflogs', 'responsive', 'share'] as const;

// 各フィーチャーの固有配置パターン（非対称・予測不可能）
const PLACEMENTS = [
  { align: 'text-left', offset: 'ml-0 md:ml-[5vw]' },
  { align: 'text-right', offset: 'ml-auto mr-0 md:mr-[8vw]' },
  { align: 'text-left', offset: 'ml-0 md:ml-[15vw]' },
  { align: 'text-right', offset: 'ml-auto mr-0 md:mr-[3vw]' },
];

export function FeaturesSection() {
  const { t } = useTranslation();
  const pinRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);
  const counterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: 'top top',
          end: '+=250%',
          pin: stickyRef.current,
          scrub: 1,
        },
      });

      // 各フィーチャーが順番に出現→消滅（画面上に同時に1つだけ）
      rowsRef.current.forEach((row, i) => {
        if (!row) return;
        const start = i * 0.22;
        const titleEl = row.querySelector('.feat-title');
        const descEl = row.querySelector('.feat-desc');
        const numEl = row.querySelector('.feat-num');

        // 番号: スケールイン
        if (numEl) {
          tl.fromTo(numEl,
            { scale: 3, opacity: 0, filter: 'blur(8px)' },
            { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.08, ease: 'power3.out' },
            start
          );
        }

        // タイトル: clip-pathワイプ（左or右から）
        if (titleEl) {
          const fromRight = i % 2 === 1;
          tl.fromTo(titleEl,
            { clipPath: fromRight ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', opacity: 1 },
            { clipPath: 'inset(0 0% 0 0%)', duration: 0.1, ease: 'power3.out' },
            start + 0.02
          );
        }

        // 説明: フェードイン
        if (descEl) {
          tl.fromTo(descEl,
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.06 },
            start + 0.06
          );
        }

        // 消滅
        if (i < 3) {
          tl.to(row, {
            opacity: 0,
            y: -30,
            duration: 0.06,
            ease: 'power2.in',
          }, start + 0.18);
        }
      });

      // カウンター更新
      if (counterRef.current) {
        tl.to(counterRef.current, {
          innerText: '04',
          snap: { innerText: 1 },
          duration: 0.88,
        }, 0);
      }

      // 最後のフィーチャーもフェードアウト
      const lastRow = rowsRef.current[3];
      if (lastRow) {
        tl.to(lastRow, {
          opacity: 0, y: -30,
          duration: 0.08,
        }, 0.88);
      }
    }, pinRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={pinRef} style={{ height: '350vh' }}>
      <div ref={stickyRef} className="h-screen w-full flex items-center overflow-hidden">
        <div className="relative w-full px-6 md:px-16" style={{ zIndex: 20 }}>

          {/* 固定カウンター — 右下 */}
          <div className="absolute bottom-8 right-6 md:right-16 text-[10px] text-white/15 font-mono tracking-widest">
            <span ref={counterRef} className="tabular-nums">01</span>
            <span className="text-white/[0.06]"> / 04</span>
          </div>

          {/* 各フィーチャー — スタガードタイポグラフィ */}
          {FEATURE_KEYS.map((key, i) => (
            <div
              key={key}
              ref={el => { rowsRef.current[i] = el; }}
              className={`absolute inset-x-6 md:inset-x-16 top-1/2 -translate-y-1/2 opacity-0 ${PLACEMENTS[i].align}`}
            >
              <div className={`max-w-2xl ${PLACEMENTS[i].offset}`}>
                {/* 番号 */}
                <div className="feat-num text-[clamp(60px,10vw,120px)] font-black text-white/[0.04] leading-none mb-2 select-none opacity-0">
                  {String(i + 1).padStart(2, '0')}
                </div>
                {/* タイトル — 巨大 */}
                <h3
                  className="feat-title text-[clamp(28px,5vw,56px)] font-black leading-[1.1] mb-3"
                  style={{ clipPath: 'inset(0 100% 0 0)' }}
                >
                  {t(`portal.features.${key}.title`)}
                </h3>
                {/* 説明 */}
                <p className="feat-desc text-sm md:text-base text-white/30 leading-relaxed max-w-sm opacity-0">
                  {t(`portal.features.${key}.desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
