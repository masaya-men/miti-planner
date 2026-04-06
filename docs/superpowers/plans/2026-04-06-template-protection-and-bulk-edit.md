# テンプレート保護 + エディタ一括編集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面で保存したテンプレートをFFLogs自動登録から保護し、テンプレートエディタに一括編集機能を追加する

**Architecture:** 機能1はAPI側1箇所の変更（POST時にlockedAt付与）。機能2はTemplateEditorにチェックボックス列を追加し、ToolbarにAAフィルタ・選択数表示・一括変更ボタンを追加、新規BulkEditPopoverコンポーネントで一括変更UIを提供する。useTemplateEditorにbulkUpdate関数を追加。

**Tech Stack:** React, TypeScript, Tailwind CSS, i18next, Firebase Admin SDK

---

## File Structure

| ファイル | 責任 |
|---|---|
| `api/admin/_templatesHandler.ts` | POST時のlockedAt自動付与（機能1） |
| `src/hooks/useTemplateEditor.ts` | bulkUpdate関数追加 |
| `src/components/admin/TemplateEditor.tsx` | チェックボックス列追加 |
| `src/components/admin/TemplateEditorToolbar.tsx` | AAフィルタ・選択数表示・一括変更ボタン |
| `src/components/admin/BulkEditPopover.tsx` | **新規** 一括変更ポップアップ |
| `src/components/admin/AdminTemplates.tsx` | 選択state管理、フィルタstate、props接続 |
| `src/locales/ja.json` | 新規i18nキー追加 |
| `src/locales/en.json` | 新規i18nキー追加 |

---

### Task 1: テンプレート保護 — lockedAt自動付与

**Files:**
- Modify: `api/admin/_templatesHandler.ts:196-204`

- [ ] **Step 1: POST時にlockedAtを付与する**

`api/admin/_templatesHandler.ts` の196-204行目、templateDataオブジェクトの `lockedAt: null` を `lockedAt: FieldValue.serverTimestamp()` に変更する:

```typescript
const templateData = {
  contentId,
  source: source || 'admin_manual',
  timelineEvents,
  phases: phases || [],
  lockedAt: FieldValue.serverTimestamp(),
  lastUpdatedAt: FieldValue.serverTimestamp(),
  lastUpdatedBy: adminUid,
};
```

- [ ] **Step 2: 動作確認**

管理画面でテンプレートを保存し、テンプレート一覧で `lockedAt` が設定されている（鍵マーク表示）ことを確認する。

- [ ] **Step 3: コミット**

```bash
git add api/admin/_templatesHandler.ts
git commit -m "feat: 管理画面保存テンプレートにlockedAt自動付与（自動登録保護）"
```

---

### Task 2: useTemplateEditorにbulkUpdate関数を追加

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts`

- [ ] **Step 1: bulkUpdate関数を実装**

`useTemplateEditor.ts` の `updateLabelEn` 関数の後（266行目付近）に以下を追加:

```typescript
// 複数イベントのフィールドを一括更新
const bulkUpdate = useCallback(
  (eventIds: Set<string>, changes: Record<string, unknown>) => {
    setState((prev) => {
      const newCurrent = structuredClone(prev.current);
      const newModified = new Set(prev.modified);

      for (const ev of newCurrent) {
        if (!eventIds.has(ev.id) || prev.deleted.has(ev.id)) continue;

        for (const [field, value] of Object.entries(changes)) {
          switch (field) {
            case 'name.ja':
              ev.name.ja = value as string;
              break;
            case 'name.en':
              ev.name.en = value as string;
              break;
            case 'target':
              ev.target = value as TimelineEvent['target'];
              break;
            case 'damageAmount':
              ev.damageAmount = value as number | undefined;
              break;
            case 'damageType':
              ev.damageType = value as TimelineEvent['damageType'];
              break;
          }
          newModified.add(`${ev.id}:${field}`);
        }
      }

      return { ...prev, current: newCurrent, modified: newModified };
    });
  },
  [],
);
```

- [ ] **Step 2: returnオブジェクトにbulkUpdateを追加**

returnオブジェクト（275行目付近）に `bulkUpdate` を追加:

```typescript
return {
  // ...既存のプロパティ
  updateLabelEn,
  bulkUpdate,        // ← 追加
  autoPropagate,
  setAutoPropagate,
};
```

- [ ] **Step 3: ビルド確認**

```bash
npx tsc --noEmit
```
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/hooks/useTemplateEditor.ts
git commit -m "feat: useTemplateEditorにbulkUpdate関数を追加"
```

