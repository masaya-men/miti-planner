/**
 * コンテンツ編集フォーム
 * 新規追加・編集の両方に対応
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

/** コンテンツデータの型 */
export interface ContentData {
  id: string;
  nameJa: string;
  nameEn: string;
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

const CATEGORIES = ['savage', 'ultimate', 'dungeon', 'raid', 'custom'] as const;
const LEVELS = [100, 90, 80, 70] as const;

/** 空のフォームデータ */
export function emptyContent(): ContentData {
  return {
    id: '',
    nameJa: '',
    nameEn: '',
    shortNameJa: '',
    shortNameEn: '',
    category: 'savage',
    level: 100,
    patch: '',
    seriesId: '',
    order: 0,
    fflogsEncounterId: null,
    hasCheckpoint: false,
  };
}

interface Props {
  initial: ContentData | null;
  onSave: (data: ContentData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export function AdminContentForm({ initial, onSave, onCancel, saving }: Props) {
  const { t } = useTranslation();
  const isEdit = !!initial;
  const [form, setForm] = useState<ContentData>(initial ?? emptyContent());

  useEffect(() => {
    setForm(initial ?? emptyContent());
  }, [initial]);

  const set = (key: keyof ContentData, value: string | number | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const labelClass = 'block text-[10px] text-app-text-muted mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h2 className="text-sm font-bold">
        {isEdit ? t('admin.contents_edit') : t('admin.contents_add')}
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {/* コンテンツID */}
        <div>
          <label className={labelClass}>{t('admin.contents_id')}</label>
          <input
            className={inputClass}
            value={form.id}
            onChange={(e) => set('id', e.target.value)}
            disabled={isEdit}
            required
          />
        </div>

        {/* カテゴリ */}
        <div>
          <label className={labelClass}>{t('admin.contents_category')}</label>
          <select
            className={inputClass}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 名前（日本語） */}
        <div>
          <label className={labelClass}>{t('admin.contents_name_ja')}</label>
          <input
            className={inputClass}
            value={form.nameJa}
            onChange={(e) => set('nameJa', e.target.value)}
            required
          />
        </div>

        {/* 名前（英語） */}
        <div>
          <label className={labelClass}>{t('admin.contents_name_en')}</label>
          <input
            className={inputClass}
            value={form.nameEn}
            onChange={(e) => set('nameEn', e.target.value)}
            required
          />
        </div>

        {/* 略称（日本語） */}
        <div>
          <label className={labelClass}>{t('admin.contents_short_ja')}</label>
          <input
            className={inputClass}
            value={form.shortNameJa}
            onChange={(e) => set('shortNameJa', e.target.value)}
          />
        </div>

        {/* 略称（英語） */}
        <div>
          <label className={labelClass}>{t('admin.contents_short_en')}</label>
          <input
            className={inputClass}
            value={form.shortNameEn}
            onChange={(e) => set('shortNameEn', e.target.value)}
          />
        </div>

        {/* レベル */}
        <div>
          <label className={labelClass}>{t('admin.contents_level')}</label>
          <select
            className={inputClass}
            value={form.level}
            onChange={(e) => set('level', Number(e.target.value))}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* パッチ */}
        <div>
          <label className={labelClass}>{t('admin.contents_patch')}</label>
          <input
            className={inputClass}
            value={form.patch}
            onChange={(e) => set('patch', e.target.value)}
            placeholder="7.2"
          />
        </div>

        {/* シリーズ */}
        <div>
          <label className={labelClass}>{t('admin.contents_series')}</label>
          <input
            className={inputClass}
            value={form.seriesId}
            onChange={(e) => set('seriesId', e.target.value)}
          />
        </div>

        {/* 表示順 */}
        <div>
          <label className={labelClass}>{t('admin.contents_order')}</label>
          <input
            className={inputClass}
            type="number"
            value={form.order}
            onChange={(e) => set('order', Number(e.target.value))}
          />
        </div>

        {/* FFLogs ID */}
        <div className="col-span-2">
          <label className={labelClass}>{t('admin.contents_fflogs_id')}</label>
          <input
            className={inputClass}
            type="number"
            value={form.fflogsEncounterId ?? ''}
            onChange={(e) =>
              set('fflogsEncounterId', e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
      </div>

      {/* ボタン */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : t('admin.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
