import { useCallback } from 'react';
import { useHousingListingsStore } from '../../../../store/useHousingListingsStore';
import { useHousingUpdate } from '../../edit/useHousingUpdate';
import type { RegistrationDraft } from '../../../../utils/housingRegistrationTypes';
import type { HousingListing } from '../../../../types/housing';
import type { SnsCapture } from '../snsCapture';
import type { RegisterFields } from './useRegisterFields';
import { buildDraftImageFields } from './registerPageModel';

export function useRegisterEditMedia({ f, initialValues, buildDraft, updateListing }: { f: RegisterFields; initialValues?: HousingListing; buildDraft: () => RegistrationDraft; updateListing: ReturnType<typeof useHousingUpdate>['update'] }) {
  const { sourceImageUrls, setSourceImageUrls, setEditThumbnailPaths, editVideoPreview, setEditVideoPreview, setSnsCapture, postUrl, setPostUrl, sourcePostUrls, setSourcePostUrls } = f;

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
    [setEditThumbnailPaths, sourceImageUrls.length, editVideoPreview, setSourceImageUrls, setEditVideoPreview],
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
      // 2026-08-24 実機報告: HousingEditSourcePanel の captureRef はパネルのマウントごとに
      // 空へ戻るため、今回のセッションで代表の種別が一切変わっていない (= 空のcapture) まま
      // 写真だけ追加された場合、buildDraftImageFields は代表が無いとみなして imageMode='sns'
      // を組めず保存が無音でスキップされる。サーバーに youtubeVideoId が保存済みならそこから
      // 代表を復元してから渡す (HousingEditSourcePanel 側は videoPreview 経由でこの代表を
      // 横取りしないよう既にガード済み)。
      const isEmptyCapture = !capture.tweetData && !capture.youtube && !capture.ogp;
      const effectiveCapture: SnsCapture =
        isEmptyCapture && initialValues.youtubeVideoId
          ? {
              tweetData: null,
              tweetSource: null,
              ogp: null,
              youtube: {
                postUrl: initialValues.postUrl ?? '',
                ogImageUrl: initialValues.ogImageUrl ?? '',
                videoId: initialValues.youtubeVideoId,
                description: null,
              },
            }
          : capture;
      const freshImageFields = buildDraftImageFields(effectiveCapture, [], freshSourceImageUrls);
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
              source: 'tweet',
            }
          // 2026-08-24 実機報告: capture.youtube (このセッションで新規に確立したYouTube代表)
          // も同様にプレビューへ反映する。無いと保存自体は成功するのに画面上は再読み込み
          // するまでYouTube動画が「無い」ように見えてしまう。
          : capture.youtube
            ? { url: capture.youtube.postUrl, posterUrl: capture.youtube.ogImageUrl, source: 'youtube' }
            // 2026-07-22 (Batch2): 追加方式なので、今回のcaptureに動画が無くても既存のプレビューを
            // 消さない (貼り替えではないため「動画無し=削除」ではない)。
            : editVideoPreview,
      );
      if (!postUrl) setPostUrl(nextPostUrl);
      await useHousingListingsStore.getState().fetchAndUpsert(initialValues.id);
      return { ok: true };
    },
    [initialValues, buildDraft, sourcePostUrls, updateListing, setSnsCapture, setSourceImageUrls, setSourcePostUrls, setEditThumbnailPaths, setEditVideoPreview, editVideoPreview, postUrl, setPostUrl],
  );

  return { handleEditThumbnailPathsChange, commitEditSnsFetch };
}
