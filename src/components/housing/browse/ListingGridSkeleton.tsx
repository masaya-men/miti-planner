import React, { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { SkeletonShell } from '../skeleton/HousingSkeletons';
import './ListingGridSkeleton.css';

export interface ListingGridSkeletonProps {
  /** true のとき実カードの「ツアーに追加」フッター分の高さも出す (探す/お気に入り)。 */
  withFooter?: boolean;
  /** 指定すると「実際の列数 × rows」枚だけ描く (ハウジンガーページの 1 行分)。未指定は画面いっぱい (PC 12 / スマホ 6 枚)。 */
  rows?: number;
}

/**
 * ダミーカード群。SkeletonShell は 200ms 経つまで子を描かないため、列数の測定は
 * 子が実際に mount されたこの内側コンポーネントで行う (グリッド要素 = 最初のカードの親)。
 */
const SkeletonCards: React.FC<Required<Pick<ListingGridSkeletonProps, 'withFooter'>> & Pick<ListingGridSkeletonProps, 'rows'>> = ({
  withFooter,
  rows,
}) => {
  const isMobile = useIsMobile();
  const [measuredCols, setMeasuredCols] = useState<number | null>(null);
  const firstRef = useRef<HTMLDivElement>(null);

  // rows 指定時: 描画された実グリッドの列数 (grid-template-columns の列トラック数) を測り、
  // 幅変化 (ウィンドウリサイズ等) には ResizeObserver で追従する。
  useEffect(() => {
    if (rows === undefined) return;
    const grid = firstRef.current?.parentElement;
    if (!grid) return;
    const measure = () => {
      const tracks = getComputedStyle(grid).gridTemplateColumns;
      const n = tracks && tracks !== 'none' ? tracks.split(' ').filter(Boolean).length : 0;
      if (n > 0) setMeasuredCols((prev) => (prev === n ? prev : n));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [rows]);

  // 初回測定前の仮値: PC=5 列・スマホ=2 列
  const count = rows === undefined ? (isMobile ? 6 : 12) : (measuredCols ?? (isMobile ? 2 : 5)) * rows;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} ref={i === 0 ? firstRef : undefined} className="housing-skel-card">
          <div className="housing-skel-card-media housing-skel" />
          {withFooter && (
            <div className="housing-skel-card-footer">
              <div className="housing-skel housing-skel-card-btn" />
            </div>
          )}
        </div>
      ))}
    </>
  );
};

/**
 * 一覧の読み込み中ダミー。実グリッド (.housing-listing-grid) と同じクラスを使うので
 * 列数・gap・余白は実物と常に一致する (PC=auto-fill / スマホ=2 列)。
 */
export const ListingGridSkeleton: React.FC<ListingGridSkeletonProps> = ({ withFooter = true, rows }) => (
  <SkeletonShell
    className="housing-listing-grid-skeleton-shell"
    fillClassName="housing-listing-grid housing-listing-grid-skeleton"
    data-testid="housing-grid-skeleton"
  >
    <SkeletonCards withFooter={withFooter} rows={rows} />
  </SkeletonShell>
);
