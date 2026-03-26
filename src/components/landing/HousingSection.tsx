import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HousingSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // テキスト行のスタガー表示
      const textLines = textRef.current?.querySelectorAll('.housing-line');
      if (textLines && textLines.length > 0) {
        gsap.fromTo(textLines,
          { x: 40, opacity: 0, filter: 'blur(4px)' },
          {
            x: 0, opacity: 1, filter: 'blur(0px)',
            duration: 1.0, ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
          }
        );
      }

      gsap.fromTo(mockupRef.current,
        { y: 30, opacity: 0, scale: 0.95 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 1.0, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
        }
      );

      // Coming Soonバッジの劇的なパルス
      if (badgeRef.current) {
        gsap.to(badgeRef.current, {
          scale: 1.05,
          opacity: 0.6,
          filter: 'blur(1px)',
          duration: 1.5,
          ease: 'power1.inOut',
          yoyo: true,
          repeat: -1,
        });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen flex items-center py-20 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        <div ref={mockupRef} className="flex-1 relative rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center opacity-0">
          {/* 回転するコニックグラデーションボーダー */}
          <div
            className="absolute inset-0 rounded-2xl p-px overflow-hidden"
            style={{
              background: 'conic-gradient(from var(--border-angle, 0deg), transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
              animation: 'rotateBorder 4s linear infinite',
            }}
          >
            <div className="w-full h-full rounded-2xl bg-black/80 backdrop-blur-sm" />
          </div>
          <style>{`
            @property --border-angle {
              syntax: '<angle>';
              initial-value: 0deg;
              inherits: false;
            }
            @keyframes rotateBorder {
              to { --border-angle: 360deg; }
            }
          `}</style>
          <div className="relative z-10 flex flex-col items-center">
            <div className="text-4xl mb-3">🏠</div>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="w-7 h-7 rounded bg-white/[0.06] border border-white/[0.08]"></div>
              ))}
            </div>
          </div>
        </div>
        <div ref={textRef} className="flex-1">
          <div className="housing-line text-[11px] text-white/40 tracking-[2px] uppercase mb-3 opacity-0">{t('portal.housing.label')}</div>
          <h2 className="housing-line text-[2.5rem] md:text-[4rem] font-black leading-[1.05] mb-4 opacity-0">{t('portal.housing.heading')}</h2>
          <div className="text-sm md:text-base text-white/50 leading-relaxed space-y-1">
            <p className="housing-line opacity-0">{t('portal.housing.desc_1')}</p>
            <p className="housing-line opacity-0">{t('portal.housing.desc_2')}</p>
          </div>
          <div
            ref={badgeRef}
            className="housing-line opacity-0 mt-6 inline-block px-5 py-2.5 border border-white/[0.15] rounded-md text-xs text-white/40 tracking-wider"
          >
            {t('portal.housing.badge')}
          </div>
        </div>
      </div>
    </section>
  );
}
