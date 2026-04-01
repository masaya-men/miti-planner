# テンプレートエディター機能強化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テンプレートエディターにギミックグループ認識・フェーズ範囲編集・翻訳自動伝播・ダメージパース修正を追加する

**Architecture:** CSVインポート時にギミックグループ列を認識し、各イベントに `mechanicGroup` フィールドを付与。エディターでギミックグループ単位のセパレーター行にフェーズ選択UIを配置。翻訳伝播は `useTemplateEditor` フック内に JA↔EN 双方向伝播ロジックを追加。

**Tech Stack:** React, TypeScript, i18next, Tailwind CSS

**設計書:** `docs/superpowers/specs/2026-04-02-template-editor-enhancements.md`

---

## ファイル構成

| ファイル | 変更内容 |
|---------|---------|
| `src/types/index.ts` | `TimelineEvent` に `mechanicGroup?: string` 追加 |
| `src/utils/templateConversions.ts` | `ColumnType` に `'mechanic'` 追加、`guessColumnType` 更新、`convertCsvToEvents` でギミックグループ処理 |
| `src/hooks/useTemplateEditor.ts` | 翻訳伝播ロジック (`propagateTranslation`)、フェーズ更新 (`updatePhaseForGroup`)、自動伝播トグル状態 |
| `src/components/admin/TemplateEditor.tsx` | ギミックグループセパレーター行、フェーズ選択ドロップダウン、列構成変更 |
| `src/components/admin/TemplateEditorToolbar.tsx` | 翻訳自動伝播トグルボタン追加 |
| `src/components/admin/CsvImportModal.tsx` | `COLUMN_TYPES` に `'mechanic'` 追加 |
| `src/locales/ja.json` | 新規 i18n キー追加 |
| `src/locales/en.json` | 新規 i18n キー追加 |

---

### Task 1: TimelineEvent 型に mechanicGroup を追加

**Files:**
- Modify: `src/types/index.ts:58-66`

- [ ] **Step 1: `TimelineEvent` に `mechanicGroup` フィールドを追加**

`src/types/index.ts` の `TimelineEvent` インターフェースに追加:

```typescript
export interface TimelineEvent {
    id: string;
    time: number; // seconds from start
    name: LocalizedString;
    damageType: 'magical' | 'physical' | 'unavoidable' | 'enrage';
    damageAmount?: number;
    target?: 'AoE' | 'MT' | 'ST';
    warning?: boolean; // Indicates mitigation is insufficient
    mechanicGroup?: string; // ギミックグループ名（例: "開幕", "蒼天の陣：雷槍"）
}
```

- [ ] **Step 2: コミット**

```bash
git add src/types/index.ts
git commit -m "feat: TimelineEvent に mechanicGroup フィールドを追加"
```

---

### Task 2: CSVインポートでギミックグループ列を認識

**Files:**
- Modify: `src/utils/templateConversions.ts:15, 96-107, 167-234`
- Modify: `src/components/admin/CsvImportModal.tsx:34`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: `ColumnType` に `'mechanic'` を追加**

`src/utils/templateConversions.ts:15`:

```typescript
export type ColumnType = 'time' | 'name' | 'damage' | 'type' | 'target' | 'phase' | 'mechanic' | 'skip';
```

- [ ] **Step 2: `guessColumnType` にギミック列の推測を追加**

`src/utils/templateConversions.ts` の `guessColumnType` 関数を更新:

```typescript
export function guessColumnType(header: string): ColumnType {
  const h = header.toLowerCase().trim();

  if (/時間|time/.test(h)) return 'time';
  if (/技名|name|ability/.test(h)) return 'name';
  if (/ダメージ|damage/.test(h)) return 'damage';
  if (/種別|type/.test(h)) return 'type';
  if (/対象|target/.test(h)) return 'target';
  if (/フェーズ|phase/.test(h)) return 'phase';
  if (/ギミック|mechanic|group/.test(h)) return 'mechanic';

  return 'skip';
}
```

