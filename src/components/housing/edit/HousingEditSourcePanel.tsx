import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingEditImageGrid } from './HousingEditImageGrid';
import type { YoutubeFetchedData, OgpFetchedData } from '../register/HousingRegisterSnsUrlField';
import { HousingRegisterMultiUrlField } from '../register/HousingRegisterMultiUrlField';
import { deleteListingSourceImage, reorderListingSourceImages } from '../../../lib/housingApiClient';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import { EMPTY_SNS_CAPTURE, mergeTweetPhotoAspectRatios, type SnsCapture } from '../pages/RegisterPage';
import { isDuplicatePostUrl, shouldRejectIncomingVideo } from '../../../lib/housing/multiSourceGuards';
import { showToast } from '../../Toast';

export interface EditVideoPreview {
  url: string;
  posterUrl: string;
  aspectRatio?: number;
}

/**
 * videoPreview (サーバー保存済み動画のプレビュー情報。cross-session-aware) を
 * TweetData['video'] (TweetVideoPayload) 互換の形へ変換する。videoPreview が null なら null。
 *
 * 最終レビュー Bug5 fix (2026-07-22): handleTweetFetched で「今回動画を新規に採用しない
 * (adoptsVideo=false) かつセッション内に動画をまだ捕捉していない (capture.tweetData?.video
 * が無い)」場合、これまでは無条件で null を組んでいた。captureRef はこのコンポーネントの
 * マウントのたびに EMPTY_SNS_CAPTURE へ戻る (HousingEditMediaSection のタブ切替でも
 * remount される) ため、サーバーに保存済みの動画付きTwitter代表へ「写真のみのツイート」を
 * 追記すると、videoPreview prop (真の保存状態) が動画ありを示しているにもかかわらず
 * null が commit され、api/housing/_updateListingHandler.ts の SNS_SUBFIELDS クリーンアップが
 * 保存済み動画をトーストも無くサイレントに消していた。videoPreview から動画情報を
 * 復元して null の代わりに使うことでこの消失を防ぐ。
 */
function videoPreviewToTweetVideo(preview: EditVideoPreview | null): TweetData['video'] {
  if (!preview) return null;
  return { url: preview.url, posterUrl: preview.posterUrl, aspectRatio: preview.aspectRatio ?? null };
}

export interface HousingEditSourcePanelProps {
  listingId: string;
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: EditVideoPreview | null;
  /** 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧 (重複検出に使う)。 */
  sourcePostUrls: string[];
  onCommitSnsFetch: (
    capture: SnsCapture,
    freshSourceImageUrls: string[],
    nextPostUrl: string,
  ) => Promise<{ ok: boolean; skipped?: boolean }>;
}

/**
 * 編集ページのURL経由側パネル (Plan B・2026-07-21 → Batch2・2026-07-22 で「貼り替え=全差し替え」
 * から「追加 (既存+新規の累積)」へ統一)。
 *
 * RegisterPage.tsx の handleTweetFetched/handleYoutubeFetched/handleOgpFetched (Task6/7 で複数URL
 * 集約バグを潰した「実戦済み」実装) と全く同じマージアルゴリズムを、編集ページの
 * 「1回の貼付けごとに即座に commit する」アーキテクチャに合わせて局所的に再現する。
 *
 * captureRef (代表の種別・識別情報) だけをこのコンポーネント内に保持し、写真配列そのもの
 * (tweetData.photos として送る内容) は毎回 **必ず現在の sourceImageUrls prop から組み直す**
 * (キャッシュしない)。理由: HousingEditImageGrid 経由の削除/並び替えは commit を経由せず
 * deleteListingSourceImage/reorderListingSourceImages を直接呼ぶため、もし過去の commit で
 * 送った写真配列をここでキャッシュしてしまうと、削除済みの画像が次の URL 貼付けで
 * 「復活」してしまう (sourceImageUrls prop が唯一の正)。
 *
 * サーバーに既に保存済みの代表種別 (このパネルを開く前) はここからは判別できないため、
 * captureRef による代表種別トラッキングは「このセッション内で複数の異なる種類のURLを
 * 貼った場合の競合検出」にのみ使う。この境界を越える組み合わせ (例: 編集を開く前から
 * OGP 由来の画像が保存されており、開いた直後に動画付きツイートを貼る) はサーバー側
 * validateImage が invalid_url で明示的に (サイレントではなく) 拒否する。
 *
 * 例外: 動画 (videoPreview) だけは cross-session-aware な prop として渡ってくるため、
 * handleTweetFetched は videoPreviewToTweetVideo 経由でこれを見て保存済み動画の消失を防ぐ
 * (Bug5 fix)。一方で「代表の識別情報 (tweetId/postUrl) の re-keying」は既知の受容済み限界
 * として残っている — 詳細は handleTweetFetched 内の該当コメントを参照。
 */
