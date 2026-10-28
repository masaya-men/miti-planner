/**
 * src/lib/translationDataLoaders.ts
 *
 * 翻訳データの読み書きを行うモジュール。
 * カテゴリ（skills / contents / attacks / phases / others）ごとにロード・セーブ関数を提供。
 */

import { apiFetch } from './apiClient';
import { useMasterDataStore } from '../store/useMasterDataStore';
import type { LocalizedString, Mitigation, Job } from '../types';
import {
  getContentDefinitions,
  CATEGORY_LABELS,
  LEVEL_LABELS,
  CONTENT_SERIES,
} from '../data/contentRegistry';
import type { ContentCategory, ContentSeries } from '../types';
import type { TemplateData } from '../types/template';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export type TranslationCategory = 'skills' | 'contents' | 'attacks' | 'phases' | 'others';

export interface TranslationRow {
  id: string;           // ユニークキー (例: "pld_reprisal", "m1s", "m1s__tpl_0_6wevbp")
  ja: string;
  en: string;
  zh: string;
  zhHant: string;
  ko: string;
  group?: string;       // フィルタ用 (ジョブID、コンテンツID など)
  groupLabel?: string;  // フィルタ表示ラベル
  subCategory?: string; // "others" カテゴリ内のサブ分類
}

export interface TranslationDataSet {
  category: TranslationCategory;
  rows: TranslationRow[];
  groups: { value: string; label: string }[];
}

// ─────────────────────────────────────────────
// 内部ヘルパー
// ─────────────────────────────────────────────

/** LocalizedString を TranslationRow のフィールドに変換 */
function localizedToFields(name: LocalizedString): { ja: string; en: string; zh: string; zhHant: string; ko: string } {
  return {
    ja: name.ja ?? '',
    en: name.en ?? '',
    zh: name.zh ?? '',
    zhHant: name['zh-Hant'] ?? '',
    ko: name.ko ?? '',
  };
}

// ─────────────────────────────────────────────
// ロード関数
// ─────────────────────────────────────────────

/**
 * 1. スキル翻訳の読み込み
 * useMasterDataStore のキャッシュを優先し、なければ API から取得する。
 */
export async function loadSkillTranslations(): Promise<TranslationDataSet> {
  let jobs: Job[];
  let mitigations: Mitigation[];

  const storeSkills = useMasterDataStore.getState().skills;
  if (storeSkills) {
    jobs = storeSkills.jobs;
    mitigations = storeSkills.mitigations;
  } else {
    const res = await apiFetch('/api/admin?resource=templates&type=skills');
    if (!res.ok) throw new Error(`スキルデータ取得失敗: ${res.status}`);
    const data = await res.json() as { jobs: Job[]; mitigations: Mitigation[]; displayOrder: string[] };
    jobs = data.jobs;
    mitigations = data.mitigations;
  }

  // ジョブIDとジョブ名のマップを作成
  const jobNameMap = new Map(jobs.map(j => [j.id, j.name.ja || j.id]));

  // ジョブ名の翻訳行
  const jobRows: TranslationRow[] = jobs.map(j => ({
    id: `job:${j.id}`,
    ...localizedToFields(j.name),
    group: '__jobs__',
    groupLabel: 'ジョブ名',
  }));

  const skillRows: TranslationRow[] = mitigations.map(m => ({
    id: m.id,
    ...localizedToFields(m.name),
    group: m.jobId,
    groupLabel: jobNameMap.get(m.jobId) ?? m.jobId,
  }));

  const rows = [...jobRows, ...skillRows];

  const groups = [
    { value: '__jobs__', label: 'ジョブ名' },
    ...jobs.map(j => ({ value: j.id, label: j.name.ja || j.id })),
  ];

  return { category: 'skills', rows, groups };
}

/**
 * 2. コンテンツ翻訳の読み込み
 */
