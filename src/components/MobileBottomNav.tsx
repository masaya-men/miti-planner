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
            label: t('nav.menu', 'メニュー'),
            onClick: onMenuToggle,
            active: activeTab === 'menu',
        },
        {
            id: 'party',
            icon: <Users size={20} />,
            label: t('nav.party', 'パーティ'),
            onClick: onPartyOpen,
            active: false,
            tutorialId: 'party-comp',
        },
        {
            id: 'status',
            icon: <Shield size={20} />,
            label: t('nav.status', 'ステータス'),
            onClick: onStatusOpen,
            active: false,
        },
        {
            id: 'tools',
            icon: <Wrench size={20} />,
            label: t('nav.tools', 'ツール'),
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
            "md:hidden fixed bottom-0 left-0 right-0 z-[200]",
            "flex items-stretch justify-around",
            "bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl",
            "border-t border-slate-200/50 dark:border-white/10",
            "shadow-[0_-4px_30px_rgba(0,0,0,0.15)] dark:shadow-[0_-4px_30px_rgba(0,0,0,0.6)]",
        )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)', minHeight: '4rem' }}
        >
            {items.map(item => (
                <button
                    key={item.id}
                    data-tutorial={(item as any).tutorialId}
                    onClick={(e) => { e.stopPropagation(); item.onClick(); }}
                    className={clsx(
                        "flex flex-col items-center justify-center gap-0.5 flex-1",
                        "transition-all duration-200 cursor-pointer active:scale-90",
                        "relative",
                        item.active
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-slate-400 dark:text-slate-500"
                    )}
                >
                    {/* Active indicator dot */}
                    {item.active && (
                        <div className="absolute top-1 w-1 h-1 rounded-full bg-blue-500 dark:bg-blue-400" />
                    )}
                    <div className="mt-1">{item.icon}</div>
                    <span className="text-[9px] font-semibold tracking-tight leading-none">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};
