/**
 * LoPo 支援ページ (/support)
 * Ko-fi へ飛ばす前に 4 言語で支援内容を説明する
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../hooks/useCanonicalUrl';
import { LegalPageLayout, splitItems } from './LegalPage';

const KOFI_URL = 'https://ko-fi.com/lopoly';

const AMOUNT_KEYS = [
    'support.amount_500',
    'support.amount_1000',
    'support.amount_3000',
    'support.amount_5000',
    'support.amount_9000',
] as const;

export const SupportPage: React.FC = () => {
    useCanonicalUrl('/support');
    const { t } = useTranslation();

    React.useEffect(() => {
        document.title = t('app.page_title_support');
    }, [t]);

    const usageItems = splitItems(t('support.usage_items'));

    return (
        <LegalPageLayout>
            {/* タイトル */}
            <h1 className="text-app-4xl font-bold mb-1">{t('support.title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-8">{t('support.subtitle')}</p>

            {/* 私の想い */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.heart_heading')}
                </h2>
                <p className="text-app-2xl text-app-text leading-relaxed">
                    {t('support.heart_body')}
                </p>
            </section>

            {/* LoPo について */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.about_heading')}
                </h2>
                <p className="text-app-2xl text-app-text-muted leading-relaxed">
                    {t('support.about_body')}
                </p>
            </section>

            {/* 資金の使い道 */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.usage_heading')}
                </h2>
                <ul className="list-disc list-inside space-y-1 text-app-2xl text-app-text-muted">
                    {usageItems.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </section>

            {/* Ko-fi とは */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.kofi_about_heading')}
                </h2>
                <p className="text-app-2xl text-app-text-muted leading-relaxed">
                    {t('support.kofi_about_body')}
                </p>
            </section>

            {/* 支援するとどうなるの？ */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.amounts_heading')}
                </h2>
                <ul className="space-y-2 mb-3">
                    {AMOUNT_KEYS.map((key) => (
                        <li
                            key={key}
                            className="text-app-2xl text-app-text-muted leading-relaxed bg-app-surface2 rounded-lg px-4 py-3 border border-app-border"
                        >
                            {t(key)}
                        </li>
                    ))}
                </ul>
                <p className="text-app-lg text-app-text-muted leading-relaxed italic">
                    {t('support.amounts_note')}
                </p>
            </section>

            {/* Ko-fi で支援する（CTA） */}
            <section className="mb-8 text-center">
                <h2 className="text-app-2xl-plus font-bold mb-6 border-b border-app-border pb-1 text-left">
                    {t('support.kofi_heading')}
                </h2>
                <div className="flex flex-col items-center gap-2">
                    <a
                        href={KOFI_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-3 px-12 py-5 rounded-2xl bg-app-text text-app-bg font-bold text-app-3xl shadow-2xl hover:scale-105 hover:-translate-y-1 active:scale-95 transition-all duration-200"
                    >
                        <span className="text-app-5xl group-hover:rotate-12 transition-transform duration-300">☕</span>
                        <span>{t('footer.kofi')}</span>
                    </a>
                    <p className="text-app-lg text-app-text-muted mt-1">
                        {t('support.cta_subtext')}
                    </p>
                </div>
            </section>

            {/* SE 免責 */}
            <p className="text-app-lg text-app-text-muted mt-12 pt-4 border-t border-app-border leading-relaxed">
                {t('support.disclaimer')}
            </p>
        </LegalPageLayout>
    );
};
