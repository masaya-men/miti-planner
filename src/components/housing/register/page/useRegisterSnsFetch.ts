import { useCallback } from 'react';
import { showToast } from '../../../Toast';
import type { HousingExtractResult } from '../../../../lib/housing/parseHousingFromText';
import { extractHousingAddressFromPage } from '../../../../lib/housing/extractHousingAddressFromPage';
import type { TweetData } from '../../../../lib/housing/useTweetFetch';
import type { YoutubeFetchedData, OgpFetchedData } from '../HousingRegisterSnsUrlField';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../../../../lib/housing/multiSourceGuards';
import { mergeTweetPhotoAspectRatios } from '../snsCapture';
import type { RegisterFields } from './useRegisterFields';
import type { TFunction } from 'i18next';

export function useRegisterSnsFetch(f: RegisterFields, applyExtractedResult: (result: HousingExtractResult) => void, applyExtractedAddress: (text: string) => void, t: TFunction) {
  const { setAddressExtractFailed, setSourceImageUrls, snsCapture, setSnsCapture, setPostUrl, sourcePostUrls, setSourcePostUrls, setUrlSlotCount, capturedVideoRef } = f;

  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      if (source && isDuplicatePostUrl(sourcePostUrls, source.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      applyExtractedAddress(data.text);
      const photos = data.photos ?? [];
      // 2026-08-20 排他緩和: 代表が既に YouTube で確定していても、静止画は sourceImageUrls
      // に追加してよい (buildDraftImageFields の YouTube 分岐が sourceImageUrls も読むように
      // なったため、「受理したのに消える」事故は解消済み)。動画側の代表は YouTube のまま変えない。
      if (photos.length > 0) {
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
        // 最終レビュー指摘: URL クリアで住所抽出失敗バナーの原因も消えたので、バナーも消す。
        setAddressExtractFailed(false);
        return;
      }
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      applyExtractedAddress(data.description ?? '');
      // 2026-08-20 排他緩和: 静止画 (sourceImageUrls) が既にあっても YouTube は受理してよい
      // (YouTube動画 + Xの静止画の同居を許可)。動画同士 (capturedVideoRef.current) の競合だけ拒否する。
      // 既に Twitter が代表だった場合はここで YouTube に代表を差し替える (静止画は sourceImageUrls
      // に残るのでそのまま同居する)。
      if (capturedVideoRef.current) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      capturedVideoRef.current = true;
      setSnsCapture({ tweetData: null, tweetSource: null, youtube: data, ogp: null });
      setSourcePostUrls((prev) => [...prev, data.postUrl]);
      setPostUrl((prev) => prev || data.postUrl);
    },
    [applyExtractedAddress, sourcePostUrls, t],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) {
        // URL 欄クリア / 失敗 → OGP 捕捉と画像をクリア。
        setSnsCapture((prev) => (prev.ogp ? { ...prev, ogp: null } : prev));
        // 最終レビュー指摘: URL クリアで住所抽出失敗バナーの原因も消えたので、バナーも消す。
        setAddressExtractFailed(false);
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

  return { handleTweetFetched, handleYoutubeFetched, handleOgpFetched, handleAddUrlSlot, handleRemoveUrlSlot };
}
