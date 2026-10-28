/**
 * テンプレートエディター — テキスト/数値のインライン編集セル
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { highlightTextClass, type CellHighlight } from './templateEditorHelpers';

interface EditableCellProps {
  value: string;
  highlight: CellHighlight;
  showAutoLabel?: boolean;
  isUntranslatedPlaceholder?: boolean;
  inputType?: 'text' | 'number';
  onCommit: (value: string) => void;
}

export function EditableCell({
  value,
  highlight,
  showAutoLabel = false,
  isUntranslatedPlaceholder = false,
  inputType = 'text',
  onCommit,
}: EditableCellProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  function handleCommit() {
    setEditing(false);
    if (draft !== value) {
      onCommit(draft);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="w-full bg-transparent border-b border-app-text/40 text-app-lg text-app-text focus:outline-none py-0.5"
      />
    );
  }

  if (isUntranslatedPlaceholder) {
    return (
      <span
        onClick={() => setEditing(true)}
        className="block w-full text-app-lg text-app-text-muted/60 border-b border-dashed border-app-text/20 cursor-pointer py-0.5 select-none"
      >
        {t('admin.tpl_editor_untranslated_placeholder')}
      </span>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`block w-full text-app-lg cursor-pointer py-0.5 select-none ${highlightTextClass(highlight)}`}
    >
      {value || <span className="text-app-text-muted/40">—</span>}
      {showAutoLabel && (
        <span className="ml-1 text-app-sm text-blue-400 opacity-70">{t('admin.tpl_editor_auto_label')}</span>
      )}
    </span>
  );
}
