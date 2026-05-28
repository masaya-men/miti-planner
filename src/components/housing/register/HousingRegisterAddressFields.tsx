import React from 'react';
import { useTranslation } from 'react-i18next';
import { serverMasterData, housingSizeMasterData } from '../../../data/masterData';
import { HOUSING_AREAS, HOUSING_SIZES, type HousingArea, type HousingSize } from '../../../types/housing';
import { WARD_RANGE, PLOT_RANGE, APARTMENT_ROOM_RANGE } from '../../../constants/housing';
import { getAreaName } from '../../../lib/housing/areaName';
import type { AddressInput, ValidationErrors } from '../../../utils/housingValidation';

interface Props {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors: ValidationErrors;
}

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--housing-text-sm)',
  color: 'var(--housing-text-dim)',
  marginBottom: 4,
};
const ERROR_STYLE: React.CSSProperties = {
  fontSize: 'var(--housing-text-sm)',
  color: 'var(--housing-warning)',
  marginTop: 4,
};
const RADIO_LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontSize: 'var(--housing-text-base)',
};

export const HousingRegisterAddressFields: React.FC<Props> = ({ value, onChange, errors }) => {
  const { t, i18n } = useTranslation();
  const dcKeys = Object.keys(serverMasterData);
  const serverKeys = value.dc ? Object.keys(serverMasterData[value.dc]?.servers ?? {}) : [];

  const update = <K extends keyof AddressInput>(key: K, v: AddressInput[K]) => {
    onChange({ ...value, [key]: v });
  };

  const isHouse = value.buildingType === 'house';
  const isApartment = value.buildingType === 'apartment';

  /**
   * 建物タイプ切替時にハウス専用 / アパート専用フィールドを排他的に初期化する。
   * validateAddress が apartment 時の plot/size 不可を検証するので、 切替時に必ずクリアしないと
   * 残値で検証エラーが出る。
   */
  const handleBuildingTypeChange = (next: 'house' | 'apartment') => {
    if (next === value.buildingType) return;
    if (next === 'house') {
      onChange({
        ...value,
        buildingType: 'house',
        plot: 1,
        size: 'M',
        apartmentBuilding: undefined,
        roomKind: undefined,
        roomNumber: undefined,
      });
    } else {
      onChange({
        ...value,
        buildingType: 'apartment',
        plot: undefined,
        size: undefined,
        apartmentBuilding: 1,
        roomKind: 'apartment_room',
        roomNumber: 1,
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label htmlFor="housing-dc" style={LABEL_STYLE}>
          {t('housing.register.dc')}
        </label>
        <select
          id="housing-dc"
          className="housing-input"
          value={value.dc}
          onChange={(e) => onChange({ ...value, dc: e.target.value, server: '' })}
        >
          <option value="">—</option>
          {dcKeys.map((dc) => <option key={dc} value={dc}>{dc}</option>)}
        </select>
        {errors.dc && <p style={ERROR_STYLE}>{t(`housing.register.errors.dc.${errors.dc}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-server" style={LABEL_STYLE}>
          {t('housing.register.server')}
        </label>
        <select
          id="housing-server"
          className="housing-input"
          value={value.server}
          disabled={!value.dc}
          onChange={(e) => update('server', e.target.value)}
        >
          <option value="">—</option>
          {serverKeys.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.server && <p style={ERROR_STYLE}>{t(`housing.register.errors.server.${errors.server}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-area" style={LABEL_STYLE}>
          {t('housing.register.area')}
        </label>
        <select
          id="housing-area"
          className="housing-input"
          value={value.area}
          onChange={(e) => update('area', e.target.value as HousingArea)}
        >
          <option value="">—</option>
          {HOUSING_AREAS.map((a) => (
            <option key={a} value={a}>{getAreaName(a, i18n.language)}</option>
          ))}
        </select>
        {errors.area && <p style={ERROR_STYLE}>{t(`housing.register.errors.area.${errors.area}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-ward" style={LABEL_STYLE}>
          {t('housing.register.ward')}
        </label>
        <input
          id="housing-ward"
          type="number"
          min={WARD_RANGE.min}
          max={WARD_RANGE.max}
          className="housing-input"
          value={value.ward}
          onChange={(e) => update('ward', Number(e.target.value))}
        />
        {errors.ward && <p style={ERROR_STYLE}>{t(`housing.register.errors.ward.${errors.ward}`)}</p>}
      </div>

      <div>
        <label style={LABEL_STYLE}>
          {t('housing.register.building_type.label')}
        </label>
        <div style={{ display: 'flex', gap: 24 }}>
          <label style={RADIO_LABEL_STYLE}>
            <input
              type="radio"
              name="housing-building-type"
              value="house"
              checked={isHouse}
              onChange={() => handleBuildingTypeChange('house')}
            />
            {t('housing.register.building_type.house')}
          </label>
          <label style={RADIO_LABEL_STYLE}>
            <input
              type="radio"
              name="housing-building-type"
              value="apartment"
              checked={isApartment}
              onChange={() => handleBuildingTypeChange('apartment')}
            />
            {t('housing.register.building_type.apartment')}
          </label>
        </div>
        {errors.buildingType && (
          <p style={ERROR_STYLE}>
            {t(`housing.register.errors.buildingType.${errors.buildingType}`)}
          </p>
        )}
      </div>

      {isHouse && (
        <>
          <div>
            <label htmlFor="housing-plot" style={LABEL_STYLE}>
              {t('housing.register.plot')}
            </label>
            <input
              id="housing-plot"
              type="number"
              min={PLOT_RANGE.min}
              max={PLOT_RANGE.max}
              className="housing-input"
              value={value.plot ?? ''}
              onChange={(e) => update('plot', Number(e.target.value))}
            />
            {errors.plot && <p style={ERROR_STYLE}>{t(`housing.register.errors.plot.${errors.plot}`)}</p>}
            {value.plot != null && value.plot >= 31 && value.plot <= 60 && (
              <p style={{
                fontSize: 'var(--housing-text-sm)',
                color: 'var(--housing-text-dim)',
                marginTop: 4,
              }}>
                {t('housing.register.address.expansionWardNote')}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="housing-size" style={LABEL_STYLE}>
              {t('housing.register.size')}
            </label>
            <select
              id="housing-size"
              className="housing-input"
              value={value.size ?? ''}
              onChange={(e) => update('size', e.target.value as HousingSize)}
            >
              {HOUSING_SIZES.map((s) => {
                const label = housingSizeMasterData.find((m) => m.id === s)?.label ?? s;
                return <option key={s} value={s}>{label}</option>;
              })}
            </select>
            {errors.size && <p style={ERROR_STYLE}>{t(`housing.register.errors.size.${errors.size}`)}</p>}
          </div>
        </>
      )}

      {isApartment && (
        <>
          <div>
            <label style={LABEL_STYLE}>
              {t('housing.register.apartment_building.label')}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={RADIO_LABEL_STYLE}>
                <input
                  type="radio"
                  name="housing-apartment-building"
                  value="1"
                  checked={value.apartmentBuilding === 1}
                  onChange={() => update('apartmentBuilding', 1)}
                />
                {t('housing.register.apartment_building.main')}
              </label>
              <label style={RADIO_LABEL_STYLE}>
                <input
                  type="radio"
                  name="housing-apartment-building"
                  value="2"
                  checked={value.apartmentBuilding === 2}
                  onChange={() => update('apartmentBuilding', 2)}
                />
                {t('housing.register.apartment_building.sub')}
              </label>
            </div>
            {errors.apartmentBuilding && (
              <p style={ERROR_STYLE}>
                {t(`housing.register.errors.apartmentBuilding.${errors.apartmentBuilding}`)}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="housing-room-number" style={LABEL_STYLE}>
              {t('housing.register.room_number')}
            </label>
            <input
              id="housing-room-number"
              type="number"
              min={APARTMENT_ROOM_RANGE.min}
              max={APARTMENT_ROOM_RANGE.max}
              className="housing-input"
              value={value.roomNumber ?? ''}
              onChange={(e) => update('roomNumber', Number(e.target.value))}
            />
            {errors.roomNumber && (
              <p style={ERROR_STYLE}>
                {t(`housing.register.errors.roomNumber.${errors.roomNumber}`)}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
};
