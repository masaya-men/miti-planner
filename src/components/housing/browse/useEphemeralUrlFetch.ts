import { useCallback, useEffect, useRef } from 'react';
import type { RegisterAddressValues } from '../register/RegisterSectionAddress';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import { classifySnsUrl } from '../../../lib/housing/snsUrlRouting';
import { useTweetFetch } from '../../../lib/housing/useTweetFetch';
import { useOgpFetch } from '../../../lib/housing/useOgpFetch';
import { useYoutubeFetch, type YoutubeMetaData } from '../../../lib/housing/useYoutubeFetch';
import { parseHousingFromText, type HousingExtractResult } from '../../../lib/housing/parseHousingFromText';
import { extractHousingAddressFromPage } from '../../../lib/housing/extractHousingAddressFromPage';
import { housingExtractResultToAddressPatch } from '../../../lib/housing/housingExtractResultToAddressPatch';
import type { Region } from '../../../data/housing/dcServerMap';
import { parseAllmarksShareUrl } from '../../../lib/housing/allmarksImport';
import type { useAllmarksImport } from '../../../lib/housing/useAllmarksImport';

/** SNS 由来のメタデータ (登録リンク引き継ぎ + 代表画像)。URL 未使用のときは null。 */
export interface SnsSource {
  postUrl: string;
  ogImageUrl?: string;
  sourceImageUrls?: string[];
}

interface UseEphemeralUrlFetchParams {
  fieldState: ReturnType<typeof useHousingFieldState>;
  allmarksImport: ReturnType<typeof useAllmarksImport>;
  trayRegion?: Region | null;
  onAdd: (id: string) => void;
  setUrl: React.Dispatch<React.SetStateAction<string>>;
  setAddress: React.Dispatch<React.SetStateAction<RegisterAddressValues>>;
  setParseError: React.Dispatch<React.SetStateAction<boolean>>;
  setUrlInvalid: React.Dispatch<React.SetStateAction<boolean>>;
  setLimitReached: React.Dispatch<React.SetStateAction<boolean>>;
  setAdded: React.Dispatch<React.SetStateAction<boolean>>;
  setSource: React.Dispatch<React.SetStateAction<SnsSource | null>>;
}

/**
 * EphemeralAddPanel の URL 欄まわり: ツイート/OGP/YouTube の取得と、取得結果の住所フォームへの自動入力、
 * URL 欄の入力ハンドラー (種別ルーティング・Allmarks インポート起動)。
 */
export function useEphemeralUrlFetch({
  fieldState, allmarksImport, trayRegion, onAdd,
  setUrl, setAddress, setParseError, setUrlInvalid, setLimitReached, setAdded, setSource,
}: UseEphemeralUrlFetchParams) {
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
  }, [fieldState, setAdded, setAddress, setLimitReached, setParseError]);

  // ツイート取得成功 → 本文 parse + 画像を ogImageUrl へ。
  useEffect(() => {
    if (tweetStatus !== 'success' || !tweetData) return;
    if (dispatchedTweetRef.current === tweetData) return;
    dispatchedTweetRef.current = tweetData;
    const photos = tweetData.photos ?? [];
    setSource({
      postUrl: urlRef.current.trim(),
      // 動画ツイートは photos が空 → 動画のサムネ画像をカード画像にする (RegisterPage と同じ扱い)
      ogImageUrl: photos[0] ?? tweetData.video?.posterUrl,
      sourceImageUrls: photos.length > 0 ? photos.slice(0, 10) : undefined,
    });
    const result = parseHousingFromText(tweetData.text);
    applyParse(result);
  }, [tweetStatus, tweetData, applyParse, setSource]);

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
  }, [ogpStatus, ogpData, applyParse, setSource]);

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
  }, [youtubeStatus, youtubeData, applyParse, setSource]);

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

  return {
    tweetStatus, ogpStatus, youtubeStatus,
    resetTweet, resetOgp, resetYoutube,
    urlRef, handleUrlChange,
  };
}
