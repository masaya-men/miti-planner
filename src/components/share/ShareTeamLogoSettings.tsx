import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface ShareTeamLogoSettingsProps {
    teamLogoUrl: string | null;
    showLogo: boolean;
    uploading: boolean;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleToggleLogo: () => void;
    handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleLogoDelete: () => void;
}

/** チームロゴ設定（ログインユーザーのみ） */
export const ShareTeamLogoSettings: React.FC<ShareTeamLogoSettingsProps> = ({
    teamLogoUrl, showLogo, uploading, fileInputRef, handleToggleLogo, handleLogoUpload, handleLogoDelete,
}) => {
    const { t } = useTranslation();

    return (
        <div className="px-5 pb-2 space-y-2">
            {/* ロゴ表示トグル（ロゴがある場合のみ） */}
            {teamLogoUrl && (
                <button
                    onClick={handleToggleLogo}
                    className="flex items-center gap-2.5 w-full py-1.5 text-left group cursor-pointer"
                >
                    <div className={clsx(
                        "w-8 h-[18px] rounded-full transition-colors duration-200 relative shrink-0",
                        showLogo ? "bg-app-text" : "bg-app-surface2 border border-app-border"
                    )}>
                        <div className={clsx(
                            "absolute top-[2px] w-[14px] h-[14px] rounded-full transition-all duration-200",
                            showLogo ? "left-[15px] bg-app-bg" : "left-[2px] bg-app-text-muted"
                        )} />
                    </div>
                    <span className="text-app-lg text-app-text-muted group-hover:text-app-text transition-colors">
                        {t('team_logo.show_on_ogp')}
                    </span>
                </button>
            )}

            {/* ロゴ設定行（コンパクト） */}
            <div className="flex items-center gap-2">
                {teamLogoUrl ? (
                    <>
                        <img referrerPolicy="no-referrer"
                            src={teamLogoUrl}
                            alt="Team Logo"
                            className="w-8 h-8 rounded object-cover border border-app-border"
                        />
                        <button
                            onClick={handleLogoDelete}
                            disabled={uploading}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-app-md font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer border border-app-border"
                        >
                            <Trash2 size={11} />
                            {t('team_logo.remove')}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-app-md font-bold border border-app-border text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer"
                    >
                        {uploading ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <Upload size={12} />
                        )}
                        {uploading ? t('team_logo.uploading') : t('team_logo.upload')}
                    </button>
                )}
                <span className="text-app-base text-app-text-muted ml-auto">
                    {t('team_logo.format_hint')}
                </span>
            </div>

            {/* UGC注意書き */}
            <div className="flex items-start gap-1.5 text-app-xs text-app-text-muted leading-relaxed">
                <span className="shrink-0 mt-px">ⓘ</span>
                <div>
                    <p>{t('team_logo.usage_notice')}</p>
                    <p>
                        <Trans
                            i18nKey="team_logo.usage_notice_terms"
                            components={{
                                termsLink: <Link to="/terms" target="_blank" className="underline hover:text-app-text transition-colors" />
                            }}
                        />
                    </p>
                </div>
            </div>

            {/* 隠しファイルインプット */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
            />
        </div>
    );
};
