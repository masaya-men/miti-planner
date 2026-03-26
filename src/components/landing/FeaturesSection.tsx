import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_KEYS = ['auto_plan', 'fflogs', 'responsive', 'share'] as const;
const FEATURE_ICONS = ['⚡', '📊', '📱', '🔗'];

export function FeaturesSection() {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  // カードの3Dチルト効果
  const handleCardMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = cardsRef.current[index];
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    gsap.to(card, {
      rotateY: x * 10,
      rotateX: -y * 10,
      duration: 0.3,
      ease: 'power2.out',
    });
    // アイコンのスケール+回転
    const icon = card.querySelector('.feature-icon');
    if (icon) {
      gsap.to(icon, { scale: 1.2, rotate: 10, duration: 0.3 });
    }
  }, []);

  const handleCardMouseLeave = useCallback((_e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = cardsRef.current[index];
    if (!card) return;
    gsap.to(card, {
      rotateY: 0, rotateX: 0,
      boxShadow: '0 0 0px rgba(255,255,255,0)',
      duration: 0.5, ease: 'power3.out',
    });
    const icon = card.querySelector('.feature-icon');
    if (icon) {
      gsap.to(icon, { scale: 1, rotate: 0, duration: 0.4 });
    }
  }, []);

  const handleCardMouseEnter = useCallback((_e: React.MouseEvent<HTMLDivElement>, index: number) => {
    const card = cardsRef.current[index];
    if (!card) return;
    gsap.to(card, {
      boxShadow: '0 0 30px rgba(255,255,255,0.08)',
      duration: 0.3,
    });
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(card,
          { y: 60, opacity: 0, filter: 'blur(4px)' },
          {
            y: 0, opacity: 1, filter: 'blur(0px)',
            duration: 0.8, ease: 'power3.out',
            delay: i * 0.15,
            scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
          }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative py-20 px-6 md:px-16 overflow-hidden">
      {/* 背景ウォーターマーク */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[120px] md:text-[180px] font-black text-white opacity-[0.02] tracking-wider">
          FEATURES
        </span>
      </div>
      <div className="relative max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURE_KEYS.map((key, i) => (
          <div
            key={key}
            ref={el => { cardsRef.current[i] = el; }}
            className="glass-tier1 rounded-xl p-5 transition-all duration-300 opacity-0"
            style={{ perspective: '600px', transformStyle: 'preserve-3d' }}
            onMouseMove={(e) => handleCardMouseMove(e, i)}
            onMouseLeave={(e) => handleCardMouseLeave(e, i)}
            onMouseEnter={(e) => handleCardMouseEnter(e, i)}
          >
            <div className="feature-icon text-xl mb-2 inline-block">{FEATURE_ICONS[i]}</div>
            <h3 className="text-sm font-semibold mb-1">{t(`portal.features.${key}.title`)}</h3>
            <p className="text-[11px] text-white/40 leading-relaxed">{t(`portal.features.${key}.desc`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
