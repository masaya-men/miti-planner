# 翻訳管理画面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面に「翻訳」タブを追加し、全ゲームデータ（スキル名、コンテンツ名、攻撃名、フェーズ名等）の多言語翻訳をCSVインポート/エクスポート付きで一元管理する。

**Architecture:** 新規ルート `/admin/translations` に `AdminTranslations.tsx` を配置。カテゴリ切り替え式のテーブルUIで、各カテゴリのデータをFirestoreから読み出し・書き戻す。CSVエクスポート/インポートはクライアントサイドで処理。既存の管理画面コンポーネント（スキルモーダル等）には一切触れない。

**Tech Stack:** React + TypeScript, Zustand (useMasterDataStore), Firestore (既存API), i18next, Papa Parse (CSV処理)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/components/admin/AdminTranslations.tsx` (NEW) | 翻訳管理メインページ。カテゴリ切替、フィルタ、進捗バー、テーブル、保存 |
| `src/components/admin/TranslationTable.tsx` (NEW) | 編集可能テーブルコンポーネント。セル編集、変更追跡、未翻訳ハイライト |
| `src/components/admin/TranslationCsvTools.tsx` (NEW) | CSVエクスポート/インポートUI。ファイルアップロード、コピペ入力、差分プレビュー |
| `src/lib/translationDataLoaders.ts` (NEW) | カテゴリ別のデータ読み込み・保存ロジック。Firestore APIとの橋渡し |
| `src/components/admin/AdminLayout.tsx` (MODIFY) | NAV_ITEMSに翻訳タブ追加 |
| `src/App.tsx` (MODIFY) | `/admin/translations` ルート追加 |
| `src/locales/ja.json` (MODIFY) | 翻訳管理画面のi18nキー追加 |
| `src/locales/en.json` (MODIFY) | 同上（英語） |
| `src/types/index.ts` (MODIFY) | Phase.nameをLocalizedString化 |
| `api/admin/_contentsHandler.ts` (MODIFY) | シリーズ名のzh/ko保存対応 |

---

## Task 1: i18nキーとルート登録

**Files:**
- Modify: `src/locales/ja.json:1108付近`
- Modify: `src/locales/en.json:対応箇所`
- Modify: `src/components/admin/AdminLayout.tsx:11-21`
- Modify: `src/App.tsx:113-127`

- [ ] **Step 1: ja.jsonに翻訳管理画面のi18nキーを追加**

`src/locales/ja.json` の `admin` セクション（`"skills": "スキル管理"` の後）に追加:

```json
"translations": "翻訳管理",
"translations_title": "翻訳管理",
"translations_category_skills": "スキル",
"translations_category_contents": "コンテンツ",
"translations_category_attacks": "攻撃名",
"translations_category_phases": "フェーズ",
"translations_category_others": "その他",
"translations_filter_untranslated": "未翻訳のみ",
"translations_filter_job": "ジョブ",
"translations_filter_content": "コンテンツ",
"translations_filter_all": "すべて",
"translations_progress": "{{lang}}: {{done}}/{{total}} ({{percent}}%)",
"translations_export_csv": "CSVエクスポート",
"translations_import_csv": "CSVインポート",
"translations_import_paste": "テキスト貼り付け",
"translations_import_preview_title": "インポートプレビュー",
"translations_import_added": "追加: {{count}}件",
"translations_import_changed": "変更: {{count}}件",
"translations_import_unknown_ids": "不明なID: {{ids}}",
"translations_import_confirm": "インポート実行",
"translations_save": "保存",
"translations_save_confirm_jaen": "日本語/英語の変更が{{count}}件あります。既存データに影響します。よろしいですか？",
"translations_saved": "翻訳を保存しました",
"translations_no_changes": "変更はありません",
"translations_csv_header_no_edit": "※この列は編集しないでください"
```

- [ ] **Step 2: en.jsonに対応する英語キーを追加**

`src/locales/en.json` の `admin` セクションに追加:

```json
"translations": "Translations",
"translations_title": "Translation Manager",
"translations_category_skills": "Skills",
"translations_category_contents": "Contents",
"translations_category_attacks": "Attacks",
"translations_category_phases": "Phases",
"translations_category_others": "Others",
"translations_filter_untranslated": "Untranslated only",
"translations_filter_job": "Job",
"translations_filter_content": "Content",
"translations_filter_all": "All",
"translations_progress": "{{lang}}: {{done}}/{{total}} ({{percent}}%)",
"translations_export_csv": "Export CSV",
"translations_import_csv": "Import CSV",
"translations_import_paste": "Paste text",
"translations_import_preview_title": "Import Preview",
"translations_import_added": "Added: {{count}}",
"translations_import_changed": "Changed: {{count}}",
"translations_import_unknown_ids": "Unknown IDs: {{ids}}",
"translations_import_confirm": "Import",
"translations_save": "Save",
"translations_save_confirm_jaen": "{{count}} Japanese/English changes detected. This affects existing data. Continue?",
"translations_saved": "Translations saved",
"translations_no_changes": "No changes",
"translations_csv_header_no_edit": "* Do not edit this column"
```

- [ ] **Step 3: AdminLayout.tsxにナビ項目追加**

`src/components/admin/AdminLayout.tsx` の NAV_ITEMS配列の `skills` の後に追加:

```typescript
{ path: '/admin/translations', labelKey: 'admin.translations', end: false },
```

- [ ] **Step 4: App.tsxにルート追加**

`src/App.tsx` に import追加:

```typescript
import { AdminTranslations } from './components/admin/AdminTranslations';
```

`<Route path="skills" .../>` の後にルート追加:

```tsx
<Route path="translations" element={<AdminTranslations />} />
```

- [ ] **Step 5: AdminTranslations.tsxの空コンポーネントを作成**

`src/components/admin/AdminTranslations.tsx` を作成:

```tsx
import { useTranslation } from 'react-i18next';

