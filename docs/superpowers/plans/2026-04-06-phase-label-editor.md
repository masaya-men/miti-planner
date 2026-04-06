# フェーズ・ラベル編集UI + フェーズ名多言語化 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** テンプレートエディタにフェーズ名・ラベル名のインライン編集UIを追加し、フェーズ名のハードコーディングを解消して4言語対応する

**Architecture:** contents.json → スクリプト → TemplateData型 → hook → エディタUIの順に上流から下流へ安全に変更。フェーズ名を `string | LocalizedString` ユニオン型で後方互換を維持し、既存の `getPhaseName()` / `normalizeLocalizedString()` がそのまま機能する

**Tech Stack:** React, TypeScript, i18next, Tailwind CSS, Node.js (scripts)

---

## ファイル構成

| ファイル | 役割 | 操作 |
|---------|------|------|
| `src/data/contents.json` | コンテンツ定義（phaseNames） | 修正 |
| `src/data/templateLoader.ts` | TemplateData型定義 | 修正 |
| `scripts/generate-templates.mjs` | FFLogsからテンプレート生成 | 修正 |
| `scripts/import-spreadsheet.mjs` | スプシからテンプレート生成 | 修正 |
| `src/utils/templateConversions.ts` | CSV→Template, Plan→Template変換 | 修正 |
| `src/store/usePlanStore.ts` | Template→Plan変換 | 修正 |
| `src/lib/translationDataLoaders.ts` | 翻訳管理の型キャスト修正 | 修正 |
| `src/hooks/useTemplateEditor.ts` | フェーズ・ラベル編集hook | 修正 |
| `src/components/admin/TemplateEditor.tsx` | エディタUI（インライン編集追加） | 修正 |
| `src/components/admin/AdminTemplates.tsx` | 親コンポーネント（props追加） | 修正 |
| `src/locales/ja.json` | 日本語翻訳キー追加 | 修正 |
| `src/locales/en.json` | 英語翻訳キー追加 | 修正 |
| `src/locales/zh.json` | 中国語翻訳キー追加 | 修正 |
| `src/locales/ko.json` | 韓国語翻訳キー追加 | 修正 |

---

### Task 1: TemplateData型のフェーズ名を LocalizedString 対応にする

**Files:**
- Modify: `src/data/templateLoader.ts:17`

- [ ] **Step 1: 型定義を変更**

`src/data/templateLoader.ts` の17行目を変更:

```typescript
// Before
phases: { id: number; startTimeSec: number; name?: string; }[];

// After
phases: { id: number; startTimeSec: number; name?: string | LocalizedString; }[];
```

ファイル先頭に `LocalizedString` のインポートを追加:

```typescript
import type { TimelineEvent, LocalizedString } from '../types';
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし（ユニオン型なので既存のstring代入も受け付ける）

- [ ] **Step 3: コミット**

```bash
git add src/data/templateLoader.ts
git commit -m "feat: TemplateData.phases.name を string | LocalizedString に拡張"
```

---

### Task 2: contents.json の phaseNames を LocalizedString 化

**Files:**
- Modify: `src/data/contents.json:65,75,85,97,191,249,261,402,496,554`

- [ ] **Step 1: phaseNames を全て LocalizedString 形式に変更**

10箇所を以下のパターンで変更（日本語は空欄、元の値をenに移動）:

```json
// m6s (65行目)
"phaseNames": { "1": { "ja": "", "en": "Phase One" }, "2": { "ja": "", "en": "Phase Two" }, "3": { "ja": "", "en": "Phase Three" } }

// m7s (75行目)
"phaseNames": { "1": { "ja": "", "en": "Phase One" }, "2": { "ja": "", "en": "Phase Two" }, "3": { "ja": "", "en": "Phase Three" } }

// m8s (85行目)
"phaseNames": { "1": { "ja": "", "en": "Phase One" }, "2": { "ja": "", "en": "Phase Two" } }

