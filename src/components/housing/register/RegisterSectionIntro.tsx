import { useTranslation } from 'react-i18next';
import { MAX_TITLE_LENGTH } from '../../../constants/housing';
import { HousingRegisterDescriptionField } from './HousingRegisterDescriptionField';
import { HousingRegisterTagPicker } from './HousingRegisterTagPicker';

export interface RegisterSectionIntroValues {
  title: string;
  description: string;
  tags: string[];
}

interface Props {
  title: string;
  description: string;
  tags: string[];
  /** title/description/tags いずれかの変更で、更新後の全値をまとめて通知する。 */
  onChange: (next: RegisterSectionIntroValues) => void;
}

/**
 * 登録フォーム中央カラム: 紹介セクション (タイトル/コメント/タグ)。
 * タイトルは任意 (2026-07-10 変更)。未入力なら一覧カードは住所を表示するため、
 * 必須マーク/必須エラーは出さず、未入力時に静かなヒント (住所フォールバック) だけを添える。
 * submit ゲート自体は Task13/14 が担う。
 */
export const RegisterSectionIntro: React.FC<Props> = ({ title, description, tags, onChange }) => {
  const { t } = useTranslation();
  const remaining = MAX_TITLE_LENGTH - title.length;
  const titleMissing = title.trim().length === 0;

  return (
    <section className="housing-register-section" data-testid="housing-register-section-intro">
      <h2 className="housing-register-section-title">{t('housing.register.section_intro')}</h2>

      <div className="housing-field">
        <label htmlFor="housing-register-title" className="housing-label">
          {t('housing.register.field_title_label')}
        </label>
        <input
          id="housing-register-title"
          data-testid="housing-register-title-input"
          type="text"
          className="housing-input"
          maxLength={MAX_TITLE_LENGTH}
          value={title}
          placeholder={t('housing.register.field_title_placeholder')}
          onChange={(e) => onChange({ title: e.target.value, description, tags })}
        />
        <p
          className="housing-address-note"
          data-testid="housing-register-title-remaining"
          data-overflow={remaining < 0 || undefined}
        >
          {t('housing.register.field_title_remaining', { count: remaining })}
        </p>
        {titleMissing && (
          <p className="housing-address-note" data-testid="housing-register-title-optional-hint">
            {t('housing.register.field_title_optional_hint')}
          </p>
        )}
      </div>

      <HousingRegisterDescriptionField
        value={description}
        onChange={(next) => onChange({ title, description: next, tags })}
        error={undefined}
      />

      <HousingRegisterTagPicker
        selected={tags}
        onChange={(next) => onChange({ title, description, tags: next })}
      />
    </section>
  );
};
