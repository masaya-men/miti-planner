import type { StepTProps } from './templateTypes';

// Branch A Step 2: FFLogsプレビュー（プレースホルダー）
export interface StepFFlogsPreviewProps {
  data: Record<string, unknown>;
  t: StepTProps['t'];
}

export function StepFFlogsPreview({ data, t }: StepFFlogsPreviewProps) {
  const url = (data.fflogsUrl as string) ?? '';

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-[var(--app-text)]/20 p-4 flex flex-col gap-2">
        <div className="text-app-lg text-[var(--app-text-muted)] break-all">{url}</div>
        <div className="text-app-2xl font-medium text-[var(--app-text)]">
          {t('admin.template_wiz_preview')}
        </div>
        <div className="text-app-lg text-[var(--app-text-muted)]">
          {t('admin.template_wiz_events_found', { count: '—' })}
        </div>
        <div className="text-app-lg text-[var(--app-text-muted)]">
          {t('admin.template_wiz_phases_found', { count: '—' })}
        </div>
      </div>
      <p className="text-app-lg text-[var(--app-text-muted)]">
        ※ FFLogs連携は後のフェーズで実装予定
      </p>
    </div>
  );
}
