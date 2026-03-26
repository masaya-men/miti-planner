import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function CTASection() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <section className="py-32 px-6 flex flex-col items-center text-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-3">{t('portal.cta.heading')}</h2>
      <p className="text-sm text-white/40 mb-8">{t('portal.cta.sub')}</p>
      <button
        onClick={() => navigate('/miti')}
        className="px-8 py-3.5 bg-white text-black rounded-lg text-sm font-bold hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all"
      >
        {t('portal.cta.button')}
      </button>
      <div className="mt-5 text-xs text-white/25">
        ☕ <a href="https://ko-fi.com/lopoly" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition-colors">
          {t('portal.cta.kofi')}
        </a>
      </div>
    </section>
  );
}