export async function loadContentTranslations(): Promise<TranslationDataSet> {
  let items = getContentDefinitions();

  try {
    const res = await apiFetch('/api/admin?resource=contents');
    if (res.ok) {
      const data = await res.json() as { items: typeof items; series: ContentSeries[] };
      if (data.items?.length) {
        items = data.items;
      }
    }
  } catch {
    // フォールバック: 静的データを使用
  }

  const rows: TranslationRow[] = items.map(item => ({
    id: item.id,
    ...localizedToFields(item.name),
    group: item.category,
    groupLabel: CATEGORY_LABELS[item.category]?.ja ?? item.category,
  }));

  const categoryValues = Array.from(new Set(items.map(i => i.category))) as ContentCategory[];
  const groups = categoryValues.map(cat => ({
    value: cat,
    label: CATEGORY_LABELS[cat]?.ja ?? cat,
  }));

  return { category: 'contents', rows, groups };
}

/**
 * 3. 攻撃名翻訳の読み込み（指定コンテンツのタイムラインイベント）
 */
export async function loadAttackTranslations(contentId: string): Promise<TranslationDataSet> {
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) throw new Error(`テンプレート取得失敗: ${res.status}`);
  const data = await res.json() as TemplateData;

  const rows: TranslationRow[] = (data.timelineEvents ?? []).map(event => ({
    id: `${contentId}__${event.id}`,
    ...localizedToFields(event.name),
    group: contentId,
    groupLabel: contentId,
  }));

  return {
    category: 'attacks',
    rows,
    groups: [{ value: contentId, label: contentId }],
  };
}

/**
 * 4. テンプレート一覧の取得（コンテンツ選択ドロップダウン用）
 */
export async function loadTemplateList(): Promise<{ value: string; label: string }[]> {
  const res = await apiFetch('/api/admin?resource=templates');
  if (!res.ok) throw new Error(`テンプレート一覧取得失敗: ${res.status}`);
  const data = await res.json() as { templates: { contentId: string; eventCount: number }[] };
  return (data.templates ?? []).map(t => ({ value: t.contentId, label: t.contentId }));
}

/**
 * 5. フェーズ翻訳の読み込み（指定コンテンツのフェーズ名）
 */
export async function loadPhaseTranslations(contentId: string): Promise<TranslationDataSet> {
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) throw new Error(`テンプレート取得失敗: ${res.status}`);
  const data = await res.json() as TemplateData;

  const rows: TranslationRow[] = (data.phases ?? []).map(phase => {
    // フェーズ名は旧形式(string)と新形式(LocalizedString)の両方に対応
    const rawName = phase.name;
    let name: LocalizedString;
    if (!rawName) {
      name = { ja: '', en: '' };
    } else if (typeof rawName === 'string') {
      name = { ja: rawName, en: '' };
    } else {
      name = rawName as unknown as LocalizedString;
    }

    return {
      id: `${contentId}__phase_${phase.id}`,
      ...localizedToFields(name),
      group: contentId,
      groupLabel: contentId,
    };
  });

  return {
    category: 'phases',
    rows,
    groups: [{ value: contentId, label: contentId }],
  };
}

/**
 * 6. その他翻訳の読み込み（カテゴリラベル・レベルラベル・シリーズ名）
 */
export async function loadOtherTranslations(): Promise<TranslationDataSet> {
  const rows: TranslationRow[] = [];

  // カテゴリラベル（5件）
  for (const [key, value] of Object.entries(CATEGORY_LABELS) as [ContentCategory, LocalizedString][]) {
    rows.push({
      id: `category__${key}`,
      ...localizedToFields(value),
      group: 'categoryLabels',
      groupLabel: 'カテゴリラベル',
      subCategory: 'categoryLabels',
    });
  }

  // レベルラベル（4件）
  for (const [key, value] of Object.entries(LEVEL_LABELS) as [string, LocalizedString][]) {
    rows.push({
      id: `level__${key}`,
      ...localizedToFields(value),
      group: 'levelLabels',
      groupLabel: 'レベルラベル',
      subCategory: 'levelLabels',
    });
  }

  // シリーズ名（13件以上）
  for (const series of CONTENT_SERIES) {
    rows.push({
      id: `series__${series.id}`,
      ...localizedToFields(series.name),
      group: 'seriesNames',
      groupLabel: 'シリーズ名',
      subCategory: 'seriesNames',
    });
  }

  const groups = [
    { value: 'categoryLabels', label: 'カテゴリラベル' },
    { value: 'levelLabels', label: 'レベルラベル' },
    { value: 'seriesNames', label: 'シリーズ名' },
  ];

  return { category: 'others', rows, groups };
}
