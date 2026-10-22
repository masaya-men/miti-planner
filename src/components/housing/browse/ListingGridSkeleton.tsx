import React from 'react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { SkeletonShell } from '../skeleton/HousingSkeletons';

export interface ListingGridSkeletonProps {
  /** true のとき実カードの「ツアーに追加」フッター分の高さも出す (探す/お気に入り)。 */
  withFooter?: boolean;
}

/**
 * 一覧の読み込み中ダミー。実グリッド (.housing-listing-grid) と同じクラスを使うので
 * 列数・gap・余白は実物と常に一致する (PC=auto-fill / スマホ=2 列)。
 */
export const ListingGridSkeleton: React.FC<ListingGridSkeletonProps> = ({ withFooter = true }) => {
  const isMobile = useIsMobile();
  const count = isMobile ? 6 : 12;
  return (
    <SkeletonShell
      className="housing-listing-grid-skeleton-shell"
      fillClassName="housing-listing-grid housing-listing-grid-skeleton"
      data-testid="housing-grid-skeleton"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="housing-skel-card">
          <div className="housing-skel-card-media housing-skel" />
          {withFooter && (
            <div className="housing-skel-card-footer">
              <div className="housing-skel housing-skel-card-btn" />
            </div>
          )}
        </div>
      ))}
    </SkeletonShell>
  );
};
