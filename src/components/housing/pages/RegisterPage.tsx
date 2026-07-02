import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { RegisterSectionAddress, type RegisterAddressValues } from '../register/RegisterSectionAddress';
import { RegisterSectionIntro, type RegisterSectionIntroValues } from '../register/RegisterSectionIntro';
import { RegisterSectionMedia } from '../register/RegisterSectionMedia';
import { RegisterSectionVisibility } from '../register/RegisterSectionVisibility';
import { RegisterStepperNav, type RegisterStep, type RegisterStepState } from '../register/RegisterStepperNav';
import { RegisterGuide } from '../register/RegisterGuide';
import { parseHousingFromText } from '../../../lib/housing/parseHousingFromText';
import { extractSizeToAddress } from '../../../lib/housing/extractSizeToAddress';
import { canRegister } from '../../../lib/housingApiClient';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import type { CompressedImage } from '../../../lib/housing/imageCompression';

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
    (data: TweetData, _source: { postUrl: string; tweetId: string } | null) => {
      applyExtractedAddress(data.text);
      const photos = data.photos ?? [];
      if (photos.length > 0) setSourceImageUrls(photos.slice(0, 10));
    },
    [applyExtractedAddress],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) return;
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
  const doneMap = useMemo<Record<StepId, boolean>>(
    () => ({
      media: hasImage,
      address: fieldState.isReadyToSubmit(),
      intro: introDone,
      visibility: visibilityTouched,
      // confirm の done 配線は Task14 (computeRegisterChecklist/isReadyToPublish) が行う。
      confirm: false,
    }),
    [hasImage, fieldState, introDone, visibilityTouched],
  );

  const steps: RegisterStep[] = useMemo(
    () =>
      STEP_IDS.map((id) => {
        const state: RegisterStepState = id === activeStepId ? 'active' : doneMap[id] ? 'done' : 'idle';
        return { id: STEP_INDEX[id], labelKey: STEP_LABEL_KEYS[id], state };
      }),
    [activeStepId, doneMap],
  );

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
            <div ref={(el) => { sectionRefs.current.media = el; }} data-step-id="media">
              <RegisterSectionMedia
                onTweetFetched={handleTweetFetched}
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
              data-testid="housing-register-section-confirm-stub"
            />
          </div>
        </div>
      </section>

      {/* 右カラム: チェック/重複パネル + 区画マッププレビュー (Task11-14 で本実装) */}
      <section className="housing-register-panel" data-region="right">
        <div className="housing-register-col housing-register-col-right">
          <div data-testid="housing-register-check-panel-stub" />
          <div data-testid="housing-register-duplicate-panel-stub" />
          <div data-testid="housing-register-ward-map-preview-stub" />
        </div>
      </section>
    </div>
  );
};
