import type { TourMapModel } from '../../../lib/housing/buildTourMapPlacements';
import type { TourCrossing } from '../../../lib/housing/tourCrossing';
import type { MockListing } from '../../../data/housing/mockListings';

export interface TourNavMapProps {
  status: 'none' | 'loading' | 'ready' | 'error';
  svg: string | null;
  viewBox: { w: number; h: number } | null;
  model: TourMapModel | null;
  /** 目的地(ステップ)の識別子。これが変わったら演出(ズームアウト→切替→ズームイン)を再生する。
   *  経路の形(route 文字列)ではなくステップそのもので判定する(アパルトメントは経路が無く
   *  連続すると route が同一になり、目的地変更を取りこぼすため)。 */
  stepKey: string | number;
  /** 起点エーテライトの名前。origin(座標)の上に常時ラベル表示する。無ければ非表示。 */
  originName?: string | null;
  /** 前の家→この家の移動種別。省略時は跨ぎ無し扱い。 */
  crossing?: TourCrossing;
  /** true の間、ステージにぼかし+跨ぎ案内カードを重ねる。省略時は出さない。 */
  showCrossing?: boolean;
  /** 参加者(閲覧専用): 跨ぎ案内カードに待機文言を出す(#A)。
   *  地図が出るかどうかは主催者の操作(broadcast された crossingAckedIndex)でだけ決まる。
   *  ack への到達手段は「次へ」ボタン(呼び出し側の二段階ロジック)に一本化しており、
   *  このカード自体にはボタンを持たない。 */
  crossingReadOnly?: boolean;
  /** 現在の目的地の listing。左上のフル住所オーバーレイに使う。省略時はオーバーレイ自体を出さない。 */
  addressListing?: MockListing | null;
  /** 現在地→目的地の行き方。実機FB#4: スマホ下部バーの1行省略表示だと読み切れなかったため、
   *  渡されたときだけ地図コンテナ下部の帯へ teleport(エーテライト名)/directions(行き方本文)を
   *  2段(1行目=エーテライト・2行目以降=全文折返し)で表示する。
   *  省略/null なら何も出さない(PC は呼び出し側が渡さないため従来通り無表示)。 */
  footerDirections?: { teleport: string; directions: string } | null;
  /** 実機FB: スマホの見学中(phase==='viewing')に出す経過時間チップの表示文言(整形済み)。
   *  呼び出し側(TourNavPage)が isMobile && phase==='viewing' の時だけ渡す。
   *  省略/null なら何も出さない(PC は呼び出し側が渡さないため従来通り無表示)。 */
  viewingTimerText?: string | null;
  /** 実機指摘(2026-08-12): スマホには招待の入口説明が一切無かったため追加。
   *  地図下部の帯(footerDirections と同じ帯)に常時1行だけ出す招待案内(未ログイン/ログイン済みで文言が変わる)。
   *  footerDirections が null(アパート等で行き方データが無い)でもこの文言だけは出したいため、
   *  帯自体の表示条件は footerDirections || inviteHint とする。省略/null なら何も出さない(PC は渡さない)。 */
  inviteHint?: string | null;
}
