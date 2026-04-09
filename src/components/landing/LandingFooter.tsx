import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const SITE_URL = 'https://lopoly.app';

export function LandingFooter() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const shareText = t('portal.footer.share_text');

  const shareOnX = useCallback(() => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(SITE_URL)}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, [shareText]);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(SITE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <footer className="relative border-t border-app-border py-10 px-6 md:px-16 bg-app-bg">
      {/* 上部グラデーショントランジション */}
      <div
        className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, var(--color-lp-bg), transparent)',
          transform: 'translateY(-100%)',
        }}
      />

      <div className="max-w-6xl mx-auto">
        {/* 共有ボタン: 中央寄せ */}
        <div className="mb-8 flex items-center justify-center gap-3">
          {/* X */}
          <button
            onClick={shareOnX}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-app-border text-app-text-muted hover:text-app-text hover:border-app-text transition-all duration-200 text-app-lg"
            data-hover
          >
            <span className="text-app-xl font-bold">𝕏</span>
          </button>

          {/* URLコピー */}
          <button
            onClick={copyUrl}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-app-border text-app-text-muted hover:text-app-text hover:border-app-text transition-all duration-200 text-app-lg"
            data-hover
          >
            <svg
              viewBox="0 0 24 24"
              className="w-3.5 h-3.5 fill-none stroke-current"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {copied ? t('portal.footer.share_copied') : t('portal.footer.share')}
          </button>
        </div>

        {/* リンク群: 中央寄せ */}
        <div className="mb-6 flex flex-wrap justify-center gap-4 text-app-md text-app-text-muted">
          <a
            href="https://discord.gg/z7uypbJSnN"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-app-text transition-colors"
            data-hover
          >
            {t('footer.discord')}
          </a>
          <a
            href="https://x.com/lopoly_app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-app-text transition-colors"
            data-hover
          >
            {t('footer.x_official')}
          </a>
          <a
            href="https://ko-fi.com/lopoly"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-app-text transition-colors"
            data-hover
          >
            {t('footer.kofi')}
          </a>
          <Link
            to="/privacy"
            className="hover:text-app-text transition-colors"
            data-hover
          >
            {t('portal.footer.privacy')}
          </Link>
          <Link
            to="/terms"
            className="hover:text-app-text transition-colors"
            data-hover
          >
            {t('portal.footer.terms')}
          </Link>
          <Link
            to="/commercial"
            className="hover:text-app-text transition-colors"
            data-hover
          >
            {t('portal.footer.commercial')}
          </Link>
        </div>

        {/* コピーライト + 免責事項: 中央寄せ */}
        <div className="text-center text-app-md text-app-text-muted">
          <div>{t('portal.footer.copyright')}</div>
          <div className="text-app-base mt-0.5 opacity-70">
            {t('portal.footer.disclaimer')}
          </div>
        </div>
      </div>
    </footer>
  );
}
