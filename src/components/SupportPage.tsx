/**
 * LoPo 支援ページ (/support)
 * Ko-fi へ飛ばす前に 4 言語で支援内容を説明する
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../hooks/useCanonicalUrl';
import { LegalPageLayout } from './LegalPage';

/** i18n キーで「,」区切りのリストを配列に変換 */
function splitItems(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const KOFI_URL = 'https://ko-fi.com/lopoly';

export const SupportPage: React.FC = () => {
    useCanonicalUrl('/support');
    const { t } = useTranslation();

    const usageItems = splitItems(t('support.usage_items'));

    return (
        <LegalPageLayout>
            {/* タイトル */}
            <h1 className="text-app-4xl font-bold mb-1">{t('support.title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-8">{t('support.subtitle')}</p>

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

            {/* Ko-fi で支援する */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.kofi_heading')}
                </h2>
                <p className="text-app-2xl text-app-text-muted mb-4 leading-relaxed">
                    {t('support.kofi_note')}
                </p>
                <a
                    href={KOFI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 rounded-lg bg-app-text text-app-bg font-bold text-app-2xl hover:opacity-90 active:scale-95 transition-all"
                >
                    {t('footer.kofi')}
                </a>
            </section>

            {/* SE 免責 */}
            <p className="text-app-lg text-app-text-muted mt-12 pt-4 border-t border-app-border leading-relaxed">
                {t('support.disclaimer')}
            </p>
        </LegalPageLayout>
    );
};
