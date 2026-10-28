import type { StepTProps } from './templateTypes';

// Step 1: 方法選択
export interface StepMethodProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: StepTProps['t'];
}

export function StepMethod({ data, setField, t }: StepMethodProps) {
  const methods = [
    {
      value: 'fflogs',
      label: t('admin.template_wiz_fflogs'),
      desc: t('admin.template_wiz_fflogs_desc'),
    },
    {
      value: 'plan',
      label: t('admin.template_wiz_from_plan'),
      desc: t('admin.template_wiz_from_plan_desc'),
    },
    {
      value: 'json',
      label: t('admin.template_wiz_json'),
      desc: t('admin.template_wiz_json_desc'),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      {methods.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => setField('method', m.value)}
          className={`p-4 border text-left transition-colors ${
            data.method === m.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{m.label}</div>
          <div className="text-app-lg text-[var(--app-text-muted)] mt-0.5">{m.desc}</div>
        </button>
      ))}
    </div>
  );
}