export function AdminTranslations() {
  const { t } = useTranslation();
  return (
    <div>
      <h1 className="text-app-2xl font-bold mb-6">{t('admin.translations_title')}</h1>
      <p className="text-app-text-muted">Coming soon...</p>
    </div>
  );
}
```

- [ ] **Step 6: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/components/admin/AdminLayout.tsx src/App.tsx src/components/admin/AdminTranslations.tsx
git commit -m "feat: 翻訳管理画面のルート・i18n・空コンポーネントを追加"
```

---

## Task 2: データローダー（translationDataLoaders.ts）

**Files:**
- Create: `src/lib/translationDataLoaders.ts`

- [ ] **Step 1: カテゴリ型とテーブル行の型を定義**

`src/lib/translationDataLoaders.ts` を作成:

```typescript
import { apiFetch } from './apiClient';
import { useMasterDataStore } from '../store/useMasterDataStore';
import type { LocalizedString, Mitigation, Job } from '../types';
import { getContentDefinitions } from '../data/contentRegistry';
import {
  CATEGORY_LABELS, LEVEL_LABELS, CONTENT_SERIES,
} from '../data/contentRegistry';

export type TranslationCategory = 'skills' | 'contents' | 'attacks' | 'phases' | 'others';

export interface TranslationRow {
  id: string;           // 一意キー（例: "pld_reprisal", "m1s", "m1s__tpl_0_6wevbp"）
  ja: string;
  en: string;
  zh: string;
  ko: string;
  group?: string;       // フィルタ用（ジョブ名、コンテンツID等）
  groupLabel?: string;  // フィルタ表示用
  subCategory?: string; // 「その他」カテゴリ内のサブ分類
}

export interface TranslationDataSet {
  category: TranslationCategory;
  rows: TranslationRow[];
  groups: { value: string; label: string }[];  // フィルタ選択肢
}
```

- [ ] **Step 2: スキルデータの読み込み関数**

```typescript
export async function loadSkillTranslations(): Promise<TranslationDataSet> {
  const store = useMasterDataStore.getState();
  let jobs: Job[] = [];
  let mitigations: Mitigation[] = [];

  if (store.skills) {
    jobs = store.skills.jobs;
    mitigations = store.skills.mitigations;
  } else {
    const res = await apiFetch('/api/admin?resource=templates&type=skills');
    if (res.ok) {
      const data = await res.json();
      jobs = data.jobs || [];
      mitigations = data.mitigations || [];
    }
  }

  const jobMap = new Map(jobs.map(j => [j.id, j]));
  const rows: TranslationRow[] = mitigations.map(m => ({
    id: m.id,
    ja: m.name.ja,
    en: m.name.en,
    zh: m.name.zh || '',
    ko: m.name.ko || '',
    group: m.jobId,
    groupLabel: jobMap.get(m.jobId)?.name.ja || m.jobId,
  }));

  const groups = jobs.map(j => ({ value: j.id, label: j.name.ja }));
  return { category: 'skills', rows, groups };
}
```

- [ ] **Step 3: コンテンツデータの読み込み関数**

```typescript
export async function loadContentTranslations(): Promise<TranslationDataSet> {
  // Firestore優先、なければ静的データ
  let items = getContentDefinitions();

  // Firestoreからの最新データを試みる
  try {
    const res = await apiFetch('/api/admin?resource=contents');
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length) items = data.items;
    }
  } catch { /* 静的データを使用 */ }

  const rows: TranslationRow[] = items.map(c => ({
    id: c.id,
    ja: c.name.ja,
    en: c.name.en,
    zh: c.name.zh || '',
    ko: c.name.ko || '',
    group: c.category,
    groupLabel: CATEGORY_LABELS[c.category]?.ja || c.category,
  }));

  const categorySet = new Set(items.map(c => c.category));
  const groups = Array.from(categorySet).map(cat => ({
    value: cat,
    label: CATEGORY_LABELS[cat]?.ja || cat,
  }));

  return { category: 'contents', rows, groups };
}
```

- [ ] **Step 4: 攻撃名データの読み込み関数**

```typescript
export async function loadAttackTranslations(contentId: string): Promise<TranslationDataSet> {
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) return { category: 'attacks', rows: [], groups: [] };

  const data = await res.json();
  const events = data.timelineEvents || [];

  const rows: TranslationRow[] = events.map((ev: any) => ({
    id: `${contentId}__${ev.id}`,
    ja: ev.name?.ja || '',
    en: ev.name?.en || '',
    zh: ev.name?.zh || '',
    ko: ev.name?.ko || '',
    group: contentId,
  }));

  return { category: 'attacks', rows, groups: [] };
}

// コンテンツ一覧取得（攻撃名カテゴリのフィルタ選択肢用）
export async function loadTemplateList(): Promise<{ value: string; label: string }[]> {
  const res = await apiFetch('/api/admin?resource=templates');
  if (!res.ok) return [];
  const data = await res.json();
  const templates = data.templates || [];

  const contentDefs = getContentDefinitions();
  const nameMap = new Map(contentDefs.map(c => [c.id, c.name.ja]));

  return templates.map((t: any) => ({
    value: t.contentId,
    label: nameMap.get(t.contentId) || t.contentId,
  }));
}
```

