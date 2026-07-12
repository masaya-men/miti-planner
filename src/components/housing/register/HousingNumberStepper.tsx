export interface HousingNumberStepperProps {
  /** 外側 <label htmlFor> と結ぶための input id。 */
  id: string;
  value: number | undefined;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number | undefined) => void;
}

/**
 * 数値入力 + 自作 ▲▼ ステッパー。
 *
 * ネイティブの number スピナーは「未入力で下を押すと最小値(1)」になり、上下の区別も
 * JS で判定できないため、スピナーを CSS で隠して自前ボタンに置き換える。
 *
 * 挙動 (ユーザー要望 2026-07-13):
 * - 未入力 + ▲ → 最小値 (min)
 * - **未入力 + ▼ → 最大値 (max)** (「そこで選べる最大数」= 自然な下方向)
 * - 値あり + ▲/▼ → ±1 して [min, max] にクランプ
 * - 直接入力はそのまま通す (範囲外はバリデーション側の責務・ここではクランプしない)
 *
 * a11y: ▲▼ ボタンはマウス専用の補助 (aria-hidden + tabIndex=-1)。キーボード/SR 利用者は
 * input 上の ↑↓ キーで同じ挙動になる (onKeyDown で処理)。
 */
export const HousingNumberStepper: React.FC<HousingNumberStepperProps> = ({
  id,
  value,
  min,
  max,
  disabled,
  onChange,
}) => {
  const clamp = (x: number): number => Math.min(max, Math.max(min, x));
  const stepUp = (): void => onChange(value === undefined ? min : clamp(value + 1));
  const stepDown = (): void => onChange(value === undefined ? max : clamp(value - 1));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepUp();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepDown();
    }
  };

  return (
    <div className="housing-stepper" data-disabled={disabled ? 'true' : undefined}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="housing-input housing-stepper-input"
        min={min}
        max={max}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        onKeyDown={handleKeyDown}
      />
      <span className="housing-stepper-btns" aria-hidden="true">
        <button
          type="button"
          className="housing-stepper-btn housing-stepper-up"
          data-testid={`${id}-up`}
          tabIndex={-1}
          disabled={disabled}
          onClick={stepUp}
        >
          ▲
        </button>
        <button
          type="button"
          className="housing-stepper-btn housing-stepper-down"
          data-testid={`${id}-down`}
          tabIndex={-1}
          disabled={disabled}
          onClick={stepDown}
        >
          ▼
        </button>
      </span>
    </div>
  );
};
