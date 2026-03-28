/**
 * スキル・ステータスデータへのアクセスフック
 * Firestoreから取得したデータを返し、未取得時は静的ファイルにフォールバック
 */
import { useMasterDataStore } from '../store/useMasterDataStore';
import type { Job, Mitigation, LevelModifier, TemplateStats } from '../types';
import { JOBS as STATIC_JOBS, MITIGATIONS as STATIC_MITIGATIONS, MITIGATION_DISPLAY_ORDER as STATIC_DISPLAY_ORDER, getMitigationPriority } from '../data/mockData';
import { DEFAULT_STATS_BY_LEVEL as STATIC_DEFAULT_STATS, ALL_PATCH_STATS as STATIC_ALL_PATCH_STATS } from '../data/defaultStats';
import { LEVEL_MODIFIERS as STATIC_LEVEL_MODIFIERS } from '../data/levelModifiers';

// ────────────────────────────────────────
// Reactフック（コンポーネント内で使用）
// ────────────────────────────────────────

/** ジョブ一覧を取得 */
export function useJobs(): Job[] {
  const skills = useMasterDataStore((s) => s.skills);
  return skills?.jobs ?? STATIC_JOBS;
}

/** 軽減スキル一覧を取得 */
export function useMitigations(): Mitigation[] {
  const skills = useMasterDataStore((s) => s.skills);
  return skills?.mitigations ?? STATIC_MITIGATIONS;
}

/** 表示順配列を取得 */
export function useDisplayOrder(): string[] {
  const skills = useMasterDataStore((s) => s.skills);
  return skills?.displayOrder ?? STATIC_DISPLAY_ORDER;
}

/** レベル補正を取得 */
export function useLevelModifiers(): Record<number, LevelModifier> {
  const stats = useMasterDataStore((s) => s.stats);
  return stats?.levelModifiers ?? STATIC_LEVEL_MODIFIERS;
}

/** パッチ別ステータスを取得 */
export function usePatchStats(): Record<string, TemplateStats> {
  const stats = useMasterDataStore((s) => s.stats);
  return stats?.patchStats ?? STATIC_ALL_PATCH_STATS;
}

/** レベル別デフォルトステータスを取得 */
export function useDefaultStatsByLevel(): Record<number, TemplateStats> {
  const stats = useMasterDataStore((s) => s.stats);
  if (!stats) return STATIC_DEFAULT_STATS;
  const result: Record<number, TemplateStats> = {};
  for (const [level, patch] of Object.entries(stats.defaultStatsByLevel)) {
    const patchData = stats.patchStats[patch];
    if (patchData) result[Number(level)] = patchData;
  }
  return Object.keys(result).length > 0 ? result : STATIC_DEFAULT_STATS;
}

// ────────────────────────────────────────
// 非Reactコンテキスト用（ストア・ユーティリティ関数から使用）
// ────────────────────────────────────────

/** ストアから直接取得（React外で使用） */
export function getJobsFromStore(): Job[] {
  return useMasterDataStore.getState().skills?.jobs ?? STATIC_JOBS;
}

export function getMitigationsFromStore(): Mitigation[] {
  return useMasterDataStore.getState().skills?.mitigations ?? STATIC_MITIGATIONS;
}

export function getDisplayOrderFromStore(): string[] {
  return useMasterDataStore.getState().skills?.displayOrder ?? STATIC_DISPLAY_ORDER;
}

export function getLevelModifiersFromStore(): Record<number, LevelModifier> {
  return useMasterDataStore.getState().stats?.levelModifiers ?? STATIC_LEVEL_MODIFIERS;
}

export function getPatchStatsFromStore(): Record<string, TemplateStats> {
  return useMasterDataStore.getState().stats?.patchStats ?? STATIC_ALL_PATCH_STATS;
}

export function getDefaultStatsByLevelFromStore(): Record<number, TemplateStats> {
  const stats = useMasterDataStore.getState().stats;
  if (!stats) return STATIC_DEFAULT_STATS;
  const result: Record<number, TemplateStats> = {};
  for (const [level, patch] of Object.entries(stats.defaultStatsByLevel)) {
    const patchData = stats.patchStats[patch];
    if (patchData) result[Number(level)] = patchData;
  }
  return Object.keys(result).length > 0 ? result : STATIC_DEFAULT_STATS;
}

/** getMitigationPriority はデータ依存なしのためそのまま re-export */
export { getMitigationPriority };
