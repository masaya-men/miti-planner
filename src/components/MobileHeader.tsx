import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';

export const MobileHeader: React.FC<{
    onHome: () => void;
    theme?: string;
    onToggleTheme?: () => void;
    /** viewer(共同編集ジョイナー)モード: コンテンツ情報を部屋の contentId から表示し、usePlanStore を参照しない。 */
    viewer?: { contentId: string | null; ownerLabel: string | null };
    /** 右側スロット(viewer の「共同編集中・抜ける」クラスタ等)。未指定なら通常アプリと同一表示。 */
    rightSlot?: React.ReactNode;
}> = ({ onHome, viewer, rightSlot }) => {
    useTranslation();
    const { contentLanguage } = useThemeStore();
    const readOnly = viewer != null;
    // viewer 時は plan store 非依存(ConsolidatedHeader viewer と同じ作法)。selector は readOnly で undefined。
    const currentPlan = usePlanStore(s => (readOnly ? undefined : s.plans.find(p => p.id === s.currentPlanId)));
    const contentId = readOnly ? viewer!.contentId : (currentPlan?.contentId ?? null);
    const contentDef = contentId ? getContentById(contentId) : null;
    const contentLabel = contentDef
        ? getPhaseName(contentDef.name, contentLanguage)
        : null;
    const subtitle = readOnly
        ? [contentLabel, viewer!.ownerLabel].filter(Boolean).join('  ')
        : [contentLabel, currentPlan?.title].filter(Boolean).join('  ');

    return (
        <header
            className="shrink-0 flex md:hidden flex-col justify-center px-3 z-40 fixed top-0 left-0 right-0 backdrop-blur-md"
            style={{
                minHeight: MOBILE_TOKENS.header.compactHeight,
                paddingTop: 'env(safe-area-inset-top, 0px)',
                backgroundColor: 'var(--color-nav-bg)',
                borderBottom: '0.5px solid var(--color-nav-border)',
            }}
        >
            <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex flex-col min-w-0">
                    {/* 1段目: LOPO */}
                    <button
                        onClick={onHome}
                        className="cursor-pointer text-left"
                        style={{
                            fontSize: MOBILE_TOKENS.header.logoSize,
                            letterSpacing: MOBILE_TOKENS.header.logoLetterSpacing,
                        }}
                    >
                        <span className="text-app-text-muted font-bold uppercase tracking-widest">
                            LOPO
                        </span>
                    </button>

                    {/* 2段目: コンテンツ名　プラン名(viewer は コンテンツ名　オーナー名) */}
                    {subtitle && (
                        <p
                            className="text-app-text-muted font-bold leading-tight truncate"
                            style={{ fontSize: MOBILE_TOKENS.header.subtitleSize }}
                        >
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* 右スロット(viewer の共同編集クラスタ等) */}
                {rightSlot && <div className="shrink-0">{rightSlot}</div>}
            </div>
        </header>
    );
};
