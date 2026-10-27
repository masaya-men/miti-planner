import { useEffect, useRef, useState } from 'react';
import { useHousingFieldState } from '../../../../lib/housing/housingFieldState';
import type { RegisterAddressValues } from '../RegisterSectionAddress';
import type { RegisterSectionIntroValues } from '../RegisterSectionIntro';
import type { CompressedImage } from '../../../../lib/housing/imageCompression';
import type { HousingListing } from '../../../../types/housing';
import { EMPTY_SNS_CAPTURE, type SnsCapture } from '../snsCapture';
import { requiredFieldsForAddress, addressFromListing } from './registerPageModel';

export function useRegisterFields(mode: 'create' | 'edit', initialValues?: HousingListing) {
  const [address, setAddress] = useState<RegisterAddressValues>(() =>
    initialValues ? addressFromListing(initialValues) : {},
  );
  // 復元起因の SNS 再取得で「空フィールドだけ補完」判定に使う最新 address のミラー (spec:120)。
  // setTimeout スタッガー内で最新値を同期的に読むため、address 変化ごとに追従させる。
  const addressRef = useRef<RegisterAddressValues>(address);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  const requiredFields = requiredFieldsForAddress(address.buildingType, address.roomKind);
  const fieldState = useHousingFieldState(requiredFields);
  /**
   * 住所確認ゲート (C案・2026-07-10)。フォーム値から組み立てた住所文を確認セクションに提示し、
   * 「この住所で間違いありません」ボタンを押すまで送信ボタンを無効にする (registerChecklist の
   * address 行に反映)。mode='edit' は住所欄に触れなければ従来どおり保存できるよう、初期状態を
   * 確認済み扱いにする (編集モード = (b))。
   * 解除するのは「住所を実際に変えた」とみなせる箇所のみ (手編集 / SNS 自動入力 / オートセーブ復元)。
   * size の自動導出 (区画由来・別 effect) では解除しない。
   */
  const [addressConfirmed, setAddressConfirmed] = useState(() => mode === 'edit');
  const [addressExtractFailed, setAddressExtractFailed] = useState(false);

  const [title, setTitle] = useState(() => initialValues?.title ?? '');
  const [description, setDescription] = useState(() => initialValues?.description ?? '');
  const [tags, setTags] = useState<string[]>(() => initialValues?.tags ?? []);
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>(
    () => initialValues?.visibility ?? 'public',
  );
  const [publishUntil, setPublishUntil] = useState<number | null>(
    () => initialValues?.publishUntil ?? null,
  );
  // 2026-07-24: 公開期限切れ後の倒し先 (裏側の定期処理が使う)。既定は住所非公開 (穏当な方)。
  const [afterExpiryVisibility, setAfterExpiryVisibility] = useState<'unlisted' | 'private'>(
    () => initialValues?.afterExpiryVisibility ?? 'unlisted',
  );
  // 2026-09-01: 新着ハウジングの LoPo 公式 X 紹介 (下書き通知) を許可するか。既定 ON。
  // 「公開」を選んだ create のときだけトグルを表示する。
  const [allowPromoTweet, setAllowPromoTweet] = useState<boolean>(
    () => initialValues?.allowPromoTweet ?? true,
  );
  // 既定 public を自動で✅にしない (feedback_form_ux_progress) ため、公開設定セクションの
  // onChange が一度でも呼ばれたかを別フラグで持つ (visibility state 自体は初期値 'public')。
  // mode='edit' は visibility が initialValues から確定済みなので、ステッパーの visibility
  // ステップは最初から done 扱いにする (Task3.1 申し送り事項・Task3.2 で対応)。
  const [visibilityTouched, setVisibilityTouched] = useState(() => mode === 'edit');

  const handleVisibilityChange = (next: {
    visibility: 'public' | 'unlisted' | 'private';
    publishUntil: number | null;
    afterExpiryVisibility: 'unlisted' | 'private';
    allowPromoTweet: boolean;
  }) => {
    setVisibility(next.visibility);
    setPublishUntil(next.publishUntil);
    setAfterExpiryVisibility(next.afterExpiryVisibility);
    setAllowPromoTweet(next.allowPromoTweet);
    setVisibilityTouched(true);
  };

  const handleIntroChange = (next: RegisterSectionIntroValues) => {
    setTitle(next.title);
    setDescription(next.description);
    setTags(next.tags);
  };

  const [localImages, setLocalImages] = useState<CompressedImage[]>([]);
  const [sourceImageUrls, setSourceImageUrls] = useState<string[]>(
    () => (mode === 'edit' ? (initialValues?.sourceImageUrls ?? []) : []),
  );

  /**
   * edit モード専用: 直接アップロード画像の URL 一覧 (Plan B・2026-07-21)。
   * create モードの `localImages` (アップロード前のローカルファイル) とは別物で、
   * サーバーに既に保存済みの URL のみを保持する。buildDraftImageFields には渡さない
   * (直接アップロードの commit は uploadListingThumbnail が単独で完結するため)。
   */
  const [editThumbnailPaths, setEditThumbnailPaths] = useState<string[]>(() => {
    if (mode !== 'edit' || !initialValues) return [];
    if (initialValues.thumbnailPaths && initialValues.thumbnailPaths.length > 0) {
      return initialValues.thumbnailPaths;
    }
    return initialValues.thumbnailPath ? [initialValues.thumbnailPath] : [];
  });

  /** edit モード専用: 動画プレビュー (Twitter動画ツイート or YouTube 由来)。URL再取得で更新される。 */
  const [editVideoPreview, setEditVideoPreview] = useState<
    { url: string; posterUrl: string; aspectRatio?: number; source?: 'tweet' | 'youtube' } | null
  >(() => {
    if (mode !== 'edit') return null;
    if (initialValues?.videoUrl && initialValues?.videoPosterUrl) {
      return {
        url: initialValues.videoUrl,
        posterUrl: initialValues.videoPosterUrl,
        aspectRatio: initialValues.videoAspectRatio,
        source: 'tweet',
      };
    }
    // 2026-08-24 実機報告: YouTube動画 (youtubeVideoId) の場合は Twitter の mp4 url を
    // 持たないため、posterUrl (= ogImageUrl = YouTube サムネ) だけで「動画あり」を示す。
    // このバッジは静止画カードを出すだけで再生はしない (videoPreviewToTweetVideo 経由で
    // Twitter動画へ変換されるのは Twitter が新規に代表を確立するときだけなので、この url を
    // 再生用ではなく識別用の postUrl にしても実害はない)。source:'youtube' はTwitterが代表を
    // 横取りしないための印 (HousingEditSourcePanel.tsx の hasRepresentative 参照)。
    if (initialValues?.youtubeVideoId && initialValues?.ogImageUrl) {
      return { url: initialValues.postUrl ?? '', posterUrl: initialValues.ogImageUrl, source: 'youtube' };
    }
    return null;
  });
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
   * 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧 (postUrl は従来通り「先頭/代表」を保持、
   * これは配列版)。重複URL検出 (multiSourceGuards.isDuplicatePostUrl) にも使う。
   */
  const [sourcePostUrls, setSourcePostUrls] = useState<string[]>(() =>
    mode === 'edit' && initialValues
      ? (initialValues.sourcePostUrls ?? (initialValues.postUrl ? [initialValues.postUrl] : []))
      : [],
  );
  /** 表示する URL 入力欄の数 (1..5)。 */
  const [urlSlotCount, setUrlSlotCount] = useState(1);
  /** 既に動画を1本捕捉済みか (2本目以降の動画を拒否する判定に使う、multiSourceGuards 参照)。 */
  const capturedVideoRef = useRef(false);
  /** 住所を既に (どれかのURLから) 自動入力済みか。true の間は以降のURLの住所は適用しない。 */
  const addressAppliedRef = useRef(false);
  /**
   * オートセーブ復元時に SNS URL 欄へ流し込む初期 URL (Task14 fix)。復元時に一度だけ設定し、
   * RegisterSectionMedia → HousingRegisterSnsUrlField(initialUrl) 経由でマウント時再取得を発火する。
   */
  const [restoredSnsUrl, setRestoredSnsUrl] = useState<string | undefined>(undefined);
  /**
   * RegisterSectionMedia / HousingRegisterSnsUrlField の内部 state (url 等) を強制リセットするための
   * 再マウント key の一部。破棄 (handleDiscardRestore) で ++ し、URL 欄の内部 url state を初期化する。
   * JSX 側では `${mediaKey}:${restoredSnsUrl}` を key にし、復元 URL 到着時 (restoredSnsUrl が
   * undefined→URL に変化) にも再マウントさせて SnsUrlField の initialUrl マウント再取得を発火させる。
   */
  const [mediaKey, setMediaKey] = useState(0);

  /**
   * オートセーブ復元起因の SNS 再取得が走っている間だけ true にするフラグ (spec:120 guard)。
   * true の間は applyExtractedAddress が「その時点で空の住所フィールドだけ」を setAutoFilled する
   * (= 復元済み・手修正済みの住所値をツイート元の値で上書きしない)。通常の (復元でない) SNS 貼付は
   * false のままで従来どおり全フィールド反映。ref なので再取得トリガーの前後で同期的に切り替えられる。
   */
  const restoreRefetchGuardRef = useRef(false);

  return { address, setAddress, addressRef, requiredFields, fieldState, addressConfirmed, setAddressConfirmed, addressExtractFailed, setAddressExtractFailed, title, setTitle, description, setDescription, tags, setTags, visibility, setVisibility, publishUntil, setPublishUntil, afterExpiryVisibility, setAfterExpiryVisibility, allowPromoTweet, setAllowPromoTweet, visibilityTouched, setVisibilityTouched, handleVisibilityChange, handleIntroChange, localImages, setLocalImages, sourceImageUrls, setSourceImageUrls, editThumbnailPaths, setEditThumbnailPaths, editVideoPreview, setEditVideoPreview, snsCapture, setSnsCapture, postUrl, setPostUrl, sourcePostUrls, setSourcePostUrls, urlSlotCount, setUrlSlotCount, capturedVideoRef, addressAppliedRef, restoredSnsUrl, setRestoredSnsUrl, mediaKey, setMediaKey, restoreRefetchGuardRef };
}

export type RegisterFields = ReturnType<typeof useRegisterFields>;
