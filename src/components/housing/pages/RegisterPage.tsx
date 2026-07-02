import { useCallback, useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { HousingLoginPrompt } from '../HousingLoginPrompt';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { RegisterSectionAddress, type RegisterAddressValues } from '../register/RegisterSectionAddress';
import { RegisterSectionIntro, type RegisterSectionIntroValues } from '../register/RegisterSectionIntro';
import { RegisterSectionMedia } from '../register/RegisterSectionMedia';
import { parseHousingFromText } from '../../../lib/housing/parseHousingFromText';
import { extractSizeToAddress } from '../../../lib/housing/extractSizeToAddress';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import type { CompressedImage } from '../../../lib/housing/imageCompression';

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
 * フォーム状態 (住所 + タイトル/公開設定) は本ページが親として保持し、子セクションに
 * 値とセッタを渡す (Task10)。中央カラムの残りセクション (画像/公開設定/確認) と
 * 左右カラムの中身は Task11-14 で本実装、それまでインライン div のスタブに留める。
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
  // visibility/publishUntil は Task12 (公開設定セクション) が配線するまで未消費。
  // tsc noUnusedLocals 対策に加え、状態自体は本タスクの要件 (フォーム状態を親が持つ) を満たす。
  void visibility;
  void setVisibility;
  void publishUntil;
  void setPublishUntil;

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
      {/* 左カラム: ステッパーナビ + ガイド (Task11-14 で本実装) */}
      <section className="housing-register-panel" data-region="left">
        <div className="housing-register-col housing-register-col-left">
          <div data-testid="housing-register-stepper-nav-stub" />
          <div data-testid="housing-register-guide-stub" />
        </div>
      </section>

      {/* 中央カラム: セクション群。住所/紹介は本実装済 (Task10)、残りは Task11-14。 */}
      <section className="housing-register-panel" data-region="center">
        <div className="housing-register-col housing-register-col-center">
          <div className="housing-register-sections">
            <RegisterSectionAddress
              fieldState={fieldState}
              values={address}
              onChange={handleAddressChange}
            />
            <RegisterSectionIntro
              title={title}
              description={description}
              tags={tags}
              onChange={handleIntroChange}
            />
            <RegisterSectionMedia
              onTweetFetched={handleTweetFetched}
              onOgpFetched={handleOgpFetched}
              localImages={localImages}
              onLocalImagesChange={setLocalImages}
              sourceImageUrls={sourceImageUrls}
              onSourceImageUrlsChange={setSourceImageUrls}
            />
            <div data-testid="housing-register-section-publish-stub" />
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
