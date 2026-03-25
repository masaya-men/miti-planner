import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/useThemeStore';
import { useTutorialStore } from '../store/useTutorialStore';
import { useTranslation } from 'react-i18next';
import { motion, type Variants } from 'framer-motion';
import { Sun, Moon, Shield, Home, LogIn, LogOut } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/useAuthStore';
import { LoginModal } from './LoginModal';
import { Tooltip } from './ui/Tooltip';

// ─────────────────────────────────────────────
// Tool Card Definitions
// ─────────────────────────────────────────────
// To add a new tool card:
//   1. Add an entry here
//   2. Add the matching route in App.tsx
//   3. Add i18n keys under "portal.tools.<id>"
// ─────────────────────────────────────────────

interface ToolCardDef {
    /** Unique identifier — used as i18n key suffix */
    id: string;
    /** Route path to navigate to */
    path: string;
    /** Lucide icon component */
    icon: React.ComponentType<{ size?: number; className?: string }>;
    /** Gradient classes for the card accent */
    gradient: string;
    /** Icon glow color */
    glowColor: string;
    /** Whether the tool is available */
    enabled: boolean;
}

const TOOL_CARDS: ToolCardDef[] = [
    {
        id: 'miti_planner',
        path: '/miti',
        icon: Shield,
        gradient: 'from-blue-500/20 to-cyan-500/20',
        glowColor: 'rgba(56, 189, 248, 0.4)',
        enabled: true,
    },
    {
        id: 'housing_tour',
        path: '/housing',
        icon: Home,
        gradient: 'from-amber-500/20 to-orange-500/20',
        glowColor: 'rgba(251, 191, 36, 0.4)',
        enabled: false,
    },
];

// ─────────────────────────────────────────────
// Animation variants (framer-motion)
// ─────────────────────────────────────────────

const containerVariants: Variants = {
    hidden: {},
    visible: {
        transition: { staggerChildren: 0.12, delayChildren: 0.3 },
    },
};

const fadeUpVariants: Variants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.33, 1, 0.68, 1] } },
};

