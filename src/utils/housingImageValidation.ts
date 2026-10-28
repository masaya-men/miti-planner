/**
 * ハウジング登録の画像フィールドの検証 (validateImage) と保存用整形 (buildListingImageFields)。
 * クライアント (React フォーム) と サーバー (/api/housing) の両方で使用。
 */
import { fail, ok, type ValidationErrors, type ValidationResult } from './housingValidationResult.js';
import { isOgpUrlAllowed } from '../lib/housing/ogpHostAllowlist.js';
import { parseTweetUrl } from '../lib/housing/tweetUrlParse.js';
import { parseYoutubeUrl } from '../lib/housing/youtubeUrl.js';
import {
  MAX_SOURCE_IMAGE_URLS,
  MAX_SOURCE_POST_URLS,
  isExternalImageUrlSafe,
  isHttpsUrl,
  isKnownPostUrlHost,
  isPbsTwimgHost,
  isVideoTwimgHost,
  isYoutubeThumbHost,
} from './housingImageUrlChecks.js';
import type { RegistrationDraft } from './housingRegistrationTypes.js';

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
  // 2026-07-21 追加 (Batch2): 複数投稿URL。imageMode に関わらず常に検証する
  // (imageMode==='none' 等の非sns経路でも sourcePostUrls 経由でホスト検証をすり抜けないようにするため、
  // 下の imageMode 分岐より前に置く)。未指定なら従来通り postUrl 単数のみで判定 (後方互換)。
  if (draft.sourcePostUrls !== undefined) {
    const urls = draft.sourcePostUrls;
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > MAX_SOURCE_POST_URLS) {
      return fail({ sourcePostUrls: 'too_many' });
    }
    if (urls.some((u) => typeof u !== 'string' || !isKnownPostUrlHost(u))) {
      return fail({ sourcePostUrls: 'invalid_url' });
    }
    if (new Set(urls).size !== urls.length) {
      return fail({ sourcePostUrls: 'duplicate' });
    }
  }

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
  // 2026-08-20 排他緩和: youtubeVideoId + sourceImageUrls の同居も許可 (YouTube動画 + Xの静止画)。
  // youtubeVideoId + tweetId は引き続き排他 (動画が2本になるため)。
  if (hasYoutube && hasTweet) {
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

    // 2026-08-20 排他緩和: YouTube動画 + Xの静止画の同居。ogImageUrlはYouTubeサムネのまま
    // (Twitter branchと違いsourceImageUrls[0]と一致させる必要はない)、静止画は全てpbs.twimg.com
    // 限定で検証する (画像の出処はXの投稿のみ・OGP等の任意ホストはここでは許可しない)。
    if (hasSourceUrls) {
      const urls = draft.sourceImageUrls!;
      if (urls.length > MAX_SOURCE_IMAGE_URLS) {
        errors.sourceImageUrls = 'too_many';
      } else if (urls.some((u) => typeof u !== 'string' || !isPbsTwimgHost(u))) {
        errors.sourceImageUrls = 'invalid_url';
      } else if (new Set(urls).size !== urls.length) {
        errors.sourceImageUrls = 'duplicate';
      }
    }
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
  | {
      imageMode: 'sns';
      postUrl: string;
      ogImageUrl: string;
      youtubeVideoId: string;
      sourcePostUrls?: string[];
      sourceImageUrls?: string[];
    }
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
      // 2026-08-20 排他緩和: YouTube動画 + Xの静止画(sourceImageUrls)の同居を許可。
      const hasImages =
        Array.isArray(draft.sourceImageUrls) && draft.sourceImageUrls.length > 0;
      return {
        imageMode: 'sns',
        postUrl: effectivePostUrl,
        ogImageUrl: draft.ogImageUrl,
        youtubeVideoId: draft.youtubeVideoId,
        ...sourcePostUrlsField,
        ...(hasImages
          ? { sourceImageUrls: draft.sourceImageUrls!.slice(0, MAX_SOURCE_IMAGE_URLS) }
          : {}),
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

