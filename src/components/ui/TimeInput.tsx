import React, { useEffect, useRef, useState } from 'react';
import { parseTimeString, formatTime } from '../../utils/templateConversions';

export interface TimeInputProps {
  /** 秒。null=空欄。 */
  value: number | null;
  onChange: (sec: number | null) => void;
  /** 上限秒（超過時 clamp）。 */
  maxSeconds?: number;
  selectOnFocus?: boolean;
  className?: string;
  placeholder?: string;
}

const toHalfWidth = (s: string): string =>
  s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/：/g, ':')
    .replace(/[ー－−—]/g, '-');

const clampMax = (n: number, maxSeconds?: number) =>
  maxSeconds !== undefined && n > maxSeconds ? maxSeconds : n;

export const TimeInput: React.FC<TimeInputProps> = ({
  value, onChange, maxSeconds, selectOnFocus = true, className, placeholder, ...rest
}) => {
  const [text, setText] = useState(() => (value === null ? '' : formatTime(value)));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(value === null ? '' : formatTime(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = toHalfWidth(e.target.value).replace(/[^0-9:.\-]/g, '');
    setText(raw);
    if (raw.trim() === '') { onChange(null); return; }
    const n = parseTimeString(raw);
    if (n === null) return; // 途中の不正(例 "6:")は保留=最後の有効値を保つ
    onChange(clampMax(n, maxSeconds));
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    if (selectOnFocus) e.target.select();
  };

  const handleBlur = () => {
    focusedRef.current = false;
    if (text.trim() === '') { onChange(null); return; }
    const n = parseTimeString(text);
    if (n === null) { setText(value === null ? '' : formatTime(value)); return; }
    const c = clampMax(n, maxSeconds);
    onChange(c);
    setText(formatTime(c));
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="text"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
};
