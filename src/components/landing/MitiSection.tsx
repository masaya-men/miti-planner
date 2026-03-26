import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function MitiSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const ctaBtnRef = useRef<HTMLButtonElement>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const el = mockupRef.current;
    if (!el || window.innerWidth < 768) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    gsap.to(el, {
      rotateY: ((e.clientX - cx) / cx) * 5,
      rotateX: -((e.clientY - cy) / cy) * 3,
      duration: 0.6, ease: 'power2.out',
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

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

      tl.fromTo(labelRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.1, ease: 'power3.out' }, 0);
      tl.fromTo(headingRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.12, ease: 'power3.out' }, 0.05);
      tl.fromTo(mockupRef.current,
        { z: -2000, opacity: 0, scale: 0.3 },
        { z: 0, opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }, 0.08);
      tl.fromTo(descRef.current,
        { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.12 }, 0.3);
      tl.fromTo(ctaBtnRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.1 }, 0.38);
      tl.to(sectionRef.current, { opacity: 0, y: -80, duration: 0.2 }, 0.8);
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="h-screen w-full flex items-center overflow-hidden relative">
      <div className="absolute top-[8vh] left-6 md:left-16 z-30 max-w-md" style={{ zIndex: 20 }}>
        <div ref={labelRef} className="text-[10px] md:text-[11px] text-white/30 tracking-[3px] uppercase mb-3 font-mono"
          style={{ clipPath: 'inset(0 100% 0 0)' }}>{t('portal.miti.label')}</div>
        <h2 ref={headingRef} className="text-[clamp(28px,5vw,52px)] font-black leading-[1.05] mb-4"
          style={{ clipPath: 'inset(0 100% 0 0)' }}>{t('portal.miti.heading')}</h2>
        <div ref={descRef} className="text-xs md:text-sm text-white/40 leading-relaxed space-y-1 opacity-0">
          <p>{t('portal.miti.desc_1')}</p>
          <p>{t('portal.miti.desc_2')}</p>
          <p>{t('portal.miti.desc_3')}</p>
        </div>
        <button ref={ctaBtnRef} onClick={() => navigate('/miti')}
          className="mt-5 px-7 py-3 border border-white/20 rounded-full text-xs font-bold hover:border-white/50 transition-all duration-300 active:scale-95"
          style={{ clipPath: 'inset(0 100% 0 0)' }}>{t('portal.hero.cta_primary')}</button>
      </div>
      <div ref={mockupRef} className="absolute inset-x-4 md:inset-x-12 top-[15vh] bottom-[8vh] opacity-0 will-change-transform"
        style={{ perspective: '1200px', transformStyle: 'preserve-3d', zIndex: 10 }}>
        <div className="w-full h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden relative" data-video-placeholder>
          <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.04]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/[0.06]" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/[0.06]" />
            </div>
            <div className="text-[10px] text-white/20 ml-3 font-mono">LoPo — Mitigation Planner</div>
          </div>
          <div className="p-4 md:p-6 space-y-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-20 h-3 rounded bg-white/[0.06]" />
                <div className="w-14 h-3 rounded bg-white/[0.04]" />
              </div>
              <div className="flex gap-2">
                <div className="w-16 h-6 rounded bg-white/[0.04]" />
                <div className="w-16 h-6 rounded bg-white/[0.04]" />
              </div>
            </div>
            {[
              { time: '0:10', name: 'Cross Tail Switch', bars: [3, 2, 4, 1] },
              { time: '0:25', name: 'Quadruple Crossing', bars: [2, 3, 2, 3] },
              { time: '0:42', name: 'Arcane Revelation', bars: [4, 1, 3, 2] },
              { time: '1:05', name: 'Raining Swords', bars: [1, 4, 2, 3] },
              { time: '1:22', name: 'Lethal Orbit', bars: [3, 2, 1, 4] },
              { time: '1:48', name: 'Sunrise Sabbath', bars: [2, 3, 4, 1] },
              { time: '2:10', name: 'Beckon Moonlight', bars: [4, 1, 2, 3] },
              { time: '2:35', name: 'Ion Cluster', bars: [1, 3, 4, 2] },
            ].map((row) => (
              <div key={row.time} className="flex items-center gap-3 py-2 border-t border-white/[0.03]">
                <div className="text-[10px] md:text-[11px] text-white/15 w-10 font-mono shrink-0">{row.time}</div>
                <div className="text-[11px] md:text-xs text-white/25 flex-1 truncate">{row.name}</div>
                <div className="flex gap-1">
                  {row.bars.map((w, j) => (
                    <div key={j} className="h-5 md:h-6 rounded-sm bg-white/[0.03] border border-white/[0.04]"
                      style={{ width: `${w * 12 + 12}px` }} />
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
