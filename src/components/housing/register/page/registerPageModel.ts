import type { RegisterAddressValues } from '../RegisterSectionAddress';
import type { RegistrationDraft } from '../../../../utils/housingRegistrationTypes';
import type { CompressedImage } from '../../../../lib/housing/imageCompression';
import type { HousingArea, HousingListing, HousingSize } from '../../../../types/housing';
import { regionForDC } from '../../../../data/housing/dcServerMap';
import { buildAddressKey } from '../../../../utils/housingDuplicate';
import type { MockListing } from '../../../../data/housing/mockListings';
import type { SnsCapture } from '../snsCapture';

/**
 * 画像 draft フィールドの構築 (旧 HousingRegisterForm.tsx:220-301 の忠実な複製)。
 *
 * 優先順位 (上から評価・先勝ち):
 *   ① localImages が 1 枚以上   → SNS 系を一切無視 (imageMode 系は付けない = 後段で
 *      localImages を uploadListingThumbnail に流す。draft 上は imageMode 未指定=サーバ 'none')。
 *      (ただし postUrl のみ独立して保持する)。
 *   ② YouTube                    → imageMode='sns' + youtubeVideoId + ogImageUrl
 *      (+ sourceImageUrls があれば同居させる。2026-08-20 排他緩和、Xの静止画+YouTube動画)
 *   ③ Twitter (本文取得済)       → 静止画/動画/両方同居を OR 統合。テキストのみは何も付けない
 *   ④ OGP                        → imageMode='sns' + sourceImageUrls (先頭 10) + ogImageUrl=先頭
 *   ⑤ どれも無し                 → imageMode 未指定 (= 'none')
 *
 * imageMode='none' の黙示事故 (URL を貼ったのに画像が保存されない) を塞ぐため、②〜④の
 * 各分岐は旧ロジックと同じ条件・同じフィールド構成で組む。sourceImageUrls (ページの
 * 並び替え結果) は Twitter/OGP どちらでも代表画像 (ogImageUrl=先頭) の整合を取る。
 */
export function buildDraftImageFields(
  sns: SnsCapture,
  localImages: CompressedImage[],
  sourceImageUrls: string[],
): Partial<RegistrationDraft> {
  const hasLocalImages = localImages.length > 0;
  if (hasLocalImages) {
    // ① localImages 優先。SNS 画像は draft に載せない (登録後に thumbnail upload)。
    // postUrl (元の投稿へのリンク) だけは画像と独立して保持する
    // (2026-07-20 実ユーザー報告: 直接画像アップロード時に postUrl ごと消えていたバグの修正)。
    const postUrl = sns.youtube?.postUrl ?? sns.tweetSource?.postUrl ?? sns.ogp?.postUrl;
    return postUrl ? { postUrl } : {};
  }

  // ② YouTube (2026-08-20 排他緩和: Xの静止画(sourceImageUrls)があれば同居させる。
  // ogImageUrl はYouTubeサムネのまま=先頭画像に差し替えない。tweetIdは持たない
  // (動画側の代表はYouTubeで確定させ、Xは画像の出処としてのみ使う)。
  if (sns.youtube) {
    const hasImages = sourceImageUrls.length > 0;
    return {
      imageMode: 'sns',
      postUrl: sns.youtube.postUrl,
      ogImageUrl: sns.youtube.ogImageUrl,
      youtubeVideoId: sns.youtube.videoId,
      ...(hasImages ? { sourceImageUrls: sourceImageUrls.slice(0, 10) } : {}),
    };
  }

  // ③ Twitter (本文取得済)
  if (sns.tweetSource && sns.tweetData) {
    const photos = sns.tweetData.photos ?? [];
    const video = sns.tweetData.video;
    const hasPhotos = photos.length > 0;
    const hasVideo = !!video?.url;
    if (hasPhotos || hasVideo) {
      // 旧 HousingRegisterForm と同じく tweetData.photos を直接使う (photoAspectRatios と
      // index 整合を保つため。並び替え UI の sourceImageUrls は使わない — 並び替えると
      // aspectRatios とズレるため、Twitter は取得時の順序で保存する)。
      const trimmed = photos.slice(0, 10);
      const trimmedAspectRatios: number[] | undefined =
        sns.tweetData.photoAspectRatios != null
          ? (sns.tweetData.photoAspectRatios.slice(0, 10) as (number | null)[]).map((r) =>
              r != null ? r : 0,
            )
          : undefined;
      return {
        imageMode: 'sns',
        postUrl: sns.tweetSource.postUrl,
        ogImageUrl: hasPhotos ? trimmed[0] : video!.posterUrl,
        tweetId: sns.tweetSource.tweetId,
        ...(hasPhotos
          ? {
              sourceImageUrls: trimmed,
              ...(trimmedAspectRatios != null
                ? { sourceImageAspectRatios: trimmedAspectRatios }
                : {}),
            }
          : {}),
        ...(hasVideo
          ? {
              videoUrl: video!.url,
              videoPosterUrl: video!.posterUrl,
              ...(video!.aspectRatio != null ? { videoAspectRatio: video!.aspectRatio } : {}),
            }
          : {}),
      };
    }
    // テキストツイート (photos も video も無し): 画像なし (imageMode 未指定)。
    return {};
  }

  // ④ OGP
  if (sns.ogp && sourceImageUrls.length > 0) {
    const trimmed = sourceImageUrls.slice(0, 10);
    return {
      imageMode: 'sns',
      postUrl: sns.ogp.postUrl,
      ogImageUrl: trimmed[0],
      sourceImageUrls: trimmed,
    };
  }
  // 注: ユーザーが sourceImageUrls を手動で全消しした OGP は「画像なし」意図として尊重し、
  // og:image を復活させない。かつて data.image だけで imageMode='sns' を組む fallback があったが、
  // sourceImageUrls/tweetId/youtubeVideoId 無しの sns draft はサーバ validateImage の
  // source_required_for_sns で 400 になる二重の誤りだったため削除 (Task14 fix)。ここは {} に落とし
  // imageMode='none' (画像なし登録) とする (旧 toRegistrationDraft の faithful な挙動)。

  // ⑤ どれも無し
  return {};
}

