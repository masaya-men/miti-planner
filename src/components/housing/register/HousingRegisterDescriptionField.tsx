import React from 'react';
import { useTranslation } from 'react-i18next';
import { HOUSING_LIMITS } from '../../../constants/housing';

interface Props {
  value: string;
  onChange: (next: string) => void;
  error: string | undefined;
}

export const HousingRegisterDescriptionField: React.FC<Props> = ({ value, onChange, error }) => {
  const { t } = useTranslation();
  const remaining = HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH - value.length;
  const overflow = remaining < 0;

  return (
    <div className="housing-field">
      <label htmlFor="housing-desc" className="housing-label">
        {t('housing.register.description')}
      </label>
      <textarea
        id="housing-desc"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH + 50}
        className="housing-textarea"
        placeholder={t('housing.register.description_placeholder')}
      />
      <p className="housing-address-note" data-overflow={overflow || undefined}>
        {remaining}
      </p>
      {error && (
        <p className="housing-field-error">
          {t(`housing.register.errors.description.${error}`)}
        </p>
      )}
    </div>
  );
};
