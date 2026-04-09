// src/components/ui/SegmentButton.tsx
import { useRef, useState, useLayoutEffect } from 'react';
import clsx from 'clsx';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: string | React.ReactNode;
}

interface SegmentButtonProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  /** アイコンとラベルの配置方向（デフォルト: horizontal） */
  layout?: 'horizontal' | 'vertical';
  /** pill形状（rounded-full）にする */
  pill?: boolean;
}

export function SegmentButton<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
  layout = 'horizontal',
  pill = false,
}: SegmentButtonProps<T>) {
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const hasInteracted = useRef(false);

  const radius = pill ? 'rounded-full' : 'rounded-lg';
  const innerRadius = pill ? 'rounded-full' : 'rounded-md';

  // アクティブボタンの位置を計測してインジケーターに反映
  useLayoutEffect(() => {
    const btn = buttonsRef.current.get(value);
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value, options.length]);

  return (
    <div
      className={clsx(
        'relative flex p-0.5 border border-glass-border bg-glass-card/80',
        radius,
        className,
      )}
    >
      {/* スライドするインジケーター背景 */}
      {indicator.width > 0 && (
        <div
          className={clsx('absolute bg-app-toggle shadow-lg pointer-events-none', innerRadius)}
          style={{
            top: '2px',
            bottom: '2px',
            left: 0,
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.left}px)`,
            transition: hasInteracted.current
              ? 'transform 1s var(--ease-spring), width 1s var(--ease-spring)'
              : 'none',
          }}
        />
      )}

      {/* ボタン群 */}
      {options.map((option) => (
        <button
          key={option.value}
          ref={(el) => {
            if (el) buttonsRef.current.set(option.value, el);
            else buttonsRef.current.delete(option.value);
          }}
          type="button"
          onClick={() => { hasInteracted.current = true; onChange(option.value); }}
          className={clsx(
            'relative z-10 flex-1 flex items-center justify-center font-bold cursor-pointer',
            'transition-colors duration-150 active:scale-[0.97]',
            innerRadius,
            layout === 'vertical' ? 'flex-col gap-0.5 py-1.5 px-1' : 'gap-1.5',
            layout === 'horizontal' && (size === 'sm' ? 'py-1.5 px-3 text-app-base' : 'py-2 px-2 text-app-lg'),
            layout === 'vertical' && (size === 'sm' ? 'text-app-xs' : 'text-app-sm'),
            option.value === value ? 'text-app-toggle-text' : 'text-app-text',
          )}
        >
          {option.icon && (
            typeof option.icon === 'string'
              ? <img src={option.icon} alt="" className={clsx('object-contain', size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5')} />
              : option.icon
          )}
          <span className="whitespace-nowrap">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
