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
import { computeRegisterChecklist, isReadyToPublish } from '../../../lib/housing/registerChecklist';
import { normalizeAddressForBuildingType } from '../../../lib/housing/normalizeAddressForBuildingType';
import {
  AUTOSAVE_KEY,
  serializeDraft,
  restoreDraft,
  type AutosaveDraft,
} from '../../../lib/housing/registerAutosave';
import { consumeRegisterPrefill } from '../../../lib/housing/registerPrefill';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { YoutubeFetchedData, OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import type { CompressedImage } from '../../../lib/housing/imageCompression';
import type { HousingArea, HousingListing } from '../../../types/housing';

/**
 * 捕捉した SNS 取得結果 (画像 draft 構築の材料)。旧 HousingRegisterForm の tweetData/
 * tweetSource/youtubeData/ogpResult をページ state にまとめて保持し、submit 時に
 * 画像優先順位ロジックへ流す。テキストツイート等で画像ゼロでも「URL は取得済み」を
 * 表せるよう postUrl を別途保持する (imageMode='none' の黙示事故を塞ぐ材料)。
 */
interface SnsCapture {
  tweetData: TweetData | null;
  tweetSource: { postUrl: string; tweetId: string } | null;
  youtube: YoutubeFetchedData | null;
  ogp: OgpFetchedData | null;
}

const EMPTY_SNS_CAPTURE: SnsCapture = {
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
 *   ② YouTube                    → imageMode='sns' + youtubeVideoId + ogImageUrl
 *   ③ Twitter (本文取得済)       → 静止画/動画/両方同居を OR 統合。テキストのみは何も付けない
 *   ④ OGP                        → imageMode='sns' + sourceImageUrls (先頭 10) + ogImageUrl=先頭
 *   ⑤ どれも無し                 → imageMode 未指定 (= 'none')
 *
 * imageMode='none' の黙示事故 (URL を貼ったのに画像が保存されない) を塞ぐため、②〜④の
 * 各分岐は旧ロジックと同じ条件・同じフィールド構成で組む。sourceImageUrls (ページの
 * 並び替え結果) は Twitter/OGP どちらでも代表画像 (ogImageUrl=先頭) の整合を取る。
 */
function buildDraftImageFields(
  sns: SnsCapture,
  localImages: CompressedImage[],
  sourceImageUrls: string[],
): Partial<RegistrationDraft> {
  const hasLocalImages = localImages.length > 0;
  if (hasLocalImages) {
    // ① localImages 優先。SNS 画像は draft に載せない (登録後に thumbnail upload)。
    return {};
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
 * edit は写真セクション自体を表示しない (方式A) ため、media ステップも除外する
 * (押しても sectionRefs.current.media===null で無反応な「幽霊ステップ」を無くす)。
 * 番号は返り値配列内の位置 (idx+1) で振り直すため、除外しても 1 から詰まって欠番が出ない。
 */
function visibleStepIds(mode: 'create' | 'edit'): StepId[] {
  return mode === 'edit' ? STEP_IDS.filter((id) => id !== 'media') : [...STEP_IDS];
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
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    () => initialValues?.visibility ?? 'public',
  );
  const [publishUntil, setPublishUntil] = useState<number | null>(
    () => initialValues?.publishUntil ?? null,
  );
  // 既定 public を自動で✅にしない (feedback_form_ux_progress) ため、公開設定セクションの
  // onChange が一度でも呼ばれたかを別フラグで持つ (visibility state 自体は初期値 'public')。
  // mode='edit' は visibility が initialValues から確定済みなので、ステッパーの visibility
  // ステップは最初から done 扱いにする (Task3.1 申し送り事項・Task3.2 で対応)。
  const [visibilityTouched, setVisibilityTouched] = useState(() => mode === 'edit');

  const handleVisibilityChange = (next: { visibility: 'public' | 'private'; publishUntil: number | null }) => {
    setVisibility(next.visibility);
    setPublishUntil(next.publishUntil);
    setVisibilityTouched(true);
  };

  // 登録枠残数 (canRegister の remaining)。取得失敗時は null にフォールバックし、
  // ガイドは残数行を出さない (throw させない = reference_housing_appcheck_headers)。
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    canRegister()
      .then((res) => {
        if (!cancelled) setRemaining(res.remaining);
      })
      .catch(() => {
        if (!cancelled) setRemaining(null);
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
  const [sourceImageUrls, setSourceImageUrls] = useState<string[]>([]);

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
        // converted.size (S/M/L) はここでは**入れない**。house の size は (area, plot) から
        // 一意に決まるので、下の導出 effect が唯一の書き込み口になる。本文の "L" 表記が
        // 区画の実サイズと食い違っていても、区画側 (= ゲームの一次データ) を正とする。
      }
      if (fills.length === 0) return;

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
      applyExtractedAddress(data.text);
      const photos = data.photos ?? [];
      if (photos.length > 0) setSourceImageUrls(photos.slice(0, 10));
      // SNS メタデータ捕捉: Twitter に切り替わったので YouTube/OGP 捕捉はクリア (排他)。
      setSnsCapture({ tweetData: data, tweetSource: source, youtube: null, ogp: null });
      if (source?.postUrl) setPostUrl(source.postUrl);
    },
    [applyExtractedAddress],
  );

  const handleYoutubeFetched = useCallback((data: YoutubeFetchedData | null) => {
    if (!data) {
      // URL 欄が空になった / 別形式に切替 → YouTube 捕捉のみクリア (他経路は各ハンドラが管理)。
      setSnsCapture((prev) => (prev.youtube ? { ...prev, youtube: null } : prev));
      return;
    }
    setSnsCapture({ tweetData: null, tweetSource: null, youtube: data, ogp: null });
    setPostUrl(data.postUrl);
    // YouTube はサムネ 1 枚のみ。sourceImageUrls (静止画リスト) は使わないためクリア。
    setSourceImageUrls([]);
  }, []);

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) {
        // URL 欄クリア / 失敗 → OGP 捕捉と画像をクリア。
        setSnsCapture((prev) => (prev.ogp ? { ...prev, ogp: null } : prev));
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
      const images = data.data.images ?? [];
      if (images.length > 0) {
        setSourceImageUrls(images.slice(0, 10));
      } else if (data.data.image) {
        setSourceImageUrls([data.data.image]);
      }
      // SNS メタデータ捕捉: OGP に切り替わったので Twitter/YouTube 捕捉はクリア (排他)。
      setSnsCapture({ tweetData: null, tweetSource: null, youtube: null, ogp: data });
      if (data.postUrl) setPostUrl(data.postUrl);
    },
    [applyExtractedResult],
  );

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

  const hasImage = localImages.length > 0 || sourceImageUrls.length > 0;
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
    () => computeRegisterChecklist({ addressOk, addressConfirmed, titleOk, hasImage }),
    [addressOk, addressConfirmed, titleOk, hasImage],
  );
  // 公開可否 = 必須行 (住所/タイトル) が全て done か。画像 (推奨) は見ない。
  const canSubmit = useMemo(() => isReadyToPublish(checklistItems), [checklistItems]);
  // 右カラム CheckPanel 表示専用 (Task3.4-2): edit は画像を編集しない (方式A) ため画像行を出さない。
  // canSubmit/確認セクションの不足アクション判定は checklistItems (image を含む) をそのまま使い続ける
  // (image は required=false なので判定への影響は無い。 表示のみをここで絞る)。
  const checkPanelItems = useMemo(
    () => (mode === 'edit' ? checklistItems.filter((item) => item.key !== 'image') : checklistItems),
    [mode, checklistItems],
  );

  const doneMap = useMemo<Record<StepId, boolean>>(
    () => ({
      // mode='edit' は写真セクション自体を非表示にする (方式A・Task3.2) ので、
      // 未達の⚠として残らないよう常に done 扱いにする。
      media: mode === 'edit' ? true : hasImage,
      address: fieldState.isReadyToSubmit(),
      intro: introDone,
      visibility: visibilityTouched,
      // confirm = 必須項目が揃って登録可能になったら done (isReadyToPublish)。
      confirm: canSubmit,
    }),
    [mode, hasImage, fieldState, introDone, visibilityTouched, canSubmit],
  );

  const steps: RegisterStep[] = useMemo(
    () =>
      effectiveStepIds.map((id, idx) => {
        const state: RegisterStepState = id === activeStepId ? 'active' : doneMap[id] ? 'done' : 'idle';
        // 番号は表示位置 (idx+1) で振り直す。 edit で media を除外しても 1 から詰まり欠番が出ない (Task3.4-1)。
        return { id: idx + 1, labelKey: STEP_LABEL_KEYS[id], state };
      }),
    [effectiveStepIds, activeStepId, doneMap],
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
      ...imageFields,
    };
  }, [address, tags, description, title, visibility, publishUntil, snsCapture, localImages, sourceImageUrls]);

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
        if (localImages.length > 0) {
          let uploadFailedOnce = false;
          for (let i = 0; i < localImages.length; i++) {
            const img = localImages[i];
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

        // 中央一覧 + マイ一覧へ即反映 (リロード不要)。失敗しても登録は成功済み。
        await useHousingListingsStore.getState().fetchAndUpsert(id);
        if (user) await useHousingListingsStore.getState().loadMine(user.uid);

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
      addressText = formatHousingAddress(
        {
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
    const stillCount = localImages.length + sourceImageUrls.length;
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
    }),
    [title, description, tags, address, postUrl, visibility, publishUntil],
  );

  useEffect(() => {
    if (!user) return;
    if (!autosaveReadyRef.current) return; // 復元適用前は保存しない
    if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(AUTOSAVE_KEY, serializeDraft(autosaveValues));
      } catch {
        /* localStorage 不可でも致命的でない */
      }
    }, 700);
    return () => {
      if (autosaveTimerRef.current != null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [user, autosaveValues]);

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
   */
  const restoreAppliedRef = useRef(false);
  useEffect(() => {
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

      // 何か 1 つでも復元したら通知 + 破棄ボタンを出す。
      const hasAny =
        restored.title != null ||
        restored.description != null ||
        (Array.isArray(restored.tags) && restored.tags.length > 0) ||
        Object.keys(addressPatch).length > 0 ||
        restored.postUrl != null ||
        restored.publishUntil != null;
      if (hasAny) setRestoredNoticeVisible(true);
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
    // 依存は user のみ (一度だけ実行)。fieldState は identity が変わるが restoreAppliedRef で二重適用を防ぐ。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
          {remaining != null && (
            <p
              className="housing-register-left-remaining"
              data-testid="housing-register-guide-remaining"
            >
              {t('housing.register.guide.remaining', { count: remaining })}
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
            {/* mode='edit' は写真を扱わない (方式A) ため、写真セクション自体を出さない (Task3.2)。
                sectionRefs.current.media は null のままとなり、scroll-spy/ジャンプは自然に無視する。 */}
            {mode !== 'edit' && (
              <div ref={(el) => { sectionRefs.current.media = el; }} data-step-id="media">
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
                />
              </div>
            )}
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
          <RegisterDuplicatePanel
            state={duplicateState}
            duplicates={duplicates}
            privateMatchCount={privateMatchCount}
          />
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
