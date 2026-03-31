/**
 * コンテンツ追加ウィザード
 * 管理画面からコンテンツ（零式・絶・ダンジョン等）を追加するための8ステップウィザード
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWizard, WizardStep } from './useWizard';
import { AdminWizard } from './AdminWizard';
import { apiFetch } from '../../../lib/apiClient';
import { showToast } from '../../Toast';

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

interface SeriesDef {
  value: string;
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

const KNOWN_SERIES: SeriesDef[] = [
  { value: 'arcadion_hw',  labelJa: '至天の座（ヘビー級）',       labelEn: 'Arcadion Heavyweight' },
  { value: 'arcadion_cw',  labelJa: '至天の座（クルーザー級）',   labelEn: 'Arcadion Cruiserweight' },
  { value: 'arcadion_lw',  labelJa: '至天の座（ライト級）',       labelEn: 'Arcadion Lightweight' },
  { value: 'pandaemonium_4', labelJa: '煉獄編',   labelEn: 'Pandaemonium Anabaseios' },
  { value: 'pandaemonium_3', labelJa: '天獄編',   labelEn: 'Pandaemonium Abyssos' },
  { value: 'pandaemonium_2', labelJa: '辺獄編',   labelEn: 'Pandaemonium Asphodelos' },
  { value: 'pandaemonium_1', labelJa: '万魔殿',   labelEn: 'Pandaemonium' },
  { value: 'eden_4', labelJa: '再生編', labelEn: "Eden's Promise" },
  { value: 'eden_3', labelJa: '共鳴編', labelEn: "Eden's Verse" },
  { value: 'eden_2', labelJa: '覚醒編', labelEn: "Eden's Gate" },
];

// ---- ステップ定義 --------------------------------------------------------

const WIZARD_STEPS: WizardStep[] = [
  { id: 'category',   label: 'admin.content_wiz_category',   required: true },
  { id: 'level',      label: 'admin.content_wiz_level',      required: true },
  { id: 'contentId',  label: 'admin.content_wiz_id',         required: true },
  { id: 'nameJa',     label: 'admin.content_wiz_name_ja',    required: true },
  { id: 'nameEn',     label: 'admin.content_wiz_name_en',    required: true },
  { id: 'series',     label: 'admin.content_wiz_series',     required: true },
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
    const fflogsRaw = data.fflogsId as string | undefined;
    const fflogsEncounterId =
      fflogsRaw && fflogsRaw.trim() !== ''
        ? parseInt(fflogsRaw, 10) || null
        : null;

    const payload = {
      item: {
        id: contentId,
        name: {
          ja: (data.nameJa as string) ?? '',
          en: (data.nameEn as string) ?? '',
        },
        shortName: {
          ja: contentId.toUpperCase(),
          en: contentId.toUpperCase(),
        },
        category: (data.category as string) ?? '',
        level,
        patch: (data.patch as string) ?? '',
        seriesId: (data.series as string) ?? '',
        order: 1,
        fflogsEncounterId,
        hasCheckpoint: false,
      },
    };

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

    showToast(
      isJa ? 'コンテンツを追加しました' : 'Content added successfully',
      'success'
    );
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
    const seriesDef = KNOWN_SERIES.find((s) => s.value === data.series);

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
              <span className="text-xs text-[var(--app-text-muted)]">{label}</span>
              <span className="text-sm font-medium truncate">{value || '—'}</span>
            </div>
            <button
              type="button"
              onClick={() => wizard.goToStep(stepId)}
              className="shrink-0 text-xs border border-[var(--app-text)]/40 px-3 py-1 hover:border-[var(--app-text)] hover:bg-[var(--app-text)]/5 transition-colors"
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
        title={t('admin.content_wiz_title')}
        wizard={wizard}
        renderStep={renderStep}
        renderConfirmation={renderConfirmation}
        isStepValid={isStepValid}
      />
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
          <div className="text-xs text-[var(--app-text-muted)]">
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
          <div className="text-xs text-[var(--app-text-muted)]">
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
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-xs text-[var(--app-text-muted)]">{t('admin.content_wiz_id_hint')}</p>
      {isAvailable && (
        <p className="text-xs text-[var(--app-text)]">
          ✓ {t('admin.wizard_id_available')}
        </p>
      )}
      {isTaken && (
        <p className="text-xs text-[var(--app-text)] opacity-60">
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
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-xs text-[var(--app-text-muted)]">{t('admin.content_wiz_name_ja')}</p>
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
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-xs text-[var(--app-text-muted)]">{t('admin.content_wiz_name_en')}</p>
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
  isNewSeriesMode,
  setIsNewSeriesMode,
}: StepSeriesProps) {
  const handleNewSeries = (value: string) => {
    setNewSeriesInput(value);
    setField('series', value.trim());
  };

  const handleSelectExisting = (value: string) => {
    setIsNewSeriesMode(false);
    setNewSeriesInput('');
    setField('series', value);
  };

  const handleClickNewSeriesMode = () => {
    setIsNewSeriesMode(true);
    setField('series', newSeriesInput.trim());
  };

  return (
    <div className="flex flex-col gap-2">
      {/* 既存シリーズ一覧 */}
      {!isNewSeriesMode &&
        KNOWN_SERIES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => handleSelectExisting(s.value)}
            className={`p-3 border text-left transition-colors ${
              data.series === s.value && !isNewSeriesMode
                ? 'border-[var(--app-text)] bg-[var(--app-text)]/10'
                : 'border-[var(--app-text)]/20 hover:border-[var(--app-text)]/40'
            }`}
          >
            <div className="text-sm font-medium">
              {isJa ? s.labelJa : s.labelEn}
            </div>
            <div className="text-xs text-[var(--app-text-muted)]">
              {isJa ? s.labelEn : s.labelJa}
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
          <div className="text-sm text-[var(--app-text-muted)]">
            {t('admin.content_wiz_new_series')}
          </div>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={newSeriesInput}
            onChange={(e) => handleNewSeries(e.target.value)}
            placeholder={isJa ? '新しいシリーズID (e.g. arcadion_mw)' : 'New series ID (e.g. arcadion_mw)'}
            className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
            autoFocus
          />
          <button
            type="button"
            onClick={() => {
              setIsNewSeriesMode(false);
              setField('series', '');
              setNewSeriesInput('');
            }}
            className="text-xs text-[var(--app-text-muted)] underline self-start hover:text-[var(--app-text)] transition-colors"
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
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-xs text-[var(--app-text-muted)]">{t('admin.content_wiz_patch')}</p>
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
        className="w-full border border-[var(--app-text)]/30 bg-transparent px-4 py-3 text-sm focus:outline-none focus:border-[var(--app-text)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
        autoFocus
      />
      <p className="text-xs text-[var(--app-text-muted)]">{t('admin.content_wiz_fflogs')}</p>
    </div>
  );
}
