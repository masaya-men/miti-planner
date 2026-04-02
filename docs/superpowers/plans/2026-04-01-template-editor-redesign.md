# テンプレート管理画面リデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面のテンプレート編集をスプレッドシート型UIに刷新し、プラン昇格・スプシ読み込み・FFLogs翻訳取得を可能にする

**Architecture:** AdminTemplates.tsx の既存JSON直アップロードUIを TemplateEditor（スプレッドシート型テーブル）に置き換え。編集状態は useTemplateEditor フックで管理。3つのモーダル（プラン昇格・CSV読み込み・FFLogs翻訳）をツールバーから起動。API は既存の POST /api/admin?resource=templates を活用し、プランデータ取得のサブタイプのみ追加。

**Tech Stack:** React 18, Tailwind CSS v4 (カスタムテーマ変数), react-i18next, Firebase Admin SDK, FFLogs GraphQL API

**設計書:** `docs/superpowers/specs/2026-04-01-template-editor-redesign.md`

---

## ファイル構成

### 新規作成

| ファイル | 責務 |
|---------|------|
| `src/hooks/useTemplateEditor.ts` | EditState管理（original/current/modified/autoFilled/deleted）、undo、save |
| `src/components/admin/TemplateEditor.tsx` | スプレッドシート型テーブル本体（セルクリック編集） |
| `src/components/admin/TemplateEditorToolbar.tsx` | ツールバー（ボタン群・未翻訳カウンター・フィルタートグル） |
| `src/components/admin/PlanToTemplateModal.tsx` | プランURL入力→プレビュー→テンプレート変換モーダル |
| `src/components/admin/CsvImportModal.tsx` | スプシ貼り付け→列対応付け→読み込みモーダル |
| `src/components/admin/FflogsTranslationModal.tsx` | FFLogsレポートURL→英語名自動マッチングモーダル |
| `src/utils/templateConversions.ts` | PlanData→TemplateData変換、CSV/TSVパース、時間パースのユーティリティ |

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `src/components/admin/AdminTemplates.tsx` | JSON直アップロードUIを TemplateEditor に置き換え。テンプレート一覧 + 昇格候補は維持 |
| `api/admin/_templatesHandler.ts` | GET に `subtype=plan&planId={id}` サブタイプ追加（shared_plansからプランデータ取得） |
| `src/locales/ja.json` | テンプレートエディター用i18nキー追加 |
| `src/locales/en.json` | 同上（英語） |

---

## Task 1: i18nキーの追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

全タスクで使うUIテキストを先に定義する。

- [ ] **Step 1: ja.json に管理画面テンプレートエディター用キーを追加**

`admin` セクション内に以下を追加:

```json
"tpl_editor_time": "時間",
"tpl_editor_phase": "フェーズ",
"tpl_editor_name_ja": "技名(JA)",
"tpl_editor_name_en": "技名(EN)",
"tpl_editor_damage": "ダメージ",
"tpl_editor_damage_type": "種別",
"tpl_editor_target": "対象",
"tpl_editor_delete": "削除",
"tpl_editor_save": "保存する",
"tpl_editor_undo": "変更を元に戻す",
"tpl_editor_unsaved": "未保存の変更があります",
"tpl_editor_untranslated": "未翻訳: {{count}}件",
"tpl_editor_translated": "翻訳完了",
"tpl_editor_untranslated_only": "未翻訳だけ表示",
"tpl_editor_untranslated_placeholder": "未翻訳 — クリックで入力",
"tpl_editor_auto_label": "自動",
"tpl_editor_save_confirm_untranslated": "未翻訳が {{count}} 件あります。このまま保存しますか？",
"tpl_editor_saved": "テンプレートを保存しました",
"tpl_editor_save_error": "保存に失敗しました。もう一度試してください",
"tpl_editor_no_content": "コンテンツを選択してください",
"tpl_editor_empty": "テンプレートがありません。ツールバーから作成できます",
"tpl_editor_content_summary": "イベント {{events}}件 ・ フェーズ {{phases}}件",
"tpl_promote_title": "プランをテンプレートにする",
"tpl_promote_url_label": "プランの共有URLを貼り付けてください",
"tpl_promote_url_placeholder": "https://lopoly.app/share/xxxxxxxx",
"tpl_promote_preview": "プレビュー",
"tpl_promote_plan_name": "プラン名",
"tpl_promote_events": "イベント数",
"tpl_promote_phases": "フェーズ数",
"tpl_promote_confirm": "テンプレートにする",
"tpl_promote_replace_confirm": "今のテンプレートを置き換えます。よろしいですか？",
"tpl_promote_error": "このURLからプランを読み込めませんでした",
"tpl_promote_btn": "プランをテンプレートにする",
"tpl_csv_title": "スプシから読み込む",
"tpl_csv_paste_label": "スプレッドシートからコピーしたデータを貼り付けてください",
"tpl_csv_column_label": "この列は何ですか？",
"tpl_csv_column_time": "時間",
"tpl_csv_column_name": "技名",
"tpl_csv_column_damage": "ダメージ",
"tpl_csv_column_type": "種別",
"tpl_csv_column_target": "対象",
"tpl_csv_column_phase": "フェーズ",
"tpl_csv_column_skip": "使わない",
"tpl_csv_import": "読み込む",
"tpl_csv_error": "貼り付けたデータを読み取れませんでした。スプレッドシートからコピーしたデータか確認してください",
"tpl_csv_btn": "スプシから読み込む",
"tpl_fflogs_title": "FFLogsから英語名を取得",
"tpl_fflogs_url_label": "FFLogsレポートのURLを貼り付けてください",
"tpl_fflogs_url_placeholder": "https://www.fflogs.com/reports/...",
"tpl_fflogs_fetch": "取得する",
"tpl_fflogs_matched": "{{count}}件の英語名を自動入力しました",
"tpl_fflogs_no_match": "一致する技名が見つかりませんでした",
"tpl_fflogs_error": "FFLogsからデータを取得できませんでした。URLを確認してもう一度試してください",
"tpl_fflogs_btn": "FFLogsから英語名を取得",
"tpl_damage_magical": "魔法",
"tpl_damage_physical": "物理",
"tpl_damage_unavoidable": "回避不可",
"tpl_damage_enrage": "時間切れ",
"tpl_target_aoe": "全体",
"tpl_target_mt": "MT",
"tpl_target_st": "ST"
```

- [ ] **Step 2: en.json に対応する英語キーを追加**

```json
"tpl_editor_time": "Time",
"tpl_editor_phase": "Phase",
"tpl_editor_name_ja": "Name (JA)",
"tpl_editor_name_en": "Name (EN)",
"tpl_editor_damage": "Damage",
"tpl_editor_damage_type": "Type",
"tpl_editor_target": "Target",
"tpl_editor_delete": "Del",
"tpl_editor_save": "Save",
"tpl_editor_undo": "Undo changes",
"tpl_editor_unsaved": "Unsaved changes",
"tpl_editor_untranslated": "Untranslated: {{count}}",
"tpl_editor_translated": "Fully translated",
"tpl_editor_untranslated_only": "Show untranslated only",
"tpl_editor_untranslated_placeholder": "Untranslated — click to edit",
"tpl_editor_auto_label": "Auto",
"tpl_editor_save_confirm_untranslated": "{{count}} untranslated entries remain. Save anyway?",
"tpl_editor_saved": "Template saved",
"tpl_editor_save_error": "Save failed. Please try again",
"tpl_editor_no_content": "Select a content first",
"tpl_editor_empty": "No template. Create one from the toolbar",
"tpl_editor_content_summary": "{{events}} events ・ {{phases}} phases",
"tpl_promote_title": "Create template from plan",
"tpl_promote_url_label": "Paste the plan share URL",
"tpl_promote_url_placeholder": "https://lopoly.app/share/xxxxxxxx",
"tpl_promote_preview": "Preview",
"tpl_promote_plan_name": "Plan name",
"tpl_promote_events": "Events",
"tpl_promote_phases": "Phases",
"tpl_promote_confirm": "Create template",
"tpl_promote_replace_confirm": "This will replace the current template. Continue?",
"tpl_promote_error": "Could not load plan from this URL",
"tpl_promote_btn": "Plan → Template",
"tpl_csv_title": "Import from spreadsheet",
"tpl_csv_paste_label": "Paste data copied from a spreadsheet",
"tpl_csv_column_label": "What is this column?",
"tpl_csv_column_time": "Time",
"tpl_csv_column_name": "Name",
"tpl_csv_column_damage": "Damage",
"tpl_csv_column_type": "Type",
"tpl_csv_column_target": "Target",
"tpl_csv_column_phase": "Phase",
"tpl_csv_column_skip": "Skip",
"tpl_csv_import": "Import",
"tpl_csv_error": "Could not parse the pasted data. Make sure it's copied from a spreadsheet",
"tpl_csv_btn": "Import CSV",
"tpl_fflogs_title": "Get English names from FFLogs",
"tpl_fflogs_url_label": "Paste an FFLogs report URL",
"tpl_fflogs_url_placeholder": "https://www.fflogs.com/reports/...",
"tpl_fflogs_fetch": "Fetch",
"tpl_fflogs_matched": "Auto-filled {{count}} English names",
"tpl_fflogs_no_match": "No matching ability names found",
"tpl_fflogs_error": "Failed to fetch from FFLogs. Check the URL and try again",
"tpl_fflogs_btn": "FFLogs EN Names",
"tpl_damage_magical": "Magical",
"tpl_damage_physical": "Physical",
"tpl_damage_unavoidable": "Unavoidable",
"tpl_damage_enrage": "Enrage",
"tpl_target_aoe": "AoE",
"tpl_target_mt": "MT",
"tpl_target_st": "ST"
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: テンプレートエディター用i18nキー追加"
```

