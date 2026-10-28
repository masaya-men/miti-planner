/**
 * コンテンツ編集フォーム
 * 新規追加・編集の両方に対応
 * 「間違えようがない」をコンセプトに、全フィールドに具体例と説明を表示
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SavageSettingsSection } from './contentForm/SavageSettingsSection';
import { AdvancedSettingsSection } from './contentForm/AdvancedSettingsSection';
import { extractEncounterIdFromUrl, emptyContent } from './contentForm/contentFormHelpers';
import { CATEGORIES, LEVELS, inputClass, selectClass, labelClass, exampleClass } from './contentForm/contentFormOptions';
import { CONTENT_SERIES } from '../../data/contentRegistry';

/** コンテンツデータの型 */
export interface ContentData {
  id: string;
  nameJa: string;
  nameEn: string;
  nameZh: string;
  nameZhHant: string;
  nameKo: string;
  shortNameJa: string;
  shortNameEn: string;
  category: string;
  level: number;
  patch: string;
  seriesId: string;
  order: number;
  fflogsEncounterId: number | null;
  hasCheckpoint: boolean;
}


/** 新規シリーズも併せて作成する場合に onSave に渡されるオブジェクト */
export interface NewSeriesPayload {
  id: string;
  name: { ja: string; en: string };
  category: string;
  level: number;
}

