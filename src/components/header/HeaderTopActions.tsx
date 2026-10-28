import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, LogIn } from 'lucide-react';
import clsx from 'clsx';
import { TutorialMenu } from '../tutorial/TutorialMenu';
import { useThemeStore } from '../../store/useThemeStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCanPreviewWip } from '../../hooks/useCanPreviewWip';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { Tooltip } from '../ui/Tooltip';
import { ShareButtons } from '../ShareButtons';
import { useTransitionOverlay } from '../ui/transitionOverlayContext';
import { MilspecStyleToggle } from '../military/MilspecStyleToggle';
import type { SavedPlan } from '../../types';
import { iconBtnBase, iconBtnDefault, pillBtnBase, pillBtnDefault } from './headerButtonStyles';

interface HeaderTopActionsProps {
    readOnly: boolean;
    viewerCluster?: React.ReactNode;
    currentPlan: SavedPlan | undefined;
    contentLabel: string | null;
    onOpenLogin: () => void;
}

/** 上段の右グループ: 共有・チュートリアル・テーマ・MIL-SPEC・言語・ログイン */
export const HeaderTopActions: React.FC<HeaderTopActionsProps> = ({
    readOnly,
    viewerCluster,
    currentPlan,
    contentLabel,
    onOpenLogin,
}) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    // 認証状態
    const { user } = useAuthStore();
    const canPreviewWip = useCanPreviewWip();
    const profileDisplayName = useAuthStore(s => s.profileDisplayName);
    const profileAvatarUrl = useAuthStore(s => s.profileAvatarUrl);

    return (
        <div className="flex items-center gap-1.5 shrink-0 ml-3">
            {/* viewer モード: 共同編集中クラスタを ShareButtons の代わりに表示 */}
            {readOnly && viewerCluster != null && (
                <>{viewerCluster}</>
            )}
            {/* 共有ボタン: 通常モードのみ */}
            {!readOnly && currentPlan && (
                <ShareButtons contentLabel={contentLabel} currentPlan={currentPlan} />
            )}

            <div className="h-5 w-px shrink-0 dark:bg-app-text/25 bg-app-text/25 mx-0.5 rounded-full" />

            {/* チュートリアル: viewer(ジョイナー)では無関係なので非表示(#2a/#2c) */}
            {!readOnly && (
                <>
                    <TutorialMenu btnClassName={clsx(pillBtnBase, pillBtnDefault)} />
                    <div className="h-5 w-px shrink-0 dark:bg-app-text/25 bg-app-text/25 mx-0.5 rounded-full" />
                </>
            )}

            {/* テーマ切替（チュートリアル中も常に操作可能） */}
            <Tooltip content={theme === 'dark' ? t('app.toggle_theme_light') : t('app.toggle_theme_dark')}>
                <button
                    data-tutorial-always
                    onClick={() => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme')}
                    className={clsx(iconBtnBase, iconBtnDefault)}
                >
                    {theme === 'dark'
                        ? <Sun size={16} className="group-hover:rotate-90 transition-transform duration-500" />
                        : <Moon size={16} className="group-hover:-rotate-12 transition-transform duration-300" />
                    }
                </button>
            </Tooltip>

            {/* MIL-SPEC スタイル切替（WIP: DEV か管理者ログイン時のみ表示(useCanPreviewWip)。
                SP1 では military 側の入口がこれ1つしか無い — 標準UIから欠けると
                誰も MIL-SPEC モードに入れなくなるため撤去しないこと） */}
            {canPreviewWip && (
                <Tooltip content={t('app.theme_style_switch')}>
                    <MilspecStyleToggle className={clsx(iconBtnBase, iconBtnDefault)} />
                </Tooltip>
            )}

            {/* 言語切替 */}
            <LanguageSwitcher />

            {/* ログイン */}
            <Tooltip content={user ? (profileDisplayName || 'Account') : t('app.sign_in') || 'Sign In'}>
                <button
                    onClick={onOpenLogin}
                    className={clsx(iconBtnBase, iconBtnDefault)}
                >
                    {profileAvatarUrl ? (
                        <img src={profileAvatarUrl} alt="" className="w-6 h-6 rounded-full" />
                    ) : user ? (
                        <div className="w-6 h-6 rounded-full bg-app-text/15 flex items-center justify-center">
                            <span className="text-app-base font-black text-app-text">{(profileDisplayName || 'U').charAt(0).toUpperCase()}</span>
                        </div>
                    ) : (
                        <LogIn size={16} />
                    )}
                </button>
            </Tooltip>
        </div>
    );
};
