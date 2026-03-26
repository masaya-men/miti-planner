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
  const lineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.3 });

      // ラベル — クリップアニメーション
      tl.fromTo(labelRef.current,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power3.out' }
      );

      // ロゴ文字 — 各文字ごとにスタガーアニメーション
      const letters = logoRef.current?.querySelectorAll('.hero-letter');
      if (letters && letters.length > 0) {
        tl.fromTo(letters,
          { y: 120, opacity: 0, rotateX: -90 },
          {
            y: 0, opacity: 1, rotateX: 0,
            duration: 1.2, ease: 'expo.out',
            stagger: 0.08,
          },
          '-=0.6'
        );
      }

      // ロゴ下のグラデーションライン
      tl.fromTo(lineRef.current,
        { scaleX: 0 },
        { scaleX: 1, duration: 1.0, ease: 'power3.inOut' },
        '-=0.6'
      );

      // タグライン — ブラーイン
      tl.fromTo(taglineRef.current,
        { opacity: 0, filter: 'blur(10px)', y: 20 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.2, ease: 'power3.out' },
        '-=0.5'
      );
      tl.fromTo(taglineSubRef.current,
        { opacity: 0, filter: 'blur(10px)', y: 15 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1.0, ease: 'power3.out' },
        '-=0.7'
      );

      // CTAボタン
      tl.fromTo(ctaRef.current,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.0, ease: 'back.out(1.7)' },
        '-=0.4'
      );

      // スクロールヒント
      tl.fromTo(scrollHintRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.8 },
        '-=0.3'
      );

      // スクロールヒント矢印バウンスアニメーション
      const arrow = scrollHintRef.current?.querySelector('.scroll-arrow');
      if (arrow) {
        gsap.to(arrow, {
          y: 6, duration: 0.8, ease: 'power1.inOut',
          yoyo: true, repeat: -1,
        });
      }

      // スクロール時のパララックス
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

  // ロゴテキストを個別文字に分解
  const logoText = t('portal.title');
  const logoLetters = logoText.split('');

  return (
    <section ref={sectionRef} className="relative h-screen flex items-center justify-center overflow-hidden">
      <div className="hero-content relative z-10 flex flex-col items-center text-center px-4">
        <div ref={labelRef} className="text-[11px] text-white/40 tracking-[6px] uppercase mb-4">
          {t('portal.hero.label')}
        </div>
        <div ref={logoRef} className="text-[clamp(64px,15vw,180px)] font-black tracking-tighter leading-none overflow-hidden" style={{ perspective: '600px' }}>
          {logoLetters.map((letter, i) => (
            <span
              key={i}
              className="hero-letter inline-block opacity-0"
              style={{ display: 'inline-block' }}
            >
              {letter === ' ' ? '\u00A0' : letter}
            </span>
          ))}
        </div>
        {/* ロゴ下のアニメーションライン */}
        <div
          ref={lineRef}
          className="w-32 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent mt-4 origin-center"
          style={{ transform: 'scaleX(0)' }}
        />
        <div ref={taglineRef} className="text-base md:text-xl text-white/60 mt-6 max-w-lg leading-relaxed opacity-0">
          {t('portal.hero.tagline')}
        </div>
        <div ref={taglineSubRef} className="text-sm text-white/30 mt-2 opacity-0">
          {t('portal.hero.tagline_sub')}
        </div>
        <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 mt-10 opacity-0">
          <button
            onClick={() => navigate('/miti')}
            className="px-8 py-3.5 bg-white text-black rounded-lg text-sm font-bold hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all duration-300 active:scale-95"
          >
            {t('portal.hero.cta_primary')}
          </button>
          <button
            onClick={scrollToNext}
            className="px-8 py-3.5 border border-white/20 rounded-lg text-sm text-white/60 hover:border-white/40 hover:text-white/80 transition-all duration-300"
          >
            {t('portal.hero.cta_secondary')} ↓
          </button>
        </div>
      </div>
      <div ref={scrollHintRef} className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-0">
        <div className="text-[10px] text-white/25 tracking-[3px] uppercase">{t('portal.hero.scroll_hint')}</div>
        <div className="scroll-arrow w-px h-6 bg-gradient-to-b from-white/30 to-transparent"></div>
      </div>
    </section>
  );
}
