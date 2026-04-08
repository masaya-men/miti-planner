import React from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Users, Eye, Wrench, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useAuthStore } from '../store/useAuthStore';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';
import { SPRING } from '../tokens/motionTokens';

interface MobileBottomNavProps {
    onMenuToggle: () => void;
    onPartyOpen: () => void;
    onToolsOpen: () => void;
    onLoginOpen: () => void;
    myJobHighlight: boolean;
    onMyJobHighlightToggle: () => void;
    activeTab?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onMenuToggle, onPartyOpen, onToolsOpen, onLoginOpen,
    myJobHighlight, onMyJobHighlightToggle, activeTab
}) => {
    const { t } = useTranslation();
    const user = useAuthStore((s) => s.user);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);

    const items = [
        {
            id: 'menu',
            icon: <Menu size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.menu'),
            onClick: onMenuToggle,
            active: activeTab === 'menu',
        },
        {
            id: 'party',
            icon: <Users size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.party'),
            onClick: onPartyOpen,
            active: activeTab === 'party',
        },
        {
            id: 'tools',
            icon: <Wrench size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: t('nav.tools'),
            onClick: onToolsOpen,
            active: activeTab === 'tools',
        },
        {
            id: 'myjob',
            icon: <Eye size={MOBILE_TOKENS.bottomNav.iconSize} />,
            label: 'MY JOB',
            onClick: onMyJobHighlightToggle,
            active: myJobHighlight,
        },
        {
            id: 'login',
            icon: profileAvatarUrl ? (
                <img
                    src={profileAvatarUrl}
                    alt=""
                    className="rounded-full object-cover"
                    style={{ width: MOBILE_TOKENS.bottomNav.iconSize, height: MOBILE_TOKENS.bottomNav.iconSize }}
                />
            ) : (
                <LogIn size={MOBILE_TOKENS.bottomNav.iconSize} />
            ),
            label: user ? t('nav.account') : t('nav.login'),
            onClick: onLoginOpen,
            active: activeTab === 'login',
        },
    ];

    const activeIndex = items.findIndex(item => item.active);

    return (
        <nav
            className={clsx(
                "md:hidden fixed bottom-0 left-0 right-0 z-[400]",
                "flex items-stretch justify-around",
                "backdrop-blur-md",
            )}
            style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                minHeight: MOBILE_TOKENS.bottomNav.height,
                backgroundColor: 'var(--color-nav-bg)',
                borderTop: '0.5px solid var(--color-nav-border)',
            }}
        >
            {/* Sliding indicator */}
            {activeIndex >= 0 && (
                <motion.div
                    className="absolute top-0 h-[2px] rounded-full"
                    style={{
                        width: `${100 / items.length}%`,
                        backgroundColor: items[activeIndex]?.id === 'myjob' ? '#eab308' : 'var(--color-app-text)',
                    }}
                    animate={{ left: `${(100 / items.length) * activeIndex}%` }}
                    transition={SPRING.snappy}
                />
            )}

            {items.map(item => (
                <button
                    key={item.id}
                    onClick={(e) => { e.stopPropagation(); item.onClick(); }}
                    className={clsx(
                        "flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5",
                        "transition-all duration-150 cursor-pointer active:scale-90",
                        "relative",
                        item.active
                            ? (item.id === 'myjob' ? "text-yellow-500" : "text-app-text")
                            : "text-app-text/40"
                    )}
                >
                    <div>{item.icon}</div>
                    <span
                        className={clsx(
                            "tracking-tight leading-none capitalize",
                            item.active ? "font-black" : "font-bold"
                        )}
                        style={{ fontSize: MOBILE_TOKENS.bottomNav.labelSize }}
                    >{item.label}</span>
                </button>
            ))}
        </nav>
    );
};
