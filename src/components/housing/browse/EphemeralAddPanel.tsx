import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
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
import { getAreaName } from '../../../lib/housing/areaName';
import { HOUSING_AREAS, isValidHousingArea, type HousingArea } from '../../../types/housing';
import type { HousingSize } from '../../../store/useHousingFilterStore';
import { WARD_RANGE, PLOT_RANGE, APARTMENT_ROOM_RANGE } from '../../../constants/housing';

export interface EphemeralAddPanelProps {
  open: boolean;
  onClose: () => void;
  /** 追加成功時に一時 listing の id (`ephemeral-` prefix) を通知。トレイ側で trayIds へ積む。 */
  onAdd: (id: string) => void;
}

/** テキスト欄 parse の debounce (spec §4.1-2: 300ms 程度)。 */
const TEXT_PARSE_DEBOUNCE_MS = 300;

/** 手入力補完 + 解釈チップの元になるドラフト住所。 */
interface DraftAddress {
  area?: HousingArea;
  ward?: number;
  plot?: number;
  isApartment: boolean;
  apartmentBuilding: 1 | 2;
  roomNumber?: number;
  size?: HousingSize;
  dc?: string;
  server?: string;
}

/** parse がどの項目を確定させたか (チップ表示 / 欠け項目セレクトの出し分け)。 */
interface ParsedMask {
  area: boolean;
  ward: boolean;
  plot: boolean;
  apartment: boolean;
}

const EMPTY_DRAFT: DraftAddress = { isApartment: false, apartmentBuilding: 1 };
const EMPTY_MASK: ParsedMask = { area: false, ward: false, plot: false, apartment: false };

/** SNS 由来のメタデータ (登録リンク引き継ぎ + 代表画像)。テキスト直入力のときは null。 */
interface SnsSource {
  postUrl: string;
  ogImageUrl?: string;
  sourceImageUrls?: string[];
}

