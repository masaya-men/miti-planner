import { useMemo } from 'react';
import { CONTENT_SERIES } from '../../../../data/contentRegistry';
import type { StepSeriesProps } from './stepTypes';

// シリーズ選択
export function StepSeries({
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
