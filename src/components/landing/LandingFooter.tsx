import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const SITE_URL = 'https://lopoly.app';

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const cls =
    'group relative font-mono text-[10px] tracking-[0.12em] uppercase transition-colors duration-200 hover:opacity-100';

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        style={{ color: 'var(--color-lp-text-muted)' }}
      >
        {children}
        <span
          className="absolute left-0 -bottom-px h-px w-0 group-hover:w-full transition-all duration-300"
          style={{ backgroundColor: 'var(--color-lp-text-muted)' }}
        />
      </a>
    );
  }

  return (
    <Link
      to={href}
      className={cls}
      style={{ color: 'var(--color-lp-text-muted)' }}
    >
      {children}
      <span
        className="absolute left-0 -bottom-px h-px w-0 group-hover:w-full transition-all duration-300"
        style={{ backgroundColor: 'var(--color-lp-text-muted)' }}
      />
    </Link>
  );
}

export function LandingFooter() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const shareText = t('portal.footer.share_text');

  const shareOnX = useCallback(() => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(SITE_URL)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [shareText]);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(SITE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <footer
      className="border-t px-6 py-12"
      style={{
        borderColor: 'var(--color-lp-grid)',
        backgroundColor: 'var(--color-lp-bg)',
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Top row: share + links */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
          {/* Share */}
          <div className="flex items-center gap-4">
            <button
              onClick={shareOnX}
              className="group relative font-mono text-[10px] tracking-[0.12em] uppercase"
              style={{ color: 'var(--color-lp-text-muted)' }}
            >
              𝕏 Share
              <span
                className="absolute left-0 -bottom-px h-px w-0 group-hover:w-full transition-all duration-300"
                style={{ backgroundColor: 'var(--color-lp-text-muted)' }}
              />
            </button>
            <button
              onClick={copyUrl}
              className="group relative font-mono text-[10px] tracking-[0.12em] uppercase"
              style={{ color: 'var(--color-lp-text-muted)' }}
            >
              {copied ? t('portal.footer.share_copied') : t('portal.footer.share')}
              <span
                className="absolute left-0 -bottom-px h-px w-0 group-hover:w-full transition-all duration-300"
                style={{ backgroundColor: 'var(--color-lp-text-muted)' }}
              />
            </button>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4">
            <FooterLink href="https://discord.gg/z7uypbJSnN" external>
              {t('footer.discord')}
            </FooterLink>
            <FooterLink href="https://x.com/lopoly_app" external>
              {t('footer.x_official')}
            </FooterLink>
            <FooterLink href="/support">
              {t('footer.kofi')}
            </FooterLink>
            <FooterLink href="/privacy">
              {t('portal.footer.privacy')}
            </FooterLink>
            <FooterLink href="/terms">
              {t('portal.footer.terms')}
            </FooterLink>
            <FooterLink href="/commercial">
              {t('portal.footer.commercial')}
            </FooterLink>
          </div>
        </div>

        {/* Copyright */}
        <div
          className="font-mono text-[9px] tracking-[0.1em] leading-relaxed"
          style={{ color: 'var(--color-lp-text-muted)', opacity: 0.6 }}
        >
          <div>{t('portal.footer.copyright')}</div>
          <div className="mt-1">{t('portal.footer.disclaimer')}</div>
        </div>
      </div>
    </footer>
  );
}
