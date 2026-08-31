import { housingImageVariant } from './housingMediaUrl';
import { twitterImageVariant, type TwitterImageName } from './twitterImageVariant';

/**
 * カード / スライドショー用の <img sizes>。
 *
 * `.housing-listing-grid` は `@media (max-width: 767px)` で `repeat(2, 1fr)` 固定
 * (390pt iPhone でも常に 2 カラム。1 カラムになる幅は無い)。ブラウズページの
 * グリッド padding は `4px 12px … 0`(左 0 / 右 12px)、カラム間 gap は
 * `--housing-main-gap` = 14px。よって 1 カード幅 = (100vw − 12 − 14) / 2 = 50vw − 13px。
 * PC は中央カラムに収まり約 240px。実測で微調整可 (§9)。
 */
export const CARD_IMAGE_SIZES = '(max-width: 767px) calc(50vw - 13px), 240px';

export interface CardImageAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
}

export interface CardImageAttrsOptions {
  /** srcSet に入れる派生幅(housing-media webp のときのみ)。既定 [480, 960, 1440]。 */
  widths?: readonly (480 | 960 | 1440)[];
  /** 原本を `{url} 1920w` として srcSet 末尾に足す(詳細メインステージ用)。 */
  appendOriginal?: boolean;
  /** <img sizes>。 */
  sizes?: string;
  /** X 画像を縮小するときの name。未指定なら X 画像は無加工。 */
  twitterName?: TwitterImageName;
}

const DEFAULT_WIDTHS = [480, 960, 1440] as const;

/** housing-media の派生対象画像か(= housingImageVariant が URL を書き換えるか)。 */
function isDerivableHousingImage(url: string): boolean {
  return housingImageVariant(url, 480) !== url;
}

/**
 * カード / ギャラリー用の <img> 属性(src / srcSet / sizes)を URL から組み立てる純関数。
 * - lopoly.app/housing-media/*.{webp,jpg,png}(直接アップロード)→ 派生 webp の srcSet
 * - pbs.twimg.com/media/*(X)→ twitterName 指定時のみ ?name= 付き src
 * - それ以外(YouTube サムネ、旧 URL 等)→ src=url のみ
 */
export function cardImageAttrs(url: string, opts: CardImageAttrsOptions = {}): CardImageAttrs {
  if (isDerivableHousingImage(url)) {
    const widths = opts.widths ?? DEFAULT_WIDTHS;
    const parts = widths.map((w) => `${housingImageVariant(url, w)} ${w}w`);
    if (opts.appendOriginal) parts.push(`${url} 1920w`);
    return { src: url, srcSet: parts.join(', '), sizes: opts.sizes };
  }
  if (opts.twitterName) {
    const t = twitterImageVariant(url, opts.twitterName);
    if (t !== url) return { src: t };
  }
  return { src: url };
}

/**
 * srcSet を使わない小さいサムネ用に、一番小さい実体 URL を返す。
 * housing-media → 480w 派生 / X → ?name=small / それ以外 → 素通し。
 */
export function smallHousingImageUrl(url: string): string {
  if (isDerivableHousingImage(url)) return housingImageVariant(url, 480);
  return twitterImageVariant(url, 'small');
}