- [ ] **Step 3: `convertCsvToEvents` でギミックグループを処理**

`src/utils/templateConversions.ts` の `convertCsvToEvents` 関数を更新。`mechanic` 列がマッピングされている場合、値がある行で新しいギミックグループが始まり、空の行は直前のグループに属する:

```typescript
export function convertCsvToEvents(
  rows: ParsedRow[],
  mappings: ColumnMapping[],
): { events: TimelineEvent[]; phases: TemplateData['phases'] } {
  const events: TimelineEvent[] = [];
  const phases: TemplateData['phases'] = [];

  let phaseCounter = 0;
  let currentPhaseName: string | null = null;
  let currentMechanicGroup: string | undefined = undefined;

  rows.forEach((row, rowIndex) => {
    const get = (type: ColumnType): string => {
      const mapping = mappings.find(m => m.type === type);
      if (!mapping) return '';
      return row.cells[mapping.index] ?? '';
    };

    const nameVal = get('name');
    if (!nameVal) return; // 名前のない行はスキップ

    // ギミックグループ検出
    const mechanicVal = get('mechanic');
    if (mechanicVal) {
      currentMechanicGroup = mechanicVal;
    }

    // フェーズ検出
    const phaseVal = get('phase');
    if (phaseVal && phaseVal !== currentPhaseName) {
      currentPhaseName = phaseVal;
      phaseCounter++;
      const timeVal = get('time');
      const startTimeSec = parseTimeString(timeVal) ?? 0;
      phases.push({
        id: phaseCounter,
        startTimeSec,
        name: phaseVal,
      });
    }

    const timeVal = get('time');
    const time = parseTimeString(timeVal) ?? 0;

    const damageVal = get('damage');
    const damageAmount = damageVal ? parseInt(damageVal.replace(/,/g, ''), 10) || undefined : undefined;

    const typeVal = get('type');
    const damageType = typeVal ? parseDamageType(typeVal) : 'magical';

    const targetVal = get('target');
    const target = targetVal ? parseTarget(targetVal) : 'AoE';

    const event: TimelineEvent = {
      id: `tpl_${rowIndex}_${randomChars(6)}`,
      time,
      name: { ja: nameVal, en: '' },
      damageType,
      target,
    };

    if (currentMechanicGroup) {
      event.mechanicGroup = currentMechanicGroup;
    }

    if (damageAmount !== undefined && !isNaN(damageAmount)) {
      event.damageAmount = damageAmount;
    }

    events.push(event);
  });

  // フェーズが1件も検出されなかった場合はデフォルトを追加
  if (phases.length === 0) {
    phases.push({ id: 1, startTimeSec: 0 });
  }

  return { events, phases };
}
```

- [ ] **Step 4: CsvImportModal の COLUMN_TYPES に `'mechanic'` を追加**

`src/components/admin/CsvImportModal.tsx:34`:

```typescript
const COLUMN_TYPES: ColumnType[] = ['time', 'name', 'damage', 'type', 'target', 'phase', 'mechanic', 'skip'];
```

- [ ] **Step 5: i18n キーを追加**

`src/locales/ja.json` に追加:
```json
"tpl_csv_column_mechanic": "ギミック"
```

`src/locales/en.json` に追加:
```json
"tpl_csv_column_mechanic": "Mechanic"
```

- [ ] **Step 6: ビルド確認**

```bash
npm run build
```

エラーなし を確認。

- [ ] **Step 7: コミット**

```bash
git add src/utils/templateConversions.ts src/components/admin/CsvImportModal.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: CSVインポートでギミックグループ列を認識"
```

---

### Task 3: エディターにギミックグループセパレーター行を表示

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`

- [ ] **Step 1: RowItem 型にギミックグループセパレーターを追加**

`src/components/admin/TemplateEditor.tsx` の `RowItem` 型を更新:

```typescript
type RowItem =
  | { type: 'phase-separator'; phaseId: number; phaseName: string }
  | { type: 'mechanic-separator'; mechanicGroup: string; phaseId: number }
  | { type: 'event'; event: TimelineEvent; phaseId: number };
