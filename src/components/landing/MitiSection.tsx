import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function MitiSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(textRef.current,
        { x: -60, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
        }
      );
      gsap.fromTo(mockupRef.current,
        { scale: 0.85, opacity: 0.5 },
        {
          scale: 1, opacity: 1,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 60%', end: 'center center', scrub: 1 },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen flex items-center py-20 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        <div ref={textRef} className="flex-1 opacity-0">
          <div className="text-[11px] text-white/40 tracking-[2px] uppercase mb-3">{t('portal.miti.label')}</div>
          <h2 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{t('portal.miti.heading')}</h2>
          <div className="text-sm md:text-base text-white/50 leading-relaxed space-y-1">
            <p>{t('portal.miti.desc_1')}</p>
            <p>{t('portal.miti.desc_2')}</p>
            <p>{t('portal.miti.desc_3')}</p>
          </div>
          <button onClick={() => navigate('/miti')} className="mt-6 px-5 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:scale-105 transition-transform">
            {t('portal.hero.cta_primary')}
          </button>
        </div>
        <div ref={mockupRef} className="flex-[1.2] glass-tier1 rounded-2xl p-3 shadow-2xl">
          <div className="bg-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-white/20"></div>
              <div className="text-[10px] text-white/40">LoPo — M9S</div>
            </div>
            {[
              { time: '0:10', name: 'Cross Tail Switch' },
              { time: '0:25', name: 'Quadruple Crossing' },
              { time: '0:42', name: 'Arcane Revelation' },
              { time: '1:05', name: 'Raining Swords' },
            ].map((row) => (
              <div key={row.time} className="flex items-center gap-2 py-1.5 border-t border-white/5">
                <div className="text-[9px] text-white/30 w-8 font-mono">{row.time}</div>
                <div className="text-[10px] text-white/50 flex-1">{row.name}</div>
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded bg-white/[0.06] border border-white/[0.08]"></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
