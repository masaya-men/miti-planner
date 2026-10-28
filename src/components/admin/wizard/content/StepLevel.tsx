import { LEVELS } from './contentWizardDefs';
import type { StepProps } from './stepTypes';

// レベル選択
export function StepLevel({ data, setField, isJa }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      {LEVELS.map((lv) => (
        <button
          key={lv.value}
          type="button"
          onClick={() => setField('level', lv.value)}
          className={`p-4 border text-left transition-colors ${
            data.level === lv.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{isJa ? lv.labelJa : lv.labelEn}</div>
          <div className="text-app-lg text-[var(--app-text-muted)]">
            {isJa ? lv.labelEn : lv.labelJa}
          </div>
        </button>
      ))}
    </div>
  );
}
