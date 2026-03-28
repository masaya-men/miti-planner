/**
 * コンテンツ編集フォーム
 * 新規追加・編集の両方に対応
 * 「間違えようがない」をコンセプトに、全フィールドに具体例と説明を表示
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

/** カテゴリ定義 */
const CATEGORIES = [
  { value: 'savage', ja: '零式', en: 'Savage' },
  { value: 'ultimate', ja: '絶', en: 'Ultimate' },
  { value: 'dungeon', ja: 'ダンジョン', en: 'Dungeon' },
  { value: 'raid', ja: 'レイド', en: 'Raid' },
  { value: 'custom', ja: 'その他', en: 'Misc' },
] as const;

const LEVELS = [
  { value: 100, ja: 'Lv100（黄金）', en: 'Lv100 (Dawntrail)' },
  { value: 90, ja: 'Lv90（暁月）', en: 'Lv90 (Endwalker)' },
  { value: 80, ja: 'Lv80（漆黒）', en: 'Lv80 (Shadowbringers)' },
  { value: 70, ja: 'Lv70（紅蓮）', en: 'Lv70 (Stormblood)' },
] as const;

/** 既存のシリーズ一覧 */
const KNOWN_SERIES = [
  { id: 'arcadion_hw', ja: '至天の座（ヘビー級）', en: 'Arcadion Heavyweight' },
  { id: 'arcadion_cw', ja: '至天の座（クルーザー級）', en: 'Arcadion Cruiserweight' },
  { id: 'arcadion_lw', ja: '至天の座（ライト級）', en: 'Arcadion Lightweight' },
  { id: 'pandaemonium_4', ja: '煉獄編', en: 'Pandaemonium Anabaseios' },
  { id: 'pandaemonium_3', ja: '天獄編', en: 'Pandaemonium Abyssos' },
  { id: 'pandaemonium_2', ja: '辺獄編', en: 'Pandaemonium Asphodelos' },
  { id: 'pandaemonium_1', ja: '万魔殿', en: 'Pandaemonium' },
  { id: 'eden_4', ja: '再生編', en: "Eden's Promise" },
  { id: 'eden_3', ja: '共鳴編', en: "Eden's Verse" },
  { id: 'eden_2', ja: '覚醒編', en: "Eden's Gate" },
] as const;

/** 零式の層選択 */
const SAVAGE_TIERS = [
  { value: 1, ja: '1層', en: 'Floor 1' },
  { value: 2, ja: '2層', en: 'Floor 2' },
  { value: 3, ja: '3層', en: 'Floor 3' },
  { value: 4, ja: '4層（通し）', en: 'Floor 4' },
  { value: 5, ja: '4層 前半', en: 'Floor 4 Phase 1' },
  { value: 6, ja: '4層 後半', en: 'Floor 4 Phase 2' },
] as const;

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
    order: 1,
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
  const { i18n } = useTranslation();
  const isEdit = !!initial;
  const isJa = i18n.language === 'ja';
  const [form, setForm] = useState<ContentData>(initial ?? emptyContent());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newSeriesMode, setNewSeriesMode] = useState(false);
  const [newSeriesId, setNewSeriesId] = useState('');

  useEffect(() => {
    setForm(initial ?? emptyContent());
  }, [initial]);

  const set = (key: keyof ContentData, value: string | number | boolean | null) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // カテゴリが零式かどうか
  const isSavage = form.category === 'savage';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // シリーズの新規入力モードの場合、入力値を使用
    const finalForm = { ...form };
    if (newSeriesMode && newSeriesId) {
      finalForm.seriesId = newSeriesId;
    }
    // 略称はコンテンツIDを大文字にしたものを自動設定
    if (!finalForm.shortNameJa) {
      finalForm.shortNameJa = finalForm.id.toUpperCase();
    }
    if (!finalForm.shortNameEn) {
      finalForm.shortNameEn = finalForm.id.toUpperCase();
    }
    onSave(finalForm);
  };

  const inputClass =
    'w-full px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const selectClass =
    'w-full px-2 py-1.5 text-xs bg-app-bg border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text [&>option]:bg-app-bg [&>option]:text-app-text';
  const labelClass = 'block text-[10px] font-bold text-app-text-muted mb-0.5';
  const exampleClass = 'text-[9px] text-app-text-muted/50';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-sm font-bold">
        {isEdit ? 'コンテンツ編集' : 'コンテンツ追加'}
      </h2>

      {/* ── 基本情報 ── */}
      <div className="space-y-3">
        <div className="text-[10px] font-bold text-app-text-muted border-b border-app-text/10 pb-1">
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
        <div className="space-y-3">
          <div className="text-[10px] font-bold text-app-text-muted border-b border-app-text/10 pb-1">
            零式の設定
          </div>

          {/* シリーズ */}
          <div>
            <label className={labelClass}>シリーズ</label>
            {!newSeriesMode ? (
              <div className="flex gap-2 items-center">
                <select
                  className={selectClass}
                  value={form.seriesId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setNewSeriesMode(true);
                    } else {
                      set('seriesId', e.target.value);
                    }
                  }}
                >
                  <option value="">（選択してください）</option>
                  {KNOWN_SERIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {isJa ? s.ja : s.en}
                    </option>
                  ))}
                  <option value="__new__">＋ 新しいシリーズを追加...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <input
                    className={inputClass}
                    value={newSeriesId}
                    onChange={(e) => setNewSeriesId(e.target.value)}
                    autoFocus
                  />
                  <div className={`${exampleClass} whitespace-nowrap`}>
                    例: arcadion_hw（英数字+アンダースコア）
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setNewSeriesMode(false); setNewSeriesId(''); }}
                  className="text-[10px] text-app-text-muted hover:text-app-text"
                >
                  ← 既存シリーズから選ぶ
                </button>
              </div>
            )}
          </div>

          {/* 層 */}
          <div>
            <label className={labelClass}>層</label>
            <select
              className={selectClass}
              value={form.order}
              onChange={(e) => set('order', Number(e.target.value))}
            >
              {SAVAGE_TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {isJa ? tier.ja : tier.en}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-app-text-muted/40 mt-0.5">
              前半/後半がある場合は別々のコンテンツとして追加してください
            </p>
          </div>
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
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-[10px] text-app-text-muted hover:text-app-text transition-colors"
        >
          {showAdvanced ? '▼' : '▶'} 上級者設定（通常は不要）
        </button>

        {showAdvanced && (
          <div className="mt-2 p-3 border border-app-text/10 rounded space-y-3">
            {/* FFLogs エンカウンターID */}
            <div>
              <label className={labelClass}>
                FFLogs エンカウンターID
                <span className={`${exampleClass} ml-2 font-normal`}>わからなければ空欄でOK（開発者が後から設定します）</span>
              </label>
              <input
                className={inputClass}
                type="number"
                value={form.fflogsEncounterId ?? ''}
                onChange={(e) =>
                  set('fflogsEncounterId', e.target.value ? Number(e.target.value) : null)
                }
              />
            </div>

            {/* 略称の手動上書き */}
            <div>
              <label className={labelClass}>
                略称の上書き（任意）
                <span className={`${exampleClass} ml-2 font-normal`}>空欄ならコンテンツIDの大文字（例: M9S）が自動で使われます</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  value={form.shortNameJa}
                  onChange={(e) => set('shortNameJa', e.target.value)}
                />
                <input
                  className={inputClass}
                  value={form.shortNameEn}
                  onChange={(e) => set('shortNameEn', e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── ボタン ── */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-3 py-1.5 text-xs border border-app-text/30 rounded hover:bg-app-text/10 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-app-text-muted hover:text-app-text transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
