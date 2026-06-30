# 数値入力 業界水準化（Phase 1）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザーが触る数値入力欄を、業界標準（文字列保持・空欄OK・NaN防止・桁区切りはblur整形・全角正規化・全選択維持）の共通部品 `NumericInput` / `TimeInput` に統一する。

**Architecture:** `src/components/ui/` に再利用部品を2つ新設。内部は文字列 state で表示を制御し、`value:number`(NumericInput)／`value:number|null`(TimeInput) のドロップイン互換にして呼び出し側のロジックを原則無変更で差し替える。TimeInput は正典 `parseTimeString`/`formatTime`（`src/utils/templateConversions.ts`）を利用し、各所の重複ヘルパーを解消する。

**Tech Stack:** React 19 + TypeScript（strict / erasableSyntaxOnly）、Vitest + @testing-library/react（happy-dom）、Tailwind。

## Global Constraints

- 言語: コメント・ドキュメントは日本語。
- i18n: 文言は i18n キー経由（本計画は新規文言を増やさない。既存キー流用）。
- TypeScript: Vercel は `tsc -b` 厳密。**未使用 import / 変数を残さない**（各タスクの build で除去確認）。
- テスト: happy-dom 環境。`// @vitest-environment happy-dom` をテスト先頭に付与。
- スコープ: **ユーザー向けのみ**。管理画面（admin）49サイト・housing・HeaderTimeInput・ActivityScrub は**対象外**（spec の Phase 2/除外理由参照）。
- 既存挙動の契約維持: 移行先の `value`/`onChange` 型・保存ロジックは変えない（NumericInput は `number`、TimeInput は `number|null`）。
- 全選択 on focus は**残す**（`selectOnFocus` 既定 true）。
- 桁区切りは **blur 時のみ**整形（live整形＝カーソル飛びは禁止）。

---

### Task 1: `NumericInput` 共通部品

**Files:**
- Create: `src/components/ui/NumericInput.tsx`
- Test: `src/components/ui/__tests__/NumericInput.test.tsx`

**Interfaces:**
- Produces: `export interface NumericInputProps { value: number; onChange: (value: number) => void; min?: number; max?: number; decimalPlaces?: number; thousandSeparator?: boolean; selectOnFocus?: boolean; className?: string; placeholder?: string; }` および `export const NumericInput: React.FC<NumericInputProps>`。`data-testid`/`data-tutorial`/`aria-label` 等は `...rest` で透過。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/__tests__/NumericInput.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumericInput } from '../NumericInput';

const get = () => screen.getByTestId('n') as HTMLInputElement;

