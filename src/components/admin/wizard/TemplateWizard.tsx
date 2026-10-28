/**
 * テンプレート登録ウィザード
 * 3ブランチ（FFLogs / プランから / JSONアップロード）でテンプレートを登録する
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from './useWizard';
import { AdminWizard } from './AdminWizard';
import { apiFetch } from '../../../lib/apiClient';
import { showToast } from '../../toastBus';
import type { ContentItem, ParsedTemplate } from './template/templateTypes';
import { WIZARD_STEPS } from './template/templateWizardSteps';
import { StepMethod } from './template/StepMethod';
import { StepContentSelect } from './template/StepContentSelect';
import { StepFFlogsUrl } from './template/StepFFlogsUrl';
import { StepFFlogsPreview } from './template/StepFFlogsPreview';
import { StepPlanNote } from './template/StepPlanNote';
import { StepJsonFile } from './template/StepJsonFile';
import { StepJsonPreview } from './template/StepJsonPreview';

// ---- メインコンポーネント ---------------------------------------------------

export function TemplateWizard() {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language.startsWith('ja');

  // コンテンツ一覧（contentId選択で使用）
  const [contents, setContents] = useState<ContentItem[]>([]);

  // JSONパース結果
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/admin?resource=contents')
      .then((res) => res.json())
      .then((data: { items?: ContentItem[] }) => {
        if (data.items) setContents(data.items);
      })
      .catch((err) => {
        console.warn('[TemplateWizard] コンテンツ取得失敗:', err);
      });
  }, []);

  // ---- サブミット処理 -------------------------------------------------------

  const handleSubmit = async (data: Record<string, unknown>) => {
    const method = data.method as string;

    if (method === 'fflogs') {
      // FFLogsインポートは後で実装。プレースホルダーのみ
      showToast(t('admin.templates_uploaded'));
      return;
    }

    if (method === 'plan') {
      // プランからの変換は後で実装
      showToast(t('admin.templates_uploaded'));
      return;
    }

    // Branch C: JSON
    if (!parsedTemplate) {
      throw new Error('JSONファイルが読み込まれていません');
    }

    const payload = {
      contentId: data.contentId as string,
      timelineEvents: parsedTemplate.timelineEvents,
      phases: parsedTemplate.phases ?? [],
      source: 'admin_manual',
    };

    const res = await apiFetch('/api/admin?resource=templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = (errData as { error?: string }).error ?? '保存に失敗しました';
      showToast(msg, 'error');
      throw new Error(msg);
    }

    showToast(t('admin.templates_uploaded'));
  };

  const wizard = useWizard({ steps: WIZARD_STEPS, onSubmit: handleSubmit });
  const { data, setField } = wizard;

  // ---- バリデーション -------------------------------------------------------

  const isStepValid = (stepId: string): boolean => {
    switch (stepId) {
      case 'method':
        return Boolean(data.method);
      case 'contentId':
        return Boolean(data.contentId);
      case 'fflogsUrl': {
        const url = (data.fflogsUrl as string) ?? '';
        return url.includes('fflogs.com');
      }
      case 'fflogsPreview':
        return Boolean(data.fflogsUrl);
      case 'planNote':
        return false; // Coming Soon — ステップを完了させない
      case 'jsonFile':
        return parsedTemplate !== null && jsonError === null;
      case 'jsonPreview':
        return parsedTemplate !== null;
      default:
        return true;
    }
  };

  // ---- ステップ描画 ---------------------------------------------------------

  const renderStep = (stepId: string) => {
    switch (stepId) {
      case 'method':
        return <StepMethod data={data} setField={setField} t={t} />;
      case 'contentId':
        return (
          <StepContentSelect
            data={data}
            setField={setField}
            contents={contents}
            isJa={isJa}
          />
        );
      case 'fflogsUrl':
        return <StepFFlogsUrl data={data} setField={setField} t={t} />;
      case 'fflogsPreview':
        return <StepFFlogsPreview data={data} t={t} />;
      case 'planNote':
        return <StepPlanNote isJa={isJa} />;
      case 'jsonFile':
        return (
          <StepJsonFile
            parsedTemplate={parsedTemplate}
            jsonError={jsonError}
            onParsed={(result) => {
              setParsedTemplate(result);
              setJsonError(null);
            }}
            onError={(msg) => {
              setParsedTemplate(null);
              setJsonError(msg);
            }}
            t={t}
          />
        );
      case 'jsonPreview':
        return <StepJsonPreview parsedTemplate={parsedTemplate} t={t} />;
      default:
        return null;
    }
  };

  // ---- 確認画面 -------------------------------------------------------------

  const renderConfirmation = () => {
    const method = data.method as string;
    const contentItem = contents.find((c) => c.id === data.contentId);
    const contentName = contentItem
      ? isJa
        ? contentItem.name.ja
        : contentItem.name.en
      : String(data.contentId ?? '—');

    const methodLabel =
      method === 'fflogs'
        ? t('admin.template_wiz_fflogs')
        : method === 'plan'
          ? t('admin.template_wiz_from_plan')
          : t('admin.template_wiz_json');

    const rows: { stepId: string; label: string; value: string }[] = [
      {
        stepId: 'method',
        label: t('admin.template_wiz_method'),
        value: methodLabel,
      },
      {
        stepId: 'contentId',
        label: t('admin.template_wiz_select_content'),
        value: contentName,
      },
    ];

    if (method === 'fflogs') {
      rows.push({
        stepId: 'fflogsUrl',
        label: t('admin.template_wiz_paste_url'),
        value: String(data.fflogsUrl ?? '—'),
      });
    }

    if (method === 'json' && parsedTemplate) {
      rows.push({
        stepId: 'jsonPreview',
        label: t('admin.template_wiz_preview'),
        value: t('admin.template_wiz_events_found', {
          count: parsedTemplate.timelineEvents.length,
        }),
      });
    }

    return (
      <div className="flex flex-col gap-3">
        {rows.map(({ stepId, label, value }) => (
          <div
            key={stepId}
            className="flex items-center justify-between border-b border-[var(--app-text)]/10 pb-2 gap-4"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-app-lg text-[var(--app-text-muted)]">{label}</span>
              <span className="text-app-2xl font-medium truncate">{value || '—'}</span>
            </div>
            <button
              type="button"
              onClick={() => wizard.goToStep(stepId)}
              className="shrink-0 text-app-lg border border-[var(--app-text)]/40 px-3 py-1 hover:border-[var(--app-text)] hover:bg-[var(--app-text)]/5 transition-colors"
            >
              {t('admin.wizard_edit')}
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 overflow-auto">
      <div className="max-w-xl mx-auto py-8 px-4">
        <AdminWizard
          title={t('admin.template_wiz_title')}
          wizard={wizard}
          renderStep={renderStep}
          renderConfirmation={renderConfirmation}
          isStepValid={isStepValid}
        />
      </div>
    </div>
  );
}
