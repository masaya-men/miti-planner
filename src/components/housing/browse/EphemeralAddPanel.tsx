import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { HousingPanelModal } from '../HousingPanelModal';
import { RegisterSectionAddress, type RegisterAddressValues } from '../register/RegisterSectionAddress';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { classifySnsUrl } from '../../../lib/housing/snsUrlRouting';
import { useTweetFetch } from '../../../lib/housing/useTweetFetch';
import { useOgpFetch } from '../../../lib/housing/useOgpFetch';
import { useYoutubeFetch, type YoutubeMetaData } from '../../../lib/housing/useYoutubeFetch';
import { parseHousingFromText, type HousingExtractResult } from '../../../lib/housing/parseHousingFromText';
import { extractHousingAddressFromPage } from '../../../lib/housing/extractHousingAddressFromPage';
import {
  validateEphemeralInput,
  createEphemeralListing,
  EPHEMERAL_POOL_LIMIT,
  type EphemeralInput,
} from '../../../lib/housing/ephemeralListing';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import type { HousingArea } from '../../../types/housing';
import { housingExtractResultToAddressPatch } from '../../../lib/housing/housingExtractResultToAddressPatch';
import { regionForDC, type Region } from '../../../data/housing/dcServerMap';
import { canAddToTour } from '../../../lib/housing/tourCrossing';
import { parseAllmarksShareUrl } from '../../../lib/housing/allmarksImport';
import { useAllmarksImport } from '../../../lib/housing/useAllmarksImport';
import { AllmarksImportProgress } from './AllmarksImportProgress';

