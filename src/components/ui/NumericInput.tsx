import React, { useEffect, useRef, useState } from 'react';

export interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** 0=整数(既定)。>0 で小数を許可・表示。 */
  decimalPlaces?: number;
  /** true で blur 時に桁区切り(50,000)整形。既定 false。 */
  thousandSeparator?: boolean;
  /** focus 時に全選択。既定 true。 */
  selectOnFocus?: boolean;
  className?: string;
  placeholder?: string;
}

const toHalfWidth = (s: string): string =>
  s.replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));

/** value → 表示文字列。sep=true で桁区切り。 */
function formatDisplay(value: number, decimalPlaces: number, sep: boolean): string {
  if (!Number.isFinite(value)) return '';
  if (sep) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.max(0, decimalPlaces),
    });
  }
  return String(value);
}

/** 入力中テキストを許容文字へ正規化（全角→半角・カンマ除去・小数/負号の最小限許可）。 */
function sanitize(raw: string, decimalPlaces: number, allowNegative: boolean): string {
  let s = toHalfWidth(raw).replace(/,/g, '');
  s = s.replace(decimalPlaces > 0 ? /[^0-9.\-]/g : /[^0-9\-]/g, '');
  // マイナスは先頭のみ
  const neg = allowNegative && s.startsWith('-');
  s = (neg ? '-' : '') + s.replace(/-/g, '');
  // 小数点は1つだけ
  if (decimalPlaces > 0) {
    const dot = s.indexOf('.');
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  }
  return s;
}

/** テキスト→数値。空/不正は null。 */
function parse(text: string): number | null {
  if (text === '' || text === '-' || text === '.') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export const NumericInput: React.FC<NumericInputProps> = ({
  value, onChange, min, max,
  decimalPlaces = 0, thousandSeparator = false, selectOnFocus = true,
  className, placeholder, ...rest
}) => {
  const allowNegative = min !== undefined && min < 0;
  const [text, setText] = useState(() => formatDisplay(value, decimalPlaces, thousandSeparator));
  const focusedRef = useRef(false);

  // 外部 value 変更に追従（フォーカス中はクロバーしない）
  useEffect(() => {
    if (!focusedRef.current) setText(formatDisplay(value, decimalPlaces, thousandSeparator));
  }, [value, decimalPlaces, thousandSeparator]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = sanitize(e.target.value, decimalPlaces, allowNegative);
    setText(s);
    const n = parse(s);
    onChange(n === null ? 0 : n);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    setText(formatDisplay(value, decimalPlaces, false)); // 編集中は桁区切りを外す
    if (selectOnFocus) e.target.select();
  };

  const handleBlur = () => {
    focusedRef.current = false;
    let n = parse(text) ?? 0;
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    onChange(n);
    setText(formatDisplay(n, decimalPlaces, thousandSeparator));
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={decimalPlaces > 0 ? 'decimal' : 'numeric'}
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
    />
  );
};