---

### Task 3: BulkEditPopoverコンポーネントを作成

**Files:**
- Create: `src/components/admin/BulkEditPopover.tsx`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: i18nキーを追加**

`src/locales/ja.json` のadminセクション（`tpl_editor_auto_propagate` の後あたり）に以下を追加:

```json
"tpl_bulk_edit_title": "一括変更（{{count}}件）",
"tpl_bulk_edit_name_ja": "技名(JA)",
"tpl_bulk_edit_name_en": "技名(EN)",
"tpl_bulk_edit_target": "対象",
"tpl_bulk_edit_damage": "ダメージ",
"tpl_bulk_edit_damage_type": "種別",
"tpl_bulk_edit_no_change": "変更しない",
"tpl_bulk_edit_apply": "適用",
"tpl_bulk_edit_cancel": "キャンセル",
"tpl_bulk_selected": "{{count}}件選択中",
"tpl_bulk_edit_btn": "一括変更",
"tpl_filter_aa_only": "AAのみ"
```

`src/locales/en.json` のadminセクションに以下を追加:

```json
"tpl_bulk_edit_title": "Bulk Edit ({{count}} items)",
"tpl_bulk_edit_name_ja": "Name (JA)",
"tpl_bulk_edit_name_en": "Name (EN)",
"tpl_bulk_edit_target": "Target",
"tpl_bulk_edit_damage": "Damage",
"tpl_bulk_edit_damage_type": "Type",
"tpl_bulk_edit_no_change": "No change",
"tpl_bulk_edit_apply": "Apply",
"tpl_bulk_edit_cancel": "Cancel",
"tpl_bulk_selected": "{{count}} selected",
"tpl_bulk_edit_btn": "Bulk Edit",
"tpl_filter_aa_only": "AA Only"
```

- [ ] **Step 2: BulkEditPopoverコンポーネントを作成**

`src/components/admin/BulkEditPopover.tsx` を作成:

```tsx
/**
 * テンプレートエディター 一括変更ポップアップ
 * 選択された行のフィールドを一括で更新する
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BulkEditPopoverProps {
  selectedCount: number;
  onApply: (changes: Record<string, unknown>) => void;
  onClose: () => void;
}

const SENTINEL_NO_CHANGE = '__no_change__';

export function BulkEditPopover({ selectedCount, onApply, onClose }: BulkEditPopoverProps) {
  const { t } = useTranslation();
  const [nameJa, setNameJa] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [target, setTarget] = useState(SENTINEL_NO_CHANGE);
  const [damageAmount, setDamageAmount] = useState('');
  const [damageType, setDamageType] = useState(SENTINEL_NO_CHANGE);

  const handleApply = () => {
    const changes: Record<string, unknown> = {};
    if (nameJa) changes['name.ja'] = nameJa;
    if (nameEn) changes['name.en'] = nameEn;
    if (target !== SENTINEL_NO_CHANGE) changes['target'] = target;
    if (damageAmount) {
      const num = parseInt(damageAmount, 10);
      if (!isNaN(num)) changes['damageAmount'] = num;
    }
    if (damageType !== SENTINEL_NO_CHANGE) changes['damageType'] = damageType;

    if (Object.keys(changes).length > 0) {
      onApply(changes);
    }
    onClose();
  };

  const inputClass =
    'w-full px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const selectClass =
    'w-full px-2 py-1 text-app-lg bg-app-bg border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text [&>option]:bg-app-bg [&>option]:text-app-text';
  const labelClass = 'text-app-base text-app-text-muted';

  return (
    <div className="absolute top-full mt-1 right-0 z-50 bg-app-bg border border-app-text/20 rounded-lg p-4 shadow-lg min-w-[280px]">
      <h3 className="text-app-lg font-medium mb-3">
        {t('admin.tpl_bulk_edit_title', { count: selectedCount })}
      </h3>

      <div className="space-y-2">
        {/* 技名(JA) */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_name_ja')}</label>
          <input
            type="text"
            value={nameJa}
            onChange={(e) => setNameJa(e.target.value)}
            placeholder={t('admin.tpl_bulk_edit_no_change')}
            className={inputClass}
          />
        </div>

        {/* 技名(EN) */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_name_en')}</label>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('admin.tpl_bulk_edit_no_change')}
            className={inputClass}
          />
        </div>

        {/* 対象 */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_target')}</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
            <option value={SENTINEL_NO_CHANGE}>{t('admin.tpl_bulk_edit_no_change')}</option>
            <option value="MT">MT</option>
            <option value="ST">ST</option>
            <option value="AoE">AoE</option>
          </select>
        </div>

        {/* ダメージ */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_damage')}</label>
          <input
            type="number"
            value={damageAmount}
            onChange={(e) => setDamageAmount(e.target.value)}
            placeholder={t('admin.tpl_bulk_edit_no_change')}
            className={inputClass}
          />
        </div>

        {/* 種別 */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_damage_type')}</label>
          <select value={damageType} onChange={(e) => setDamageType(e.target.value)} className={selectClass}>
            <option value={SENTINEL_NO_CHANGE}>{t('admin.tpl_bulk_edit_no_change')}</option>
            <option value="physical">Physical</option>
            <option value="magical">Magical</option>
            <option value="unavoidable">Unavoidable</option>
          </select>
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="text-app-lg px-3 py-1 rounded border border-app-text/20 text-app-text-muted hover:bg-app-text/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_bulk_edit_cancel')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="text-app-lg px-3 py-1 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_bulk_edit_apply')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ビルド確認**

```bash
npx tsc --noEmit
```
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/BulkEditPopover.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: BulkEditPopoverコンポーネント + i18nキー追加"
```

