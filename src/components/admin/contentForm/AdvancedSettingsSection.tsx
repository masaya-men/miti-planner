/**
 * コンテンツ編集フォーム — 上級者設定(FFLogs エンカウンターID・略称の上書き)
 */
import type { ContentData } from '../AdminContentForm';
import { inputClass, labelClass, exampleClass } from './contentFormOptions';

interface AdvancedSettingsSectionProps {
  form: ContentData;
  set: (key: keyof ContentData, value: string | number | boolean | null) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  fflogsUrlInput: string;
  fflogsUrlStatus: 'idle' | 'success' | 'error';
  onFflogsUrlInput: (value: string) => void;
}

export function AdvancedSettingsSection({
  form,
  set,
  showAdvanced,
  onToggleAdvanced,
  fflogsUrlInput,
  fflogsUrlStatus,
  onFflogsUrlInput,
}: AdvancedSettingsSectionProps) {
  return (
      <div>
        <button
          type="button"
          onClick={() => onToggleAdvanced()}
          className="text-app-base text-app-text-muted hover:text-app-text transition-colors"
        >
          {showAdvanced ? '▼' : '▶'} 上級者設定（通常は不要）
        </button>

        {showAdvanced && (
          <div className="mt-2 p-3 border border-app-text/10 rounded space-y-3">
            {/* FFLogs エンカウンターID */}
            <div>
              <label className={labelClass}>
                FFLogs URL を貼り付け（ID を自動抽出）
                <span className={`${exampleClass} ml-2 font-normal`}>例: https://www.fflogs.com/zone/rankings/65#encounter=1079</span>
              </label>
              <input
                className={inputClass}
                type="text"
                placeholder="FFLogs の URL を貼り付けると下の ID 欄が自動で埋まります"
                value={fflogsUrlInput}
                onChange={(e) => onFflogsUrlInput(e.target.value)}
              />
              {fflogsUrlStatus === 'success' && (
                <p className="mt-1 text-app-sm text-app-blue">
                  ID を取得しました: {form.fflogsEncounterId}
                </p>
              )}
              {fflogsUrlStatus === 'error' && (
                <p className="mt-1 text-app-sm text-app-amber">
                  この URL から ID を抽出できませんでした。FFLogs のランキングページ等の URL（encounter=数字 を含むもの）を貼り付けてください
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>
                FFLogs エンカウンターID
                <span className={`${exampleClass} ml-2 font-normal`}>わからなければ空欄でOK（上の URL 貼付で自動入力されます）</span>
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
  );
}
