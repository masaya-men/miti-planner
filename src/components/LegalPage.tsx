/**
 * プライバシーポリシー・利用規約ページ
 * /privacy と /terms で共用するコンポーネント
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

/** i18nキーで「,」区切りのリストを配列に変換 */
function splitItems(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** セクション: タイトル + 本文 */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-8">
        <h2 className="text-base font-bold mb-3 border-b border-app-border pb-1">{title}</h2>
        {children}
    </section>
);

/** 箇条書きリスト */
const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="list-disc list-inside space-y-1 text-sm text-app-text-muted">
        {items.map((item, i) => (
            <li key={i}>{item}</li>
        ))}
    </ul>
);

/** サブセクション（太字タイトル + リスト） */
const SubSection: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div className="mb-3">
        <h3 className="text-sm font-semibold mb-1">{title}</h3>
        <BulletList items={items} />
    </div>
);

// ========================================
// プライバシーポリシー
// ========================================

export const PrivacyPolicyPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <LegalPageLayout>
            <h1 className="text-xl font-bold mb-1">{t('legal.privacy_title')}</h1>
            <p className="text-xs text-app-text-muted mb-6">{t('legal.privacy_last_updated')}</p>
            <p className="text-sm text-app-text-muted mb-8">{t('legal.privacy_intro')}</p>

            <Section title={t('legal.privacy_section1_title')}>
                <p className="text-sm text-app-text-muted mb-3">{t('legal.privacy_section1_body')}</p>
                <SubSection title={t('legal.privacy_section1_auth_title')} items={splitItems(t('legal.privacy_section1_auth_items'))} />
                <SubSection title={t('legal.privacy_section1_plan_title')} items={splitItems(t('legal.privacy_section1_plan_items'))} />
                <SubSection title={t('legal.privacy_section1_no_collect_title')} items={splitItems(t('legal.privacy_section1_no_collect_items'))} />
            </Section>

            <Section title={t('legal.privacy_section2_title')}>
                <BulletList items={splitItems(t('legal.privacy_section2_items'))} />
            </Section>

            <Section title={t('legal.privacy_section3_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.privacy_section3_body')}</p>
            </Section>

            <Section title={t('legal.privacy_section4_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.privacy_section4_body')}</p>
            </Section>

            <Section title={t('legal.privacy_section5_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.privacy_section5_body')}</p>
            </Section>

            <Section title={t('legal.privacy_section6_title')}>
                <p className="text-sm text-app-text-muted mb-2">{t('legal.privacy_section6_body')}</p>
                <BulletList items={splitItems(t('legal.privacy_section6_items'))} />
            </Section>

            <Section title={t('legal.privacy_section7_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.privacy_section7_body')}</p>
            </Section>

            <Section title={t('legal.privacy_section8_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.privacy_section8_body')}</p>
            </Section>

            <Section title={t('legal.privacy_section9_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.privacy_section9_body')}</p>
            </Section>
        </LegalPageLayout>
    );
};

// ========================================
// 利用規約
// ========================================

export const TermsPage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <LegalPageLayout>
            <h1 className="text-xl font-bold mb-1">{t('legal.terms_title')}</h1>
            <p className="text-xs text-app-text-muted mb-6">{t('legal.terms_last_updated')}</p>
            <p className="text-sm text-app-text-muted mb-8">{t('legal.terms_intro')}</p>

            <Section title={t('legal.terms_section1_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.terms_section1_body')}</p>
            </Section>

            <Section title={t('legal.terms_section2_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.terms_section2_body')}</p>
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
                <p className="text-sm text-app-text-muted">{t('legal.terms_section6_body')}</p>
            </Section>

            <Section title={t('legal.terms_section7_title')}>
                <p className="text-sm text-app-text-muted">{t('legal.terms_section7_body')}</p>
            </Section>
        </LegalPageLayout>
    );
};

// ========================================
// 共通レイアウト
// ========================================

const LegalPageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const { theme, setTheme } = useThemeStore();
    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

    // body の overflow-hidden を一時的に解除（index.cssでグローバル設定されている）
    React.useEffect(() => {
        document.body.style.overflow = 'auto';
        return () => { document.body.style.overflow = ''; };
    }, []);

    return (
        <div className="min-h-[100dvh] bg-app-bg text-app-text overflow-auto">
            {/* ヘッダー */}
            <header className="sticky top-0 z-50 bg-app-bg/80 backdrop-blur border-b border-app-border">
                <div className="max-w-2xl mx-auto px-4 h-12 flex items-center justify-between">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-sm text-app-text-muted hover:text-app-text transition-colors"
                    >
                        <ArrowLeft size={16} />
                        <span>LoPo</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <LanguageSwitcher />
                        <button
                            onClick={toggleTheme}
                            className="p-1.5 rounded hover:bg-app-surface transition-colors"
                        >
                            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                    </div>
                </div>
            </header>

            {/* 本文 */}
            <main className="max-w-2xl mx-auto px-4 py-8">
                {children}
            </main>

            {/* フッター */}
            <footer className="border-t border-app-border py-4 text-center">
                <p className="text-[8px] text-app-text-muted">
                    © SQUARE ENIX CO., LTD. All Rights Reserved.
                </p>
            </footer>
        </div>
    );
};
