import type { StepContentIdProps } from './stepTypes';

// コンテンツID入力
export function StepContentId({ data, setField, existingIds, t, isJa }: StepContentIdProps) {
  const value = (data.contentId as string) ?? '';
  const trimmed = value.trim();
  const isTaken = trimmed.length > 0 && existingIds.has(trimmed);
  const isAvailable = trimmed.length > 0 && !existingIds.has(trimmed);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={value}
        onChange={(e) => setField('contentId', e.target.value)}
        placeholder={isJa ? 'e.g. m9s' : 'e.g. m9s'}
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.content_wiz_id_hint')}</p>
      {isAvailable && (
        <p className="text-app-lg text-[var(--app-text)]">
          ✓ {t('admin.wizard_id_available')}
        </p>
      )}
      {isTaken && (
        <p className="text-app-lg text-[var(--app-text)] opacity-60">
          ✗ {t('admin.wizard_id_taken')}
        </p>
      )}
    </div>
  );
}
