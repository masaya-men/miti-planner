/**
 * テンプレートエディター — セレクトボックスのインライン編集セル
 */
import { useState, useRef, useEffect } from 'react';
import { highlightTextClass, type CellHighlight } from './templateEditorHelpers';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownCellProps {
  value: string;
  options: DropdownOption[];
  highlight: CellHighlight;
  onCommit: (value: string) => void;
}

export function DropdownCell({ value, options, highlight, onCommit }: DropdownCellProps) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (open && selectRef.current) {
      selectRef.current.focus();
    }
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    onCommit(e.target.value);
    setOpen(false);
  }

  const label = options.find((o) => o.value === value)?.label ?? value;

  if (open) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={handleChange}
        onBlur={() => setOpen(false)}
        className="w-full bg-app-bg text-app-lg text-app-text border border-app-text/30 rounded focus:outline-none [&>option]:bg-app-bg [&>option]:text-app-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <span
      onClick={() => setOpen(true)}
      className={`block w-full text-app-lg cursor-pointer py-0.5 select-none ${highlightTextClass(highlight)}`}
    >
      {label}
    </span>
  );
}
