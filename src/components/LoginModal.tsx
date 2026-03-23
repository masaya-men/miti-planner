import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { X, LogOut, Shield, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// プロバイダー定義（Discord最上位 — FF14ユーザー向け）
const providers = [
    {
        id: 'discord' as const,
        label: 'Discord',
        bgHover: 'hover:bg-[#5865F2]/10',
        icon: (
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
            </svg>
        ),
    },
    {
        id: 'google' as const,
        label: 'Google',
        bgHover: 'hover:bg-[#4285F4]/10',
        icon: (
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
        ),
    },
    {
        id: 'twitter' as const,
        label: 'X (Twitter)',
        bgHover: 'hover:bg-app-surface2',
        icon: (
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
    },
];

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { user, signInWith, signOut, justLoggedInUser, clearJustLoggedIn } = useAuthStore();

    // 成功画面表示中か
    const isSuccess = !!justLoggedInUser;

    if (!isOpen && !isSuccess) return null;

    const handleSignIn = (providerId: 'google' | 'discord' | 'twitter') => {
        signInWith(providerId);
    };

    const handleCloseSuccess = () => {
        clearJustLoggedIn();
        onClose();
    };

    const handleClose = isSuccess ? handleCloseSuccess : onClose;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className={clsx(
                "relative w-[380px] max-w-[90vw] rounded-2xl bg-app-bg glass-panel",
                "animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]"
            )}>

                {/* ===== ログイン成功画面 ===== */}
                {isSuccess && (
                    <>
                        <div className="flex justify-end px-6 pt-4">
                            <button
                                onClick={handleCloseSuccess}
                                className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="flex flex-col items-center px-6 pb-8 pt-1">
                            {/* アイコン */}
                            {justLoggedInUser.photoURL ? (
                                <img
                                    src={justLoggedInUser.photoURL}
                                    alt=""
                                    className="w-16 h-16 rounded-full ring-2 ring-app-border shadow-lg mb-4"
                                    referrerPolicy="no-referrer"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-app-surface2 flex items-center justify-center ring-2 ring-app-border mb-4">
                                    <span className="text-2xl font-bold text-app-text">
                                        {(justLoggedInUser.displayName || 'U').charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}

                            {/* 成功メッセージ */}
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle size={18} className="text-emerald-500" />
                                <h2
                                    className="text-[18px] text-app-text"
                                    style={{ fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif", fontWeight: 700 }}
                                >
                                    {t('login.success_title')}
                                </h2>
                            </div>

                            <p
                                className="text-[15px] text-app-text"
                                style={{ fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif", fontWeight: 600 }}
                            >
                                {t('login.welcome', { name: justLoggedInUser.displayName || 'User' })}
                            </p>
                        </div>
                    </>
                )}

                {/* ===== 通常画面（未成功時のみ） ===== */}
                {!isSuccess && (
                    <>
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-6 pt-6 pb-2">
                            <h2
                                className="text-[18px] text-app-text tracking-wide"
                                style={{ fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif", fontWeight: 700 }}
                            >
                                {user ? (user.displayName || 'Account') : t('login.title')}
                            </h2>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-app-text-muted hover:text-app-text hover:bg-app-surface2 transition-colors cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* ログイン済み */}
                        {user && (
                            <div className="px-6 pb-6 pt-2">
                                <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-app-surface2/50 border border-app-border">
                                    {user.photoURL && (
                                        <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full shrink-0" referrerPolicy="no-referrer" />
                                    )}
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-bold text-app-text truncate">
                                            {user.displayName || 'User'}
                                        </div>
                                        <div className="text-[11px] text-app-text-muted truncate flex items-center gap-1">
                                            {user.providerData[0]?.providerId === 'google.com' ? 'Google'
                                                : user.providerData[0]?.providerId === 'twitter.com' ? 'X (Twitter)'
                                                    : user.uid.startsWith('discord:') ? 'Discord'
                                                        : user.uid.startsWith('twitter:') ? 'X (Twitter)'
                                                            : (user.providerData[0]?.providerId || '')}
                                            {t('app.sign_in_via')}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => { signOut(); onClose(); }}
                                    className={clsx(
                                        "w-full px-4 py-2.5 rounded-xl text-[12px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
                                        "text-red-400 border border-red-400/30 hover:bg-red-500/10 hover:border-red-400/50"
                                    )}
                                >
                                    <LogOut size={14} />
                                    {t('app.sign_out')}
                                </button>
                            </div>
                        )}

                        {/* 未ログイン: プロバイダー選択 */}
                        {!user && (
                            <div className="px-6 pb-6 pt-1">
                                <p className="text-[11px] text-app-text-muted leading-relaxed mb-4">
                                    {t('login.benefit_message')}
                                </p>

                                <div className="flex flex-col gap-2 mb-5">
                                    {providers.map(({ id, label, icon, bgHover }) => (
                                        <button
                                            key={id}
                                            onClick={() => handleSignIn(id)}
                                            className={clsx(
                                                "w-full px-4 py-3 rounded-xl text-[13px] font-bold transition-all duration-300 flex items-center gap-3 cursor-pointer",
                                                "text-app-text border border-app-border",
                                                bgHover,
                                                "hover:border-app-text/30 active:scale-[0.98]"
                                            )}
                                        >
                                            {icon}
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-start gap-2 px-1">
                                    <Shield size={13} className="text-app-text-muted shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-app-text-muted leading-relaxed">
                                        {t('login.privacy_message')}
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>,
        document.body
    );
};
