/**
 * コンテンツ編集フォーム — 零式の設定(シリーズ選択/新規シリーズ・層)
 */
import { CONTENT_SERIES } from '../../../data/contentRegistry';
import type { ContentData } from '../AdminContentForm';
import { SAVAGE_TIERS, inputClass, selectClass, labelClass } from './contentFormOptions';

interface SavageSettingsSectionProps {
  form: ContentData;
  set: (key: keyof ContentData, value: string | number | boolean | null) => void;
  isJa: boolean;
  availableSeries: typeof CONTENT_SERIES;
  newSeriesMode: boolean;
  setNewSeriesMode: (v: boolean) => void;
  newSeriesId: string;
  setNewSeriesId: (v: string) => void;
  newSeriesNameJa: string;
  setNewSeriesNameJa: (v: string) => void;
  newSeriesNameEn: string;
  setNewSeriesNameEn: (v: string) => void;
}

export function SavageSettingsSection({
  form,
  set,
  isJa,
  availableSeries,
  newSeriesMode,
  setNewSeriesMode,
  newSeriesId,
  setNewSeriesId,
  newSeriesNameJa,
  setNewSeriesNameJa,
  newSeriesNameEn,
  setNewSeriesNameEn,
}: SavageSettingsSectionProps) {
  return (
        <div className="space-y-3">
          <div className="text-app-base font-bold text-app-text-muted border-b border-app-text/10 pb-1">
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
                  {availableSeries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(isJa ? s.name.ja : s.name.en) || s.id}
                    </option>
                  ))}
                  <option value="__new__">＋ 新しいシリーズを追加...</option>
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className={`${labelClass} mt-1`}>シリーズ ID</label>
                  <input
                    className={inputClass}
                    value={newSeriesId}
                    onChange={(e) => setNewSeriesId(e.target.value)}
                    placeholder="例: aac_heavy（英数字+アンダースコア）"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>シリーズ名（日本語）</label>
                    <input
                      className={inputClass}
                      value={newSeriesNameJa}
                      onChange={(e) => setNewSeriesNameJa(e.target.value)}
                      placeholder="例: ヘビー級"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>シリーズ名（英語）</label>
                    <input
                      className={inputClass}
                      value={newSeriesNameEn}
                      onChange={(e) => setNewSeriesNameEn(e.target.value)}
                      placeholder="例: Heavyweight"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewSeriesMode(false);
                    setNewSeriesId('');
                    setNewSeriesNameJa('');
                    setNewSeriesNameEn('');
                  }}
                  className="text-app-base text-app-text-muted hover:text-app-text"
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
            <p className="text-app-sm text-app-text-muted/40 mt-0.5">
              前半/後半がある場合は別々のコンテンツとして追加してください
            </p>
          </div>
        </div>
  );
}
