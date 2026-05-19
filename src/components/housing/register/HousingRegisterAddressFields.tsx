import React from 'react';
import { useTranslation } from 'react-i18next';
import { serverMasterData, housingAreaMasterData, housingSizeMasterData } from '../../../data/masterData';
import { HOUSING_AREAS, HOUSING_SIZES, type HousingArea, type HousingSize } from '../../../types/housing';
import { WARD_RANGE, PLOT_RANGE } from '../../../constants/housing';
import type { AddressInput, ValidationErrors } from '../../../utils/housingValidation';

interface Props {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors: ValidationErrors;
}

export const HousingRegisterAddressFields: React.FC<Props> = ({ value, onChange, errors }) => {
  const { t } = useTranslation();
  const dcKeys = Object.keys(serverMasterData);
  const serverKeys = value.dc ? Object.keys(serverMasterData[value.dc]?.servers ?? {}) : [];

  const update = <K extends keyof AddressInput>(key: K, v: AddressInput[K]) => {
    onChange({ ...value, [key]: v });
  };

  const fieldClass = 'w-full bg-app-surface2 border border-app-border rounded-md p-2 text-app-md';
  const errorClass = 'text-app-red text-app-sm mt-1';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="housing-dc" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.dc')}
        </label>
        <select
          id="housing-dc"
          className={fieldClass}
          value={value.dc}
          onChange={(e) => onChange({ ...value, dc: e.target.value, server: '' })}
        >
          <option value="">—</option>
          {dcKeys.map((dc) => <option key={dc} value={dc}>{dc}</option>)}
        </select>
        {errors.dc && <p className={errorClass}>{t(`housing.register.errors.dc.${errors.dc}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-server" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.server')}
        </label>
        <select
          id="housing-server"
          className={fieldClass}
          value={value.server}
          disabled={!value.dc}
          onChange={(e) => update('server', e.target.value)}
        >
          <option value="">—</option>
          {serverKeys.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.server && <p className={errorClass}>{t(`housing.register.errors.server.${errors.server}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-area" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.area')}
        </label>
        <select
          id="housing-area"
          className={fieldClass}
          value={value.area}
          onChange={(e) => update('area', e.target.value as HousingArea)}
        >
          <option value="">—</option>
          {HOUSING_AREAS.map((a) => (
            <option key={a} value={a}>{housingAreaMasterData[a]?.name_jp ?? a}</option>
          ))}
        </select>
        {errors.area && <p className={errorClass}>{t(`housing.register.errors.area.${errors.area}`)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="housing-ward" className="block text-app-sm text-app-text-muted mb-1">
            {t('housing.register.ward')}
          </label>
          <input
            id="housing-ward"
            type="number"
            min={WARD_RANGE.min}
            max={WARD_RANGE.max}
            className={fieldClass}
            value={value.ward}
            onChange={(e) => update('ward', Number(e.target.value))}
          />
          {errors.ward && <p className={errorClass}>{t(`housing.register.errors.ward.${errors.ward}`)}</p>}
        </div>
        <div>
          <label htmlFor="housing-plot" className="block text-app-sm text-app-text-muted mb-1">
            {t('housing.register.plot')}
          </label>
          <input
            id="housing-plot"
            type="number"
            min={PLOT_RANGE.min}
            max={PLOT_RANGE.max}
            className={fieldClass}
            value={value.plot}
            onChange={(e) => update('plot', Number(e.target.value))}
          />
          {errors.plot && <p className={errorClass}>{t(`housing.register.errors.plot.${errors.plot}`)}</p>}
          {value.plot != null && value.plot >= 31 && value.plot <= 60 && (
            <p className="text-app-sm text-app-text-muted mt-1">
              {t('housing.register.address.expansionWardNote')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="housing-size" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.size')}
        </label>
        <select
          id="housing-size"
          className={fieldClass}
          value={value.size}
          onChange={(e) => {
            const next = e.target.value as HousingSize;
            onChange({
              ...value,
              size: next,
            });
          }}
        >
          {HOUSING_SIZES.map((s) => {
            const label = housingSizeMasterData.find((m) => m.id === s)?.label ?? s;
            return <option key={s} value={s}>{label}</option>;
          })}
        </select>
        {errors.size && <p className={errorClass}>{t(`housing.register.errors.size.${errors.size}`)}</p>}
      </div>

      {/* アパート個室・FC個室の入力 UI は Sub-spec 2B で実装予定 */}
    </div>
  );
};
