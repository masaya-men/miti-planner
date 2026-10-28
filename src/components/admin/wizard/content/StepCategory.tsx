import { CATEGORIES } from './contentWizardDefs';
import type { StepProps } from './stepTypes';

// カテゴリ選択
export function StepCategory({ data, setField, isJa }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => setField('category', cat.value)}
          className={`p-4 border text-left transition-colors ${
            data.category === cat.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{isJa ? cat.labelJa : cat.labelEn}</div>
          <div className="text-app-lg text-[var(--app-text-muted)]">
            {isJa ? cat.labelEn : cat.labelJa}
          </div>
        </button>
      ))}
    </div>
  );
}