export function HousingEditSourcePanel({
  listingId,
  sourceImageUrls,
  onSourceImageUrlsChange,
  videoPreview,
  sourcePostUrls,
  onCommitSnsFetch,
}: HousingEditSourcePanelProps) {
  const { t } = useTranslation();
  const [committing, setCommitting] = useState(false);
  const [urlSlotCount, setUrlSlotCount] = useState(1);

  const captureRef = useRef<SnsCapture>(EMPTY_SNS_CAPTURE);
  /** 動画を確定済みか (videoPreview prop の非同期更新を待たずに同期判定するための補助)。 */
  const capturedVideoRef = useRef(false);

  const commit = useCallback(
    async (nextCapture: SnsCapture, freshUrls: string[], nextPostUrl: string) => {
      setCommitting(true);
      try {
        const result = await onCommitSnsFetch(nextCapture, freshUrls, nextPostUrl);
        if (!result.ok) {
          showToast(t('housing.register.editMedia.save_failed'), 'error');
        } else {
          captureRef.current = nextCapture;
        }
      } catch {
        showToast(t('housing.register.editMedia.save_failed'), 'error');
      } finally {
        setCommitting(false);
      }
    },
    [onCommitSnsFetch, t],
  );

  const handleTweetFetched = useCallback(
    (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
      if (!source) return;
      if (isDuplicatePostUrl(sourcePostUrls, source.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      const capture = captureRef.current;
      const photos = data.photos ?? [];

      // 代表が既に YouTube (このセッション内) の場合、静止画は conflict_sources 制約により
      // 追加できない (buildDraftImageFields の YouTube 分岐は写真を一切見ないため、受理すると
      // 保存時に消える)。
      const representativeIsYoutube = !!capture.youtube;
      if (representativeIsYoutube && photos.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }

      const incomingHasVideo = !!data.video?.url;
      const hasRepresentative = !!(capture.tweetData || capture.youtube || capture.ogp);
      const representativeCanHostVideo = !hasRepresentative || !!capture.tweetData;
      const existingVideoLimit = shouldRejectIncomingVideo(
        capturedVideoRef.current || !!videoPreview,
        incomingHasVideo,
      );
      // 代表が YouTube/OGP (tweetData を持たない) で確定していて、この動画を添付する tweetData
      // が存在しない場合は「受理したのに保存先が無く消える」事故になるため拒否する
      // (RegisterPage.tsx handleTweetFetched の orphanVideo と同型)。
      const orphanVideo = incomingHasVideo && !existingVideoLimit && !representativeCanHostVideo;
      const rejectVideo = existingVideoLimit || orphanVideo;
      if (rejectVideo) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
      }

      const freshSourceImageUrls = photos.length > 0 ? [...sourceImageUrls, ...photos] : sourceImageUrls;
      const adoptsVideo = !rejectVideo && incomingHasVideo && !capture.tweetData?.video;
      const becomesTwitterRepresentative =
        !!capture.tweetData || (!hasRepresentative && (photos.length > 0 || adoptsVideo));

      if (!becomesTwitterRepresentative) {
        // テキストのみのツイート (代表未確立・写真も動画も無し)、または代表が既に
        // YouTube/OGP で確定していて今回の Twitter 由来の写真/動画がどちらも対象外だった
        // 場合は、代表の識別情報を変更しない。何も変化がないなら commit 自体もスキップする。
        if (freshSourceImageUrls === sourceImageUrls) return;
        commit(capture, freshSourceImageUrls, source.postUrl);
        return;
      }

      // Twitter 代表として持つ写真は「常に現在のギャラリー (sourceImageUrls, 手動削除/並び替え
      // 済みの最新state) + 今回の追記分」から組む (capture 側に古い photos 配列をキャッシュ
      // しないことで、削除/並び替え後に再度貼っても削除済み画像が復活しない)。代表の
      // tweetSource (postUrl/tweetId) は最初に確立したURLのものを維持する (RegisterPage.tsx と
      // 同じ「代表は最初の1件が正」の設計)。
      //
      // 【既知の受容済み限界 (最終レビュー指摘・representative-identity issue)】
      // captureRef はマウントのたび (= HousingEditMediaSection のタブ切替のたび) に
      // EMPTY_SNS_CAPTURE へ戻るため、capture.tweetData が null の状態でこの分岐に来る
      // ケース (= このセッションで初めて Twitter 代表を確立するケース) では、
      // tweetSource は常に「今回貼った URL (source)」になる。もし保存済みの真の代表が
      // 「別のツイート」だった場合 (例: 動画付きツイート A が保存済みの状態で、写真のみの
      // 別ツイート B を追記すると B の tweetId/postUrl が代表として上書きされる)、
      // liveness 監視 cron の監視対象が意図せず A→B に変わってしまう可能性がある
      // (postUrl は sourcePostUrls に累積されるためデータ自体は消えない = data-loss ではない)。
      // これを完全に直すには、edit を開く前の「真の代表」の tweetId/postUrl を
      // RegisterPage.tsx (initialValues) から新規 prop として本コンポーネントまで通し、
      // captureRef をマウント時に再構築する必要がある。調査の結果、その再構築は
      // capture.tweetData の truthiness を「このセッションで何か確立済みか」の判定に
      // 使っている複数箇所 (handleOgpFetched の photo_source_conflict 判定、本関数の
      // 「何も変わらなければ commit をスキップする」ガード等) の前提を変えてしまい、
      // 例えば「代表確立済み」を装うことで無関係なテキストのみのツイートを貼っただけでも
      // 誤って commit ・ sourcePostUrls に追記されてしまう副作用が生じることを確認した。
      // 直下の video 消失バグ (data-loss) と違い本件は「監視対象のズレ」に留まるため、
      // 今回はこの副作用を避けて video 消失のみを修正し、本件は文書化された既知の限界として
      // 残す (2026-07-22)。
      //
      // videoPreview の有無から動画情報を復元することで、動画自体はこの限界の影響を受けない
      // (video の消失は data-loss のため上記とは切り離して修正済み)。
      // photoAspectRatios の「既存」側は capture.tweetData?.photoAspectRatios (このセッションで
      // 直前に確立済みの比率) を渡す。ここを undefined 固定にすると、同一セッション内で2本目の
      // ツイートURLを貼った瞬間に1本目の比率が消え、1本目の画像だけ aspect ratio 情報を失う
      // (Bug2 fix・2026-07-22 レビュー指摘・RegisterPage.tsx handleTweetFetched の
      // prev.tweetData.photoAspectRatios 渡しと同型)。
      const nextCapture: SnsCapture = {
        tweetData: {
          ...data,
          photos: freshSourceImageUrls,
          photoAspectRatios: mergeTweetPhotoAspectRatios(
            capture.tweetData?.photoAspectRatios,
            sourceImageUrls.length,
            data.photoAspectRatios,
            photos.length,
          ),
          // Bug5 fix (最終レビュー指摘): capture.tweetData?.video (このセッションで直前に
          // 捕捉済みの動画) が無く、かつ今回動画を新規採用しない (adoptsVideo=false) 場合、
          // 以前は無条件で null を組んでいた。videoPreview (サーバー保存済みの真の状態) が
          // 動画ありを示しているならそれを復元して null にしない = 保存済み動画を破壊しない。
          video: capture.tweetData?.video ?? (adoptsVideo ? data.video : videoPreviewToTweetVideo(videoPreview)),
        },
        tweetSource: capture.tweetData ? capture.tweetSource! : source,
        youtube: null,
        ogp: null,
      };
      if (incomingHasVideo && !rejectVideo) capturedVideoRef.current = true;
      commit(nextCapture, freshSourceImageUrls, source.postUrl);
    },
    [commit, sourceImageUrls, sourcePostUrls, videoPreview, t],
  );

  const handleYoutubeFetched = useCallback(
    (data: YoutubeFetchedData | null) => {
      if (!data) return;
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      // YouTube は静止画・動画のどちらとも排他 (conflict_sources 制約)。既に何か捕捉済み
      // (このセッション内の動画/写真、または編集を開く前からの既存データ) ならこの
      // YouTube URL は追加不可として拒否する。
      if (capturedVideoRef.current || !!videoPreview || sourceImageUrls.length > 0) {
        showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
        return;
      }
      capturedVideoRef.current = true;
      commit({ tweetData: null, tweetSource: null, youtube: data, ogp: null }, [], data.postUrl);
    },
    [commit, sourceImageUrls.length, sourcePostUrls, videoPreview, t],
  );

  const handleOgpFetched = useCallback(
    (data: OgpFetchedData | null) => {
      if (!data) return;
      if (isDuplicatePostUrl(sourcePostUrls, data.postUrl)) {
        showToast(t('housing.register.snsUrl.error.duplicate_url'), 'error');
        return;
      }
      const capture = captureRef.current;
      const images =
        data.data.images && data.data.images.length > 0
          ? data.data.images
          : data.data.image
            ? [data.data.image]
            : [];
      // 代表が Twitter (tweetData) の場合、OGP 画像 (任意ホスト) を混ぜると tweetId 併用時の
      // pbs.twimg.com host 制約 (housingValidation.ts:413) に抵触し登録全体が失敗するため拒否
      // する。代表が YouTube の場合も画像は一切追加できない (conflict_sources)。
      // どちらも「受理したのに保存先が無く消える」事故を避けるため、マージせず拒否する
      // (RegisterPage.tsx handleOgpFetched と同型)。
      //
      // 上記の capture.tweetData/capture.youtube チェックは「このセッション内で確立した代表」
      // にしか効かない (captureRef はコンポーネントの mount ごとに EMPTY_SNS_CAPTURE へ戻る)。
      // HousingEditMediaSection のタブ切替でこのパネルは同一の編集セッション内でも
      // unmount/remount されるため、動画付き Twitter 代表が編集を開く前から保存済みでも
      // capture 側からはそれを検出できない。videoPreview prop はサーバーの保存状態を
      // 反映する cross-session-aware な値なので、handleYoutubeFetched と同じガード
      // (capturedVideoRef.current || !!videoPreview) をここにも入れて、代表が動画を持つ
      // 場合は OGP 画像を無条件で拒否する。これが無いと、動画フィールド
      // (tweetId/videoUrl/videoPosterUrl/videoAspectRatio) を持たない OGP 形の payload が
      // commit され、api/housing/_updateListingHandler.ts の SNS_SUBFIELDS クリーンアップが
      // それらのフィールドを FieldValue.delete() し、保存済みの動画がトーストも無く
      // サイレントに消える (Bug1 fix・2026-07-22 レビュー指摘)。
      if (images.length > 0) {
        if (capturedVideoRef.current || !!videoPreview) {
          showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
          return;
        }
        if (capture.tweetData) {
          showToast(t('housing.register.snsUrl.error.photo_source_conflict'), 'error');
          return;
        }
        if (capture.youtube) {
          showToast(t('housing.register.snsUrl.error.video_limit'), 'error');
          return;
        }
      }
      const freshSourceImageUrls = images.length > 0 ? [...sourceImageUrls, ...images] : sourceImageUrls;
      // 代表が既に OGP で確定している場合は識別情報 (postUrl/ogImageUrl) を最初の1件のまま
      // 維持し、新規に画像を持たない OGP ページを代表として誤って確立しない
      // (postUrl の誤帰属を避ける)。
      const nextCapture: SnsCapture =
        images.length > 0 && !capture.ogp
          ? { tweetData: null, tweetSource: null, youtube: null, ogp: data }
          : capture;
      if (nextCapture === capture && freshSourceImageUrls === sourceImageUrls) return;
      commit(nextCapture, freshSourceImageUrls, data.postUrl);
    },
    [commit, sourceImageUrls, sourcePostUrls, videoPreview, t],
  );

  const handleDelete = useCallback(
    (index: number) => deleteListingSourceImage({ listingId, index }).then((r) => r.sourceImageUrls),
    [listingId],
  );
  const handleReorder = useCallback(
    (newOrder: string[]) => reorderListingSourceImages({ listingId, newOrder }).then((r) => r.sourceImageUrls),
    [listingId],
  );

  return (
    <div className="housing-register-image-field">
      <p className="housing-register-image-limit-note">{t('housing.register.media.limit_note')}</p>
      <HousingRegisterMultiUrlField
        slotCount={urlSlotCount}
        onAddSlot={() => setUrlSlotCount((prev) => Math.min(5, prev + 1))}
        onRemoveSlot={() => setUrlSlotCount((prev) => Math.max(1, prev - 1))}
        onTweetFetched={handleTweetFetched}
        onYoutubeFetched={handleYoutubeFetched}
        onOgpFetched={handleOgpFetched}
      />
      {committing && (
        <p className="housing-register-image-status">{t('housing.register.editMedia.saving')}</p>
      )}
      {videoPreview && (
        <div className="housing-register-media-video" data-testid="housing-register-media-video">
          <img
            src={videoPreview.posterUrl}
            alt=""
            className="housing-register-media-video-poster"
            loading="lazy"
          />
          <span className="housing-register-media-video-badge">
            {t('housing.register.media.video_badge')}
          </span>
        </div>
      )}
      <HousingEditImageGrid
        images={sourceImageUrls}
        onImagesChange={onSourceImageUrlsChange}
        onDelete={handleDelete}
        onReorder={handleReorder}
        minImages={1}
      />
    </div>
  );
}
