// 登録ページ(RegisterPage)と編集ページの写真欄(HousingEditSourcePanel)が共有する SNS 取得結果の型と補助関数。
// RegisterPage に置くと編集側 → RegisterPage → 編集側 の循環 import になるため分けている。
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { YoutubeFetchedData, OgpFetchedData } from './HousingRegisterSnsUrlField';

/**
 * 捕捉した SNS 取得結果 (画像 draft 構築の材料)。旧 HousingRegisterForm の tweetData/
 * tweetSource/youtubeData/ogpResult をページ state にまとめて保持し、submit 時に
 * 画像優先順位ロジックへ流す。テキストツイート等で画像ゼロでも「URL は取得済み」を
 * 表せるよう postUrl を別途保持する (imageMode='none' の黙示事故を塞ぐ材料)。
 */
export interface SnsCapture {
  tweetData: TweetData | null;
  tweetSource: { postUrl: string; tweetId: string } | null;
  youtube: YoutubeFetchedData | null;
  ogp: OgpFetchedData | null;
}

export const EMPTY_SNS_CAPTURE: SnsCapture = {
  tweetData: null,
  tweetSource: null,
  youtube: null,
  ogp: null,
};

/**
 * Twitter 代表 (tweetData) に後続 URL の写真を追記する際、photoAspectRatios (存在すれば) も
 * 同じ index 整合を保って伸長するためのマージヘルパー。既存/追加のどちらか一方にしか
 * 比率情報が無い場合は情報が無い側を null で埋める (buildDraftImageFields 側の
 * `r != null ? r : 0` 変換に委ねる)。両方とも比率情報が無ければ undefined のまま返し、
 * draft に sourceImageAspectRatios フィールド自体を付けない (従来の「テキストのみ」挙動と同じ)。
 * (2026-07-21 レビュー指摘 Bug2 fix: 複数URL目の写真が sourcePostUrls 集約時に消える不具合)
 *
 * 2026-07-22 (Task8・Batch2): 編集ページ (HousingEditSourcePanel) も同じ「Twitter代表に
 * 後続URLの写真を追記する」ロジックが必要なため export する。
 */
export function mergeTweetPhotoAspectRatios(
  existingRatios: (number | null)[] | undefined,
  existingCount: number,
  incomingRatios: (number | null)[] | undefined,
  incomingCount: number,
): (number | null)[] | undefined {
  if (existingRatios == null && incomingRatios == null) return undefined;
  const existingPart = existingRatios ?? new Array(existingCount).fill(null);
  const incomingPart = incomingRatios ?? new Array(incomingCount).fill(null);
  return [...existingPart, ...incomingPart];
}
