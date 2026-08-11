import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownUp, Route } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useTourTrayOrdering } from '../../../lib/housing/useTourTrayOrdering';
import { computeSnakeGridPositions, buildSnakePathD } from '../../../lib/housing/computeSnakeGridPositions';
import { TourTrayRow } from './TourTrayRow';

export interface TourTrayBoardProps {
  listingIds: string[];
  onChange: (ids: string[]) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ROW_H = 60;
const COL_W = 200;
const DEFAULT_ROWS = 5;

/**
 * ツアー計画画面(PC)の右側: 番号カードを蛇行(上下交互)に並べたグリッド。
 * 列を上から下まで埋めたら隣の列は下から上へ、と接続線がつながったまま右へ続く。
 * 画面に入りきらない分は横スクロールで見る(50-100件規模を想定)。
 * ドラッグ/ピン/効率順のロジックは useTourTrayOrdering・TourTrayRow をそのまま再利用する。
 */
export const TourTrayBoard: React.FC<TourTrayBoardProps> = ({
  listingIds,
  onChange,
  selectedId,
  onSelect,
}) => {
  const { t, i18n } = useTranslation();
  const { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
    useTourTrayOrdering(listingIds, onChange);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [rowsPerColumn, setRowsPerColumn] = useState(DEFAULT_ROWS);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setRowsPerColumn(Math.max(1, Math.floor(height / ROW_H)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (items.length === 0) {
    return (
      <div className="housing-empty-hint housing-tour-tray-empty">
        <Route size={20} aria-hidden="true" />
        <p>{t('housing.tray.empty')}</p>
      </div>
    );
  }

  const cells = computeSnakeGridPositions(orderedIds, rowsPerColumn);
  const cellById = new Map(cells.map((c) => [c.id, c]));
  const colCount = Math.max(...cells.map((c) => c.col)) + 1;
  const pathD = buildSnakePathD(cells, COL_W, ROW_H);

  return (
    <div className="housing-tour-board">
      <div className="housing-tour-board-toolbar">
        <span className="housing-tour-board-hint">{t('housing.tray.board_hint')}</span>
        <button type="button" className="housing-tour-tray-sortbtn" onClick={onSortEfficient}>
          <ArrowDownUp size={14} aria-hidden="true" />
          {t('housing.tray.sort_efficient')}
        </button>
      </div>
      <div className="housing-tour-board-scroll" ref={scrollRef}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
            <div
              className="housing-tour-board-grid"
              style={{
                gridTemplateRows: `repeat(${rowsPerColumn}, ${ROW_H}px)`,
                width: colCount * COL_W,
              }}
            >
              <svg
                className="housing-tour-board-path"
                width={colCount * COL_W}
                height={rowsPerColumn * ROW_H}
                aria-hidden="true"
              >
                <path d={pathD} />
              </svg>
              {items.map((l, i) => {
                const cell = cellById.get(l.id);
                if (!cell) return null;
                return (
                  <div
                    key={l.id}
                    className="housing-tour-board-cell"
                    data-selected={l.id === selectedId}
                    style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                    onClick={() => onSelect(l.id)}
                  >
                    <TourTrayRow
                      listing={l}
                      index={i}
                      language={i18n.language}
                      isPinned={pinnedIds.includes(l.id)}
                      onRemove={remove}
                      onTogglePin={togglePin}
                    />
                  </div>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
