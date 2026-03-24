import React from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Users, Shield, Eye, Wrench } from 'lucide-react';
import clsx from 'clsx';

interface MobileBottomNavProps {
    onMenuToggle: () => void;
    onPartyOpen: () => void;
    onStatusOpen: () => void;
    onToolsOpen: () => void;
    myJobHighlight: boolean;
    onMyJobHighlightToggle: () => void;
    activeTab?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onMenuToggle, onPartyOpen, onStatusOpen, onToolsOpen,
    myJobHighlight, onMyJobHighlightToggle, activeTab
}) => {
    const { t } = useTranslation();

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
            id: 'status',
            icon: <Shield size={20} />,
            label: t('nav.status'),
            onClick: onStatusOpen,
            active: activeTab === 'status',
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
    ];

    return (
        <nav className={clsx(
            "md:hidden fixed bottom-0 left-0 right-0 z-[400]",
            "flex items-stretch justify-around",
            "bg-app-bg",
            "border-t border-app-border",
            "shadow-[0_-4px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_-4px_30px_rgba(0,0,0,0.6)]",
        )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '4rem' }}
        >
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={(e) => { e.stopPropagation(); item.onClick(); }}
                    className={clsx(
                        "flex flex-col items-center justify-center gap-0.5 flex-1",
                        "transition-all duration-200 cursor-pointer active:scale-90",
                        "relative",
                        item.active
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-app-text"
                    )}
                >
                    {/* Active indicator dot */}
                    {item.active && (
                        <div className="absolute top-1 w-1 h-1 rounded-full bg-app-primary dark:bg-app-primary-dark" />
                    )}
                    <div className="mt-1">{item.icon}</div>
                    <span className="text-[9px] font-black tracking-tight leading-none">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};
