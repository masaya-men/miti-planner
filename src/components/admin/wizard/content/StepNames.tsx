import type { StepNameProps } from './stepTypes';

// コンテンツ名（日本語）
export function StepNameJa({ data, setField, t }: StepNameProps) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={(data.nameJa as string) ?? ''}
        onChange={(e) => setField('nameJa', e.target.value)}
        placeholder="e.g. 煉獄零式 決戦のトラム"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.content_wiz_name_ja')}</p>
    </div>
  );
}

// コンテンツ名（英語）
export function StepNameEn({ data, setField, t }: StepNameProps) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={(data.nameEn as string) ?? ''}
        onChange={(e) => setField('nameEn', e.target.value)}
        placeholder="e.g. Asphodelos: The Fourth Circle (Savage)"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.content_wiz_name_en')}</p>
    </div>
  );
}