// fru (97行目)
"phaseNames": { "1": { "ja": "", "en": "Fatebreaker" }, "2": { "ja": "", "en": "Usurper of Frost" }, "3": { "ja": "", "en": "Oracle of Darkness" }, "4": { "ja": "", "en": "Enter the Dragon" }, "5": { "ja": "", "en": "Pandora" } }

// top (191行目)
"phaseNames": { "1": { "ja": "", "en": "Omega" }, "2": { "ja": "", "en": "Omega-M/F" }, "3": { "ja": "", "en": "Omega Reconfigured" }, "4": { "ja": "", "en": "Blue Screen" }, "5": { "ja": "", "en": "Run: Dynamis" }, "6": { "ja": "", "en": "Alpha Omega" } }

// dsr_p1 (249行目)
"phaseNames": { "1": { "ja": "", "en": "Adelphel, Grinnaux and Charibert" } }

// dsr (261行目)
"phaseNames": { "1": { "ja": "", "en": "King Thordan" }, "2": { "ja": "", "en": "Nidhogg" }, "3": { "ja": "", "en": "The Eyes" }, "4": { "ja": "", "en": "Rewind!" }, "5": { "ja": "", "en": "King Thordan II" }, "6": { "ja": "", "en": "Nidhogg and Hraesvelgr" }, "7": { "ja": "", "en": "The Dragon King" } }

// tea (402行目)
"phaseNames": { "1": { "ja": "", "en": "Living Liquid" }, "2": { "ja": "", "en": "Limit Cut" }, "3": { "ja": "", "en": "Brute Justice and Cruise Chaser" }, "4": { "ja": "", "en": "Temporal Stasis" }, "5": { "ja": "", "en": "Alexander Prime" }, "6": { "ja": "", "en": "Perfect Alexander" } }

// uwu (496行目)
"phaseNames": { "1": { "ja": "", "en": "Garuda" }, "2": { "ja": "", "en": "Ifrit" }, "3": { "ja": "", "en": "Titan" }, "4": { "ja": "", "en": "Magitek Bits" }, "5": { "ja": "", "en": "The Ultima Weapon" } }

