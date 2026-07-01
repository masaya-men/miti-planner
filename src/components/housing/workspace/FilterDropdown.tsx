import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  /** 選択中の value 群 (single は 0〜1 件、multi は 0〜N 件)。 */
  selected: string[];
  mode: 'single' | 'multi';
  onSelect: (value: string) => void;
  /** 何も選ばれていないときの要約表示 (例「すべて」)。 */
  allLabel: string;
  /** multi で複数選択時の要約 (例 n => `${n}件選択`)。 */
  countLabel?: (n: number) => string;
}

/**
 * 参考UI 準拠のフィルタ用ドロップダウン。overflow パネル内でも安全なように
 * 浮くポップオーバーではなく **インライン展開 (アコーディオン)** で開く。
 * single = 1つ選ぶ / multi = 複数チェック。機能は複数選択を維持しつつ見た目をドロップダウン風に。
 */
export const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  selected,
  mode,
  onSelect,
  allLabel,
  countLabel,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 外側クリックで閉じる (同一パネル内の他ドロップダウンを触ったときなど)。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const labelOf = (value: string) => options.find((o) => o.value === value)?.label ?? value;
  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? labelOf(selected[0])
        : (countLabel?.(selected.length) ?? `${selected.length}`);

  const handleSelect = (value: string) => {
    onSelect(value);
    if (mode === 'single') setOpen(false); // 1つ選んだら閉じる
  };

  return (
    <div className="housing-filter-field" ref={rootRef} data-open={open ? 'true' : 'false'}>
      <span className="housing-filter-field-label">{label}</span>
      <button
        type="button"
        className="housing-filter-select"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`housing-filter-select-value${selected.length === 0 ? ' is-placeholder' : ''}`}
        >
          {summary}
        </span>
        <ChevronDown size={15} aria-hidden="true" className="housing-filter-select-chevron" />
      </button>
      {open && (
        <ul className="housing-filter-options" role="listbox" aria-label={label}>
          {options.map((o) => {
            const isSel = selected.includes(o.value);
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  className="housing-filter-option"
                  data-selected={isSel ? 'true' : 'false'}
                  onClick={() => handleSelect(o.value)}
                >
                  <span className="housing-filter-option-check" aria-hidden="true">
                    {isSel && <Check size={13} />}
                  </span>
                  <span className="housing-filter-option-label">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
