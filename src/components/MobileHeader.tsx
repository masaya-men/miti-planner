import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { MOBILE_TOKENS } from '../tokens/mobileTokens';

export const MobileHeader: React.FC<{
    onHome: () => void;
    theme: string;
    onToggleTheme: () => void;
}> = ({ onHome, theme: _theme, onToggleTheme: _onToggleTheme }) => {
    useTranslation();
    const { contentLanguage } = useThemeStore();
    const currentPlan = usePlanStore(s => s.plans.find(p => p.id === s.currentPlanId));
    const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
    const contentLabel = contentDef
        ? getPhaseName(contentDef.name, contentLanguage)
        : null;
    const subtitle = [contentLabel, currentPlan?.title].filter(Boolean).join('  ');

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

            {/* 2段目: コンテンツ名　プラン名 */}
            {subtitle && (
                <p
                    className="text-app-text-muted font-bold leading-tight truncate"
                    style={{ fontSize: MOBILE_TOKENS.header.subtitleSize }}
                >
                    {subtitle}
                </p>
            )}
        </header>
    );
};
