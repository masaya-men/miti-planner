/**
 * テンプレートエディター — 5言語編集ポップオーバー
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { LocalizedString } from '../../../types';

interface LocalizedEditPopoverProps {
  title: string;
  initial: LocalizedString;
  labels: { ja: string; en: string; zh: string; 'zh-Hant': string; ko: string };
  position: { x: number; y: number };
  onApply: (value: LocalizedString) => void;
  onCancel: () => void;
}

export function LocalizedEditPopover({ title, initial, labels, position, onApply, onCancel }: LocalizedEditPopoverProps) {
  const { t } = useTranslation();
  const [ja, setJa] = useState(initial.ja);
  const [en, setEn] = useState(initial.en);
  const [zh, setZh] = useState(initial.zh ?? '');
  const [zhHant, setZhHant] = useState(initial['zh-Hant'] ?? '');
  const [ko, setKo] = useState(initial.ko ?? '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  function handleApply() {
    onApply({
      ja,
      en,
      ...(zh ? { zh } : {}),
      ...(zhHant ? { 'zh-Hant': zhHant } : {}),
      ...(ko ? { ko } : {}),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }

  const inputClass = 'w-full px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const labelClass = 'text-app-base text-app-text-muted';

  return (
    <div
      ref={popoverRef}
      onKeyDown={handleKeyDown}
      className="fixed z-[99999] bg-app-bg border border-app-text/20 rounded-lg p-3 shadow-lg min-w-[240px]"
      style={{ top: position.y, left: position.x }}
    >
      <h4 className="text-app-lg font-medium mb-2">{title}</h4>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>{labels.ja}</label>
          <input type="text" value={ja} onChange={(e) => setJa(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className={labelClass}>{labels.en}</label>
          <input type="text" value={en} onChange={(e) => setEn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{labels.zh}</label>
          <input type="text" value={zh} onChange={(e) => setZh(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
        <div>
          <label className={labelClass}>{labels['zh-Hant']}</label>
          <input type="text" value={zhHant} onChange={(e) => setZhHant(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
        <div>
          <label className={labelClass}>{labels.ko}</label>
          <input type="text" value={ko} onChange={(e) => setKo(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-app-lg px-3 py-1 rounded border border-app-text/20 text-app-text-muted hover:bg-app-text/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_phase_edit_cancel')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="text-app-lg px-3 py-1 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_phase_edit_apply')}
        </button>
      </div>
    </div>
  );
}
