import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/useAuthStore';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { RegisterSectionAddress, type RegisterAddressValues } from '../register/RegisterSectionAddress';
import { RegisterSectionIntro, type RegisterSectionIntroValues } from '../register/RegisterSectionIntro';
import { RegisterSectionMedia } from '../register/RegisterSectionMedia';
import { HousingEditMediaSection } from '../edit/HousingEditMediaSection';
import type { EditMediaMode } from '../edit/HousingEditMediaModeTabs';
import { RegisterSectionVisibility } from '../register/RegisterSectionVisibility';
import { RegisterSectionConfirm, type RegisterConfirmSummary } from '../register/RegisterSectionConfirm';
import { RegisterHousingerCta } from '../register/RegisterHousingerCta';
import { RegisterStepperNav, type RegisterStep, type RegisterStepState } from '../register/RegisterStepperNav';
import { RegisterGuide } from '../register/RegisterGuide';
import { RegisterCheckPanel } from '../register/RegisterCheckPanel';
import { RegisterDuplicatePanel, type RegisterDuplicateState } from '../register/RegisterDuplicatePanel';
import { RegisterAddressMap } from '../register/RegisterAddressMap';
import { HousingDuplicateWarningDialog } from '../HousingDuplicateWarningDialog';
import { useHousingUpdate } from '../edit/useHousingUpdate';
import { showToast } from '../../Toast';
import { parseHousingFromText, type HousingExtractResult } from '../../../lib/housing/parseHousingFromText';
import { extractHousingAddressFromPage } from '../../../lib/housing/extractHousingAddressFromPage';
import { extractSizeToAddress } from '../../../lib/housing/extractSizeToAddress';
import { deriveHouseSize } from '../../../lib/housing/deriveHouseSize';
import {
  canRegister,
  checkDuplicate,
  registerListing,
  uploadListingThumbnail,
  QuotaExhaustedError,
  type DuplicateEntry,
} from '../../../lib/housingApiClient';
import {
  validateAddress,
  validateTitle,
  type AddressInput,
  type RegistrationDraft,
} from '../../../utils/housingValidation';
import { registrationTicketsRemaining } from '../../../utils/housingQuota';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../../../constants/housing';
import { computeRegisterChecklist, isReadyToPublish } from '../../../lib/housing/registerChecklist';
import { normalizeAddressForBuildingType } from '../../../lib/housing/normalizeAddressForBuildingType';
import {
  AUTOSAVE_KEY,
  serializeDraft,
  restoreDraft,
  hasMeaningfulDraft,
  type AutosaveDraft,
} from '../../../lib/housing/registerAutosave';
import { consumeRegisterPrefill } from '../../../lib/housing/registerPrefill';
import { formatFullHousingAddress } from '../../../lib/housing/formatHousingAddress';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { YoutubeFetchedData, OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import { SAVED_IMAGES_LIMIT } from '../register/HousingRegisterImageField';
import type { CompressedImage } from '../../../lib/housing/imageCompression';
import type { HousingArea, HousingListing, HousingSize } from '../../../types/housing';
import { regionForDC } from '../../../data/housing/dcServerMap';
import { buildAddressKey } from '../../../utils/housingDuplicate';
import type { MockListing } from '../../../data/housing/mockListings';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../../../lib/housing/multiSourceGuards';

/**
 * 捕捉した SNS 取得結果 (画像 draft 構築の材料)。旧 HousingRegisterForm の tweetData/
 * tweetSource/youtubeData/ogpResult をページ state にまとめて保持し、submit 時に
 * 画像優先順位ロジックへ流す。テキストツイート等で画像ゼロでも「URL は取得済み」を
 * 表せるよう postUrl を別途保持する (imageMode='none' の黙示事故を塞ぐ材料)。
 */
export interface SnsCapture {
  tweetData: TweetData | null;
  tweetSource: { postUrl: string; tweetId: string } | null;
  youtube: YoutubeFetchedData | null;
  ogp: OgpFetchedData | null;
}

export const EMPTY_SNS_CAPTURE: SnsCapture = {
  tweetData: null,
  tweetSource: null,
  youtube: null,
  ogp: null,
};

/**
 * 画像 draft フィールドの構築 (旧 HousingRegisterForm.tsx:220-301 の忠実な複製)。
 *
 * 優先順位 (上から評価・先勝ち):
 *   ① localImages が 1 枚以上   → SNS 系を一切無視 (imageMode 系は付けない = 後段で
 *      localImages を uploadListingThumbnail に流す。draft 上は imageMode 未指定=サーバ 'none')。
 *      (ただし postUrl のみ独立して保持する)。
 *   ② YouTube                    → imageMode='sns' + youtubeVideoId + ogImageUrl
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

  // ② YouTube
  if (sns.youtube) {
    return {
      imageMode: 'sns',
      postUrl: sns.youtube.postUrl,
      ogImageUrl: sns.youtube.ogImageUrl,
      youtubeVideoId: sns.youtube.videoId,
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
 * Twitter 代表 (tweetData) に後続 URL の写真を追記する際、photoAspectRatios (存在すれば) も
 * 同じ index 整合を保って伸長するためのマージヘルパー。既存/追加のどちらか一方にしか
 * 比率情報が無い場合は情報が無い側を null で埋める (buildDraftImageFields 側の
 * `r != null ? r : 0` 変換に委ねる)。両方とも比率情報が無ければ undefined のまま返し、
 * draft に sourceImageAspectRatios フィールド自体を付けない (従来の「テキストのみ」挙動と同じ)。
 * (2026-07-21 レビュー指摘 Bug2 fix: 複数URL目の写真が sourcePostUrls 集約時に消える不具合)
 *
 * 2026-07-22 (Task8・Batch2): 編集ページ (HousingEditSourcePanel) も同じ「Twitter代表に
 * 後続URLの写真を追記する」ロジックが必要なため export する。
 */
export function mergeTweetPhotoAspectRatios(
  existingRatios: (number | null)[] | undefined,
  existingCount: number,
  incomingRatios: (number | null)[] | undefined,
  incomingCount: number,
): (number | null)[] | undefined {
  if (existingRatios == null && incomingRatios == null) return undefined;
  const existingPart = existingRatios ?? new Array(existingCount).fill(null);
  const incomingPart = incomingRatios ?? new Array(incomingCount).fill(null);
  return [...existingPart, ...incomingPart];
}

/**
 * ステッパー/scroll-spy が対象とする5セクション (spec 正典順: media → address → intro →
 * visibility → confirm)。id はステッパーの表示順そのもの。
 */
const STEP_IDS = ['media', 'address', 'intro', 'visibility', 'confirm'] as const;
type StepId = (typeof STEP_IDS)[number];
const STEP_LABEL_KEYS: Record<StepId, string> = {
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
function visibleStepIds(_mode: 'create' | 'edit'): StepId[] {
  return [...STEP_IDS];
}

// 自動入力の段階的タイピング表現 (1 フィールドごとに 150ms ずらす)。
// 旧 HousingRegisterForm.tsx の TYPING_STAGGER_MS を踏襲。
const TYPING_STAGGER_MS = 150;

/**
 * 住所確認ゲート (C案・2026-07-10) の確認ボタン押下時に `fieldState.confirm()` を呼ぶ対象フィールド。
 * 値が入っているものだけ確認状態にする (未入力フィールドを確認扱いにしない)。
 */
const ADDRESS_FIELD_NAMES = [
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
function requiredFieldsForAddress(
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
function addressFromListing(listing: HousingListing): RegisterAddressValues {
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
function buildLocalListingViewModel(
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

interface RegisterPageProps {
  /** 'create' (既定) で新規登録、 'edit' で既存物件の編集プリフィル (Task3.1)。 */
  mode?: 'create' | 'edit';
  /** mode='edit' のとき、フォーム初期値の出典にする既存 listing。 */
  initialValues?: HousingListing;
  /**
   * mode='edit' の保存成功時のみ呼ぶ後処理フック (Task3.3a 回帰修復)。 create パスでは呼ばない。
   * 旧 HousingEditModal 経由の編集では、 保存成功で useHousingDetail.handleListingSaved が
   * resolveReport(listing.id) を走らせて「編集=通報対処」 とみなし自己非表示を解除していた。
   * 別ページ化でこの経路が失われるため、 呼び出し側 (HousingEditPage) が resolveReport を
   * ここに配線して回帰を塞ぐ。 onSaved 内の失敗は保存フロー (navigate) を止めない
   * (編集自体は保存済みのため)。
   */
  onSaved?: (listingId: string) => void | Promise<unknown>;
}

/**
 * 登録ページ (3カラム): 探す/お気に入りと同じ骨格。
 * 未ログイン → 中央にログイン案内。ログイン済 → 3カラムのフォーム枠。
 * フォーム状態 (住所/紹介/画像/公開設定) は本ページが親として保持し、子セクションに
 * 値とセッタを渡す。中央カラムのセクションは spec 正典順 (media→address→intro→
 * visibility→confirm) で並び、IntersectionObserver による scroll-spy で左カラムの
 * ステッパー (RegisterStepperNav) と連動する (Task12)。confirm セクション本体と
 * 右カラムの中身は Task13-14 で本実装、それまでスタブに留める。
 *
 * mode/initialValues (Task3.1): mode='edit' + initialValues 指定時、住所/タイトル/紹介文/
 * タグ/公開範囲/公開終了日時を listing の値でプリフィルする。写真系 state
 * (localImages/sourceImageUrls/snsCapture/postUrl) はプリフィルしない (方式A: 編集で
 * 写真は変えない。サーバーの update ハンドラも画像フィールドを更新しない設計)。
 * mode/initialValues 未指定時は create 挙動 (現状の初期値) と完全に不変。
 */
export const RegisterPage: React.FC<RegisterPageProps> = ({ mode = 'create', initialValues, onSaved }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  // mode='edit' の保存 (Task3.2): HousingRegisterView.performUpdate と同じ更新 hook を使う。
  const { update: updateListing } = useHousingUpdate();

  const [address, setAddress] = useState<RegisterAddressValues>(() =>
    initialValues ? addressFromListing(initialValues) : {},
  );
  // 復元起因の SNS 再取得で「空フィールドだけ補完」判定に使う最新 address のミラー (spec:120)。
  // setTimeout スタッガー内で最新値を同期的に読むため、address 変化ごとに追従させる。
  const addressRef = useRef<RegisterAddressValues>(address);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  const requiredFields = requiredFieldsForAddress(address.buildingType, address.roomKind);
  const fieldState = useHousingFieldState(requiredFields);
  /**
   * 住所確認ゲート (C案・2026-07-10)。フォーム値から組み立てた住所文を確認セクションに提示し、
   * 「この住所で間違いありません」ボタンを押すまで送信ボタンを無効にする (registerChecklist の
   * address 行に反映)。mode='edit' は住所欄に触れなければ従来どおり保存できるよう、初期状態を
   * 確認済み扱いにする (編集モード = (b))。
   * 解除するのは「住所を実際に変えた」とみなせる箇所のみ (手編集 / SNS 自動入力 / オートセーブ復元)。
   * size の自動導出 (区画由来・別 effect) では解除しない。
   */
  const [addressConfirmed, setAddressConfirmed] = useState(() => mode === 'edit');

  const [title, setTitle] = useState(() => initialValues?.title ?? '');
  const [description, setDescription] = useState(() => initialValues?.description ?? '');
  const [tags, setTags] = useState<string[]>(() => initialValues?.tags ?? []);
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>(
    () => initialValues?.visibility ?? 'public',
  );
  const [publishUntil, setPublishUntil] = useState<number | null>(
    () => initialValues?.publishUntil ?? null,
  );
  // 2026-07-24: 公開期限切れ後の倒し先 (裏側の定期処理が使う)。既定は住所非公開 (穏当な方)。
  const [afterExpiryVisibility, setAfterExpiryVisibility] = useState<'unlisted' | 'private'>(
    () => initialValues?.afterExpiryVisibility ?? 'unlisted',
  );
  // 既定 public を自動で✅にしない (feedback_form_ux_progress) ため、公開設定セクションの
  // onChange が一度でも呼ばれたかを別フラグで持つ (visibility state 自体は初期値 'public')。
  // mode='edit' は visibility が initialValues から確定済みなので、ステッパーの visibility
  // ステップは最初から done 扱いにする (Task3.1 申し送り事項・Task3.2 で対応)。
  const [visibilityTouched, setVisibilityTouched] = useState(() => mode === 'edit');

  const handleVisibilityChange = (next: {
    visibility: 'public' | 'unlisted' | 'private';
    publishUntil: number | null;
    afterExpiryVisibility: 'unlisted' | 'private';
  }) => {
    setVisibility(next.visibility);
    setPublishUntil(next.publishUntil);
    setAfterExpiryVisibility(next.afterExpiryVisibility);
    setVisibilityTouched(true);
  };

  // 登録枠残数 (canRegister の remaining/registrationCount)。取得失敗時は null にフォールバックし、
  // ガイドは残数行を出さない (throw させない = reference_housing_appcheck_headers)。
  // 管理者は無制限のため store の isAdmin で「管理者」表示に切り替える (サーバ側でも枠を免除)。
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [registrationCount, setRegistrationCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    canRegister()
      .then((res) => {
        if (!cancelled) {
          setRemaining(res.remaining);
          setRegistrationCount(res.registrationCount);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRemaining(null);
          setRegistrationCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleAddressChange = (name: string, value: unknown) => {
    // ユーザーが住所を手編集したら、以降の SNS 再取得は復元 guard を外す
    // (通常の URL 貼付は全フィールド上書きに戻す)。
    restoreRefetchGuardRef.current = false;
    setAddress((prev) => ({ ...prev, [name]: value }));
    fieldState.userEdit(name, value);
    // 住所確認ゲート: 手編集は「住所が変わった」とみなし確認を解除する。
    setAddressConfirmed(false);
  };

  /**
   * 住所確認ゲートの確認ボタン押下ハンドラ (Task1-1)。値が入っている住所系フィールドを
   * まとめて `fieldState.confirm()` し、初めて 'confirmed' (緑) 表示に到達させる。
   */
  const handleConfirmAddress = useCallback(() => {
    setAddressConfirmed(true);
    for (const name of ADDRESS_FIELD_NAMES) {
      if ((address as Record<string, unknown>)[name] !== undefined) {
        fieldState.confirm(name);
      }
    }
  }, [address, fieldState]);

  /**
   * size は (エリア × 区画) から一意に決まるので、**この effect が size の唯一の書き込み口**。
   *
   * `validateAddress` は house に plot 必須 / size 必須、apartment には size 不可を課すので、
   * 家であれば size は常に導出できる (FC 個室も親 plot のサイズ = 同じ関数で引ける)。
   * そのため UI 側の size 欄は disabled にしてあり (RegisterSectionAddress)、
   * 手入力・SNS 本文・オートセーブ復元・編集プリフィルのどれから来た値であっても
   * ここで区画由来の値に上書きする (区画 = ゲームの一次データが正)。
   *
   * fieldState への登録も必ず行う。requiredFieldsForAddress が 'size' を必須に数えるため、
   * 値だけ入れて fieldState が 'empty' のままだと isReadyToSubmit が永久に false になる。
   * すでに同じ値が入っている場合は setAutoFilled しない ('confirmed' を 'auto-filled' に
   * 巻き戻さないため)。
   */
  useEffect(() => {
    const derived = deriveHouseSize({
      buildingType: address.buildingType,
      area: address.area,
      plot: address.plot,
    });

    if (derived) {
      if (address.size !== derived) {
        setAddress((prev) => ({ ...prev, size: derived }));
      }
      if (fieldState.getValue('size') !== derived) {
        fieldState.setAutoFilled('size', derived);
      }
      return;
    }

    // 導出不可 (アパート / エリア未確定 / 区画未確定・範囲外) は size を持たせない。
    if (address.size !== undefined) {
      setAddress((prev) => ({ ...prev, size: undefined }));
    }
    if (fieldState.getState('size') !== 'empty') {
      fieldState.clearField('size');
    }
  }, [address.buildingType, address.area, address.plot, address.size, fieldState]);

  const handleIntroChange = (next: RegisterSectionIntroValues) => {
    setTitle(next.title);
    setDescription(next.description);
    setTags(next.tags);
  };

  const [localImages, setLocalImages] = useState<CompressedImage[]>([]);
  const [sourceImageUrls, setSourceImageUrls] = useState<string[]>(
    () => (mode === 'edit' ? (initialValues?.sourceImageUrls ?? []) : []),
  );

  /**
   * edit モード専用: 直接アップロード画像の URL 一覧 (Plan B・2026-07-21)。
   * create モードの `localImages` (アップロード前のローカルファイル) とは別物で、
   * サーバーに既に保存済みの URL のみを保持する。buildDraftImageFields には渡さない
   * (直接アップロードの commit は uploadListingThumbnail が単独で完結するため)。
   */
  const [editThumbnailPaths, setEditThumbnailPaths] = useState<string[]>(() => {
    if (mode !== 'edit' || !initialValues) return [];
    if (initialValues.thumbnailPaths && initialValues.thumbnailPaths.length > 0) {
      return initialValues.thumbnailPaths;
    }
    return initialValues.thumbnailPath ? [initialValues.thumbnailPath] : [];
  });

  /** edit モード専用: 動画プレビュー (Twitter動画ツイート由来)。URL再取得で更新される。 */
  const [editVideoPreview, setEditVideoPreview] = useState<
    { url: string; posterUrl: string; aspectRatio?: number } | null
  >(() => {
    if (mode !== 'edit' || !initialValues?.videoUrl || !initialValues?.videoPosterUrl) return null;
    return {
      url: initialValues.videoUrl,
      posterUrl: initialValues.videoPosterUrl,
      aspectRatio: initialValues.videoAspectRatio,
    };
  });
  /**
   * SNS 取得結果の捕捉 (Task14)。旧 RegisterPage は sourceImageUrls だけ拾って SNS
   * メタデータ (postUrl/ogImageUrl/tweetId/youtubeVideoId/video*) を捨てていたため、
   * URL を貼っても imageMode='none' で黙って登録される事故があった (spec:120)。
   * ここで tweetData/tweetSource/youtube/ogp をまとめて保持し、submit 時に
   * buildDraftImageFields へ流して imageMode='sns' を正しく組む。
   */
  const [snsCapture, setSnsCapture] = useState<SnsCapture>(EMPTY_SNS_CAPTURE);
  /** 現在 SNS URL 欄に入っている URL (オートセーブ対象・復元時に再取得する)。 */
  const [postUrl, setPostUrl] = useState<string>('');
  /**
   * 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧 (postUrl は従来通り「先頭/代表」を保持、
   * これは配列版)。重複URL検出 (multiSourceGuards.isDuplicatePostUrl) にも使う。
   */
  const [sourcePostUrls, setSourcePostUrls] = useState<string[]>(() =>
    mode === 'edit' && initialValues
      ? (initialValues.sourcePostUrls ?? (initialValues.postUrl ? [initialValues.postUrl] : []))
      : [],
  );
  /** 表示する URL 入力欄の数 (1..5)。 */
  const [urlSlotCount, setUrlSlotCount] = useState(1);
  /** 既に動画を1本捕捉済みか (2本目以降の動画を拒否する判定に使う、multiSourceGuards 参照)。 */
  const capturedVideoRef = useRef(false);
  /** 住所を既に (どれかのURLから) 自動入力済みか。true の間は以降のURLの住所は適用しない。 */
  const addressAppliedRef = useRef(false);
  /**
   * オートセーブ復元時に SNS URL 欄へ流し込む初期 URL (Task14 fix)。復元時に一度だけ設定し、
   * RegisterSectionMedia → HousingRegisterSnsUrlField(initialUrl) 経由でマウント時再取得を発火する。
   */
  const [restoredSnsUrl, setRestoredSnsUrl] = useState<string | undefined>(undefined);
  /**
   * RegisterSectionMedia / HousingRegisterSnsUrlField の内部 state (url 等) を強制リセットするための
   * 再マウント key の一部。破棄 (handleDiscardRestore) で ++ し、URL 欄の内部 url state を初期化する。
   * JSX 側では `${mediaKey}:${restoredSnsUrl}` を key にし、復元 URL 到着時 (restoredSnsUrl が
   * undefined→URL に変化) にも再マウントさせて SnsUrlField の initialUrl マウント再取得を発火させる。
   */
  const [mediaKey, setMediaKey] = useState(0);

  /**
   * オートセーブ復元起因の SNS 再取得が走っている間だけ true にするフラグ (spec:120 guard)。
   * true の間は applyExtractedAddress が「その時点で空の住所フィールドだけ」を setAutoFilled する
   * (= 復元済み・手修正済みの住所値をツイート元の値で上書きしない)。通常の (復元でない) SNS 貼付は
   * false のままで従来どおり全フィールド反映。ref なので再取得トリガーの前後で同期的に切り替えられる。
   */
  const restoreRefetchGuardRef = useRef(false);

  /**
   * parseHousingFromText の抽出結果を住所フィールドへ自動入力する共通処理。
   * 旧 HousingRegisterForm.tsx:123-151 の handleTweetFetched を移植し、ツイート/OGP
   * 両経路で共用できるよう分離した。size は extractSizeToAddress で
   * buildingType/roomKind/size モデルに変換してから展開する (dc/server/area/ward/plot は
   * そのまま渡す)。150ms スタッガーで 1 フィールドずつ自動入力し、
   * prefers-reduced-motion 時は即時反映する。
   *
   * spec:120: restoreRefetchGuardRef が true (復元起因の再取得中) のときは、適用時点で
   * 空のフィールド (address[name] === undefined) だけを埋める。復元済み・手修正済みの値は
   * 触らない。空判定はスタッガーの各適用時点の最新 address state (setAddress の prev) で行う。
   */
  const applyExtractedResult = useCallback(
    (result: HousingExtractResult) => {
      // 2026-07-21 追加 (Batch2): 複数URL対応。一度どれかのURLから住所を適用したら、
      // 以降のURL (2本目以降) から抽出された住所は無視する (「最初に見つかった方を採用」)。
      if (addressAppliedRef.current) return;
      const fills: Array<[string, unknown]> = [];
      if (result.dc) fills.push(['dc', result.dc]);
      if (result.server) fills.push(['server', result.server]);
      if (result.area) fills.push(['area', result.area]);
      if (result.ward != null) fills.push(['ward', result.ward]);
      if (result.plot != null) fills.push(['plot', result.plot]);
      if (result.size) {
        const converted = extractSizeToAddress(result.size);
        fills.push(['buildingType', converted.buildingType]);
        if (converted.roomKind) fills.push(['roomKind', converted.roomKind]);
        // アパート判定時は apartmentBuilding=1 (本街) を既定補完する (G 恒久ブロッカー根治)。
        // apartmentBuilding は validateAddress が 1|2 必須だが、自動判定は号棟を復元しないため
        // undefined のまま残り、号棟 select の value={apartmentBuilding ?? 1}=「1号棟」表示に
        // 隠れて addressOk=false→登録不可になる。EphemeralAddPanel も同じく apartment 検出時に
        // apartmentBuilding=1 を積んでいる (browse/EphemeralAddPanel.tsx の applyParse)。
        // normalize 側 (唯一のチョークポイント) でも補完済みだが、可視 state と fieldState を
        // 一致させて号棟表示・ステッパー完了印を正しくするためここでも積む。
        if (converted.buildingType === 'apartment') fills.push(['apartmentBuilding', 1]);
        // converted.size (S/M/L) はここでは**入れない**。house の size は (area, plot) から
        // 一意に決まるので、下の導出 effect が唯一の書き込み口になる。本文の "L" 表記が
        // 区画の実サイズと食い違っていても、区画側 (= ゲームの一次データ) を正とする。
      }
      // アパートの号棟-部屋番号 (2026-07-13 round2 A-4)。パーサが確信を持って取れたときだけ
      // 値が入る (取れなければ undefined のまま = 誤値を作らない)。apartmentBuilding は
      // 上の既定値 1 補完より**後**に push することで、パーサが号棟 2 (拡張街) を検出できた
      // 場合に正しく上書きする (fills は setTimeout スタッガーで順に適用され、後勝ち)。
      if (result.roomNumber != null) fills.push(['roomNumber', result.roomNumber]);
      if (result.apartmentBuilding != null) fills.push(['apartmentBuilding', result.apartmentBuilding]);
      if (fills.length === 0) return;
      addressAppliedRef.current = true;

      // このハンドラ呼び出しが復元起因かをスナップショット (以降の setTimeout でも同じ値を使う)。
      const emptyOnly = restoreRefetchGuardRef.current;

      const applyOne = ([name, value]: [string, unknown]) => {
        // 復元起因の再取得では空フィールドのみ補完 (非空は上書きしない = spec:120)。
        // 空判定は最新 address を addressRef で読む (スタッガーで直前に埋めた値も反映される)。
        if (emptyOnly && (addressRef.current as Record<string, unknown>)[name] !== undefined) {
          return;
        }
        setAddress((prev) => ({ ...prev, [name]: value }));
        fieldState.setAutoFilled(name, value);
        // 住所確認ゲート: SNS 自動入力も「住所が変わった」とみなし確認を解除する。
        setAddressConfirmed(false);
      };

      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduce) {
        fills.forEach(applyOne);
      } else {
        fills.forEach((fill, i) => {
          window.setTimeout(() => applyOne(fill), i * TYPING_STAGGER_MS);
        });
      }
    },
    [fieldState],
  );

  /**
   * ツイート本文など「1 本のテキスト」から住所を抽出して適用する (従来経路)。
   * OGP 経路はページ内に候補が複数あるので extractHousingAddressFromPage を使う (handleOgpFetched)。
   */
  const applyExtractedAddress = useCallback(
    (text: string) => applyExtractedResult(parseHousingFromText(text)),
    [applyExtractedResult],
  );

  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      if (source && isDuplicatePostUrl(sourcePostUrls, source.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      applyExtractedAddress(data.text);
      const photos = data.photos ?? [];
      // 代表が既に YouTube で確定している場合、静止画は conflict_sources 制約 (YouTube は画像/動画と
      // 排他) により追加できない。sourceImageUrls に足すと buildDraftImageFields の YouTube 分岐
      // (sourceImageUrls を一切読まない) で黙って保存されない「受理したのに消える」事故になるため、
      // 動画1本制限と同じエラー経路 (video_limit) で拒否する (計画書 2026-07-21 self-review 済み要件)。
      const representativeIsYoutube = !!snsCapture.youtube;
      const rejectPhotosForYoutube = representativeIsYoutube && photos.length > 0;
      if (rejectPhotosForYoutube) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
      } else if (photos.length > 0) {
        setSourceImageUrls((prev) => [...prev, ...photos]);
      }

      const incomingHasVideo = !!data.video?.url;
      // 代表 (snsCapture.tweetData/youtube/ogp) が既に確定しているか、確定しているなら
      // tweetData 形状 (= 動画フィールドを差し込める形) を持つか。sourcePostUrls と同じく
      // 直接 state (snsCapture) を読む (このコールバックは URL 貼付という単発の
      // ユーザー操作起因で、既存の sourcePostUrls 依存と同じ精度で十分)。
      const hasRepresentative = !!(snsCapture.tweetData || snsCapture.youtube || snsCapture.ogp);
      const representativeCanHostVideo = !hasRepresentative || !!snsCapture.tweetData;
      const existingVideoLimit = shouldRejectIncomingVideo(capturedVideoRef.current, incomingHasVideo);
      // 代表が YouTube/OGP 由来 (tweetData を持たない) で、この動画を添付する tweetData が
      // 存在しない場合は「受理したのに保存先が無く消える」事故を防ぐため拒否扱いにする
      // (2026-07-21 レビュー指摘 Bug1 fix)。
      const orphanVideo = incomingHasVideo && !existingVideoLimit && !representativeCanHostVideo;
      const rejectVideo = existingVideoLimit || orphanVideo;
      if (rejectVideo) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
      } else if (incomingHasVideo) {
        capturedVideoRef.current = true;
      }
      const effectiveData = rejectVideo ? { ...data, video: null } : data;

      // SNS メタデータ捕捉: まだ何も捕捉していなければこの結果を「代表」として保持する
      // (tweetId/ogImageUrl 等は今も単数フィールドのため、最初の1件を正とする)。
      // 代表が既に tweetData 形状で確定していて、かつ今回の動画が受理された (rejectVideo=false)
      // 場合は、代表自体を上書きせず動画フィールドだけを差し込む (代表の tweetId/ogImageUrl 等は
      // 最初に確立した URL のものを維持する。2026-07-21 レビュー指摘 Bug1 fix)。
      setSnsCapture((prev) => {
        if (prev.tweetData || prev.youtube || prev.ogp) {
          if (prev.tweetData) {
            // 代表 (1本目) が Twitter のとき、後続のツイート URL が持つ静止画は同じ
            // pbs.twimg.com ホストなので validateImage の host 制約 (housingValidation.ts:413)
            // に抵触せずマージできる。動画差し込みと同じパターンで tweetData.photos /
            // photoAspectRatios へ index 整合を保って追記する (2026-07-21 レビュー指摘 Bug2
            // fix: buildDraftImageFields が読むのは tweetData.photos のみで、集約プールの
            // sourceImageUrls は見ないため、ここで合流させないと 2 本目以降の写真が
            // 「N枚取得しました」表示には出るのに保存時に消える)。
            const incomingPhotos = effectiveData.photos ?? [];
            const needsVideoSplice = !rejectVideo && incomingHasVideo && !prev.tweetData.video;
            const needsPhotoSplice = incomingPhotos.length > 0;
            if (needsVideoSplice || needsPhotoSplice) {
              return {
                ...prev,
                tweetData: {
                  ...prev.tweetData,
                  ...(needsPhotoSplice
                    ? {
                        photos: [...prev.tweetData.photos, ...incomingPhotos],
                        photoAspectRatios: mergeTweetPhotoAspectRatios(
                          prev.tweetData.photoAspectRatios,
                          prev.tweetData.photos.length,
                          effectiveData.photoAspectRatios,
                          incomingPhotos.length,
                        ),
                      }
                    : {}),
                  ...(needsVideoSplice ? { video: effectiveData.video } : {}),
                },
              };
            }
          }
          return prev;
        }
        return { tweetData: effectiveData, tweetSource: source, youtube: null, ogp: null };
      });
      if (source?.postUrl) {
        setSourcePostUrls((prev) => [...prev, source.postUrl]);
        setPostUrl((prev) => prev || source.postUrl);
      }
    },
    [applyExtractedAddress, snsCapture, sourcePostUrls, t],
  );

  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) {
        setSnsCapture((prev) => (prev.youtube ? { ...prev, youtube: null } : prev));
        return;
      }
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      // YouTube は静止画リストと排他 (既存 validateImage の conflict_sources 制約は不変)。
      // 既に画像/動画を何か捕捉済みなら、この YouTube URL は追加不可として拒否する。
      if (capturedVideoRef.current || sourceImageUrls.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      capturedVideoRef.current = true;
      setSnsCapture({ tweetData: null, tweetSource: null, youtube: data, ogp: null });
      setSourcePostUrls((prev) => [...prev, data.postUrl]);
      setPostUrl((prev) => prev || data.postUrl);
    },
    [sourcePostUrls, sourceImageUrls.length, t],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) {
        // URL 欄クリア / 失敗 → OGP 捕捉と画像をクリア。
        setSnsCapture((prev) => (prev.ogp ? { ...prev, ogp: null } : prev));
        return;
      }
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      // OGP サイトは og:title / og:description / 本文 の複数箇所に住所らしい文字列が散る。
      // og:description は truncate されて住所行が落ちるサイト (housingsnap は 120 字) があるので、
      // 本文テキストも候補に混ぜて「最も住所らしい 1 か所」を選ぶ。
      // 住所が読み取れなければ何もしない (= 画像のみ反映)。
      applyExtractedResult(
        extractHousingAddressFromPage({
          title: data.data.title,
          description: data.data.description,
          bodyText: data.data.text,
        }),
      );
      const images =
        data.data.images && data.data.images.length > 0
          ? data.data.images
          : data.data.image
            ? [data.data.image]
            : [];
      // 代表が既に Twitter (tweetData) で確定している場合、OGP 画像 (pbs.twimg.com 以外の
      // 任意ホスト) を tweetData.photos 側へマージすることはできない。buildDraftImageFields の
      // Twitter 分岐は tweetId 併用時に sourceImageUrls の全 URL が pbs.twimg.com であることを
      // 要求する (housingValidation.ts:413) ため、混ぜると invalid_url で登録全体が失敗してしまい
      // 「一部の写真が消える」より悪い「全部保存できない」regression になる。動画の orphanVideo
      // 拒否と同じ理由でこの組み合わせは拒否する (2026-07-21 レビュー指摘 Bug2 fix)。
      //
      // 代表が既に YouTube で確定している場合は、conflict_sources 制約 (YouTube は画像/動画と排他)
      // により画像を一切追加できない。buildDraftImageFields の YouTube 分岐は sourceImageUrls を
      // 読まないため、ここで足すと「受理したのに保存時に消える」事故になる。動画1本制限と同じ
      // エラー経路 (video_limit) で拒否する (計画書 2026-07-21 self-review 済み要件)。
      const representativeIsYoutube = !!snsCapture.youtube;
      const representativeIsTwitter = !!snsCapture.tweetData;
      if (images.length > 0) {
        if (representativeIsYoutube) {
          showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        } else if (representativeIsTwitter) {
          showToast(t('housing.register.snsUrl.error.photo_source_conflict'), 'error');
        } else {
          setSourceImageUrls((prev) => [...prev, ...images]);
        }
      }
      // SNS メタデータ捕捉: OGP に切り替わったので Twitter/YouTube 捕捉はクリア (排他)。
      setSnsCapture((prev) =>
        prev.tweetData || prev.youtube || prev.ogp ? prev : { tweetData: null, tweetSource: null, youtube: null, ogp: data },
      );
      setSourcePostUrls((prev) => [...prev, data.postUrl]);
      setPostUrl((prev) => prev || data.postUrl);
    },
    [applyExtractedResult, snsCapture, sourcePostUrls, t],
  );

  const handleAddUrlSlot = useCallback(() => {
    setUrlSlotCount((prev) => Math.min(5, prev + 1));
  }, []);
  const handleRemoveUrlSlot = useCallback((_index: number) => {
    // 欄を1つ減らす。既に取得済みの画像/住所/動画は取り消さない (個別画像削除は既存グリッドUIで行う、
    // ブレスト2026-07-21で「個別削除で十分」と確定済み)。
    setUrlSlotCount((prev) => Math.max(1, prev - 1));
  }, []);
  // mode で出すステップを絞る (Task3.4-1)。mode は生存中不変の prop なので依存は [mode] のみ。
  const effectiveStepIds = useMemo<StepId[]>(() => visibleStepIds(mode), [mode]);

  // ===== scroll-spy (ライブステッパー) =====
  // 中央スクロールコンテナと各セクション wrapper に ref を張り、IntersectionObserver で
  // 可視セクションを active にする (scroll ハンドラで layout 読みしない方針)。
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<StepId, HTMLDivElement | null>>({
    media: null,
    address: null,
    intro: null,
    visibility: null,
    confirm: null,
  });
  // 初期 active は「実際に表示される先頭ステップ」(create=media / edit=address)。
  const [activeStepId, setActiveStepId] = useState<StepId>(() => effectiveStepIds[0]);
  // 中央スクロールが最下部に達しているか (下の scroll ハンドラが更新)。最下部では最終
  // セクション (confirm) を強制 active にし、IO が手前のセクションへ戻すのを抑止する (#7)。
  const atBottomRef = useRef(false);

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 最下部では scroll ハンドラが confirm を確定させるので IO の判定はスキップ (#7)。
        if (atBottomRef.current) return;
        // 交差中セクションのうち画面最上位 (boundingClientRect.top が最小) のものを active に。
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = (visible[0].target as HTMLElement).dataset.stepId as StepId | undefined;
        if (topId) setActiveStepId(topId);
      },
      { root, threshold: 0.2, rootMargin: '0px 0px -60% 0px' },
    );

    for (const id of effectiveStepIds) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // user が null→truthy でフォーム(scrollContainerRef/各セクション)が mount された後に observer を張り直す
  }, [user, effectiveStepIds]);

  // 最下部到達時に最終ステップ (confirm) を active にする (#7)。IO の active 帯 (top 40%) は
  // 最後のセクションが下端で止まると届かず、確認ステップまで highlight が降りてこないため、
  // scroll で最下部を検知して補う。スクロール不能な短い内容では発火させない (先頭を保つ)。
  //
  // 同じ scroll ハンドラで左パネルの接続線塗り進行度 (0..1・Task2) も更新する。progress の
  // 読み取り/計算だけ rAF スロットルし (連続 scroll イベントを 1 フレームに間引く)、
  // atBottom/activeStepId の既存ロジックは同期のまま (挙動不変)。
  const [stepperProgress, setStepperProgress] = useState(0);
  const progressRafRef = useRef<number | null>(null);
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;
    const onScroll = () => {
      const scrollable = root.scrollHeight - root.clientHeight > 8;
      const atBottom = scrollable && root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      atBottomRef.current = atBottom;
      if (atBottom) {
        const last = effectiveStepIds[effectiveStepIds.length - 1];
        setActiveStepId((prev) => (prev === last ? prev : last));
      }
      if (progressRafRef.current != null) return;
      progressRafRef.current = window.requestAnimationFrame(() => {
        progressRafRef.current = null;
        const r = scrollContainerRef.current;
        if (!r) return;
        const max = r.scrollHeight - r.clientHeight;
        const ratio = max > 0 ? r.scrollTop / max : 0;
        setStepperProgress(Math.min(1, Math.max(0, ratio)));
      });
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (progressRafRef.current != null) {
        window.cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };
  }, [user, effectiveStepIds]);

  const handleJumpToStep = useCallback((id: number) => {
    const stepId = effectiveStepIds[id - 1];
    const el = stepId ? sectionRefs.current[stepId] : null;
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [effectiveStepIds]);

  // メディアの有無 = 静止画 + 動画/YouTube。画像必須 (新規登録) の判定に使う
  // (ユーザー承認 2026-07-15: 画像 or 動画があれば OK)。
  const hasMedia =
    localImages.length > 0 ||
    sourceImageUrls.length > 0 ||
    editThumbnailPaths.length > 0 ||
    !!snsCapture.tweetData?.video?.url ||
    !!snsCapture.youtube;
  const introDone = title.trim().length > 0;

  // ===== 右カラム: 入力チェック (Task13) =====
  // address を AddressInput 候補に組み立てて validateAddress にかける (重複照会の妥当性判定と共用)。
  // buildingType と矛盾する不可視フィールド (アパート中の plot/size 等) は必ず落とす (B5 根治)。
  const normalizedAddress = useMemo(() => normalizeAddressForBuildingType(address), [address]);
  const addressCandidate = useMemo<AddressInput>(
    () => ({
      dc: normalizedAddress.dc ?? '',
      server: normalizedAddress.server ?? '',
      area: normalizedAddress.area ?? '',
      ward: normalizedAddress.ward ?? Number.NaN,
      buildingType: normalizedAddress.buildingType ?? '',
      plot: normalizedAddress.plot,
      size: normalizedAddress.size,
      apartmentBuilding: normalizedAddress.apartmentBuilding,
      roomKind: normalizedAddress.roomKind,
      roomNumber: normalizedAddress.roomNumber,
    }),
    [normalizedAddress],
  );
  const addressOk = useMemo(() => validateAddress(addressCandidate).ok, [addressCandidate]);
  const titleOk = useMemo(() => validateTitle(title).ok, [title]);
  const checklistItems = useMemo(
    () =>
      computeRegisterChecklist({
        addressOk,
        addressConfirmed,
        titleOk,
        hasImage: hasMedia,
        // 新規登録のみ画像/動画を必須にする (edit は写真を編集しない方式A のため対象外)。
        imageRequired: mode === 'create',
      }),
    [addressOk, addressConfirmed, titleOk, hasMedia, mode],
  );
  // 公開可否 = 必須行 (住所/タイトル) が全て done か。画像 (推奨) は見ない。
  const canSubmit = useMemo(() => isReadyToPublish(checklistItems), [checklistItems]);
  const checkPanelItems = checklistItems;

  const doneMap = useMemo<Record<StepId, boolean>>(
    () => ({
      media: hasMedia,
      address: fieldState.isReadyToSubmit(),
      intro: introDone,
      visibility: visibilityTouched,
      // confirm = 必須項目が揃って登録可能になったら done (isReadyToPublish)。
      confirm: canSubmit,
    }),
    [mode, hasMedia, fieldState, introDone, visibilityTouched, canSubmit],
  );

  const steps: RegisterStep[] = useMemo(
    () =>
      effectiveStepIds.map((id, idx) => {
        const state: RegisterStepState = id === activeStepId ? 'active' : doneMap[id] ? 'done' : 'idle';
        // 番号は表示位置 (idx+1) で振り直す。 edit で media を除外しても 1 から詰まり欠番が出ない (Task3.4-1)。
        // intro ステップは「住所非公開」選択時、ラベルはそのまま「コメント」の説明文だけ差し替える
        // (一覧に住所ではなく「住所は非公開です」と出る旨を伝える・Task4)。
        const descKey = id === 'intro' && visibility === 'unlisted' ? 'housing.register.step_desc.intro_unlisted' : undefined;
        return { id: idx + 1, labelKey: STEP_LABEL_KEYS[id], state, descKey };
      }),
    [effectiveStepIds, activeStepId, doneMap, visibility],
  );

  // ===== 右カラム: 重複照会 (debounce 500ms, Task13) =====
  // 住所が妥当になったら 500ms デバウンスで checkDuplicate を呼ぶ。競合対策として
  // 世代トークン (requestSeqRef) を持たせ、古いタイマー/古い応答が新しい結果を
  // 上書きしないようにする。失敗時は握りつぶし idle (中立) に留める (登録フローをブロックしないが、
  // 重複の有無が不明な状態を「重複なし」と偽って安心させない)。
  const [duplicateState, setDuplicateState] = useState<RegisterDuplicateState>('idle');
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);
  const [privateMatchCount, setPrivateMatchCount] = useState(0);
  const debounceTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // 編集モード (mode='edit') では自分自身の doc が必ず住所一致でヒットし「重複」誤検知になる。
    // 送信ゲート (handleSubmit) は既に mode==='edit' で checkDuplicate をスキップしているのに、
    // ライブ照会側だけ mode ガードが漏れていて右カラムパネルが常に⚠重複を出していた (I 根治)。
    // 編集中はライブ照会を一切走らせず、in-flight 応答も無効化して idle (中立) に留める。
    if (mode === 'edit') {
      requestSeqRef.current += 1;
      setDuplicateState('idle');
      setDuplicates([]);
      setPrivateMatchCount(0);
      return;
    }

    if (!addressOk) {
      // 世代を進めて in-flight 応答を無効化してから idle に戻す。
      requestSeqRef.current += 1;
      setDuplicateState('idle');
      setDuplicates([]);
      setPrivateMatchCount(0);
      return;
    }

    const mySeq = ++requestSeqRef.current;
    setDuplicateState('checking');
    debounceTimerRef.current = window.setTimeout(() => {
      checkDuplicate(addressCandidate)
        .then((res) => {
          if (requestSeqRef.current !== mySeq) return; // 古い世代の応答は破棄
          const nextDuplicates = res.duplicates ?? [];
          const nextPrivateCount = res.privateMatchCount ?? 0;
          setDuplicates(nextDuplicates);
          setPrivateMatchCount(nextPrivateCount);
          setDuplicateState(nextDuplicates.length === 0 && nextPrivateCount === 0 ? 'clear' : 'found');
        })
        .catch(() => {
          if (requestSeqRef.current !== mySeq) return;
          // 失敗時は止めない (安全側)。ただし重複の有無は実際には不明なので、
          // 「重複なし・安心」を断定表示する clear ではなく中立の idle に留める
          // (偽の安心表示を出さない)。住所を再編集すれば次のキー入力で再発火する。
          setDuplicates([]);
          setPrivateMatchCount(0);
          setDuplicateState('idle');
        });
    }, 500);

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // addressCandidate は address から導出される新規オブジェクトなので、実質的な変化検知は
    // addressOk と中身の JSON 化で行う (JSON.stringify で値の同一性を見る簡便策)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressOk, JSON.stringify(addressCandidate)]);

  // unmount 時に debounce タイマーを確実に破棄する。
  useEffect(
    () => () => {
      if (debounceTimerRef.current != null) window.clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  // ===== submit オーケストレーション (Task14) =====
  const [submitting, setSubmitting] = useState(false);
  const [submitErrorKey, setSubmitErrorKey] = useState<string | null>(null);
  // submit 時の重複警告ダイアログ。null=非表示、配列=公開重複を表示中。
  const [submitDuplicates, setSubmitDuplicates] = useState<DuplicateEntry[] | null>(null);

  /**
   * 分散した page state を 1 つの RegistrationDraft に組む。
   * - 住所は新モデル (buildingType/roomKind/size) を素通し (旧 5 択変換は不要)。
   * - title/visibility/publishUntil/tags/description を含める。
   * - 画像フィールドは buildDraftImageFields (旧優先順位の複製) で組む。
   */
  const buildDraft = useCallback((): RegistrationDraft => {
    const imageFields = buildDraftImageFields(snsCapture, localImages, sourceImageUrls);
    // 検証 (addressCandidate) と同じ正規化済み住所を使う (不可視フィールド残留を送信しない・B5)。
    const a = normalizeAddressForBuildingType(address);
    return {
      dc: a.dc ?? '',
      server: a.server ?? '',
      area: a.area ?? '',
      ward: a.ward ?? 0,
      buildingType: a.buildingType ?? 'house',
      plot: a.plot,
      size: a.size,
      apartmentBuilding: a.apartmentBuilding,
      roomKind: a.roomKind,
      roomNumber: a.roomNumber,
      tags,
      description: description || undefined,
      // タイトルは任意 (2026-07-10)。空文字はサーバー validateTitle の required に当たるため
      // undefined で送る (未指定=OK)。未入力なら一覧カードは住所フォールバックを表示する。
      title: title.trim() ? title.trim() : undefined,
      visibility,
      publishUntil,
      afterExpiryVisibility,
      ...imageFields,
      ...(sourcePostUrls.length > 0 ? { sourcePostUrls } : {}),
    };
  }, [
    address,
    tags,
    description,
    title,
    visibility,
    publishUntil,
    afterExpiryVisibility,
    snsCapture,
    localImages,
    sourceImageUrls,
    sourcePostUrls,
  ]);

  /**
   * 実 register + 後続処理 (重複 OK / 「それでも登録」 両方から呼ばれる)。
   * 旧 performRegister (HousingRegisterFormModal.tsx:141-184) を踏襲。
   */
  const performRegister = useCallback(
    async (draft: RegistrationDraft) => {
      setSubmitting(true);
      try {
        const { id } = await registerListing(draft);

        // localImages があれば register 直後に upload-thumbnail を逐次呼ぶ (index=0..N-1)。
        // 1 件でも失敗したら upload_failed を控えるが listing 自体は成功済み。
        // HousingRegisterImageField は最大12枚まで選ばせるが、物件画像として保存されるのは
        // 先頭 SAVED_IMAGES_LIMIT 枚のみ (UI の「使用」バッジ・ja.json ヒントと同じ約束)。
        // ここで絞らずに全件送ると、サーバー側 MAX_IMAGES_PER_LISTING で確実に拒否される
        // リクエストのぶんだけ無駄にレート制限バケットを消費してしまう (2026-07-20 実ユーザー報告)。
        const imagesToUpload = localImages.slice(0, SAVED_IMAGES_LIMIT);
        if (imagesToUpload.length > 0) {
          let uploadFailedOnce = false;
          for (let i = 0; i < imagesToUpload.length; i++) {
            const img = imagesToUpload[i];
            try {
              await uploadListingThumbnail({
                listingId: id,
                base64: img.base64,
                mimeType: img.mimeType,
                index: i,
              });
            } catch (uploadErr) {
              console.warn(`[RegisterPage] thumbnail upload failed (index=${i})`, uploadErr);
              uploadFailedOnce = true;
            }
          }
          if (uploadFailedOnce) setSubmitErrorKey('upload_failed');
        }

        // 中央一覧へ即反映 (2026-07-13 round2 A-5・c: リロード不要 + Firestore 読み取り0)。
        // 旧実装は fetchAndUpsert(id) (getDoc 1件) + loadMine(uid) (最大200件) を毎登録で
        // 叩いていた。draft + id + ownerUid からローカルに view-model を組んで upsert する
        // だけで反映できるため、追加の Firestore 読み取りを一切発生させない。
        // マイ一覧 (loadMine) の即時再取得は行わない (次回マイページ訪問時に load される)。
        if (user) {
          useHousingListingsStore.getState().upsert(buildLocalListingViewModel(draft, id, user.uid));
        }

        // 登録成功でオートセーブを破棄。
        try {
          window.localStorage.removeItem(AUTOSAVE_KEY);
        } catch {
          /* localStorage 不可でも致命的でない */
        }

        showToast(
          draft.visibility === 'private'
            ? t('housing.register.toast.saved_private')
            : t('housing.register.toast.published'),
          'success',
        );
        navigate(`/housing/listing/${id}`);
      } catch (e) {
        if (e instanceof QuotaExhaustedError) {
          setSubmitErrorKey('quota_exhausted');
        } else if (e instanceof Error && e.message === 'not_authenticated') {
          setSubmitErrorKey('not_authenticated');
        } else {
          setSubmitErrorKey('generic');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [localImages, user, navigate, t],
  );

  /**
   * mode='edit' の保存 (Task3.2)。 useHousingUpdate 経由で更新 API を呼ぶ
   * (HousingRegisterView.performUpdate を踏襲)。 create パス (performRegister) とは
   * 完全に独立: checkDuplicate 照会なし・thumbnail upload なし
   * (画像は方式Aによりこのフォームで変更しない・サーバー updatePayload も画像フィールドを含めない)。
   * 成功時は一覧 + マイ一覧を即反映してから詳細ページへ戻る。
   */
  /**
   * 直接アップロード側の state 更新をラップし、sns→thumbnail の切替が
   * (uploadListingThumbnail が既に完了させた後で) ローカル表示にも反映されるよう、
   * URL側の古い表示を同時にクリアする (Plan B・2026-07-21)。
   */
  const handleEditThumbnailPathsChange = useCallback(
    (next: string[]) => {
      setEditThumbnailPaths(next);
      if (next.length > 0 && (sourceImageUrls.length > 0 || editVideoPreview)) {
        setSourceImageUrls([]);
        setEditVideoPreview(null);
      }
    },
    [sourceImageUrls.length, editVideoPreview],
  );

  /**
   * URL経由の「投稿URLを追加する」commit (Plan B・2026-07-21 → Batch2 2026-07-22 で
   * 追加方式に統一)。update-listing はフルドラフトを要求するため、既存 buildDraft() の
   * 結果から画像関連フィールドを除去したものに「今回取得した (= 既存+新規の累積)」画像
   * フィールドを上書きマージする。
   *
   * 注意 (2026-07-21 バグ修正): buildDraft() 自体の image 部分は snsCapture state 由来
   * だが、この関数は成功時に setSnsCapture(capture) を呼ぶため、2回目以降の呼び出し時点
   * では snsCapture は「前回貼り付けた」データを保持しており空ではない。単純に
   * `{ ...buildDraft(), ...freshImageFields }` とマージすると、freshImageFields に存在
   * しないキー (例: 動画無しツイートに貼り替えた際の videoUrl) は buildDraft() 側の古い
   * 値が生き残ってサーバーに送信されてしまう。画像データは freshImageFields だけを
   * 信頼できるよう、buildDraft() の画像フィールドは明示的に取り除いてからマージする。
   *
   * `capture`/`freshSourceImageUrls` は呼び出し元 (HousingEditSourcePanel) 側で既に
   * 「既存 sourceImageUrls + 今回貼ったURLの新規分」の累積結果として組まれている
   * (代表の tweetId/postUrl 等は最初に確立したURLのものを維持しつつ、写真は常に最新の
   * sourceImageUrls から組み直す設計。HousingEditImageGrid 経由の削除/並び替えを取りこぼ
   * さないため)。ここでは無条件にページ state (snsCapture) を capture に追従させる —
   * 「初回成功時だけ反映」ガードにすると、2回目以降の貼付けで snsCapture が古いまま
   * 固まり、最終「保存」ボタン (buildDraft() 経由・performUpdate) が古い画像データで
   * 上書きしてしまう回帰を生むため置かない。
   *
   * 成功したら初めて画面表示用の state (snsCapture/sourceImageUrls/sourcePostUrls/
   * postUrl/editVideoPreview) を更新し、直接アップロード側の表示は空にする (サーバー側で
   * thumbnailPaths が削除されるため)。
   */
  const commitEditSnsFetch = useCallback(
    async (
      capture: SnsCapture,
      freshSourceImageUrls: string[],
      nextPostUrl: string,
    ): Promise<{ ok: boolean; skipped?: boolean }> => {
      if (!initialValues) return { ok: false };
      const freshImageFields = buildDraftImageFields(capture, [], freshSourceImageUrls);
      if (freshImageFields.imageMode !== 'sns') {
        // 画像/動画が取れなかった (テキストのみツイート等)。既存データを維持し何もしない。
        return { ok: true, skipped: true };
      }
      const {
        imageMode: _imageMode,
        postUrl: _postUrl,
        ogImageUrl: _ogImageUrl,
        youtubeVideoId: _youtubeVideoId,
        tweetId: _tweetId,
        sourceImageUrls: _sourceImageUrls,
        sourceImageAspectRatios: _sourceImageAspectRatios,
        videoUrl: _videoUrl,
        videoPosterUrl: _videoPosterUrl,
        videoAspectRatio: _videoAspectRatio,
        ...nonImageDraft
      } = buildDraft();
      void [
        _imageMode,
        _postUrl,
        _ogImageUrl,
        _youtubeVideoId,
        _tweetId,
        _sourceImageUrls,
        _sourceImageAspectRatios,
        _videoUrl,
        _videoPosterUrl,
        _videoAspectRatio,
      ];
      // 2026-07-22 追加 (Batch2): sourcePostUrls に今回のURLを追記して送る (重複は呼び出し元の
      // HousingEditSourcePanel が isDuplicatePostUrl で既に弾いている前提)。
      const nextSourcePostUrls = [...sourcePostUrls, nextPostUrl];
      const payload = { ...nonImageDraft, ...freshImageFields, sourcePostUrls: nextSourcePostUrls };
      const result = await updateListing(initialValues.id, payload);
      if (!result.ok) return { ok: false };
      setSnsCapture(capture);
      setSourceImageUrls(freshSourceImageUrls);
      setSourcePostUrls(nextSourcePostUrls);
      setEditThumbnailPaths([]);
      setEditVideoPreview(
        capture.tweetData?.video
          ? {
              url: capture.tweetData.video.url,
              posterUrl: capture.tweetData.video.posterUrl,
              aspectRatio: capture.tweetData.video.aspectRatio ?? undefined,
            }
          // 2026-07-22 (Batch2): 追加方式なので、今回のcaptureに動画が無くても既存のプレビューを
          // 消さない (貼り替えではないため「動画無し=削除」ではない)。
          : editVideoPreview,
      );
      if (!postUrl) setPostUrl(nextPostUrl);
      await useHousingListingsStore.getState().fetchAndUpsert(initialValues.id);
      return { ok: true };
    },
    [initialValues, buildDraft, updateListing, sourcePostUrls, editVideoPreview, postUrl],
  );

  const performUpdate = useCallback(
    async (draft: RegistrationDraft) => {
      if (!initialValues) return;
      setSubmitting(true);
      try {
        const result = await updateListing(initialValues.id, draft);
        if (result.ok) {
          // Task3.3a 回帰修復 / Task3.4-4 順序修正: 編集=通報対処とみなす後処理 (resolveReport 等) を、
          // store 再取得より先に呼ぶ。 resolveReport はサーバー側の isHidden を解除するため、
          // 先に呼んでおかないと直後の fetchAndUpsert/loadMine が unhide 前の stale な状態を
          // 一時的に拾ってしまう (旧 handleListingSaved: resolveReport→refreshAfterChange と同順)。
          // 失敗しても編集自体は保存済みなので後続 (store 再取得/navigate) は止めない。
          try {
            await onSaved?.(initialValues.id);
          } catch {
            /* onSaved (通報解決等) の失敗は保存フローを止めない */
          }
          await useHousingListingsStore.getState().fetchAndUpsert(initialValues.id);
          if (user) await useHousingListingsStore.getState().loadMine(user.uid);
          showToast(t('housing.edit.success'), 'success');
          navigate(`/housing/listing/${initialValues.id}`);
        } else {
          setSubmitErrorKey('generic');
        }
      } catch {
        setSubmitErrorKey('generic');
      } finally {
        setSubmitting(false);
      }
    },
    [initialValues, updateListing, user, navigate, t, onSaved],
  );

  /**
   * 確認セクションの主アクション押下時。
   * mode='edit' は checkDuplicate を照会せず (自分自身が重複扱いになるため) performUpdate へ
   * 直行する。 mode='create' (既定) の挙動は不変: まず checkDuplicate で公開重複を照会し、
   * あれば HousingDuplicateWarningDialog を出す (onProceed で performRegister へ)。
   * submit 時の checkDuplicate 失敗は登録を止めず register に進む (旧 handleConfirm:204-209
   * と同じ = ゲートをバイパスするだけ。Task13 の debounce プレチェックとは別物)。
   */
  const handleSubmit = useCallback(async () => {
    if (submitting || !canSubmit) return;
    setSubmitErrorKey(null);
    const draft = buildDraft();

    if (mode === 'edit') {
      await performUpdate(draft);
      return;
    }

    setSubmitting(true);
    try {
      const dup = await checkDuplicate(draft);
      setSubmitting(false);
      if (dup.duplicates.length > 0) {
        setSubmitDuplicates(dup.duplicates);
        return;
      }
      await performRegister(draft);
    } catch (e) {
      setSubmitting(false);
      console.warn('[RegisterPage] checkDuplicate failed on submit, proceeding anyway', e);
      await performRegister(draft);
    }
  }, [submitting, canSubmit, buildDraft, mode, performUpdate, performRegister]);

  // ===== 確認セクション要約 =====
  const confirmSummary = useMemo<RegisterConfirmSummary>(() => {
    let addressText: string | null = null;
    if (addressOk && address.area) {
      // 確認セクション+公開ボタン上の住所をフル住所化 (2026-07-13 round2 A-3・②)。
      // region は regionForDC(dc) で導出し、未知 DC (Shadow 等) は null になり得るが
      // formatFullHousingAddress 側の null ガード (A-2) が街区住所へフォールバックするので
      // ここではそのまま渡してよい。addressOk===true のときは dc/server は必ず値が入っている。
      addressText = formatFullHousingAddress(
        {
          region: regionForDC(address.dc ?? ''),
          dc: address.dc ?? '',
          server: address.server ?? '',
          area: address.area as HousingArea,
          ward: address.ward ?? 0,
          buildingType: address.buildingType,
          plot: address.plot,
          apartmentBuilding: address.apartmentBuilding,
          roomNumber: address.roomNumber,
        },
        i18n.language,
      );
    }
    // 静止画枚数 (ローカル + SNS 取得画像)。加えて、静止画ゼロでも動画のみツイート/YouTube を
    // 捕捉していれば「1 件」として数える (sourceImageUrls 空の動画ツイートで 0 と表示されないように)。
    const stillCount = localImages.length + sourceImageUrls.length + editThumbnailPaths.length;
    const hasCapturedMedia =
      stillCount === 0 && (!!snsCapture.tweetData?.video?.url || !!snsCapture.youtube);
    return {
      address: addressText,
      title: title.trim() ? title.trim() : null,
      imageCount: stillCount + (hasCapturedMedia ? 1 : 0),
    };
  }, [
    addressOk,
    address,
    title,
    localImages.length,
    sourceImageUrls.length,
    editThumbnailPaths.length,
    snsCapture.tweetData,
    snsCapture.youtube,
    i18n.language,
  ]);

  // ===== オートセーブ (Task14 / spec:119-120) =====
  // 値変化を debounce (700ms) でテキスト系のみ localStorage 保存。
  const autosaveTimerRef = useRef<number | null>(null);
  // マウント直後の復元適用が終わるまで保存を抑止 (復元値を即上書きしないため)。
  const autosaveReadyRef = useRef(false);
  const [restoredNoticeVisible, setRestoredNoticeVisible] = useState(false);

  const autosaveValues = useMemo<Partial<AutosaveDraft>>(
    () => ({
      title,
      description,
      tags,
      dc: address.dc,
      server: address.server,
      area: address.area,
      ward: address.ward,
      buildingType: address.buildingType,
      plot: address.plot,
      size: address.size,
      apartmentBuilding: address.apartmentBuilding,
      roomKind: address.roomKind,
      roomNumber: address.roomNumber,
      postUrl: postUrl || undefined,
      visibility,
      publishUntil,
      afterExpiryVisibility,
    }),
    [title, description, tags, address, postUrl, visibility, publishUntil, afterExpiryVisibility],
  );

  useEffect(() => {
    // オートセーブは「新規登録の入力を途中で失わないための復旧」機能であり、mode='edit' には
    // 適用しない。edit は常に initialValues (サーバーの現在値) が正なので保存対象にすると、
    // 編集中の内容が「次に開く新規登録 or 別リスティングの編集」に漏れて誤って復元される
    // (2026-07-20 実ユーザー報告: 最初に登録した物件を編集すると別の物件の内容になる、の根因の一つ)。
    if (mode !== 'create') return;
    if (!user) return;
    if (!autosaveReadyRef.current) return; // 復元適用前は保存しない
    if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        // 意味のある入力が 1 つも無い間は保存しない (既存の空ドラフトも掃除する)。
        // 「開いただけで次回『入力途中を復元しました』が出る」誤発火を保存の段階で断つ。
        if (hasMeaningfulDraft(autosaveValues)) {
          window.localStorage.setItem(AUTOSAVE_KEY, serializeDraft(autosaveValues));
        } else {
          window.localStorage.removeItem(AUTOSAVE_KEY);
        }
      } catch {
        /* localStorage 不可でも致命的でない */
      }
    }, 700);
    return () => {
      if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [mode, user, autosaveValues]);

  /**
   * マウント時 (ログイン済) に localStorage から復元。復元候補があれば:
   * - 住所/タイトル/コメント/タグ/公開設定を反映。fieldState への setAutoFilled はこの時点で
   *   全フィールドが空なので復元値をそのまま適用する。
   * - 保存済み SNS URL があれば restoredSnsUrl に設定し、RegisterSectionMedia →
   *   HousingRegisterSnsUrlField(initialUrl) 経由でマウント時に画像を実再取得する (spec:120)。
   *   この復元起因の再取得は restoreRefetchGuardRef=true とし、applyExtractedAddress が
   *   「その時点で空の住所フィールドだけ」を補完する (復元済み・手修正済みの住所値を上書きしない)。
   *   注記「SNS 画像は再取得します」は実際に再取得が走るため正しくなる。
   *
   * 続けて (Task5・spec §4.3): create モードのみ、「住所登録なし一時ツアー」の
   * 「この家を登録する」から渡された一回限りプリフィル (registerPrefill) を消費する。
   * 上のオートセーブ復元で埋まったフィールドは上書きしない (addressPatch を共有して判定)。
   * postUrl も復元と同じ restoredSnsUrl 経路に乗せて SNS を再取得するが、通知行は出さない
   * (ユーザーが直前に自分で押した遷移のため)。
   *
   * 一度だけ実行 (user 確定後)。
   *
   * mode='edit' には適用しない (2026-07-20 実ユーザー報告の根因): 復元は「新規登録の
   * 下書き」を前提にしており、edit は既に initialValues で正しい値を持っている。ここを
   * 無条件で実行すると、以前どこかで (別リスティングの編集中や新規登録の入力中に) 保存された
   * 無関係な下書きが、今開いている edit フォームへ無条件に上書き適用されてしまう。
   */
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'create') return;
    if (!user) return;
    if (restoreAppliedRef.current) {
      autosaveReadyRef.current = true;
      return;
    }
    restoreAppliedRef.current = true;

    // 住所 patch はオートセーブ復元・一時ツアープリフィルの両方が書き込む共有バッファ。
    // 最後に 1 回だけ setAddress する (どちらもここまでに決まった値を尊重する)。
    const addressPatch: RegisterAddressValues = {};
    let postUrlApplied = false;

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(AUTOSAVE_KEY);
    } catch {
      raw = null;
    }
    const restored = restoreDraft(raw);

    if (restored) {
      // テキスト系を state へ反映。
      if (typeof restored.title === 'string') setTitle(restored.title);
      if (typeof restored.description === 'string') setDescription(restored.description);
      if (Array.isArray(restored.tags)) setTags(restored.tags);
      if (restored.visibility === 'public' || restored.visibility === 'private') {
        setVisibility(restored.visibility);
        setVisibilityTouched(true);
      }
      if (restored.publishUntil === null || typeof restored.publishUntil === 'number') {
        setPublishUntil(restored.publishUntil);
      }
      if (restored.afterExpiryVisibility === 'unlisted' || restored.afterExpiryVisibility === 'private') {
        setAfterExpiryVisibility(restored.afterExpiryVisibility);
      }
      // 保存済み SNS URL: postUrl state を復元 + initialUrl として SnsUrlField に渡し実再取得する。
      // 復元起因の再取得は住所を空フィールドだけ補完する (spec:120 guard を先に true にする)。
      if (typeof restored.postUrl === 'string' && restored.postUrl.trim()) {
        setPostUrl(restored.postUrl);
        restoreRefetchGuardRef.current = true;
        setRestoredSnsUrl(restored.postUrl);
        postUrlApplied = true;
      }

      // 住所フィールド: 復元後に空のフィールドだけへ適用 (この時点で全フィールドは空なので全て適用)。
      const setIfDefined = (key: keyof RegisterAddressValues, value: unknown) => {
        if (value === undefined) return;
        (addressPatch as Record<string, unknown>)[key] = value;
        fieldState.setAutoFilled(key, value);
      };
      setIfDefined('dc', restored.dc);
      setIfDefined('server', restored.server);
      setIfDefined('area', restored.area);
      setIfDefined('ward', restored.ward);
      setIfDefined('buildingType', restored.buildingType);
      setIfDefined('plot', restored.plot);
      setIfDefined('size', restored.size);
      setIfDefined('apartmentBuilding', restored.apartmentBuilding);
      setIfDefined('roomKind', restored.roomKind);
      setIfDefined('roomNumber', restored.roomNumber);

      // 実際に意味のある入力があるドラフトのときだけ通知 + 破棄ボタンを出す
      // (空文字タイトル/コメント・既定 public・publishUntil null だけの下書きでは誤発火させない)。
      if (hasMeaningfulDraft(restored)) setRestoredNoticeVisible(true);
    }

    // Task5 (spec §4.3): 一時ツアーからの一回限りプリフィル。create モードのみ消費し、
    // まだ空いているフィールドだけを埋める (上の復元・既存の初期値を上書きしない)。
    // 適用しても通知行は出さない (ユーザーが直前に自分で押した遷移のため)。
    if (mode === 'create') {
      const prefill = consumeRegisterPrefill();
      if (prefill) {
        const setPrefillIfEmpty = (key: keyof RegisterAddressValues, value: unknown) => {
          if (value === undefined) return;
          if ((addressPatch as Record<string, unknown>)[key] !== undefined) return; // 復元済みは上書きしない
          if ((address as Record<string, unknown>)[key] !== undefined) return; // 既存入力も上書きしない
          (addressPatch as Record<string, unknown>)[key] = value;
          fieldState.setAutoFilled(key, value);
        };
        setPrefillIfEmpty('area', prefill.area);
        setPrefillIfEmpty('ward', prefill.ward);
        setPrefillIfEmpty('buildingType', prefill.buildingType);
        setPrefillIfEmpty('plot', prefill.plot);
        setPrefillIfEmpty('size', prefill.size);
        setPrefillIfEmpty('apartmentBuilding', prefill.apartmentBuilding);
        setPrefillIfEmpty('roomNumber', prefill.roomNumber);

        // postUrl: 復元側が既に設定済み/既存入力があれば上書きしない。
        if (prefill.postUrl && !postUrlApplied && !postUrl.trim()) {
          setPostUrl(prefill.postUrl);
          restoreRefetchGuardRef.current = true;
          setRestoredSnsUrl(prefill.postUrl);
        }
      }
    }

    if (Object.keys(addressPatch).length > 0) {
      setAddress((prev) => ({ ...prev, ...addressPatch }));
      // 住所確認ゲート: 復元/プリフィルいずれも「住所が変わった」とみなし未確認にする (spec:1-1)。
      setAddressConfirmed(false);
    }

    // 復元/プリフィルの適用が終わったので以降の値変化から保存を再開する。
    autosaveReadyRef.current = true;
    // 依存は user/mode のみ (一度だけ実行)。fieldState は identity が変わるが restoreAppliedRef で二重適用を防ぐ。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mode]);

  const handleDiscardRestore = useCallback(() => {
    try {
      window.localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      /* noop */
    }
    setRestoredNoticeVisible(false);
    // 入力内容をクリアして初期状態に戻す。
    setTitle('');
    setDescription('');
    setTags([]);
    setAddress({});
    setPostUrl('');
    setVisibility('public');
    setVisibilityTouched(false);
    setPublishUntil(null);
    setLocalImages([]);
    setSourceImageUrls([]);
    setSnsCapture(EMPTY_SNS_CAPTURE);
    for (const name of Object.keys(autosaveValues)) fieldState.clearField(name);
    // 復元 guard を解除し、initialUrl も消して SnsUrlField を再マウント (内部 url state もクリア)。
    restoreRefetchGuardRef.current = false;
    setRestoredSnsUrl(undefined);
    setMediaKey((k) => k + 1);
    // 2026-07-21 レビュー指摘 Bug2 fix: Batch2 で追加したガード state/ref も初期状態に戻す。
    // 未リセットのままだと、破棄後も addressAppliedRef が住所自動入力を永久にブロックしたり、
    // sourcePostUrls に残った URL を再度貼ると誤って重複扱いになったりする。
    setSourcePostUrls([]);
    capturedVideoRef.current = false;
    addressAppliedRef.current = false;
    setUrlSlotCount(1);
  }, [autosaveValues, fieldState]);

  // ユーザーが URL 欄を手入力したら復元 guard を外す (以降の再取得は全フィールド上書きに戻す)。
  const handleUrlUserEdit = useCallback(() => {
    restoreRefetchGuardRef.current = false;
  }, []);

  if (!user) {
    return (
      <div className="housing-register">
        <section className="housing-register-panel housing-register-panel-solo" data-region="center">
          <div className="housing-register-col housing-register-col-center">
            <div data-testid="housing-register-login-prompt">
              <HousingLoginPrompt context="register" registerFlag={false} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="housing-register" data-testid="housing-register-form-root">
      {/* 左カラム: ステッパーナビ (スクロール) + 本日の登録枠 (下端固定・#6)。
          残数はスクロールに埋もれないよう、スクロール領域の外=左パネル最下部に固定する。
          「登録の流れ」(RegisterGuide) はステッパーと役割が重複していたため右カラムへ移設。 */}
      <section className="housing-register-panel" data-region="left">
        <div className="housing-register-col housing-register-col-left">
          <div className="housing-register-left-scroll">
            <RegisterStepperNav steps={steps} onJump={handleJumpToStep} progress={stepperProgress} />
          </div>
          {(isAdmin || (remaining != null && registrationCount != null)) && (
            <p
              className="housing-register-left-remaining"
              data-testid="housing-register-guide-remaining"
            >
              {isAdmin
                ? t('housing.register.quota.admin')
                : registrationTicketsRemaining(registrationCount!) > 0
                  ? t('housing.register.quota.tickets_remaining', {
                      remaining: registrationTicketsRemaining(registrationCount!),
                      total: REGISTRATION_INITIAL_BONUS,
                    })
                  : t('housing.register.quota.daily_remaining', {
                      remaining: remaining!,
                      max: REGISTRATION_DAILY_QUOTA,
                    })}
            </p>
          )}
        </div>
      </section>

      {/* 中央カラム: セクション群。spec 正典順 (media→address→intro→visibility→confirm)。 */}
      <section className="housing-register-panel" data-region="center">
        <div className="housing-register-col housing-register-col-center" ref={scrollContainerRef}>
          <div className="housing-register-sections">
            {restoredNoticeVisible && (
              <div className="housing-register-autosave-notice" data-testid="housing-register-autosave-notice">
                <div className="housing-register-autosave-notice-body">
                  <p className="housing-register-autosave-notice-text">
                    {t('housing.register.autosave.restored')}
                  </p>
                  {postUrl && (
                    <p className="housing-register-autosave-notice-hint">
                      {t('housing.register.autosave.sns_refetch')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="housing-register-autosave-discard"
                  data-testid="housing-register-autosave-discard"
                  onClick={handleDiscardRestore}
                >
                  {t('housing.register.autosave.discard')}
                </button>
              </div>
            )}
            <div ref={(el) => { sectionRefs.current.media = el; }} data-step-id="media">
              {mode === 'edit' ? (
                initialValues && (
                  <HousingEditMediaSection
                    listingId={initialValues.id}
                    initialMode={
                      (initialValues.imageMode === 'thumbnail' ? 'thumbnail' : 'sns') as EditMediaMode
                    }
                    thumbnailPaths={editThumbnailPaths}
                    onThumbnailPathsChange={handleEditThumbnailPathsChange}
                    sourceImageUrls={sourceImageUrls}
                    onSourceImageUrlsChange={setSourceImageUrls}
                    videoPreview={editVideoPreview}
                    sourcePostUrls={sourcePostUrls}
                    onCommitSnsFetch={commitEditSnsFetch}
                  />
                )
              ) : (
                <RegisterSectionMedia
                  key={`${mediaKey}:${restoredSnsUrl ?? ''}`}
                  onTweetFetched={handleTweetFetched}
                  onYoutubeFetched={handleYoutubeFetched}
                  onOgpFetched={handleOgpFetched}
                  localImages={localImages}
                  onLocalImagesChange={setLocalImages}
                  sourceImageUrls={sourceImageUrls}
                  onSourceImageUrlsChange={setSourceImageUrls}
                  initialSnsUrl={restoredSnsUrl}
                  onUrlUserEdit={handleUrlUserEdit}
                  // 動画ツイートの poster を最小プレビュー (ポスター1枚+「動画あり」バッジ) で見せる。
                  // <video> 直参照は CSP 不可のため posterUrl (pbs.twimg.com) を <img> で出す。
                  tweetVideo={snsCapture.tweetData?.video ?? null}
                  urlSlotCount={urlSlotCount}
                  onAddUrlSlot={handleAddUrlSlot}
                  onRemoveUrlSlot={handleRemoveUrlSlot}
                />
              )}
            </div>
            <div ref={(el) => { sectionRefs.current.address = el; }} data-step-id="address">
              <RegisterSectionAddress
                fieldState={fieldState}
                values={address}
                onChange={handleAddressChange}
              />
            </div>
            <div ref={(el) => { sectionRefs.current.intro = el; }} data-step-id="intro">
              <RegisterSectionIntro
                title={title}
                description={description}
                tags={tags}
                visibility={visibility}
                onChange={handleIntroChange}
              />
            </div>
            <div ref={(el) => { sectionRefs.current.visibility = el; }} data-step-id="visibility">
              <RegisterSectionVisibility
                // 破棄 (handleDiscardRestore) で mediaKey が ++ される → 再マウントされ、
                // publishUntil=null で初期化され直して終了日時トグルが OFF に戻る (復元 ON は
                // RegisterSectionVisibility 内の useEffect が publishUntil 到着で ON にする)。
                key={mediaKey}
                visibility={visibility}
                publishUntil={publishUntil}
                afterExpiryVisibility={afterExpiryVisibility}
                onChange={handleVisibilityChange}
              />
            </div>
            {/* Task9: 確認セクション直前の任意ブロック (spec §4.1)。 ステッパー/scroll-spy の
                対象 (STEP_IDS) には含めない — 何も要求しない導線なので「必須ステップ」に
                見せない。 ログイン済のときだけ RegisterHousingerCta 内部で自分のプロフィールを
                読み、 CTA (未公開時) / 公開中表示を出す。 */}
            <RegisterHousingerCta />
            <div
              ref={(el) => { sectionRefs.current.confirm = el; }}
              data-step-id="confirm"
            >
              <RegisterSectionConfirm
                mode={mode}
                summary={confirmSummary}
                canSubmit={canSubmit}
                visibility={visibility}
                submitting={submitting}
                errorKey={submitErrorKey}
                onSubmit={handleSubmit}
                checklistItems={checklistItems}
                addressConfirmed={addressConfirmed}
                onConfirmAddress={handleConfirmAddress}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 右カラム: チェック/重複パネル + 区画マッププレビュー (Task13 本実装) */}
      <section className="housing-register-panel" data-region="right">
        <div className="housing-register-col housing-register-col-right">
          <RegisterCheckPanel items={checkPanelItems} />
          {/* 重複照会パネルは create 専用。編集モードは自分の doc が必ずヒットして誤「重複」に
              なるため出さない (ライブ照会 effect 側も mode==='edit' で走らせない・I 根治)。 */}
          {mode !== 'edit' && (
            <RegisterDuplicatePanel
              state={duplicateState}
              duplicates={duplicates}
              privateMatchCount={privateMatchCount}
            />
          )}
          {/* #5: 静的ミニマップから、ツアーと同じ「動くマップ」に統一。住所が地図解決
              できるまで (area+plot / area+apartmentBuilding) は何も出さない。 */}
          <RegisterAddressMap address={address} />

          {/* 「登録の流れ」を左から移設。左のライブステッパー (現在地) と役割が重複していたため、
              教育的な説明はこちら (参照材料) に置き、左は現在地表示に専念させる。 */}
          <RegisterGuide />
        </div>
      </section>

      {/* submit 時の同住所公開重複ダイアログ。「戻って修正」/「それでも登録」 の二択。 */}
      {submitDuplicates && (
        <HousingDuplicateWarningDialog
          duplicates={submitDuplicates}
          onClose={() => setSubmitDuplicates(null)}
          onCorrect={() => setSubmitDuplicates(null)}
          onProceed={async () => {
            setSubmitDuplicates(null);
            await performRegister(buildDraft());
          }}
        />
      )}
    </div>
  );
};
