import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import clsx from 'clsx';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

let toastId = 0;
let addToastFn: ((message: string, type: 'success' | 'error' | 'info') => void) | null = null;
const pendingQueue: { message: string; type: 'success' | 'error' | 'info' }[] = [];

/** グローバルにトーストを表示する（Reactマウント前でもキューに溜まる） */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (addToastFn) {
        addToastFn(message, type);
    } else {
        pendingQueue.push({ message, type });
    }
}

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        addToastFn = (message: string, type: 'success' | 'error' | 'info') => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        };
        // マウント前にキューに溜まったトーストを処理
        while (pendingQueue.length > 0) {
            const item = pendingQueue.shift()!;
            addToastFn(item.message, item.type);
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
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl glass-tier3",
                        "animate-[toastIn_300ms_cubic-bezier(0.2,0.8,0.2,1)]",
                        "pointer-events-auto"
                    )}
                >
                    {toast.type === 'error'
                        ? <XCircle size={15} className="text-red-500 shrink-0" />
                        : toast.type === 'info'
                        ? <Info size={15} className="text-blue-400 shrink-0" />
                        : <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    }
                    <span className="text-app-lg font-bold text-app-text whitespace-nowrap">{toast.message}</span>
                </div>
            ))}
        </div>,
        document.body
    );
};
