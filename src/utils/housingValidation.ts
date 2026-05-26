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
  type HousingArea,
  type HousingSize,
  type BuildingType,
  type RoomKind,
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

  buildingType: BuildingType | string;

  // house の場合
  plot?: number;        // 1-60 (本街 1-30 / 拡張街 31-60 通し)
  size?: HousingSize | string;

  // apartment の場合
  /** 号棟: 1=本街アパート、 2=拡張街アパート。 buildingType='apartment' のとき必須 */
  apartmentBuilding?: 1 | 2;

  // 部屋区分
  roomKind?: RoomKind | string;
  roomNumber?: number;
}

export interface RegistrationDraft extends AddressInput {
  tags: string[];
  description?: string;

  // SNS 画像 (任意。未指定なら imageMode='none' 扱い)
  imageMode?: 'sns' | 'none';
  postUrl?: string;
  ogImageUrl?: string;
  tweetId?: string;
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
  if (!addr.buildingType || !isValidBuildingType(String(addr.buildingType))) {
    errors.buildingType = 'invalid';
  }

  // buildingType 別の制約 (3 パターン: 家全体 / FC 個室 / アパ部屋)
  if (addr.buildingType === 'house') {
    // plot 必須 + 範囲 (1-60 通し番号)
    if (!Number.isInteger(addr.plot) || (addr.plot as number) < PLOT_RANGE.min || (addr.plot as number) > PLOT_RANGE.max) {
      errors.plot = 'out_of_range';
    }
    // size 必須 (個室の場合は親 plot のサイズ)
    if (!addr.size || !isValidHousingSize(String(addr.size))) {
      errors.size = 'invalid';
    }

    // 部屋区分
    if (addr.roomKind === 'private_chamber') {
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
    // plot / size 不可
    if (addr.plot !== undefined) errors.plot = 'not_allowed_for_apartment';
    if (addr.size !== undefined) errors.size = 'not_allowed_for_apartment';

    // apartmentBuilding 必須 (1=本街 / 2=拡張街)
    if (addr.apartmentBuilding !== 1 && addr.apartmentBuilding !== 2) {
      errors.apartmentBuilding = 'out_of_range';
    }

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

function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isPbsTwimgHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return new URL(value).hostname === 'pbs.twimg.com';
  } catch {
    return false;
  }
}

/**
 * SNS 画像フィールドの検証。imageMode!=='sns' のときは常に ok。
 * sns のときは postUrl/ogImageUrl が https、ogImageUrl は pbs.twimg.com 限定
 * (任意 URL の注入・画像差し込み防止)、tweetId は数字 1-20 桁。
 */
export function validateImage(draft: RegistrationDraft): ValidationResult {
  if (draft.imageMode !== 'sns') return ok();
  const errors: ValidationErrors = {};
  if (!isHttpsUrl(draft.postUrl)) errors.postUrl = 'invalid';
  if (!isHttpsUrl(draft.ogImageUrl) || !isPbsTwimgHost(draft.ogImageUrl)) errors.ogImageUrl = 'invalid';
  if (!draft.tweetId || !/^\d{1,20}$/.test(draft.tweetId)) errors.tweetId = 'invalid';
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

/**
 * 検証済み draft から listing に保存する画像フィールドを生成する。
 * sns + 全フィールド揃いのときのみ sns 保存、それ以外は 'none'。
 * (この関数を呼ぶ前に validateImage が ok であることを前提とする)
 */
export function buildListingImageFields(
  draft: RegistrationDraft,
  now: number,
):
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; tweetId: string; lastTweetCheckAt: number }
  | { imageMode: 'none' } {
  if (draft.imageMode === 'sns' && draft.postUrl && draft.ogImageUrl && draft.tweetId) {
    return {
      imageMode: 'sns',
      postUrl: draft.postUrl,
      ogImageUrl: draft.ogImageUrl,
      tweetId: draft.tweetId,
      lastTweetCheckAt: now,
    };
  }
  return { imageMode: 'none' };
}

export function validateRegistrationDraft(draft: RegistrationDraft): ValidationResult {
  const errors: ValidationErrors = {};
  Object.assign(errors, validateAddress(draft).errors);
  Object.assign(errors, validateTags(draft.tags).errors);
  Object.assign(errors, validateDescription(draft.description).errors);
  Object.assign(errors, validateImage(draft).errors);
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}
