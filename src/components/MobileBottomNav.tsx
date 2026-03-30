import React from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Users, Eye, Wrench, LogIn } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../store/useAuthStore';

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

    const items = [
        {
            id: 'menu',
            icon: <Menu size={20} />,
            label: t('nav.menu'),
            onClick: onMenuToggle,
            active: activeTab === 'menu',
        },
        {
            id: 'party',
            icon: <Users size={20} />,
            label: t('nav.party'),
            onClick: onPartyOpen,
            active: activeTab === 'party',
        },
        {
            id: 'tools',
            icon: <Wrench size={20} />,
            label: t('nav.tools'),
            onClick: onToolsOpen,
            active: activeTab === 'tools',
        },
        {
            id: 'myjob',
            icon: <Eye size={20} />,
            label: 'MY JOB',
            onClick: onMyJobHighlightToggle,
            active: myJobHighlight,
        },
        {
            id: 'login',
            icon: user?.photoURL ? (
                <img
                    src={user.photoURL}
                    alt=""
                    className="w-5 h-5 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                />
            ) : (
                <LogIn size={20} />
            ),
            label: user ? t('nav.account') : t('nav.login'),
            onClick: onLoginOpen,
            active: activeTab === 'login',
        },
    ];

    return (
        <nav className={clsx(
            "md:hidden fixed bottom-0 left-0 right-0 z-[400]",
            "flex items-stretch justify-around",
            "bg-app-bg/95 backdrop-blur-md",
            "border-t border-app-border",
        )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '3.5rem' }}
        >
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
                    {/* アクティブインジケーター */}
                    {item.active && (
                        <div className={clsx("absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full", item.id === 'myjob' ? "bg-yellow-500" : "bg-app-text")} />
                    )}
                    <div>{item.icon}</div>
                    <span className={clsx(
                        "text-[9px] tracking-tight leading-none",
                        item.active ? "font-black" : "font-bold"
                    )}>{item.label}</span>
                </button>
            ))}
        </nav>
    );
};
