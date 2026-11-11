import { useHousingFilterStore } from '../../../store/useHousingFilterStore';
import { useCanPreviewWip } from '../../../hooks/useCanPreviewWip';

const NONE: readonly never[] = [];

/** 絞り込みに効かせる色の選択。告知まで色で探すは管理者(と DEV)だけに見せるため、
 *  それ以外の人は store に色が残っていても空として扱う。公開するときはこのフックを外す。 */
export function useActiveColorSwatches() {
  const swatches = useHousingFilterStore((s) => s.colorSwatches);
  const canSee = useCanPreviewWip();
  return canSee ? swatches : NONE;
}
