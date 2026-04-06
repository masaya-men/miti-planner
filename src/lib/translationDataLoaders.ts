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
import type { TemplateData } from '../data/templateLoader';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export type TranslationCategory = 'skills' | 'contents' | 'attacks' | 'phases' | 'others';

export interface TranslationRow {
  id: string;           // ユニークキー (例: "pld_reprisal", "m1s", "m1s__tpl_0_6wevbp")
  ja: string;
  en: string;
  zh: string;
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
function localizedToFields(name: LocalizedString): { ja: string; en: string; zh: string; ko: string } {
  return {
    ja: name.ja ?? '',
    en: name.en ?? '',
    zh: name.zh ?? '',
    ko: name.ko ?? '',
  };
}

/** 空文字列を undefined に変換（Firestore保存用） */
function emptyToUndefined(s: string): string | undefined {
  return s === '' ? undefined : s;
}

/** 変更されている行のみ抽出 */
function getChangedRows(rows: TranslationRow[], originalRows: TranslationRow[]): TranslationRow[] {
  const originalMap = new Map(originalRows.map(r => [r.id, r]));
  return rows.filter(row => {
    const orig = originalMap.get(row.id);
    if (!orig) return true;
    return (
      row.ja !== orig.ja ||
      row.en !== orig.en ||
      row.zh !== orig.zh ||
      row.ko !== orig.ko
    );
  });
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

// ─────────────────────────────────────────────
// セーブ関数
// ─────────────────────────────────────────────

/**
 * 7. スキル翻訳の保存
 */
export async function saveSkillTranslations(
  rows: TranslationRow[],
  originalRows: TranslationRow[],
): Promise<void> {
  const changed = getChangedRows(rows, originalRows);
  if (changed.length === 0) return;

  // 最新のスキルデータを取得
  const res = await apiFetch('/api/admin?resource=templates&type=skills');
  if (!res.ok) throw new Error(`スキルデータ取得失敗: ${res.status}`);
  const data = await res.json() as {
    jobs: Job[];
    mitigations: Mitigation[];
    displayOrder: string[];
  };

  const changedMap = new Map(changed.map(r => [r.id, r]));

  // 変更を jobs にマージ（job:xxx 形式のID）
  const updatedJobs = data.jobs.map((j: Job) => {
    const changedRow = changedMap.get(`job:${j.id}`);
    if (!changedRow) return j;
    return {
      ...j,
      name: {
        ja: changedRow.ja || j.name.ja,
        en: emptyToUndefined(changedRow.en) ?? j.name.en,
        zh: emptyToUndefined(changedRow.zh),
        ko: emptyToUndefined(changedRow.ko),
      } as LocalizedString,
    };
  });

  // 変更を mitigations にマージ
  const updatedMitigations = data.mitigations.map((m: Mitigation) => {
    const changedRow = changedMap.get(m.id);
    if (!changedRow) return m;
    return {
      ...m,
      name: {
        ja: changedRow.ja || m.name.ja,
        en: emptyToUndefined(changedRow.en) ?? m.name.en,
        zh: emptyToUndefined(changedRow.zh),
        ko: emptyToUndefined(changedRow.ko),
      } as LocalizedString,
    };
  });

  const putRes = await apiFetch('/api/admin?resource=templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'skills',
      jobs: updatedJobs,
      mitigations: updatedMitigations,
      displayOrder: data.displayOrder,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`スキル保存失敗: ${putRes.status} ${err}`);
  }
}

/**
 * 8. コンテンツ翻訳の保存
 */
export async function saveContentTranslations(
  rows: TranslationRow[],
  originalRows: TranslationRow[],
): Promise<void> {
  const changed = getChangedRows(rows, originalRows);
  if (changed.length === 0) return;

  // 変更された各コンテンツを個別に PUT
  for (const row of changed) {
    const putRes = await apiFetch('/api/admin?resource=contents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: {
          id: row.id,
          name: {
            ja: row.ja,
            en: emptyToUndefined(row.en),
            zh: emptyToUndefined(row.zh),
            ko: emptyToUndefined(row.ko),
          } as LocalizedString,
        },
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`コンテンツ保存失敗 (${row.id}): ${putRes.status} ${err}`);
    }
  }
}

/**
 * 9. 攻撃名翻訳の保存
 */
export async function saveAttackTranslations(
  contentId: string,
  rows: TranslationRow[],
  originalRows: TranslationRow[],
): Promise<void> {
  const changed = getChangedRows(rows, originalRows);
  if (changed.length === 0) return;

  // フルテンプレートを取得
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) throw new Error(`テンプレート取得失敗: ${res.status}`);
  const template = await res.json() as TemplateData;

  // イベントIDプレフィックスを除去して変更マップを作成
  const changedMap = new Map(
    changed.map(r => [r.id.replace(`${contentId}__`, ''), r]),
  );

  const updatedEvents = template.timelineEvents.map(event => {
    const changedRow = changedMap.get(event.id);
    if (!changedRow) return event;
    return {
      ...event,
      name: {
        ja: changedRow.ja || event.name.ja,
        en: emptyToUndefined(changedRow.en) ?? event.name.en,
        zh: emptyToUndefined(changedRow.zh),
        ko: emptyToUndefined(changedRow.ko),
      } as LocalizedString,
    };
  });

  const postRes = await apiFetch('/api/admin?resource=templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentId,
      timelineEvents: updatedEvents,
      phases: template.phases,
      source: 'translation_editor',
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`攻撃名保存失敗: ${postRes.status} ${err}`);
  }
}