/**
 * ステッパー/scroll-spy が対象とする5セクション (spec 正典順: media → address → intro →
 * visibility → confirm)。id はステッパーの表示順そのもの。
 */
const STEP_IDS = ['media', 'address', 'intro', 'visibility', 'confirm'] as const;
export type StepId = (typeof STEP_IDS)[number];
export const STEP_LABEL_KEYS: Record<StepId, string> = {
  media: 'housing.register.step.media',
  address: 'housing.register.step.address',
  intro: 'housing.register.step.intro',
  visibility: 'housing.register.step.visibility',
  confirm: 'housing.register.step.confirm',
};

/**
 * mode に応じてステッパーに出すステップ一覧を返す (Task3.4-1)。
 * Plan B (2026-07-21) で edit も写真セクションを表示するようになったため、
 * create/edit ともに全ステップを返す (mode は将来の分岐余地として引数に残す)。
 */
 
export function visibleStepIds(_mode: 'create' | 'edit'): StepId[] {
  return [...STEP_IDS];
}

// 自動入力の段階的タイピング表現 (1 フィールドごとに 150ms ずらす)。
// 旧 HousingRegisterForm.tsx の TYPING_STAGGER_MS を踏襲。
export const TYPING_STAGGER_MS = 150;

/**
 * 住所確認ゲート (C案・2026-07-10) の確認ボタン押下時に `fieldState.confirm()` を呼ぶ対象フィールド。
 * 値が入っているものだけ確認状態にする (未入力フィールドを確認扱いにしない)。
 */
export const ADDRESS_FIELD_NAMES = [
  'dc',
  'server',
  'area',
  'ward',
  'buildingType',
  'plot',
  'size',
  'apartmentBuilding',
  'roomKind',
  'roomNumber',
] as const;

/**
 * buildingType/roomKind に応じた必須フィールド。
 * - house (家全体)              : dc/server/area/ward/buildingType/plot/size
 * - house + private_chamber     : 上記 + roomNumber (FC 個室)
 * - apartment                   : dc/server/area/ward/buildingType/apartmentBuilding/roomNumber (plot/size 不要)
 * `src/utils/housingValidation.ts` の validateAddress と同じ場合分けに揃える。
 */