// ucob (554行目)
"phaseNames": { "1": { "ja": "", "en": "Twintania" }, "2": { "ja": "", "en": "Nael deus Darnus" }, "3": { "ja": "", "en": "Bahamut Prime" }, "4": { "ja": "", "en": "Triple Threat" }, "5": { "ja": "", "en": "Reborn!" } }
```

- [ ] **Step 2: コミット**

```bash
git add src/data/contents.json
git commit -m "feat: contents.json phaseNames を LocalizedString 形式に変更"
```

---

### Task 3: テンプレート生成スクリプトを LocalizedString 対応にする

**Files:**
- Modify: `scripts/generate-templates.mjs:938-946`
- Modify: `scripts/import-spreadsheet.mjs:594-601,664-677`

- [ ] **Step 1: generate-templates.mjs の extractPhases を修正**

`scripts/generate-templates.mjs` の `extractPhases` 関数（938行目付近）を修正。
phaseNames の値が `string` でも `{ ja, en }` でもどちらでも受け付けるようにする:

```javascript
function extractPhases(fight, phaseNames = {}) {
    if (!fight.phaseTransitions || fight.phaseTransitions.length === 0) return [];

    const ref = fight.startTime;
    const raw = fight.phaseTransitions.map(pt => {
        const phaseName = phaseNames[String(pt.id)];
        let name;
        if (phaseName) {
            // LocalizedString形式 { ja, en } またはstring形式の両方に対応
            name = typeof phaseName === 'string'
                ? { ja: '', en: phaseName }
                : phaseName;
        }
        return {
            id: pt.id,
            startTimeSec: Math.floor((pt.startTime - ref) / 1000),
            ...(name ? { name } : {}),
        };
    });
    // ... 以降の同時刻フェーズ修正ロジックはそのまま
```

945行目の1行だけを上記のロジックに置き換える。残りの関数はそのまま。

- [ ] **Step 2: import-spreadsheet.mjs の単一コンテンツ処理を修正**

`scripts/import-spreadsheet.mjs` の594-601行目を修正:

```javascript
const phaseNames = content?.phaseNames || {};

// フェーズ名をcontents.jsonの定義で上書き
for (const p of phases) {
    const phaseName = phaseNames[String(p.id)];
    if (phaseName) {
        // LocalizedString形式 { ja, en } またはstring形式の両方に対応
        p.name = typeof phaseName === 'string'
            ? { ja: '', en: phaseName }
            : phaseName;
    }
}
```

- [ ] **Step 3: import-spreadsheet.mjs の複数コンテンツ処理を修正**

`scripts/import-spreadsheet.mjs` の664-677行目を修正:

```javascript
const phaseNames = content.phaseNames || {};
let counter = 0;
const template = {
    contentId: cid,
    generatedAt: new Date().toISOString(),
    source: 'spreadsheet',
    sourceSheetId: config.sheetId,
    timelineEvents: events.map(ev => ({
        id: `tpl_${counter++}_${Math.random().toString(36).slice(2, 8)}`,
        ...ev,
    })),
    phases: phaseNames['1']
        ? Object.entries(phaseNames).map(([id, name]) => ({
            id: parseInt(id),
            startTimeSec: 0,
            name: typeof name === 'string' ? { ja: '', en: name } : name,
        }))
        : [],
};
```

- [ ] **Step 4: コミット**

```bash
git add scripts/generate-templates.mjs scripts/import-spreadsheet.mjs
git commit -m "feat: テンプレート生成スクリプトを LocalizedString 対応"
```

---

### Task 4: データ変換ユーティリティの LocalizedString 対応

**Files:**
- Modify: `src/utils/templateConversions.ts:204-208,276-281`
- Modify: `src/store/usePlanStore.ts:139`
- Modify: `src/lib/translationDataLoaders.ts:475`

- [ ] **Step 1: CSV→Template変換のフェーズ名を LocalizedString 化**

`src/utils/templateConversions.ts` の204-208行目を修正:

```typescript
phases.push({
    id: phaseCounter,
    startTimeSec,
    name: { ja: '', en: phaseVal },
});
```

- [ ] **Step 2: Plan→Template変換のフェーズ名を LocalizedString 保持に修正**

`src/utils/templateConversions.ts` の267-284行目を修正。
`phase.name` が既に LocalizedString の場合はそのまま使い、string の場合は変換する:

```typescript
const templatePhases: TemplateData['phases'] = planData.phases.map((phase, index) => {
    const idMatch = phase.id.match(/\d+/);
    const numericId = idMatch ? parseInt(idMatch[0], 10) : index + 1;
    const startTimeSec = index === 0 ? 0 : planData.phases[index - 1].endTime;

    // フェーズ名: LocalizedStringならそのまま、stringなら最後の改行以降を使う
    let name: string | LocalizedString | undefined;
    if (typeof phase.name === 'object') {
        // LocalizedString: 各言語の "Phase N\n..." 部分を除去
        const strip = (s: string) => {
            const idx = s.lastIndexOf('\n');
            return idx >= 0 ? s.substring(idx + 1) : s;
        };
        name = {
            ja: strip(phase.name.ja),
            en: strip(phase.name.en),
            ...(phase.name.zh ? { zh: strip(phase.name.zh) } : {}),
            ...(phase.name.ko ? { ko: strip(phase.name.ko) } : {}),
        };
    } else {
        const rawName = phase.name ?? '';
        const lastNewline = rawName.lastIndexOf('\n');
        const stripped = lastNewline >= 0 ? rawName.substring(lastNewline + 1) : rawName;
        if (stripped) name = stripped;
    }

    const result: TemplateData['phases'][number] = { id: numericId, startTimeSec };
    if (name) result.name = name;
    return result;
});
```

- [ ] **Step 3: Template→Plan変換のフェーズ名を LocalizedString 保持に修正**

`src/store/usePlanStore.ts` の139行目を修正:

```typescript
// Before
name: p.name ? `Phase ${i + 1}\n${p.name}` : `Phase ${i + 1}`,

// After
name: p.name
    ? (typeof p.name === 'string'
        ? `Phase ${i + 1}\n${p.name}`
        : {
            ja: p.name.ja ? `Phase ${i + 1}\n${p.name.ja}` : `Phase ${i + 1}`,
            en: p.name.en ? `Phase ${i + 1}\n${p.name.en}` : `Phase ${i + 1}`,
            ...(p.name.zh ? { zh: `Phase ${i + 1}\n${p.name.zh}` } : {}),
            ...(p.name.ko ? { ko: `Phase ${i + 1}\n${p.name.ko}` } : {}),
        })
    : `Phase ${i + 1}`,
```

`usePlanStore.ts` ファイル先頭で `LocalizedString` をインポートしているか確認し、なければ追加:

```typescript
import type { ..., LocalizedString } from '../types';
```

- [ ] **Step 4: translationDataLoaders.ts の型キャスト修正**

`src/lib/translationDataLoaders.ts` の475行目を修正:

```typescript
// Before
name: newName as unknown as string, // TemplateData.phases.name は string 型だが実際はLocalizedString

// After
name: newName,
```

型が `string | LocalizedString` になったのでキャストが不要になる。

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 6: コミット**

```bash
git add src/utils/templateConversions.ts src/store/usePlanStore.ts src/lib/translationDataLoaders.ts
git commit -m "feat: データ変換ユーティリティのフェーズ名 LocalizedString 対応"
```

---

### Task 5: useTemplateEditor hook のラベル編集を4言語対応にする

**Files:**
- Modify: `src/hooks/useTemplateEditor.ts:216-265`

- [ ] **Step 1: updatePhaseForGroup を LocalizedString 対応に修正**

`src/hooks/useTemplateEditor.ts` の `updatePhaseForGroup` 関数（217行目）を修正。
引数を `phaseName: string` から `phaseName: LocalizedString` に変更:

```typescript
// ギミックグループのフェーズを変更
const updatePhaseForGroup = useCallback(
    (mechanicGroupJa: string, phaseId: number, phaseName: LocalizedString) => {
      setState((prev) => {
        const firstEvent = prev.current.find(
          (ev) => ev.mechanicGroup?.ja === mechanicGroupJa && !prev.deleted.has(ev.id),
        );
        if (!firstEvent) return prev;

        const startTimeSec = firstEvent.time;
        const newPhases = structuredClone(prev.currentPhases);

        const existing = newPhases.find((p) => p.id === phaseId);
        if (existing) {
          existing.startTimeSec = startTimeSec;
          existing.name = phaseName;
        } else {
          newPhases.push({ id: phaseId, startTimeSec, name: phaseName });
          newPhases.sort((a, b) => a.startTimeSec - b.startTimeSec);
        }

        return { ...prev, currentPhases: newPhases, modified: new Set([...prev.modified, '__phases__']) };
      });
    },
    [],
);
```

ファイル先頭で `LocalizedString` をインポート:

```typescript
import type { TimelineEvent, LocalizedString } from '../types';
```

- [ ] **Step 2: updateLabelEn を updateLabel に改名・4言語対応に拡張**

`src/hooks/useTemplateEditor.ts` の `updateLabelEn` 関数（247行目）を以下に置き換え:

```typescript
// ラベル名を更新（4言語対応）
const updateLabel = useCallback(
    (mechanicGroupJa: string, newLabel: LocalizedString) => {
      setState((prev) => {
        const updated = prev.current.map((ev) => {
          if (ev.mechanicGroup?.ja === mechanicGroupJa && !prev.deleted.has(ev.id)) {
            return { ...ev, mechanicGroup: { ...newLabel } };
          }
          return ev;
        });
        const modifiedIds = new Set(prev.modified);
        updated.forEach((ev, i) => {
          if (ev !== prev.current[i]) modifiedIds.add(ev.id);
        });
        return { ...prev, current: updated, modified: modifiedIds };
      });
    },
    [],
);
```

- [ ] **Step 3: フェーズ名を直接更新する関数を追加**

既存のフェーズのname（LocalizedString）だけを更新する新関数を追加:

```typescript
// フェーズ名を直接更新（エディタのインライン編集用）
const updatePhaseName = useCallback(
    (phaseId: number, phaseName: LocalizedString) => {
      setState((prev) => {
        const newPhases = structuredClone(prev.currentPhases);
        const existing = newPhases.find((p) => p.id === phaseId);
        if (!existing) return prev;
        existing.name = phaseName;
        return { ...prev, currentPhases: newPhases, modified: new Set([...prev.modified, '__phases__']) };
      });
    },
    [],
);
```

- [ ] **Step 4: return文を更新**

`return` 文の `updateLabelEn` を `updateLabel` に変更し、`updatePhaseName` を追加:

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
    updatePhaseName,
    updateLabel,
    bulkUpdate,
    autoPropagate,
    setAutoPropagate,
};
```

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`
Expected: `updateLabelEn` 参照箇所でエラーが出る（次のTaskで修正）

- [ ] **Step 6: コミット**

```bash
git add src/hooks/useTemplateEditor.ts
git commit -m "feat: useTemplateEditor の updateLabel 4言語対応 + updatePhaseName 追加"
```

---

### Task 6: i18n キーを4言語ロケールに追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: 4言語ファイルに翻訳キーを追加**

各ロケールファイルの admin セクション（`tpl_bulk_edit_btn` の近く）に以下を追加:

**ja.json:**
```json
"tpl_phase_edit_title": "フェーズ名編集",
"tpl_phase_name_ja": "フェーズ名(JA)",
"tpl_phase_name_en": "フェーズ名(EN)",
"tpl_phase_name_zh": "フェーズ名(ZH)",
"tpl_phase_name_ko": "フェーズ名(KO)",
"tpl_phase_edit_apply": "適用",
"tpl_phase_edit_cancel": "キャンセル",
"tpl_label_edit_title": "ラベル編集",
"tpl_label_name_ja": "ラベル(JA)",
"tpl_label_name_en": "ラベル(EN)",
"tpl_label_name_zh": "ラベル(ZH)",
"tpl_label_name_ko": "ラベル(KO)",
"tpl_label_edit_apply": "適用",
"tpl_label_edit_cancel": "キャンセル"
```

**en.json:**
```json
"tpl_phase_edit_title": "Edit Phase Name",
"tpl_phase_name_ja": "Phase (JA)",
"tpl_phase_name_en": "Phase (EN)",
"tpl_phase_name_zh": "Phase (ZH)",
"tpl_phase_name_ko": "Phase (KO)",
"tpl_phase_edit_apply": "Apply",
"tpl_phase_edit_cancel": "Cancel",
"tpl_label_edit_title": "Edit Label",
"tpl_label_name_ja": "Label (JA)",
"tpl_label_name_en": "Label (EN)",
"tpl_label_name_zh": "Label (ZH)",
"tpl_label_name_ko": "Label (KO)",
"tpl_label_edit_apply": "Apply",
"tpl_label_edit_cancel": "Cancel"
```

**zh.json:**
```json
"tpl_phase_edit_title": "Edit Phase Name",
"tpl_phase_name_ja": "Phase (JA)",
"tpl_phase_name_en": "Phase (EN)",
"tpl_phase_name_zh": "Phase (ZH)",
"tpl_phase_name_ko": "Phase (KO)",
"tpl_phase_edit_apply": "Apply",
"tpl_phase_edit_cancel": "Cancel",
"tpl_label_edit_title": "Edit Label",
"tpl_label_name_ja": "Label (JA)",
"tpl_label_name_en": "Label (EN)",
"tpl_label_name_zh": "Label (ZH)",
"tpl_label_name_ko": "Label (KO)",
"tpl_label_edit_apply": "Apply",
"tpl_label_edit_cancel": "Cancel"
```

**ko.json:**
```json
"tpl_phase_edit_title": "Edit Phase Name",
"tpl_phase_name_ja": "Phase (JA)",
"tpl_phase_name_en": "Phase (EN)",
"tpl_phase_name_zh": "Phase (ZH)",
"tpl_phase_name_ko": "Phase (KO)",
"tpl_phase_edit_apply": "Apply",
"tpl_phase_edit_cancel": "Cancel",
"tpl_label_edit_title": "Edit Label",
"tpl_label_name_ja": "Label (JA)",
"tpl_label_name_en": "Label (EN)",
"tpl_label_name_zh": "Label (ZH)",
"tpl_label_name_ko": "Label (KO)",
"tpl_label_edit_apply": "Apply",
"tpl_label_edit_cancel": "Cancel"
```

- [ ] **Step 2: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: フェーズ・ラベル編集UI用のi18nキーを追加"
```

---

### Task 7: TemplateEditor にフェーズ・ラベルのインライン編集UIを追加

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx`

- [ ] **Step 1: propsインターフェースを更新**

`src/components/admin/TemplateEditor.tsx` の `TemplateEditorProps`（16-28行目）を修正:

```typescript
interface TemplateEditorProps {
  events: TimelineEvent[];
  phases: TemplateData['phases'];
  editState: EditState;
  showUntranslatedOnly: boolean;
  onUpdateCell: (eventId: string, field: string, value: any) => void;
  onDeleteEvent: (eventId: string) => void;
  onUpdateLabel: (mechanicGroupJa: string, newLabel: LocalizedString) => void;
  onUpdatePhaseName: (phaseId: number, phaseName: LocalizedString) => void;
  selectedIds: Set<string>;
  onToggleSelect: (eventId: string) => void;
  onToggleSelectAll: () => void;
}
```

ファイル先頭のインポートに `LocalizedString` を追加:

```typescript
import type { TimelineEvent, LocalizedString } from '../../types';
```

- [ ] **Step 2: getPhaseForTime を LocalizedString 対応に修正**

`src/components/admin/TemplateEditor.tsx` の `getPhaseForTime` 関数（34-45行目）を修正:

```typescript
function getPhaseForTime(
  time: number,
  phases: TemplateData['phases'],
): { id: number; name: string; nameObj?: LocalizedString } {
  let result = phases[0] ?? { id: 1, startTimeSec: 0, name: undefined };
  for (const phase of phases) {
    if (phase.startTimeSec <= time) {
      result = phase;
    }
  }
  const nameObj = result.name
    ? (typeof result.name === 'string' ? { ja: result.name, en: '' } : result.name as LocalizedString)
    : undefined;
  const displayName = nameObj ? (nameObj.en || nameObj.ja || `P${result.id}`) : `P${result.id}`;
  return { id: result.id, name: displayName, nameObj };
}
```

- [ ] **Step 3: LocalizedEditPopover コンポーネントを追加**

`TemplateEditor` コンポーネントの直前（`DropdownCell` の後、`export function TemplateEditor` の前）に追加:

```typescript
// ─────────────────────────────────────────────
// LocalizedEditPopover — 4言語編集ポップオーバー
// ─────────────────────────────────────────────

interface LocalizedEditPopoverProps {
  title: string;
  initial: LocalizedString;
  labels: { ja: string; en: string; zh: string; ko: string };
  onApply: (value: LocalizedString) => void;
  onCancel: () => void;
}

function LocalizedEditPopover({ title, initial, labels, onApply, onCancel }: LocalizedEditPopoverProps) {
  const { t } = useTranslation();
  const [ja, setJa] = useState(initial.ja);
  const [en, setEn] = useState(initial.en);
  const [zh, setZh] = useState(initial.zh ?? '');
  const [ko, setKo] = useState(initial.ko ?? '');
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  function handleApply() {
    onApply({
      ja,
      en,
      ...(zh ? { zh } : {}),
      ...(ko ? { ko } : {}),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
  }

  const inputClass = 'w-full px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const labelClass = 'text-app-base text-app-text-muted';

  return (
    <div
      ref={popoverRef}
      onKeyDown={handleKeyDown}
      className="absolute z-50 bg-app-bg border border-app-text/20 rounded-lg p-3 shadow-lg min-w-[240px]"
      style={{ top: '100%', left: 0, marginTop: '2px' }}
    >
      <h4 className="text-app-lg font-medium mb-2">{title}</h4>
      <div className="space-y-1.5">
        <div>
          <label className={labelClass}>{labels.ja}</label>
          <input type="text" value={ja} onChange={(e) => setJa(e.target.value)} className={inputClass} autoFocus />
        </div>
        <div>
          <label className={labelClass}>{labels.en}</label>
          <input type="text" value={en} onChange={(e) => setEn(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{labels.zh}</label>
          <input type="text" value={zh} onChange={(e) => setZh(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
        <div>
          <label className={labelClass}>{labels.ko}</label>
          <input type="text" value={ko} onChange={(e) => setKo(e.target.value)} className={inputClass} placeholder={en || 'EN fallback'} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button
          type="button"
          onClick={onCancel}
          className="text-app-lg px-3 py-1 rounded border border-app-text/20 text-app-text-muted hover:bg-app-text/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_phase_edit_cancel')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="text-app-lg px-3 py-1 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_phase_edit_apply')}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: TemplateEditor コンポーネントのprops受け取りを更新**

`export function TemplateEditor({ ... })` の props 分割代入（228-239行目）を修正:

```typescript
export function TemplateEditor({
  events,
  phases,
  editState,
  showUntranslatedOnly,
  onUpdateCell,
  onDeleteEvent,
  onUpdateLabel,
  onUpdatePhaseName,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: TemplateEditorProps) {
```

- [ ] **Step 5: ポップオーバーの state を追加**

`TemplateEditor` 関数の先頭（`const { t } = useTranslation();` の後）に追加:

```typescript
// フェーズ・ラベル編集ポップオーバーの状態
const [editingPhase, setEditingPhase] = useState<{ phaseId: number; eventId: string } | null>(null);
const [editingLabel, setEditingLabel] = useState<{ mechanicGroupJa: string; eventId: string } | null>(null);
```

- [ ] **Step 6: フェーズ列のセルを編集可能に変更**

テーブル内のフェーズ列セル（350-353行目付近）を以下に置き換え:

```typescript
{/* フェーズ */}
<td className="py-1 pr-2 text-app-text-muted text-app-base relative">
  <span
    onClick={() => setEditingPhase({ phaseId: phase.id, eventId: evId })}
    className="cursor-pointer hover:text-app-text transition-colors"
  >
    {phase.name}
  </span>
  {editingPhase?.eventId === evId && (
    <LocalizedEditPopover
      title={t('admin.tpl_phase_edit_title')}
      initial={phase.nameObj ?? { ja: '', en: '' }}
      labels={{
        ja: t('admin.tpl_phase_name_ja'),
        en: t('admin.tpl_phase_name_en'),
        zh: t('admin.tpl_phase_name_zh'),
        ko: t('admin.tpl_phase_name_ko'),
      }}
      onApply={(value) => {
        onUpdatePhaseName(editingPhase.phaseId, value);
        setEditingPhase(null);
      }}
      onCancel={() => setEditingPhase(null)}
    />
  )}
</td>
```

- [ ] **Step 7: ラベル列のセルを編集可能に変更**

テーブル内のラベル列セル（355-360行目付近）を以下に置き換え:

```typescript
{/* ラベル（グループ先頭行のみ表示・編集可能） */}
<td className="py-1 pr-2 text-app-base font-medium text-app-text-muted relative">
  {firstInGroup && labelJa ? (
    <>
      <span
        onClick={() => setEditingLabel({ mechanicGroupJa: labelJa, eventId: evId })}
        className="text-app-text cursor-pointer hover:text-blue-400 transition-colors"
      >
        {labelJa}
      </span>
      {editingLabel?.eventId === evId && (
        <LocalizedEditPopover
          title={t('admin.tpl_label_edit_title')}
          initial={event.mechanicGroup ?? { ja: '', en: '' }}
          labels={{
            ja: t('admin.tpl_label_name_ja'),
            en: t('admin.tpl_label_name_en'),
            zh: t('admin.tpl_label_name_zh'),
            ko: t('admin.tpl_label_name_ko'),
          }}
          onApply={(value) => {
            onUpdateLabel(editingLabel.mechanicGroupJa, value);
            setEditingLabel(null);
          }}
          onCancel={() => setEditingLabel(null)}
        />
      )}
    </>
  ) : null}
</td>
```

- [ ] **Step 8: ビルド確認**

Run: `npx tsc --noEmit`
Expected: `AdminTemplates.tsx` で `onUpdateLabelEn` → `onUpdateLabel` のエラーが出る（次のTaskで修正）

- [ ] **Step 9: コミット**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "feat: テンプレートエディタにフェーズ・ラベルのインライン編集UI追加"
```

---

### Task 8: AdminTemplates の props を新しいhookメソッドに接続

**Files:**
- Modify: `src/components/admin/AdminTemplates.tsx:365-377`

- [ ] **Step 1: TemplateEditor への props を更新**

`src/components/admin/AdminTemplates.tsx` の `<TemplateEditor>` 呼び出し（365-377行目）を修正:

```typescript
<TemplateEditor
    events={filteredVisibleEvents}
    phases={editor.state.currentPhases}
    editState={editor.state}
    showUntranslatedOnly={showUntranslatedOnly}
    onUpdateCell={editor.updateCell}
    onDeleteEvent={editor.deleteEvent}
    onUpdateLabel={editor.updateLabel}
    onUpdatePhaseName={editor.updatePhaseName}
    selectedIds={selectedIds}
    onToggleSelect={handleToggleSelect}
    onToggleSelectAll={handleToggleSelectAll}
/>
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 開発サーバーで動作確認**

Run: `npm run dev`

確認項目:
1. 管理画面でテンプレートを開く → フェーズ・ラベル列が表示される
2. フェーズ名をクリック → 4言語編集ポップオーバーが開く
3. ラベル名をクリック → 4言語編集ポップオーバーが開く
4. 値を変更して適用 → テーブルに反映される
5. 保存ボタンが有効になる → 保存できる
6. Escキーでポップオーバーが閉じる
7. ポップオーバー外クリックで閉じる
8. 既存機能（技名編集、種別変更、一括編集、CSV取り込み）が正常に動作する

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/AdminTemplates.tsx
git commit -m "feat: AdminTemplates のpropsを新しいhookメソッドに接続"
```

---

### Task 9: 全体ビルド確認 + 最終コミット

**Files:** なし（確認のみ）

- [ ] **Step 1: TypeScript型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 2: プロダクションビルド**

Run: `npm run build`
Expected: ビルド成功、警告なし

- [ ] **Step 3: docs/TODO.md を更新**

「現在の状態」セクションに以下を追加:
- **確認済み**: フェーズ名 LocalizedString 化（contents.json + TemplateData + スクリプト + 変換ユーティリティ）

「未着手」セクションから以下を移動/更新:
- テンプレートエディタ: フェーズ編集・ラベル編集機能 → 完了済みとして TODO_COMPLETED.md へ

- [ ] **Step 4: 最終コミット**

```bash
git add docs/TODO.md docs/TODO_COMPLETED.md
git commit -m "docs: TODO.md 更新 - フェーズ・ラベル編集UI完了"
```
