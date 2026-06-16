/**
 * コンテンツ追加ウィザード
 * 管理画面からコンテンツ（零式・絶・ダンジョン等）を追加するための8ステップウィザード
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard } from './useWizard';
import type { WizardStep } from './useWizard';
import { AdminWizard } from './AdminWizard';
import { apiFetch } from '../../../lib/apiClient';
import { showToast } from '../../Toast';
import { CONTENT_SERIES } from '../../../data/contentRegistry';

// ---- 定義 ----------------------------------------------------------------

interface CategoryDef {
  value: string;
  labelJa: string;
  labelEn: string;
}

interface LevelDef {
  value: number;
  labelJa: string;
  labelEn: string;
}

const CATEGORIES: CategoryDef[] = [
  { value: 'savage',   labelJa: '零式',       labelEn: 'Savage' },
  { value: 'ultimate', labelJa: '絶',          labelEn: 'Ultimate' },
  { value: 'dungeon',  labelJa: 'ダンジョン', labelEn: 'Dungeon' },
  { value: 'raid',     labelJa: 'レイド',      labelEn: 'Raid' },
  { value: 'custom',   labelJa: 'その他',      labelEn: 'Misc' },
];

const LEVELS: LevelDef[] = [
  { value: 100, labelJa: 'Lv100（黄金）',        labelEn: 'Lv100 (Dawntrail)' },
  { value: 90,  labelJa: 'Lv90（暁月）',          labelEn: 'Lv90 (Endwalker)' },
  { value: 80,  labelJa: 'Lv80（漆黒）',          labelEn: 'Lv80 (Shadowbringers)' },
  { value: 70,  labelJa: 'Lv70（紅蓮）',          labelEn: 'Lv70 (Stormblood)' },
];

// KNOWN_SERIES は廃止。 CONTENT_SERIES (contents.json 由来) を動的に使う。
// step 内で current level + category=savage で絞り込んで使用する。

// ---- ステップ定義 --------------------------------------------------------

const WIZARD_STEPS: WizardStep[] = [
  { id: 'category',   label: 'admin.content_wiz_category',   required: true },
  { id: 'level',      label: 'admin.content_wiz_level',      required: true },
  { id: 'contentId',  label: 'admin.content_wiz_id',         required: true },
  { id: 'nameJa',     label: 'admin.content_wiz_name_ja',    required: true },
  { id: 'nameEn',     label: 'admin.content_wiz_name_en',    required: true },
  // シリーズ step は零式のときだけ表示 (絶は seriesId=contentId 自動、 dungeon/raid/custom は seriesId 不要)
  { id: 'series',     label: 'admin.content_wiz_series',     required: true, condition: (d) => d.category === 'savage' },
  { id: 'patch',      label: 'admin.content_wiz_patch',      required: false },
  { id: 'fflogsId',   label: 'admin.content_wiz_fflogs',     required: false },
];

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

// ---- サブコンポーネント ---------------------------------------------------

interface StepProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  isJa: boolean;
}

// カテゴリ選択
function StepCategory({ data, setField, isJa }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          type="button"
          onClick={() => setField('category', cat.value)}
          className={`p-4 border text-left transition-colors ${
            data.category === cat.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{isJa ? cat.labelJa : cat.labelEn}</div>
          <div className="text-app-lg text-[var(--app-text-muted)]">
            {isJa ? cat.labelEn : cat.labelJa}
          </div>
        </button>
      ))}
    </div>
  );
}

// レベル選択
function StepLevel({ data, setField, isJa }: StepProps) {
  return (
    <div className="flex flex-col gap-3">
      {LEVELS.map((lv) => (
        <button
          key={lv.value}
          type="button"
          onClick={() => setField('level', lv.value)}
          className={`p-4 border text-left transition-colors ${
            data.level === lv.value
              ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
              : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
          }`}
        >
          <div className="font-medium">{isJa ? lv.labelJa : lv.labelEn}</div>
          <div className="text-app-lg text-[var(--app-text-muted)]">
            {isJa ? lv.labelEn : lv.labelJa}
          </div>
        </button>
      ))}
    </div>
  );
}

// コンテンツID入力
interface StepContentIdProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  existingIds: Set<string>;
  t: (key: string) => string;
  isJa: boolean;
}

function StepContentId({ data, setField, existingIds, t, isJa }: StepContentIdProps) {
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

// コンテンツ名（日本語）
interface StepNameProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: (key: string) => string;
}

function StepNameJa({ data, setField, t }: StepNameProps) {
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
function StepNameEn({ data, setField, t }: StepNameProps) {
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

// シリーズ選択
interface StepSeriesProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  isJa: boolean;
  t: (key: string) => string;
  newSeriesInput: string;
  setNewSeriesInput: (v: string) => void;
  newSeriesNameJaInput: string;
  setNewSeriesNameJaInput: (v: string) => void;
  newSeriesNameEnInput: string;
  setNewSeriesNameEnInput: (v: string) => void;
  isNewSeriesMode: boolean;
  setIsNewSeriesMode: (v: boolean) => void;
}

function StepSeries({
  data,
  setField,
  isJa,
  t,
  newSeriesInput,
  setNewSeriesInput,
  newSeriesNameJaInput,
  setNewSeriesNameJaInput,
  newSeriesNameEnInput,
  setNewSeriesNameEnInput,
  isNewSeriesMode,
  setIsNewSeriesMode,
}: StepSeriesProps) {
  // CONTENT_SERIES (contents.json 由来) を current level + savage で絞り込み
  const level = typeof data.level === 'number' ? data.level : Number(data.level);
  const availableSeries = useMemo(
    () => CONTENT_SERIES.filter((s) => s.category === 'savage' && s.level === level),
    [level]
  );

  const handleNewSeriesId = (value: string) => {
    setNewSeriesInput(value);
    setField('series', value.trim());
  };

  const handleSelectExisting = (value: string) => {
    setIsNewSeriesMode(false);
    setNewSeriesInput('');
    setNewSeriesNameJaInput('');
    setNewSeriesNameEnInput('');
    setField('series', value);
  };

  const handleClickNewSeriesMode = () => {
    setIsNewSeriesMode(true);
    setField('series', newSeriesInput.trim());
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 既存シリーズ一覧 (contents.json 由来) */}
      {!isNewSeriesMode &&
        availableSeries.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => handleSelectExisting(s.id)}
            className={`p-3 border text-left transition-colors ${
              data.series === s.id && !isNewSeriesMode
                ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
            }`}
          >
            <div className="text-app-2xl font-medium">
              {(isJa ? s.name.ja : s.name.en) || s.id}
            </div>
            <div className="text-app-lg text-[var(--app-text-muted)]">
              {(isJa ? s.name.en : s.name.ja) || s.id}
            </div>
          </button>
        ))}

      {/* 新しいシリーズ作成 */}
      {!isNewSeriesMode ? (
        <button
          type="button"
          onClick={handleClickNewSeriesMode}
          className="p-3 border border-dashed border-[var(--app-text)]/30 text-left hover:border-[var(--app-text)]/60 transition-colors"
        >
          <div className="text-app-2xl text-[var(--app-text-muted)]">
            {t('admin.content_wiz_new_series')}
          </div>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={newSeriesInput}
            onChange={(e) => handleNewSeriesId(e.target.value)}
            placeholder={isJa ? '新しいシリーズID (例: aac_heavy)' : 'New series ID (e.g. aac_heavy)'}
            className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
            autoFocus
          />
          <input
            type="text"
            value={newSeriesNameJaInput}
            onChange={(e) => setNewSeriesNameJaInput(e.target.value)}
            placeholder={isJa ? 'シリーズ名 (日本語、 例: ヘビー級)' : 'Series name JA (e.g. ヘビー級)'}
            className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
          />
          <input
            type="text"
            value={newSeriesNameEnInput}
            onChange={(e) => setNewSeriesNameEnInput(e.target.value)}
            placeholder={isJa ? 'シリーズ名 (英語、 例: Heavyweight)' : 'Series name EN (e.g. Heavyweight)'}
            className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-app-2xl focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
          />
          <button
            type="button"
            onClick={() => {
              setIsNewSeriesMode(false);
              setField('series', '');
              setNewSeriesInput('');
              setNewSeriesNameJaInput('');
              setNewSeriesNameEnInput('');
            }}
            className="text-app-lg text-[var(--app-text-muted)] underline self-start hover:text-[var(--app-text)] transition-colors"
          >
            {isJa ? '既存から選ぶ' : 'Select from existing'}
          </button>
        </div>
      )}
    </div>
  );
}

// パッチ番号（任意）
function StepPatch({ data, setField, t }: StepNameProps) {
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
function StepFflogs({ data, setField, t }: StepNameProps) {
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
