/**
 * ハウジング登録フォームのバリデーション (純粋関数)
 *
 * 設計書 §4.2 / §6.1 / §13.1 と整合。
 * クライアント (React フォーム) と サーバー (/api/housing) の両方で使用。
 */
import {
  isValidHousingArea,
  isValidHousingSize,
  isValidBuildingType,
  isValidOwnerType,
  isValidSubdivision,
  type HousingArea,
  type HousingSize,
  type BuildingType,
  type OwnerType,
  type RoomKind,
  type Subdivision,
} from '../types/housing.js';
import {
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  PRIVATE_CHAMBER_RANGE,
  HOUSING_LIMITS,
} from '../constants/housing.js';
import { isValidTagId } from '../data/housingTags.js';

export interface AddressInput {
  dc: string;
  server: string;
  area: HousingArea | string;
  ward: number;
  subdivision: Subdivision | string;        // NEW

  buildingType: BuildingType | string;       // NEW

  // house の場合
  ownerType?: OwnerType | string;
  plot?: number;
  size?: HousingSize | string;

  // 部屋区分
  roomKind?: RoomKind | string;
  roomNumber?: number;
}

export interface RegistrationDraft extends AddressInput {
  tags: string[];
  description?: string;
}

export type ValidationErrors = Partial<Record<string, string>>;
export interface ValidationResult { ok: boolean; errors: ValidationErrors; }

const ok = (): ValidationResult => ({ ok: true, errors: {} });
const fail = (errors: ValidationErrors): ValidationResult => ({ ok: false, errors });

export function validateAddress(addr: AddressInput): ValidationResult {
  const errors: ValidationErrors = {};

  // 必須共通
  if (!addr.dc || addr.dc.trim() === '') errors.dc = 'required';
  if (!addr.server || addr.server.trim() === '') errors.server = 'required';
  if (!addr.area || !isValidHousingArea(String(addr.area))) errors.area = 'invalid';
  if (!Number.isInteger(addr.ward) || addr.ward < WARD_RANGE.min || addr.ward > WARD_RANGE.max) {
    errors.ward = 'out_of_range';
  }
  if (!addr.subdivision || !isValidSubdivision(String(addr.subdivision))) {
    errors.subdivision = 'invalid';
  }
  if (!addr.buildingType || !isValidBuildingType(String(addr.buildingType))) {
    errors.buildingType = 'invalid';
  }

  // buildingType 別の制約
  if (addr.buildingType === 'house') {
    // ownerType 必須
    if (!addr.ownerType || !isValidOwnerType(String(addr.ownerType))) {
      errors.ownerType = 'required_for_house';
    }
    // plot 必須 + 範囲
    if (!Number.isInteger(addr.plot) || (addr.plot as number) < PLOT_RANGE.min || (addr.plot as number) > PLOT_RANGE.max) {
      errors.plot = 'out_of_range';
    }
    // size 必須
    if (!addr.size || !isValidHousingSize(String(addr.size))) {
      errors.size = 'invalid';
    }

    // 部屋区分
    if (addr.roomKind === 'private_chamber') {
      // FC ハウス限定
      if (addr.ownerType !== 'fc') {
        errors.roomKind = 'private_chamber_requires_fc';
      }
      // roomNumber 必須 + 範囲
      if (!Number.isInteger(addr.roomNumber)
          || (addr.roomNumber as number) < PRIVATE_CHAMBER_RANGE.min
          || (addr.roomNumber as number) > PRIVATE_CHAMBER_RANGE.max) {
        errors.roomNumber = 'out_of_range';
      }
    } else if (addr.roomKind !== undefined) {
      errors.roomKind = 'invalid_for_house';
    }
  } else if (addr.buildingType === 'apartment') {
    // plot / size / ownerType 不可
    if (addr.plot !== undefined) errors.plot = 'not_allowed_for_apartment';
    if (addr.size !== undefined) errors.size = 'not_allowed_for_apartment';
    if (addr.ownerType !== undefined) errors.ownerType = 'not_allowed_for_apartment';

    // roomKind は 'apartment_room' 必須
    if (addr.roomKind !== 'apartment_room') {
      errors.roomKind = 'apartment_room_required';
    }
    // roomNumber 必須 + 範囲
    if (!Number.isInteger(addr.roomNumber)
        || (addr.roomNumber as number) < APARTMENT_ROOM_RANGE.min
        || (addr.roomNumber as number) > APARTMENT_ROOM_RANGE.max) {
      errors.roomNumber = 'out_of_range';
    }
  }

  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

export function validateTags(tags: string[]): ValidationResult {
  if (!Array.isArray(tags) || tags.length === 0) return fail({ tags: 'min_one_required' });
  if (tags.length > HOUSING_LIMITS.MAX_TAGS_PER_LISTING) return fail({ tags: 'max_exceeded' });
  if (new Set(tags).size !== tags.length) return fail({ tags: 'duplicate' });
  for (const id of tags) {
    if (!isValidTagId(id)) return fail({ tags: 'unknown_tag' });
  }
  return ok();
}

export function validateDescription(desc: string | undefined): ValidationResult {
  if (desc === undefined || desc === '') return ok();
  if (typeof desc !== 'string') return fail({ description: 'invalid_type' });
  if (desc.length > HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH) return fail({ description: 'too_long' });
  return ok();
}

export function validateRegistrationDraft(draft: RegistrationDraft): ValidationResult {
  const errors: ValidationErrors = {};
  Object.assign(errors, validateAddress(draft).errors);
  Object.assign(errors, validateTags(draft.tags).errors);
  Object.assign(errors, validateDescription(draft.description).errors);
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}
