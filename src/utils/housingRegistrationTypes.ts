/** ハウジング登録の入力(住所と下書き)の型。検証(housingValidation)と画像の検証(housingImageValidation)の両方が使う */
import type { HousingArea, HousingSize, BuildingType, RoomKind } from '../types/housing.js';

export interface AddressInput {
  dc: string;
  server: string;
  area: HousingArea | string;
  ward: number;

  buildingType: BuildingType | string;

  // house の場合
  plot?: number;        // 1-60 (本街 1-30 / 拡張街 31-60 通し)
  size?: HousingSize | string;

  // apartment の場合
  /** 号棟: 1=本街アパート、 2=拡張街アパート。 buildingType='apartment' のとき必須 */
  apartmentBuilding?: 1 | 2;

  // 部屋区分
  roomKind?: RoomKind | string;
  roomNumber?: number;
}

export interface RegistrationDraft extends AddressInput {
  tags: string[];
  description?: string;
  title?: string;
  visibility?: 'public' | 'unlisted' | 'private';
  publishUntil?: number | null;
  /** 2026-07-24: 公開期限切れ後にどちらへ倒すか。publishUntil 設定時のみ意味を持つ。 */
  afterExpiryVisibility?: 'unlisted' | 'private';
  /**
   * 2026-09-01: 登録直後の「新着ハウジング」Discord 通知 (LoPo 運営が X で紹介する下書き) を
   * 許可するか。既定は許可 (未指定 / true)。登録画面で「公開」を選んだときだけトグルが出る。
   * 住所非公開・非公開はそもそも通知しないため無関係。
   */
  allowPromoTweet?: boolean;

  // SNS 画像 (任意。未指定なら imageMode='none' 扱い)
  // sns 経路の source は Twitter (tweetId) / YouTube (youtubeVideoId) / OGP (sourceImageUrls) の 3 種、 排他。
  imageMode?: 'sns' | 'none';
  postUrl?: string;
  /** 2026-07-21 追加 (Batch2): 貼った投稿URLの一覧(貼った順、最大5件、MAX_SOURCE_POST_URLS同期)。 */
  sourcePostUrls?: string[];
  ogImageUrl?: string;
  tweetId?: string;
  youtubeVideoId?: string;
  /**
   * 2026-05-27 追加: 外部画像 URL リスト (1-10 件、 MAX_SOURCE_IMAGE_URLS 同期)。
   * **LoPo の倉庫にコピーせず**、 表示時に `<img src>` で元サイトを直接読む。
   *
   * 2 経路で使われる (2026-05-27 排他緩和):
   * - OGP 経路 (housingsnap / studio-xiv 等): postUrl が allowlist 内、 各 URL は非 private IP
   * - Twitter 静止画ツイート (tweetId 併用): 各 URL は pbs.twimg.com 限定
   *
   * youtubeVideoId とは排他 (YouTube は storyboard を都度生成、 静止画 URL を保存しない)。
   */
  sourceImageUrls?: string[];
  sourceImageAspectRatios?: number[];

  /**
   * 2026-05-27 追加: Twitter 動画ツイートの mp4 URL。 tweetId 必須、
   * sourceImageUrls とは排他 (動画ツイートは 1 video のみ)。
   * host は video.twimg.com 限定 (validateImage で検証)。
   */
  videoUrl?: string;
  /** 2026-05-27 追加: Twitter 動画の poster URL (pbs.twimg.com 限定)。 */
  videoPosterUrl?: string;
  /** 2026-05-27 追加: 動画 aspect ratio (width/height、 正の数)。 */
  videoAspectRatio?: number;
}
