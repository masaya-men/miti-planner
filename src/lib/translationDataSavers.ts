/**
 * src/lib/translationDataSavers.ts
 *
 * 翻訳データの保存を行うモジュール。
 * カテゴリ（skills / contents / attacks / phases / others）ごとのセーブ関数を提供。
 */

import { apiFetch } from './apiClient';
import type { LocalizedString, Mitigation, Job, ContentCategory } from '../types';
import type { TemplateData } from '../types/template';
import type { TranslationRow } from './translationDataLoaders';

// ─────────────────────────────────────────────
// 内部ヘルパー
// ─────────────────────────────────────────────

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
      row.zhHant !== orig.zhHant ||
      row.ko !== orig.ko
    );
  });
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
        'zh-Hant': emptyToUndefined(changedRow.zhHant),
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
        'zh-Hant': emptyToUndefined(changedRow.zhHant),
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
            'zh-Hant': emptyToUndefined(row.zhHant),
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
        'zh-Hant': emptyToUndefined(changedRow.zhHant),
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
      'zh-Hant': emptyToUndefined(changedRow.zhHant),
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

    const updatedCategoryLabels = { ...config.categoryLabels };
    const updatedLevelLabels = { ...config.levelLabels };

    // カテゴリラベルを更新
    for (const row of changedCategories) {
      const key = row.id.replace('category__', '') as ContentCategory;
      updatedCategoryLabels[key] = {
        ja: row.ja,
        en: emptyToUndefined(row.en) ?? updatedCategoryLabels[key]?.en ?? '',
        zh: emptyToUndefined(row.zh),
        'zh-Hant': emptyToUndefined(row.zhHant),
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
        'zh-Hant': emptyToUndefined(row.zhHant),
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
        'zh-Hant': emptyToUndefined(row.zhHant),
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
