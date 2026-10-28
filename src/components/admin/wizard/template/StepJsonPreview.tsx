import type { ParsedTemplate, StepTProps } from './templateTypes';

// Branch C Step 2: JSONプレビュー
export interface StepJsonPreviewProps {
  parsedTemplate: ParsedTemplate | null;
  t: StepTProps['t'];
}

export function StepJsonPreview({ parsedTemplate, t }: StepJsonPreviewProps) {
  if (!parsedTemplate) {
    return (
      <p className="text-app-2xl text-[var(--app-text-muted)]">
        ファイルが読み込まれていません
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="border border-[var(--app-text)]/20 p-4 flex flex-col gap-2">
        <div className="text-app-2xl font-medium">{t('admin.template_wiz_preview')}</div>
        <div className="text-app-2xl">
          {t('admin.template_wiz_events_found', {
            count: parsedTemplate.timelineEvents.length,
          })}
        </div>
        <div className="text-app-2xl text-[var(--app-text-muted)]">
          {t('admin.template_wiz_phases_found', {
            count: (parsedTemplate.phases ?? []).length,
          })}
        </div>
      </div>
      <p className="text-app-lg text-[var(--app-text-muted)]">
        {t('admin.template_wiz_plan_note')}
      </p>
    </div>
  );
}
