import React from 'react';

import { Map, Layers, ChevronRight, Hash } from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
    isOpen: boolean;
}

const DUMMY_FLOORS = [
    { id: 'f1', name: 'AAC Light Heavyweight M1S', shortName: '1層' },
    { id: 'f2', name: 'AAC Light Heavyweight M2S', shortName: '2層' },
    { id: 'f3', name: 'AAC Light Heavyweight M3S', shortName: '3層' },
    { id: 'f4', name: 'AAC Light Heavyweight M4S', shortName: '4層' },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
    // const { t } = useTranslation();
    const activeFloorId = 'f1'; // Hardcoded for now until Firebase integration

    return (
        <aside
            className={clsx(
                "h-full bg-glass-header backdrop-blur-xl border-r border-glass-border flex flex-col transition-all duration-300 overflow-hidden z-40 relative",
                isOpen ? "w-64" : "w-0 border-r-0"
            )}
        >
            <div className="w-64 flex flex-col h-full">
                <div className="p-4 border-b border-glass-border opacity-80 shrink-0">
                    <div className="flex items-center gap-2 text-app-text font-bold text-xs tracking-widest uppercase mb-1">
                        <Map size={14} className="text-app-accent" />
                        <div>Series</div>
                    </div>
                    <div className="text-slate-800 dark:text-white font-medium text-sm truncate pl-6">
                        AAC Light Heavyweight
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <div className="flex items-center gap-2 text-app-text-muted font-bold text-[10px] tracking-widest uppercase mb-2 px-2 mt-2">
                        <Layers size={12} />
                        <div>Floors</div>
                    </div>

                    {DUMMY_FLOORS.map((floor) => {
                        const isActive = floor.id === activeFloorId;
                        return (
                            <button
                                key={floor.id}
                                className={clsx(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-left group relative overflow-hidden active:scale-[0.98]",
                                    isActive
                                        ? "bg-app-accent-dim border border-app-border-accent text-app-accent shadow-[inset_0_1px_0_var(--color-border-accent)]"
                                        : "bg-transparent border border-transparent text-app-text-muted hover:bg-glass-hover hover:text-app-text"
                                )}
                            >
                                <div className={clsx(
                                    "w-6 h-6 rounded flex items-center justify-center font-black text-xs transition-colors",
                                    isActive ? "bg-app-accent-dim text-app-accent-bold" : "bg-glass-card text-app-text-muted group-hover:bg-glass-hover group-hover:text-app-text"
                                )}>
                                    {floor.shortName.replace('層', '')}
                                </div>
                                <div className="flex-1 truncate text-[13px] font-medium">
                                    {floor.name}
                                </div>
                                {isActive && <ChevronRight size={14} className="text-app-accent/70" />}
                            </button>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-glass-border bg-glass-card">
                    <div className="text-[10px] text-app-text-muted mb-2 font-medium">Coming soon: Cloud sync</div>
                    <button className="w-full py-2 bg-glass-card hover:bg-glass-hover text-app-text rounded text-xs font-bold transition-colors border border-glass-border flex items-center justify-center gap-2">
                        <Hash size={14} />
                        Manage Plans
                    </button>
                </div>
            </div>
        </aside>
    );
};
