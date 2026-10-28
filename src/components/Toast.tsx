import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, Info } from 'lucide-react';
import clsx from 'clsx';
import { registerToastHandler } from './toastBus';
import './Toast.css';

interface ToastItem {
    id: number;
    message: string;
    type: 'success' | 'error' | 'info';
}

let toastId = 0;

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        registerToastHandler((message: string, type: 'success' | 'error' | 'info') => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        });
        return () => { registerToastHandler(null); };
    }, []);

    if (toasts.length === 0) return null;

    return createPortal(
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999999] flex flex-col gap-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={clsx(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl float-surface",
                        "animate-toast-in",
                        "pointer-events-auto"
                    )}
                >
                    {toast.type === 'error'
                        ? <XCircle size={15} className="text-app-red shrink-0" />
                        : toast.type === 'info'
                        ? <Info size={15} className="text-app-blue shrink-0" />
                        : <CheckCircle size={15} className="text-emerald-500 shrink-0" />
                    }
                    <span className="text-app-lg font-bold text-app-text whitespace-nowrap">{toast.message}</span>
                </div>
            ))}
        </div>,
        document.body
    );
};
