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
  const textRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  // モックアップの3Dチルト効果
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = mockupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(el, {
      rotateY: x * 8,
      rotateX: -y * 8,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (mockupRef.current) {
      gsap.to(mockupRef.current, {
        rotateY: 0, rotateX: 0,
        duration: 0.6, ease: 'power3.out',
      });
    }
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // テキスト行ごとのスタガー表示
      const textLines = textRef.current?.querySelectorAll('.miti-line');
      if (textLines && textLines.length > 0) {
        gsap.fromTo(textLines,
          { x: -40, opacity: 0, filter: 'blur(4px)' },
          {
            x: 0, opacity: 1, filter: 'blur(0px)',
            duration: 1.0, ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: { trigger: sectionRef.current, start: 'top 70%', toggleActions: 'play none none reverse' },
          }
        );
      }

      // モックアップ
      gsap.fromTo(mockupRef.current,
        { scale: 0.85, opacity: 0.5 },
        {
          scale: 1, opacity: 1,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 60%', end: 'center center', scrub: 1 },
        }
      );

      // 水平ラインアニメーション
      gsap.fromTo(lineRef.current,
        { scaleX: 0 },
        {
          scaleX: 1, duration: 1.2, ease: 'power3.inOut',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="min-h-screen flex items-center py-20 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-center">
        <div ref={textRef} className="flex-1">
          <div className="miti-line text-[11px] text-white/40 tracking-[2px] uppercase mb-3 opacity-0">{t('portal.miti.label')}</div>
          <h2 className="miti-line text-[2.5rem] md:text-[4rem] font-black leading-[1.05] mb-4 opacity-0">{t('portal.miti.heading')}</h2>
          {/* スクロール時にアニメーションする水平ライン */}
          <div
            ref={lineRef}
            className="w-full h-px bg-gradient-to-r from-white/20 via-white/10 to-transparent mb-6 origin-left"
            style={{ transform: 'scaleX(0)' }}
          />
          <div className="text-sm md:text-base text-white/50 leading-relaxed space-y-1">
            <p className="miti-line opacity-0">{t('portal.miti.desc_1')}</p>
            <p className="miti-line opacity-0">{t('portal.miti.desc_2')}</p>
            <p className="miti-line opacity-0">{t('portal.miti.desc_3')}</p>
          </div>
          <button
            onClick={() => navigate('/miti')}
            className="miti-line opacity-0 mt-6 px-6 py-3 bg-white text-black rounded-lg text-sm font-bold hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-all duration-300 active:scale-95"
          >
            {t('portal.hero.cta_primary')}
          </button>
        </div>
        <div
          ref={mockupRef}
          className="flex-[1.2] glass-tier1 rounded-2xl p-3 shadow-2xl"
          style={{ perspective: '800px', transformStyle: 'preserve-3d' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
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
