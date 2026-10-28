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
import { getPlotSize } from '../data/housing/wardPlotSizes.js';
import { DC_SERVER_MAP, serversForDC } from '../data/housing/dcServerMap.js';
import {
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  PRIVATE_CHAMBER_RANGE,
  HOUSING_LIMITS,
  MAX_TITLE_LENGTH,
} from '../constants/housing.js';
import { isValidTagId } from '../data/housingTags.js';
import { fail, ok, type ValidationErrors, type ValidationResult } from './housingValidationResult.js';
import { validateImage } from './housingImageValidation.js';

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
  title?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  publishUntil?: number | null;
  /** 2026-07-24: 公開期限切れ後にどちらへ倒すか。publishUntil 設定時のみ意味を持つ。 */
  afterExpiryVisibility?: 'unlisted' | 'private';
  /**
   * 2026-09-01: 登録直後の「新着ハウジング」Discord 通知 (LoPo 運営が X で紹介する下書き) を
   * 許可するか。既定は許可 (未指定 / true)。登録画面で「公開」を選んだときだけトグルが出る。
   * 住所非公開・非公開はそもそも通知しないため無関係。
   */
  allowPromoTweet?: boolean;

  // SNS 画像 (任意。未指定なら imageMode='none' 扱い)
  // sns 経路の source は Twitter (tweetId) / YouTube (youtubeVideoId) / OGP (sourceImageUrls) の 3 種、 排他。
  imageMode?: 'sns' | 'none';
  postUrl?: string;
  /** 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧(貼った順、最大5件、MAX_SOURCE_POST_URLS同期)。 */
  sourcePostUrls?: string[];
  ogImageUrl?: string;
  tweetId?: string;
  youtubeVideoId?: string;
  /**
   * 2026-05-27 追加: 外部画像 URL リスト (1-10 件、 MAX_SOURCE_IMAGE_URLS 同期)。
   * **LoPo の倉庫にコピーせず**、 表示時に `<img src>` で元サイトを直接読む。
   *
   * 2 経路で使われる (2026-05-27 排他緩和):
   * - OGP 経路 (housingsnap / studio-xiv 等): postUrl が allowlist 内、 各 URL は非 private IP
   * - Twitter 静止画ツイート (tweetId 併用): 各 URL は pbs.twimg.com 限定
   *
   * youtubeVideoId とは排他 (YouTube は storyboard を都度生成、 静止画 URL を保存しない)。
   */
  sourceImageUrls?: string[];
  sourceImageAspectRatios?: number[];

  /**
   * 2026-05-27 追加: Twitter 動画ツイートの mp4 URL。 tweetId 必須、
   * sourceImageUrls とは排他 (動画ツイートは 1 video のみ)。
   * host は video.twimg.com 限定 (validateImage で検証)。
   */
  videoUrl?: string;
  /** 2026-05-27 追加: Twitter 動画の poster URL (pbs.twimg.com 限定)。 */
  videoPosterUrl?: string;
  /** 2026-05-27 追加: 動画 aspect ratio (width/height、 正の数)。 */
  videoAspectRatio?: number;
}


export function validateAddress(addr: AddressInput): ValidationResult {
  const errors: ValidationErrors = {};

  // 必須共通
  if (!addr.dc || addr.dc.trim() === '') errors.dc = 'required';
  if (!addr.server || addr.server.trim() === '') errors.server = 'required';
  // DC/ワールドの実在検証 (2026-07-18 中韓対応)。未知 DC は登録させない。
  if (!errors.dc && !DC_SERVER_MAP[addr.dc]) errors.dc = 'unknown';
  if (!errors.dc && !errors.server && !serversForDC(addr.dc).includes(addr.server)) errors.server = 'unknown';
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

    // area/plot/size がそれぞれ単体で妥当なときに限り、区画から決まるサイズと一致するか検証。
    // (手入力を止めて自動導出する設計なので、食い違いは登録データの汚染を意味する)
    // - いずれかが既にエラーなら二重エラーを避けて飛ばす。
    // - getPlotSize が null (= 表に無い区画) なら何もしない (将来のパッチで区画が増えても登録を止めない)。
    if (!errors.area && !errors.plot && !errors.size) {
      const expected = getPlotSize(String(addr.area), addr.plot as number);
      if (expected !== null && addr.size !== expected) {
        errors.size = 'mismatch_with_plot';
      }
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
function validateTags(tags: string[]): ValidationResult {
  if (!Array.isArray(tags)) return fail({ tags: 'invalid_type' });
  if (tags.length > HOUSING_LIMITS.MAX_TAGS_PER_LISTING) return fail({ tags: 'max_exceeded' });
  if (new Set(tags).size !== tags.length) return fail({ tags: 'duplicate' });
  for (const id of tags) {
    if (!isValidTagId(id)) return fail({ tags: 'unknown_tag' });
  }
  return ok();
}

function validateDescription(desc: string | undefined): ValidationResult {
  if (desc === undefined || desc === '') return ok();
  if (typeof desc !== 'string') return fail({ description: 'invalid_type' });
  if (desc.length > HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH) return fail({ description: 'too_long' });
  return ok();
}

export function validateTitle(title: string | undefined): ValidationResult {
  // undefined = 未送信 (旧登録モーダル経路)。サーバー共有バリデーションは寛容にし、
  // 必須の強制は新 RegisterPage / 編集モーダルのクライアント側で行う (spec A-1)。
  if (title === undefined) return ok();
  const trimmed = title.trim();
  if (trimmed.length === 0) return fail({ title: 'required' });
  if (trimmed.length > MAX_TITLE_LENGTH) return fail({ title: 'too_long' });
  return ok();
}

export function validateRegistrationDraft(draft: RegistrationDraft): ValidationResult {
  const errors: ValidationErrors = {};
  Object.assign(errors, validateAddress(draft).errors);
  Object.assign(errors, validateTags(draft.tags).errors);
  Object.assign(errors, validateDescription(draft.description).errors);
  Object.assign(errors, validateTitle(draft.title).errors);
  Object.assign(errors, validateImage(draft).errors);
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

/**
 * 公開終了日時 (publishUntil) の保存前正規化。register / update 両ハンドラで使用。
 *
 * 過去日時を null (=無期限公開) に倒してはいけない: 「6/30 まで」のつもりの登録が
 * 恒久公開になる情報漏れ (fail-open) になる (2026-07-03 実機バグ)。過去日時は
 * そのまま保存し、遅延評価 (isEffectivelyPublic / firestore.rules の get 条件) が
 * 即・期限切れ=他人非表示にする (fail-closed)。null に落とすのは型不正のみ。
 */
export function normalizePublishUntil(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * 公開期限切れ後の倒し先の保存前正規化。register / update 両ハンドラで使用。
 * 不正値・未指定は 'unlisted' (住所だけ隠す穏当な方) に倒す。
 */
export function normalizeAfterExpiryVisibility(value: unknown): 'unlisted' | 'private' {
  return value === 'private' ? 'private' : 'unlisted';
}
