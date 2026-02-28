import React from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, Users, Shield, Eye } from 'lucide-react';
import clsx from 'clsx';

interface MobileBottomNavProps {
    onMenuToggle: () => void;
    onPartyOpen: () => void;
    onStatusOpen: () => void;
    myJobHighlight: boolean;
    onMyJobHighlightToggle: () => void;
    isSidebarOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
    onMenuToggle, onPartyOpen, onStatusOpen,
    myJobHighlight, onMyJobHighlightToggle, isSidebarOpen
}) => {
    const { t } = useTranslation();

    const items = [
        {
            id: 'menu',
            icon: <Menu size={18} />,
            label: t('nav.menu', 'メニュー'),
            onClick: onMenuToggle,
            active: isSidebarOpen,
        },
        {
            id: 'party',
            icon: <Users size={18} />,
            label: t('nav.party', 'パーティ'),
            onClick: onPartyOpen,
            active: false,
        },
        {
            id: 'status',
            icon: <Shield size={18} />,
            label: t('nav.status', 'ステータス'),
            onClick: onStatusOpen,
            active: false,
        },
        {
            id: 'myjob',
            icon: <Eye size={18} />,
            label: t('nav.myjob', 'MY JOB'),
            onClick: onMyJobHighlightToggle,
            active: myJobHighlight,
        },
    ];

    return (
        <nav className={clsx(
            "md:hidden fixed bottom-0 left-0 right-0 z-[200]",
            "h-14 flex items-center justify-around",
            "bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl",
            "border-t border-slate-200/50 dark:border-white/10",
            "shadow-[0_-2px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_20px_rgba(0,0,0,0.5)]"
        )}>
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={item.onClick}
                    className={clsx(
                        "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
                        "transition-colors duration-200 cursor-pointer active:scale-95",
                        item.active
                            ? "text-blue-500 dark:text-blue-400"
                            : "text-slate-500 dark:text-slate-400"
                    )}
                >
                    {item.icon}
                    <span className="text-[9px] font-medium tracking-tight">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};
