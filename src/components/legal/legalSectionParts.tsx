import React from 'react';

/** i18nキーで「,」区切りのリストを配列に変換 */
export function splitItems(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/** セクション: タイトル + 本文 */
export const Section: React.FC<{ title: string; id?: string; children: React.ReactNode }> = ({ title, id, children }) => (
    <section id={id} className="mb-8 scroll-mt-6">
        <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">{title}</h2>
        {children}
    </section>
);

/** 箇条書きリスト */
export const BulletList: React.FC<{ items: string[] }> = ({ items }) => (
    <ul className="list-disc list-inside space-y-1 text-app-2xl text-app-text-muted">
        {items.map((item, i) => (
            <li key={i}>{item}</li>
        ))}
    </ul>
);

/** サブセクション（太字タイトル + リスト） */
export const SubSection: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div className="mb-3">
        <h3 className="text-app-2xl font-semibold mb-1">{title}</h3>
        <BulletList items={items} />
    </div>
);

/** 3列テーブル（外部サービス一覧・データ保存一覧用） */
export const ThreeColumnTable: React.FC<{
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
export const Note: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-app-lg text-app-text-muted mt-2 leading-relaxed">{text}</p>
);

/** ページ内リンク(内部は同一タブ、外部は別タブ) */
export const InlineLink: React.FC<{ href: string; external?: boolean; children: React.ReactNode }> = ({ href, external, children }) => (
    <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="underline underline-offset-2 hover:text-app-text"
    >
        {children}
    </a>
);