const cardVariants: Variants = {
    hidden: { opacity: 0, y: 32, scale: 0.96 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] } },
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export const PortalPage: React.FC = () => {
    const { theme, setTheme } = useThemeStore();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [showLoginModal, setShowLoginModal] = React.useState(false);
    // ログイン成功時のウェルカム表示はLayout.tsxで一括管理（チラつき防止）

    // Set page title
    useEffect(() => {
        document.title = "LoPo | FF14 軽減プランナー";
    }, []);

    const bgClass = "bg-app-bg";

    // チュートリアル自動起動はトップページでは行わない（/miti でのみ自動起動）

    return (
        <div className={clsx('relative min-h-[100dvh] flex flex-col items-center justify-center overflow-hidden font-sans text-app-text', bgClass)}>

            {/* ── Top-right controls ── */}
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                <Tooltip content={user ? (user.displayName || 'Account') : t('app.sign_in')}>
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="p-2.5 rounded-xl bg-glass-panel border border-glass-border text-app-text hover:bg-glass-hover transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-[18px] h-[18px] rounded-full" referrerPolicy="no-referrer" />
                        ) : user ? (
                            <LogOut size={18} />
                        ) : (
                            <LogIn size={18} />
                        )}
                    </button>
                </Tooltip>
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2.5 rounded-xl bg-glass-panel border border-glass-border text-app-text hover:bg-glass-hover transition-all duration-200 cursor-pointer active:scale-95"
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            {/* ── Main Content ── */}
            <motion.div
                className="relative z-10 flex flex-col items-center px-6 py-12 max-w-3xl w-full"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Logo */}
                <motion.div variants={fadeUpVariants}>
                    <img
                        src="/icons/favicon-192x192.png"
                        alt="LoPo"
                        className="h-20 md:h-24 w-auto object-contain dark:brightness-[1.5] dark:drop-shadow-[0_0_20px_rgba(226,232,240,0.5)] transition-all duration-300 pointer-events-none mb-6"
                    />
                </motion.div>

                {/* Heading */}
                <motion.h1
                    variants={fadeUpVariants}
                    className="text-3xl md:text-4xl font-bold text-center mb-3 bg-gradient-to-r from-app-accent to-app-accent-bold bg-clip-text text-transparent"
                >
                    {t('portal.title', 'FF14 ツールボックス')}
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    variants={fadeUpVariants}
                    className="text-app-text text-center text-sm md:text-base mb-12 max-w-md"
                >
                    {t('portal.subtitle', '軽減プランナーやハウジングツアーなど、冒険をサポートするツール群')}
                </motion.p>

                {/* ── Tool Cards Grid ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {TOOL_CARDS.map((card) => {
                        const Icon = card.icon;
                        return (
                            <motion.button
                                key={card.id}
                                variants={cardVariants}
                                whileHover={card.enabled ? { scale: 1.03, y: -4 } : {}}
                                whileTap={card.enabled ? { scale: 0.98 } : {}}
                                onClick={() => {
                                    if (!card.enabled) return;
                                    // Fire tutorial event if active
                                    const { completeEvent } = useTutorialStore.getState();
                                    completeEvent('portal:tool-selected');
                                    navigate(card.path);
                                }}
                                disabled={!card.enabled}
                                data-tutorial={card.id === 'miti_planner' ? 'portal-miti-card' : undefined}
                                className={clsx(
                                    "group relative flex flex-col items-center p-8 rounded-2xl border transition-all duration-300 text-left overflow-hidden",
                                    "bg-glass-panel border-glass-border",
                                    card.enabled
                                        ? "cursor-pointer hover:border-app-border-accent"
                                        : "cursor-not-allowed opacity-50"
                                )}
                            >
                                {/* Gradient background accent */}
                                <div className={clsx(
                                    "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                                    card.gradient
                                )} />

                                {/* Shine effect on hover */}
                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                                    <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-25deg] group-hover:animate-[shine_0.8s_ease-in-out]" />
                                </div>

                                {/* Icon */}
                                <div
                                    className="relative z-10 w-14 h-14 rounded-xl bg-glass-card border border-glass-border flex items-center justify-center mb-4 transition-all duration-300 group-hover:border-app-border-accent"
                                    style={{ boxShadow: card.enabled ? `0 0 0px ${card.glowColor}` : 'none' }}
                                >
                                    <Icon size={28} className="text-app-accent transition-colors" />
                                </div>

                                {/* Title */}
                                <h2 className="relative z-10 text-lg font-bold text-app-text mb-2 text-center">
                                    {t(`portal.tools.${card.id}.title`, card.id)}
                                </h2>

                                {/* Description */}
                                <p className="relative z-10 text-sm text-app-text text-center leading-relaxed">
                                    {t(`portal.tools.${card.id}.description`, '')}
                                </p>

                                {/* Tool Badge (for Housing Tour) */}
                                {card.id === 'housing_tour' && (
                                    <div className="relative z-10 flex items-center justify-between mt-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                                                <Home size={20} />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-orange-500/80">TOURxiv</span>
                                        </div>
                                    </div>
                                )}

                                {/* Coming Soon badge */}
                                {!card.enabled && (
                                    <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-glass-card border border-glass-border text-app-text-muted">
                                        {t('portal.coming_soon', 'Coming Soon')}
                                    </div>
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </motion.div>

            {/* ── Login Modal ── */}
            <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />

            {/* ── Footer ── */}
            <footer className="absolute bottom-0 left-0 right-0 py-3 text-center z-10">
                <p className="text-[9px] text-app-text-muted tracking-wide">
                    {t('footer.copyright')} · {t('footer.disclaimer')}
                    {' · '}
                    <a href="/privacy" className="underline hover:text-app-text transition-colors">{t('footer.privacy_policy')}</a>
                    {' · '}
                    <a href="/terms" className="underline hover:text-app-text transition-colors">{t('footer.terms')}</a>
                </p>
            </footer>
        </div>
    );
};