```

- [ ] **Step 2: 行リスト構築ロジックにギミックグループセパレーターを追加**

`TemplateEditor` コンポーネント内の行リスト構築を更新。フェーズセパレーターの後にギミックグループセパレーターを挿入する:

```typescript
  const rows: RowItem[] = [];
  let lastPhaseId: number | null = null;
  let lastMechanicGroup: string | null = null;

  for (const event of filteredEvents) {
    const phase = getPhaseForTime(event.time, phases);

    if (phase.id !== lastPhaseId) {
      rows.push({
        type: 'phase-separator',
        phaseId: phase.id,
        phaseName: phase.name,
      });
      lastPhaseId = phase.id;
      lastMechanicGroup = null; // フェーズが変わったらギミックグループもリセット
    }

    if (event.mechanicGroup && event.mechanicGroup !== lastMechanicGroup) {
      lastMechanicGroup = event.mechanicGroup;
      rows.push({
        type: 'mechanic-separator',
        mechanicGroup: event.mechanicGroup,
        phaseId: phase.id,
      });
    }

    rows.push({ type: 'event', event, phaseId: phase.id });
  }
```

- [ ] **Step 3: ギミックグループセパレーター行のレンダリング**

`rows.map` の中に `mechanic-separator` のレンダリングを追加。フェーズセパレーターより控えめなスタイルで:

```tsx
if (row.type === 'mechanic-separator') {
  return (
    <tr key={`mechanic-${row.mechanicGroup}-${index}`} className="bg-app-text/[0.04]">
      <td colSpan={8} className="py-0.5 px-2 text-[10px] text-app-text-muted font-medium">
        {row.mechanicGroup}
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: ビルド確認**

```bash
npm run build
```

- [ ] **Step 5: コミット**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "feat: エディターにギミックグループセパレーター行を表示"
```

---

### Task 4: フェーズ範囲編集UI

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`
- Modify: `src/hooks/useTemplateEditor.ts`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: `useTemplateEditor` にフェーズ更新関数を追加**

`src/hooks/useTemplateEditor.ts` に `updatePhaseForGroup` 関数を追加。ギミックグループの開始時刻をフェーズの `startTimeSec` として設定する:

```typescript
  // ギミックグループのフェーズを変更
  const updatePhaseForGroup = useCallback(
    (mechanicGroup: string, phaseId: number, phaseName: string) => {
      setState((prev) => {
        // このギミックグループの最初のイベントの時刻を取得
        const firstEvent = prev.current.find(
          (ev) => ev.mechanicGroup === mechanicGroup && !prev.deleted.has(ev.id),
        );
        if (!firstEvent) return prev;

        const startTimeSec = firstEvent.time;
        const newPhases = structuredClone(prev.currentPhases);

        // 既存フェーズを探す
        const existing = newPhases.find((p) => p.id === phaseId);
        if (existing) {
          existing.startTimeSec = startTimeSec;
          if (phaseName) existing.name = phaseName;
        } else {
          // 新しいフェーズを追加
          newPhases.push({ id: phaseId, startTimeSec, name: phaseName });
          newPhases.sort((a, b) => a.startTimeSec - b.startTimeSec);
        }

        return { ...prev, currentPhases: newPhases, modified: new Set([...prev.modified, '__phases__']) };
      });
    },
    [],
  );
```

`return` 文に `updatePhaseForGroup` を追加:

```typescript
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
    updatePhaseForGroup,
  };
```

- [ ] **Step 2: `TemplateEditorProps` にフェーズ更新コールバックを追加**

`src/components/admin/TemplateEditor.tsx` の props を更新:

```typescript
interface TemplateEditorProps {
  events: TimelineEvent[];
  phases: TemplateData['phases'];
  editState: EditState;
  showUntranslatedOnly: boolean;
  onUpdateCell: (eventId: string, field: string, value: any) => void;
  onDeleteEvent: (eventId: string) => void;
  onUpdatePhaseForGroup: (mechanicGroup: string, phaseId: number, phaseName: string) => void;
}
```

- [ ] **Step 3: ギミックグループセパレーター行にフェーズ選択ドロップダウンを追加**

`mechanic-separator` のレンダリングを更新。フェーズ選択 `<select>` を配置する:

```tsx
if (row.type === 'mechanic-separator') {
  const nextPhaseId = Math.max(...phases.map((p) => p.id), 0) + 1;

  return (
    <tr key={`mechanic-${row.mechanicGroup}-${index}`} className="bg-app-text/[0.04]">
      <td className="py-0.5 px-2" colSpan={2}>
        <select
          value={row.phaseId}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '__new__') {
              const name = `P${nextPhaseId}`;
              onUpdatePhaseForGroup(row.mechanicGroup, nextPhaseId, name);
            } else {
              const pid = parseInt(val, 10);
              const existing = phases.find((p) => p.id === pid);
              onUpdatePhaseForGroup(row.mechanicGroup, pid, existing?.name ?? `P${pid}`);
            }
          }}
          className="px-1 py-0.5 text-[10px] bg-transparent border border-app-text/20 rounded text-app-text cursor-pointer [&>option]:bg-app-bg [&>option]:text-app-text"
        >
          {phases.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? `P${p.id}`}
            </option>
          ))}
          <option value="__new__">{t('admin.tpl_editor_new_phase')}</option>
        </select>
      </td>
      <td colSpan={6} className="py-0.5 px-2 text-[10px] text-app-text-muted font-medium">
        {row.mechanicGroup}
      </td>
    </tr>
  );
}
```

- [ ] **Step 4: TemplateEditor の関数シグネチャで `onUpdatePhaseForGroup` を受け取る**

```typescript
export function TemplateEditor({
  events,
  phases,
  editState,
  showUntranslatedOnly,
  onUpdateCell,
  onDeleteEvent,
  onUpdatePhaseForGroup,
}: TemplateEditorProps) {
```

- [ ] **Step 5: AdminTemplates.tsx から `onUpdatePhaseForGroup` を渡す**

`src/components/admin/AdminTemplates.tsx` の `<TemplateEditor>` の呼び出し箇所に追加:

```tsx
<TemplateEditor
  events={editor.visibleEvents}
  phases={editor.state.currentPhases}
  editState={editor.state}
  showUntranslatedOnly={showUntranslatedOnly}
  onUpdateCell={editor.updateCell}
  onDeleteEvent={editor.deleteEvent}
  onUpdatePhaseForGroup={editor.updatePhaseForGroup}
/>
```

- [ ] **Step 6: i18n キーを追加**

`src/locales/ja.json`:
```json
"tpl_editor_new_phase": "+ 新規フェーズ"
```

`src/locales/en.json`:
```json
"tpl_editor_new_phase": "+ New Phase"
```

- [ ] **Step 7: ビルド確認**

```bash
npm run build
```

- [ ] **Step 8: コミット**

```bash
git add src/hooks/useTemplateEditor.ts src/components/admin/TemplateEditor.tsx src/components/admin/AdminTemplates.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: ギミックグループ単位のフェーズ範囲編集UI"
```

---

### Task 5: 翻訳名の自動伝播

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts`
- Modify: `src/components/admin/TemplateEditorToolbar.tsx`
- Modify: `src/components/admin/AdminTemplates.tsx`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: `useTemplateEditor` に自動伝播トグル状態を追加**

`src/hooks/useTemplateEditor.ts` にトグル状態を追加:

```typescript
export function useTemplateEditor() {
  const [state, setState] = useState<EditState>(emptyState);
  const [autoPropagate, setAutoPropagate] = useState(true);
```

- [ ] **Step 2: `updateCell` に翻訳伝播ロジックを追加**

`updateCell` を更新。`name.ja` または `name.en` が変更されたとき、同じペアを持つ他の行に伝播する:

```typescript
  const updateCell = useCallback(
    (eventId: string, field: string, value: unknown) => {
      setState((prev) => {
        const newCurrent = structuredClone(prev.current);
        const ev = newCurrent.find((e) => e.id === eventId);
        if (!ev) return prev;

        // 伝播用: 変更前の値を保存
        const oldJa = ev.name.ja;
        const oldEn = ev.name.en;

        switch (field) {
          case 'time':
            ev.time = value as number;
            break;
          case 'name.ja':
            ev.name.ja = value as string;
            break;
          case 'name.en':
            ev.name.en = value as string;
            break;
          case 'damageAmount':
            ev.damageAmount = value as number | undefined;
            break;
          case 'damageType':
            ev.damageType = value as TimelineEvent['damageType'];
            break;
          case 'target':
            ev.target = value as TimelineEvent['target'];
            break;
          default:
            return prev;
        }

        const key = `${eventId}:${field}`;
        const newModified = new Set(prev.modified);
        newModified.add(key);

        const newAutoFilled = new Set(prev.autoFilled);
        newAutoFilled.delete(key);

        // 翻訳自動伝播
        if (autoPropagate && (field === 'name.en' || field === 'name.ja')) {
          for (const other of newCurrent) {
            if (other.id === eventId || prev.deleted.has(other.id)) continue;

            if (field === 'name.en') {
              // EN変更 → 同じJA名を持つ他の行に伝播
              if (other.name.ja === oldJa && (other.name.en === '' || other.name.en === oldEn)) {
                other.name.en = value as string;
                newAutoFilled.add(`${other.id}:name.en`);
              }
            } else if (field === 'name.ja') {
              // JA変更 → 同じEN名を持つ他の行に伝播
              if (other.name.en === oldEn && oldEn !== '' && (other.name.ja === '' || other.name.ja === oldJa)) {
                other.name.ja = value as string;
                newAutoFilled.add(`${other.id}:name.ja`);
              }
            }
          }
        }

        return {
          ...prev,
          current: newCurrent,
          modified: newModified,
          autoFilled: newAutoFilled,
        };
      });
    },
    [autoPropagate],
  );
```

注意: `useCallback` の依存配列に `autoPropagate` を追加すること。

- [ ] **Step 3: return に `autoPropagate` と `setAutoPropagate` を追加**

```typescript
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
    updatePhaseForGroup,
    autoPropagate,
    setAutoPropagate,
  };
```

- [ ] **Step 4: ツールバーに翻訳自動伝播トグルを追加**

`src/components/admin/TemplateEditorToolbar.tsx` の props に追加:

```typescript
interface TemplateEditorToolbarProps {
  untranslatedCount: number;
  showUntranslatedOnly: boolean;
  onToggleUntranslatedOnly: () => void;
  onOpenPromote: () => void;
  onOpenCsvImport: () => void;
  onOpenFflogsTranslation: () => void;
  hasEvents: boolean;
  autoPropagate: boolean;
  onToggleAutoPropagate: () => void;
}
```

ツールバー JSX 内の「未翻訳だけ表示」ボタンの前にトグルを追加:

```tsx
      <button
        type="button"
        onClick={onToggleAutoPropagate}
        className={`${baseButtonClass} ${
          autoPropagate
            ? 'border-blue-500/60 bg-blue-500/15 text-blue-400'
            : 'border-app-text/20 text-app-text-muted hover:bg-app-text/10'
        }`}
      >
        {t('admin.tpl_editor_auto_propagate')}
      </button>
```

関数シグネチャに `autoPropagate` と `onToggleAutoPropagate` を受け取るよう更新。

- [ ] **Step 5: AdminTemplates.tsx からトグル状態を渡す**

`<TemplateEditorToolbar>` の呼び出し箇所に追加:

```tsx
<TemplateEditorToolbar
  ...
  autoPropagate={editor.autoPropagate}
  onToggleAutoPropagate={() => editor.setAutoPropagate((v) => !v)}
/>
```

- [ ] **Step 6: i18n キーを追加**

`src/locales/ja.json`:
```json
"tpl_editor_auto_propagate": "翻訳自動伝播"
```

`src/locales/en.json`:
```json
"tpl_editor_auto_propagate": "Auto-propagate"
```

- [ ] **Step 7: ビルド確認**

```bash
npm run build
```

- [ ] **Step 8: コミット**

```bash
git add src/hooks/useTemplateEditor.ts src/components/admin/TemplateEditorToolbar.tsx src/components/admin/AdminTemplates.tsx src/locales/ja.json src/locales/en.json
git commit -m "feat: 翻訳名の双方向自動伝播（JA↔EN）＋トグル"
```

---

### Task 6: ダメージ値パース修正の確認

**Files:**
- Modify: `src/utils/templateConversions.ts` （Task 2 で既に修正済み）

- [ ] **Step 1: 修正が適用されていることを確認**

Task 2 の `convertCsvToEvents` で既に以下のコードになっていることを確認:

```typescript
const damageAmount = damageVal ? parseInt(damageVal.replace(/,/g, ''), 10) || undefined : undefined;
```

元のコード（`bf4fbac` 時点）を確認すると、既にカンマ除去の `replace(/,/g, '')` が含まれている。問題はCSVインポート時のカラムマッピングがダメージ列を正しく認識できていない可能性がある。

- [ ] **Step 2: `guessColumnType` のダメージ列推測を改善**

スプシのヘッダーが数値のみ（例: `50,000`）の場合、ヘッダー行も数値パターンとして検出されないため `skip` になる可能性がある。ヘッダーなしのスプシに対応するため、`CsvImportModal` の自動推測ロジックでデータ行の内容も参考にする改善は、スコープが大きいため今回は見送り。ユーザーがドロップダウンで手動設定すれば動作する。

この Task はコード変更なし。Task 2 のカンマ除去で十分。

---

### Task 7: convertPlanToTemplate で mechanicGroup を保持

**Files:**
- Modify: `src/utils/templateConversions.ts:273-284`

- [ ] **Step 1: `convertPlanToTemplate` の timelineEvents コピーで `mechanicGroup` を保持**

`src/utils/templateConversions.ts` の `convertPlanToTemplate` 関数内、イベントコピー部分を更新:

```typescript
  const templateEvents: TimelineEvent[] = planData.timelineEvents.map(event => {
    const e: TimelineEvent = {
      id: event.id,
      time: event.time,
      name: { ja: event.name.ja, en: event.name.en },
      damageType: event.damageType,
    };
    if (event.damageAmount !== undefined) e.damageAmount = event.damageAmount;
    if (event.target !== undefined) e.target = event.target;
    if (event.warning !== undefined) e.warning = event.warning;
    if (event.mechanicGroup !== undefined) e.mechanicGroup = event.mechanicGroup;
    return e;
  });
```

- [ ] **Step 2: ビルド確認**

```bash
npm run build
```

- [ ] **Step 3: コミット**

```bash
git add src/utils/templateConversions.ts
git commit -m "fix: convertPlanToTemplate で mechanicGroup を保持"
```

---

### Task 8: 全体ビルド・動作確認

- [ ] **Step 1: ビルド確認**

```bash
npm run build
```

エラーゼロ を確認。

- [ ] **Step 2: 型チェック**

```bash
npx tsc --noEmit
```

エラーゼロ を確認。

- [ ] **Step 3: dev サーバーで動作確認**

```bash
npm run dev
```

管理画面でテンプレートエディターを開き、以下を手動確認:
1. TSVをインポートしてギミック列を `ギミック` にマッピング → ギミックグループセパレーターが表示される
2. ギミックグループセパレーター行でフェーズを変更 → フェーズセパレーターが更新される
3. EN名を入力 → 同じJA名の他の行に自動伝播される
4. 翻訳自動伝播トグルをOFF → 伝播しなくなる
5. ダメージ値 `50,000` がインポートされる → 数値 `50000` として表示される
