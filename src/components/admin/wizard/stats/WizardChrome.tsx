// ---- 共通UIパーツ -----------------------------------------------------------

export interface WizardHeaderProps {
  title: string;
  stepLabel: string;
  question: string;
}

export function WizardHeader({ title, stepLabel, question }: WizardHeaderProps) {
  return (
    <div className="flex flex-col gap-4 mb-6 text-[var(--app-text)]">
      <div className="border-b border-[var(--app-text)] pb-3">
        <h2 className="text-app-4xl font-bold">{title}</h2>
        <p className="text-app-lg text-[var(--app-text-muted)] mt-1">{stepLabel}</p>
      </div>
      <p className="text-app-2xl text-[var(--app-text-muted)]">{question}</p>
    </div>
  );
}

export interface WizardFooterProps {
  onBack: () => void;
  backLabel: string;
  showNext?: boolean;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}

export function WizardFooter({
  onBack,
  backLabel,
  showNext = false,
  onNext,
  nextLabel,
  nextDisabled = false,
}: WizardFooterProps) {
  return (
    <div className="flex justify-between items-center pt-4 border-t border-[var(--app-text)] mt-6 text-[var(--app-text)]">
      <button
        type="button"
        onClick={onBack}
        className="border border-[var(--app-text)] px-5 py-2 text-app-2xl font-medium hover:bg-[var(--app-text)] hover:text-[var(--app-bg)] transition-colors"
      >
        {backLabel}
      </button>
      {showNext && onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="bg-[var(--app-text)] text-[var(--app-bg)] px-6 py-2 text-app-2xl font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
