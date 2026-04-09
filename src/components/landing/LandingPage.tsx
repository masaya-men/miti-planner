import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useThemeStore } from '../../store/useThemeStore';
import { LangToggle } from './LangToggle';
import { LandingFooter } from './LandingFooter';

const GRID_COLS = 6;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── nav link with underline micro-interaction ── */
function NavLink({
  children,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative font-mono text-[11px] tracking-[0.15em] uppercase transition-colors duration-200"
      style={{ color: 'var(--color-lp-text)' }}
    >
      <span className="relative">
        {children}
        <span
          className="absolute left-0 -bottom-0.5 h-px w-0 group-hover:w-full transition-all duration-300 ease-out"
          style={{ backgroundColor: 'var(--color-lp-text)' }}
        />
      </span>
      {badge && (
        <span
          className="ml-1.5 text-[9px] font-mono align-top"
          style={{ color: 'var(--color-lp-text-muted)' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── theme toggle ── */
function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="font-mono text-[11px] tracking-[0.15em] uppercase transition-opacity duration-200 hover:opacity-70"
      style={{ color: 'var(--color-lp-text-muted)' }}
    >
      {theme === 'dark' ? '☀' : '●'}
    </button>
  );
}

/* ── project card with hover reveal ── */
function ProjectCard({
  number,
  title,
  desc,
  onClick,
  badge,
}: {
  number: string;
  title: string;
  desc: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="group relative w-full text-left py-8 border-t transition-colors duration-300"
      style={{ borderColor: 'var(--color-lp-grid)' }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-start gap-6">
        <span
          className="font-mono text-[11px] tracking-wider pt-1 shrink-0"
          style={{ color: 'var(--color-lp-text-muted)' }}
        >
          {number}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3
              className="text-[clamp(24px,3vw,36px)] font-bold tracking-tight leading-tight transition-transform duration-500 group-hover:translate-x-2"
              style={{ color: 'var(--color-lp-text)' }}
            >
              {title}
            </h3>
            {badge && (
              <span
                className="text-[10px] font-mono tracking-wider px-2 py-0.5 border rounded-sm shrink-0"
                style={{
                  borderColor: 'var(--color-lp-text-muted)',
                  color: 'var(--color-lp-text-muted)',
                }}
              >
                {badge}
              </span>
            )}
          </div>
          <p
            className="mt-2 text-sm max-w-md leading-relaxed opacity-0 translate-y-2 group-hover:opacity-70 group-hover:translate-y-0 transition-all duration-400"
            style={{ color: 'var(--color-lp-text-muted)' }}
          >
            {desc}
          </p>
        </div>
        <div className="shrink-0 pt-2 overflow-hidden">
          <span
            className="block text-lg transition-all duration-300 -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
            style={{ color: 'var(--color-lp-text)' }}
          >
            →
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showComingSoon, setShowComingSoon] = useState(false);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -80]);

  // LP用: bodyのoverflow:hiddenを解除してスクロール可能にする
  useEffect(() => {
    document.body.style.overflow = 'auto';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflow = '';
      document.body.style.overflowX = '';
    };
  }, []);

  useEffect(() => {
    document.title = t('app.page_title_landing');
  }, [t]);

  useEffect(() => {
    if (!showComingSoon) return;
    const timer = setTimeout(() => setShowComingSoon(false), 2000);
    return () => clearTimeout(timer);
  }, [showComingSoon]);

  const now = new Date();
  const timeStr = now.toLocaleTimeString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="relative"
      style={{ backgroundColor: 'var(--color-lp-bg)', color: 'var(--color-lp-text)' }}
    >
      {/* ── Grid lines ── */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="h-full max-w-[1200px] mx-auto px-6 flex">
          {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
            <div
              key={i}
              className="h-full border-l"
              style={{
                borderColor: 'var(--color-lp-grid)',
                borderStyle: 'dashed',
                flex: i === GRID_COLS ? '0 0 0px' : '1',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Top bar ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: 'var(--color-lp-bg)', opacity: 0.95 }}
      >
        <motion.span
          className="font-mono text-[11px] tracking-[0.15em] uppercase"
          style={{ color: 'var(--color-lp-text-muted)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          LoPo {timeStr}
        </motion.span>

        <motion.nav
          className="flex items-center gap-4 md:gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <NavLink onClick={() => navigate('/miti')}>
            {t('portal.miti_button')}
          </NavLink>
          <NavLink onClick={() => setShowComingSoon(true)} badge="soon">
            {t('portal.housing_button')}
          </NavLink>
          <ThemeToggle />
          <LangToggle />
        </motion.nav>
      </header>

      {/* ── Hero ── */}
      <motion.section
        className="relative z-10 flex flex-col justify-center min-h-screen px-6 max-w-[1200px] mx-auto"
        style={{ opacity: heroOpacity, y: heroY }}
      >
        <div className="select-none mt-8">
          <div className="overflow-hidden">
            <motion.h1
              className="text-[clamp(72px,18vw,200px)] font-black tracking-[-0.04em] leading-[0.85]"
              initial={{ y: '110%' }}
              animate={{ y: '0%' }}
              transition={{ delay: 0.3, duration: 0.9, ease: EASE_OUT }}
            >
              LoPo
            </motion.h1>
          </div>
        </div>

        <motion.p
          className="mt-6 text-sm tracking-[0.08em]"
          style={{ color: 'var(--color-lp-text-muted)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.8 }}
        >
          FFXIV Tool Portal
        </motion.p>

        <motion.div
          className="absolute bottom-10 left-6 flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.2em] uppercase"
            style={{ color: 'var(--color-lp-text-muted)' }}
          >
            Scroll to explore
          </span>
          <motion.span
            className="inline-block w-4 h-px"
            style={{ backgroundColor: 'var(--color-lp-text-muted)' }}
            animate={{ scaleX: [1, 1.8, 1] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.section>

      {/* ── Projects ── */}
      <section className="relative z-10 px-6 max-w-[1200px] mx-auto pb-24">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.8 }}
        >
          <span
            className="font-mono text-[10px] tracking-[0.2em] uppercase block mb-12"
            style={{ color: 'var(--color-lp-text-muted)' }}
          >
            Tools
          </span>

          <ProjectCard
            number="01"
            title={t('portal.miti_button')}
            desc="FFXIV raid mitigation planner. Drag-and-drop skills onto a timeline, auto-calculate damage, import from FFLogs."
            onClick={() => navigate('/miti')}
          />
          <ProjectCard
            number="02"
            title={t('portal.housing_button')}
            desc="Plan housing tour routes, share with friends, discover community builds."
            onClick={() => setShowComingSoon(true)}
            badge="COMING SOON"
          />

          <div className="border-t" style={{ borderColor: 'var(--color-lp-grid)' }} />
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <LandingFooter />

      {/* ── Coming Soon toast ── */}
      {showComingSoon && (
        <motion.div
          className="fixed bottom-8 left-1/2 z-[10001] px-5 py-2.5 font-mono text-[11px] tracking-wider uppercase border"
          style={{
            backgroundColor: 'var(--color-lp-bg)',
            color: 'var(--color-lp-text)',
            borderColor: 'var(--color-lp-text-muted)',
          }}
          initial={{ opacity: 0, y: 10, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
        >
          {t('portal.housing_coming_soon')}
        </motion.div>
      )}
    </div>
  );
}
