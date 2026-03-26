import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pinRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);
  const taglineRef = useRef<HTMLDivElement>(null);
  const taglineSubRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // マウス追従の3D傾き
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!contentRef.current || window.innerWidth < 768) return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const x = (e.clientX - cx) / cx;
    const y = (e.clientY - cy) / cy;
    gsap.to(contentRef.current, {
      rotateY: x * 4,
      rotateX: -y * 3,
      duration: 0.8,
      ease: 'power2.out',
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const letters = lettersRef.current.filter(Boolean) as HTMLSpanElement[];
      const entryTl = gsap.timeline({ delay: 0.2 });

      // 各文字を3D空間のランダム位置から飛来させる
      letters.forEach((letter, i) => {
        const angle = (i / letters.length) * Math.PI * 2;
        const radius = 400 + Math.random() * 300;
        const randomX = Math.cos(angle) * radius;
        const randomY = Math.sin(angle) * radius * 0.6;
        const randomZ = -600 - Math.random() * 600;

        gsap.set(letter, {
          x: randomX,
          y: randomY,
          z: randomZ,
          rotateX: (Math.random() - 0.5) * 180,
          rotateY: (Math.random() - 0.5) * 180,
          rotateZ: (Math.random() - 0.5) * 90,
          opacity: 0,
          filter: 'blur(12px)',
        });

        entryTl.to(letter, {
          x: 0, y: 0, z: 0,
          rotateX: 0, rotateY: 0, rotateZ: 0,
          opacity: 1,
          filter: 'blur(0px)',
          duration: 1.6,
          ease: 'expo.out',
        }, 0.06 * i);
      });

      // ラベル
      entryTl.fromTo(labelRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 1 },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'power3.out' },
        0.5
      );

      // タグライン
      entryTl.fromTo(taglineRef.current,
        { opacity: 0, y: 30, filter: 'blur(12px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.0, ease: 'power3.out' },
        0.9
      );
      entryTl.fromTo(taglineSubRef.current,
        { opacity: 0, y: 20, filter: 'blur(8px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.8, ease: 'power3.out' },
        1.1
      );

      // CTA
      entryTl.fromTo(ctaRef.current,
        { y: 40, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.7)' },
        1.2
      );

      // スクロールヒント
      entryTl.fromTo(scrollHintRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6 },
        1.4
      );

      const scrollLine = scrollHintRef.current?.querySelector('.scroll-line');
      if (scrollLine) gsap.to(scrollLine, {
        scaleY: 1.5,
        opacity: 0.3,
        duration: 1.2,
        ease: 'power1.inOut',
        yoyo: true,
        repeat: -1,
      });

      // === スクロール駆動: ピン固定 + テキストが球体の中を突き抜けて奥へ ===
      ScrollTrigger.create({
        trigger: pinRef.current,
        start: 'top top',
        end: '+=100%',
        pin: stickyRef.current,
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress;
          if (contentRef.current) {
            gsap.set(contentRef.current, {
              scale: 1 + p * 0.3,
              z: -p * 2000,
              opacity: 1 - p * 1.8,
              filter: `blur(${p * 15}px)`,
            });
          }
          if (scrollHintRef.current) {
            gsap.set(scrollHintRef.current, {
              opacity: Math.max(0, 1 - p * 6),
            });
          }
        },
      });
    }, pinRef);

    return () => ctx.revert();
  }, []);

  const logoText = t('portal.title');
  const logoLetters = logoText.split('');

  return (
    <div ref={pinRef} className="relative" style={{ height: '200vh' }}>
      <div ref={stickyRef} className="h-screen w-full flex items-center justify-center overflow-hidden">
        <div
          ref={contentRef}
          className="relative flex flex-col items-center text-center px-4 mix-blend-difference"
          style={{ perspective: '1200px', transformStyle: 'preserve-3d', zIndex: 20 }}
        >
          {/* ラベル */}
          <div
            ref={labelRef}
            className="text-[10px] md:text-[11px] text-white/40 tracking-[8px] uppercase mb-6 font-mono"
            style={{ clipPath: 'inset(0 100% 0 0)' }}
          >
            {t('portal.hero.label')}
          </div>

          {/* ロゴ — 球体パーティクルの中心に巨大に浮かぶ */}
          <div
            className="text-[clamp(80px,22vw,280px)] font-black tracking-[-0.05em] leading-[0.85]"
            style={{ perspective: '1000px', transformStyle: 'preserve-3d' }}
          >
            {logoLetters.map((letter, i) => (
              <span
                key={i}
                ref={el => { lettersRef.current[i] = el; }}
                className="inline-block opacity-0 will-change-transform"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {letter === ' ' ? '\u00A0' : letter}
              </span>
            ))}
          </div>

          {/* タグライン */}
          <div
            ref={taglineRef}
            className="text-sm md:text-lg text-white/50 mt-8 max-w-md leading-relaxed opacity-0 tracking-wide"
          >
            {t('portal.hero.tagline')}
          </div>
          <div
            ref={taglineSubRef}
            className="text-xs md:text-sm text-white/25 mt-2 opacity-0"
          >
            {t('portal.hero.tagline_sub')}
          </div>

          {/* CTA */}
          <div ref={ctaRef} className="mt-14 opacity-0">
            <button
              onClick={() => navigate('/miti')}
              className="group relative px-12 py-4 rounded-full text-sm font-bold overflow-hidden transition-all duration-300 active:scale-95 border border-white/30 hover:border-white/60"
              style={{ mixBlendMode: 'normal' }}
            >
              <span className="relative z-10">{t('portal.hero.cta_primary')}</span>
              <div className="absolute inset-0 bg-white/10 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-full" />
            </button>
          </div>
        </div>

        {/* スクロールヒント */}
        <div ref={scrollHintRef} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 opacity-0" style={{ zIndex: 20 }}>
          <div className="text-[9px] text-white/15 tracking-[5px] uppercase font-mono">
            {t('portal.hero.scroll_hint')}
          </div>
          <div className="scroll-line w-px h-10 bg-gradient-to-b from-white/20 to-transparent origin-top" />
        </div>
      </div>
    </div>
  );
}
