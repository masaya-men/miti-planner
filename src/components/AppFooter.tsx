import React from 'react';
import { useTranslation } from 'react-i18next';
import { PulseSettings } from './PulseSettings';
import clsx from 'clsx';

export const AppFooter: React.FC = () => {
    const { t } = useTranslation();
    const [footerLegalOpen, setFooterLegalOpen] = React.useState(false);

    return (
        <footer className={clsx(
            "h-6 shrink-0 hidden md:flex items-center justify-center z-50 pointer-events-none",
            "glass-tier3 glass-frame glass-border-b-0 glass-border-l-0 glass-border-r-0 glass-shadow-none"
        )}>
            <p className="text-app-xs text-app-text-muted tracking-wide pointer-events-auto flex items-center gap-0">
                {t('footer.copyright')}{' · '}{t('footer.disclaimer')}
                {' · '}
                <span className="relative inline-block">
                    <button
                        onClick={() => setFooterLegalOpen(prev => !prev)}
                        className="underline hover:text-app-text transition-colors cursor-pointer px-1"
                    >
                        {t('footer.legal')}
                    </button>
                    {footerLegalOpen && (
                        <>
                            <div className="fixed inset-0 z-[998]" onClick={() => setFooterLegalOpen(false)} />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[999] bg-app-surface border border-app-border rounded-lg shadow-lg py-2 min-w-[220px]">
                                <a href="/privacy" className="block px-4 py-2.5 text-app-base text-app-text hover:bg-app-surface2 transition-colors" onClick={() => setFooterLegalOpen(false)}>{t('footer.privacy_policy')}</a>
                                <a href="/terms" className="block px-4 py-2.5 text-app-base text-app-text hover:bg-app-surface2 transition-colors" onClick={() => setFooterLegalOpen(false)}>{t('footer.terms')}</a>
                                <a href="/commercial" className="block px-4 py-2.5 text-app-base text-app-text hover:bg-app-surface2 transition-colors" onClick={() => setFooterLegalOpen(false)}>{t('footer.commercial')}</a>
                            </div>
                        </>
                    )}
                </span>
                {' · '}
                <a href="https://discord.gg/z7uypbJSnN" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.discord')}</a>
                {' · '}
                <a href="https://x.com/lopoly_app" target="_blank" rel="noopener noreferrer" className="underline hover:text-app-text transition-colors">{t('footer.x_official')}</a>
                {' · '}
                <PulseSettings />
            </p>
        </footer>
    );
};
