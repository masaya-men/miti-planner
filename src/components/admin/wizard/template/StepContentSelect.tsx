import type { ContentItem } from './templateTypes';

// Step 2: コンテンツ選択
export interface StepContentSelectProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  contents: ContentItem[];
  isJa: boolean;
}

export function StepContentSelect({ data, setField, contents, isJa }: StepContentSelectProps) {
  if (contents.length === 0) {
    return (
      <div className="text-app-2xl text-[var(--app-text-muted)] py-8 text-center">
        {isJa ? '読み込み中...' : 'Loading...'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {contents.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setField('contentId', item.id)}
          className={`p-3 border text-left transition-colors ${
            data.contentId === item.id
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{isJa ? item.name.ja : item.name.en}</div>
          <div className="text-app-lg text-[var(--app-text-muted)]">{item.id}</div>
        </button>
      ))}
    </div>
  );
}
