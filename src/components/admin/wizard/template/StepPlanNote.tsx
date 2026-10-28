// Branch B: プランからのプレースホルダー
export interface StepPlanNoteProps {
  isJa: boolean;
}

export function StepPlanNote({ isJa }: StepPlanNoteProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="border border-[var(--app-text)]/20 p-4">
        <p className="text-app-2xl text-[var(--app-text-muted)]">
          {isJa
            ? 'この機能は保存済みプランからの選択が必要です。Coming soon.'
            : 'This feature requires selecting from saved plans. Coming soon.'}
        </p>
      </div>
      <p className="text-app-lg text-[var(--app-text-muted)]">
        {isJa
          ? '※ このブランチは現在実装中のため、次へは進めません'
          : '※ This branch is not yet implemented'}
      </p>
    </div>
  );
}
