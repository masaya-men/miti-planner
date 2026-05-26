/**
 * Phase 3 + 2026-05-26 multi-image 対応: 物件詳細の写真ギャラリー
 *
 * - thumbnailPaths があれば配列を表示 (1 枚目はメイン、 2 枚目以降はサムネ列で切替)
 * - thumbnailPaths がなければ thumbnailPath / ogImageUrl の 1 枚にフォールバック (後方互換)
 * - 写真がない場合: プレースホルダ
 */
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { HousingListing } from '../../../types/housing';

export interface HousingPhotoGalleryProps {
  listing: HousingListing;
}

/**
 * listing から画像 URL の配列を取り出す。
 * - imageMode==='thumbnail': thumbnailPaths を優先、 なければ thumbnailPath を 1 件
 * - imageMode==='sns': ogImageUrl を 1 件
 * - その他: []
 */
function resolveSources(listing: HousingListing): string[] {
  if (listing.imageMode === 'thumbnail') {
    if (Array.isArray(listing.thumbnailPaths) && listing.thumbnailPaths.length > 0) {
      return listing.thumbnailPaths.filter((s) => typeof s === 'string' && s !== '');
    }
    if (listing.thumbnailPath) return [listing.thumbnailPath];
    return [];
  }
  if (listing.imageMode === 'sns' && listing.ogImageUrl) return [listing.ogImageUrl];
  return [];
}

export const HousingPhotoGallery: React.FC<HousingPhotoGalleryProps> = ({ listing }) => {
  const { t } = useTranslation();
  const sources = useMemo(() => resolveSources(listing), [listing]);
  const [activeIndex, setActiveIndex] = useState(0);

  if (sources.length === 0) {
    return (
      <div className="housing-gallery-empty" aria-hidden="true">
        <span>{t('housing.gallery.no_image', { defaultValue: 'No image' })}</span>
      </div>
    );
  }

  const safeIndex = Math.min(activeIndex, sources.length - 1);
  const mainSrc = sources[safeIndex];

  return (
    <div className="housing-gallery">
      <img src={mainSrc} alt="" loading="lazy" className="housing-gallery-main" />
      {sources.length > 1 && (
        <ul className="housing-gallery-thumbs" role="tablist">
          {sources.map((src, i) => (
            <li key={`${i}-${src}`} role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={i === safeIndex}
                data-active={i === safeIndex}
                className="housing-gallery-thumb"
                onClick={() => setActiveIndex(i)}
                aria-label={t('housing.gallery.thumb_aria', {
                  index: i + 1,
                  total: sources.length,
                  defaultValue: `Image ${i + 1} of ${sources.length}`,
                })}
              >
                <img src={src} alt="" loading="lazy" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
