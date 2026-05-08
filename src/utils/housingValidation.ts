/**
 * ハウジング登録フォームのバリデーション (純粋関数)
 *
 * 設計書 §4.2 / §6.1 / §13.1 と整合。
 * クライアント (React フォーム) と サーバー (/api/housing) の両方で使用。
 */
import {
  isValidHousingArea,
  isValidHousingSize,
  type HousingArea,
  type HousingSize,
} from '../types/housing';
import {
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  HOUSING_LIMITS,
} from '../constants/housing';
import { isValidTagId } from '../data/housingTags';

export interface AddressInput {
  dc: string;
  server: string;
  area: HousingArea | string;
  ward: number;
  plot: number;
  size: HousingSize | string;
  apartmentRoom?: number;
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

  if (!addr.dc || addr.dc.trim() === '') errors.dc = 'required';
  if (!addr.server || addr.server.trim() === '') errors.server = 'required';
  if (!addr.area || !isValidHousingArea(String(addr.area))) errors.area = 'invalid';

  if (!Number.isInteger(addr.ward) || addr.ward < WARD_RANGE.min || addr.ward > WARD_RANGE.max) {
    errors.ward = 'out_of_range';
  }
  if (!Number.isInteger(addr.plot) || addr.plot < PLOT_RANGE.min || addr.plot > PLOT_RANGE.max) {
    errors.plot = 'out_of_range';
  }
  if (!addr.size || !isValidHousingSize(String(addr.size))) errors.size = 'invalid';

  if (addr.size === 'Apartment') {
    const r = addr.apartmentRoom;
    if (!Number.isInteger(r) || (r as number) < APARTMENT_ROOM_RANGE.min || (r as number) > APARTMENT_ROOM_RANGE.max) {
      errors.apartmentRoom = 'required_for_apartment';
    }
  } else if (addr.apartmentRoom !== undefined) {
    errors.apartmentRoom = 'not_allowed_for_size';
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
