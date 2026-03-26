import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function CTASection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pinRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const kofiRef = useRef<HTMLDivElement>(null);
  const dotsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 散らばるドットを生成
    const container = dotsContainerRef.current;
    if (!container) return;

    const dots: HTMLDivElement[] = [];
    const count = 30;

    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'absolute rounded-full bg-white pointer-events-none';
      const size = Math.random() * 3 + 1;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      // ランダムに散らばった初期位置
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.opacity = '0';
      container.appendChild(dot);
      dots.push(dot);
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinRef.current,
          start: 'top top',
          end: '+=150%',
          pin: stickyRef.current,
          scrub: 1,
        },
      });

      // Phase 1 (0→0.4): テキストが巨大→適正サイズに縮小
      tl.fromTo(headingRef.current,
        { scale: 5, opacity: 0.1, filter: 'blur(12px)' },
        { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power2.out' },
        0
      );

      // Phase 2 (0.25→0.5): ドットが散在位置から中央へ収束
      dots.forEach((dot) => {
        const startX = (Math.random() - 0.5) * window.innerWidth;
        const startY = (Math.random() - 0.5) * window.innerHeight;

        gsap.set(dot, { x: startX, y: startY });

        tl.to(dot, {
          x: 0,
          y: 0,
          opacity: 0.15 + Math.random() * 0.1,
          duration: 0.35,
          ease: 'power2.inOut',
        }, 0.15 + Math.random() * 0.1);
      });

      // Phase 3 (0.4→0.55): サブテキスト
      tl.fromTo(subRef.current,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.15, ease: 'power3.out' },
        0.4
      );

      // Phase 4 (0.5→0.65): ボタン — バウンス入場
      tl.fromTo(buttonRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.15, ease: 'back.out(2)' },
        0.5
      );

      // Phase 5 (0.6→0.7): Ko-fi
      tl.fromTo(kofiRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.1 },
        0.6
      );

      // ドットが収束後に微振動
      dots.forEach((dot) => {
        tl.to(dot, {
          x: `+=${(Math.random() - 0.5) * 20}`,
          y: `+=${(Math.random() - 0.5) * 20}`,
          opacity: 0.05,
          duration: 0.3,
          ease: 'sine.inOut',
        }, 0.65);
      });
    }, pinRef);

    return () => {
      ctx.revert();
      dots.forEach(dot => dot.remove());
    };
  }, []);

  return (
    <div ref={pinRef} style={{ height: '250vh' }}>
      <div ref={stickyRef} className="h-screen w-full flex items-center justify-center overflow-hidden">
        {/* 収束ドット */}
        <div
          ref={dotsContainerRef}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        />

        <div className="relative flex flex-col items-center text-center px-6" style={{ zIndex: 20 }}>
          <h2
            ref={headingRef}
            className="text-[clamp(36px,8vw,80px)] font-black leading-[1.05] mb-5 opacity-0 will-change-transform"
          >
            {t('portal.cta.heading')}
          </h2>
          <p
            ref={subRef}
            className="text-sm md:text-base text-white/35 mb-10 max-w-md opacity-0"
          >
            {t('portal.cta.sub')}
          </p>
          <button
            ref={buttonRef}
            onClick={() => navigate('/miti')}
            className="group relative px-12 py-4 bg-white text-black rounded-lg text-sm font-black overflow-hidden transition-all duration-300 active:scale-95 opacity-0"
          >
            <span className="relative z-10">{t('portal.cta.button')}</span>
            <div className="absolute inset-0 bg-white/30 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </button>
          <div ref={kofiRef} className="mt-7 text-xs text-white/20 opacity-0">
            ☕{' '}
            <a
              href="https://ko-fi.com/lopoly"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/40 transition-colors"
            >
              {t('portal.cta.kofi')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
