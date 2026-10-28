import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { LoginModal } from './LoginModal';
import type { SavedPlan } from '../types';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader } from './ui/ModalParts';
import { useShareLink } from './share/useShareLink';
import { useTeamLogo } from './share/useTeamLogo';
import { ShareOgPreview } from './share/ShareOgPreview';
import { ShareGuestHint } from './share/ShareGuestHint';
import { ShareTeamLogoSettings } from './share/ShareTeamLogoSettings';
import { ShareActions } from './share/ShareActions';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    contentLabel: string | null;
    currentPlan: SavedPlan | undefined;
    /** バンドル共有用：複数プランのデータ */
    bundlePlans?: { contentId: string | null; title: string; planData: unknown }[];
}

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen, onClose, contentLabel, currentPlan, bundlePlans,
}) => {
    const { t } = useTranslation();
    const { user, teamLogoUrl } = useAuthStore();
    const [showLogo, setShowLogo] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);

    const {
        isBundle, shareUrl, ogImageUrl, imageLoaded, setImageLoaded, updateShareLogo,
    } = useShareLink({ isOpen, currentPlan, bundlePlans, showLogo });
    const {
        uploading, fileInputRef, handleToggleLogo, processLogoFile, handleLogoUpload, handleLogoDelete,
    } = useTeamLogo({ showLogo, setShowLogo, updateShareLogo });

    if (!isOpen) return <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />;

    return (<>
        <ModalShell isOpen onClose={onClose} className="w-[420px] max-w-[90vw]">
                {/* ヘッダー */}
                <ModalHeader
                    title={isBundle
                        ? t('app.share_bundle_title')
                        : t('app.share_modal_title')
                    }
                    onClose={onClose}
                    closeLabel={t('common.close')}
                />
                <div className="overflow-y-auto min-h-0">

                {/* OGPプレビュー（ロゴD&D対応） */}
                <ShareOgPreview
                    canDropLogo={!!user}
                    ogImageUrl={ogImageUrl}
                    imageLoaded={imageLoaded}
                    setImageLoaded={setImageLoaded}
                    showLogo={showLogo}
                    updateShareLogo={updateShareLogo}
                    processLogoFile={processLogoFile}
                />

                {/* 非ログイン時のさりげない案内 */}
                {!user && <ShareGuestHint onLogin={() => setShowLoginModal(true)} />}

                {/* チームロゴ設定（ログインユーザーのみ） */}
                {user && (
                    <ShareTeamLogoSettings
                        teamLogoUrl={teamLogoUrl}
                        showLogo={showLogo}
                        uploading={uploading}
                        fileInputRef={fileInputRef}
                        handleToggleLogo={handleToggleLogo}
                        handleLogoUpload={handleLogoUpload}
                        handleLogoDelete={handleLogoDelete}
                    />
                )}

                {/* アクションボタン */}
                <ShareActions shareUrl={shareUrl} imageLoaded={imageLoaded} contentLabel={contentLabel} />
                </div>
        </ModalShell>
        <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>);
};
