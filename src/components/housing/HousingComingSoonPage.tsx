/**
 * /housing アクセス時に表示する Coming Soon ページ
 *
 * Foundation (Sub-spec 1) では UI 本体は実装せず、
 * 「準備中」を多言語で表示するだけのシンプルなランディング。
 *
 * Sub-spec 2 でこのファイルが本格的なギャラリー画面に置き換わる予定。
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §11
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { HOUSING_ROUTES } from '../../constants/housing';

export const HousingComingSoonPage: React.FC = () => {
  useCanonicalUrl(HOUSING_ROUTES.TOP);
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t('app.page_title_housing');
  }, [t]);

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16"
      style={{ backgroundColor: 'var(--color-app-bg)', color: 'var(--color-app-text)' }}
    >
      <article className="max-w-2xl text-center">
        {/* eyebrow */}
        <p
          className="text-app-sm tracking-[0.2em] uppercase mb-3"
          style={{ color: 'var(--color-app-text-muted)' }}
        >
          {t('housing.coming_soon.eyebrow')}
        </p>

        {/* title */}
        <h1
          className="text-app-5xl font-bold mb-6"
          style={{ color: 'var(--color-app-text)' }}
        >
          {t('housing.coming_soon.title')}
        </h1>

        {/* lead */}
        <p
          className="text-app-2xl leading-relaxed mb-4"
          style={{ color: 'var(--color-app-text)' }}
        >
          {t('housing.coming_soon.lead')}
        </p>

        {/* detail */}
        <p
          className="text-app-lg leading-relaxed mb-10"
          style={{ color: 'var(--color-app-text-muted)' }}
        >
          {t('housing.coming_soon.detail')}
        </p>

        {/* back link */}
        <Link
          to="/"
          className="inline-block text-app-md tracking-[0.15em] uppercase font-mono border-b border-current pb-1 transition-opacity duration-200 hover:opacity-70"
          style={{ color: 'var(--color-app-text)' }}
        >
          {t('housing.coming_soon.back_to_top')}
        </Link>
      </article>
    </main>
  );
};
