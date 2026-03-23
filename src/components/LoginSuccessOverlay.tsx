import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import clsx from 'clsx';

/**
 * ログイン成功時に画面中央に表示するウェルカムオーバーレイ
 * アイコン + 名前 + 褒めメッセージを数秒表示して自動で消える
 */
export const LoginSuccessOverlay: React.FC = () => {
    const { t } = useTranslation();
    const { justLoggedInUser, clearJustLoggedIn } = useAuthStore();
    const [fading, setFading] = useState(false);

    useEffect(() => {
        if (!justLoggedInUser) return;

        // 2.5秒後にフェードアウト開始
        const fadeTimer = setTimeout(() => setFading(true), 2500);
        // 3秒後に完全に閉じる
        const closeTimer = setTimeout(() => {
            clearJustLoggedIn();
            setFading(false);
        }, 3000);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(closeTimer);
        };
    }, [justLoggedInUser, clearJustLoggedIn]);

    if (!justLoggedInUser) return null;

    const displayName = justLoggedInUser.displayName || 'User';
    const photoURL = justLoggedInUser.photoURL;

    return createPortal(
        <div
            className={clsx(
                "fixed inset-0 z-[999999] flex items-center justify-center transition-opacity duration-500",
                fading ? "opacity-0" : "opacity-100"
            )}
            onClick={() => {
                clearJustLoggedIn();
                setFading(false);
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px]" />

            {/* カード */}
            <div className={clsx(
                "relative flex flex-col items-center gap-4 px-10 py-8 rounded-2xl bg-app-bg glass-panel shadow-2xl",
                "animate-[dialogIn_300ms_cubic-bezier(0.2,0.8,0.2,1)]"
            )}>
                {/* アイコン */}
                {photoURL ? (
                    <img
                        src={photoURL}
                        alt=""
                        className="w-16 h-16 rounded-full ring-2 ring-app-border shadow-lg"
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-app-surface2 flex items-center justify-center ring-2 ring-app-border">
                        <span className="text-2xl font-bold text-app-text">
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* メッセージ */}
                <div className="text-center">
                    <p
                        className="text-[20px] text-app-text mb-1"
                        style={{ fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif", fontWeight: 700 }}
                    >
                        {t('login.welcome', { name: displayName })}
                    </p>
                    <p className="text-[12px] text-app-text-muted">
                        {t('login.welcome_sub')}
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};
