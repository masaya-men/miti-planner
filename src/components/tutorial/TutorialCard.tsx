// src/components/tutorial/TutorialCard.tsx
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useThemeStore } from '../../store/useThemeStore';
import type { ContentLanguage } from '../../store/useThemeStore';

const LANGUAGES: { code: ContentLanguage; label: string }[] = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
];

interface TutorialCardProps {
  messageKey: string;
  descriptionKey?: string;
  image?: string;
  top: number;
  left: number;
  visible: boolean;
  onSkip?: () => void;
  /** 「わかった」ボタン押下時のコールバック（pill: 'next' ステップ用） */
  onNext?: () => void;
  /** ステップ進捗 "3 / 12" 等 */
  stepLabel?: string;
  /** 言語切替ボタンを表示 */
  showLanguageSwitcher?: boolean;
}

/**
 * チュートリアル吹き出しカード。
 * ダーク=黒背景白文字、ライト=白背景黒文字。
 * 左端に緑のアクセントライン。
 */
export function TutorialCard({
  messageKey,
  descriptionKey,
  image,
  top,
  left,
  visible,
  onSkip,
  onNext,
  stepLabel,
  showLanguageSwitcher,
}: TutorialCardProps) {
  const { t, i18n } = useTranslation();
  const { setContentLanguage } = useThemeStore();
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // クリック外で閉じる
  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [langOpen]);

  if (!visible) return null;

  const handleLangChange = (code: ContentLanguage) => {
    i18n.changeLanguage(code);
    setContentLanguage(code);
    setLangOpen(false);
  };

  return (
    <motion.div
      className="fixed z-[10002] pointer-events-auto"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, top, left }}
      exit={{ opacity: 0, y: -4 }}
      transition={{
        top: { type: 'spring', stiffness: 300, damping: 22 },
        left: { type: 'spring', stiffness: 300, damping: 16, mass: 0.8 },
        opacity: { duration: 0.15 },
        y: { duration: 0.2 },
      }}
      style={{ top, left, maxWidth: 280 }}
    >
      <div className="rounded-xl shadow-xl bg-app-bg border border-app-text/10 overflow-hidden">
        {/* 緑アクセントバー */}
        <div className="h-[3px] w-full rounded-t-xl" style={{ backgroundColor: '#22c55e' }} />

        <div className="px-4 pt-3 pb-3">
          {/* ステップカウンター + 言語切替 */}
          {stepLabel && (
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-app-sm font-bold tracking-widest uppercase text-app-text-muted" style={{ color: '#22c55e' }}>
                STEP {stepLabel}
              </div>
              {showLanguageSwitcher && (
                <div ref={langRef} className="relative">
                  <button
                    onClick={() => setLangOpen(v => !v)}
                    className="flex items-center gap-1 text-app-text-muted hover:text-app-text transition-colors cursor-pointer p-0.5 rounded"
                  >
                    <Globe size={13} />
                    <span className="text-app-sm font-bold uppercase">{i18n.language}</span>
                  </button>
                  {langOpen && (
                    <div className="absolute right-0 top-full mt-1 bg-app-bg border border-app-text/15 rounded-lg shadow-xl py-1 min-w-[110px] z-[10010]">
                      {LANGUAGES.map(({ code, label }) => (
                        <button
                          key={code}
                          onClick={() => handleLangChange(code)}
                          className={`w-full text-left px-3 py-1.5 text-app-base transition-colors cursor-pointer ${
                            i18n.language === code
                              ? 'bg-app-toggle text-app-toggle-text font-black'
                              : 'text-app-text hover:bg-app-text/5 font-medium'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {image && (
            <img
              src={image}
              alt=""
              className="w-full rounded-lg mb-2.5"
              style={{ maxHeight: 100, objectFit: 'cover' }}
            />
          )}

          <p className="text-app-xl font-bold text-app-text leading-snug">
            {t(messageKey)}
          </p>
          {descriptionKey && (
            <p className="text-app-md text-app-text-muted mt-1 leading-relaxed">
              {t(descriptionKey)}
            </p>
          )}

          {onNext && (
            <button
              onClick={onNext}
              className="mt-3 w-full py-2 rounded-lg text-app-md font-bold text-white transition-all hover:opacity-80 active:scale-95 cursor-pointer"
              style={{ backgroundColor: '#22c55e' }}
            >
              {t('tutorial.got_it')}
            </button>
          )}

          {onSkip && !onNext && (
            <button
              onClick={onSkip}
              className="text-app-base text-app-text-muted mt-2 underline underline-offset-2 hover:text-app-text transition-colors cursor-pointer"
            >
              {t('tutorial.skip')}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
