import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LangToggle } from './LangToggle';
import { LandingFooter } from './LandingFooter';

const LOGO_LETTERS = ['L', 'o', 'P', 'o'];

function PortalCard({
  label,
  accentVar,
  glowVar,
  onClick,
  badge,
}: {
  label: string;
  accentVar: string;
  glowVar: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="group relative w-full max-w-xs px-8 py-10 rounded-2xl border text-left transition-colors duration-300 overflow-hidden"
      style={{
        borderColor: `var(${accentVar})`,
        color: `var(${accentVar})`,
      }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at center, var(${glowVar}), transparent 70%)`,
        }}
      />
      <div className="relative z-10">
        <span className="text-2xl font-bold tracking-wide">{label}</span>
        {badge && (
          <span
            className="ml-3 text-xs font-medium px-2 py-0.5 rounded-full border"
            style={{ borderColor: `var(${accentVar})`, opacity: 0.6 }}
          >
            {badge}
          </span>
        )}
      </div>
      {/* Arrow */}
      <div
        className="relative z-10 mt-4 flex items-center gap-1 text-sm opacity-0 group-hover:opacity-60 transition-opacity duration-300"
        style={{ color: `var(${accentVar})` }}
      >
        <span
          className="h-px w-6 transition-all duration-300 group-hover:w-10"
          style={{ backgroundColor: `var(${accentVar})` }}
        />
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 6h10M7 2l4 4-4 4" />
        </svg>
      </div>
    </motion.button>
  );
}

export function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    document.title = t('app.page_title_landing');
  }, [t]);

  useEffect(() => {
    if (!showComingSoon) return;
    const timer = setTimeout(() => setShowComingSoon(false), 2000);
    return () => clearTimeout(timer);
  }, [showComingSoon]);

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: 'var(--color-lp-bg)', color: 'var(--color-lp-text)' }}
    >
      <LangToggle />

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        {/* Logo */}
        <div className="flex items-baseline select-none mb-2">
          {LOGO_LETTERS.map((letter, i) => (
            <motion.span
              key={i}
              className="text-[clamp(64px,16vw,128px)] font-black tracking-tighter leading-none"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.15 + i * 0.08,
                duration: 0.6,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {letter}
            </motion.span>
          ))}
        </div>

        {/* Tagline */}
        <motion.p
          className="text-sm tracking-[0.25em] uppercase mb-16"
          style={{ color: 'var(--color-lp-text-muted)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
        >
          FFXIV Tool Portal
        </motion.p>

        {/* Portal Cards */}
        <motion.div
          className="flex flex-col sm:flex-row gap-6 items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <PortalCard
            label={t('portal.miti_button')}
            accentVar="--color-portal-cyan"
            glowVar="--color-portal-cyan-dim"
            onClick={() => navigate('/miti')}
          />
          <PortalCard
            label={t('portal.housing_button')}
            accentVar="--color-portal-amber"
            glowVar="--color-portal-amber-dim"
            onClick={() => setShowComingSoon(true)}
            badge={t('portal.housing_coming_soon')}
          />
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <motion.div
            className="w-px h-8"
            style={{ backgroundColor: 'var(--color-lp-text)' }}
            animate={{ scaleY: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Coming Soon toast */}
        {showComingSoon && (
          <motion.div
            className="fixed bottom-12 left-1/2 px-6 py-3 rounded-full text-sm font-medium z-50"
            style={{
              backgroundColor: 'var(--color-portal-amber-dim)',
              color: 'var(--color-portal-amber)',
              border: '1px solid var(--color-portal-amber-glow)',
            }}
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
          >
            {t('portal.housing_coming_soon')}
          </motion.div>
        )}
      </main>

      <LandingFooter />
    </div>
  );
}
