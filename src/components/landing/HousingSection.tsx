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

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(textRef.current,
        { x: 60, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
        }
      );
      gsap.fromTo(mockupRef.current,
        { y: 30, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen flex items-center py-20 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        <div ref={mockupRef} className="flex-1 glass-tier1 rounded-2xl p-6 min-h-[200px] flex flex-col items-center justify-center opacity-0">
          <div className="text-4xl mb-3">🏠</div>
          <div className="grid grid-cols-4 gap-2 mt-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="w-7 h-7 rounded bg-white/[0.06] border border-white/[0.08]"></div>
            ))}
          </div>
        </div>
        <div ref={textRef} className="flex-1 opacity-0">
          <div className="text-[11px] text-white/40 tracking-[2px] uppercase mb-3">{t('portal.housing.label')}</div>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{t('portal.housing.heading')}</h2>
          <div className="text-sm md:text-base text-white/50 leading-relaxed space-y-1">
            <p>{t('portal.housing.desc_1')}</p>
            <p>{t('portal.housing.desc_2')}</p>
          </div>
          <div className="mt-4 inline-block px-4 py-2 border border-white/[0.12] rounded-md text-xs text-white/40 animate-pulse">
            {t('portal.housing.badge')}
          </div>
        </div>
      </div>
    </section>
  );
}
