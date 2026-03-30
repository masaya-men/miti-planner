import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_KEYS = ['auto_plan', 'fflogs', 'responsive', 'share'] as const;

export function FeaturesSection() {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // 各セルを個別にスクロール連動アニメーション
      cellRefs.current.forEach((cell) => {
        if (!cell) return;
        const numEl = cell.querySelector('.feat-num');
        const titleEl = cell.querySelector('.feat-title');
        const descEl = cell.querySelector('.feat-desc');

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: cell,
            start: 'top 85%',
            end: 'top 30%',
            scrub: 1,
          },
        });

        if (numEl) {
          tl.fromTo(numEl,
            { scale: 1.5, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3 }, 0);
        }
        if (titleEl) {
          tl.fromTo(titleEl,
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }, 0.1);
        }
        if (descEl) {
          tl.fromTo(descEl,
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.4 }, 0.2);
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="py-24 md:py-40 px-6 md:px-16">
      <div className="grid grid-cols-1 md:grid-cols-2 border border-white/[0.05]">
        {FEATURE_KEYS.map((key, i) => (
          <div
            key={key}
            ref={el => { cellRefs.current[i] = el; }}
            className={`p-8 md:p-12 lg:p-16
              ${i % 2 === 0 ? 'md:border-r md:border-white/[0.05]' : ''}
              ${i < 2 ? 'border-b border-white/[0.05]' : ''}`}
          >
            <div className="feat-num text-[clamp(60px,8vw,100px)] font-black text-white/[0.03] leading-none mb-2 select-none opacity-0">
              {String(i + 1).padStart(2, '0')}
            </div>
            <h3 className="feat-title text-[clamp(22px,3vw,36px)] font-black leading-[1.1] mb-3 opacity-0">
              {t(`portal.features.${key}.title`)}
            </h3>
            <p className="feat-desc text-sm md:text-base text-white/30 leading-relaxed max-w-sm opacity-0">
              {t(`portal.features.${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
