import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingPanelModal } from '../HousingPanelModal';
import { RegisterSectionAddress, type RegisterAddressValues } from '../register/RegisterSectionAddress';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { classifySnsUrl } from '../../../lib/housing/snsUrlRouting';
import { useTweetFetch } from '../../../lib/housing/useTweetFetch';
import { useOgpFetch } from '../../../lib/housing/useOgpFetch';
import { parseHousingFromText, type HousingExtractResult } from '../../../lib/housing/parseHousingFromText';
import { extractHousingAddressFromPage } from '../../../lib/housing/extractHousingAddressFromPage';
import {
  validateEphemeralInput,
  createEphemeralListing,
  EPHEMERAL_POOL_LIMIT,
  type EphemeralInput,
} from '../../../lib/housing/ephemeralListing';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import { isValidHousingArea, type HousingArea } from '../../../types/housing';

export interface EphemeralAddPanelProps {
  open: boolean;
  onClose: () => void;
  /** 追加成功時に一時 listing の id (`ephemeral-` prefix) を通知。トレイ側で trayIds へ積む。 */
  onAdd: (id: string) => void;
}

/** SNS 由来のメタデータ (登録リンク引き継ぎ + 代表画像)。URL 未使用のときは null。 */
interface SnsSource {
  postUrl: string;
  ogImageUrl?: string;
  sourceImageUrls?: string[];
}

/**
 * 「+ 住所から追加」モーダル (住所登録なし一時ツアー・spec §4.1 / 2026-07-12 フル構造化)。
 *
 * - 上段 URL 欄: `classifySnsUrl` で種別ルーティング → ツイート本文 `parseHousingFromText` /
 *   OGP `extractHousingAddressFromPage`。取れた住所は下の構造化フォームへ自動入力 (🟡)。
 * - 住所は**登録ページと同じ** `RegisterSectionAddress` (variant='tour') = 全部クリックのセレクト
 *   + 数字だけ入力。DC/サーバーも持つ (DC を跨いだツアーは日常的なため。将来のワールド判定にも効く)。
 *   フリーテキスト欄は廃止 (決められた書式で入れてもらう方が誤爆しない・ユーザー確定 2026-07-12)。
 * - 全項目充足で [ツアーに追加] 活性 → validate → create → store.add → `onAdd(id)` →
 *   入力だけクリアしてモーダルは開いたまま (連続追加)。
 */
