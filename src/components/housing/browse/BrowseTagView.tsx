import { useHousingViewStore } from '../../../store/useHousingViewStore';
import { TagPickerPanel } from './tagpicker/TagPickerPanel';

/**
 * 探すページ中央パネル「タグ」ビュー。WorldSelectGate と同じ「中央パネルを丸ごと差し替える」
 * 仕組みで、一覧|マップと並ぶ3つ目のビューとして表示する (design 2026-07-27 §1)。
 * 絞り込み確定後は常に一覧へ戻る (マップには戻らない: 地図はワールド1件に絞られていないと表示できない)。
 */
export const BrowseTagView: React.FC = () => {
  const setBrowseView = useHousingViewStore((s) => s.setBrowseView);
  return (
    <div className="housing-tagpicker-view" data-testid="housing-browse-tag-view">
      <TagPickerPanel onApplied={() => setBrowseView('list')} />
    </div>
  );
};