/**
 * 10. フェーズ翻訳の保存
 */
export async function savePhaseTranslations(
  contentId: string,
  rows: TranslationRow[],
  originalRows: TranslationRow[],
): Promise<void> {
  const changed = getChangedRows(rows, originalRows);
  if (changed.length === 0) return;

  // フルテンプレートを取得
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) throw new Error(`テンプレート取得失敗: ${res.status}`);
  const template = await res.json() as TemplateData;

  // フェーズIDプレフィックスを除去して変更マップを作成
  // row.id 形式: "{contentId}__phase_{phaseId}"
  const changedMap = new Map(
    changed.map(r => {
      const phaseIdStr = r.id.replace(`${contentId}__phase_`, '');
      return [Number(phaseIdStr), r];
    }),
  );

  const updatedPhases = template.phases.map(phase => {
    const changedRow = changedMap.get(phase.id);
    if (!changedRow) return phase;

    const newName: LocalizedString = {
      ja: changedRow.ja,
      en: emptyToUndefined(changedRow.en) ?? '',
      zh: emptyToUndefined(changedRow.zh),
      ko: emptyToUndefined(changedRow.ko),
    };

    return {
      ...phase,
      name: newName,
    };
  });

  const postRes = await apiFetch('/api/admin?resource=templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentId,
      timelineEvents: template.timelineEvents,
      phases: updatedPhases,
      source: 'translation_editor',
    }),
  });

  if (!postRes.ok) {
    const err = await postRes.text();
    throw new Error(`フェーズ保存失敗: ${postRes.status} ${err}`);
  }
}

/**
 * 11. その他翻訳の保存（カテゴリラベル・レベルラベル・シリーズ名）
 */
export async function saveOtherTranslations(
  rows: TranslationRow[],
  originalRows: TranslationRow[],
): Promise<void> {
  const changed = getChangedRows(rows, originalRows);
  if (changed.length === 0) return;

  // サブカテゴリごとに分類
  const changedCategories = changed.filter(r => r.subCategory === 'categoryLabels');
  const changedLevels = changed.filter(r => r.subCategory === 'levelLabels');
  const changedSeries = changed.filter(r => r.subCategory === 'seriesNames');

  // カテゴリラベルとレベルラベルはまとめて取得して更新
  if (changedCategories.length > 0 || changedLevels.length > 0) {
    // 現在の config を取得
    const res = await apiFetch('/api/admin?resource=templates&type=config');
    if (!res.ok) throw new Error(`config取得失敗: ${res.status}`);
    const config = await res.json() as {
      categoryLabels: Record<string, LocalizedString>;
      levelLabels: Record<string, LocalizedString>;
      dataVersion: number;
    };

    let updatedCategoryLabels = { ...config.categoryLabels };
    let updatedLevelLabels = { ...config.levelLabels };

    // カテゴリラベルを更新
    for (const row of changedCategories) {
      const key = row.id.replace('category__', '') as ContentCategory;
      updatedCategoryLabels[key] = {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? updatedCategoryLabels[key]?.en ?? '',
        zh: emptyToUndefined(row.zh),
        ko: emptyToUndefined(row.ko),
      } as LocalizedString;
    }

    // レベルラベルを更新
    for (const row of changedLevels) {
      const key = row.id.replace('level__', '');
      updatedLevelLabels[key] = {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? updatedLevelLabels[key]?.en ?? '',
        zh: emptyToUndefined(row.zh),
        ko: emptyToUndefined(row.ko),
      } as LocalizedString;
    }

    const putRes = await apiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'config',
        categoryLabels: updatedCategoryLabels,
        levelLabels: updatedLevelLabels,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`ラベル保存失敗: ${putRes.status} ${err}`);
    }
  }

  // シリーズ名の一括更新（Task 6 で追加予定のエンドポイント）
  if (changedSeries.length > 0) {
    const seriesUpdates = changedSeries.map(row => ({
      id: row.id.replace('series__', ''),
      name: {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? '',
        zh: emptyToUndefined(row.zh),
        ko: emptyToUndefined(row.ko),
      } as LocalizedString,
    }));

    const putRes = await apiFetch('/api/admin?resource=contents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'series_bulk_update',
        series: seriesUpdates,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      throw new Error(`シリーズ名保存失敗: ${putRes.status} ${err}`);
    }
  }
}