describe('NumericInput', () => {
  it('桁区切りで初期表示する(非フォーカス時)', () => {
    render(<NumericInput value={50000} onChange={() => {}} thousandSeparator data-testid="n" />);
    expect(get().value).toBe('50,000');
  });

  it('入力すると数値を emit する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '1234' } });
    expect(onChange).toHaveBeenLastCalledWith(1234);
  });

  it('空欄を許す(表示は空・値は0を emit)', () => {
    const onChange = vi.fn();
    render(<NumericInput value={5} onChange={onChange} data-testid="n" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '' } });
    expect(get().value).toBe('');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('全角数字を半角化する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '５０００' } });
    expect(onChange).toHaveBeenLastCalledWith(5000);
  });

  it('blur で max を clamp し整形する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} min={0} max={100} thousandSeparator data-testid="n" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '150' } });
    fireEvent.blur(get());
    expect(onChange).toHaveBeenLastCalledWith(100);
    expect(get().value).toBe('100');
  });

  it('blur で min を clamp する', () => {
    const onChange = vi.fn();
    render(<NumericInput value={50} onChange={onChange} min={10} data-testid="n" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '3' } });
    fireEvent.blur(get());
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it('整数モードでドットを除去し NaN を防ぐ', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '1.2.3' } });
    expect(onChange).toHaveBeenLastCalledWith(123);
  });

  it('小数モードで小数を受ける', () => {
    const onChange = vi.fn();
    render(<NumericInput value={0} onChange={onChange} decimalPlaces={1} data-testid="n" />);
    fireEvent.change(get(), { target: { value: '1.5' } });
    expect(onChange).toHaveBeenLastCalledWith(1.5);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/ui/__tests__/NumericInput.test.tsx`
Expected: FAIL（`Cannot find module '../NumericInput'`）

- [ ] **Step 3: 最小実装を書く**

`src/components/ui/NumericInput.tsx`:

```tsx
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
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `npx vitest run src/components/ui/__tests__/NumericInput.test.tsx`
Expected: PASS（8 件）

- [ ] **Step 5: コミット**

```bash
git add src/components/ui/NumericInput.tsx src/components/ui/__tests__/NumericInput.test.tsx
git commit -m "feat(ui): NumericInput 共通部品(文字列保持/空欄OK/桁区切りblur整形/全角/NaN防止)"
```

---

### Task 2: `TimeInput` 共通部品

**Files:**
- Create: `src/components/ui/TimeInput.tsx`
- Test: `src/components/ui/__tests__/TimeInput.test.tsx`

**Interfaces:**
- Consumes: `parseTimeString`, `formatTime`（`src/utils/templateConversions.ts`・既存）。
- Produces: `export interface TimeInputProps { value: number | null; onChange: (sec: number | null) => void; maxSeconds?: number; selectOnFocus?: boolean; className?: string; placeholder?: string; }` および `export const TimeInput: React.FC<TimeInputProps>`。`...rest` で `data-testid` 等透過。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ui/__tests__/TimeInput.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TimeInput } from '../TimeInput';

const get = () => screen.getByTestId('t') as HTMLInputElement;

describe('TimeInput', () => {
  it('秒を M:SS で表示する', () => {
    render(<TimeInput value={375} onChange={() => {}} data-testid="t" />);
    expect(get().value).toBe('6:15');
  });

  it('null は空表示', () => {
    render(<TimeInput value={null} onChange={() => {}} data-testid="t" />);
    expect(get().value).toBe('');
  });

  it('"6:15" を秒に変換して emit', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '6:15' } });
    expect(onChange).toHaveBeenLastCalledWith(375);
  });

  it('裸の秒数も受ける', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '375' } });
    expect(onChange).toHaveBeenLastCalledWith(375);
  });

  it('全角 ６：１５ を受ける', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '６：１５' } });
    expect(onChange).toHaveBeenLastCalledWith(375);
  });

  it('空にすると null を emit', () => {
    const onChange = vi.fn();
    render(<TimeInput value={375} onChange={onChange} data-testid="t" />);
    fireEvent.focus(get());
    fireEvent.change(get(), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('maxSeconds で上限を clamp(emit時)', () => {
    const onChange = vi.fn();
    render(<TimeInput value={0} onChange={onChange} maxSeconds={100} data-testid="t" />);
    fireEvent.change(get(), { target: { value: '5:00' } });
    expect(onChange).toHaveBeenLastCalledWith(100);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/components/ui/__tests__/TimeInput.test.tsx`
Expected: FAIL（モジュール未定義）

- [ ] **Step 3: 最小実装を書く**

`src/components/ui/TimeInput.tsx`:

```tsx
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
```

- [ ] **Step 4: テストを実行して通過を確認**

Run: `npx vitest run src/components/ui/__tests__/TimeInput.test.tsx`
Expected: PASS（7 件）

- [ ] **Step 5: コミット**

```bash
git add src/components/ui/TimeInput.tsx src/components/ui/__tests__/TimeInput.test.tsx
git commit -m "feat(ui): TimeInput 共通部品(M:SS/裸秒/全角/空=null・正典parseTimeString利用)"
```

---

### Task 3: EventForm 移行（ダメージ×2 → NumericInput / 時刻 → TimeInput）

**Files:**
- Modify: `src/components/EventForm.tsx`
- Test（既存・回帰確認）: `src/components/__tests__/EventForm.time.test.tsx`, `EventForm.damage.test.tsx`

**Interfaces:**
- Consumes: `NumericInput`(Task 1), `TimeInput`(Task 2)。

- [ ] **Step 1: import を差し替える**

`EventForm.tsx` 冒頭の以下を：

```tsx
import { parseTimeString, formatTime } from '../utils/templateConversions';
```

次へ置換（templateConversions は不要になる・新部品を import）：

```tsx
import { NumericInput } from './ui/NumericInput';
import { TimeInput } from './ui/TimeInput';
```

- [ ] **Step 2: 時刻欄を TimeInput に置換**

現在の時刻欄ブロック（`{/* 時間（M:SS でも 裸の秒数でも入力可…*/}` の `<div className="max-w-[200px]">…</div>`）の `<input ...>` を以下に置換：

```tsx
                <TimeInput
                    value={time}
                    onChange={(sec) => setTime(sec ?? 0)}
                    data-testid="event-time-input"
                    placeholder={t('modal.time_placeholder')}
                    className={clsx(
                        "w-full rounded-lg p-2.5 text-[16px] md:text-app-2xl transition-all font-barlow border focus:outline-none focus:ring-1",
                        "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                    )}
                />
```

（ラベル `t('modal.time')` とヒント `<p>{t('modal.time_format_hint')}</p>` はそのまま残す。）

- [ ] **Step 3: 時刻用の手書きロジックを撤去**

- `const [timeInput, setTimeInput] = useState('0:00');` を削除。
- 初期化 effect 内の `setTimeInput(formatTime(initialData.time));` と `setTimeInput(formatTime(initialTime || 0));` の2行を削除（`setTime(...)` は残す）。
- モジュール冒頭の `function normalizeTimeInput(...) { ... }` を削除（TimeInput が内包）。

- [ ] **Step 4: ダメージ欄(直接入力)を NumericInput に置換**

直接入力モードの `<input type="text" inputMode="numeric" value={damageAmount} ... />`（`onChange` が `toHalfWidthNumber`→`setDamageAmount`）を以下へ置換：

```tsx
                        <NumericInput
                            value={damageAmount}
                            onChange={setDamageAmount}
                            thousandSeparator
                            className={clsx(
                                "w-full rounded-lg p-2.5 text-[16px] md:text-app-3xl font-mono transition-all font-bold border focus:outline-none focus:ring-1",
                                "bg-app-surface2 border-app-border text-app-text focus:border-app-text focus:bg-app-surface focus:ring-app-text/10"
                            )}
                        />
```

- [ ] **Step 5: ダメージ欄(逆算・実ダメージ)を NumericInput に置換**

`data-tutorial="event-actual-damage-input"` の `<input ... value={calcActualDamage} ... />` を以下へ置換：

```tsx
                                        <NumericInput
                                            data-tutorial="event-actual-damage-input"
                                            value={calcActualDamage}
                                            onChange={setCalcActualDamage}
                                            thousandSeparator
                                            className={clsx(
                                                "flex-1 border rounded-lg px-4 py-2.5 text-[16px] md:text-app-3xl font-mono outline-none transition-all",
                                                "bg-app-surface border-app-border text-app-text focus:border-app-text"
                                            )}
                                        />
```

- [ ] **Step 6: 未使用になった `toHalfWidthNumber` を確認・除去**

`toHalfWidthNumber` の残り利用を検索：

Run: `npx rg "toHalfWidthNumber" src/components/EventForm.tsx`
Expected: 定義行のみ（利用箇所なし）→ `function toHalfWidthNumber(...) { ... }` 定義を削除。
（もし他に利用が残っていれば削除しない。build で最終確認する。）

- [ ] **Step 7: build と既存テストで回帰確認**

Run: `npm run build`
Expected: 型エラーなし（未使用 import/変数があれば本ステップで判明→除去）

Run: `npx vitest run src/components/__tests__/EventForm.time.test.tsx src/components/__tests__/EventForm.damage.test.tsx`
Expected: PASS（時刻4件＋ダメージ系。`6:15`表示・375保存・全角・編集時ダメージ保持が緑）

- [ ] **Step 8: コミット**

```bash
git add src/components/EventForm.tsx
git commit -m "refactor(event): EventForm のダメージをNumericInput・時刻をTimeInputへ統一(手書きロジック撤去)"
```

---

### Task 4: AASettingsPopover 移行（AAダメージ → NumericInput）

**Files:**
- Modify: `src/components/AASettingsPopover.tsx`

**Interfaces:**
- Consumes: `NumericInput`(Task 1)。`handleChange('damage', number)` 既存。

- [ ] **Step 1: import を追加**

`AASettingsPopover.tsx` の import 群に追加：

```tsx
import { NumericInput } from './ui/NumericInput';
```

- [ ] **Step 2: `type="number"` 入力を置換**

`{/* Damage Amount */}` 内の以下：

```tsx
                    <input
                        type="number"
                        value={settings.damage}
                        onChange={(e) => handleChange('damage', Number(e.target.value))}
                        className="w-full bg-glass-card border border-glass-border rounded-md px-3 py-1.5 text-[16px] md:text-app-2xl font-black font-mono text-app-text focus:outline-none focus:border-app-text transition-colors"
                        onFocus={(e) => e.target.select()}
                    />
```

を以下へ置換：

```tsx
                    <NumericInput
                        value={settings.damage}
                        onChange={(v) => handleChange('damage', v)}
                        thousandSeparator
                        className="w-full bg-glass-card border border-glass-border rounded-md px-3 py-1.5 text-[16px] md:text-app-2xl font-black font-mono text-app-text focus:outline-none focus:border-app-text transition-colors"
                    />
```

- [ ] **Step 3: build で確認**

Run: `npm run build`
Expected: 型エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/AASettingsPopover.tsx
git commit -m "refactor(aa): オートアタックのダメージ入力を NumericInput へ(type=number 撤去)"
```

---

### Task 5: PartyStatusPopover 移行（HP/ステ×5 → NumericInput）＋ FormattedNumberInput 撤去

**Files:**
- Modify: `src/components/PartyStatusPopover.tsx`
- Delete: `src/components/ui/FormattedNumberInput.tsx`

**Interfaces:**
- Consumes: `NumericInput`(Task 1)。各 `updateXxx(number)` 既存。

- [ ] **Step 1: FormattedNumberInput の他利用が無いことを確認**

Run: `npx rg "FormattedNumberInput" src`
Expected: `PartyStatusPopover.tsx` と `ui/FormattedNumberInput.tsx` のみ（他に利用なし）

- [ ] **Step 2: import を差し替える**

`PartyStatusPopover.tsx` の以下：

```tsx
import { FormattedNumberInput } from './ui/FormattedNumberInput';
```

を：

```tsx
import { NumericInput } from './ui/NumericInput';
```

- [ ] **Step 3: 5箇所の `<FormattedNumberInput .../>` を `<NumericInput ... thousandSeparator/>` に置換**

各タグ名 `FormattedNumberInput` → `NumericInput` に変え、`thousandSeparator` を追加。`value`/`onChange`/`className` はそのまま。対象は Tank HP / Healer HP / WD / MND / DET の5箇所。例（Tank HP）:

```tsx
                                    <NumericInput
                                        value={tankRep?.stats.hp || 0}
                                        onChange={(val) => updateTankHP(val)}
                                        thousandSeparator
                                        className="w-24 bg-app-surface2 border border-app-border rounded-lg px-2 py-1 text-right text-app-text font-mono text-app-lg hover:border-app-border focus:border-app-accent focus:bg-app-surface2 focus:ring-1 focus:ring-app-accent/30 transition-all"
                                    />
```

残り4箇所（Healer HP=`updateHealerHP`、WD=`updateHealerStats({ wd })`、MND=`updateHealerStats({ mainStat })`、DET=`updateHealerStats({ det })`）も同様にタグ名変更＋`thousandSeparator` 追加（`value`/`onChange`/`className` は既存のまま）。

- [ ] **Step 4: FormattedNumberInput を削除**

`src/components/ui/FormattedNumberInput.tsx` を削除する。

```bash
git rm src/components/ui/FormattedNumberInput.tsx
```

- [ ] **Step 5: build で確認**

Run: `npm run build`
Expected: 型エラーなし（FormattedNumberInput への参照ゼロ）

- [ ] **Step 6: コミット**

```bash
git add src/components/PartyStatusPopover.tsx
git commit -m "refactor(party): HP/ステ入力を NumericInput へ統一し FormattedNumberInput を撤去"
```

---

### Task 6: BoundaryEditModal 移行（開始/終了時刻 → TimeInput・空=任意）

**Files:**
- Modify: `src/components/BoundaryEditModal.tsx`

**Interfaces:**
- Consumes: `TimeInput`(Task 2)。`onSave(name, startTime?: number, endTime?: number)` 契約は維持（空=undefined）。

- [ ] **Step 1: import を追加**

`BoundaryEditModal.tsx` の import 群に追加：

```tsx
import { TimeInput } from './ui/TimeInput';
```

- [ ] **Step 2: ローカルヘルパーを削除**

`function parseTimeInput(...) { ... }` と `function formatTime(...) { ... }`（ファイル冒頭の2関数）を削除する。

- [ ] **Step 3: state を文字列→数値|null に変更**

以下：

```tsx
    const [startTimeInput, setStartTimeInput] = useState('');
    const [endTimeInput, setEndTimeInput] = useState('');
```

を：

```tsx
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
```

- [ ] **Step 4: 初期化 effect を更新**

初期化 effect 内の：

```tsx
            setStartTimeInput(initial.startTime !== undefined ? formatTime(initial.startTime) : '');
            setEndTimeInput(initial.endTime !== undefined ? formatTime(initial.endTime) : '');
```

を：

```tsx
            setStartTime(initial.startTime ?? null);
            setEndTime(initial.endTime ?? null);
```

そして `else if (isOpen)` 分岐内の：

```tsx
            setStartTimeInput('');
            setEndTimeInput('');
```

を：

```tsx
            setStartTime(null);
            setEndTime(null);
```

- [ ] **Step 5: submit / backdrop の時刻算出を更新**

`handleSubmit` 内：

```tsx
        const startTime = startTimeInput ? parseTimeInput(startTimeInput) ?? undefined : undefined;
        const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
        onSave(buildName(), startTime, endTime);
```

を：

```tsx
        onSave(buildName(), startTime ?? undefined, endTime ?? undefined);
```

`handleBackdropClick` 内：

```tsx
            const startTime = startTimeInput ? parseTimeInput(startTimeInput) ?? undefined : undefined;
            const endTime = endTimeInput ? parseTimeInput(endTimeInput) ?? undefined : undefined;
            onSave(buildName(), startTime, endTime);
```

を：

```tsx
            onSave(buildName(), startTime ?? undefined, endTime ?? undefined);
```

- [ ] **Step 6: 2つの時刻 `<input>` を TimeInput に置換**

開始時刻の `<input type="text" value={startTimeInput} onChange={(e) => setStartTimeInput(e.target.value)} ... placeholder="M:SS" />` を：

```tsx
                                        <TimeInput value={startTime} onChange={setStartTime}
                                            className="flex-1 bg-app-surface2 border border-app-border rounded-lg p-2 text-[16px] md:text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                            placeholder="M:SS" />
```

終了時刻の `<input ... value={endTimeInput} onChange={(e) => setEndTimeInput(e.target.value)} ... placeholder="M:SS" />` を：

```tsx
                                        <TimeInput value={endTime} onChange={setEndTime}
                                            className="flex-1 bg-app-surface2 border border-app-border rounded-lg p-2 text-[16px] md:text-app-lg text-app-text placeholder-app-text-muted focus:border-app-text focus:bg-app-surface focus:outline-none transition-all font-barlow"
                                            placeholder="M:SS" />
```

- [ ] **Step 7: build で確認**

Run: `npm run build`
Expected: 型エラーなし（`startTimeInput`/`endTimeInput`/`parseTimeInput`/`formatTime` への参照ゼロ）

- [ ] **Step 8: コミット**

```bash
git add src/components/BoundaryEditModal.tsx
git commit -m "refactor(boundary): フェーズ/ラベルの開始終了時刻を TimeInput へ統一(重複ヘルパー撤去・空=任意維持)"
```

---

### Task 7: 全体検証（テスト＋ビルド＋手動確認）

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テスト**

Run: `npx vitest run`
Expected: 全 PASS（新規 NumericInput 8・TimeInput 7・EventForm 回帰・既存スイート緑）

- [ ] **Step 2: 本番ビルド**

Run: `npm run build`
Expected: `✓ built`・型エラーなし

- [ ] **Step 3: 手動確認チェックリスト（`npm run dev`）**

- [ ] イベント追加 → ダメージ欄に `50000` → フォーカスを外すと `50,000` 表示・再フォーカスで `50000` で編集可
- [ ] ダメージ欄を全消し → 0 が即押し付けられず空にできる（離脱で 0）
- [ ] イベント時刻 `6:15` / `375` どちらも入る・編集再表示が `6:15`
- [ ] パーティ設定（HP/WD/MND/DET）で桁区切り表示・編集が素直
- [ ] フェーズ/ラベル編集の開始/終了時刻が `M:SS` で入る・空のままにもできる
- [ ] AA設定のダメージが入力できる・桁区切り表示

- [ ] **Step 4: 仕上げコミット（必要なら）**

```bash
git add -A
git commit -m "test: 数値入力 Phase 1 の全体検証(テスト+ビルド緑)"
```

---

## Self-Review

- **Spec coverage**: NumericInput(Task1)/TimeInput(Task2) 新設、主要UIの数値8件（EventForm×2=T3 / AASettings=T4 / PartyStatus×5=T5）＋時刻（EventForm時刻=T3 / Boundary×2=T6）を網羅。housing・admin・HeaderTimeInput・ActivityScrub は spec 通り対象外。✓
- **Placeholder scan**: TBD/TODO なし。全ステップに実コード・実コマンド・期待出力あり。✓
- **Type consistency**: `NumericInputProps`(value:number/onChange:(number)=>void) と TimeInputProps(value:number|null/onChange:(number|null)=>void) を各移行で一致使用。EventForm time は `setTime(sec ?? 0)`、Boundary は `?? undefined` で既存契約維持。`parseTimeString`/`formatTime` は templateConversions の正典を TimeInput が利用。✓
- **未使用除去**: EventForm の `toHalfWidthNumber`/`normalizeTimeInput`/`parseTimeString`/`formatTime`、Boundary の local helper、FormattedNumberInput を各タスクで撤去し build 確認。✓
