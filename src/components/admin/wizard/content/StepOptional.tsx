import type { StepNameProps } from './stepTypes';

// パッチ番号（任意）
export function StepPatch({ data, setField, t }: StepNameProps) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={(data.patch as string) ?? ''}
        onChange={(e) => setField('patch', e.target.value)}
        placeholder="e.g. 7.2"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.content_wiz_patch')}</p>
    </div>
  );
}

// FFLogs Encounter ID（任意）
export function StepFflogs({ data, setField, t }: StepNameProps) {
  return (
    <div className="flex flex-col gap-3">
      <input
        type="number"
        value={(data.fflogsId as string) ?? ''}
        onChange={(e) => setField('fflogsId', e.target.value)}
        placeholder="e.g. 93"
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.content_wiz_fflogs')}</p>
    </div>
  );
}
