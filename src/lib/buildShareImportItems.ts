import type { PlanData, SavedPlan } from '../types';
import type { ShareImportItem } from './shareImportTypes';
import { stripSharedPersonalData } from './sharePrivacy';

/** 共有 API 応答 (単一 / バンドル) を緩く受ける入力型。旧フォーマット互換で各フィールドは欠落しうる。 */
type SharedDataLike = {
  plans?: { id?: string; contentId?: string | null; title?: string; planData: PlanData }[];
  contentId?: string | null;
  title?: string;
  planData?: PlanData;
};

export function parseSharedDataToImportItems(
  sharedData: SharedDataLike,
  shareId: string,
): ShareImportItem[] {
  if (Array.isArray(sharedData.plans)) {
    return sharedData.plans.map((p, index: number) => ({
      sourceShareId: shareId,
      // バンドル共有は plan ごとに contentId を持つ。
      // 旧フォーマット (top-level contentId しかない) や欠落時のフォールバックも用意。
      contentId: p.contentId ?? sharedData.contentId ?? null,
      title: p.title || 'Shared Plan',
      planData: p.planData,
      sourcePlanId: p.id ?? `${shareId}_${index}`,
    }));
  }
  return [
    {
      sourceShareId: shareId,
      contentId: sharedData.contentId as string | null,
      title: sharedData.title || 'Shared Plan',
      planData: sharedData.planData as PlanData,
    },
  ];
}

export function buildNewPlan(item: ShareImportItem): SavedPlan {
  const now = Date.now();
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `plan_${now}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    ownerId: 'local',
    ownerDisplayName: '',
    title: item.title,
    contentId: item.contentId,
    isPublic: false,
    // コピーに個人状態(progress/memos)を載せない（クライアント側の belt: サーバstripが未デプロイ/
    // 旧共有でも確実にクリーンにする。サーバ GET strip とあわせ二重防御）。
    data: stripSharedPersonalData(item.planData),
    createdAt: now,
    updatedAt: now,
  };
}