---

## Task 2: ユーティリティ関数（templateConversions.ts）

**Files:**
- Create: `src/utils/templateConversions.ts`

データ変換ロジックをUIから分離。PlanData→TemplateData変換、CSV/TSVパース、時間パースを純粋関数として実装。

- [ ] **Step 1: templateConversions.ts を作成**

```typescript
/**
 * テンプレートデータ変換ユーティリティ
 * PlanData→TemplateData変換、CSV/TSVパース、時間パース
 */
import type { TimelineEvent, Phase } from '../types';
import type { TemplateData } from '../data/templateLoader';

// ── 時間パース ──

/**
 * "M:SS", "M:SS.x", "SS" 形式の文字列を秒数に変換
 * 例: "0:13" → 13, "1:30" → 90, "13" → 13, "1:30.5" → 90
 */
export function parseTimeString(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // M:SS or M:SS.x
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})(?:\.\d+)?$/);
  if (colonMatch) {
    return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  }

  // Pure number (seconds)
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num >= 0) {
    return Math.floor(num);
  }

  return null;
}

/**
 * 秒数を "M:SS" 形式に変換
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── CSV/TSV パース ──

export interface ParsedRow {
  cells: string[];
}

/**
 * TSV/CSV文字列をパースして行配列を返す
 */
export function parseTsv(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/);
  return lines
    .filter((line) => line.trim() !== '')
    .map((line) => ({
      cells: line.split('\t').map((cell) => cell.trim()),
    }));
}

/**
 * ヘッダー行のキーワードから列の種類を自動推測
 */
export type ColumnType = 'time' | 'name' | 'damage' | 'type' | 'target' | 'phase' | 'skip';

const COLUMN_KEYWORDS: Record<ColumnType, string[]> = {
  time: ['時間', 'time', 'sec', '秒', 'タイム'],
  name: ['技名', '技', 'name', 'ability', 'アビリティ', 'スキル'],
  damage: ['ダメージ', 'damage', 'dmg', '威力'],
  type: ['種別', 'type', '属性', '魔法', '物理'],
  target: ['対象', 'target', '範囲', '全体'],
  phase: ['フェーズ', 'phase', 'p', 'フェイズ'],
  skip: [],
};

export function guessColumnType(header: string): ColumnType {
  const lower = header.toLowerCase().trim();
  for (const [type, keywords] of Object.entries(COLUMN_KEYWORDS) as [ColumnType, string[]][]) {
    if (type === 'skip') continue;
    if (keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return type;
    }
  }
  return 'skip';
}

// ── 種別・対象の変換 ──

export function parseDamageType(value: string): TimelineEvent['damageType'] {
  const v = value.trim().toLowerCase();
  if (['物理', 'physical', 'phys'].some((k) => v.includes(k))) return 'physical';
  if (['回避不可', 'unavoidable'].some((k) => v.includes(k))) return 'unavoidable';
  if (['時間切れ', 'enrage'].some((k) => v.includes(k))) return 'enrage';
  return 'magical'; // デフォルト
}

export function parseTarget(value: string): TimelineEvent['target'] {
  const v = value.trim().toUpperCase();
  if (v === 'MT') return 'MT';
  if (v === 'ST') return 'ST';
  return 'AoE'; // デフォルト
}

function genTplId(index: number): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `tpl_${index}_${rand}`;
}

// ── CSV行 → TimelineEvent変換 ──

export interface ColumnMapping {
  index: number;
  type: ColumnType;
}

export function convertCsvToEvents(
  rows: ParsedRow[],
  mappings: ColumnMapping[],
): { events: TimelineEvent[]; phases: TemplateData['phases'] } {
  const events: TimelineEvent[] = [];
  const phaseNames: string[] = [];
  const phaseStartTimes: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let time = 0;
    let nameJa = '';
    let damage: number | undefined;
    let damageType: TimelineEvent['damageType'] = 'magical';
    let target: TimelineEvent['target'] = 'AoE';
    let phaseName = '';

    for (const mapping of mappings) {
      if (mapping.type === 'skip' || mapping.index >= row.cells.length) continue;
      const val = row.cells[mapping.index];
      switch (mapping.type) {
        case 'time': {
          const parsed = parseTimeString(val);
          if (parsed !== null) time = parsed;
          break;
        }
        case 'name':
          nameJa = val;
          break;
        case 'damage': {
          const n = parseInt(val.replace(/,/g, ''), 10);
          if (!isNaN(n)) damage = n;
          break;
        }
        case 'type':
          damageType = parseDamageType(val);
          break;
        case 'target':
          target = parseTarget(val);
          break;
        case 'phase':
          phaseName = val;
          break;
      }
    }

    if (!nameJa) continue; // 技名なしはスキップ

    // フェーズ検出
    if (phaseName && (phaseNames.length === 0 || phaseNames[phaseNames.length - 1] !== phaseName)) {
      phaseNames.push(phaseName);
      phaseStartTimes.push(time);
    }

    events.push({
      id: genTplId(i),
      time,
      name: { ja: nameJa, en: '' },
      damageType,
      damageAmount: damage,
      target,
    });
  }

  const phases: TemplateData['phases'] = phaseNames.map((name, idx) => ({
    id: idx + 1,
    startTimeSec: phaseStartTimes[idx] ?? 0,
    name,
  }));

  // フェーズがない場合、デフォルト1フェーズ
  if (phases.length === 0) {
    phases.push({ id: 1, startTimeSec: 0 });
  }

  return { events, phases };
}

// ── PlanData → TemplateData変換 ──

export function convertPlanToTemplate(
  planData: { timelineEvents: TimelineEvent[]; phases: Phase[] },
  contentId: string,
): Omit<TemplateData, '_warning'> {
  // PlanData.phases (id: string, name: string, endTime: number)
  // → TemplateData.phases (id: number, startTimeSec: number, name?: string)
  const sortedPhases = [...planData.phases].sort((a, b) => a.endTime - b.endTime);
  const templatePhases: TemplateData['phases'] = sortedPhases.map((phase, idx) => {
    // Phase N の startTimeSec = Phase N-1 の endTime（Phase 1 は 0）
    const startTimeSec = idx === 0 ? 0 : sortedPhases[idx - 1].endTime;
    // name: "Phase 1\nP1" → "P1"（改行以降を取得）
    const nameParts = phase.name.split('\n');
    const shortName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : phase.name;
    // id: "phase_2" → 2
    const numericId = parseInt(phase.id.replace(/\D/g, ''), 10) || idx + 1;

    return {
      id: numericId,
      startTimeSec,
      name: shortName,
    };
  });

  return {
    contentId,
    generatedAt: new Date().toISOString(),
    sourceLogsCount: 0,
    timelineEvents: planData.timelineEvents.map((ev) => ({
      ...ev,
      // timelineMitigations等の余計なフィールドを除去
      id: ev.id,
      time: ev.time,
      name: ev.name,
      damageType: ev.damageType,
      damageAmount: ev.damageAmount,
      target: ev.target,
      warning: ev.warning,
    })),
    phases: templatePhases,
    source: 'plan_promote',
  };
}
```

- [ ] **Step 2: コミット**

```bash
git add src/utils/templateConversions.ts
git commit -m "feat: テンプレート変換ユーティリティ（時間パース・CSV変換・プラン変換）"
```

---

## Task 3: 編集状態フック（useTemplateEditor.ts）

**Files:**
- Create: `src/hooks/useTemplateEditor.ts`