---

### Task 4: TemplateEditorToolbarにAAフィルタ・選択表示・一括変更ボタンを追加

**Files:**
- Modify: `src/components/admin/TemplateEditorToolbar.tsx`

- [ ] **Step 1: propsインターフェースを拡張**

`TemplateEditorToolbarProps` に以下のプロパティを追加:

```typescript
interface TemplateEditorToolbarProps {
  // ... 既存のprops
  showAaOnly: boolean;
  onToggleAaOnly: () => void;
  selectedCount: number;
  onOpenBulkEdit: () => void;
}
```

- [ ] **Step 2: コンポーネントにAAフィルタ・選択表示・一括変更ボタンを追加**

`TemplateEditorToolbar` の引数にも追加し、右側セクション（スペーサーの後）にAAフィルタボタンを追加、選択表示と一括変更ボタンを追加する:

```tsx
export function TemplateEditorToolbar({
  // ... 既存のprops
  showAaOnly,
  onToggleAaOnly,
  selectedCount,
  onOpenBulkEdit,
}: TemplateEditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 左側: 操作ボタン群（既存のまま） */}
      {/* ... 4つの既存ボタン ... */}

      {/* 選択数表示 + 一括変更ボタン（選択時のみ） */}
      {selectedCount > 0 && (
        <>
          <span className="text-app-lg text-blue-400">
            {t('admin.tpl_bulk_selected', { count: selectedCount })}
          </span>
          <button
            type="button"
            onClick={onOpenBulkEdit}
            className={`${baseButtonClass} border-blue-500/40 text-blue-400 hover:bg-blue-500/10`}
          >
            {t('admin.tpl_bulk_edit_btn')}
          </button>
        </>
      )}

      {/* スペーサー */}
      <div className="flex-1" />

      {/* 右側: AAフィルタ + 未翻訳カウンター + フィルタートグル */}
      <button
        type="button"
        onClick={onToggleAaOnly}
        className={`${baseButtonClass} ${
          showAaOnly
            ? 'border-amber-500/60 bg-amber-500/15 text-amber-400'
            : 'border-app-text/20 text-app-text-muted hover:bg-app-text/10'
        }`}
      >
        {t('admin.tpl_filter_aa_only')}
      </button>

      {/* ... 既存の未翻訳カウンターとフィルタートグル ... */}
    </div>
  );
}
```

- [ ] **Step 3: ビルド確認**