interface Props {
  initial: ContentData | null;
  onSave: (data: ContentData, newSeries?: NewSeriesPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export function AdminContentForm({ initial, onSave, onCancel, saving }: Props) {
  const { i18n } = useTranslation();
  const isEdit = !!initial;
  const isJa = i18n.language === 'ja';
  const [form, setForm] = useState<ContentData>(initial ?? emptyContent());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newSeriesMode, setNewSeriesMode] = useState(false);
  const [newSeriesId, setNewSeriesId] = useState('');
  const [newSeriesNameJa, setNewSeriesNameJa] = useState('');
  const [newSeriesNameEn, setNewSeriesNameEn] = useState('');
  const [fflogsUrlInput, setFflogsUrlInput] = useState('');
  const [fflogsUrlStatus, setFflogsUrlStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // CONTENT_SERIES (contents.json から自動生成) を current level + category=savage で絞った動的リスト
  const availableSeries = useMemo(
    () => CONTENT_SERIES.filter(s => s.category === 'savage' && s.level === form.level),
    [form.level]
  );

  const handleFflogsUrlInput = (value: string) => {
    setFflogsUrlInput(value);
    if (!value.trim()) {
      setFflogsUrlStatus('idle');
      return;
    }
    const id = extractEncounterIdFromUrl(value);
    if (id !== null) {
      setForm((prev) => ({ ...prev, fflogsEncounterId: id }));
      setFflogsUrlStatus('success');
    } else {
      setFflogsUrlStatus('error');
    }
  };

  useEffect(() => {
    setForm(initial ?? emptyContent());
  }, [initial]);

  const set = (key: keyof ContentData, value: string | number | boolean | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // カテゴリが零式かどうか
  const isSavage = form.category === 'savage';
  // カテゴリが絶かどうか (絶は 1 ウルティメイト = 1 シリーズなので seriesId = id 自動)
  const isUltimate = form.category === 'ultimate';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalForm = { ...form };
    let newSeriesPayload: NewSeriesPayload | undefined = undefined;

    if (isUltimate) {
      // 絶: seriesId = コンテンツ ID 自動。 新規追加なら series 自体も同時に作成
      finalForm.seriesId = finalForm.id;
      if (!isEdit) {
        newSeriesPayload = {
          id: finalForm.id,
          name: { ja: finalForm.nameJa, en: finalForm.nameEn },
          category: 'ultimate',
          level: finalForm.level,
        };
      }
    } else if (isSavage) {
      // 零式: 既存シリーズか新規シリーズか
      if (newSeriesMode && newSeriesId) {
        finalForm.seriesId = newSeriesId;
        if (!isEdit) {
          newSeriesPayload = {
            id: newSeriesId,
            name: {
              ja: newSeriesNameJa || newSeriesId,
              en: newSeriesNameEn || newSeriesId,
            },
            category: 'savage',
            level: finalForm.level,
          };
        }
      }
      // 既存シリーズ選択の場合は form.seriesId をそのまま使う (= 何もしない)
    }

    // 略称はコンテンツIDを大文字にしたものを自動設定
    if (!finalForm.shortNameJa) {
      finalForm.shortNameJa = finalForm.id.toUpperCase();
    }
    if (!finalForm.shortNameEn) {
      finalForm.shortNameEn = finalForm.id.toUpperCase();
    }
    onSave(finalForm, newSeriesPayload);
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-app-2xl font-bold">
        {isEdit ? 'コンテンツ編集' : 'コンテンツ追加'}
      </h2>

      {/* ── 基本情報 ── */}
      <div className="space-y-3">
        <div className="text-app-base font-bold text-app-text-muted border-b border-app-text/10 pb-1">
          基本情報
        </div>

        {/* カテゴリ + レベル */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>カテゴリ</label>
            <select
              className={selectClass}
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {isJa ? c.ja : c.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>レベル</label>
            <select
              className={selectClass}
              value={form.level}
              onChange={(e) => set('level', Number(e.target.value))}
            >
              {LEVELS.map((l) => (
                <option key={l.value} value={l.value}>
                  {isJa ? l.ja : l.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 名前（日本語）*/}
        <div>
          <label className={labelClass}>
            名前（日本語）
            <span className={`${exampleClass} ml-2 font-normal`}>例: 至天の座アルカディア零式：ヘビー級1</span>
          </label>
          <input
            className={inputClass}
            value={form.nameJa}
            onChange={(e) => set('nameJa', e.target.value)}
            required
          />
        </div>

        {/* 名前（英語）*/}
        <div>
          <label className={labelClass}>
            名前（英語）
            <span className={`${exampleClass} ml-2 font-normal`}>例: AAC Heavyweight M1 (Savage)</span>
          </label>
          <input
            className={inputClass}
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            required
          />
        </div>

        {/* 名前（中国語・繁体字・韓国語）— 任意 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>
              名前（中国語）
              <span className={`${exampleClass} ml-1 font-normal`}>任意</span>
            </label>
            <input
              className={inputClass}
              value={form.nameZh}
              onChange={(e) => set('nameZh', e.target.value)}
              placeholder="例: 阿卡狄亚���式登天斗技场 重量级1"
            />
          </div>
          <div>
            <label className={labelClass}>
              名前（繁体字）
              <span className={`${exampleClass} ml-1 font-normal`}>任意</span>
            </label>
            <input
              className={inputClass}
              value={form.nameZhHant}
              onChange={(e) => set('nameZhHant', e.target.value)}
              placeholder="任意"
            />
          </div>
          <div>
            <label className={labelClass}>
              名前（韓国語）
              <span className={`${exampleClass} ml-1 font-normal`}>任意</span>
            </label>
            <input
              className={inputClass}
              value={form.nameKo}
              onChange={(e) => set('nameKo', e.target.value)}
              placeholder="例: 아르카디아 선수권: 헤비급(영웅) 1"
            />
          </div>
        </div>

        {/* コンテンツID */}
        <div>
          <label className={labelClass}>
            コンテンツID
            {isEdit
              ? <span className="ml-1 text-app-text-muted/40 font-normal">（編集時は変更できません）</span>
              : <span className={`${exampleClass} ml-2 font-normal`}>例: m9s, ucob, tea（英数字・小文字。サイドバーに大文字で表示されます）</span>
            }
          </label>
          <input
            className={inputClass}
            value={form.id}
            onChange={(e) => set('id', e.target.value.toLowerCase())}
            disabled={isEdit}
            required
          />
        </div>

        {/* パッチ */}
        <div>
          <label className={labelClass}>
            パッチ
            <span className={`${exampleClass} ml-2 font-normal`}>例: 7.40, 7.20, 6.40</span>
          </label>
          <input
            className={inputClass}
            value={form.patch}
            onChange={(e) => set('patch', e.target.value)}
          />
        </div>
      </div>

      {/* ── 零式専用：シリーズ・層 ── */}
      {isSavage && (
        <SavageSettingsSection
          form={form}
          set={set}
          isJa={isJa}
          availableSeries={availableSeries}
          newSeriesMode={newSeriesMode}
          setNewSeriesMode={setNewSeriesMode}
          newSeriesId={newSeriesId}
          setNewSeriesId={setNewSeriesId}
          newSeriesNameJa={newSeriesNameJa}
          setNewSeriesNameJa={setNewSeriesNameJa}
          newSeriesNameEn={newSeriesNameEn}
          setNewSeriesNameEn={setNewSeriesNameEn}
        />
      )}

      {/* ── 絶 (ultimate) 専用: シリーズは自動 ── */}
      {isUltimate && !isEdit && (
        <div className="text-app-sm text-app-text-muted/60 italic px-2 py-1.5 border-l-2 border-app-text/20">
          絶のシリーズはコンテンツ ID と同じ ID で自動作成されます (= 1 絶 1 シリーズ)。 操作不要。
        </div>
      )}

      {/* ── 零式以外の表示順 ── */}
      {!isSavage && (
        <div>
          <label className={labelClass}>
            表示順（任意）
            <span className={`${exampleClass} ml-2 font-normal`}>数字が小さいほど上に表示。通常は1でOK</span>
          </label>
          <input
            className={inputClass}
            type="number"
            min={1}
            value={form.order}
            onChange={(e) => set('order', Number(e.target.value))}
          />
        </div>
      )}

      {/* ── 上級者設定（折りたたみ） ── */}
      <AdvancedSettingsSection
        form={form}
        set={set}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        fflogsUrlInput={fflogsUrlInput}
        fflogsUrlStatus={fflogsUrlStatus}
        onFflogsUrlInput={handleFflogsUrlInput}
      />

      {/* ── ボタン ── */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-app-lg border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-app-lg text-app-text-muted hover:text-app-text transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
