import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HousingSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=150%',
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          scrub: 1,
        },
      });

      tl.fromTo(revealRef.current,
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(85% at 50% 50%)', duration: 0.3, ease: 'power2.out' }, 0);
      tl.fromTo(labelRef.current,
        { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.1 }, 0.12);
      tl.fromTo(headingRef.current,
        { scale: 1.3, opacity: 0, filter: 'blur(10px)' },
        { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.18, ease: 'power3.out' }, 0.15);
      tl.fromTo(descRef.current,
        { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.1 }, 0.28);
      tl.fromTo(visualRef.current,
        { y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: 'power3.out' }, 0.3);
      tl.fromTo(badgeRef.current,
        { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.08, ease: 'back.out(2)' }, 0.45);
      tl.to(sectionRef.current, { opacity: 0, y: -60, duration: 0.2 }, 0.8);
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="h-screen w-full flex items-center justify-center overflow-hidden relative">
      <div ref={revealRef} className="absolute inset-0 bg-white/[0.015]"
        style={{ clipPath: 'circle(0% at 50% 50%)' }} />
      <div className="relative w-full h-full" style={{ zIndex: 20 }}>
        <div className="absolute top-[8vh] left-6 md:left-16 right-6 md:right-16">
          <div ref={labelRef} className="text-[10px] md:text-[11px] text-white/25 tracking-[3px] uppercase mb-3 font-mono opacity-0">
            {t('portal.housing.label')}</div>
          <h2 ref={headingRef} className="text-[clamp(32px,7vw,80px)] font-black leading-[1.0] mb-4 opacity-0">
            {t('portal.housing.heading')}</h2>
          <div ref={descRef} className="flex items-center gap-6 opacity-0">
            <div className="text-sm md:text-base text-white/30 leading-relaxed max-w-md">
              <p>{t('portal.housing.desc_1')}</p>
              <p>{t('portal.housing.desc_2')}</p>
            </div>
            <div ref={badgeRef}
              className="shrink-0 px-5 py-2 border border-white/[0.1] rounded-full text-[10px] text-white/25 tracking-[3px] uppercase font-mono opacity-0">
              {t('portal.housing.badge')}</div>
          </div>
        </div>
        <div ref={visualRef} className="absolute inset-x-6 md:inset-x-12 bottom-[4vh] h-[45vh] md:h-[50vh] opacity-0"
          data-video-placeholder>
          <div className="w-full h-full rounded-2xl border border-white/[0.05] bg-white/[0.015] overflow-hidden relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="grid grid-cols-6 md:grid-cols-8 gap-2 md:gap-3 p-8">
                {[...Array(24)].map((_, i) => (
                  <div key={i} className="w-8 md:w-12 rounded-sm bg-white/[0.03] border border-white/[0.04]"
                    style={{ height: `${40 + Math.sin(i * 0.8) * 20 + Math.cos(i * 1.3) * 10}px` }} />
                ))}
              </div>
            </div>
            <div className="absolute bottom-4 right-4 text-[9px] text-white/10 font-mono tracking-wider">VIDEO PLACEHOLDER</div>
          </div>
        </div>
      </div>
    </section>
  );
}
