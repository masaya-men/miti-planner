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
import { parseTweetUrl } from '../lib/housing/tweetUrlParse.js';
import { parseYoutubeUrl } from '../lib/housing/youtubeUrl.js';
import { getPlotSize } from '../data/housing/wardPlotSizes.js';
import { DC_SERVER_MAP, serversForDC } from '../data/housing/dcServerMap.js';
import {
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  PRIVATE_CHAMBER_RANGE,
  HOUSING_LIMITS,
  MAX_TITLE_LENGTH,
  PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH,
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
  title?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  publishUntil?: number | null;

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

export type ValidationErrors = Partial<Record<string, string>>;
export interface ValidationResult { ok: boolean; errors: ValidationErrors; }

const ok = (): ValidationResult => ({ ok: true, errors: {} });
const fail = (errors: ValidationErrors): ValidationResult => ({ ok: false, errors });

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
export function validateTags(tags: string[]): ValidationResult {
  if (!Array.isArray(tags)) return fail({ tags: 'invalid_type' });
  if (tags.length > HOUSING_LIMITS.MAX_TAGS_PER_LISTING) return fail({ tags: 'max_exceeded' });
  if (new Set(tags).size !== tags.length) return fail({ tags: 'duplicate' });
  for (const id of tags) {
    if (!isValidTagId(id)) return fail({ tags: 'unknown_tag' });
  }
  return ok();
}

/**
 * 個人タグの表示名バリデーション (2026-07-10 タグ体系刷新 Phase B)。
 * 1〜PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH 文字。 文字種の制限は設けない
 * (id 側は buildPersonalTagId が別途 ASCII slug + random suffix で生成するため)。
 */
export function validatePersonalTagDisplayName(name: unknown): ValidationResult {
  if (typeof name !== 'string') return fail({ displayName: 'invalid_type' });
  const trimmed = name.trim();
  if (trimmed.length === 0) return fail({ displayName: 'required' });
  if (trimmed.length > PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH) return fail({ displayName: 'too_long' });
  return ok();
}

export function validateDescription(desc: string | undefined): ValidationResult {
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
 * 2026-05-27: Twitter 動画 mp4 URL のホスト検証 (video.twimg.com 限定)。
 * 表示時は /api/tweet-video?url= proxy 経由で <video> 再生するが、 保存時点で
 * host を絞ることで任意 URL 注入を防ぐ。
 */
function isVideoTwimgHost(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'video.twimg.com';
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

/**
 * Firestore に保存する sourceImageUrls の最大件数 (サニティ防御兼ねる)。
 * 2026-05-27: 4 → 10 に拡大 (画像は外部 URL 直接表示で LoPo 帯域消費ゼロ、 Firestore doc 1MB
 * からも十二分、 housingsnap で 12 枚撮れる物件の取りこぼし防止)。
 */
const MAX_SOURCE_IMAGE_URLS = 10;

/** 2026-07-21 追加 (Batch2): 1物件に貼れる投稿URLの最大数。 */
const MAX_SOURCE_POST_URLS = 5;

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
 * postUrl (元の投稿へのリンク) が、URL 貼り付け時に許可されているのと同じ種別
 * (Twitter/X の投稿URL・YouTube・OGP allowlist) のいずれかに一致するか判定する。
 * `classifySnsUrl` (src/lib/housing/snsUrlRouting.ts) が使う判定関数と完全に同一のものを
 * 再利用しているため、URL 貼り付け時に成功した postUrl はここでも必ず ok になる。
 */
function isKnownPostUrlHost(url: string): boolean {
  if (!isHttpsUrl(url)) return false;
  return parseTweetUrl(url) !== null || parseYoutubeUrl(url) !== null || isOgpUrlAllowed(url);
}

/**
 * SNS 画像フィールドの検証。imageMode!=='sns' のときは、postUrl が無ければ常に ok。
 * postUrl がある場合 (2026-07-20: 直接画像アップロード時も postUrl だけ独立して保持できる
 * ようになったため) は、URL 貼り付け時と同じ判定関数 (parseTweetUrl / parseYoutubeUrl /
 * isOgpUrlAllowed) で host を検証する。新しい allowlist は作らず既存の判定を再利用する。
 * sns のときは source が 3 種で排他:
 * - Twitter: ogImageUrl が pbs.twimg.com 限定、 tweetId は数字 1-20 桁。
 * - YouTube: ogImageUrl が img.youtube.com / i.ytimg.com 限定、 youtubeVideoId は 11 文字 [A-Za-z0-9_-]。
 * - OGP (housingsnap / studio-xiv 等): postUrl が ogpHostAllowlist 内、
 *   sourceImageUrls が 1-{MAX_SOURCE_IMAGE_URLS} 件、 各 URL は https + 非 private IP、
 *   ogImageUrl は sourceImageUrls[0] と一致 (= 1 枚目代表)。
 */
export function validateImage(draft: RegistrationDraft): ValidationResult {
  if (draft.imageMode !== 'sns') {
    if (draft.postUrl === undefined) return ok();
    if (!isKnownPostUrlHost(draft.postUrl)) return fail({ postUrl: 'invalid' });
    return ok();
  }
  const errors: ValidationErrors = {};
  if (!isHttpsUrl(draft.postUrl)) errors.postUrl = 'invalid';

  const hasTweet = !!draft.tweetId;
  const hasYoutube = !!draft.youtubeVideoId;
  const hasSourceUrls = Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0;

  // 2026-05-27 排他緩和: tweetId + sourceImageUrls の同居許可 (Twitter 静止画ツイート 1-10 枚)。
  // youtubeVideoId と sourceImageUrls は引き続き排他 (YouTube は storyboard 都度生成、 静止画 URL を保存しない)。
  if (hasYoutube && (hasTweet || hasSourceUrls)) {
    errors.imageMode = 'conflict_sources';
    return fail(errors);
  }
  if (!hasTweet && !hasYoutube && !hasSourceUrls) {
    errors.imageMode = 'source_required_for_sns';
    return fail(errors);
  }

  if (hasYoutube) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isYoutubeThumbHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(draft.youtubeVideoId!)) {
      errors.youtubeVideoId = 'invalid';
    }
    if (!parseYoutubeUrl(draft.postUrl ?? '')) errors.postUrl = 'invalid_host';
  } else if (hasTweet) {
    if (!isHttpsUrl(draft.ogImageUrl) || !isPbsTwimgHost(draft.ogImageUrl)) {
      errors.ogImageUrl = 'invalid';
    }
    if (!/^\d{1,20}$/.test(draft.tweetId!)) errors.tweetId = 'invalid';
    if (!parseTweetUrl(draft.postUrl ?? '')) errors.postUrl = 'invalid_host';

    // 2026-05-27 (hotfix): 動画ツイートと静止画ツイートの「排他」 想定は誤りだった。
    // 実際の syndication JSON では mediaDetails:[video, photo, photo] のように同居する
    // (= 動画 + 画像 N 枚の混在ツイート、 ハウジング SS 投稿では典型)。 排他制約を撤廃して
    // 「videoUrl と sourceImageUrls の同居許可」 に変更、 ambient slideshow は画像 + poster
    // を merge して動画 spotlight 時のみ <video> 再生する。
    const hasVideoUrl = draft.videoUrl !== undefined;

    // 動画ツイート: videoUrl の host (video.twimg.com)、 videoPosterUrl の host (pbs.twimg.com)、
    // videoAspectRatio は正の有限数
    if (hasVideoUrl) {
      if (!isVideoTwimgHost(draft.videoUrl)) errors.videoUrl = 'invalid_host';
      if (draft.videoPosterUrl !== undefined && !isPbsTwimgHost(draft.videoPosterUrl)) {
        errors.videoPosterUrl = 'invalid_host';
      }
      if (
        draft.videoAspectRatio !== undefined &&
        (typeof draft.videoAspectRatio !== 'number' ||
          !Number.isFinite(draft.videoAspectRatio) ||
          draft.videoAspectRatio <= 0)
      ) {
        errors.videoAspectRatio = 'invalid';
      }
    }

    // 静止画ツイート: tweetId + sourceImageUrls 併用時、 全 URL が pbs.twimg.com 限定 + ogImageUrl と先頭一致。
    if (hasSourceUrls) {
      const urls = draft.sourceImageUrls!;
      if (urls.length > MAX_SOURCE_IMAGE_URLS) {
        errors.sourceImageUrls = 'too_many';
      } else if (urls.some((u) => typeof u !== 'string' || !isPbsTwimgHost(u))) {
        errors.sourceImageUrls = 'invalid_url';
      } else if (new Set(urls).size !== urls.length) {
        errors.sourceImageUrls = 'duplicate';
      } else if (draft.ogImageUrl !== urls[0]) {
        errors.ogImageUrl = 'must_match_first_source';
      }
    }
  } else {
    // OGP 経路 (= hasSourceUrls のみ)
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

  // 2026-07-21 追加 (Batch2): 複数投稿URL。未指定なら従来通り postUrl 単数のみで判定 (後方互換)。
  if (draft.sourcePostUrls !== undefined) {
    const urls = draft.sourcePostUrls;
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_SOURCE_POST_URLS) {
      errors.sourcePostUrls = 'too_many';
    } else if (urls.some((u) => typeof u !== 'string' || !isKnownPostUrlHost(u))) {
      errors.sourcePostUrls = 'invalid_url';
    } else if (new Set(urls).size !== urls.length) {
      errors.sourcePostUrls = 'duplicate';
    }
  }

  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

/**
 * 検証済み draft から listing に保存する画像フィールドを生成する。
 * sns + 全フィールド揃いのときのみ sns 保存、それ以外は 'none'。
 * (この関数を呼ぶ前に validateImage が ok であることを前提とする)
 *
 * - Twitter source (2026-05-27 hotfix: 動画 + 画像同居許可):
 *   - 静止画 only ツイート: tweetId + sourceImageUrls + lastTweetCheckAt
 *   - 動画 only ツイート: tweetId + videoUrl/Poster/AspectRatio + lastTweetCheckAt
 *   - 動画 + 画像ツイート (= ② パターン): tweetId + sourceImageUrls + video* 両方
 *   - テキストツイート: tweetId + lastTweetCheckAt のみ
 * - YouTube source: youtubeVideoId を保存
 * - OGP source: sourceImageUrls を保存 (= 外部 URL 直接表示、 Storage コピーなし)
 */
export function buildListingImageFields(
  draft: RegistrationDraft,
  now: number,
):
  | {
      imageMode: 'sns';
      postUrl: string;
      ogImageUrl: string;
      tweetId: string;
      lastTweetCheckAt: number;
      sourcePostUrls?: string[];
      sourceImageUrls?: string[];
      sourceImageAspectRatios?: number[];
      videoUrl?: string;
      videoPosterUrl?: string;
      videoAspectRatio?: number;
    }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; youtubeVideoId: string; sourcePostUrls?: string[] }
  | { imageMode: 'sns'; postUrl: string; ogImageUrl: string; sourceImageUrls: string[]; sourceImageAspectRatios?: number[]; sourcePostUrls?: string[] }
  | { imageMode: 'none'; postUrl?: string } {
  // 2026-07-21 追加 (Batch2): sourcePostUrls[0] を postUrl として使う (後方互換・cron監視対象は先頭のみ)。
  const effectivePostUrl =
    Array.isArray(draft.sourcePostUrls) && draft.sourcePostUrls.length > 0
      ? draft.sourcePostUrls[0]
      : draft.postUrl;
  const sourcePostUrlsField =
    Array.isArray(draft.sourcePostUrls) && draft.sourcePostUrls.length > 0
      ? { sourcePostUrls: draft.sourcePostUrls.slice(0, MAX_SOURCE_POST_URLS) }
      : {};

  if (draft.imageMode === 'sns' && effectivePostUrl && draft.ogImageUrl) {
    if (draft.tweetId) {
      // Twitter: 動画 + 画像 + テキスト の混在ツイートを受け止める (2026-05-27 hotfix で排他撤廃)。
      const base = {
        imageMode: 'sns' as const,
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        tweetId: draft.tweetId,
        lastTweetCheckAt: now,
        ...sourcePostUrlsField,
      };
      const hasImages =
        Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0;
      return {
        ...base,
        ...(draft.videoUrl
          ? {
              videoUrl: draft.videoUrl,
              ...(draft.videoPosterUrl ? { videoPosterUrl: draft.videoPosterUrl } : {}),
              ...(draft.videoAspectRatio !== undefined
                ? { videoAspectRatio: draft.videoAspectRatio }
                : {}),
            }
          : {}),
        ...(hasImages
          ? { sourceImageUrls: draft.sourceImageUrls!.slice(0, MAX_SOURCE_IMAGE_URLS) }
          : {}),
        ...(hasImages && Array.isArray(draft.sourceImageAspectRatios)
          ? {
              sourceImageAspectRatios: draft.sourceImageAspectRatios
                .slice(0, MAX_SOURCE_IMAGE_URLS)
                .map((r) => (typeof r === 'number' && isFinite(r) && r > 0 ? r : 0)),
            }
          : {}),
      };
    }
    if (draft.youtubeVideoId) {
      return {
        imageMode: 'sns',
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        youtubeVideoId: draft.youtubeVideoId,
        ...sourcePostUrlsField,
      };
    }
    if (Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0) {
      return {
        imageMode: 'sns',
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        sourceImageUrls: draft.sourceImageUrls.slice(0, MAX_SOURCE_IMAGE_URLS),
        ...sourcePostUrlsField,
        ...(Array.isArray(draft.sourceImageAspectRatios)
          ? {
              sourceImageAspectRatios: draft.sourceImageAspectRatios
                .slice(0, MAX_SOURCE_IMAGE_URLS)
                .map((r) => (typeof r === 'number' && isFinite(r) && r > 0 ? r : 0)),
            }
          : {}),
      };
    }
  }
  // 直接画像アップロード等 (imageMode !== 'sns') でも、検証済みの postUrl (元の投稿への
  // リンク) だけは保持する (2026-07-20 実ユーザー報告の修正。host 検証は呼び出し側が
  // validateImage を先に通している前提)。
  return effectivePostUrl ? { imageMode: 'none', postUrl: effectivePostUrl } : { imageMode: 'none' };
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
