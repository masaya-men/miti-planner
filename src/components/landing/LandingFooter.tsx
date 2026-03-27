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
      '_blank', 'noopener,noreferrer'
    );
  }, [shareText]);

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(SITE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <footer className="border-t border-white/[0.06] py-10 px-6 md:px-16">
      <div className="max-w-6xl mx-auto">
        {/* 共有: Xアイコン + 共有ボタン */}
        <div className="mb-8 flex items-center gap-3">
          {/* X — 常時表示、一番目立つ */}
          <button
            onClick={shareOnX}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 hover:border-white/40 text-xs text-white/50 hover:text-white/80 transition-all duration-200"
          >
            <span className="text-sm font-bold">𝕏</span>
          </button>

          {/* 共有する — URLコピー */}
          <div className="relative group">
            <button
              onClick={copyUrl}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-white/15 hover:border-white/40 text-xs text-white/50 hover:text-white/80 transition-all duration-200"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              {copied ? t('portal.footer.share_copied') : t('portal.footer.share')}
            </button>
            {/* ツールチップ */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-md bg-white/10 text-[10px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
              URL をコピー
            </div>
          </div>
        </div>

        {/* 下段 */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-[11px] text-white/30 text-center md:text-left">
            <div>{t('portal.footer.copyright')}</div>
            <div className="text-[10px] mt-0.5">{t('portal.footer.disclaimer')}</div>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-4 text-[11px] text-white/40">
            <a href="https://discord.gg/V288kfPFMG" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">{t('footer.discord')}</a>
            <a href="https://ko-fi.com/lopoly" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">{t('footer.kofi')}</a>
            <Link to="/privacy" className="hover:text-white/60 transition-colors">{t('portal.footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-white/60 transition-colors">{t('portal.footer.terms')}</Link>
            <Link to="/commercial" className="hover:text-white/60 transition-colors">{t('portal.footer.commercial')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