function rangeOptions(min: number, max: number): number[] {
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

/**
 * 「+ 住所から追加」パネル (計画: 住所登録なし一時ツアー Task3 / spec §4.1)。
 *
 * - 上段 URL 欄: `classifySnsUrl` で種別ルーティング (登録フォームと共用) →
 *   ツイートは本文を `parseHousingFromText`、OGP は `extractHousingAddressFromPage`。
 * - 下段 テキスト欄: 入力のたび debounce 300ms で `parseHousingFromText`。
 * - 解釈結果はチップ表示、**欠けている項目だけ**セレクトを出す (推測で埋めない)。
 * - 全項目充足で [ツアーに追加] 活性 → validate → create → store.add →
 *   `onAdd(id)` → 入力だけクリアしてパネルは開いたまま (連続追加)。
 */
export const EphemeralAddPanel: React.FC<EphemeralAddPanelProps> = ({ open, onClose, onAdd }) => {
  const { t, i18n } = useTranslation();

  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState<DraftAddress>(EMPTY_DRAFT);
  const [mask, setMask] = useState<ParsedMask>(EMPTY_MASK);
  const [parseError, setParseError] = useState(false);
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [added, setAdded] = useState(false);
  const [source, setSource] = useState<SnsSource | null>(null);

  const { status: tweetStatus, data: tweetData, fetchTweet, reset: resetTweet } = useTweetFetch();
  const { status: ogpStatus, data: ogpData, fetchOgp, reset: resetOgp } = useOgpFetch();

  // URL 由来の最後の解釈結果。テキスト欄が空に戻ったときの復元用。
  const lastUrlResultRef = useRef<HousingExtractResult | null>(null);
  // fetch 結果 1 つにつき 1 回だけ適用する (SnsUrlField と同じ dispatch ガード)。
  const dispatchedTweetRef = useRef<unknown>(null);
  const dispatchedOgpRef = useRef<unknown>(null);
  // fetch 完了時に postUrl を組むための最新 URL (effect から読む)。
  const urlRef = useRef('');
  const textTimerRef = useRef<number | null>(null);

  // unmount 時に debounce タイマーを残さない。
  useEffect(() => () => {
    if (textTimerRef.current !== null) window.clearTimeout(textTimerRef.current);
  }, []);

  /**
   * 解釈結果をドラフトへ適用する。
   * ambiguity > 0 または何も取れない → parse_error 表示 + ドラフト空 (推測で埋めない)。
   */
  const applyParse = useCallback((r: HousingExtractResult | null) => {
    setAdded(false);
    setLimitReached(false);
    if (!r) {
      setParseError(false);
      setDraft(EMPTY_DRAFT);
      setMask(EMPTY_MASK);
      return;
    }
    const gotSomething =
      r.area !== undefined || r.ward !== undefined || r.plot !== undefined || r.size !== undefined;
    if (r.ambiguity.length > 0 || !gotSomething) {
      setParseError(true);
      setDraft(EMPTY_DRAFT);
      setMask(EMPTY_MASK);
      return;
    }
    setParseError(false);
    const isApartment = r.size === 'Apartment';
    const area = r.area !== undefined && isValidHousingArea(r.area) ? r.area : undefined;
    setDraft({
      area,
      ward: r.ward,
      plot: isApartment ? undefined : r.plot,
      isApartment,
      apartmentBuilding: 1,
      roomNumber: undefined, // parse は部屋番号を返さない → 常に手入力補完
      size: r.size === 'S' || r.size === 'M' || r.size === 'L' ? r.size : undefined,
      dc: r.dc,
      server: r.server,
    });
    setMask({
      area: area !== undefined,
      ward: r.ward !== undefined,
      plot: !isApartment && r.plot !== undefined,
      apartment: isApartment,
    });
  }, []);

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
    lastUrlResultRef.current = result;
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
    lastUrlResultRef.current = result;
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
        lastUrlResultRef.current = null;
        break;
      case 'youtube':
        // YouTube に本文テキストは無い → 住所は取れない = 手入力へ誘導 (画像だけ引き継ぐ)。
        resetTweet();
        resetOgp();
        setSource({ postUrl: route.postUrl, ogImageUrl: route.ogImageUrl });
        lastUrlResultRef.current = null;
        setParseError(true);
        setDraft(EMPTY_DRAFT);
        setMask(EMPTY_MASK);
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

  const handleTextChange = (value: string) => {
    setText(value);
    setAdded(false);
    setLimitReached(false);
    if (textTimerRef.current !== null) window.clearTimeout(textTimerRef.current);
    textTimerRef.current = window.setTimeout(() => {
      textTimerRef.current = null;
      const trimmed = value.trim();
      if (!trimmed) {
        // テキストを消したら URL 由来の解釈に戻す (無ければ全クリア)。
        applyParse(lastUrlResultRef.current);
        return;
      }
      applyParse(parseHousingFromText(trimmed));
    }, TEXT_PARSE_DEBOUNCE_MS);
  };

  const setDraftField = (patch: Partial<DraftAddress>) => {
    setAdded(false);
    setLimitReached(false);
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const complete =
    draft.area !== undefined &&
    draft.ward !== undefined &&
    (draft.isApartment ? draft.roomNumber !== undefined : draft.plot !== undefined);

  const handleAdd = () => {
    if (!complete || draft.area === undefined || draft.ward === undefined) return;
    const input: EphemeralInput = {
      area: draft.area,
      ward: draft.ward,
      buildingType: draft.isApartment ? 'apartment' : 'house',
      plot: draft.isApartment ? undefined : draft.plot,
      size: draft.isApartment ? undefined : draft.size,
      apartmentBuilding: draft.isApartment ? draft.apartmentBuilding : undefined,
      roomNumber: draft.isApartment ? draft.roomNumber : undefined,
      postUrl: source?.postUrl,
      ogImageUrl: source?.ogImageUrl,
      sourceImageUrls: source?.sourceImageUrls,
      dc: draft.dc,
      server: draft.server,
    };
    const validation = validateEphemeralInput(input);
    if (!validation.ok) {
      // セレクトは範囲固定なので通常来ない (防御的ガード)。手入力へ誘導する。
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
    // 連続追加: 入力だけクリアしてパネルは開いたまま (spec §4.1-5)。
    setUrl('');
    urlRef.current = '';
    setText('');
    setDraft(EMPTY_DRAFT);
    setMask(EMPTY_MASK);
    setParseError(false);
    setUrlInvalid(false);
    setSource(null);
    lastUrlResultRef.current = null;
    resetTweet();
    resetOgp();
    setLimitReached(false);
    setAdded(true);
  };

  if (!open) return null;

  const fetching = tweetStatus === 'loading' || ogpStatus === 'loading';
  const fetchFailed = urlInvalid || tweetStatus === 'error' || ogpStatus === 'error';
  const hasChips = mask.area || mask.ward || mask.plot || mask.apartment;
  // 「番地 or アパート」項目が parse で確定していないときだけ切替を出す (欠けている項目だけ)。
  const showTypeToggle = !mask.plot && !mask.apartment;

  return (
    <div className="housing-ephemeral-panel">
      <div className="housing-ephemeral-head">
        <span className="housing-ephemeral-title">{t('housing.ephemeral.panel_title')}</span>
        <button
          type="button"
          className="housing-ephemeral-close"
          aria-label={t('common.close')}
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

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

      <div className="housing-ephemeral-field">
        <label htmlFor="housing-ephemeral-text" className="housing-label">
          {t('housing.ephemeral.text_label')}
        </label>
        <textarea
          id="housing-ephemeral-text"
          className="housing-textarea housing-ephemeral-text"
          rows={2}
          placeholder={t('housing.ephemeral.text_placeholder')}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
        />
      </div>

      {parseError && (
        <p className="housing-error-text">{t('housing.ephemeral.parse_error')}</p>
      )}

      {hasChips && (
        <div className="housing-ephemeral-chips">
          {mask.area && draft.area !== undefined && (
            <span className="housing-ephemeral-chip" data-testid="ephemeral-chip">
              {getAreaName(draft.area, i18n.language)}
            </span>
          )}
          {mask.ward && draft.ward !== undefined && (
            <span className="housing-ephemeral-chip" data-testid="ephemeral-chip">
              <span className="housing-ephemeral-chip-label">{t('housing.register.ward')}</span>
              {draft.ward}
            </span>
          )}
          {mask.plot && draft.plot !== undefined && (
            <span className="housing-ephemeral-chip" data-testid="ephemeral-chip">
              <span className="housing-ephemeral-chip-label">{t('housing.register.plot')}</span>
              {draft.plot}
            </span>
          )}
          {mask.apartment && (
            <span className="housing-ephemeral-chip" data-testid="ephemeral-chip">
              {t('housing.register.building_type.apartment')}
            </span>
          )}
        </div>
      )}

      <div className="housing-ephemeral-manual">
        {!mask.area && (
          <select
            className="housing-input"
            aria-label={t('housing.register.area')}
            value={draft.area ?? ''}
            onChange={(e) =>
              setDraftField({
                area: isValidHousingArea(e.target.value) ? e.target.value : undefined,
              })
            }
          >
            <option value="">{t('housing.register.area')}</option>
            {HOUSING_AREAS.map((area) => (
              <option key={area} value={area}>
                {getAreaName(area, i18n.language)}
              </option>
            ))}
          </select>
        )}
        {!mask.ward && (
          <select
            className="housing-input"
            aria-label={t('housing.register.ward')}
            value={draft.ward ?? ''}
            onChange={(e) =>
              setDraftField({ ward: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          >
            <option value="">{t('housing.register.ward')}</option>
            {rangeOptions(WARD_RANGE.min, WARD_RANGE.max).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}

        {showTypeToggle && (
          <div
            className="housing-ephemeral-type-toggle"
            role="group"
            aria-label={t('housing.register.building_type.label')}
          >
            <button
              type="button"
              className="housing-ephemeral-type-btn"
              aria-pressed={!draft.isApartment}
              onClick={() => setDraftField({ isApartment: false, roomNumber: undefined })}
            >
              {t('housing.register.building_type.house')}
            </button>
            <button
              type="button"
              className="housing-ephemeral-type-btn"
              aria-pressed={draft.isApartment}
              onClick={() => setDraftField({ isApartment: true, plot: undefined, size: undefined })}
            >
              {t('housing.register.building_type.apartment')}
            </button>
          </div>
        )}

        {!draft.isApartment && !mask.plot && (
          <select
            className="housing-input"
            aria-label={t('housing.register.plot')}
            value={draft.plot ?? ''}
            onChange={(e) =>
              setDraftField({ plot: e.target.value === '' ? undefined : Number(e.target.value) })
            }
          >
            <option value="">{t('housing.register.plot')}</option>
            {rangeOptions(PLOT_RANGE.min, PLOT_RANGE.max).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        )}

        {draft.isApartment && (
          <>
            <select
              className="housing-input"
              aria-label={t('housing.register.apartment_building.label')}
              value={draft.apartmentBuilding}
              onChange={(e) =>
                setDraftField({ apartmentBuilding: Number(e.target.value) === 2 ? 2 : 1 })
              }
            >
              <option value={1}>{t('housing.register.apartment_building.main')}</option>
              <option value={2}>{t('housing.register.apartment_building.sub')}</option>
            </select>
            <select
              className="housing-input"
              aria-label={t('housing.register.apartment_room')}
              value={draft.roomNumber ?? ''}
              onChange={(e) =>
                setDraftField({
                  roomNumber: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            >
              <option value="">{t('housing.register.apartment_room')}</option>
              {rangeOptions(APARTMENT_ROOM_RANGE.min, APARTMENT_ROOM_RANGE.max).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </>
        )}
      </div>

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
  );
};
