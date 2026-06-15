// 現在プランのコンテンツ名ラベルを導出(共有モーダル用)。
// ConsolidatedHeader のヘッダー表示と同基準(getContentById → getPhaseName → ja は和欧スペース)。
import { getContentById } from '../data/contentRegistry';
import { getPhaseName } from '../types';
import type { SavedPlan } from '../types';

// 和欧間スペース: 漢字/かな ↔ 半角英数字の間にスペースを挿入(ConsolidatedHeader と同一)。
export function addWaEiSpace(text: string): string {
  return text
    .replace(/([　-鿿豈-﫿])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([　-鿿豈-﫿])/g, '$1 $2');
}

/** 現在プランのコンテンツ名ラベル(無ければ null)。ja のみ和欧スペースを挿入。 */
export function getCurrentContentLabel(
  currentPlan: Pick<SavedPlan, 'contentId'> | undefined,
  contentLanguage: string,
): string | null {
  const contentDef = currentPlan?.contentId ? getContentById(currentPlan.contentId) : null;
  const raw = contentDef ? getPhaseName(contentDef.name, contentLanguage) : null;
  return raw && contentLanguage === 'ja' ? addWaEiSpace(raw) : raw;
}