- [ ] **Step 5: フェーズデータの読み込み関数**

```typescript
export async function loadPhaseTranslations(contentId: string): Promise<TranslationDataSet> {
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) return { category: 'phases', rows: [], groups: [] };

  const data = await res.json();
  const phases = data.phases || [];

  const rows: TranslationRow[] = phases.map((p: any) => {
    // フェーズ名がstring（旧形式）の場合の正規化
    const name = typeof p.name === 'string'
      ? { ja: '', en: p.name, zh: '', ko: '' }
      : { ja: p.name?.ja || '', en: p.name?.en || '', zh: p.name?.zh || '', ko: p.name?.ko || '' };

    return {
      id: `${contentId}__phase_${p.id}`,
      ja: name.ja,
      en: name.en,
      zh: name.zh,
      ko: name.ko,
      group: contentId,
    };
  });

  return { category: 'phases', rows, groups: [] };
}
```

- [ ] **Step 6: その他データの読み込み関数**

```typescript
export async function loadOtherTranslations(): Promise<TranslationDataSet> {
  const rows: TranslationRow[] = [];

  // カテゴリ名（5件）
  for (const [key, val] of Object.entries(CATEGORY_LABELS)) {
    rows.push({
      id: `category__${key}`,
      ja: val.ja, en: val.en, zh: val.zh || '', ko: val.ko || '',
      subCategory: 'カテゴリ名',
    });
  }

  // レベル名（4件）
  for (const [key, val] of Object.entries(LEVEL_LABELS)) {
    rows.push({
      id: `level__${key}`,
      ja: val.ja, en: val.en, zh: val.zh || '', ko: val.ko || '',
      subCategory: 'レベル名',
    });
  }

  // シリーズ名（13件）
  for (const s of CONTENT_SERIES) {
    rows.push({
      id: `series__${s.id}`,
      ja: s.name.ja, en: s.name.en, zh: s.name.zh || '', ko: s.name.ko || '',
      subCategory: 'シリーズ名',
    });
  }

  return { category: 'others', rows, groups: [] };
}
```

- [ ] **Step 7: 保存関数群**