EditState（original/current/modified/autoFilled/deleted）を管理するカスタムフック。

- [ ] **Step 1: useTemplateEditor.ts を作成**

```typescript
/**
 * テンプレートエディター用の編集状態管理フック
 * original（元データ）とcurrent（編集中データ）を保持し、
 * セル編集・削除・undo・保存を管理する
 */
import { useState, useCallback, useMemo } from 'react';
import type { TimelineEvent } from '../types';
import type { TemplateData } from '../data/templateLoader';

export interface EditState {
  original: TimelineEvent[];
  originalPhases: TemplateData['phases'];
  current: TimelineEvent[];
  currentPhases: TemplateData['phases'];
  modified: Set<string>;    // "eventId:fieldName"
  autoFilled: Set<string>;  // "eventId:fieldName"
  deleted: Set<string>;     // eventId
}

function createInitialState(
  events: TimelineEvent[],
  phases: TemplateData['phases'],
): EditState {
  return {
    original: structuredClone(events),
    originalPhases: structuredClone(phases),
    current: structuredClone(events),
    currentPhases: structuredClone(phases),
    modified: new Set(),
    autoFilled: new Set(),
    deleted: new Set(),
  };
}

export function useTemplateEditor() {
  const [state, setState] = useState<EditState>(
    createInitialState([], []),
  );

  /** テンプレートデータをロード（既存テンプレート or 変換後データ） */
  const loadEvents = useCallback(
    (events: TimelineEvent[], phases: TemplateData['phases']) => {
      setState(createInitialState(events, phases));
    },
    [],
  );

  /** セルの値を更新 */
  const updateCell = useCallback(
    (eventId: string, field: string, value: any) => {
      setState((prev) => {
        const next = structuredClone(prev.current);
        const idx = next.findIndex((e) => e.id === eventId);
        if (idx === -1) return prev;

        const ev = next[idx];
        if (field === 'time') {
          ev.time = value as number;
        } else if (field === 'name.ja') {
          ev.name = { ...ev.name, ja: value as string };
        } else if (field === 'name.en') {
          ev.name = { ...ev.name, en: value as string };
        } else if (field === 'damageAmount') {
          ev.damageAmount = value as number | undefined;
        } else if (field === 'damageType') {
          ev.damageType = value as TimelineEvent['damageType'];
        } else if (field === 'target') {
          ev.target = value as TimelineEvent['target'];
        }

        const newModified = new Set(prev.modified);
        newModified.add(`${eventId}:${field}`);
        // autoFilledから除去（手動で上書きした場合）
        const newAutoFilled = new Set(prev.autoFilled);
        newAutoFilled.delete(`${eventId}:${field}`);

        return { ...prev, current: next, modified: newModified, autoFilled: newAutoFilled };
      });
    },
    [],
  );

  /** 行を削除（保存前なら復元可能） */
  const deleteEvent = useCallback((eventId: string) => {
    setState((prev) => {
      const newDeleted = new Set(prev.deleted);
      newDeleted.add(eventId);
      return { ...prev, deleted: newDeleted };
    });
  }, []);

  /** 変更を元に戻す */
  const undo = useCallback(() => {
    setState((prev) =>
      createInitialState(prev.original, prev.originalPhases),
    );
  }, []);

  /** 自動入力（FFLogs英語名マッチング） */
  const autoFillEnNames = useCallback(
    (matches: Map<string, string>) => {
      // matches: jaName → enName
      setState((prev) => {
        const next = structuredClone(prev.current);
        const newAutoFilled = new Set(prev.autoFilled);
        let count = 0;

        for (const ev of next) {
          if (prev.deleted.has(ev.id)) continue;
          const enName = matches.get(ev.name.ja);
          if (enName && !ev.name.en) {
            ev.name = { ...ev.name, en: enName };
            const key = `${ev.id}:name.en`;
            newAutoFilled.add(key);
            count++;
          }
        }

        return { ...prev, current: next, autoFilled: newAutoFilled };
      });
    },
    [],
  );

  /** 外部からイベント一括セット（CSV読み込み・プラン変換後） */
  const replaceAll = useCallback(
    (events: TimelineEvent[], phases: TemplateData['phases']) => {
      setState(createInitialState(events, phases));
    },
    [],
  );

  /** 保存用データを取得（deleted除外済み） */
  const getSaveData = useCallback((): {
    events: TimelineEvent[];
    phases: TemplateData['phases'];
  } => {
    return {
      events: state.current.filter((e) => !state.deleted.has(e.id)),
      phases: state.currentPhases,
    };
  }, [state]);

  /** 表示用イベント（deleted除外済み） */
  const visibleEvents = useMemo(
    () => state.current.filter((e) => !state.deleted.has(e.id)),
    [state.current, state.deleted],
  );

  /** 未翻訳件数 */
  const untranslatedCount = useMemo(
    () =>
      visibleEvents.filter((e) => !e.name.en || e.name.en.trim() === '').length,
    [visibleEvents],
  );

  /** 変更があるか */
  const hasChanges = useMemo(
    () => state.modified.size > 0 || state.deleted.size > 0,
    [state.modified, state.deleted],
  );

  return {
    state,
    visibleEvents,
    untranslatedCount,
    hasChanges,
    loadEvents,
    updateCell,
    deleteEvent,
    undo,
    autoFillEnNames,
    replaceAll,
    getSaveData,
  };
}
```

- [ ] **Step 2: コミット**

```bash
git add src/hooks/useTemplateEditor.ts
git commit -m "feat: useTemplateEditor フック（編集状態管理・undo・自動入力）"
```

---

## Task 4: TemplateEditorToolbar（ツールバーコンポーネント）

**Files:**
- Create: `src/components/admin/TemplateEditorToolbar.tsx`

- [ ] **Step 1: TemplateEditorToolbar.tsx を作成**

```typescript
/**
 * テンプレートエディター ツールバー
 * ボタン群（プラン昇格・スプシ読み込み・FFLogs翻訳取得）+ 未翻訳カウンター + フィルター
 */
import { useTranslation } from 'react-i18next';

interface TemplateEditorToolbarProps {
  untranslatedCount: number;
  showUntranslatedOnly: boolean;
  onToggleUntranslatedOnly: () => void;
  onOpenPromote: () => void;
  onOpenCsvImport: () => void;
  onOpenFflogsTranslation: () => void;
  hasEvents: boolean; // FFLogsボタンはイベントがあるときのみ有効
}

export function TemplateEditorToolbar({
  untranslatedCount,
  showUntranslatedOnly,
  onToggleUntranslatedOnly,
  onOpenPromote,
  onOpenCsvImport,
  onOpenFflogsTranslation,
  hasEvents,
}: TemplateEditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {/* プランをテンプレートにする */}
      <button
        onClick={onOpenPromote}
        className="px-3 py-1.5 text-xs border border-blue-500/40 text-blue-400 rounded
                   hover:bg-blue-500/10 transition-colors cursor-pointer"
      >
        {t('admin.tpl_promote_btn')}
      </button>

      {/* スプシから読み込む */}
      <button
        onClick={onOpenCsvImport}
        className="px-3 py-1.5 text-xs border border-emerald-500/40 text-emerald-400 rounded
                   hover:bg-emerald-500/10 transition-colors cursor-pointer"
      >
        {t('admin.tpl_csv_btn')}
      </button>

      {/* FFLogsから英語名を取得 */}
      <button
        onClick={onOpenFflogsTranslation}
        disabled={!hasEvents}
        className="px-3 py-1.5 text-xs border border-purple-500/40 text-purple-400 rounded
                   hover:bg-purple-500/10 transition-colors cursor-pointer
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {t('admin.tpl_fflogs_btn')}
      </button>

      {/* スペーサー */}
      <div className="flex-1" />

      {/* 未翻訳カウンター */}
      {untranslatedCount > 0 ? (
        <span className="text-xs text-amber-400 border border-amber-400/30 px-2 py-1 rounded">
          {t('admin.tpl_editor_untranslated', { count: untranslatedCount })}
        </span>
      ) : (
        <span className="text-xs text-emerald-400 border border-emerald-400/30 px-2 py-1 rounded">
          {t('admin.tpl_editor_translated')}
        </span>
      )}

      {/* 未翻訳だけ表示トグル */}
      <button
        onClick={onToggleUntranslatedOnly}
        className={`px-2 py-1 text-xs rounded border transition-colors cursor-pointer ${
          showUntranslatedOnly
            ? 'border-amber-400/50 bg-amber-400/10 text-amber-400'
            : 'border-app-text/20 text-app-text-muted hover:bg-app-text/5'
        }`}
      >
        {t('admin.tpl_editor_untranslated_only')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/admin/TemplateEditorToolbar.tsx
git commit -m "feat: TemplateEditorToolbar コンポーネント"
```

