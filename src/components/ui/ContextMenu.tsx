import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

import { useDismissOnOutside } from '../../hooks/useDismissOnOutside';
interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
    divider?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useDismissOnOutside(true, onClose, [menuRef]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // 画面端からはみ出さないよう位置調整
    useEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menuRef.current.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menuRef.current.style.top = `${y - rect.height}px`;
        }
    }, [x, y]);

    return createPortal(
        <div
            ref={menuRef}
            className="fixed z-[100010] min-w-[160px] py-1 rounded-menu float-surface"
            style={{ left: x, top: y }}
        >
            {items.map((item, i) => {
                if (item.divider) {
                    return <div key={i} className="h-px bg-glass-border mx-1 my-0.5" />;
                }
                return (
                    <button
                        key={i}
                        onClick={() => { item.onClick(); onClose(); }}
                        className={clsx(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-app-base font-medium transition-colors cursor-pointer text-left",
                            item.danger
                                ? "text-app-red hover:bg-app-red-dim"
                                : "text-app-text-sec hover:bg-glass-hover hover:text-app-text"
                        )}
                    >
                        {item.icon && <span className="w-4 text-center shrink-0 opacity-70">{item.icon}</span>}
                        {item.label}
                    </button>
                );
            })}
        </div>,
        document.body
    );
};
