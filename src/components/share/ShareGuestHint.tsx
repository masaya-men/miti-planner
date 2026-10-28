import React from 'react';
import { useTranslation } from 'react-i18next';

/** 非ログイン時のさりげない案内 */
export const ShareGuestHint: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
    const { t } = useTranslation();

    return (
        <div className="px-5 pb-2">
            <p className="text-app-base text-app-text-muted text-center leading-relaxed">
                {t('app.share_guest_hint')
                    .split(/<\/?login>/)
                    .map((part, i) =>
                        i === 1 ? (
                            <button
                                key="login"
                                onClick={onLogin}
                                className="underline hover:text-app-text transition-colors cursor-pointer"
                            >
                                {part}
                            </button>
                        ) : (
                            <span key={i}>{part}</span>
                        )
                    )}
            </p>
        </div>
    );
};
