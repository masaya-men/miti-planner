import type { SavedPlan } from '../types';
import type { ShareImportItem } from './shareImportTypes';

export function parseSharedDataToImportItems(
  sharedData: any,
  shareId: string,
): ShareImportItem[] {
  if (Array.isArray(sharedData.plans)) {
    return sharedData.plans.map((p: any) => ({
      sourceShareId: shareId,
      contentId: sharedData.contentId,
      title: p.title || 'Shared Plan',
      planData: p.planData,
      sourcePlanId: p.id,
    }));
  }
  return [
    {
      sourceShareId: shareId,
      contentId: sharedData.contentId,
      title: sharedData.title || 'Shared Plan',
      planData: sharedData.planData,
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
    copyCount: 0,
    useCount: 0,
    data: item.planData,
    createdAt: now,
    updatedAt: now,
  };
}