export interface EphemeralAddPanelProps {
  open: boolean;
  onClose: () => void;
  /** 追加成功時に一時 listing の id (`ephemeral-` prefix) を通知。トレイ側で trayIds へ積む。 */
  onAdd: (id: string) => void;
  /**
   * 現在トレイに入っている家のリージョン (空トレイなら null/未指定)。
   * 指定時、別リージョンの DC を選んだ時点で注記を出し追加ボタンを無効化する
   * (跨ぎは不可能なため、住所を全部埋めさせてから弾く無駄入力を避ける・早期フィードバック)。
   */
  trayRegion?: Region | null;
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
 * - 上段 URL 欄: `classifySnsUrl` で種別ルーティング → ツイート本文/YouTube概要欄
 *   `parseHousingFromText` / OGP `extractHousingAddressFromPage`。取れた住所は下の
 *   構造化フォームへ自動入力 (🟡)。
 * - 住所は**登録ページと同じ** `RegisterSectionAddress` (variant='tour') = 全部クリックのセレクト
 *   + 数字だけ入力。DC/サーバーも持つ (DC を跨いだツアーは日常的なため。将来のワールド判定にも効く)。
 *   フリーテキスト欄は廃止 (決められた書式で入れてもらう方が誤爆しない・ユーザー確定 2026-07-12)。
 * - 全項目充足で [ツアーに追加] 活性 → validate → create → store.add → `onAdd(id)` →
 *   入力だけクリアしてモーダルは開いたまま (連続追加)。
 */
export const EphemeralAddPanel: React.FC<EphemeralAddPanelProps> = ({ open, onClose, onAdd, trayRegion }) => {
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

  // Allmarksまとめてインポート (2026-08-19)。URL欄にAllmarksの共有リンクが来たときだけ
  // このモードに切り替わり、通常の構造化フォームの代わりに進捗表示を出す。
  const allmarksImport = useAllmarksImport();
  const isAllmarksImporting = allmarksImport.progress.status !== 'idle';

  const { status: tweetStatus, data: tweetData, fetchTweet, reset: resetTweet } = useTweetFetch();
  const { status: ogpStatus, data: ogpData, fetchOgp, reset: resetOgp } = useOgpFetch();
  const { status: youtubeStatus, data: youtubeData, fetchYoutubeMeta, reset: resetYoutube } = useYoutubeFetch();

  // fetch 結果 1 つにつき 1 回だけ適用する (SnsUrlField と同じ dispatch ガード)。
  const dispatchedTweetRef = useRef<unknown>(null);
  const dispatchedOgpRef = useRef<unknown>(null);
  const dispatchedYoutubeRef = useRef<YoutubeMetaData | null>(null);
  // YouTube fetch 成功時に postUrl/ogImageUrl を組むための route (effect から読む)。
  const youtubeRouteRef = useRef<{ postUrl: string; ogImageUrl: string } | null>(null);
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
    const patch = housingExtractResultToAddressPatch(r);
    if (!patch) {
      setParseError(true);
      return;
    }
    setParseError(false);
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

  // YouTube 取得成功 → 概要欄テキストを parse (tweet/ogp と同じ applyParse 経路)。
  useEffect(() => {
    if (youtubeStatus !== 'success' || !youtubeData) return;
    if (dispatchedYoutubeRef.current === youtubeData) return;
    dispatchedYoutubeRef.current = youtubeData;
    const route = youtubeRouteRef.current;
    if (route) {
      setSource({ postUrl: route.postUrl, ogImageUrl: route.ogImageUrl });
    }
    const result = parseHousingFromText(youtubeData.description ?? '');
    applyParse(result);
  }, [youtubeStatus, youtubeData, applyParse]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    urlRef.current = value;
    setAdded(false);
    setLimitReached(false);
    setUrlInvalid(false);

    const allmarksShareId = parseAllmarksShareUrl(value);
    if (allmarksShareId) {
      resetTweet();
      resetOgp();
      resetYoutube();
      setSource(null);
      setParseError(false);
      void allmarksImport.start(allmarksShareId, trayRegion ?? null, onAdd);
      return;
    }

    const route = classifySnsUrl(value);
    switch (route.kind) {
      case 'empty':
        resetTweet();
        resetOgp();
        resetYoutube();
        setSource(null);
        setParseError(false);
        break;
      case 'youtube':
        resetTweet();
        resetOgp();
        youtubeRouteRef.current = { postUrl: route.postUrl, ogImageUrl: route.ogImageUrl };
        dispatchedYoutubeRef.current = null;
        fetchYoutubeMeta(route.videoId);
        break;
      case 'tweet':
        resetOgp();
        resetYoutube();
        dispatchedTweetRef.current = null;
        fetchTweet(route.tweetId);
        break;
      case 'ogp':
        resetTweet();
        resetYoutube();
        dispatchedOgpRef.current = null;
        fetchOgp(route.postUrl);
        break;
      case 'invalid':
        resetTweet();
        resetOgp();
        resetYoutube();
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

  const isHouse = address.buildingType === 'house';
  const isApartment = address.buildingType === 'apartment';
  // 建物タイプ未選択は追加不可 (RegisterSectionAddress の厳密化に合わせる。未選択では番地/部屋番号の
  // 欄自体が出ないため、個人宅かアパートを選ぶまで complete=false)。
  const complete =
    address.dc !== undefined &&
    address.dc !== '' &&
    address.server !== undefined &&
    address.server !== '' &&
    address.area !== undefined &&
    address.area !== '' &&
    address.ward !== undefined &&
    (isHouse ? address.plot !== undefined : isApartment ? address.roomNumber !== undefined : false);

  // 選んだ DC のリージョンがトレイと違えば、住所を埋め切る前でも早期に弾く (canAddToTour が唯一の判定源)。
  const candidateRegion = address.dc ? regionForDC(address.dc) : null;
  const crossRegionBlocked =
    trayRegion != null && candidateRegion != null && !canAddToTour(trayRegion, candidateRegion);

  // フォーム送信(Enter/クリック双方が経由)。追加ボタンは type="submit" にして委譲する
  // ため、複合フォーム(URL欄・番地欄など)のどこで Enter を押しても反応する。ボタンが
  // disabled(=complete でない)間はブラウザが implicit submission を発火させないので、
  // ここでの complete チェックは handleAdd 側の既存ガードに任せて重複させない。
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAdd();
  };

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
    resetYoutube();
    setLimitReached(false);
    setAdded(true);
  };

  const fetching = tweetStatus === 'loading' || ogpStatus === 'loading' || youtubeStatus === 'loading';
  const fetchFailed = urlInvalid || tweetStatus === 'error' || ogpStatus === 'error';

  // Allmarksインポートの「やめる」/「閉じる」。通常の追加パネルへ戻る(ここまで追加済みの
  // 分は一時ツアーに残る。取り消さない)。
  const handleAllmarksClose = () => {
    allmarksImport.cancel();
    setUrl('');
    urlRef.current = '';
  };

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
      <form className="housing-ephemeral-panel" onSubmit={handleSubmit}>
        {/* 使い捨て挙動の説明は最上部で最初に読ませる (下部だと見落とすため・ユーザー要望 2026-07-13)。 */}
        <p className="housing-ephemeral-note housing-ephemeral-note-lead">
          {t('housing.ephemeral.note_volatile')}
        </p>

        {isAllmarksImporting ? (
          <AllmarksImportProgress progress={allmarksImport.progress} onClose={handleAllmarksClose} />
        ) : (
          <>
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
                        : youtubeStatus === 'loading'
                          ? 'housing.register.snsUrl.youtube_fetching'
                          : 'housing.register.snsUrl.ogp_fetching',
                    )}
                  </span>
                </div>
              )}
              {fetchFailed && (
                <p className="housing-error-text">{t('housing.ephemeral.fetch_error')}</p>
              )}
            </div>

            {/* Allmarksまとめてインポートの導線 (2026-08-19)。この機能自体を知らない人向けの
                控えめな案内 (発見の主経路はDiscordアップデート告知)。別タブで開き、
                作成中のツアーからは離脱させない。 */}
            <p className="housing-ephemeral-note">
              <Trans
                i18nKey="housing.ephemeral.allmarks_hint"
                components={{
                  lnk: <a href="https://allmarks.app" target="_blank" rel="noopener noreferrer" />,
                }}
              />
            </p>

            {parseError && (
              <p className="housing-error-text">{t('housing.ephemeral.parse_error')}</p>
            )}

            {/* 住所は登録ページと同じ構造化フォーム (variant='tour' で登録固有部を隠す)。 */}
            <RegisterSectionAddress
              variant="tour"
              fieldState={fieldState}
              values={address}
              onChange={handleAddressChange}
              crossRegionNotice={crossRegionBlocked ? t('housing.tour.region_block') : null}
            />

            {limitReached && (
              <p className="housing-error-text">
                {t('housing.ephemeral.limit_note', { max: EPHEMERAL_POOL_LIMIT })}
              </p>
            )}
            {added && <p className="housing-ephemeral-added">{t('housing.ephemeral.added')}</p>}

            {/* スクロールしても押せる位置に留まるよう、ボタンだけ最下部に固定する
                (実機フィードバック: 住所が埋まるとボタンがスクロール外に出て押しにくかった)。 */}
            <div className="housing-ephemeral-footer">
              <button
                type="submit"
                className="housing-ephemeral-add"
                disabled={!complete || crossRegionBlocked}
              >
                {t('housing.ephemeral.add')}
              </button>
            </div>
          </>
        )}
      </form>
    </HousingPanelModal>
  );
};