```bash
npx tsc --noEmit
```
Expected: AdminTemplates.tsxでまだ新しいpropsを渡していないためエラーがある可能性。次のTaskで解消する。

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/TemplateEditorToolbar.tsx
git commit -m "feat: ToolbarにAAフィルタ・選択表示・一括変更ボタンを追加"
```

---

### Task 5: TemplateEditorにチェックボックス列を追加

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`

- [ ] **Step 1: propsインターフェースを拡張**

`TemplateEditorProps` に選択関連のpropsを追加:

```typescript
interface TemplateEditorProps {
  // ... 既存のprops
  selectedIds: Set<string>;
  onToggleSelect: (eventId: string) => void;
  onToggleSelectAll: () => void;
}
```

- [ ] **Step 2: チェックボックス列をテーブルに追加**

`colgroup` の先頭にチェックボックス列用のcolを追加:

```tsx
<col style={{ width: '32px' }} />  {/* チェックボックス */}
```

`thead` の先頭にヘッダーチェックボックスを追加:

```tsx
<th className="pb-2 pr-1">
  <input
    type="checkbox"
    checked={filteredEvents.length > 0 && filteredEvents.every((ev) => selectedIds.has(ev.id))}
    onChange={onToggleSelectAll}
    className="cursor-pointer accent-blue-500"
  />
</th>
```

各行の先頭（フェーズ列の前）にチェックボックスセルを追加:

```tsx
<td className="py-1 pr-1">
  <input
    type="checkbox"
    checked={selectedIds.has(evId)}
    onChange={() => onToggleSelect(evId)}
    className="cursor-pointer accent-blue-500"
  />
</td>
```

- [ ] **Step 3: ビルド確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "feat: TemplateEditorにチェックボックス列を追加"
```

---

### Task 6: AdminTemplatesで全体を接続

**Files:**
- Modify: `src/components/admin/AdminTemplates.tsx`

- [ ] **Step 1: 選択state・フィルタstate・一括変更ポップアップstateを追加**

`AdminTemplates` コンポーネント内にstateを追加（既存のモーダル表示フラグの近く）:

```typescript
// 一括編集用ステート
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [showAaOnly, setShowAaOnly] = useState(false);
const [showBulkEdit, setShowBulkEdit] = useState(false);
```

- [ ] **Step 2: 選択操作のハンドラーを追加**

```typescript
// チェックボックスのトグル
const handleToggleSelect = useCallback((eventId: string) => {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    return next;
  });
}, []);

// 全選択/全解除（表示中のイベントのみ対象）
const handleToggleSelectAll = useCallback(() => {
  const filtered = showAaOnly
    ? editor.visibleEvents.filter((ev) => ev.name.ja === 'AA' && ev.name.en === 'AA')
    : showUntranslatedOnly
      ? editor.visibleEvents.filter((ev) => !ev.name.en.trim())
      : editor.visibleEvents;
  setSelectedIds((prev) => {
    const allSelected = filtered.every((ev) => prev.has(ev.id));
    if (allSelected) return new Set();
    return new Set(filtered.map((ev) => ev.id));
  });
}, [editor.visibleEvents, showAaOnly, showUntranslatedOnly]);

// 一括変更の適用
const handleBulkApply = useCallback((changes: Record<string, unknown>) => {
  editor.bulkUpdate(selectedIds, changes);
  setSelectedIds(new Set());
  setShowBulkEdit(false);
}, [editor, selectedIds]);
```

- [ ] **Step 3: フィルタロジックをTemplateEditorから引き上げ**

TemplateEditorに渡すeventsを、AdminTemplates側でAAフィルタを適用してから渡すようにする。TemplateEditorの内部にあるshowUntranslatedOnlyフィルタは既存のままでOK（フィルタはAND）:

```typescript
// AAフィルタを適用したイベント
const filteredVisibleEvents = showAaOnly
  ? editor.visibleEvents.filter((ev) => ev.name.ja === 'AA' && ev.name.en === 'AA')
  : editor.visibleEvents;
