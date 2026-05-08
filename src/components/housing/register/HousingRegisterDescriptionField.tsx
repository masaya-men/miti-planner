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

  return (
    <div>
      <label htmlFor="housing-desc" className="block text-app-sm text-app-text-muted mb-1">
        {t('housing.register.description')}
      </label>
      <textarea
        id="housing-desc"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH + 50}
        className="w-full bg-app-surface2 border border-app-border rounded-md p-2 text-app-md resize-none"
        placeholder={t('housing.register.description_placeholder')}
      />
      <p className={`text-app-sm mt-1 ${remaining < 0 ? 'text-app-red' : 'text-app-text-muted'}`}>
        {remaining}
      </p>
      {error && (
        <p className="text-app-red text-app-sm mt-1">
          {t(`housing.register.errors.description.${error}`)}
        </p>
      )}
    </div>
  );
};
