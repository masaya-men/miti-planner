import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const SECTION_KEYS = [
  'portal.hero.label',
  'portal.miti.label',
  null,
  'portal.housing.label',
  'portal.cta.heading',
] as const;

export function ScrollProgress() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const ratio = window.scrollY / total;
      setProgress(ratio);
      setSectionIndex(Math.min(4, Math.floor(ratio * 5)));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const sectionKey = SECTION_KEYS[sectionIndex];
  const label = sectionKey ? t(sectionKey) : `0${sectionIndex + 1}`;

  return (
    <div className="fixed right-6 md:right-10 top-0 bottom-0 z-[100000] flex items-center pointer-events-none">
      <div className="relative flex flex-col items-center gap-4">
        {/* トラック */}
        <div className="relative w-[2px] bg-white/[0.08] rounded-full" style={{ height: '40vh' }}>
          {/* 進行ライン */}
          <div
            className="absolute top-0 left-0 w-full bg-white/40 origin-top rounded-full transition-none"
            style={{ height: `${progress * 100}%` }}
          />
          {/* ドット */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white transition-none"
            style={{ top: `${progress * 100}%`, marginTop: '-6px' }}
          >
            <div className="absolute inset-[-6px] rounded-full border border-white/20 animate-ping" style={{ animationDuration: '2.5s' }} />
          </div>
        </div>

        {/* セクション名 */}
        <div
          className="text-[11px] text-white/25 tracking-[3px] uppercase font-mono whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