---

## Task 5: TemplateEditor（スプレッドシート型テーブル）

**Files:**
- Create: `src/components/admin/TemplateEditor.tsx`

設計書のテーブル列仕様・ハイライトルール・セルクリック編集を実装。

- [ ] **Step 1: TemplateEditor.tsx を作成**

```typescript
/**
 * スプレッドシート型テンプレートエディター
 * セルクリックでインライン編集、フェーズ区切り行、ハイライトルール
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';
import { formatTime, parseTimeString } from '../../utils/templateConversions';
import type { EditState } from '../../hooks/useTemplateEditor';

interface TemplateEditorProps {
  events: TimelineEvent[];
  phases: TemplateData['phases'];
  editState: EditState;
  showUntranslatedOnly: boolean;
  onUpdateCell: (eventId: string, field: string, value: any) => void;
  onDeleteEvent: (eventId: string) => void;
}

// ── セルハイライト判定 ──

function getCellStyle(
  eventId: string,
  field: string,
  editState: EditState,
): { bg: string; text: string; label?: string } {
  const key = `${eventId}:${field}`;
  if (editState.autoFilled.has(key)) {
    return {
      bg: 'bg-blue-500/[0.06]',
      text: 'text-blue-400',
      label: 'auto',
    };
  }
  if (editState.modified.has(key)) {
    return {
      bg: 'bg-amber-500/[0.06]',
      text: 'text-amber-400',
    };
  }
  return { bg: '', text: '' };
}

// ── 編集可能セル ──

interface EditableCellProps {
  value: string;
  eventId: string;
  field: string;
  editState: EditState;
  onSave: (value: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
  isUntranslated?: boolean;
}

function EditableCell({
  value,
  eventId,
  field,
  editState,
  onSave,
  type = 'text',
  placeholder,
  isUntranslated,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const style = getCellStyle(eventId, field, editState);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className="w-full px-1 py-0.5 text-xs bg-app-surface border border-app-text/30 rounded outline-none"
      />
    );
  }

  return (
    <div
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`px-1 py-0.5 cursor-pointer rounded min-h-[24px] flex items-center gap-1 ${style.bg} ${style.text || 'text-app-text'}`}
    >
      {isUntranslated && !value ? (
        <span className="text-app-text-muted/50 border border-dashed border-app-text/20 px-1 rounded text-[10px]">
          {t('admin.tpl_editor_untranslated_placeholder')}
        </span>
      ) : (
        <span>{type === 'number' && value ? Number(value).toLocaleString() : value}</span>
      )}
      {style.label && (
        <span className="text-[9px] opacity-70">
          {t('admin.tpl_editor_auto_label')}
        </span>
      )}
    </div>
  );
}

// ── ドロップダウンセル ──

interface DropdownCellProps {
  value: string;
  options: { value: string; label: string }[];
  eventId: string;
  field: string;
  editState: EditState;
  onSave: (value: string) => void;
}

function DropdownCell({ value, options, eventId, field, editState, onSave }: DropdownCellProps) {
  const [open, setOpen] = useState(false);
  const style = getCellStyle(eventId, field, editState);
  const label = options.find((o) => o.value === value)?.label ?? value;

  if (open) {
    return (
      <select
        autoFocus
        value={value}
        onChange={(e) => { onSave(e.target.value); setOpen(false); }}
        onBlur={() => setOpen(false)}
        className="w-full px-1 py-0.5 text-xs bg-app-surface border border-app-text/30 rounded outline-none
                   [&>option]:bg-app-bg [&>option]:text-app-text"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div
      onClick={() => setOpen(true)}
      className={`px-1 py-0.5 cursor-pointer rounded min-h-[24px] flex items-center ${style.bg} ${style.text || 'text-app-text'}`}
    >
      {label}
    </div>
  );
}

// ── メインテーブル ──

export function TemplateEditor({
  events,
  phases,
  editState,
  showUntranslatedOnly,
  onUpdateCell,
  onDeleteEvent,
}: TemplateEditorProps) {
  const { t } = useTranslation();

  const damageTypeOptions = [
    { value: 'magical', label: t('admin.tpl_damage_magical') },
    { value: 'physical', label: t('admin.tpl_damage_physical') },
    { value: 'unavoidable', label: t('admin.tpl_damage_unavoidable') },
    { value: 'enrage', label: t('admin.tpl_damage_enrage') },
  ];

  const targetOptions = [
    { value: 'AoE', label: t('admin.tpl_target_aoe') },
    { value: 'MT', label: t('admin.tpl_target_mt') },
    { value: 'ST', label: t('admin.tpl_target_st') },
  ];

  const phaseOptions = phases.map((p) => ({
    value: String(p.id),
    label: p.name || `Phase ${p.id}`,
  }));

  // フェーズIDでイベントをグループ化
  const getPhaseForEvent = (time: number): number => {
    let phaseId = phases[0]?.id ?? 1;
    for (const p of phases) {
      if (time >= p.startTimeSec) phaseId = p.id;
    }
    return phaseId;
  };

  // フィルター適用
  const filteredEvents = showUntranslatedOnly
    ? events.filter((e) => !e.name.en || e.name.en.trim() === '')
    : events;

  // フェーズ区切りを挿入するための前処理
  let lastPhaseId = -1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-app-text/10 text-left text-app-text-muted">
            <th className="pb-2 pr-2 w-[60px]">{t('admin.tpl_editor_time')}</th>
            <th className="pb-2 pr-2 w-[80px]">{t('admin.tpl_editor_phase')}</th>
            <th className="pb-2 pr-2">{t('admin.tpl_editor_name_ja')}</th>
            <th className="pb-2 pr-2">{t('admin.tpl_editor_name_en')}</th>
            <th className="pb-2 pr-2 w-[80px]">{t('admin.tpl_editor_damage')}</th>
            <th className="pb-2 pr-2 w-[70px]">{t('admin.tpl_editor_damage_type')}</th>
            <th className="pb-2 pr-2 w-[60px]">{t('admin.tpl_editor_target')}</th>
            <th className="pb-2 w-[40px]">{t('admin.tpl_editor_delete')}</th>
          </tr>
        </thead>
        <tbody>
          {filteredEvents.map((ev) => {
            const phaseId = getPhaseForEvent(ev.time);
            const showPhaseSep = phaseId !== lastPhaseId;
            lastPhaseId = phaseId;
            const phaseName = phases.find((p) => p.id === phaseId)?.name || `Phase ${phaseId}`;

            return (
              <tr key={ev.id}>
                {/* フェーズ区切りは別の行として前に表示しないので、trの前には置けない。
                    代わりに最初のセルにフェーズ名を表示する方法も考えられるが、
                    設計書通りのフェーズ区切り行にするためフラグメントを使う */}
                {showPhaseSep ? (
                  <>
                    {/* フェーズ区切り行のダミー — 実際は別tr要素が必要 */}
                  </>
                ) : null}
                <td className="py-1 pr-2">
                  <EditableCell
                    value={formatTime(ev.time)}
                    eventId={ev.id}
                    field="time"
                    editState={editState}
                    onSave={(val) => {
                      const parsed = parseTimeString(val);
                      if (parsed !== null) onUpdateCell(ev.id, 'time', parsed);
                    }}
                  />
                </td>
                <td className="py-1 pr-2">
                  <DropdownCell
                    value={String(phaseId)}
                    options={phaseOptions}
                    eventId={ev.id}
                    field="phase"
                    editState={editState}
                    onSave={() => {/* フェーズ変更は今回はread-only表示のみ */}}
                  />
                </td>
                <td className="py-1 pr-2">
                  <EditableCell
                    value={ev.name.ja}
                    eventId={ev.id}
                    field="name.ja"
                    editState={editState}
                    onSave={(val) => onUpdateCell(ev.id, 'name.ja', val)}
                  />
                </td>
                <td className="py-1 pr-2">
                  <EditableCell
                    value={ev.name.en}
                    eventId={ev.id}
                    field="name.en"
                    editState={editState}
                    onSave={(val) => onUpdateCell(ev.id, 'name.en', val)}
                    isUntranslated={!ev.name.en || ev.name.en.trim() === ''}
                  />
                </td>
                <td className="py-1 pr-2">
                  <EditableCell
                    value={ev.damageAmount !== undefined ? String(ev.damageAmount) : ''}
                    eventId={ev.id}
                    field="damageAmount"
                    editState={editState}
                    type="number"
                    onSave={(val) => {
                      const n = parseInt(val.replace(/,/g, ''), 10);
                      onUpdateCell(ev.id, 'damageAmount', isNaN(n) ? undefined : n);
                    }}
                  />
                </td>
                <td className="py-1 pr-2">
                  <DropdownCell
                    value={ev.damageType}
                    options={damageTypeOptions}
                    eventId={ev.id}
                    field="damageType"
                    editState={editState}
                    onSave={(val) => onUpdateCell(ev.id, 'damageType', val)}
                  />
                </td>
                <td className="py-1 pr-2">
                  <DropdownCell
                    value={ev.target ?? 'AoE'}
                    options={targetOptions}
                    eventId={ev.id}
                    field="target"
                    editState={editState}
                    onSave={(val) => onUpdateCell(ev.id, 'target', val)}
                  />
                </td>
                <td className="py-1 text-center">
                  <button
                    onClick={() => onDeleteEvent(ev.id)}
                    className="text-app-text-muted/50 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

**注意:** フェーズ区切り行は `<tr>` の前に別の `<tr>` を挿入する必要がある。上記コードでは `map` 内で直接追加できないため、Step 2 でフラグメント方式に修正する。

- [ ] **Step 2: フェーズ区切り行を正しく実装**

`filteredEvents.map` の部分を、事前にフェーズ区切りを含む配列に変換するロジックに書き換える:

```typescript
// TemplateEditor内、return文の直前に追加:

type RowItem =
  | { type: 'phase-separator'; phaseId: number; phaseName: string }
  | { type: 'event'; event: TimelineEvent; phaseId: number };

const rows: RowItem[] = [];
let prevPhaseId = -1;
for (const ev of filteredEvents) {
  const phaseId = getPhaseForEvent(ev.time);
  if (phaseId !== prevPhaseId) {
    const phaseName = phases.find((p) => p.id === phaseId)?.name || `Phase ${phaseId}`;
    rows.push({ type: 'phase-separator', phaseId, phaseName });
    prevPhaseId = phaseId;
  }
  rows.push({ type: 'event', event: ev, phaseId });
}
```

`<tbody>` 内を以下に置き換え:

```tsx
{rows.map((row, idx) => {
  if (row.type === 'phase-separator') {
    return (
      <tr key={`phase-${row.phaseId}`} className="bg-blue-500/[0.08]">
        <td colSpan={8} className="py-1.5 px-2 text-xs font-bold text-blue-300">
          {row.phaseName}
        </td>
      </tr>
    );
  }

  const ev = row.event;
  return (
    <tr
      key={ev.id}
      className="border-b border-app-text/5 hover:bg-white/[0.03] transition-colors"
    >
      {/* ... 各セル（Step 1と同じ） */}
    </tr>
  );
})}
```

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "feat: TemplateEditor スプレッドシート型テーブル（セル編集・フェーズ区切り）"
```

---

## Task 6: PlanToTemplateModal

**Files:**
- Create: `src/components/admin/PlanToTemplateModal.tsx`

共有URL入力 → プランデータ取得 → プレビュー → テンプレート変換モーダル。

- [ ] **Step 1: PlanToTemplateModal.tsx を作成**

