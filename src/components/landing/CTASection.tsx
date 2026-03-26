import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// アニメーションドットパーティクル
function AnimatedDots() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const dots: HTMLDivElement[] = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const dot = document.createElement('div');
      dot.className = 'absolute rounded-full bg-white/[0.06] pointer-events-none';
      const size = Math.random() * 4 + 2;
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      container.appendChild(dot);
      dots.push(dot);

      gsap.to(dot, {
        y: `${(Math.random() - 0.5) * 60}`,
        x: `${(Math.random() - 0.5) * 40}`,
        opacity: Math.random() * 0.1 + 0.02,
        duration: Math.random() * 4 + 3,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2,
      });
    }

    return () => {
      dots.forEach(dot => dot.remove());
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" />;
}

export function CTASection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(headingRef.current,
        { y: 40, opacity: 0, filter: 'blur(6px)' },
        {
          y: 0, opacity: 1, filter: 'blur(0px)',
          duration: 1.2, ease: 'power3.out',
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none reverse' },
        }
      );
      gsap.fromTo(subRef.current,
        { y: 20, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 1.0, ease: 'power3.out', delay: 0.2,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none reverse' },
        }
      );
      gsap.fromTo(buttonRef.current,
        { y: 30, opacity: 0, scale: 0.9 },
        {
          y: 0, opacity: 1, scale: 1,
          duration: 1.0, ease: 'back.out(1.7)', delay: 0.4,
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%', toggleActions: 'play none none reverse' },
        }
      );
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-32 px-6 flex flex-col items-center text-center overflow-hidden">
      <AnimatedDots />
      <h2
        ref={headingRef}
        className="relative z-10 text-[3rem] md:text-[5rem] font-black leading-[1.05] mb-4 opacity-0"
      >
        {t('portal.cta.heading')}
      </h2>
      <p ref={subRef} className="relative z-10 text-sm text-white/40 mb-10 opacity-0">{t('portal.cta.sub')}</p>
      <button
        ref={buttonRef}
        onClick={() => navigate('/miti')}
        className="relative z-10 px-10 py-4 bg-white text-black rounded-lg text-sm font-black hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-95 transition-all duration-300 opacity-0"
      >
        {t('portal.cta.button')}
      </button>
      <div className="relative z-10 mt-6 text-xs text-white/25">
        ☕ <a href="https://ko-fi.com/lopoly" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition-colors">
          {t('portal.cta.kofi')}
        </a>
      </div>
    </section>
  );
}
