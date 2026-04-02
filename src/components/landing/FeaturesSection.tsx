import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_KEYS = ['auto_plan', 'fflogs', 'responsive', 'share'] as const;

const PLACEMENTS = [
  { align: 'text-left', offset: 'ml-0 md:ml-[5vw]' },
  { align: 'text-right', offset: 'ml-auto mr-0 md:mr-[8vw]' },
  { align: 'text-left', offset: 'ml-0 md:ml-[15vw]' },
  { align: 'text-right', offset: 'ml-auto mr-0 md:mr-[3vw]' },
];

export function FeaturesSection() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 各フィーチャーを個別にスクロール連動（pinなし）
      rowsRef.current.forEach((row, i) => {
        if (!row) return;
        const titleEl = row.querySelector('.feat-title');
        const descEl = row.querySelector('.feat-desc');
        const numEl = row.querySelector('.feat-num');

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: row,
            start: 'top 80%',
            end: 'top 20%',
            scrub: 1,
          },
        });

        if (numEl) {
          tl.fromTo(numEl,
            { scale: 2, opacity: 0, filter: 'blur(6px)' },
            { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.3 }, 0);
        }
        if (titleEl) {
          const fromRight = i % 2 === 1;
          tl.fromTo(titleEl,
            { clipPath: fromRight ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)', opacity: 1 },
            { clipPath: 'inset(0 0% 0 0%)', duration: 0.5 }, 0.1);
        }
        if (descEl) {
          tl.fromTo(descEl,
            { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.3);
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef}>
      {FEATURE_KEYS.map((key, i) => (
        <div
          key={key}
          ref={el => { rowsRef.current[i] = el; }}
          className={`h-[70vh] flex items-center px-6 md:px-16 ${PLACEMENTS[i].align}`}
        >
          <div className={`max-w-2xl ${PLACEMENTS[i].offset}`}>
            <div className="feat-num text-[clamp(60px,10vw,120px)] font-black text-white/[0.04] leading-none mb-2 select-none opacity-0">
              {String(i + 1).padStart(2, '0')}
            </div>
            <h3
              className="feat-title text-[clamp(28px,5vw,56px)] font-black leading-[1.1] mb-3"
              style={{ clipPath: 'inset(0 100% 0 0)' }}
            >
              {t(`portal.features.${key}.title`)}
            </h3>
            <p className="feat-desc text-app-2xl md:text-app-2xl-plus text-white/30 leading-relaxed max-w-sm opacity-0">
              {t(`portal.features.${key}.desc`)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
