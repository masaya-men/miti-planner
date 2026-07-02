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
import { RegisterStepperNav, type RegisterStep, type RegisterStepState } from '../register/RegisterStepperNav';
import { RegisterGuide } from '../register/RegisterGuide';
import { RegisterCheckPanel } from '../register/RegisterCheckPanel';
import { RegisterDuplicatePanel, type RegisterDuplicateState } from '../register/RegisterDuplicatePanel';
import { WardMapPreview } from '../register/WardMapPreview';
import { HousingDuplicateWarningDialog } from '../HousingDuplicateWarningDialog';
import { showToast } from '../../Toast';
import { parseHousingFromText } from '../../../lib/housing/parseHousingFromText';
import { extractSizeToAddress } from '../../../lib/housing/extractSizeToAddress';
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
import {
  AUTOSAVE_KEY,
  serializeDraft,
  restoreDraft,
  type AutosaveDraft,
} from '../../../lib/housing/registerAutosave';
import { formatHousingAddress } from '../../../lib/housing/formatHousingAddress';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { YoutubeFetchedData, OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import type { CompressedImage } from '../../../lib/housing/imageCompression';
import type { HousingArea, HousingSize } from '../../../types/housing';

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
  if (sns.ogp && sns.ogp.data.image) {
    return {
      imageMode: 'sns',
      postUrl: sns.ogp.postUrl,
      ogImageUrl: sns.ogp.data.image,
    };
  }

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
const STEP_INDEX: Record<StepId, number> = {
  media: 1,
  address: 2,
  intro: 3,
  visibility: 4,
  confirm: 5,
};

// 自動入力の段階的タイピング表現 (1 フィールドごとに 150ms ずらす)。
// 旧 HousingRegisterForm.tsx の TYPING_STAGGER_MS を踏襲。
const TYPING_STAGGER_MS = 150;

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
 * 登録ページ (3カラム): 探す/お気に入りと同じ骨格。
 * 未ログイン → 中央にログイン案内。ログイン済 → 3カラムのフォーム枠。
 * フォーム状態 (住所/紹介/画像/公開設定) は本ページが親として保持し、子セクションに
 * 値とセッタを渡す。中央カラムのセクションは spec 正典順 (media→address→intro→
 * visibility→confirm) で並び、IntersectionObserver による scroll-spy で左カラムの
 * ステッパー (RegisterStepperNav) と連動する (Task12)。confirm セクション本体と
 * 右カラムの中身は Task13-14 で本実装、それまでスタブに留める。
 */
export const RegisterPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [address, setAddress] = useState<RegisterAddressValues>({});
  const requiredFields = requiredFieldsForAddress(address.buildingType, address.roomKind);
  const fieldState = useHousingFieldState(requiredFields);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [publishUntil, setPublishUntil] = useState<number | null>(null);
  // 既定 public を自動で✅にしない (feedback_form_ux_progress) ため、公開設定セクションの
  // onChange が一度でも呼ばれたかを別フラグで持つ (visibility state 自体は初期値 'public')。
  const [visibilityTouched, setVisibilityTouched] = useState(false);

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
    setAddress((prev) => ({ ...prev, [name]: value }));
    fieldState.userEdit(name, value);
  };

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
   * parseHousingFromText の抽出結果を住所フィールドへ自動入力する共通処理。
   * 旧 HousingRegisterForm.tsx:123-151 の handleTweetFetched を移植し、ツイート/OGP
   * 両経路で共用できるよう分離した。size は extractSizeToAddress で
   * buildingType/roomKind/size モデルに変換してから展開する (dc/server/area/ward/plot は
   * そのまま渡す)。150ms スタッガーで 1 フィールドずつ自動入力し、
   * prefers-reduced-motion 時は即時反映する。
   */
  const applyExtractedAddress = useCallback(
    (text: string) => {
      const result = parseHousingFromText(text);
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
        if (converted.size) fills.push(['size', converted.size]);
      }
      if (fills.length === 0) return;

      const applyOne = ([name, value]: [string, unknown]) => {
        setAddress((prev) => ({ ...prev, [name]: value }));
        fieldState.setAutoFilled(name, value);
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
      // OGP サイトの title/description を結合して住所抽出にかける (画像だけ取れて住所が
      // 読み取れないケースは何もしない = 画像のみ反映)。
      const text = [data.data.title, data.data.description].filter(Boolean).join('\n');
      if (text.trim().length > 0) applyExtractedAddress(text);
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
    [applyExtractedAddress],
  );

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
  const [activeStepId, setActiveStepId] = useState<StepId>('media');

  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 交差中セクションのうち画面最上位 (boundingClientRect.top が最小) のものを active に。
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = (visible[0].target as HTMLElement).dataset.stepId as StepId | undefined;
        if (topId) setActiveStepId(topId);
      },
      { root, threshold: 0.2, rootMargin: '0px 0px -60% 0px' },
    );

    for (const id of STEP_IDS) {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
    // user が null→truthy でフォーム(scrollContainerRef/各セクション)が mount された後に observer を張り直す
  }, [user]);

  const handleJumpToStep = useCallback((id: number) => {
    const stepId = STEP_IDS[id - 1];
    const el = stepId ? sectionRefs.current[stepId] : null;
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const hasImage = localImages.length > 0 || sourceImageUrls.length > 0;
  const introDone = title.trim().length > 0;

  // ===== 右カラム: 入力チェック (Task13) =====
  // address を AddressInput 候補に組み立てて validateAddress にかける (重複照会の妥当性判定と共用)。
  const addressCandidate = useMemo<AddressInput>(
    () => ({
      dc: address.dc ?? '',
      server: address.server ?? '',
      area: address.area ?? '',
      ward: address.ward ?? Number.NaN,
      buildingType: address.buildingType ?? '',
      plot: address.plot,
      size: address.size,
      apartmentBuilding: address.apartmentBuilding,
      roomKind: address.roomKind,
      roomNumber: address.roomNumber,
    }),
    [address],
  );
  const addressOk = useMemo(() => validateAddress(addressCandidate).ok, [addressCandidate]);
  const titleOk = useMemo(() => validateTitle(title).ok, [title]);
  const checklistItems = useMemo(
    () => computeRegisterChecklist({ addressOk, titleOk, hasImage }),
    [addressOk, titleOk, hasImage],
  );
  // 公開可否 = 必須行 (住所/タイトル) が全て done か。画像 (推奨) は見ない。
  const canSubmit = useMemo(() => isReadyToPublish(checklistItems), [checklistItems]);

  const doneMap = useMemo<Record<StepId, boolean>>(
    () => ({
      media: hasImage,
      address: fieldState.isReadyToSubmit(),
      intro: introDone,
      visibility: visibilityTouched,
      // confirm = 必須項目が揃って登録可能になったら done (isReadyToPublish)。
      confirm: canSubmit,
    }),
    [hasImage, fieldState, introDone, visibilityTouched, canSubmit],
  );

  const steps: RegisterStep[] = useMemo(
    () =>
      STEP_IDS.map((id) => {
        const state: RegisterStepState = id === activeStepId ? 'active' : doneMap[id] ? 'done' : 'idle';
        return { id: STEP_INDEX[id], labelKey: STEP_LABEL_KEYS[id], state };
      }),
    [activeStepId, doneMap],
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
    return {
      dc: address.dc ?? '',
      server: address.server ?? '',
      area: address.area ?? '',
      ward: address.ward ?? 0,
      buildingType: address.buildingType ?? 'house',
      plot: address.plot,
      size: address.size,
      apartmentBuilding: address.apartmentBuilding,
      roomKind: address.roomKind,
      roomNumber: address.roomNumber,
      tags,
      description: description || undefined,
      title,
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
   * 確認セクションの主アクション押下時。まず checkDuplicate で公開重複を照会し、
   * あれば HousingDuplicateWarningDialog を出す (onProceed で performRegister へ)。
   * submit 時の checkDuplicate 失敗は登録を止めず register に進む (旧 handleConfirm:204-209
   * と同じ = ゲートをバイパスするだけ。Task13 の debounce プレチェックとは別物)。
   */
  const handleSubmit = useCallback(async () => {
    if (submitting || !canSubmit) return;
    setSubmitErrorKey(null);
    const draft = buildDraft();
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
  }, [submitting, canSubmit, buildDraft, performRegister]);

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
    return {
      address: addressText,
      title: title.trim() ? title.trim() : null,
      imageCount: localImages.length + sourceImageUrls.length,
    };
  }, [addressOk, address, title, localImages.length, sourceImageUrls.length, i18n.language]);

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
   * - 住所/タイトル/コメント/タグ/公開設定を反映。ただし fieldState への setAutoFilled は
   *   「復元後に空のフィールドだけ」に適用する (= 復元済み・手修正済みの値は上書きしない、spec:120)。
   *   ここではマウント直後で全フィールドが空なので、復元した住所値をそのまま setAutoFilled する。
   * - 保存済み SNS URL があれば「SNS 画像は再取得します」注記を出す (取得の再実行は
   *   ユーザーが URL を貼り直す/そのままにする運用。URL 欄は postUrl として保持)。
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

    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(AUTOSAVE_KEY);
    } catch {
      raw = null;
    }
    const restored = restoreDraft(raw);
    if (!restored) {
      autosaveReadyRef.current = true;
      return;
    }

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
    if (typeof restored.postUrl === 'string') setPostUrl(restored.postUrl);

    // 住所フィールド: 復元後に空のフィールドだけへ適用 (この時点で全フィールドは空なので全て適用)。
    const addressPatch: RegisterAddressValues = {};
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
    if (Object.keys(addressPatch).length > 0) {
      setAddress((prev) => ({ ...prev, ...addressPatch }));
    }

    // 何か 1 つでも復元したら通知 + 破棄ボタンを出す。
    const hasAny =
      restored.title != null ||
      restored.description != null ||
      (Array.isArray(restored.tags) && restored.tags.length > 0) ||
      Object.keys(addressPatch).length > 0 ||
      restored.postUrl != null ||
      restored.publishUntil != null;
    if (hasAny) setRestoredNoticeVisible(true);

    // 復元適用が終わったので以降の値変化から保存を再開する。
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
  }, [autosaveValues, fieldState]);

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
      {/* 左カラム: ステッパーナビ + ガイド */}
      <section className="housing-register-panel" data-region="left">
        <div className="housing-register-col housing-register-col-left">
          <RegisterStepperNav steps={steps} onJump={handleJumpToStep} />
          <RegisterGuide remaining={remaining} />
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
              <RegisterSectionMedia
                onTweetFetched={handleTweetFetched}
                onYoutubeFetched={handleYoutubeFetched}
                onOgpFetched={handleOgpFetched}
                localImages={localImages}
                onLocalImagesChange={setLocalImages}
                sourceImageUrls={sourceImageUrls}
                onSourceImageUrlsChange={setSourceImageUrls}
              />
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
                onChange={handleIntroChange}
              />
            </div>
            <div ref={(el) => { sectionRefs.current.visibility = el; }} data-step-id="visibility">
              <RegisterSectionVisibility
                visibility={visibility}
                publishUntil={publishUntil}
                onChange={handleVisibilityChange}
              />
            </div>
            <div
              ref={(el) => { sectionRefs.current.confirm = el; }}
              data-step-id="confirm"
            >
              <RegisterSectionConfirm
                summary={confirmSummary}
                canSubmit={canSubmit}
                visibility={visibility}
                submitting={submitting}
                errorKey={submitErrorKey}
                onSubmit={handleSubmit}
                checklistItems={checklistItems}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 右カラム: チェック/重複パネル + 区画マッププレビュー (Task13 本実装) */}
      <section className="housing-register-panel" data-region="right">
        <div className="housing-register-col housing-register-col-right">
          <RegisterCheckPanel items={checklistItems} />
          <RegisterDuplicatePanel
            state={duplicateState}
            duplicates={duplicates}
            privateMatchCount={privateMatchCount}
          />
          <WardMapPreview
            area={address.area}
            plot={address.plot}
            apartmentBuilding={address.apartmentBuilding}
            buildingType={address.buildingType}
            ward={address.ward}
            size={address.size as HousingSize | undefined}
          />
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
