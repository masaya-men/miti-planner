import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingDateTimePicker } from './HousingDateTimePicker';

export interface RegisterVisibilityValues {
  visibility: 'public' | 'unlisted' | 'private';
  publishUntil: number | null;
}

interface Props {
  visibility: 'public' | 'unlisted' | 'private';
  publishUntil: number | null;
  onChange: (next: RegisterVisibilityValues) => void;
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

  // オートセーブ復元/編集で publishUntil が mount 後に非同期セットされたら、トグルを ON にして
  // 日時入力を可視化する (mount 時 useState 1 回きりの初期評価だけだと、復元後も OFF・非表示のまま
  // = ユーザーが公開終了日時を見られず編集できない dead 状態になる)。
  // publishUntil が null 化してもここでは強制 OFF しない: 「トグル ON・日時空入力」 (ユーザーが
  // 日時を入れる前にトグルだけ ON にした状態) を壊さないため。破棄 (親 state 全リセット) 時の
  // OFF 復帰は RegisterPage 側でこのセクションを再マウントして初期評価し直す。
  useEffect(() => {
    if (publishUntil != null) setEndDateEnabled(true);
  }, [publishUntil]);

  const handleVisibilityChange = (next: 'public' | 'unlisted' | 'private') => {
    onChange({ visibility: next, publishUntil });
  };

  const handleToggleEndDate = () => {
    const nextEnabled = !endDateEnabled;
    setEndDateEnabled(nextEnabled);
    if (!nextEnabled) {
      onChange({ visibility, publishUntil: null });
    }
  };

  const handleDateChange = (ms: number | null) => {
    onChange({ visibility, publishUntil: ms });
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
          <div data-testid="housing-register-visibility-enddate-input">
            <HousingDateTimePicker valueMs={publishUntil} onChange={handleDateChange} />
          </div>
        )}
      </div>

      <p className="housing-register-visibility-note">{t('housing.register.visibility.auto_hide_note')}</p>
    </section>
  );
};
