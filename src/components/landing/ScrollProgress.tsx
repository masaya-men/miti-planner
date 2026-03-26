import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// セクション名（スクロール位置に応じて切り替わる）
const SECTION_KEYS = [
  'portal.hero.label',
  'portal.miti.label',
  null, // Features（ラベルなし→番号だけ）
  'portal.housing.label',
  'portal.cta.heading',
] as const;

export function ScrollProgress() {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [sectionIndex, setSectionIndex] = useState(0);
  const dotRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

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
    <div className="fixed right-4 md:right-6 top-0 bottom-0 z-[100000] flex items-center pointer-events-none">
      <div className="relative flex flex-col items-center gap-3">
        {/* トラック（縦ライン） */}
        <div
          ref={trackRef}
          className="relative w-px bg-white/[0.08]"
          style={{ height: '30vh' }}
        >
          {/* 進行ライン */}
          <div
            className="absolute top-0 left-0 w-full bg-white/30 origin-top transition-none"
            style={{ height: `${progress * 100}%` }}
          />
          {/* ドット */}
          <div
            ref={dotRef}
            className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white transition-none"
            style={{ top: `${progress * 100}%`, marginTop: '-4px' }}
          >
            {/* ドットのパルスリング */}
            <div className="absolute inset-[-4px] rounded-full border border-white/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
        </div>

        {/* セクション名 — 縦書き */}
        <div
          className="text-[9px] text-white/20 tracking-[3px] uppercase font-mono whitespace-nowrap"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}
