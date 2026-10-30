/**
 * ハウジングの「家の写真・動画サムネ」を出すための唯一の <img> 部品 (2026-10-22 新設)。
 *
 * 【使い方】 src/components/housing/** で家の写真を出すときは素の <img> を書かず、これを使う。
 *   <HousingImage src={url} variant="card" className="..." onLoad={...} />
 * variant (用途に合うサイズ変換を内部で選ぶ):
 *   - 'thumb'    : 54px 前後の極小 (ハウジンガー一覧など)。housing-media=480w / X=thumb / YouTube=mqdefault
 *   - 'small'    : 40〜100px 前後の小サムネ (トレイ・サムネ列など)。housing-media=480w / X=small
 *   - 'card'     : 一覧カード / スライドショー。srcset + sizes (CARD_IMAGE_SIZES)、X=small
 *   - 'gallery'  : 詳細メインステージ。srcset [960,1440,原本]
 *   - 'original' : 変換しない (登録・編集のプレビュー、blob:/data: URL など)
 * 内部で必ず行うこと:
 *   (a) サイズ変換 (cardImageAttrs 系)  (b) YouTube サムネの段階予備 (maxres→hq→mq→default・
 *   120x90 の灰色「…」画像も検出)  (c) 最後まで取れなければ控えめな代替表示 (無地+画像アイコン)
 *   (d) loading="lazy" decoding="async" 既定。
 * onError は「予備も尽きた最終失敗」でだけ呼ばれる。true を返すと呼び出し側が処理済み (代替表示を出さない)。
 * fallback="none" なら失敗時は何も描画しない (スライドショーのフレーム用)。
 * 再発防止: __tests__/noRawHousingImg.test.ts が素の <img> を検出して落とす。
 */
import { forwardRef, useState, type CSSProperties, type ReactEventHandler, type SyntheticEvent } from 'react';
import { ImageOff } from 'lucide-react';
import {
  CARD_IMAGE_SIZES,
  cardImageAttrs,
  smallHousingImageUrl,
  thumbHousingImageUrl,
} from '../../../lib/housing/cardImageAttrs';
import { nextYoutubeThumbnailFallback } from '../../../lib/housing/youtubeUrl';
import { handleYoutubeThumbnailLoad } from '../../../lib/housing/youtubeImgFallback';
import './HousingImage.css';

type HousingImageVariant = 'thumb' | 'small' | 'card' | 'gallery' | 'original';

const GALLERY_IMAGE_SIZES = '(max-width: 767px) 100vw, 800px';

export interface HousingImageProps {
  src: string;
  variant?: HousingImageVariant;
  /** variant が card / gallery のときの sizes 上書き。 */
  sizes?: string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  role?: string;
  draggable?: boolean;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
  /** 'icon' (既定) = 失敗時に無地+アイコン / 'none' = 何も描画しない。 */
  fallback?: 'icon' | 'none';
  onLoad?: ReactEventHandler<HTMLImageElement>;
  /** 予備も尽きた最終失敗。true を返すと処理済み扱い (代替表示を出さない)。 */
  onError?: (e: SyntheticEvent<HTMLImageElement>) => boolean | void;
  'data-active'?: boolean;
  'data-testid'?: string;
}

function resolveAttrs(
  src: string,
  variant: HousingImageVariant,
  sizes?: string,
): { src: string; srcSet?: string; sizes?: string } {
  switch (variant) {
    case 'thumb':
      return { src: thumbHousingImageUrl(src) };
    case 'small':
      return { src: smallHousingImageUrl(src) };
    case 'card':
      return cardImageAttrs(src, { sizes: sizes ?? CARD_IMAGE_SIZES, twitterName: 'small' });
    case 'gallery':
      return cardImageAttrs(src, {
        widths: [960, 1440],
        appendOriginal: true,
        sizes: sizes ?? GALLERY_IMAGE_SIZES,
      });
    default:
      return { src };
  }
}

export const HousingImage = forwardRef<HTMLImageElement, HousingImageProps>(function HousingImage(
  {
    src,
    variant = 'original',
    sizes,
    className,
    style,
    alt = '',
    role,
    draggable,
    loading = 'lazy',
    decoding = 'async',
    fallback = 'icon',
    onLoad,
    onError,
    ...rest
  },
  ref,
) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) {
    if (fallback === 'none') return null;
    return (
      <span
        className={`${className ? `${className} ` : ''}housing-image-fallback`}
        style={style}
        data-housing-image-failed=""
        aria-hidden="true"
      >
        <ImageOff size={16} aria-hidden="true" />
      </span>
    );
  }

  const a = resolveAttrs(src, variant, sizes);

  const handleError = (e: SyntheticEvent<HTMLImageElement>): void => {
    const img = e.currentTarget;
    const next = nextYoutubeThumbnailFallback(img.src);
    if (next) {
      img.srcset = '';
      img.src = next;
      return;
    }
    if (onError?.(e) === true) return;
    setFailedSrc(src);
  };

  const handleLoad = (e: SyntheticEvent<HTMLImageElement>): void => {
    handleYoutubeThumbnailLoad(e);
    onLoad?.(e);
  };

  return (
    <img referrerPolicy="no-referrer"
      ref={ref}
      src={a.src}
      srcSet={a.srcSet}
      sizes={a.sizes}
      alt={alt}
      role={role}
      draggable={draggable}
      loading={loading}
      decoding={decoding}
      className={className}
      style={style}
      onError={handleError}
      onLoad={handleLoad}
      {...rest}
    />
  );
});
