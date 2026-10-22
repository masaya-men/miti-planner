import { listPublishedHousingers, type PublishedHousinger } from './publishedHousingers';

/**
 * 「ハウジンガー」表示用の公開ハウジンガー一覧を、同じセッション (ページを開いている間) で
 * 1 回だけ取得する。表示を切り替えて戻っても Firestore を読み直さない (コスト対策)。
 * 空配列は「0 人」か「取得失敗 (listPublishedHousingers は失敗時 [] を返す)」の区別がつかないため
 * キャッシュしない = 次に開いたときにもう一度だけ取りに行く。
 */
let cache: PublishedHousinger[] | null = null;
let inflight: Promise<PublishedHousinger[]> | null = null;

export function getCachedPublishedHousingers(): Promise<PublishedHousinger[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = listPublishedHousingers()
      .then((list) => {
        if (list.length > 0) cache = list;
        return list;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** テスト用: キャッシュを捨てる。 */
export function resetPublishedHousingersCache(): void {
  cache = null;
  inflight = null;
}
