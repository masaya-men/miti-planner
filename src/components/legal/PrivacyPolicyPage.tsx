import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { LegalPageLayout } from './LegalPageLayout';
import { Section, BulletList, SubSection, ThreeColumnTable, Note, InlineLink } from './legalSectionParts';
import { splitItems } from './splitItems';

// ========================================
// プライバシーポリシー
// ========================================

export const PrivacyPolicyPage: React.FC = () => {
    useCanonicalUrl('/privacy');
    const { t } = useTranslation();
    React.useEffect(() => {
        document.title = t('app.page_title_privacy');
    }, [t]);
    return (
        <LegalPageLayout>
            <h1 className="text-app-4xl font-bold mb-1">{t('legal.privacy_title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-6">{t('legal.privacy_last_updated')}</p>
            <p className="text-app-2xl text-app-text-muted mb-8">{t('legal.privacy_intro')}</p>

            {/* 1. 集める情報 */}
            <Section title={t('legal.privacy_section1_title')}>
                <p className="text-app-2xl text-app-text-muted mb-3">{t('legal.privacy_section1_body')}</p>
                <SubSection title={t('legal.privacy_section1_auth_title')} items={splitItems(t('legal.privacy_section1_auth_items'))} />
                <SubSection title={t('legal.privacy_section1_plan_title')} items={splitItems(t('legal.privacy_section1_plan_items'))} />
                <SubSection title={t('legal.privacy_section1_auto_title')} items={splitItems(t('legal.privacy_section1_auto_items'))} />
            </Section>

            {/* 1b. 外部サービスから届く情報について */}
            <Section title={t('legal.privacy_section1b_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.privacy_section1b_body')}</p>
            </Section>

            {/* 1d. Discord ユーザー ID の hash 化について */}
            <Section title={t('legal.privacy_section1d_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.privacy_section1d_body')}</p>
            </Section>

            {/* 1c. 支援(Ko-fi)について — 受付終了の告知のみ(過去の支援者情報の扱いを説明するため残す) */}
            <Section title={t('legal.privacy_section1c_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.privacy_section1c_body')}</p>
                <p className="text-app-2xl text-app-text-muted">
                    <InlineLink href="/about">{t('legal.privacy_section1c_about_link')}</InlineLink>
                </p>
            </Section>

            {/* 2. 集めない情報 */}
            <Section title={t('legal.privacy_section2_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.privacy_section2_body')}</p>
                <BulletList items={splitItems(t('legal.privacy_section2_items'))} />
            </Section>

            {/* 3. 情報の使いみち */}
            <Section title={t('legal.privacy_section3_title')}>
                <BulletList items={splitItems(t('legal.privacy_section3_items'))} />
            </Section>

            {/* 4. 利用している外部サービス */}
            <Section title={t('legal.privacy_section4_title')}>
                <p className="text-app-2xl text-app-text-muted mb-3">{t('legal.privacy_section4_body')}</p>
                <ThreeColumnTable
                    headers={[t('legal.privacy_section4_col_service'), t('legal.privacy_section4_col_provider'), t('legal.privacy_section4_col_purpose')]}
                    col1={splitItems(t('legal.privacy_section4_service_names'))}
                    col2={splitItems(t('legal.privacy_section4_service_providers'))}
                    col3={splitItems(t('legal.privacy_section4_service_purposes'))}
                />
                <Note text={t('legal.privacy_section4_analytics_note')} />
                <Note text={t('legal.privacy_section4_recaptcha_note')} />
            </Section>

            {/* 5. Cookieとブラウザへのデータ保存 */}
            <Section title={t('legal.privacy_section5_title')}>
                <SubSection title={t('legal.privacy_section5_cookie_title')} items={splitItems(t('legal.privacy_section5_cookie_items'))} />
                <SubSection title={t('legal.privacy_section5_storage_title')} items={splitItems(t('legal.privacy_section5_storage_items'))} />
                <Note text={t('legal.privacy_section5_storage_note')} />
            </Section>

            {/* 6. データの保存場所と保持期間 */}
            <Section title={t('legal.privacy_section6_title')}>
                <p className="text-app-2xl text-app-text-muted mb-3">{t('legal.privacy_section6_body')}</p>
                <ThreeColumnTable
                    headers={[t('legal.privacy_section6_col_data'), t('legal.privacy_section6_col_location'), t('legal.privacy_section6_col_period')]}
                    col1={splitItems(t('legal.privacy_section6_data_types'))}
                    col2={splitItems(t('legal.privacy_section6_data_locations'))}
                    col3={splitItems(t('legal.privacy_section6_data_periods'))}
                />
                <Note text={t('legal.privacy_section6_note')} />
            </Section>

            {/* 7. 第三者への情報提供 */}
            <Section title={t('legal.privacy_section7_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.privacy_section7_body')}</p>
            </Section>

            {/* リアルタイム共同編集でのカーソル共有について (番号なしサブセクション) */}
            <Section title={t('legal.privacy_collab_title')}>
                <p className="text-app-2xl text-app-text-muted mb-3">{t('legal.privacy_collab_body')}</p>
                <BulletList items={splitItems(t('legal.privacy_collab_items'))} />
                <Note text={t('legal.privacy_collab_note')} />
            </Section>

            {/* 8. あなたの権利 */}
            <Section title={t('legal.privacy_section8_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.privacy_section8_body')}</p>
                <BulletList items={splitItems(t('legal.privacy_section8_items'))} />
            </Section>

            {/* 9. お子様について */}
            <Section title={t('legal.privacy_section9_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.privacy_section9_body')}</p>
            </Section>

            {/* 10. このポリシーの変更 */}
            <Section title={t('legal.privacy_section10_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.privacy_section10_body')}</p>
            </Section>

            {/* 11. お問い合わせ */}
            <Section title={t('legal.privacy_section11_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.privacy_section11_body')}</p>
                <BulletList items={splitItems(t('legal.privacy_section11_items'))} />
            </Section>
        </LegalPageLayout>
    );
};