```

TemplateEditorに渡すeventsを `filteredVisibleEvents` に変更。

- [ ] **Step 4: BulkEditPopoverをインポートしてToolbarの近くに配置**

```typescript
import { BulkEditPopover } from './BulkEditPopover';
```

ToolbarのdivをrelativeにしてBulkEditPopoverを配置:

```tsx
{selectedContentId && (
  <div className="mb-3 relative">
    <TemplateEditorToolbar
      // ... 既存のprops
      showAaOnly={showAaOnly}
      onToggleAaOnly={() => { setShowAaOnly((v) => !v); setSelectedIds(new Set()); }}
      selectedCount={selectedIds.size}
      onOpenBulkEdit={() => setShowBulkEdit(true)}
    />
    {showBulkEdit && selectedIds.size > 0 && (
      <BulkEditPopover
        selectedCount={selectedIds.size}
        onApply={handleBulkApply}
        onClose={() => setShowBulkEdit(false)}
      />
    )}
  </div>
)}
```

- [ ] **Step 5: TemplateEditorにチェックボックスpropsを渡す**

```tsx
<TemplateEditor
  events={filteredVisibleEvents}
  phases={editor.state.currentPhases}
  editState={editor.state}
  showUntranslatedOnly={showUntranslatedOnly}
  onUpdateCell={editor.updateCell}
  onDeleteEvent={editor.deleteEvent}
  onUpdateLabelEn={editor.updateLabelEn}
  selectedIds={selectedIds}
  onToggleSelect={handleToggleSelect}
  onToggleSelectAll={handleToggleSelectAll}
/>
```

- [ ] **Step 6: コンテンツ切り替え時に選択をリセット**

`handleContentChange` 内に `setSelectedIds(new Set())` と `setShowAaOnly(false)` を追加（`setShowUntranslatedOnly(false)` の近く）。

- [ ] **Step 7: ビルド確認**

```bash
npx tsc --noEmit
```
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/components/admin/AdminTemplates.tsx
git commit -m "feat: AdminTemplatesで一括編集・AAフィルタ・チェックボックスを接続"
```

---

### Task 7: zh/koロケールにi18nキーを追加 + 最終確認

**Files:**
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: zh.jsonとko.jsonにi18nキーを追加**

ja.jsonに追加した同じキーを、zh.jsonとko.jsonのadminセクションにも追加する（英語のフォールバック値で可）:

zh.json:
```json
"tpl_bulk_edit_title": "批量编辑（{{count}}件）",
"tpl_bulk_edit_name_ja": "技能名(JA)",
"tpl_bulk_edit_name_en": "技能名(EN)",
"tpl_bulk_edit_target": "目标",
"tpl_bulk_edit_damage": "伤害",
"tpl_bulk_edit_damage_type": "类型",
"tpl_bulk_edit_no_change": "不变更",
"tpl_bulk_edit_apply": "应用",
"tpl_bulk_edit_cancel": "取消",
"tpl_bulk_selected": "已选择{{count}}件",
"tpl_bulk_edit_btn": "批量编辑",
"tpl_filter_aa_only": "仅AA"
```

ko.json:
```json
"tpl_bulk_edit_title": "일괄 변경 ({{count}}건)",
"tpl_bulk_edit_name_ja": "기술명(JA)",
"tpl_bulk_edit_name_en": "기술명(EN)",
"tpl_bulk_edit_target": "대상",
"tpl_bulk_edit_damage": "데미지",
"tpl_bulk_edit_damage_type": "유형",
"tpl_bulk_edit_no_change": "변경 안 함",
"tpl_bulk_edit_apply": "적용",
"tpl_bulk_edit_cancel": "취소",
"tpl_bulk_selected": "{{count}}건 선택 중",
"tpl_bulk_edit_btn": "일괄 변경",
"tpl_filter_aa_only": "AA만"
```

- [ ] **Step 2: 全体ビルド確認**

```bash
npx tsc --noEmit
```
Expected: エラーなし

- [ ] **Step 3: 開発サーバーで動作確認**

```bash
npm run dev
```

管理画面（/admin/templates）で以下を確認:
1. コンテンツを選択してテンプレートを表示
2. 各行にチェックボックスが表示される
3. 「AAのみ」フィルタで絞り込みできる
4. チェックボックスで選択すると「N件選択中」「一括変更」がツールバーに表示される
5. 一括変更ポップアップで値を入力して適用すると、選択行が更新される
6. 「変更を元に戻す」で一括変更がUndoされる
7. 保存するとlockedAtが設定される

- [ ] **Step 4: コミット**

```bash
git add src/locales/zh.json src/locales/ko.json
git commit -m "feat: 一括編集i18nキーをzh/koロケールに追加"
```
