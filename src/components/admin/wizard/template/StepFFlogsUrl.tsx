import type { StepTProps } from './templateTypes';

// Branch A Step 1: FFLogs URL入力
export interface StepFFlogsUrlProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: StepTProps['t'];
}

export function StepFFlogsUrl({ data, setField, t }: StepFFlogsUrlProps) {
  const url = (data.fflogsUrl as string) ?? '';
  const isValid = url.includes('fflogs.com');

  return (
    <div className="flex flex-col gap-3">
      <input
        type="url"
        value={url}
        onChange={(e) => setField('fflogsUrl', e.target.value)}
        placeholder="https://www.fflogs.com/reports/..."
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-app-lg text-[var(--app-text-muted)]">
        {t('admin.template_wiz_paste_url')}
      </p>
      {url.length > 0 && !isValid && (
        <p className="text-app-lg text-[var(--app-text)] opacity-60">
          ✗ {t('admin.template_wiz_fflogs_desc')}
        </p>
      )}
      {isValid && (
        <p className="text-app-lg text-[var(--app-text)]">
          ✓ fflogs.com URL
        </p>
      )}
    </div>
  );
}