```typescript
export async function saveSkillTranslations(
  rows: TranslationRow[],
  originalRows: TranslationRow[]
): Promise<void> {
  // 変更があった行だけ抽出
  const changed = rows.filter((r, i) => {
    const o = originalRows[i];
    return r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko;
  });
  if (changed.length === 0) return;

  // 現在のスキルデータを取得
  const res = await apiFetch('/api/admin?resource=templates&type=skills');
  if (!res.ok) throw new Error('Failed to load skills');
  const data = await res.json();

  const changedMap = new Map(changed.map(r => [r.id, r]));
  const mitigations = data.mitigations.map((m: any) => {
    const update = changedMap.get(m.id);
    if (!update) return m;
    return {
      ...m,
      name: { ja: update.ja, en: update.en, zh: update.zh || undefined, ko: update.ko || undefined },
    };
  });

  const saveRes = await apiFetch('/api/admin?resource=templates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'skills',
      jobs: data.jobs,
      mitigations,
      displayOrder: data.displayOrder || [],
    }),
  });
  if (!saveRes.ok) throw new Error('Failed to save skills');
}

export async function saveContentTranslations(
  rows: TranslationRow[],
  originalRows: TranslationRow[]
): Promise<void> {
  const changed = rows.filter((r, i) => {
    const o = originalRows[i];
    return r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko;
  });
  if (changed.length === 0) return;

  const changedMap = new Map(changed.map(r => [r.id, r]));

  for (const [id, update] of changedMap) {
    await apiFetch('/api/admin?resource=contents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item: {
          id,
          name: { ja: update.ja, en: update.en, zh: update.zh || undefined, ko: update.ko || undefined },
        },
      }),
    });
  }
}

export async function saveAttackTranslations(
  contentId: string,
  rows: TranslationRow[],
  originalRows: TranslationRow[]
): Promise<void> {
  const changed = rows.filter((r, i) => {
    const o = originalRows[i];
    return r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko;
  });
  if (changed.length === 0) return;

  // テンプレート全体を取得して更新
  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) throw new Error('Failed to load template');
  const data = await res.json();

  const changedMap = new Map(changed.map(r => [r.id.replace(`${contentId}__`, ''), r]));
  const timelineEvents = data.timelineEvents.map((ev: any) => {
    const update = changedMap.get(ev.id);
    if (!update) return ev;
    return {
      ...ev,
      name: { ja: update.ja, en: update.en, zh: update.zh || undefined, ko: update.ko || undefined },
    };
  });

  await apiFetch('/api/admin?resource=templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentId,
      timelineEvents,
      phases: data.phases || [],
      source: data.source || 'admin_translation',
    }),
  });
}

export async function savePhaseTranslations(
  contentId: string,
  rows: TranslationRow[],
  originalRows: TranslationRow[]
): Promise<void> {
  const changed = rows.filter((r, i) => {
    const o = originalRows[i];
    return r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko;
  });
  if (changed.length === 0) return;

  const res = await apiFetch(`/api/admin?resource=templates&id=${contentId}`);
  if (!res.ok) throw new Error('Failed to load template');
  const data = await res.json();

  const changedMap = new Map(changed.map(r => {
    const phaseId = r.id.replace(`${contentId}__phase_`, '');
    return [phaseId, r];
  }));

  const phases = data.phases.map((p: any) => {
    const update = changedMap.get(String(p.id));
    if (!update) return p;
    return {
      ...p,
      name: { ja: update.ja, en: update.en, zh: update.zh || undefined, ko: update.ko || undefined },
    };
  });

  await apiFetch('/api/admin?resource=templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentId,
      timelineEvents: data.timelineEvents,
      phases,
      source: data.source || 'admin_translation',
    }),
  });
}

export async function saveOtherTranslations(
  rows: TranslationRow[],
  originalRows: TranslationRow[]
): Promise<void> {
  const changed = rows.filter((r, i) => {
    const o = originalRows[i];
    return r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko;
  });
  if (changed.length === 0) return;

  // カテゴリ名・レベル名 → master/config に保存
  const categoryUpdates: Record<string, any> = {};
  const levelUpdates: Record<string, any> = {};
  const seriesUpdates: Map<string, TranslationRow> = new Map();

  for (const r of changed) {
    const ls = { ja: r.ja, en: r.en, zh: r.zh || undefined, ko: r.ko || undefined };
    if (r.id.startsWith('category__')) {
      categoryUpdates[r.id.replace('category__', '')] = ls;
    } else if (r.id.startsWith('level__')) {
      levelUpdates[r.id.replace('level__', '')] = ls;
    } else if (r.id.startsWith('series__')) {
      seriesUpdates.set(r.id.replace('series__', ''), r);
    }
  }

  // カテゴリ・レベル名の保存（master/config）
  if (Object.keys(categoryUpdates).length > 0 || Object.keys(levelUpdates).length > 0) {
    const configRes = await apiFetch('/api/admin?resource=templates&type=config');
    const config = configRes.ok ? await configRes.json() : {};

    const body: any = { type: 'config' };
    if (Object.keys(categoryUpdates).length > 0) {
      body.categoryLabels = { ...(config.categoryLabels || {}), ...categoryUpdates };
    }
    if (Object.keys(levelUpdates).length > 0) {
      body.levelLabels = { ...(config.levelLabels || {}), ...levelUpdates };
    }

    await apiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // シリーズ名の保存（master/contents.series）
  if (seriesUpdates.size > 0) {
    const contentsRes = await apiFetch('/api/admin?resource=contents');
    if (contentsRes.ok) {
      const data = await contentsRes.json();
      const seriesList = (data.series || []).map((s: any) => {
        const update = seriesUpdates.get(s.id);
        if (!update) return s;
        return { ...s, name: { ja: update.ja, en: update.en, zh: update.zh || undefined, ko: update.ko || undefined } };
      });
      // contentsハンドラーにはシリーズ一括更新がないのでPUTでitems+seriesをマージ
      // → Task 6で専用エンドポイント追加
    }
  }
}
```

- [ ] **Step 8: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 9: コミット**

```bash
git add src/lib/translationDataLoaders.ts
git commit -m "feat: 翻訳データローダー（読み込み・保存関数群）を追加"
```

---

## Task 3: TranslationTable.tsx（編集可能テーブル）

**Files:**
- Create: `src/components/admin/TranslationTable.tsx`

- [ ] **Step 1: テーブルコンポーネントを作成**

```tsx
import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranslationRow } from '../../lib/translationDataLoaders';

interface Props {
  rows: TranslationRow[];
  originalRows: TranslationRow[];
  onChange: (rowIndex: number, field: 'ja' | 'en' | 'zh' | 'ko', value: string) => void;
}

export function TranslationTable({ rows, originalRows, onChange }: Props) {
  const { t } = useTranslation();
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const isChanged = useCallback((rowIdx: number, field: 'ja' | 'en' | 'zh' | 'ko') => {
    const orig = originalRows[rowIdx];
    if (!orig) return false;
    return rows[rowIdx][field] !== orig[field];
  }, [rows, originalRows]);

  const isEmpty = useCallback((value: string) => !value.trim(), []);

  const isJaEnChanged = useCallback((rowIdx: number, field: string) => {
    return (field === 'ja' || field === 'en') && isChanged(rowIdx, field as 'ja' | 'en');
  }, [isChanged]);

  return (
    <div className="overflow-x-auto border border-app-text/10 rounded">
      <table className="w-full text-app-base">
        <thead>
          <tr className="bg-app-text/5 border-b border-app-text/10">
            <th className="px-3 py-2 text-left font-medium w-48">ID</th>
            <th className="px-3 py-2 text-left font-medium">日本語</th>
            <th className="px-3 py-2 text-left font-medium">English</th>
            <th className="px-3 py-2 text-left font-medium">中文</th>
            <th className="px-3 py-2 text-left font-medium">한국어</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className="border-b border-app-text/5 hover:bg-app-text/3">
              <td className="px-3 py-1.5 text-app-text-muted text-app-sm font-mono truncate max-w-48">
                {row.id}
              </td>
              {(['ja', 'en', 'zh', 'ko'] as const).map(field => {
                const editing = editingCell?.row === idx && editingCell?.field === field;
                const changed = isChanged(idx, field);
                const empty = isEmpty(row[field]);
                const jaEnWarn = isJaEnChanged(idx, field);

                return (
                  <td
                    key={field}
                    className={`px-1 py-0.5 cursor-text ${
                      jaEnWarn ? 'bg-yellow-500/15 ring-1 ring-yellow-500/40' :
                      changed ? 'bg-blue-500/10' :
                      empty ? 'bg-red-500/5' : ''
                    }`}
                    onClick={() => setEditingCell({ row: idx, field })}
                  >
                    {editing ? (
                      <input
                        autoFocus
                        className="w-full px-2 py-1 bg-app-bg border border-app-text/20 rounded text-app-base outline-none focus:border-blue-500"
                        value={row[field]}
                        onChange={e => onChange(idx, field, e.target.value)}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null);
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const fields = ['ja', 'en', 'zh', 'ko'] as const;
                            const nextField = fields[(fields.indexOf(field) + 1) % fields.length];
                            const nextRow = nextField === 'ja' ? idx + 1 : idx;
                            if (nextRow < rows.length) setEditingCell({ row: nextRow, field: nextField });
                          }
                        }}
                      />
                    ) : (
                      <div className="px-2 py-1 min-h-[28px]">
                        {row[field] || <span className="text-app-text-muted/40 italic">—</span>}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/TranslationTable.tsx
git commit -m "feat: 翻訳テーブルコンポーネント（セル編集・変更追跡・未翻訳ハイライト）"
```

