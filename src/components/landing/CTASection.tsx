import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function CTASection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const kofiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=120%',
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1,
        },
      });

      tl.fromTo(headingRef.current,
        { scale: 4, opacity: 0, filter: 'blur(12px)' },
        { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' }, 0);
      tl.fromTo(subRef.current,
        { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.15 }, 0.4);
      tl.fromTo(buttonRef.current,
        { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.15, ease: 'back.out(2)' }, 0.5);
      tl.fromTo(kofiRef.current,
        { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.1 }, 0.6);
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="h-screen w-full flex items-center justify-center overflow-hidden relative">
      <div className="relative flex flex-col items-center text-center px-6" style={{ zIndex: 20 }}>
        <h2 ref={headingRef} className="text-[clamp(36px,8vw,80px)] font-black leading-[1.05] mb-5 opacity-0 will-change-transform">
          {t('portal.cta.heading')}</h2>
        <p ref={subRef} className="text-sm md:text-base text-white/35 mb-10 max-w-md opacity-0">
          {t('portal.cta.sub')}</p>
        <button ref={buttonRef} onClick={() => navigate('/miti')}
          className="group relative px-12 py-4 bg-white text-black rounded-lg text-sm font-black overflow-hidden transition-all duration-300 active:scale-95 opacity-0">
          <span className="relative z-10">{t('portal.cta.button')}</span>
          <div className="absolute inset-0 bg-white/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
        </button>
        <div ref={kofiRef} className="mt-7 text-xs text-white/20 opacity-0">
          ☕ <a href="https://ko-fi.com/lopoly" target="_blank" rel="noopener noreferrer"
            className="underline hover:text-white/40 transition-colors">{t('portal.cta.kofi')}</a>
        </div>
      </div>
    </section>
  );
}
