import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface ToastItem {
    id: number;
    message: string;
}

let toastId = 0;
let addToastFn: ((message: string) => void) | null = null;
const pendingQueue: string[] = [];

/** グローバルにトーストを表示する（Reactマウント前でもキューに溜まる） */
export function showToast(message: string) {
    if (addToastFn) {
        addToastFn(message);
    } else {
        pendingQueue.push(message);
    }
}

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        addToastFn = (message: string) => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, message }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        };
        // マウント前にキューに溜まったトーストを処理
        while (pendingQueue.length > 0) {
            addToastFn(pendingQueue.shift()!);
        }
        return () => { addToastFn = null; };
    }, []);

    if (toasts.length === 0) return null;

    return createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-bg glass-panel shadow-lg",
                        "animate-[toastIn_300ms_cubic-bezier(0.2,0.8,0.2,1)]",
                        "pointer-events-auto"
                    )}
                >
                    <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    <span className="text-[12px] font-bold text-app-text whitespace-nowrap">{toast.message}</span>
                </div>
            ))}
        </div>,
        document.body
    );
};
