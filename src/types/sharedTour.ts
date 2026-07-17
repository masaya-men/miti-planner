export type TourPhase = 'moving' | 'viewing';
export type TourStatus = 'live' | 'ended';

/** 家1件の送信用スナップショット（MockListing の縮約・画像本体は含めず外部URL文字列のみ） */
export interface TourSnapshot {
  id: string;
  area?: string; ward?: number; buildingType?: 'house' | 'apartment';
  plot?: number; size?: 'S' | 'M' | 'L';
  apartmentBuilding?: 1 | 2; roomNumber?: number;
  roomKind?: 'private_chamber' | 'apartment_room';
  dc?: string; server?: string; region?: string;
  imageMode?: 'sns' | 'thumbnail' | 'none';
  postUrl?: string; ogImageUrl?: string;
  sourceImageUrls?: string[]; sourceImageAspectRatios?: number[];
  youtubeVideoId?: string; videoUrl?: string; videoPosterUrl?: string; videoAspectRatio?: number;
  thumbnailPath?: string; thumbnailPaths?: string[];
  title?: string; description?: string; tags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
}

/** shared_tours/{tourToken}（発行時に確定・以後不変・参加者は初回 get） */
export interface SharedTourMeta {
  tourToken: string;
  hostUid: string;
  snapshot: TourSnapshot[];
  containsHiddenAddress: boolean;
  createdAt: number;
}

/** shared_tours/{tourToken}/live/current（頻繁に変わる・参加者は onSnapshot） */
export interface SharedTourLiveState {
  status: TourStatus;
  currentIndex: number;
  phase: TourPhase;
  viewStartAt: number | null;
  lastActivityAt: number;
}

/** 家件数・スナップショットサイズの上限 */
export const SHARED_TOUR_MAX_STOPS = 100;