---

## Task 4: TranslationCsvTools.tsx（CSV連携）

**Files:**
- Create: `src/components/admin/TranslationCsvTools.tsx`

- [ ] **Step 1: papaparseをインストール**

Run: `npm install papaparse && npm install -D @types/papaparse`

- [ ] **Step 2: CSVツールコンポーネントを作成**

```tsx
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Papa from 'papaparse';
import type { TranslationRow } from '../../lib/translationDataLoaders';

interface Props {
  rows: TranslationRow[];
  category: string;
  onImport: (updates: Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>) => void;
}

interface ImportPreview {
  added: { lang: string; count: number }[];
  changed: { lang: string; count: number }[];
  unknownIds: string[];
  updates: Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>;
}

export function TranslationCsvTools({ rows, category, onImport }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  // --- エクスポート ---
  const handleExport = () => {
    const header = `ID,${t('admin.translations_csv_header_no_edit')} ja,${t('admin.translations_csv_header_no_edit')} en,zh,ko`;
    const csvRows = rows.map(r =>
      [r.id, csvEscape(r.ja), csvEscape(r.en), csvEscape(r.zh), csvEscape(r.ko)].join(',')
    );
    const csv = [header, ...csvRows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translations_${category}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- インポート（パース） ---
  const parseCSV = (csvText: string) => {
    const result = Papa.parse<Record<string, string>>(csvText.trim(), {
      header: true,
      skipEmptyLines: true,
    });

    const rowMap = new Map(rows.map(r => [r.id, r]));
    const updates = new Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>();
    const unknownIds: string[] = [];
    let zhAdded = 0, koAdded = 0, jaChanged = 0, enChanged = 0, zhChanged = 0, koChanged = 0;

    for (const parsed of result.data) {
      const id = parsed['ID'] || parsed['id'];
      if (!id) continue;

      const existing = rowMap.get(id);
      if (!existing) {
        unknownIds.push(id);
        continue;
      }

      const update: any = {};
      // ja/en列のヘッダーは「※この列は編集しないでください ja」のような形式なので柔軟に取得
      const jaKey = Object.keys(parsed).find(k => k.includes('ja')) || 'ja';
      const enKey = Object.keys(parsed).find(k => k.includes('en')) || 'en';
      const jaVal = parsed[jaKey]?.trim();
      const enVal = parsed[enKey]?.trim();
      const zhVal = parsed['zh']?.trim();
      const koVal = parsed['ko']?.trim();

      if (jaVal && jaVal !== existing.ja) { update.ja = jaVal; jaChanged++; }
      if (enVal && enVal !== existing.en) { update.en = enVal; enChanged++; }
      if (zhVal && !existing.zh && zhVal) { update.zh = zhVal; zhAdded++; }
      else if (zhVal && zhVal !== existing.zh) { update.zh = zhVal; zhChanged++; }
      if (koVal && !existing.ko && koVal) { update.ko = koVal; koAdded++; }
      else if (koVal && koVal !== existing.ko) { update.ko = koVal; koChanged++; }

      if (Object.keys(update).length > 0) updates.set(id, update);
    }

    setPreview({
      added: [
        { lang: 'zh', count: zhAdded },
        { lang: 'ko', count: koAdded },
      ].filter(a => a.count > 0),
      changed: [
        { lang: 'ja', count: jaChanged },
        { lang: 'en', count: enChanged },
        { lang: 'zh', count: zhChanged },
        { lang: 'ko', count: koChanged },
      ].filter(c => c.count > 0),
      unknownIds,
      updates,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parseCSV(reader.result as string);
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handlePasteImport = () => {
    if (pasteText.trim()) parseCSV(pasteText);
  };

  const handleConfirmImport = () => {
    if (preview?.updates) {
      onImport(preview.updates);
      setPreview(null);
      setPasteMode(false);
      setPasteText('');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* ツールバー */}
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={handleExport} className="px-3 py-1.5 border border-app-text/20 rounded hover:bg-app-text/5 text-app-base">
          {t('admin.translations_export_csv')}
        </button>
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 border border-app-text/20 rounded hover:bg-app-text/5 text-app-base">
          {t('admin.translations_import_csv')}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFileUpload} />
        <button onClick={() => setPasteMode(!pasteMode)} className="px-3 py-1.5 border border-app-text/20 rounded hover:bg-app-text/5 text-app-base">
          {t('admin.translations_import_paste')}
        </button>
      </div>

      {/* コピペ入力エリア */}
      {pasteMode && (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full h-32 p-2 border border-app-text/20 rounded bg-app-bg text-app-base font-mono text-app-sm"
            placeholder="CSV/TSVテキストを貼り付け..."
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <button onClick={handlePasteImport} className="self-start px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-app-base">
            解析
          </button>
        </div>
      )}

      {/* 差分プレビュー */}
      {preview && (
        <div className="border border-app-text/20 rounded p-4 bg-app-text/3">
          <h3 className="font-bold mb-2">{t('admin.translations_import_preview_title')}</h3>

          {preview.added.map(a => (
            <div key={a.lang} className="text-blue-500">
              {t('admin.translations_import_added', { count: a.count })} ({a.lang})
            </div>
          ))}
          {preview.changed.map(c => (
            <div key={c.lang} className={c.lang === 'ja' || c.lang === 'en' ? 'text-yellow-500 font-bold' : 'text-app-text'}>
              {t('admin.translations_import_changed', { count: c.count })} ({c.lang})
              {(c.lang === 'ja' || c.lang === 'en') && ' ⚠️'}
            </div>
          ))}
          {preview.unknownIds.length > 0 && (
            <div className="text-red-500 mt-1">
              {t('admin.translations_import_unknown_ids', { ids: preview.unknownIds.slice(0, 5).join(', ') })}
              {preview.unknownIds.length > 5 && ` (+${preview.unknownIds.length - 5})`}
            </div>
          )}

          {preview.updates.size > 0 && (
            <button onClick={handleConfirmImport} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {t('admin.translations_import_confirm')}
            </button>
          )}
          {preview.updates.size === 0 && (
            <div className="mt-2 text-app-text-muted">{t('admin.translations_no_changes')}</div>
          )}
        </div>
      )}
    </div>
  );
}

function csvEscape(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/TranslationCsvTools.tsx
git commit -m "feat: CSV翻訳ツール（エクスポート・インポート・差分プレビュー）"
```

