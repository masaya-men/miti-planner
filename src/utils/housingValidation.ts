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
import { isOgpUrlAllowed } from '../lib/housing/ogpHostAllowlist.js';
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
  // sns 経路の source は Twitter (tweetId) / YouTube (youtubeVideoId) / OGP (sourceImageUrls) の 3 種、 排他。
  imageMode?: 'sns' | 'none';
  postUrl?: string;
  ogImageUrl?: string;
  tweetId?: string;
  youtubeVideoId?: string;
  /**
   * 2026-05-27 追加: OGP 経由で取得した外部画像 URL リスト (1-4 件)。
   * **LoPo の倉庫にコピーせず**、 表示時に `<img src>` で元サイトを直接読む。
   * tweetId / youtubeVideoId とは排他 (OGP 専用)。
   */
  sourceImageUrls?: string[];
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

/**
 * タグ検証。 2026-05-27 にタグ optional 化 (0 件 OK)。 上限 5 件は維持。
 * 個人タグ機能 (1 ユーザー 1 タグ) と公式タグ刷新は別セッションで設計予定 (docs/.private/2026-05-27-tag-system-redesign.md)。
 */
export function validateTags(tags: string[]): ValidationResult {
  if (!Array.isArray(tags)) return fail({ tags: 'invalid_type' });
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
 * sourceImageUrls の各 URL が「Firestore に保存して `<img src>` 直接表示するのに安全」 か判定。
 * - https 必須
 * - private IP (10.x / 127.x / 169.254.x / 172.16-31.x / 192.168.x / 0.x) 拒否
 *
 * 注: OGP 経由で取得した時点で api/og.ts の isImageUrlSafe を通過済みだが、
 * 悪意あるクライアントが直接 API を叩く可能性に備えてサーバー側で再 check する。
 */
function isExternalImageUrlSafe(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:') return false;
    const ipv4 = u.hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const a = Number(ipv4[1]);
      const b = Number(ipv4[2]);
      if (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        a === 0
      ) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Firestore に保存する sourceImageUrls の最大件数 (一覧と詳細での性能配慮)。 */
const MAX_SOURCE_IMAGE_URLS = 4;

// 2026-05-26: YouTube サムネ用 host allowlist (任意 URL 注入を防ぐ)。
const YOUTUBE_THUMB_HOSTS = new Set(['img.youtube.com', 'i.ytimg.com']);
function isYoutubeThumbHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return YOUTUBE_THUMB_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

/**
 * SNS 画像フィールドの検証。imageMode!=='sns' のときは常に ok。
 * sns のときは source が 3 種で排他:
 * - Twitter: ogImageUrl が pbs.twimg.com 限定、 tweetId は数字 1-20 桁。
 * - YouTube: ogImageUrl が img.youtube.com / i.ytimg.com 限定、 youtubeVideoId は 11 文字 [A-Za-z0-9_-]。
 * - OGP (housingsnap / studio-xiv 等): postUrl が ogpHostAllowlist 内、
 *   sourceImageUrls が 1-{MAX_SOURCE_IMAGE_URLS} 件、 各 URL は https + 非 private IP、
 *   ogImageUrl は sourceImageUrls[0] と一致 (= 1 枚目代表)。
 */
export function validateImage(draft: RegistrationDraft): ValidationResult {
  if (draft.imageMode !== 'sns') return ok();
  const errors: ValidationErrors = {};
  if (!isHttpsUrl(draft.postUrl)) errors.postUrl = 'invalid';

  const hasTweet = !!draft.tweetId;
  const hasYoutube = !!draft.youtubeVideoId;
  const hasSourceUrls = Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0;

  const sourceCount = (hasTweet ? 1 : 0) + (hasYoutube ? 1 : 0) + (hasSourceUrls ? 1 : 0);
  if (sourceCount > 1) {
    errors.imageMode = 'conflict_sources';
    return fail(errors);
  }
  if (sourceCount === 0) {
    errors.imageMode = 'source_required_for_sns';
    return fail(errors);
  }

  if (hasTweet) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isPbsTwimgHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^\d{1,20}$/.test(draft.tweetId!)) errors.tweetId = 'invalid';
  } else if (hasYoutube) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isYoutubeThumbHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(draft.youtubeVideoId!)) {
      errors.youtubeVideoId = 'invalid';
    }
  } else {
    // OGP 経路
    if (!isOgpUrlAllowed(draft.postUrl ?? '')) {
      errors.postUrl = 'not_in_ogp_allowlist';
    }
    const urls = draft.sourceImageUrls!;
    if (urls.length > MAX_SOURCE_IMAGE_URLS) {
      errors.sourceImageUrls = 'too_many';
    } else if (urls.some((u) => typeof u !== 'string' || !isExternalImageUrlSafe(u))) {
      errors.sourceImageUrls = 'invalid_url';
    } else if (new Set(urls).size !== urls.length) {
      errors.sourceImageUrls = 'duplicate';
    } else if (!isHttpsUrl(draft.ogImageUrl) || draft.ogImageUrl !== urls[0]) {
      errors.ogImageUrl = 'must_match_first_source';
    }
  }
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

/**
 * 検証済み draft から listing に保存する画像フィールドを生成する。
 * sns + 全フィールド揃いのときのみ sns 保存、それ以外は 'none'。
 * (この関数を呼ぶ前に validateImage が ok であることを前提とする)
 *
 * - Twitter source: tweetId + lastTweetCheckAt を保存
 * - YouTube source: youtubeVideoId を保存
 * - OGP source: sourceImageUrls を保存 (= 外部 URL 直接表示、 Storage コピーなし)
 */
export function buildListingImageFields(
  draft: RegistrationDraft,
  now: number,
):
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; tweetId: string; lastTweetCheckAt: number }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; youtubeVideoId: string }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; sourceImageUrls: string[] }
  | { imageMode: 'none' } {
  if (draft.imageMode === 'sns' && draft.postUrl && draft.ogImageUrl) {
    if (draft.tweetId) {
      return {
        imageMode: 'sns',
        postUrl: draft.postUrl,
        ogImageUrl: draft.ogImageUrl,
        tweetId: draft.tweetId,
        lastTweetCheckAt: now,
      };
    }
    if (draft.youtubeVideoId) {
      return {
        imageMode: 'sns',
        postUrl: draft.postUrl,
        ogImageUrl: draft.ogImageUrl,
        youtubeVideoId: draft.youtubeVideoId,
      };
    }
    if (Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0) {
      return {
        imageMode: 'sns',
        postUrl: draft.postUrl,
        ogImageUrl: draft.ogImageUrl,
        sourceImageUrls: draft.sourceImageUrls.slice(0, MAX_SOURCE_IMAGE_URLS),
      };
    }
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
