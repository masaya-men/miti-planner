import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface RegisterVisibilityValues {
  visibility: 'public' | 'private';
  publishUntil: number | null;
}

interface Props {
  visibility: 'public' | 'private';
  publishUntil: number | null;
  onChange: (next: RegisterVisibilityValues) => void;
}

/**
 * datetime-local の value 文字列 ("YYYY-MM-DDTHH:mm") ⇔ epoch ms (number) の変換。
 * timestamp は number で持つ方針 (Global Constraint)。
 */
function epochToLocalInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputValueToEpoch(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 登録フォーム中央カラム: 公開設定セクション (spec 正典④)。
 * 「すべてのユーザーに公開 (既定) / 非公開 (自分のみ)」の2択 + 任意の公開終了日時。
 * 選択系 UI なので質感A案の「青 = 選択」トークンを使う (ハニーは主アクション専用)。
 */
export const RegisterSectionVisibility: React.FC<Props> = ({ visibility, publishUntil, onChange }) => {
  const { t } = useTranslation();
  // トグル自体の ON/OFF は「日時が設定されているか」から導出せず、ユーザーが一度 OFF に
  // 戻したときに入力値を保持したまま非表示にできるよう独立した表示状態として持つ。
  const [endDateEnabled, setEndDateEnabled] = useState(publishUntil != null);

  const handleVisibilityChange = (next: 'public' | 'private') => {
    onChange({ visibility: next, publishUntil });
  };

  const handleToggleEndDate = () => {
    const nextEnabled = !endDateEnabled;
    setEndDateEnabled(nextEnabled);
    if (!nextEnabled) {
      onChange({ visibility, publishUntil: null });
    }
  };

  const handleDateInputChange = (value: string) => {
    onChange({ visibility, publishUntil: localInputValueToEpoch(value) });
  };

  return (
    <section className="housing-register-section" data-testid="housing-register-section-visibility">
      <h2 className="housing-register-section-title">{t('housing.register.section_visibility')}</h2>

      <div className="housing-field housing-field-full">
        <div className="housing-type-selector" role="radiogroup" aria-label={t('housing.register.visibility.label')}>
          <button
            type="button"
            className="housing-register-visibility-chip"
            data-testid="housing-register-visibility-public"
            data-selected={visibility === 'public' ? 'true' : 'false'}
            role="radio"
            aria-checked={visibility === 'public'}
            onClick={() => handleVisibilityChange('public')}
          >
            {t('housing.register.visibility.public')}
          </button>
          <button
            type="button"
            className="housing-register-visibility-chip"
            data-testid="housing-register-visibility-private"
            data-selected={visibility === 'private' ? 'true' : 'false'}
            role="radio"
            aria-checked={visibility === 'private'}
            onClick={() => handleVisibilityChange('private')}
          >
            {t('housing.register.visibility.private')}
          </button>
        </div>
      </div>

      <div className="housing-register-visibility-enddate">
        <label className="housing-register-visibility-enddate-toggle">
          <input
            type="checkbox"
            data-testid="housing-register-visibility-enddate-toggle"
            checked={endDateEnabled}
            onChange={handleToggleEndDate}
          />
          <span className="housing-register-visibility-enddate-toggle-track" aria-hidden="true">
            <span className="housing-register-visibility-enddate-toggle-knob" />
          </span>
          <span>{t('housing.register.visibility.set_end_datetime')}</span>
        </label>

        {endDateEnabled && (
          <input
            type="datetime-local"
            className="housing-input"
            data-testid="housing-register-visibility-enddate-input"
            value={publishUntil != null ? epochToLocalInputValue(publishUntil) : ''}
            onChange={(e) => handleDateInputChange(e.target.value)}
          />
        )}
      </div>

      <p className="housing-register-visibility-note">{t('housing.register.visibility.auto_hide_note')}</p>
    </section>
  );
};