---

## Task 5: AdminTranslations.tsx（メインページ組み立て）

**Files:**
- Modify: `src/components/admin/AdminTranslations.tsx`

- [ ] **Step 1: メインコンポーネントを実装**

`src/components/admin/AdminTranslations.tsx` を以下に書き換え:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TranslationTable } from './TranslationTable';
import { TranslationCsvTools } from './TranslationCsvTools';
import {
  TranslationCategory, TranslationRow, TranslationDataSet,
  loadSkillTranslations, loadContentTranslations,
  loadAttackTranslations, loadPhaseTranslations,
  loadOtherTranslations, loadTemplateList,
  saveSkillTranslations, saveContentTranslations,
  saveAttackTranslations, savePhaseTranslations,
  saveOtherTranslations,
} from '../../lib/translationDataLoaders';

const CATEGORIES: { key: TranslationCategory; labelKey: string }[] = [
  { key: 'skills', labelKey: 'admin.translations_category_skills' },
  { key: 'contents', labelKey: 'admin.translations_category_contents' },
  { key: 'attacks', labelKey: 'admin.translations_category_attacks' },
  { key: 'phases', labelKey: 'admin.translations_category_phases' },
  { key: 'others', labelKey: 'admin.translations_category_others' },
];

export function AdminTranslations() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TranslationCategory>('skills');
  const [rows, setRows] = useState<TranslationRow[]>([]);
  const [originalRows, setOriginalRows] = useState<TranslationRow[]>([]);
  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [untranslatedOnly, setUntranslatedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  // 攻撃名・フェーズ用のコンテンツ選択
  const [templateList, setTemplateList] = useState<{ value: string; label: string }[]>([]);
  const [selectedContent, setSelectedContent] = useState('');

  // データ読み込み
  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      let result: TranslationDataSet;

      if (category === 'skills') {
        result = await loadSkillTranslations();
      } else if (category === 'contents') {
        result = await loadContentTranslations();
      } else if (category === 'attacks') {
        if (!selectedContent) {
          const list = await loadTemplateList();
          setTemplateList(list);
          setRows([]);
          setOriginalRows([]);
          setLoading(false);
          return;
        }
        result = await loadAttackTranslations(selectedContent);
      } else if (category === 'phases') {
        if (!selectedContent) {
          const list = await loadTemplateList();
          setTemplateList(list);
          setRows([]);
          setOriginalRows([]);
          setLoading(false);
          return;
        }
        result = await loadPhaseTranslations(selectedContent);
      } else {
        result = await loadOtherTranslations();
      }

      setRows(result.rows);
      setOriginalRows(result.rows.map(r => ({ ...r })));
      setGroups(result.groups);
      setSelectedGroup('');
    } catch (err) {
      setMessage('読み込みエラー');
      console.error(err);
    }
    setLoading(false);
  }, [category, selectedContent]);

  useEffect(() => { loadData(); }, [loadData]);

  // テンプレートリストの初期読み込み
  useEffect(() => {
    if (category === 'attacks' || category === 'phases') {
      loadTemplateList().then(setTemplateList);
      setSelectedContent('');
    }
  }, [category]);

  // セル変更
  const handleCellChange = useCallback((rowIndex: number, field: 'ja' | 'en' | 'zh' | 'ko', value: string) => {
    setRows(prev => {
      const next = [...prev];
      next[rowIndex] = { ...next[rowIndex], [field]: value };
      return next;
    });
  }, []);

  // CSVインポートの適用
  const handleImport = useCallback((updates: Map<string, { ja?: string; en?: string; zh?: string; ko?: string }>) => {
    setRows(prev => prev.map(r => {
      const update = updates.get(r.id);
      if (!update) return r;
      return { ...r, ...update };
    }));
  }, []);

  // 保存
  const handleSave = useCallback(async () => {
    // ja/en変更の確認
    const jaEnChanges = rows.filter((r, i) => {
      const o = originalRows[i];
      return o && (r.ja !== o.ja || r.en !== o.en);
    }).length;

    if (jaEnChanges > 0) {
      const confirmed = window.confirm(
        t('admin.translations_save_confirm_jaen', { count: jaEnChanges })
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setMessage('');
    try {
      if (category === 'skills') await saveSkillTranslations(rows, originalRows);
      else if (category === 'contents') await saveContentTranslations(rows, originalRows);
      else if (category === 'attacks') await saveAttackTranslations(selectedContent, rows, originalRows);
      else if (category === 'phases') await savePhaseTranslations(selectedContent, rows, originalRows);
      else if (category === 'others') await saveOtherTranslations(rows, originalRows);

      setOriginalRows(rows.map(r => ({ ...r })));
      setMessage(t('admin.translations_saved'));
    } catch (err) {
      setMessage('保存エラー');
      console.error(err);
    }
    setSaving(false);
  }, [category, rows, originalRows, selectedContent, t]);

  // 変更有無
  const hasChanges = rows.some((r, i) => {
    const o = originalRows[i];
    return o && (r.ja !== o.ja || r.en !== o.en || r.zh !== o.zh || r.ko !== o.ko);
  });

  // フィルタ適用
  const filteredRows = rows.filter(r => {
    if (selectedGroup && r.group !== selectedGroup) return false;
    if (untranslatedOnly && r.zh && r.ko) return false;
    return true;
  });

  // フィルタ適用後の行のインデックスマッピング
  const filteredIndices = rows.reduce<number[]>((acc, r, i) => {
    if (selectedGroup && r.group !== selectedGroup) return acc;
    if (untranslatedOnly && r.zh && r.ko) return acc;
    acc.push(i);
    return acc;
  }, []);

  // 進捗計算
  const zhDone = rows.filter(r => r.zh.trim()).length;
  const koDone = rows.filter(r => r.ko.trim()).length;
  const total = rows.length;
  const zhPercent = total ? Math.round((zhDone / total) * 100) : 0;
  const koPercent = total ? Math.round((koDone / total) * 100) : 0;

  return (
    <div className="max-w-[1200px]">
      <h1 className="text-app-2xl font-bold mb-4">{t('admin.translations_title')}</h1>

      {/* カテゴリ切り替え */}
      <div className="flex gap-1 mb-4 border-b border-app-text/10 pb-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={`px-4 py-2 rounded-t text-app-base transition-colors ${
              category === cat.key
                ? 'bg-app-text/10 font-bold border-b-2 border-app-text'
                : 'hover:bg-app-text/5'
            }`}
          >
            {t(cat.labelKey)}
          </button>
        ))}
      </div>

      {/* コンテンツ選択（攻撃名・フェーズ用） */}
      {(category === 'attacks' || category === 'phases') && (
        <div className="mb-4">
          <select
            value={selectedContent}
            onChange={e => setSelectedContent(e.target.value)}
            className="px-3 py-2 border border-app-text/20 rounded bg-app-bg text-app-base"
          >
            <option value="">{t('admin.translations_filter_content')}...</option>
            {templateList.map(tpl => (
              <option key={tpl.value} value={tpl.value}>{tpl.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* フィルタバー */}
      <div className="flex gap-3 items-center mb-3 flex-wrap">
        {groups.length > 0 && (
          <select
            value={selectedGroup}
            onChange={e => setSelectedGroup(e.target.value)}
            className="px-3 py-1.5 border border-app-text/20 rounded bg-app-bg text-app-base"
          >
            <option value="">{t('admin.translations_filter_all')}</option>
            {groups.map(g => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 text-app-base cursor-pointer">
          <input
            type="checkbox"
            checked={untranslatedOnly}
            onChange={e => setUntranslatedOnly(e.target.checked)}
          />
          {t('admin.translations_filter_untranslated')}
        </label>
      </div>

      {/* 進捗バー */}
      {total > 0 && (
        <div className="flex gap-4 mb-3 text-app-sm text-app-text-muted">
          <span>zh: {zhDone}/{total} ({zhPercent}%)</span>
          <span>ko: {koDone}/{total} ({koPercent}%)</span>
        </div>
      )}

      {/* CSV連携 */}
      <TranslationCsvTools rows={rows} category={category} onImport={handleImport} />

      {/* テーブル */}
      <div className="mt-4">
        {loading ? (
          <div className="text-app-text-muted py-8 text-center">読み込み中...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-app-text-muted py-8 text-center">
            {(category === 'attacks' || category === 'phases') && !selectedContent
              ? 'コンテンツを選択してください'
              : 'データがありません'}
          </div>
        ) : (
          <TranslationTable
            rows={filteredRows}
            originalRows={filteredIndices.map(i => originalRows[i])}
            onChange={(filteredIdx, field, value) => {
              const realIdx = filteredIndices[filteredIdx];
              handleCellChange(realIdx, field, value);
            }}
          />
        )}
      </div>

      {/* 保存ボタン・メッセージ */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={`px-6 py-2 rounded text-app-base font-bold transition-colors ${
            hasChanges && !saving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-app-text/10 text-app-text-muted cursor-not-allowed'
          }`}
        >
          {saving ? '保存中...' : t('admin.translations_save')}
        </button>
        {message && (
          <span className={message.includes('エラー') ? 'text-red-500' : 'text-green-600'}>
            {message}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/AdminTranslations.tsx
git commit -m "feat: 翻訳管理メインページ（カテゴリ切替・フィルタ・進捗・保存）"
```

---

## Task 6: シリーズ名のFirestore対応とPhase名のLocalizedString化

**Files:**
- Modify: `api/admin/_contentsHandler.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: contentsハンドラーにシリーズ一括更新エンドポイント追加**

`api/admin/_contentsHandler.ts` のPUTハンドラー（`if (req.method === 'PUT')` ブロック）内で、`item`がない場合にシリーズ更新を処理するように追加。既存のitem更新ロジックの前に挿入:

```typescript
    // --- PUT: シリーズ名の一括更新 ---
    if (req.method === 'PUT') {
      // シリーズ名の一括更新（翻訳管理画面用）
      if (req.body?.type === 'series_bulk_update') {
        const { updates } = req.body;
        if (!updates || typeof updates !== 'object') {
          return res.status(400).json({ error: 'updates object is required' });
        }

        const snap = await contentsRef.get();
        if (!snap.exists) return res.status(404).json({ error: 'Contents document not found' });

        const current = snap.data()!;
        await createBackup(db, current);

        const seriesList: any[] = current.series || [];
        for (const s of seriesList) {
          if (updates[s.id]) {
            s.name = { ...s.name, ...updates[s.id] };
          }
        }

        await contentsRef.set({ ...current, series: seriesList });
        await bumpDataVersion(db);
        await writeAuditLog({
          action: 'update',
          target: 'contents.series',
          adminUid,
          changes: { after: { updatedSeriesCount: Object.keys(updates).length } },
        });

        return res.status(200).json({ success: true });
      }

      // 既存のitem更新ロジック...
      const { item } = req.body || {};
```

- [ ] **Step 2: Phase.nameの型をstring | LocalizedStringに更新**

`src/types/index.ts` の Phase interface を変更:

```typescript
export interface Phase {
    id: string;
    name: string | LocalizedString;
    endTime: number;
}
```

注: 既存のstring型との後方互換性を保つためにunion型にする。translationDataLoaders.tsのloadPhaseTranslationsは既にstring→LocalizedStringの正規化を行っている。

- [ ] **Step 3: saveOtherTranslationsのシリーズ保存を完成**

`src/lib/translationDataLoaders.ts` の `saveOtherTranslations` 関数内のシリーズ保存コメント部分を実装に置き換え:

```typescript
  // シリーズ名の保存（master/contents.series — 専用エンドポイント）
  if (seriesUpdates.size > 0) {
    const updates: Record<string, any> = {};
    for (const [id, row] of seriesUpdates) {
      updates[id] = { ja: row.ja, en: row.en, zh: row.zh || undefined, ko: row.ko || undefined };
    }
    await apiFetch('/api/admin?resource=contents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'series_bulk_update', updates }),
    });
  }
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add api/admin/_contentsHandler.ts src/types/index.ts src/lib/translationDataLoaders.ts
git commit -m "feat: シリーズ名のFirestore保存エンドポイント + Phase.nameのLocalizedString対応"
```

---

## Task 7: 動作確認と最終調整

- [ ] **Step 1: ローカルでビルドして画面確認**

Run: `npm run build`
Expected: ビルド成功

- [ ] **Step 2: 管理画面で翻訳タブが表示されることを確認**

- `/admin/translations` にアクセス
- 左サイドナビに「翻訳管理」が表示される
- スキルカテゴリでスキル一覧が読み込まれる

- [ ] **Step 3: CSVエクスポート/インポートの動作確認**

- CSVエクスポート → ファイルがダウンロードされる
- ダウンロードしたCSVにzh/ko列を追加してインポート → 差分プレビューが表示される
- インポート確認 → テーブルに反映される

- [ ] **Step 4: 保存の動作確認**

- zh/ko列にテスト値を入力
- 保存ボタン → 成功メッセージ
- ページリロード → 保存した値が残っている

- [ ] **Step 5: ja/en変更時の安全確認**

- ja列の値を変更 → 黄色ハイライト
- 保存 → 確認ダイアログが表示される

- [ ] **Step 6: TODO.mdを更新**

`docs/TODO.md` の管理画面改善セクションに翻訳管理の完了を記録。

- [ ] **Step 7: 最終コミット**

```bash
git add -A
git commit -m "feat: 翻訳管理画面 — 全ゲームデータの多言語翻訳を一元管理"
```
