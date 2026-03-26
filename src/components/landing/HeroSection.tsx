import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const taglineSubRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 });

      tl.fromTo(labelRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.out' }
      );
      tl.fromTo(logoRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 0.6, ease: 'power3.out' },
        '-=0.3'
      );
      tl.fromTo(taglineRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'power3.out' },
        '-=0.2'
      );
      tl.fromTo(taglineSubRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'power3.out' },
        '-=0.2'
      );
      tl.fromTo(ctaRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
        '-=0.1'
      );
      tl.fromTo(scrollHintRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5 },
        '-=0.2'
      );

      // Parallax on scroll
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: 'bottom top',
        scrub: true,
        onUpdate: (self) => {
          const content = sectionRef.current?.querySelector('.hero-content') as HTMLElement;
          if (content) {
            gsap.set(content, {
              y: -self.progress * 100,
              opacity: 1 - self.progress * 0.8,
            });
          }
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const scrollToNext = () => {
    const next = sectionRef.current?.nextElementSibling;
    if (next) next.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section ref={sectionRef} className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="hero-content relative z-10 flex flex-col items-center text-center px-4">
        <div ref={labelRef} className="text-[11px] text-white/40 tracking-[4px] uppercase mb-3">
          {t('portal.hero.label')}
        </div>
        <div ref={logoRef} className="text-[clamp(48px,12vw,96px)] font-black tracking-tighter leading-none">
          {t('portal.title')}
        </div>
        <div ref={taglineRef} className="text-base md:text-lg text-white/60 mt-4 max-w-md leading-relaxed">
          {t('portal.hero.tagline')}
        </div>
        <div ref={taglineSubRef} className="text-sm text-white/30 mt-1">
          {t('portal.hero.tagline_sub')}
        </div>
        <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 mt-8 opacity-0">
          <button
            onClick={() => navigate('/miti')}
            className="px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:scale-105 transition-transform"
          >
            {t('portal.hero.cta_primary')}
          </button>
          <button
            onClick={scrollToNext}
            className="px-6 py-3 border border-white/20 rounded-lg text-sm text-white/60 hover:border-white/40 transition-colors"
          >
            {t('portal.hero.cta_secondary')} ↓
          </button>
        </div>
      </div>
      <div ref={scrollHintRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-0">
        <div className="text-[10px] text-white/25 tracking-widest">{t('portal.hero.scroll_hint')}</div>
        <div className="w-px h-5 bg-gradient-to-b from-white/25 to-transparent"></div>
      </div>
    </section>
  );
}