export function requiredFieldsForAddress(
  buildingType: 'house' | 'apartment' | undefined,
  roomKind: 'private_chamber' | 'apartment_room' | undefined,
): string[] {
  const base = ['dc', 'server', 'area', 'ward', 'buildingType'];
  if (buildingType === 'apartment') return [...base, 'apartmentBuilding', 'roomNumber'];
  if (roomKind === 'private_chamber') return [...base, 'plot', 'size', 'roomNumber'];
  return [...base, 'plot', 'size'];
}

/**
 * mode='edit' の初期値展開: listing の住所系フィールドを RegisterSectionAddress の
 * 独立オブジェクト (RegisterAddressValues) へ写す (Task3.1)。写真系 (sourceImageUrls 等) は
 * 方式A (編集で写真は変えない) によりここでは扱わない。
 */
export function addressFromListing(listing: HousingListing): RegisterAddressValues {
  return {
    dc: listing.dc,
    server: listing.server,
    area: listing.area,
    ward: listing.ward,
    buildingType: listing.buildingType,
    plot: listing.plot,
    size: listing.size,
    apartmentBuilding: listing.apartmentBuilding,
    roomKind: listing.roomKind,
    roomNumber: listing.roomNumber,
  };
}

/**
 * 登録直後、Firestore を読まずに探す一覧へ即反映するためのローカル view-model
 * (2026-07-13 round2 A-5・c: Firestore 読み取り0)。
 *
 * registerListing の戻り値 (id) + 送信済み draft + ownerUid から `MockListing` 完全互換
 * オブジェクトを組む。`ephemeralListing.ts` の `createEphemeralListing` と同じ組み立て方針
 * (必須フィールドは `galleryAdapter.ts` / `mockListings.ts` 参照)。
 *
 * - `region` は `regionForDC(draft.dc)`。未知 DC (Shadow 等) は 'JP' を既定にする
 *   (createEphemeralListing の DEFAULT_EPHEMERAL_REGION と同じ考え方。表示に使うだけで
 *   実際の並び替え等クリティカルな用途ではないため、この暫定値で登録自体は止めない)。
 * - `thumbnailPath` はサーバー upload 後に確定するため、この時点では未確定 (undefined)。
 *   カードは sourceImageUrls/videoUrl 等の SNS/ローカル画像で暫定表示し、次回 load() で正規化される
 *   (許容トレードオフ・設計書 c 節)。
 * - `addressKey` は既存 `buildAddressKey` (housingDuplicate.ts) を流用 (draft は AddressInput 互換)。
 */
export function buildLocalListingViewModel(
  draft: RegistrationDraft,
  id: string,
  ownerUid: string,
): MockListing {
  const now = Date.now();
  const region = regionForDC(draft.dc) ?? 'JP';
  return {
    id,
    ownerUid,
    dc: draft.dc,
    server: draft.server,
    region,
    area: draft.area as HousingArea,
    ward: draft.ward,
    buildingType: draft.buildingType as 'house' | 'apartment',
    plot: draft.plot,
    size: draft.size as HousingSize | undefined,
    apartmentBuilding: draft.apartmentBuilding,
    roomNumber: draft.roomNumber,
    roomKind: draft.roomKind as 'private_chamber' | 'apartment_room' | undefined,
    imageMode: draft.imageMode ?? 'none',
    postUrl: draft.postUrl,
    ogImageUrl: draft.ogImageUrl,
    sourceImageUrls: draft.sourceImageUrls,
    sourceImageAspectRatios: draft.sourceImageAspectRatios,
    youtubeVideoId: draft.youtubeVideoId,
    videoUrl: draft.videoUrl,
    videoPosterUrl: draft.videoPosterUrl,
    videoAspectRatio: draft.videoAspectRatio,
    tags: draft.tags,
    description: draft.description,
    title: draft.title,
    visibility: draft.visibility ?? 'public',
    publishUntil: draft.publishUntil ?? null,
    createdAt: now,
    lastConfirmedAt: now,
    addressKey: buildAddressKey(draft),
  };
}
