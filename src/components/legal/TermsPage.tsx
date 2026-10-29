import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { LegalPageLayout } from './LegalPageLayout';
import { Section, BulletList } from './legalSectionParts';
import { splitItems } from './splitItems';

// ========================================
// 利用規約
// ========================================

export const TermsPage: React.FC = () => {
    useCanonicalUrl('/terms');
    const { t } = useTranslation();
    React.useEffect(() => {
        document.title = t('app.page_title_terms');
    }, [t]);
    return (
        <LegalPageLayout>
            <h1 className="text-app-4xl font-bold mb-1">{t('legal.terms_title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-6">{t('legal.terms_last_updated')}</p>
            <p className="text-app-2xl text-app-text-muted mb-8">{t('legal.terms_intro')}</p>

            <Section title={t('legal.terms_section1_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.terms_section1_body')}</p>
            </Section>

            <Section title={t('legal.terms_section2_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.terms_section2_body')}</p>
            </Section>

            <Section title={t('legal.terms_section3_title')}>
                <BulletList items={splitItems(t('legal.terms_section3_items'))} />
            </Section>

            <Section title={t('legal.terms_section4_title')}>
                <BulletList items={splitItems(t('legal.terms_section4_items'))} />
            </Section>

            <Section title={t('legal.terms_section5_title')}>
                <BulletList items={splitItems(t('legal.terms_section5_items'))} />
            </Section>

            <Section title={t('legal.terms_section6_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.terms_section6_body')}</p>
            </Section>

            <Section title={t('legal.terms_section7_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.terms_section7_body')}</p>
            </Section>

            {/* 8. アップロードコンテンツについて */}
            <Section title={t('legal.terms_section8_title')}>
                <p className="text-app-2xl text-app-text-muted mb-3">{t('legal.terms_section8_intro')}</p>
                <BulletList items={splitItems(t('legal.terms_section8_items'))} />
                <p className="text-app-2xl text-app-text-muted mt-4 mb-2">{t('legal.terms_section8_contact')}</p>
                <BulletList items={splitItems(t('legal.terms_section8_contact_items'))} />
            </Section>
        </LegalPageLayout>
    );
};
