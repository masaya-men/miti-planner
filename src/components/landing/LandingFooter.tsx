import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/[0.06] py-6 px-6 md:px-16">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-[11px] text-white/30 text-center md:text-left">
          <div>{t('portal.footer.copyright')}</div>
          <div className="text-[10px] mt-0.5">{t('portal.footer.disclaimer')}</div>
        </div>
        <div className="flex gap-4 text-[11px] text-white/40">
          <Link to="/privacy" className="hover:text-white/60 transition-colors">{t('portal.footer.privacy')}</Link>
          <Link to="/terms" className="hover:text-white/60 transition-colors">{t('portal.footer.terms')}</Link>
          <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors">𝕏</a>
        </div>
      </div>
    </footer>
  );
}
