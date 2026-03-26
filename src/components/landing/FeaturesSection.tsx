import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(card,
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.5, ease: 'power2.out',
            delay: i * 0.15,
            scrollTrigger: { trigger: sectionRef.current, start: 'top 65%', toggleActions: 'play none none reverse' },
          }
        );
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-6 md:px-16">
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FEATURE_KEYS.map((key, i) => (
          <div
            key={key}
            ref={el => { cardsRef.current[i] = el; }}
            className="glass-tier1 rounded-xl p-5 hover:-translate-y-1 hover:border-white/20 transition-all duration-300 opacity-0"
          >
            <div className="text-xl mb-2">{FEATURE_ICONS[i]}</div>
            <h3 className="text-sm font-semibold mb-1">{t(`portal.features.${key}.title`)}</h3>
            <p className="text-[11px] text-white/40 leading-relaxed">{t(`portal.features.${key}.desc`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
