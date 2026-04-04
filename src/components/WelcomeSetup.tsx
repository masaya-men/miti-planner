import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Camera } from 'lucide-react';
import clsx from 'clsx';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';
import { useAuthStore } from '../store/useAuthStore';
import { AvatarCropModal } from './AvatarCropModal';
import { uploadAvatar } from '../utils/avatarUpload';

interface WelcomeSetupProps {
    onComplete?: () => void;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({ onComplete }) => {
    const { t } = useTranslation();
    const user = useAuthStore(s => s.user);

    const [displayName, setDisplayName] = useState('');
    const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [showCropModal, setShowCropModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!user) return null;

    const handleAvatarComplete = (blob: Blob) => {
        setAvatarBlob(blob);
        const url = URL.createObjectURL(blob);
        // 古いプレビューURLを解放
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(url);
        setShowCropModal(false);
    };

    const handleSubmit = async () => {
        if (!displayName.trim() || isSubmitting) return;
        setIsSubmitting(true);

        try {
            let avatarUrl: string | null = null;

            // アバターアップロード（設定されている場合）
            if (avatarBlob) {
                avatarUrl = await uploadAvatar(user.uid, avatarBlob);
            }

            // プロバイダー判定
            const provider = user.uid.startsWith('discord:') ? 'discord' : 'twitter';

            // Firestore users/{uid} ドキュメント作成
            const now = new Date().toISOString();
            await setDoc(doc(db, COLLECTIONS.USERS, user.uid), {
                displayName: displayName.trim(),
                avatarUrl,
                provider,
                createdAt: now,
                updatedAt: now,
                settings: {},
            });

            // ストア更新
            useAuthStore.setState({
                profileDisplayName: displayName.trim(),
                profileAvatarUrl: avatarUrl,
                isNewUser: false,
            });

            // プレビューURLのクリーンアップ
            if (avatarPreview) URL.revokeObjectURL(avatarPreview);

            onComplete?.();
        } catch (err) {
            console.error('[WelcomeSetup] 登録エラー:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const initial = (displayName || 'U').charAt(0).toUpperCase();

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-app-bg/95">
            <div className={clsx(
                "w-full max-w-[380px] mx-4 rounded-2xl glass-tier3",
                "animate-[dialogIn_300ms_cubic-bezier(0.2,0.8,0.2,1)]",
                "px-8 py-8 flex flex-col items-center gap-6"
            )}>
                {/* タイトル */}
                <div className="text-center">
                    <h1
                        className="text-app-4xl text-app-text tracking-wide mb-1"
                        style={{
                            fontFamily: "'Rajdhani', 'M PLUS 1', sans-serif",
                            fontWeight: 700,
                        }}
                    >
                        {t('welcome.title')}
                    </h1>
                    <p className="text-app-md text-app-text-muted">
                        {t('welcome.subtitle')}
                    </p>
                </div>

                {/* アバターエリア */}
                <button
                    type="button"
                    onClick={() => setShowCropModal(true)}
                    className={clsx(
                        "relative w-20 h-20 rounded-full overflow-hidden",
                        "border-2 border-dashed border-app-border hover:border-app-text/40 transition-colors cursor-pointer",
                        "group flex items-center justify-center bg-app-surface2/50"
                    )}
                >
                    {avatarPreview ? (
                        <img
                            src={avatarPreview}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <span className="text-app-4xl font-bold text-app-text/30">
                            {initial}
                        </span>
                    )}
                    {/* オーバーレイ */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={20} className="text-white" />
                    </div>
                </button>

                {/* 表示名入力 */}
                <div className="w-full flex flex-col gap-1.5">
                    <label className="text-app-base font-bold text-app-text-muted uppercase tracking-wider">
                        {t('welcome.display_name_label')}
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={displayName}
                            onChange={e => {
                                if (e.target.value.length <= 30) setDisplayName(e.target.value);
                            }}
                            placeholder={t('welcome.display_name_placeholder')}
                            maxLength={30}
                            className={clsx(
                                "w-full px-4 py-2.5 rounded-xl text-app-lg text-app-text",
                                "bg-transparent border border-app-border",
                                "focus:outline-none focus:border-app-text/40 transition-colors",
                                "placeholder:text-app-text-muted/50"
                            )}
                        />
                        <span className={clsx(
                            "absolute right-3 bottom-2.5 text-app-base",
                            displayName.length >= 30 ? "text-yellow-500" : "text-app-text-muted/50"
                        )}>
                            {displayName.length}/30
                        </span>
                    </div>
                </div>

                {/* 開始ボタン */}
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!displayName.trim() || isSubmitting}
                    className={clsx(
                        "w-full py-3 rounded-xl text-app-xl font-bold uppercase tracking-wider transition-all duration-200",
                        displayName.trim() && !isSubmitting
                            ? "bg-app-text text-app-bg hover:opacity-90 active:scale-[0.98] cursor-pointer"
                            : "bg-app-text/20 text-app-text-muted cursor-not-allowed"
                    )}
                >
                    {isSubmitting ? '...' : t('welcome.start_button')}
                </button>

                {/* ヒント */}
                <p className="text-app-base text-app-text-muted/60 text-center">
                    {t('welcome.avatar_hint')}
                </p>
            </div>

            {/* アバタークロップモーダル */}
            <AvatarCropModal
                isOpen={showCropModal}
                onClose={() => setShowCropModal(false)}
                onComplete={handleAvatarComplete}
            />
        </div>,
        document.body
    );
};
