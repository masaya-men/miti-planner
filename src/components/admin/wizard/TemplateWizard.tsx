/**
 * テンプレート登録ウィザード
 * 3ブランチ（FFLogs / プランから / JSONアップロード）でテンプレートを登録する
 */
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from './useWizard';
import type { WizardStep } from './useWizard';
import { AdminWizard } from './AdminWizard';
import { apiFetch } from '../../../lib/apiClient';
import { showToast } from '../../Toast';

// ---- 型定義 ----------------------------------------------------------------

interface ContentItem {
  id: string;
  name: { ja: string; en: string };
}

// JSONテンプレートの最低限の型
interface ParsedTemplate {
  timelineEvents: unknown[];
  phases?: unknown[];
}

// ---- ステップ定義 -----------------------------------------------------------

const WIZARD_STEPS: WizardStep[] = [
  // 全ブランチ共通: 方法選択
  { id: 'method',     label: 'admin.template_wiz_method',         required: true },

  // 全ブランチ共通: コンテンツ選択
  { id: 'contentId',  label: 'admin.template_wiz_select_content', required: true },

  // Branch A: FFLogs URL入力
  {
    id: 'fflogsUrl',
    label: 'admin.template_wiz_paste_url',
    required: true,
    condition: (d) => d.method === 'fflogs',
  },
  // Branch A: FFLogsプレビュー
  {
    id: 'fflogsPreview',
    label: 'admin.template_wiz_preview',
    required: true,
    condition: (d) => d.method === 'fflogs',
  },

  // Branch B: プランから（プレースホルダー）
  {
    id: 'planNote',
    label: 'admin.template_wiz_select_plan',
    required: true,
    condition: (d) => d.method === 'plan',
  },

  // Branch C: JSONアップロード
  {
    id: 'jsonFile',
    label: 'admin.template_wiz_select_file',
    required: true,
    condition: (d) => d.method === 'json',
  },
  // Branch C: JSONプレビュー
  {
    id: 'jsonPreview',
    label: 'admin.template_wiz_preview',
    required: true,
    condition: (d) => d.method === 'json',
  },
];

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
    <div className="max-w-xl mx-auto py-8 px-4">
      <AdminWizard
        title={t('admin.template_wiz_title')}
        wizard={wizard}
        renderStep={renderStep}
        renderConfirmation={renderConfirmation}
        isStepValid={isStepValid}
      />
    </div>
  );
}

// ---- サブコンポーネント -----------------------------------------------------

interface StepTProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
}

// Step 1: 方法選択
interface StepMethodProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: StepTProps['t'];
}

function StepMethod({ data, setField, t }: StepMethodProps) {
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

// Step 2: コンテンツ選択
interface StepContentSelectProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  contents: ContentItem[];
  isJa: boolean;
}

function StepContentSelect({ data, setField, contents, isJa }: StepContentSelectProps) {
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

// Branch A Step 1: FFLogs URL入力
interface StepFFlogsUrlProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: StepTProps['t'];
}

function StepFFlogsUrl({ data, setField, t }: StepFFlogsUrlProps) {
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

// Branch A Step 2: FFLogsプレビュー（プレースホルダー）
interface StepFFlogsPreviewProps {
  data: Record<string, unknown>;
  t: StepTProps['t'];
}

function StepFFlogsPreview({ data, t }: StepFFlogsPreviewProps) {
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

// Branch B: プランからのプレースホルダー
interface StepPlanNoteProps {
  isJa: boolean;
}

function StepPlanNote({ isJa }: StepPlanNoteProps) {
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

// Branch C Step 1: JSONファイルアップロード
interface StepJsonFileProps {
  parsedTemplate: ParsedTemplate | null;
  jsonError: string | null;
  onParsed: (result: ParsedTemplate) => void;
  onError: (msg: string) => void;
  t: StepTProps['t'];
}

function StepJsonFile({ parsedTemplate, jsonError, onParsed, onError, t }: StepJsonFileProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = e.target?.result as string;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (!Array.isArray(parsed.timelineEvents)) {
          onError('JSONに timelineEvents 配列が見つかりません');
          return;
        }
        onParsed({
          timelineEvents: parsed.timelineEvents as unknown[],
          phases: Array.isArray(parsed.phases)
            ? (parsed.phases as unknown[])
            : [],
        });
      } catch {
        onError('JSONのパースに失敗しました');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-app-2xl text-[var(--app-text-muted)]">
        {t('admin.template_wiz_select_file')}
      </p>

      {/* ファイル選択ボタン */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="border border-dashed border-[var(--app-text)]/40 p-6 text-center hover:border-[var(--app-text)]/70 transition-colors"
      >
        <span className="text-app-2xl text-[var(--app-text-muted)]">
          {parsedTemplate
            ? '✓ ファイル読み込み完了（クリックで変更）'
            : 'クリックしてJSONファイルを選択'}
        </span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* エラー */}
      {jsonError && (
        <p className="text-app-lg text-[var(--app-text)] opacity-60">✗ {jsonError}</p>
      )}

      {/* 成功 */}
      {parsedTemplate && !jsonError && (
        <div className="text-app-lg text-[var(--app-text)] flex flex-col gap-1">
          <span>
            ✓ {t('admin.template_wiz_events_found', {
              count: parsedTemplate.timelineEvents.length,
            })}
          </span>
          <span>
            {t('admin.template_wiz_phases_found', {
              count: (parsedTemplate.phases ?? []).length,
            })}
          </span>
        </div>
      )}
    </div>
  );
}

// Branch C Step 2: JSONプレビュー
interface StepJsonPreviewProps {
  parsedTemplate: ParsedTemplate | null;
  t: StepTProps['t'];
}

function StepJsonPreview({ parsedTemplate, t }: StepJsonPreviewProps) {
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
