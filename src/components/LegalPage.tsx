/**
 * プライバシーポリシー・利用規約ページ
 * /privacy と /terms で共用するコンポーネント
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { useTransitionOverlay } from './ui/TransitionOverlay';
import { ArrowLeft, Sun, Moon } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';

/** i18nキーで「,」区切りのリストを配列に変換 */
function splitItems(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** セクション: タイトル + 本文 */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-8">
        <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">{title}</h2>
        {children}
    </section>
);

/** 箇条書きリスト */
const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="list-disc list-inside space-y-1 text-app-2xl text-app-text-muted">
        {items.map((item, i) => (
            <li key={i}>{item}</li>
        ))}
    </ul>
);

/** サブセクション（太字タイトル + リスト） */
const SubSection: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div className="mb-3">
        <h3 className="text-app-2xl font-semibold mb-1">{title}</h3>
        <BulletList items={items} />
    </div>
);

/** 3列テーブル（外部サービス一覧・データ保存一覧用） */
const ThreeColumnTable: React.FC<{
    headers: [string, string, string];
    col1: string[];
    col2: string[];
    col3: string[];
}> = ({ headers, col1, col2, col3 }) => (
    <div className="overflow-x-auto mb-3">
        <table className="w-full text-app-2xl">
            <thead>
                <tr className="border-b border-app-border">
                    {headers.map((h, i) => (
                        <th key={i} className="text-left font-semibold py-2 pr-3">{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {col1.map((_, i) => (
                    <tr key={i} className="border-b border-app-border/50">
                        <td className="py-2 pr-3 text-app-text-muted">{col1[i]}</td>
                        <td className="py-2 pr-3 text-app-text-muted">{col2[i]}</td>
                        <td className="py-2 pr-3 text-app-text-muted">{col3[i]}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

/** 注釈テキスト */
const Note: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-app-lg text-app-text-muted mt-2 leading-relaxed">{text}</p>
);

// ========================================
// プライバシーポリシー
// ========================================

export const PrivacyPolicyPage: React.FC = () => {
    const { t } = useTranslation();
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

// ========================================
// 利用規約
// ========================================

export const TermsPage: React.FC = () => {
    const { t } = useTranslation();
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
        </LegalPageLayout>
    );
};

// ========================================
// 特定商取引法に基づく表記
// ========================================

/** テーブル行 */
const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <tr className="border-b border-app-border">
        <th className="text-left text-app-2xl font-semibold py-2.5 pr-4 align-top whitespace-nowrap w-[140px]">{label}</th>
        <td className="text-app-2xl text-app-text-muted py-2.5">{value}</td>
    </tr>
);

export const CommercialDisclosurePage: React.FC = () => {
    const { t } = useTranslation();
    const rows: [string, string][] = [
        [t('legal.commercial_seller'), t('legal.commercial_seller_value')],
        [t('legal.commercial_address'), t('legal.commercial_address_value')],
        [t('legal.commercial_phone'), t('legal.commercial_phone_value')],
        [t('legal.commercial_email'), t('legal.commercial_email_value')],
        [t('legal.commercial_manager'), t('legal.commercial_manager_value')],
        [t('legal.commercial_service'), t('legal.commercial_service_value')],
        [t('legal.commercial_price'), t('legal.commercial_price_value')],
        [t('legal.commercial_fees'), t('legal.commercial_fees_value')],
        [t('legal.commercial_payment'), t('legal.commercial_payment_value')],
        [t('legal.commercial_payment_timing'), t('legal.commercial_payment_timing_value')],
        [t('legal.commercial_delivery'), t('legal.commercial_delivery_value')],
        [t('legal.commercial_refund'), t('legal.commercial_refund_value')],
    ];

    return (
        <LegalPageLayout>
            <h1 className="text-app-4xl font-bold mb-1">{t('legal.commercial_title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-6">{t('legal.commercial_last_updated')}</p>

            <table className="w-full">
                <tbody>
                    {rows.map(([label, value], i) => (
                        <InfoRow key={i} label={label} value={value} />
                    ))}
                </tbody>
            </table>
        </LegalPageLayout>
    );
};

// ========================================
// 共通レイアウト
// ========================================

const LegalPageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const { theme, setTheme } = useThemeStore();
    const { runTransition } = useTransitionOverlay();
    const toggleTheme = () => runTransition(() => setTheme(theme === 'dark' ? 'light' : 'dark'), 'theme');

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
                        className="flex items-center gap-1.5 text-app-2xl text-app-text-muted hover:text-app-text transition-colors"
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
                <p className="text-app-xs text-app-text-muted">
                    © SQUARE ENIX CO., LTD. All Rights Reserved.
                </p>
            </footer>
        </div>
    );
};
