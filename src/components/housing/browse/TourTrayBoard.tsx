import { useCallback, useRef, useState } from 'react';
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
// 列幅: 行カードの固定幅要素 (グリップ/番号/サムネ/ピン/削除 + gap) を引くと 200px では
// タイトルの表示幅がほぼ 0 になっていたため、既存サイドバートレイ幅 (--housing-right-w: 300px)
// に揃える。300px はこの行カードがタイトル込みで収まることが判っている実績値。
const COL_W = 300;
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

  const [rowsPerColumn, setRowsPerColumn] = useState(DEFAULT_ROWS);

  // トレイが空 → 追加、で `.housing-tour-board-scroll` が初めて DOM に現れるケースがあるため、
  // useEffect([]) ではなく callback ref で「ノードが実際に付いた瞬間」に observe する。
  // ノードが差し替わる(空⇄件数あり往復)たびに前の observer は必ず disconnect する。
  const observerRef = useRef<ResizeObserver | null>(null);
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      setRowsPerColumn(Math.max(1, Math.floor(height / ROW_H)));
    });
    observer.observe(el);
    observerRef.current = observer;
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
                '--housing-snake-row-h': `${ROW_H}px`,
                '--housing-snake-col-w': `${COL_W}px`,
              } as React.CSSProperties}
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
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      // グリップ/ピン/削除ボタンからのクリックは選択に波及させない
                      // (TourTrayRow 自体は Task2 の共用コンポーネントなので変更しない)。
                      if ((e.target as HTMLElement).closest('button')) return;
                      onSelect(l.id);
                    }}
                    onKeyDown={(e) => {
                      // キーボードでも選択できるようにする (ドラッグは KeyboardSensor 側で既に対応済み)。
                      // 内側ボタン由来のキー操作は onClick と同じガードで無視する。
                      if ((e.target as HTMLElement).closest('button')) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(l.id);
                      }
                    }}
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
