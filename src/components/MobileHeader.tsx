import React from 'react';
import { useTranslation } from 'react-i18next';
import { usePlanStore } from '../store/usePlanStore';
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import { useThemeStore } from '../store/useThemeStore';
import { useMitigationStore } from '../store/useMitigationStore';
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
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const partyJobs = partyMembers
        .filter(m => m.jobId)
        .map(m => m.jobId!.toUpperCase())
        .join(' · ');

    const subtitle = [currentPlan?.title, partyJobs].filter(Boolean).join(' — ');

    return (
        <header
            className="shrink-0 border-b flex md:hidden flex-col justify-center px-3 z-40 relative backdrop-blur-xl border-app-border"
            style={{
                minHeight: MOBILE_TOKENS.header.height,
                paddingTop: 'env(safe-area-inset-top, 0px)',
                backgroundColor: 'var(--color-nav-bg)',
            }}
        >
            {/* Top: LOPO label */}
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

            {/* Middle: Content name (Large Title) */}
            {contentLabel && (
                <p
                    className="text-app-text-muted font-bold leading-tight truncate"
                    style={{ fontSize: MOBILE_TOKENS.header.subtitleSize }}
                >
                    {contentLabel}
                </p>
            )}

            {/* Bottom: Plan name + party jobs */}
            {subtitle && (
                <p
                    className="text-app-text-muted truncate leading-tight"
                    style={{ fontSize: MOBILE_TOKENS.header.subtitleSize }}
                >
                    {subtitle}
                </p>
            )}
        </header>
    );
};
