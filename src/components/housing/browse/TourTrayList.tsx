import { useTranslation } from 'react-i18next';
import { ArrowDownUp, Route } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTourTrayOrdering } from '../../../lib/housing/useTourTrayOrdering';
import { TourTrayRow } from './TourTrayRow';

export interface TourTrayListProps {
  /** トレイの生 id 配列 (追加順 or 前回の手動並び替え順)。表示順の解決は内部で行う。 */
  listingIds: string[];
  /** 削除 / ドラッグ確定 / 効率順ボタンで trayIds 全体を更新する。 */
  onChange: (ids: string[]) => void;
}

/**
 * ツアートレイの行き先リスト本体 (縦一覧版)。PC サイドバー (TourTray) とスマホの計画画面で共有する。
 * 並べ替えロジックは useTourTrayOrdering、行の見た目は TourTrayRow に集約済み。
 */
export const TourTrayList: React.FC<TourTrayListProps> = ({ listingIds, onChange }) => {
  const { t, i18n } = useTranslation();
  const { items, orderedIds, pinnedIds, remove, togglePin, onSortEfficient, sensors, handleDragEnd } =
    useTourTrayOrdering(listingIds, onChange);

  if (items.length === 0) {
    return (
      <div className="housing-empty-hint housing-tour-tray-empty">
        <Route size={20} aria-hidden="true" />
        <p>{t('housing.tray.empty')}</p>
      </div>
    );
  }

  return (
    <div className="housing-tour-tray-body">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <ol className="housing-tour-tray-list">
            {items.map((l, i) => (
              <TourTrayRow
                key={l.id}
                listing={l}
                index={i}
                language={i18n.language}
                isPinned={pinnedIds.includes(l.id)}
                onRemove={remove}
                onTogglePin={togglePin}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <button type="button" className="housing-tour-tray-sortbtn" onClick={onSortEfficient}>
        <ArrowDownUp size={14} aria-hidden="true" />
        {t('housing.tray.sort_efficient')}
      </button>
    </div>
  );
};
