// src/components/tutorial/TutorialMenu.tsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Check } from 'lucide-react';
import { useTutorialStore } from '../../store/useTutorialStore';
import { TUTORIALS, TUTORIAL_IDS } from '../../data/tutorialDefinitions';
import clsx from 'clsx';

interface TutorialMenuProps {
  btnClassName: string;
}

/**
 * 「チュートリアルを見る」ボタン + ドロップダウンメニュー。
 * ヘッダーのoverflow-hiddenを回避するためPortalでbody直下にレンダリング。
 */
export function TutorialMenu({ btnClassName }: TutorialMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const completed = useTutorialStore(s => s.completed);

  // メニュー位置
  const [pos, setPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, [open]);

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(prev => !prev)}
        className={btnClassName}
      >
        <HelpCircle size={14} className="group-hover:rotate-12 transition-transform duration-300 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em]">
          {t('app.view_tutorial')}
        </span>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed min-w-[180px] rounded-lg border border-app-text/15 bg-app-bg shadow-lg py-1 z-[99999]"
          style={{ top: pos.top, right: pos.right }}
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
                  'w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors cursor-pointer',
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
        </div>,
        document.body
      )}
    </>
  );
}
