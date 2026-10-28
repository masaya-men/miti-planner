/**
 * コンテンツ追加ウィザード
 * 管理画面からコンテンツ（零式・絶・ダンジョン等）を追加するための8ステップウィザード
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from './useWizard';
import { AdminWizard } from './AdminWizard';
import { apiFetch } from '../../../lib/apiClient';
import { showToast } from '../../toastBus';
import { CONTENT_SERIES } from '../../../data/contentRegistry';
import { CATEGORIES, LEVELS, WIZARD_STEPS } from './content/contentWizardDefs';
import { StepCategory } from './content/StepCategory';
import { StepLevel } from './content/StepLevel';
import { StepContentId } from './content/StepContentId';
import { StepNameJa, StepNameEn } from './content/StepNames';
import { StepSeries } from './content/StepSeries';
import { StepPatch, StepFflogs } from './content/StepOptional';

// ---- メインコンポーネント -------------------------------------------------

export function ContentWizard() {
  const { t, i18n } = useTranslation();
  const isJa = i18n.language.startsWith('ja');

  // マウント時に既存コンテンツIDを取得（重複チェック用）
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [newSeriesInput, setNewSeriesInput] = useState('');
  const [newSeriesNameJaInput, setNewSeriesNameJaInput] = useState('');
  const [newSeriesNameEnInput, setNewSeriesNameEnInput] = useState('');
  const [isNewSeriesMode, setIsNewSeriesMode] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin?resource=contents')
      .then((res) => res.json())
      .then((data: { items?: { id: string }[] }) => {
        if (data.items) {
          setExistingIds(new Set(data.items.map((item) => item.id)));
        }
      })
      .catch((err) => {
        console.warn('[ContentWizard] 既存コンテンツの取得に失敗:', err);
      });
  }, []);

  // サブミット処理
  const handleSubmit = async (data: Record<string, unknown>) => {
    const contentId = (data.contentId as string) ?? '';
    const level = typeof data.level === 'number' ? data.level : Number(data.level);
    const category = (data.category as string) ?? '';
    const nameJa = (data.nameJa as string) ?? '';
    const nameEn = (data.nameEn as string) ?? '';
    const fflogsRaw = data.fflogsId as string | undefined;
    const fflogsEncounterId =
      fflogsRaw && fflogsRaw.trim() !== ''
        ? parseInt(fflogsRaw, 10) || null
        : null;

    // category 別の seriesId 決定
    // - ultimate: seriesId = contentId (1 ultimate = 1 series)
    // - savage: data.series (既存 or 新規)
    // - その他: 空 (シリーズ概念なし)
    let seriesId = '';
    if (category === 'ultimate') {
      seriesId = contentId;
    } else if (category === 'savage') {
      seriesId = (data.series as string) ?? '';
    }

    // 新規シリーズ作成が必要なケース
    // - ultimate 全件 (= 必ず series も新規作成)
    // - savage で新規シリーズモード
    let seriesPayload: undefined | {
      id: string;
      name: { ja: string; en: string };
      category: string;
      level: number;
    } = undefined;
    if (category === 'ultimate') {
      seriesPayload = {
        id: contentId,
        name: { ja: nameJa, en: nameEn },
        category: 'ultimate',
        level,
      };
    } else if (category === 'savage' && isNewSeriesMode && newSeriesInput.trim()) {
      seriesPayload = {
        id: newSeriesInput.trim(),
        name: {
          ja: newSeriesNameJaInput.trim() || newSeriesInput.trim(),
          en: newSeriesNameEnInput.trim() || newSeriesInput.trim(),
        },
        category: 'savage',
        level,
      };
    }

    const payload: Record<string, unknown> = {
      item: {
        id: contentId,
        name: { ja: nameJa, en: nameEn },
        shortName: {
          ja: contentId.toUpperCase(),
          en: contentId.toUpperCase(),
        },
        category,
        level,
        patch: (data.patch as string) ?? '',
        seriesId,
        order: 1,
        fflogsEncounterId,
        hasCheckpoint: false,
      },
    };
    if (seriesPayload) {
      payload.series = seriesPayload;
    }

    const res = await apiFetch('/api/admin?resource=contents', {
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

    showToast(t('admin.contents_saved'));
  };

  const wizard = useWizard({ steps: WIZARD_STEPS, onSubmit: handleSubmit });
  const { data, setField } = wizard;

  // バリデーション
  const isStepValid = (stepId: string): boolean => {
    switch (stepId) {
      case 'category':
        return Boolean(data.category);
      case 'level':
        return data.level !== undefined && data.level !== null;
      case 'contentId': {
        const id = (data.contentId as string) ?? '';
        return id.trim().length > 0 && !existingIds.has(id.trim());
      }
      case 'nameJa':
        return Boolean((data.nameJa as string)?.trim());
      case 'nameEn':
        return Boolean((data.nameEn as string)?.trim());
      case 'series':
        return Boolean(data.series);
      default:
        return true;
    }
  };

  // ---- ステップ描画 -------------------------------------------------------

  const renderStep = (stepId: string) => {
    switch (stepId) {
      case 'category':
        return <StepCategory data={data} setField={setField} isJa={isJa} />;
      case 'level':
        return <StepLevel data={data} setField={setField} isJa={isJa} />;
      case 'contentId':
        return (
          <StepContentId
            data={data}
            setField={setField}
            existingIds={existingIds}
            t={t}
            isJa={isJa}
          />
        );
      case 'nameJa':
        return <StepNameJa data={data} setField={setField} t={t} />;
      case 'nameEn':
        return <StepNameEn data={data} setField={setField} t={t} />;
      case 'series':
        return (
          <StepSeries
            data={data}
            setField={setField}
            isJa={isJa}
            t={t}
            newSeriesInput={newSeriesInput}
            setNewSeriesInput={setNewSeriesInput}
            newSeriesNameJaInput={newSeriesNameJaInput}
            setNewSeriesNameJaInput={setNewSeriesNameJaInput}
            newSeriesNameEnInput={newSeriesNameEnInput}
            setNewSeriesNameEnInput={setNewSeriesNameEnInput}
            isNewSeriesMode={isNewSeriesMode}
            setIsNewSeriesMode={setIsNewSeriesMode}
          />
        );
      case 'patch':
        return <StepPatch data={data} setField={setField} t={t} />;
      case 'fflogsId':
        return <StepFflogs data={data} setField={setField} t={t} />;
      default:
        return null;
    }
  };

  // ---- 確認画面 -----------------------------------------------------------

  const renderConfirmation = () => {
    const categoryDef = CATEGORIES.find((c) => c.value === data.category);
    const levelDef = LEVELS.find((l) => l.value === data.level);
    const seriesId = (data.series as string) ?? '';
    const seriesFromRegistry = CONTENT_SERIES.find((s) => s.id === seriesId);
    const seriesDef = seriesFromRegistry
      ? {
          value: seriesFromRegistry.id,
          labelJa: seriesFromRegistry.name.ja || seriesFromRegistry.id,
          labelEn: seriesFromRegistry.name.en || seriesFromRegistry.id,
        }
      : isNewSeriesMode && newSeriesInput
      ? {
          value: newSeriesInput,
          labelJa: newSeriesNameJaInput || newSeriesInput,
          labelEn: newSeriesNameEnInput || newSeriesInput,
        }
      : undefined;

    const rows: { stepId: string; label: string; value: string }[] = [
      {
        stepId: 'category',
        label: isJa ? 'カテゴリ' : 'Category',
        value: categoryDef
          ? isJa
            ? categoryDef.labelJa
            : categoryDef.labelEn
          : String(data.category ?? ''),
      },
      {
        stepId: 'level',
        label: isJa ? 'レベル' : 'Level',
        value: levelDef
          ? isJa
            ? levelDef.labelJa
            : levelDef.labelEn
          : String(data.level ?? ''),
      },
      {
        stepId: 'contentId',
        label: 'Content ID',
        value: String(data.contentId ?? ''),
      },
      {
        stepId: 'nameJa',
        label: isJa ? 'コンテンツ名（日本語）' : 'Name (JA)',
        value: String(data.nameJa ?? ''),
      },
      {
        stepId: 'nameEn',
        label: isJa ? 'コンテンツ名（英語）' : 'Name (EN)',
        value: String(data.nameEn ?? ''),
      },
      {
        stepId: 'series',
        label: isJa ? 'シリーズ' : 'Series',
        value: seriesDef
          ? isJa
            ? seriesDef.labelJa
            : seriesDef.labelEn
          : String(data.series ?? ''),
      },
      {
        stepId: 'patch',
        label: isJa ? 'パッチ' : 'Patch',
        value: String(data.patch ?? '—'),
      },
      {
        stepId: 'fflogsId',
        label: 'FFLogs Encounter ID',
        value: String(data.fflogsId ?? '—'),
      },
    ];

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
          title={t('admin.content_wiz_title')}
          wizard={wizard}
          renderStep={renderStep}
          renderConfirmation={renderConfirmation}
          isStepValid={isStepValid}
        />
      </div>
    </div>
  );
}