```typescript
/**
 * プランをテンプレートにするモーダル
 * 共有URL入力 → APIでプランデータ取得 → プレビュー → 変換確定
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { apiFetch } from '../../lib/apiClient';
import { convertPlanToTemplate } from '../../utils/templateConversions';
import type { TimelineEvent, Phase } from '../../types';
import type { TemplateData } from '../../data/templateLoader';

interface PlanToTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  hasExistingTemplate: boolean;
  onImport: (events: TimelineEvent[], phases: TemplateData['phases']) => void;
}

interface PlanPreview {
  title: string;
  eventCount: number;
  phaseCount: number;
  events: TimelineEvent[];
  phases: Phase[];
}

/**
 * 共有URLからshareIdを抽出
 * 例: https://lopoly.app/share/AbCdEfGh → AbCdEfGh
 */
function extractShareId(url: string): string | null {
  const trimmed = url.trim();
  // 直接IDの場合
  if (/^[a-zA-Z0-9_-]{6,20}$/.test(trimmed)) return trimmed;
  // URL形式
  const match = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function PlanToTemplateModal({
  isOpen,
  onClose,
  contentId,
  hasExistingTemplate,
  onImport,
}: PlanToTemplateModalProps) {
  useEscapeClose(isOpen, onClose);
  const { t } = useTranslation();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PlanPreview | null>(null);

  if (!isOpen) return null;

  const handleFetch = async () => {
    const shareId = extractShareId(url);
    if (!shareId) {
      setError(t('admin.tpl_promote_error'));
      return;
    }

    setLoading(true);
    setError('');
    setPreview(null);

    try {
      const res = await apiFetch(
        `/api/admin?resource=templates&subtype=plan&planId=${encodeURIComponent(shareId)}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();

      setPreview({
        title: data.title || shareId,
        eventCount: data.timelineEvents?.length ?? 0,
        phaseCount: data.phases?.length ?? 0,
        events: data.timelineEvents ?? [],
        phases: data.phases ?? [],
      });
    } catch {
      setError(t('admin.tpl_promote_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;

    if (hasExistingTemplate) {
      const ok = window.confirm(t('admin.tpl_promote_replace_confirm'));
      if (!ok) return;
    }

    const converted = convertPlanToTemplate(
      { timelineEvents: preview.events, phases: preview.phases },
      contentId,
    );
    onImport(converted.timelineEvents, converted.phases);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-sm font-bold">{t('admin.tpl_promote_title')}</h2>

        {/* URL入力 */}
        <div>
          <label className="block text-[10px] text-app-text-muted mb-1">
            {t('admin.tpl_promote_url_label')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
              placeholder={t('admin.tpl_promote_url_placeholder')}
              className="flex-1 px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded
                         focus:outline-none focus:border-app-text/50 text-app-text"
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="px-3 py-1.5 text-xs border border-blue-500/40 text-blue-400 rounded
                         hover:bg-blue-500/10 transition-colors cursor-pointer
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '...' : t('admin.tpl_promote_preview')}
            </button>
          </div>
        </div>

        {/* エラー */}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* プレビュー */}
        {preview && (
          <div className="border border-app-text/10 rounded p-3 space-y-2">
            <div className="text-xs">
              <span className="text-app-text-muted">{t('admin.tpl_promote_plan_name')}:</span>{' '}
              <span>{preview.title}</span>
            </div>
            <div className="text-xs">
              <span className="text-app-text-muted">{t('admin.tpl_promote_events')}:</span>{' '}
              <span>{preview.eventCount}</span>
            </div>
            <div className="text-xs">
              <span className="text-app-text-muted">{t('admin.tpl_promote_phases')}:</span>{' '}
              <span>{preview.phaseCount}</span>
            </div>
          </div>
        )}

        {/* ボタン */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-app-text/20 rounded
                       hover:bg-app-text/5 transition-colors cursor-pointer text-app-text-muted"
          >
            {t('admin.cancel')}
          </button>
          {preview && (
            <button
              onClick={handleConfirm}
              className="px-3 py-1.5 text-xs border border-blue-500/40 text-blue-400 rounded
                         hover:bg-blue-500/10 transition-colors cursor-pointer"
            >
              {t('admin.tpl_promote_confirm')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/admin/PlanToTemplateModal.tsx
git commit -m "feat: PlanToTemplateModal（プラン共有URL→テンプレート変換）"
```

---

## Task 7: API拡張 — プランデータ取得サブタイプ

**Files:**
- Modify: `api/admin/_templatesHandler.ts`

GET に `subtype=plan&planId={id}` を追加。shared_plans コレクションからプランデータを取得して返す。

- [ ] **Step 1: _templatesHandler.ts の GET セクションにプランデータ取得を追加**

GET メソッド内、`const id = req.query?.id;` の直前に以下を追加:

```typescript
// プランデータ取得（プラン→テンプレート変換用）
if (req.query?.subtype === 'plan' && req.query?.planId) {
  const planId = req.query.planId as string;
  // shared_plans コレクションからプランデータを読み取り
  const planDoc = await db.collection('shared_plans').doc(planId).get();
  if (!planDoc.exists) {
    return res.status(404).json({ error: `Plan "${planId}" not found` });
  }
  const planData = planDoc.data() as any;

  // バンドル共有の場合はエラー
  if (planData.type === 'bundle') {
    return res.status(400).json({ error: 'Bundle shares cannot be converted to templates' });
  }

  // タイムラインとフェーズのみ返却
  const pd = planData.planData;
  if (!pd || !Array.isArray(pd.timelineEvents)) {
    return res.status(400).json({ error: 'Plan does not contain valid timeline data' });
  }

  return res.status(200).json({
    title: planData.title || '',
    contentId: planData.contentId || null,
    timelineEvents: pd.timelineEvents,
    phases: pd.phases || [],
  });
}
```

- [ ] **Step 2: コミット**

```bash
git add api/admin/_templatesHandler.ts
git commit -m "feat: 管理API — プランデータ取得サブタイプ追加（shared_plans読み取り）"
```

---

## Task 8: CsvImportModal

**Files:**
- Create: `src/components/admin/CsvImportModal.tsx`

スプシ貼り付け → 列対応付け → プレビュー → 読み込みモーダル。

- [ ] **Step 1: CsvImportModal.tsx を作成**

```typescript
/**
 * スプシから読み込むモーダル
 * テキストエリアにTSV/CSV貼り付け → 列の対応付け → プレビュー → 読み込み
 */
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import {
  parseTsv,
  guessColumnType,
  convertCsvToEvents,
  type ParsedRow,
  type ColumnType,
  type ColumnMapping,
} from '../../utils/templateConversions';
import type { TimelineEvent } from '../../types';
import type { TemplateData } from '../../data/templateLoader';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (events: TimelineEvent[], phases: TemplateData['phases']) => void;
}

type Step = 'paste' | 'mapping';

export function CsvImportModal({ isOpen, onClose, onImport }: CsvImportModalProps) {
  useEscapeClose(isOpen, onClose);
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('paste');
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [columnTypes, setColumnTypes] = useState<ColumnType[]>([]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleParse = () => {
    setError('');
    const rows = parseTsv(rawText);
    if (rows.length < 2) {
      setError(t('admin.tpl_csv_error'));
      return;
    }
    setParsedRows(rows);

    // ヘッダー行から列タイプを自動推測
    const headerRow = rows[0];
    const types = headerRow.cells.map((cell) => guessColumnType(cell));
    setColumnTypes(types);
    setStep('mapping');
  };

  const handleImport = () => {
    // ヘッダー行を除いたデータ行
    const dataRows = parsedRows.slice(1);
    const mappings: ColumnMapping[] = columnTypes
      .map((type, index) => ({ index, type }))
      .filter((m) => m.type !== 'skip');

    const { events, phases } = convertCsvToEvents(dataRows, mappings);
    if (events.length === 0) {
      setError(t('admin.tpl_csv_error'));
      return;
    }

    onImport(events, phases);
    onClose();
  };

  const columnTypeOptions: { value: ColumnType; label: string }[] = [
    { value: 'time', label: t('admin.tpl_csv_column_time') },
    { value: 'name', label: t('admin.tpl_csv_column_name') },
    { value: 'damage', label: t('admin.tpl_csv_column_damage') },
    { value: 'type', label: t('admin.tpl_csv_column_type') },
    { value: 'target', label: t('admin.tpl_csv_column_target') },
    { value: 'phase', label: t('admin.tpl_csv_column_phase') },
    { value: 'skip', label: t('admin.tpl_csv_column_skip') },
  ];

  // プレビュー行（最初の5行）
  const previewRows = parsedRows.slice(0, 6); // ヘッダー + 5行

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-2xl space-y-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-sm font-bold">{t('admin.tpl_csv_title')}</h2>

        {step === 'paste' && (
          <>
            <label className="block text-[10px] text-app-text-muted mb-1">
              {t('admin.tpl_csv_paste_label')}
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 text-xs bg-transparent border border-app-text/20 rounded
                         focus:outline-none focus:border-app-text/50 text-app-text font-mono resize-y"
              placeholder={'時間\t技名\tダメージ\n0:13\tルーイン\t50000\n0:25\tディアスタシス\t80000'}
            />
          </>
        )}

        {step === 'mapping' && (
          <>
            {/* 列の対応付けドロップダウン */}
            <div className="flex flex-wrap gap-2 mb-3">
              {columnTypes.map((type, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-app-text-muted">
                    {parsedRows[0]?.cells[idx] ?? `列${idx + 1}`}
                  </span>
                  <select
                    value={type}
                    onChange={(e) => {
                      const next = [...columnTypes];
                      next[idx] = e.target.value as ColumnType;
                      setColumnTypes(next);
                    }}
                    className="px-1 py-0.5 text-[10px] bg-app-bg border border-app-text/20 rounded
                               text-app-text [&>option]:bg-app-bg"
                  >
                    {columnTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* プレビューテーブル */}
            <div className="overflow-x-auto border border-app-text/10 rounded">
              <table className="w-full text-[10px]">
                <tbody>
                  {previewRows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={`border-b border-app-text/5 ${rIdx === 0 ? 'bg-app-text/5 font-bold' : ''}`}
                    >
                      {row.cells.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2 py-1 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* エラー */}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* ボタン */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-app-text/20 rounded
                       hover:bg-app-text/5 transition-colors cursor-pointer text-app-text-muted"
          >
            {t('admin.cancel')}
          </button>

          {step === 'paste' && (
            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              className="px-3 py-1.5 text-xs border border-emerald-500/40 text-emerald-400 rounded
                         hover:bg-emerald-500/10 transition-colors cursor-pointer
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('admin.wizard_next')}
            </button>
          )}

          {step === 'mapping' && (
            <>
              <button
                onClick={() => setStep('paste')}
                className="px-3 py-1.5 text-xs border border-app-text/20 rounded
                           hover:bg-app-text/5 transition-colors cursor-pointer text-app-text-muted"
              >
                {t('admin.wizard_back')}
              </button>
              <button
                onClick={handleImport}
                className="px-3 py-1.5 text-xs border border-emerald-500/40 text-emerald-400 rounded
                           hover:bg-emerald-500/10 transition-colors cursor-pointer"
              >
                {t('admin.tpl_csv_import')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/admin/CsvImportModal.tsx
git commit -m "feat: CsvImportModal（スプシTSV貼り付け→列対応付け→テンプレート読み込み）"
```

---

## Task 9: FflogsTranslationModal

**Files:**
- Create: `src/components/admin/FflogsTranslationModal.tsx`

FFLogsレポートURL入力 → 日英ペア取得 → テーブル内の英語名を自動マッチング。

- [ ] **Step 1: FflogsTranslationModal.tsx を作成**

```typescript
/**
 * FFLogsから英語名を取得するモーダル
 * レポートURL入力 → fetchFightEvents(translate=true/false) で日英ペア取得
 * → テーブル内のname.jaと照合して英語名を自動入力
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { resolveFight, fetchFightEvents } from '../../api/fflogs';
import type { FFLogsRawEvent } from '../../api/fflogs';

interface FflogsTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMatched: (matches: Map<string, string>) => void; // jaName → enName
}

/**
 * FFLogsレポートURLからレポートコードを抽出
 */
function extractReportCode(url: string): string | null {
  const trimmed = url.trim();
  // https://www.fflogs.com/reports/XXXXXXXXXX or /reports/XXXXX#fight=1
  const match = trimmed.match(/fflogs\.com\/reports\/([a-zA-Z0-9]+)/);
  if (match) return match[1];
  // 直接コードの場合
  if (/^[a-zA-Z0-9]{10,20}$/.test(trimmed)) return trimmed;
  return null;
}

export function FflogsTranslationModal({
  isOpen,
  onClose,
  onMatched,
}: FflogsTranslationModalProps) {
  useEscapeClose(isOpen, onClose);
  const { t } = useTranslation();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<string>('');

  if (!isOpen) return null;

  const handleFetch = async () => {
    const reportCode = extractReportCode(url);
    if (!reportCode) {
      setError(t('admin.tpl_fflogs_error'));
      return;
    }

    setLoading(true);
    setError('');
    setResult('');

    try {
      // 最後のキル戦闘を取得
      const fight = await resolveFight(reportCode, 'last');
      if (!fight) {
        setError(t('admin.tpl_fflogs_error'));
        setLoading(false);
        return;
      }

      // 英語（translate=true）と日本語（translate=false）の2回取得
      const [eventsEn, eventsJp] = await Promise.all([
        fetchFightEvents(reportCode, fight, true),
        fetchFightEvents(reportCode, fight, false),
      ]);

      // ability.guid をキーにして日英を紐づけ
      const enMap = new Map<number, string>();
      for (const ev of eventsEn) {
        const guid = ev.ability?.guid;
        const name = ev.ability?.name?.trim();
        if (guid !== undefined && name && !enMap.has(guid)) {
          enMap.set(guid, name);
        }
      }

      const jpMap = new Map<number, string>();
      for (const ev of eventsJp) {
        const guid = ev.ability?.guid;
        const name = ev.ability?.name?.trim();
        if (guid !== undefined && name && !jpMap.has(guid)) {
          jpMap.set(guid, name);
        }
      }

      // 日本語名 → 英語名 のマップを作成
      const matches = new Map<string, string>();
      for (const [guid, jpName] of jpMap) {
        const enName = enMap.get(guid);
        if (enName && jpName !== enName) {
          matches.set(jpName, enName);
        }
      }

      if (matches.size > 0) {
        setResult(t('admin.tpl_fflogs_matched', { count: matches.size }));
        onMatched(matches);
      } else {
        setResult(t('admin.tpl_fflogs_no_match'));
      }
    } catch {
      setError(t('admin.tpl_fflogs_error'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-bg border border-app-text/10 rounded-lg p-6 w-full max-w-md space-y-4">
        <h2 className="text-sm font-bold">{t('admin.tpl_fflogs_title')}</h2>

        {/* URL入力 */}
        <div>
          <label className="block text-[10px] text-app-text-muted mb-1">
            {t('admin.tpl_fflogs_url_label')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
              placeholder={t('admin.tpl_fflogs_url_placeholder')}
              className="flex-1 px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded
                         focus:outline-none focus:border-app-text/50 text-app-text"
            />
            <button
              onClick={handleFetch}
              disabled={loading || !url.trim()}
              className="px-3 py-1.5 text-xs border border-purple-500/40 text-purple-400 rounded
                         hover:bg-purple-500/10 transition-colors cursor-pointer
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '...' : t('admin.tpl_fflogs_fetch')}
            </button>
          </div>
        </div>

        {/* エラー */}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* 結果 */}
        {result && (
          <p className={`text-xs ${result.includes('0') ? 'text-amber-400' : 'text-emerald-400'}`}>
            {result}
          </p>
        )}

        {/* 閉じるボタン */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs border border-app-text/20 rounded
                       hover:bg-app-text/5 transition-colors cursor-pointer text-app-text-muted"
          >
            {t('admin.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add src/components/admin/FflogsTranslationModal.tsx
git commit -m "feat: FflogsTranslationModal（FFLogs英語名自動マッチング）"
```

---

## Task 10: AdminTemplates.tsx の統合

**Files:**
- Modify: `src/components/admin/AdminTemplates.tsx`

JSON直アップロードUIをTemplateEditor+ツールバー+モーダル群に置き換え。テンプレート一覧（選択可能）と昇格候補は維持。

- [ ] **Step 1: AdminTemplates.tsx を書き換え**

既存のコンポーネントを以下の構造に変更:

1. コンテンツ選択ドロップダウン + 概要表示
2. TemplateEditorToolbar（3つのモーダル起動ボタン）
3. TemplateEditor（スプレッドシート型テーブル）
4. フッター（undo + 保存ボタン）
5. 既存テンプレート一覧テーブル（下部に移動、縮小表示）
6. 昇格候補セクション（維持）
7. 3つのモーダル

**具体的な変更:**

- `handleUpload` を削除し、`handleSave` に置き換え（useTemplateEditor の getSaveData → POST API）
- コンテンツ選択時に既存テンプレートを GET して loadEvents
- ツールバーからモーダルを開くstate管理（`showPromoteModal`, `showCsvModal`, `showFflogsModal`）
- `showUntranslatedOnly` state
- フッターに `hasChanges` 判定の保存ボタンと undo ボタン

```typescript
/**
 * テンプレート管理画面
 * スプレッドシート型エディター + モーダル群 + テンプレート一覧 + 昇格候補
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { showToast } from '../Toast';
import { useTemplateEditor } from '../../hooks/useTemplateEditor';
import { TemplateEditor } from './TemplateEditor';
import { TemplateEditorToolbar } from './TemplateEditorToolbar';
import { PlanToTemplateModal } from './PlanToTemplateModal';
import { CsvImportModal } from './CsvImportModal';
import { FflogsTranslationModal } from './FflogsTranslationModal';

interface TemplateItem {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  lockedAt: string | null;
  updatedAt: string;
}

interface ContentItem {
  id: string;
  nameJa?: string;
  name?: { ja?: string; en?: string };
}

interface PromotionCandidate {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
}

export function AdminTemplates() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [candidates, setCandidates] = useState<PromotionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // エディター状態
  const [selectedContentId, setSelectedContentId] = useState('');
  const [showUntranslatedOnly, setShowUntranslatedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const editor = useTemplateEditor();

  // モーダル状態
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showFflogsModal, setShowFflogsModal] = useState(false);

  // ── データ取得 ──

  const fetchContents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/admin?resource=contents');
      if (res.ok) {
        const data = await res.json();
        setContents(data.items ?? []);
      }
    } catch {}
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/admin?resource=templates');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemplates(
        (data.templates ?? []).map((item: any) => ({
          ...item,
          lockedAt: item.lockedAt ?? null,
          updatedAt: item.lastUpdatedAt ?? null,
        })),
      );
    } catch {
      setError(t('admin.error_load'));
    } finally {
      setLoading(false);
    }
  }, [user, t]);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/template?action=promote&candidates=true');
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates ?? []);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchTemplates();
    fetchContents();
    fetchCandidates();
  }, [fetchTemplates, fetchContents, fetchCandidates]);

  // ── コンテンツ選択時にテンプレートをロード ──

  const loadTemplateForContent = useCallback(async (contentId: string) => {
    if (!contentId) {
      editor.loadEvents([], []);
      return;
    }
    try {
      const res = await apiFetch(`/api/admin?resource=templates&id=${encodeURIComponent(contentId)}`);
      if (res.ok) {
        const data = await res.json();
        editor.loadEvents(data.timelineEvents ?? [], data.phases ?? []);
      } else if (res.status === 404) {
        editor.loadEvents([], []);
      }
    } catch {
      editor.loadEvents([], []);
    }
  }, [editor]);

  const handleContentChange = (contentId: string) => {
    if (editor.hasChanges) {
      const ok = window.confirm(t('admin.tpl_editor_unsaved'));
      if (!ok) return;
    }
    setSelectedContentId(contentId);
    setShowUntranslatedOnly(false);
    loadTemplateForContent(contentId);
  };

  // ── 保存 ──

  const handleSave = async () => {
    if (!selectedContentId) return;

    // 未翻訳チェック
    if (editor.untranslatedCount > 0) {
      const ok = window.confirm(
        t('admin.tpl_editor_save_confirm_untranslated', { count: editor.untranslatedCount }),
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const { events, phases } = editor.getSaveData();
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId: selectedContentId,
          timelineEvents: events,
          phases,
          source: 'admin_editor',
        }),
      });
      if (!res.ok) throw new Error();
      showToast(t('admin.tpl_editor_saved'));
      // 保存後にリロード（savedデータをoriginalに）
      await loadTemplateForContent(selectedContentId);
      await fetchTemplates();
    } catch {
      showToast(t('admin.tpl_editor_save_error'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── テンプレート削除・ロック（既存機能維持） ──

  const handleDelete = async (item: TemplateItem) => {
    const ok = window.confirm(t('admin.templates_delete_confirm', { name: item.contentId }));
    if (!ok) return;
    try {
      const res = await apiFetch(`/api/admin?resource=templates&contentId=${item.contentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      showToast(t('admin.templates_deleted'));
      if (item.contentId === selectedContentId) {
        editor.loadEvents([], []);
      }
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'), 'error');
    }
  };

  const handleToggleLock = async (item: TemplateItem) => {
    try {
      const res = await apiFetch('/api/admin?resource=templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId: item.contentId, lock: !item.lockedAt }),
      });
      if (!res.ok) throw new Error();
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'), 'error');
    }
  };

  // ── 昇格候補 ──

  const handlePromotion = async (candidate: PromotionCandidate, action: 'approve' | 'reject') => {
    try {
      const res = await apiFetch('/api/template?action=promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: candidate.shareId, contentId: candidate.contentId, action }),
      });
      if (!res.ok) throw new Error();
      await fetchCandidates();
      await fetchTemplates();
    } catch {
      showToast(t('admin.error_save'), 'error');
    }
  };

  // ── モーダルコールバック ──

  const handlePromoteImport = (events: any[], phases: any[]) => {
    editor.replaceAll(events, phases);
  };

  const handleCsvImport = (events: any[], phases: any[]) => {
    editor.replaceAll(events, phases);
  };

  const handleFflogsMatched = (matches: Map<string, string>) => {
    editor.autoFillEnNames(matches);
  };

  const hasExistingTemplate = templates.some((t) => t.contentId === selectedContentId);

  const inputClass =
    'px-2 py-1.5 text-xs bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.templates_title')}</h1>

      {/* コンテンツ選択 + 概要 */}
      <div className="mb-4 flex items-center gap-3">
        <select
          className={`${inputClass} bg-app-bg [&>option]:bg-app-bg [&>option]:text-app-text`}
          value={selectedContentId}
          onChange={(e) => handleContentChange(e.target.value)}
        >
          <option value="">{t('admin.tpl_editor_no_content')}</option>
          {contents.map((c) => {
            const name = c.nameJa || c.name?.ja || c.id;
            return (
              <option key={c.id} value={c.id}>
                {c.id.toUpperCase()} — {name}
              </option>
            );
          })}
        </select>
        {selectedContentId && editor.visibleEvents.length > 0 && (
          <span className="text-xs text-app-text-muted">
            {t('admin.tpl_editor_content_summary', {
              events: editor.visibleEvents.length,
              phases: editor.state.currentPhases.length,
            })}
          </span>
        )}
      </div>

      {/* ツールバー */}
      {selectedContentId && (
        <TemplateEditorToolbar
          untranslatedCount={editor.untranslatedCount}
          showUntranslatedOnly={showUntranslatedOnly}
          onToggleUntranslatedOnly={() => setShowUntranslatedOnly((v) => !v)}
          onOpenPromote={() => setShowPromoteModal(true)}
          onOpenCsvImport={() => setShowCsvModal(true)}
          onOpenFflogsTranslation={() => setShowFflogsModal(true)}
          hasEvents={editor.visibleEvents.length > 0}
        />
      )}

      {/* スプレッドシート型エディター */}
      {selectedContentId && editor.visibleEvents.length > 0 && (
        <TemplateEditor
          events={editor.visibleEvents}
          phases={editor.state.currentPhases}
          editState={editor.state}
          showUntranslatedOnly={showUntranslatedOnly}
          onUpdateCell={editor.updateCell}
          onDeleteEvent={editor.deleteEvent}
        />
      )}

      {/* 空状態メッセージ */}
      {selectedContentId && editor.visibleEvents.length === 0 && !loading && (
        <p className="text-xs text-app-text-muted py-4">{t('admin.tpl_editor_empty')}</p>
      )}

      {/* フッター（undo + 保存） */}
      {selectedContentId && editor.visibleEvents.length > 0 && (
        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-app-text/10">
          <button
            onClick={editor.undo}
            disabled={!editor.hasChanges}
            className="px-3 py-1.5 text-xs border border-app-text/20 rounded
                       hover:bg-app-text/5 transition-colors cursor-pointer text-app-text-muted
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {t('admin.tpl_editor_undo')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-xs border border-blue-500/40 text-blue-400 rounded
                       hover:bg-blue-500/10 transition-colors cursor-pointer
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '...' : t('admin.tpl_editor_save')}
          </button>
        </div>
      )}

      {/* エラー */}
      {error && <p className="text-xs text-app-text-muted mb-4 mt-4">{error}</p>}
      {loading && <p className="text-xs text-app-text-muted">...</p>}

      {/* 既存テンプレート一覧テーブル */}
      {!loading && templates.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold mb-3">{t('admin.templates_title')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app-text/10 text-left text-app-text-muted">
                  <th className="pb-2 pr-4">{t('admin.contents_id')}</th>
                  <th className="pb-2 pr-4">{t('admin.templates_source')}</th>
                  <th className="pb-2 pr-4">{t('admin.templates_events')}</th>
                  <th className="pb-2 pr-4">{t('admin.templates_phases')}</th>
                  <th className="pb-2 pr-4">{t('admin.templates_locked')}</th>
                  <th className="pb-2 pr-4">{t('admin.templates_last_updated')}</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((item) => (
                  <tr
                    key={item.contentId}
                    className={`border-b border-app-text/5 hover:bg-app-text/5 transition-colors cursor-pointer ${
                      item.contentId === selectedContentId ? 'bg-blue-500/[0.06]' : ''
                    }`}
                    onClick={() => handleContentChange(item.contentId)}
                  >
                    <td className="py-2 pr-4 font-mono">{item.contentId}</td>
                    <td className="py-2 pr-4">{item.source}</td>
                    <td className="py-2 pr-4">{item.eventCount}</td>
                    <td className="py-2 pr-4">{item.phaseCount}</td>
                    <td className="py-2 pr-4">
                      <span className="text-app-text-muted">
                        {item.lockedAt ? t('admin.template_locked') : t('admin.template_discovery')}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-app-text-muted">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-2 text-right flex items-center gap-2 justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleLock(item); }}
                        className="text-app-text-muted hover:text-app-text transition-colors"
                      >
                        {item.lockedAt ? t('admin.template_unlock') : t('admin.template_lock')}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                        className="text-app-text-muted hover:text-app-text transition-colors"
                      >
                        {t('admin.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 昇格候補セクション */}
      <div className="mt-8">
        <h2 className="text-sm font-bold mb-3">{t('admin.promotion_candidates')}</h2>
        {candidates.length === 0 ? (
          <p className="text-xs text-app-text-muted">{t('admin.promotion_empty')}</p>
        ) : (
          <div className="space-y-2">
            {candidates.map((c) => (
              <div
                key={c.shareId}
                className="flex items-center gap-3 p-3 border border-app-text/10 rounded text-xs"
              >
                <span className="font-mono">{c.contentId}</span>
                <span className="flex-1 truncate">{c.title}</span>
                <span className="text-app-text-muted">
                  {t('admin.promotion_copy_count')}: {c.copyCount}
                </span>
                <button
                  onClick={() => handlePromotion(c, 'approve')}
                  className="px-2 py-1 border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                >
                  {t('admin.promotion_approve')}
                </button>
                <button
                  onClick={() => handlePromotion(c, 'reject')}
                  className="px-2 py-1 border border-app-text/30 rounded hover:bg-app-text/10 transition-colors"
                >
                  {t('admin.promotion_reject')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* モーダル群 */}
      <PlanToTemplateModal
        isOpen={showPromoteModal}
        onClose={() => setShowPromoteModal(false)}
        contentId={selectedContentId}
        hasExistingTemplate={hasExistingTemplate}
        onImport={handlePromoteImport}
      />
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onImport={handleCsvImport}
      />
      <FflogsTranslationModal
        isOpen={showFflogsModal}
        onClose={() => setShowFflogsModal(false)}
        onMatched={handleFflogsMatched}
      />
    </div>
  );
}
```

- [ ] **Step 2: 動作確認**

ローカルサーバーで `/admin/templates` を開き、以下を確認:
- コンテンツ選択ドロップダウンが表示される
- コンテンツを選ぶと既存テンプレートがスプレッドシートに表示される
- セルクリックで編集できる
- 変更後に黄色ハイライトが付く
- undo・保存ボタンが機能する
- テンプレート一覧テーブルのクリックでコンテンツが選択される
- 昇格候補が表示される

```bash
npm run dev
```

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/AdminTemplates.tsx
git commit -m "feat: AdminTemplates統合 — スプレッドシート型エディター + モーダル群"
```

---

## Task 11: ビルド確認 + 最終修正

**Files:**
- 全ファイル（型エラー・import漏れの修正）

- [ ] **Step 1: TypeScriptビルドチェック**

```bash
npx tsc --noEmit
```

型エラーがあれば修正。よくあるパターン:
- `source` フィールドが `TemplateData` 型にない → `templateConversions.ts` の戻り値型を調整
- `admin.close` / `admin.cancel` キーがlocaleにない → 追加
- FFLogs API の `fetchFightEvents` の引数が合わない → 既存シグネチャに合わせる

- [ ] **Step 2: Viteビルドチェック**

```bash
npm run build
```

- [ ] **Step 3: 最終コミット + push**

```bash
git add -A
git commit -m "fix: テンプレートエディター ビルドエラー修正"
git push origin main
```

---

## 設計書チェック

| 設計書セクション | 対応タスク |
|----------------|-----------|
| 1. 画面構成（レイアウト・テーブル列・ハイライト） | Task 4, 5, 10 |
| 2. プランをテンプレートにする | Task 2, 6, 7, 10 |
| 3. スプシから読み込む | Task 2, 8, 10 |
| 4. 翻訳の欠落を埋める（FFLogs + 手動） | Task 3, 4, 9, 10 |
| 5. データ構造（EditState） | Task 3 |
| 6. API変更（プランデータ取得） | Task 7 |
| 7. ファイル構成 | 全タスク |
| 8. エラー処理 | Task 6, 8, 9, 10 |
| 9. 操作フロー（A/B/C） | Task 10（統合） |
| UI用語ルール | Task 1（i18nキー） |
