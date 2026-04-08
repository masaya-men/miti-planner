// src/components/SegmentedControl.tsx
import { motion } from 'framer-motion';
import { SPRING } from '../tokens/motionTokens';

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const activeIndex = options.findIndex(o => o.value === value);
  const widthPercent = 100 / options.length;

  return (
    <div className="relative flex rounded-lg p-0.5 bg-[var(--app-text)]/6">
      {/* Sliding background */}
      <motion.div
        className="absolute top-0.5 bottom-0.5 rounded-[7px] bg-[var(--app-text)]/12 shadow-sm"
        initial={false}
        animate={{
          left: `calc(${widthPercent * activeIndex}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
        }}
        transition={SPRING.snappy}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`relative z-[1] flex-1 text-center py-2 text-app-lg font-medium transition-colors ${
            option.value === value
              ? 'text-[var(--app-text)] font-semibold'
              : 'text-[var(--app-text-muted)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
