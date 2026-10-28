import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { LOPO_X_URL, DEVELOPER_X_URL, DISCORD_INVITE_URL, SE_MATERIAL_TERMS_URL } from '../../constants/external';
import { LegalPageLayout } from './LegalPageLayout';
import { Section, InlineLink } from './legalSectionParts';

// ========================================
// 運営について
// ========================================

/** リンク付き箇条書き */
const LinkList: React.FC<{ items: { href: string; label: string; external?: boolean }[] }> = ({ items }) => (
    <ul className="list-disc list-inside space-y-1 text-app-2xl text-app-text-muted">
        {items.map((item) => (
            <li key={item.href + item.label}>
                <InlineLink href={item.href} external={item.external}>{item.label}</InlineLink>
            </li>
        ))}
    </ul>
);

export const AboutPage: React.FC = () => {
    useCanonicalUrl('/about');
    const { t } = useTranslation();
    React.useEffect(() => {
        document.title = t('app.page_title_about');
    }, [t]);
    // フッターの「お問い合わせ」(/about#contact) から来たときは問い合わせ欄へ移動する。
    // LegalPageLayout の scrollTo(0,0) (子の effect が先に走る) の後に実行される。
    const { hash } = useLocation();
    React.useEffect(() => {
        if (!hash) return;
        const id = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
        return () => cancelAnimationFrame(id);
    }, [hash]);
    return (
        <LegalPageLayout>
            <h1 className="text-app-4xl font-bold mb-1">{t('legal.about_title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-6">{t('legal.about_last_updated')}</p>

            {/* LoPo とは */}
            <Section title={t('legal.about_intro_title')}>
                <p className="text-app-2xl text-app-text-muted">{t('legal.about_intro_body')}</p>
            </Section>

            {/* 提供しているツール */}
            <Section title={t('legal.about_tools_title')}>
                <LinkList items={[
                    { href: '/miti', label: t('legal.about_tool_miti') },
                    { href: '/housing', label: t('legal.about_tool_housing') },
                    { href: '/stgy', label: t('legal.about_tool_stgy') },
                ]} />
            </Section>

            {/* 運営者 */}
            <Section title={t('legal.about_operator_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.about_operator_body')}</p>
                <LinkList items={[{ href: DEVELOPER_X_URL, label: t('legal.about_developer_x_label'), external: true }]} />
            </Section>

            {/* 公式アカウント */}
            <Section title={t('legal.about_official_title')}>
                <LinkList items={[
                    { href: LOPO_X_URL, label: t('legal.about_official_x_label'), external: true },
                    { href: DISCORD_INVITE_URL, label: t('legal.about_official_discord_label'), external: true },
                ]} />
            </Section>

            {/* お問い合わせ */}
            <Section id="contact" title={t('legal.about_contact_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.about_contact_body')}</p>
                <LinkList items={[
                    { href: DISCORD_INVITE_URL, label: t('legal.about_contact_discord'), external: true },
                    { href: LOPO_X_URL, label: t('legal.about_contact_xdm'), external: true },
                ]} />
            </Section>

            {/* データの扱い */}
            <Section title={t('legal.about_data_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.about_data_body')}</p>
                <p className="text-app-2xl text-app-text-muted">
                    <InlineLink href="/privacy">{t('legal.about_data_link')}</InlineLink>
                </p>
            </Section>

            {/* 寄付について — SE 著作物利用条件 2026-09-16 改訂で寄付募集が商用・営利目的と明記されたための受付終了の経緯 */}
            <Section title={t('legal.about_donation_title')}>
                <p className="text-app-2xl text-app-text-muted mb-2">{t('legal.about_donation_body')}</p>
                <p className="text-app-2xl text-app-text-muted">
                    <InlineLink href={SE_MATERIAL_TERMS_URL} external>{t('legal.about_donation_source')}</InlineLink>
                </p>
            </Section>
        </LegalPageLayout>
    );
};