export const EphemeralAddPanel: React.FC<EphemeralAddPanelProps> = ({ open, onClose, onAdd }) => {
  const { t } = useTranslation();

  const [url, setUrl] = useState('');
  const [address, setAddress] = useState<RegisterAddressValues>({});
  const [parseError, setParseError] = useState(false);
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [added, setAdded] = useState(false);
  const [source, setSource] = useState<SnsSource | null>(null);

  // RegisterSectionAddress が要求する fieldState (自動入力 🟡 バッジ + onChange 契約)。
  const fieldState = useHousingFieldState();

  const { status: tweetStatus, data: tweetData, fetchTweet, reset: resetTweet } = useTweetFetch();
  const { status: ogpStatus, data: ogpData, fetchOgp, reset: resetOgp } = useOgpFetch();

  // fetch 結果 1 つにつき 1 回だけ適用する (SnsUrlField と同じ dispatch ガード)。
  const dispatchedTweetRef = useRef<unknown>(null);
  const dispatchedOgpRef = useRef<unknown>(null);
  // fetch 完了時に postUrl を組むための最新 URL (effect から読む)。
  const urlRef = useRef('');

  /**
   * 解釈結果を構造化フォームへ自動入力する (取れた項目だけ setAutoFilled = 🟡)。
   * ambiguity>0 または何も取れない → parse_error 表示 (下のフォームで手選択に誘導・推測で埋めない)。
   * 既にフォームに入っている他の項目は消さない (URL は補助・手選択が主)。
   */
  const applyParse = useCallback((r: HousingExtractResult | null) => {
    setAdded(false);
    setLimitReached(false);
    if (!r) {
      setParseError(false);
      return;
    }
    const gotSomething =
      r.area !== undefined || r.ward !== undefined || r.plot !== undefined || r.size !== undefined;
    if (r.ambiguity.length > 0 || !gotSomething) {
      setParseError(true);
      return;
    }
    setParseError(false);
    const isApartment = r.size === 'Apartment';
    const patch: RegisterAddressValues = {};
    if (r.area !== undefined && isValidHousingArea(r.area)) patch.area = r.area;
    if (r.ward !== undefined) patch.ward = r.ward;
    if (r.dc !== undefined) patch.dc = r.dc;
    if (r.server !== undefined) patch.server = r.server;
    if (isApartment) {
      patch.buildingType = 'apartment';
      patch.apartmentBuilding = 1;
      patch.roomKind = 'apartment_room';
    } else {
      patch.buildingType = 'house';
      if (r.plot !== undefined) patch.plot = r.plot;
      if (r.size === 'S' || r.size === 'M' || r.size === 'L') patch.size = r.size;
    }
    setAddress((prev) => ({ ...prev, ...patch }));
    for (const [name, value] of Object.entries(patch)) fieldState.setAutoFilled(name, value);
  }, [fieldState]);

  // ツイート取得成功 → 本文 parse + 画像を ogImageUrl へ。
  useEffect(() => {
    if (tweetStatus !== 'success' || !tweetData) return;
    if (dispatchedTweetRef.current === tweetData) return;
    dispatchedTweetRef.current = tweetData;
    const photos = tweetData.photos ?? [];
    setSource({
      postUrl: urlRef.current.trim(),
      ogImageUrl: photos[0],
      sourceImageUrls: photos.length > 0 ? photos.slice(0, 10) : undefined,
    });
    const result = parseHousingFromText(tweetData.text);
    applyParse(result);
  }, [tweetStatus, tweetData, applyParse]);

  // OGP 取得成功 → ページ内の複数テキストから最も住所らしい候補を採用。
  useEffect(() => {
    if (ogpStatus !== 'success' || !ogpData) return;
    if (dispatchedOgpRef.current === ogpData) return;
    dispatchedOgpRef.current = ogpData;
    const images = ogpData.images ?? [];
    const ogImageUrl = ogpData.image ?? images[0];
    setSource({
      postUrl: urlRef.current.trim(),
      ogImageUrl: ogImageUrl ?? undefined,
      sourceImageUrls:
        images.length > 0 ? images.slice(0, 10) : ogImageUrl ? [ogImageUrl] : undefined,
    });
    const result = extractHousingAddressFromPage({
      title: ogpData.title,
      description: ogpData.description,
      bodyText: ogpData.text,
    });
    applyParse(result);
  }, [ogpStatus, ogpData, applyParse]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    urlRef.current = value;
    setAdded(false);
    setLimitReached(false);
    setUrlInvalid(false);
    const route = classifySnsUrl(value);
    switch (route.kind) {
      case 'empty':
        resetTweet();
        resetOgp();
        setSource(null);
        setParseError(false);
        break;
      case 'youtube':
        // YouTube に本文テキストは無い → 住所は取れない = 手選択へ誘導 (画像だけ引き継ぐ)。
        resetTweet();
        resetOgp();
        setSource({ postUrl: route.postUrl, ogImageUrl: route.ogImageUrl });
        setParseError(true);
        break;
      case 'tweet':
        resetOgp();
        dispatchedTweetRef.current = null;
        fetchTweet(route.tweetId);
        break;
      case 'ogp':
        resetTweet();
        dispatchedOgpRef.current = null;
        fetchOgp(route.postUrl);
        break;
      case 'invalid':
        resetTweet();
        resetOgp();
        setSource(null);
        setUrlInvalid(true);
        break;
    }
  };

  // RegisterSectionAddress からの各フィールド変更 (登録ページの handleAddressChange と同型)。
  const handleAddressChange = (name: string, value: unknown) => {
    setAdded(false);
    setLimitReached(false);
    setAddress((prev) => ({ ...prev, [name]: value }));
    fieldState.userEdit(name, value);
  };

  const isApartment = address.buildingType === 'apartment';
  const complete =
    address.dc !== undefined &&
    address.dc !== '' &&
    address.server !== undefined &&
    address.server !== '' &&
    address.area !== undefined &&
    address.area !== '' &&
    address.ward !== undefined &&
    (isApartment ? address.roomNumber !== undefined : address.plot !== undefined);

  const handleAdd = () => {
    if (!complete || address.area === undefined || address.ward === undefined) return;
    const input: EphemeralInput = {
      area: address.area as HousingArea,
      ward: address.ward,
      buildingType: isApartment ? 'apartment' : 'house',
      plot: isApartment ? undefined : address.plot,
      // ツアーは区画へ行くので個室区分は持たない。size は house 任意 (表示/並べ替え補助)。
      size:
        !isApartment && (address.size === 'S' || address.size === 'M' || address.size === 'L')
          ? address.size
          : undefined,
      apartmentBuilding: isApartment ? (address.apartmentBuilding ?? 1) : undefined,
      roomNumber: isApartment ? address.roomNumber : undefined,
      postUrl: source?.postUrl,
      ogImageUrl: source?.ogImageUrl,
      sourceImageUrls: source?.sourceImageUrls,
      dc: address.dc,
      server: address.server,
    };
    const validation = validateEphemeralInput(input);
    if (!validation.ok) {
      // セレクトは範囲固定なので通常来ない (防御的ガード)。
      setParseError(true);
      return;
    }
    const listing = createEphemeralListing(input);
    const accepted = useEphemeralListingsStore.getState().add(listing);
    if (!accepted) {
      setLimitReached(true);
      return;
    }
    onAdd(listing.id);
    // 連続追加: 入力だけクリアしてモーダルは開いたまま (spec §4.1-5)。
    setUrl('');
    urlRef.current = '';
    setAddress({});
    fieldState.reset();
    setParseError(false);
    setUrlInvalid(false);
    setSource(null);
    resetTweet();
    resetOgp();
    setLimitReached(false);
    setAdded(true);
  };

  const fetching = tweetStatus === 'loading' || ogpStatus === 'loading';
  const fetchFailed = urlInvalid || tweetStatus === 'error' || ogpStatus === 'error';

  // モーダル化 (2026-07-12): 右カラムのトレイに直置きすると固定高さ+overflow:hidden で
  // お気に入りと重なりスクロールできなかった (実機バグ)。HousingPanelModal は body 直下へ
  // portal し独自にスクロールするので、連続追加しても崩れない。ヘッダー(閉じる含む)はモーダル側。
  return (
    <HousingPanelModal
      open={open}
      onClose={onClose}
      title={t('housing.ephemeral.panel_title')}
      closeLabel={t('common.close')}
      maxWidth={480}
      backdrop="frost"
    >
      <div className="housing-ephemeral-panel">
        <div className="housing-ephemeral-field">
          <label htmlFor="housing-ephemeral-url" className="housing-label">
            {t('housing.ephemeral.url_label')}
          </label>
          <input
            id="housing-ephemeral-url"
            type="url"
            className="housing-input"
            autoComplete="off"
            placeholder={t('housing.ephemeral.url_placeholder')}
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
          {fetching && (
            <div className="housing-fetch-indicator">
              <span className="housing-spinner" aria-hidden />
              <span>
                {t(
                  tweetStatus === 'loading'
                    ? 'housing.register.snsUrl.fetching'
                    : 'housing.register.snsUrl.ogp_fetching',
                )}
              </span>
            </div>
          )}
          {fetchFailed && (
            <p className="housing-error-text">{t('housing.ephemeral.fetch_error')}</p>
          )}
        </div>

        {parseError && (
          <p className="housing-error-text">{t('housing.ephemeral.parse_error')}</p>
        )}

        {/* 住所は登録ページと同じ構造化フォーム (variant='tour' で登録固有部を隠す)。 */}
        <RegisterSectionAddress
          variant="tour"
          fieldState={fieldState}
          values={address}
          onChange={handleAddressChange}
        />

        {limitReached && (
          <p className="housing-error-text">
            {t('housing.ephemeral.limit_note', { max: EPHEMERAL_POOL_LIMIT })}
          </p>
        )}
        {added && <p className="housing-ephemeral-added">{t('housing.ephemeral.added')}</p>}

        <button
          type="button"
          className="housing-ephemeral-add"
          disabled={!complete}
          onClick={handleAdd}
        >
          {t('housing.ephemeral.add')}
        </button>

        <p className="housing-ephemeral-note">{t('housing.ephemeral.note_volatile')}</p>
      </div>
    </HousingPanelModal>
  );
};
