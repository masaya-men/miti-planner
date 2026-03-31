// src/components/tutorial/TutorialMenu.tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Check } from 'lucide-react';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TUTORIALS, TUTORIAL_IDS } from '../../data/tutorialDefinitions';
import clsx from 'clsx';

interface TutorialMenuProps {
  /** ConsolidatedHeaderから受け取るボタンスタイル */
  btnClassName: string;
}

/**
 * 「チュートリアルを見る」ボタン + ドロップダウンメニュー。
 * ボタンの見た目は既存のまま。クリックでメニュー表示。
 */
export function TutorialMenu({ btnClassName }: TutorialMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const completed = useTutorialStore(s => s.completed);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className={btnClassName}
      >
        <HelpCircle size={14} className="group-hover:rotate-12 transition-transform duration-300 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em]">
          {t('app.view_tutorial')}
        </span>
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-1 min-w-[180px] rounded-lg border border-app-text/15 bg-app-bg shadow-lg py-1 z-50"
        >
          {TUTORIAL_IDS.map(id => {
            const tutorial = TUTORIALS[id];
            const isDone = completed[id] ?? false;
            return (
              <button
                key={id}
                onClick={() => {
                  setOpen(false);
                  useTutorialStore.getState().startTutorial(id);
                }}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors',
                  'hover:bg-app-text/5 text-app-text'
                )}
              >
                <span className="flex-1">{t(tutorial.nameKey)}</span>
                {isDone && (
                  <Check size={12} className="text-[#22c55e] flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
