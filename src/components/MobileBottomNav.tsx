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
                            ? "text-app-text"
                            : "text-app-text/40"
                    )}
                >
                    {/* アクティブインジケーター */}
                    {item.active && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full bg-app-text" />
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
