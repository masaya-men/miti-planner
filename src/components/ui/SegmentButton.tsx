// src/components/ui/SegmentButton.tsx
import { useRef, useState, useLayoutEffect, useEffect } from 'react';
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
}

export function SegmentButton<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: SegmentButtonProps<T>) {
  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const mounted = useRef(false);

  // アクティブボタンの位置を計測してインジケーターに反映
  useLayoutEffect(() => {
    const btn = buttonsRef.current.get(value);
    if (btn) {
      setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    }
  }, [value, options.length]);

  // 初回レンダーではトランジションを無効化（位置ジャンプ防止）
  useEffect(() => {
    mounted.current = true;
  }, []);

  return (
    <div
      className={clsx(
        'relative flex rounded-lg p-0.5 border border-glass-border bg-glass-card/80',
        className,
      )}
    >
      {/* スライドするインジケーター背景 */}
      {indicator.width > 0 && (
        <div
          className="absolute rounded-md bg-app-text shadow-lg pointer-events-none"
          style={{
            top: '2px',
            bottom: '2px',
            left: 0,
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.left}px)`,
            transition: mounted.current
              ? 'transform var(--duration-normal) var(--ease-spring-bouncy), width var(--duration-normal) var(--ease-spring-bouncy)'
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
          onClick={() => onChange(option.value)}
          className={clsx(
            'relative z-10 flex-1 flex items-center justify-center gap-1.5 rounded-md font-bold cursor-pointer',
            'transition-colors duration-150 active:scale-[0.97]',
            size === 'sm' ? 'py-1.5 text-app-base' : 'py-2 px-3 text-app-lg',
            option.value === value ? 'text-app-bg' : 'text-app-text',
          )}
        >
          {option.icon && (
            typeof option.icon === 'string'
              ? <img src={option.icon} alt="" className={clsx('object-contain', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              : option.icon
          )}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}
