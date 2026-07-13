import { useTranslation } from 'react-i18next';
import { serverMasterData, housingSizeMasterData } from '../../../data/masterData';
import { HOUSING_AREAS, type HousingArea, type HousingSize } from '../../../types/housing';
import { WARD_RANGE, PLOT_RANGE, APARTMENT_ROOM_RANGE, PRIVATE_CHAMBER_RANGE } from '../../../constants/housing';
import { getAreaName } from '../../../lib/housing/areaName';
import type { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { HousingNumberStepper } from './HousingNumberStepper';

export interface RegisterAddressValues {
  dc?: string;
  server?: string;
  area?: HousingArea | string;
  ward?: number;
  buildingType?: 'house' | 'apartment';
  plot?: number;
  size?: HousingSize | string;
  apartmentBuilding?: 1 | 2;
  roomKind?: 'private_chamber' | 'apartment_room';
  roomNumber?: number;
}

interface Props {
  fieldState: ReturnType<typeof useHousingFieldState>;
  values: RegisterAddressValues;
  /** buildingType 等の切替でフィールドを一括更新するとき用 (排他フィールドの初期化に使う)。 */
  onChange: (name: string, value: unknown) => void;
  /**
   * 'register' (既定) = 登録フォームのフル表示。 'tour' = 一時ツアー追加モーダル用に、
   * 登録固有の部分 (セクション見出し / 自動入力注記 / サイズ自動導出 / 一軒家の個室区分) を隠す。
   * ツアーは区画へ行くので house は区画ベースで足り、DC/サーバー/エリア/区/番地は共通で残す。
   */
  variant?: 'register' | 'tour';
  /**
   * 指定時: DC の直下に赤字でこの注記を表示し、DC 以外の全フィールドをロック (選ばせない)。
   * 一時ツアー追加で別リージョンの DC を選んだときに、無駄入力させず即座に理由を見せるため。
   */
  crossRegionNotice?: string | null;
}

/**
 * 登録フォーム中央カラム: 住所セクション (DC/サーバー/エリア/区・建物タイプ・番地/号棟/部屋)。
 * データモデルは新シェルの共有バリデーション (RegistrationDraft / AddressInput、
 * `src/utils/housingValidation.ts`) に合わせ、buildingType('house'|'apartment') +
 * roomKind ベースを採用する (旧 HousingRegisterForm.tsx の 5 択 HousingExtractSize モデルは
 * 新バックエンド/WardMapPreview と不整合のため踏襲しない)。
 */
export const RegisterSectionAddress: React.FC<Props> = ({ fieldState, values, onChange, variant = 'register', crossRegionNotice }) => {
  const { t, i18n } = useTranslation();
  const { dc, server, area, ward, buildingType, plot, size, apartmentBuilding, roomKind, roomNumber } = values;

  const dcKeys = Object.keys(serverMasterData);
  const serverKeys = dc ? Object.keys(serverMasterData[dc]?.servers ?? {}) : [];

  // 別リージョンの DC を選んだとき等: DC 以外を選ばせない (注記で理由を明示)。
  const locked = Boolean(crossRegionNotice);

  const isHouse = buildingType !== 'apartment';
  const isApartment = buildingType === 'apartment';
  const isPrivateChamber = isHouse && roomKind === 'private_chamber';

  const handleBuildingTypeChange = (next: 'house' | 'apartment') => {
    if (next === buildingType) return;
    if (next === 'house') {
      onChange('buildingType', 'house');
      onChange('apartmentBuilding', undefined);
      onChange('roomKind', undefined);
      onChange('roomNumber', undefined);
    } else {
      onChange('buildingType', 'apartment');
      onChange('plot', undefined);
      onChange('size', undefined);
      onChange('apartmentBuilding', 1);
      onChange('roomKind', 'apartment_room');
      onChange('roomNumber', 1);
    }
  };

  const renderBadge = (name: string) =>
    fieldState.getState(name) === 'auto-filled' ? (
      <span className="housing-field-badge" data-testid={`housing-auto-badge-${name}`} aria-hidden="true">
        🟡
      </span>
    ) : null;

  return (
    <section className="housing-register-section" data-testid="housing-register-section-address">
      {variant === 'register' && (
        <>
          <h2 className="housing-register-section-title">{t('housing.register.section_address')}</h2>

          {/* 自動入力 (ハウジングスナップ等) を過信させない静かな注記 (#6・色付き箱にしない)。 */}
          <p className="housing-address-note" data-testid="housing-register-address-verify-note">
            {t('housing.register.address_verify_note')}
          </p>
        </>
      )}

      <div className="housing-register-fields-grid">
        <div className="housing-field" data-state={fieldState.getState('dc')}>
          <label htmlFor="housing-register-dc" className="housing-label">
            {t('housing.register.dc')}
          </label>
          <select
            id="housing-register-dc"
            className="housing-input"
            value={dc ?? ''}
            onChange={(e) => onChange('dc', e.target.value || undefined)}
          >
            <option value="">—</option>
            {dcKeys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          {renderBadge('dc')}
        </div>

        <div className="housing-field" data-state={fieldState.getState('server')}>
          <label htmlFor="housing-register-server" className="housing-label">
            {t('housing.register.server')}
          </label>
          <select
            id="housing-register-server"
            className="housing-input"
            value={server ?? ''}
            disabled={!dc || locked}
            onChange={(e) => onChange('server', e.target.value || undefined)}
          >
            <option value="">—</option>
            {serverKeys.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          {renderBadge('server')}
        </div>

        {crossRegionNotice && (
          <p
            className="housing-error-text housing-register-cross-region-notice"
            data-testid="housing-cross-region-notice"
          >
            {crossRegionNotice}
          </p>
        )}

        <div className="housing-field" data-state={fieldState.getState('area')}>
          <label htmlFor="housing-register-area" className="housing-label">
            {t('housing.register.area')}
          </label>
          <select
            id="housing-register-area"
            className="housing-input"
            value={area ?? ''}
            disabled={locked}
            onChange={(e) => onChange('area', e.target.value || undefined)}
          >
            <option value="">—</option>
            {HOUSING_AREAS.map((a) => (
              <option key={a} value={a}>{getAreaName(a, i18n.language)}</option>
            ))}
          </select>
          {renderBadge('area')}
        </div>

        <div className="housing-field" data-state={fieldState.getState('ward')}>
          <label htmlFor="housing-register-ward" className="housing-label">
            {t('housing.register.ward')}
          </label>
          <HousingNumberStepper
            id="housing-register-ward"
            min={WARD_RANGE.min}
            max={WARD_RANGE.max}
            value={ward}
            disabled={locked}
            onChange={(v) => onChange('ward', v)}
          />
          {renderBadge('ward')}
        </div>

        <div className="housing-field housing-field-full" data-state={fieldState.getState('buildingType')}>
          <label className="housing-label">{t('housing.register.building_type.label')}</label>
          <div className="housing-type-selector" role="radiogroup">
            <button
              type="button"
              className="housing-type-chip"
              data-selected={isHouse ? 'true' : 'false'}
              role="radio"
              aria-checked={isHouse}
              disabled={locked}
              onClick={() => handleBuildingTypeChange('house')}
            >
              {t('housing.register.building_type.house')}
            </button>
            <button
              type="button"
              className="housing-type-chip"
              data-selected={isApartment ? 'true' : 'false'}
              role="radio"
              aria-checked={isApartment}
              disabled={locked}
              onClick={() => handleBuildingTypeChange('apartment')}
            >
              {t('housing.register.building_type.apartment')}
            </button>
          </div>
        </div>

        {isHouse && (
          <>
            <div className="housing-field housing-conditional-field" data-state={fieldState.getState('plot')}>
              <label htmlFor="housing-register-plot" className="housing-label">
                {t('housing.register.plot')}
              </label>
              <HousingNumberStepper
                id="housing-register-plot"
                min={PLOT_RANGE.min}
                max={PLOT_RANGE.max}
                value={plot}
                disabled={locked}
                onChange={(v) => onChange('plot', v)}
              />
              {renderBadge('plot')}
            </div>

            {variant === 'register' && (
              <div className="housing-field housing-conditional-field" data-state={fieldState.getState('size')}>
                <label htmlFor="housing-register-size" className="housing-label">
                  {t('housing.register.size')}
                </label>
                {/* 区画から自動導出される読み取り専用値 (Task3-1)。旧 disabled <select> は
                    「選べそうに見えるが選べない」ドロップダウン矢印が出てしまうため、
                    導出値をそのまま表示する読み取り専用フィールドに置き換える。 */}
                <input
                  id="housing-register-size"
                  className="housing-input"
                  type="text"
                  value={size ? (housingSizeMasterData.find((m) => m.id === size)?.label ?? size) : ''}
                  disabled
                  readOnly
                />
                {renderBadge('size')}
              </div>
            )}

            {variant === 'register' && (
              <div className="housing-field housing-field-full housing-conditional-field" data-state={fieldState.getState('roomKind')}>
                <label className="housing-label">{t('housing.register.room_kind.label')}</label>
                <div className="housing-type-selector" role="radiogroup">
                  <button
                    type="button"
                    className="housing-type-chip"
                    data-selected={roomKind == null ? 'true' : 'false'}
                    role="radio"
                    aria-checked={roomKind == null}
                    onClick={() => {
                      onChange('roomKind', undefined);
                      onChange('roomNumber', undefined);
                    }}
                  >
                    {t('housing.register.room_kind.whole_house')}
                  </button>
                  <button
                    type="button"
                    className="housing-type-chip"
                    data-selected={roomKind === 'private_chamber' ? 'true' : 'false'}
                    role="radio"
                    aria-checked={roomKind === 'private_chamber'}
                    onClick={() => onChange('roomKind', 'private_chamber')}
                  >
                    {t('housing.register.room_kind.private_chamber')}
                  </button>
                </div>
              </div>
            )}

            {isPrivateChamber && (
              <div className="housing-field housing-conditional-field" data-state={fieldState.getState('roomNumber')}>
                <label htmlFor="housing-register-room-number" className="housing-label">
                  {t('housing.register.room_number')}
                </label>
                <HousingNumberStepper
                  id="housing-register-room-number"
                  min={PRIVATE_CHAMBER_RANGE.min}
                  max={PRIVATE_CHAMBER_RANGE.max}
                  value={roomNumber}
                  disabled={locked}
                  onChange={(v) => onChange('roomNumber', v)}
                />
                {renderBadge('roomNumber')}
              </div>
            )}
          </>
        )}

        {isApartment && (
          <>
            {/* 号棟は部屋番号と横並び(2カラム)に収めるため、全幅チップではなく半幅セレクトにする
                (アパルトメント選択時のレイアウトのガタつきも解消・ユーザー要望 2026-07-13)。 */}
            <div className="housing-field housing-conditional-field" data-state={fieldState.getState('apartmentBuilding')}>
              <label htmlFor="housing-register-apartment-building" className="housing-label">
                {t('housing.register.apartment_building.label')}
              </label>
              <select
                id="housing-register-apartment-building"
                className="housing-input"
                value={apartmentBuilding ?? 1}
                disabled={locked}
                onChange={(e) => onChange('apartmentBuilding', Number(e.target.value))}
              >
                <option value={1}>{t('housing.register.apartment_building.main')}</option>
                <option value={2}>{t('housing.register.apartment_building.sub')}</option>
              </select>
            </div>

            <div className="housing-field housing-conditional-field" data-state={fieldState.getState('roomNumber')}>
              <label htmlFor="housing-register-apartment-room-number" className="housing-label">
                {t('housing.register.room_number')}
              </label>
              <HousingNumberStepper
                id="housing-register-apartment-room-number"
                min={APARTMENT_ROOM_RANGE.min}
                max={APARTMENT_ROOM_RANGE.max}
                value={roomNumber}
                disabled={locked}
                onChange={(v) => onChange('roomNumber', v)}
              />
              {renderBadge('roomNumber')}
            </div>
          </>
        )}
      </div>
    </section>
  );
};
