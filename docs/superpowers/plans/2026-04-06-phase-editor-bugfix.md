# フェーズ編集バグ修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面のフェーズ編集で (1) LocalizedString名がプランに反映されない (2) フェーズ削除が動かない (3) 表示がEN優先で日本語名が隠れる問題を修正する

**Architecture:** Sidebar.tsx のテンプレート→プラン変換を usePlanStore.ts と同じ LocalizedString 対応ロジックに統一。TemplateEditor.tsx の getPhaseForTime に startTimeSec を追加し、editingPhase 状態を拡張して境界判定・削除対象の正確な特定を実現する。

**Tech Stack:** React, TypeScript, Zustand

---

### Task 1: Sidebar.tsx — LocalizedString フェーズ名の変換修正（最重要）

**Files:**
- Modify: `src/components/Sidebar.tsx:928-938`

- [ ] **Step 1: 修正を適用**

`src/components/Sidebar.tsx` 935行目の `name:` 行を、`usePlanStore.ts:139-148` と同じ LocalizedString 対応ロジックに置き換える。

変更前:
```typescript
name: p.name ? `Phase ${i + 1}\n${p.name}` : `Phase ${i + 1}`,
```

変更後:
```typescript
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

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "fix: Sidebar テンプレート→プラン変換で LocalizedString フェーズ名が消失するバグを修正"
```

---

### Task 2: TemplateEditor.tsx — getPhaseForTime に startTimeSec を追加 & 表示JA優先

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx:34-49`

- [ ] **Step 1: getPhaseForTime の戻り値を拡張**

変更前:
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
    ? (typeof result.name === 'string' ? { ja: '', en: result.name } : result.name as LocalizedString)
    : undefined;
  const displayName = nameObj ? (nameObj.en || nameObj.ja || `P${result.id}`) : `P${result.id}`;
  return { id: result.id, name: displayName, nameObj };
}
```

変更後:
```typescript
function getPhaseForTime(
  time: number,
  phases: TemplateData['phases'],
): { id: number; name: string; nameObj?: LocalizedString; startTimeSec: number } {
  let result = phases[0] ?? { id: 1, startTimeSec: 0, name: undefined };
  for (const phase of phases) {
    if (phase.startTimeSec <= time) {
      result = phase;
    }
  }
  const nameObj = result.name
    ? (typeof result.name === 'string' ? { ja: '', en: result.name } : result.name as LocalizedString)
    : undefined;
  const displayName = nameObj ? (nameObj.ja || nameObj.en || `P${result.id}`) : `P${result.id}`;
  return { id: result.id, name: displayName, nameObj, startTimeSec: result.startTimeSec ?? 0 };
}
```

変更点:
1. 戻り型に `startTimeSec: number` を追加
2. `displayName` の優先順を `nameObj.ja || nameObj.en` に変更（JA優先）
3. `return` に `startTimeSec` を追加

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし（startTimeSec は追加フィールドなので既存利用箇所に影響なし）

- [ ] **Step 3: コミット**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "fix: getPhaseForTime に startTimeSec 追加 & 表示をJA優先に変更"
```

---

### Task 3: TemplateEditor.tsx — editingPhase 状態拡張 & クリック/適用ハンドラ修正

**Files:**
- Modify: `src/components/admin/TemplateEditor.tsx:341, 456-461, 599-602`

- [ ] **Step 1: editingPhase の型を拡張**

341行目を変更。

変更前:
```typescript
  const [editingPhase, setEditingPhase] = useState<{ timeSec: number; eventId: string; pos: { x: number; y: number }; nameObj: LocalizedString } | null>(null);
```

変更後:
```typescript
  const [editingPhase, setEditingPhase] = useState<{ timeSec: number; phaseStartTimeSec: number; eventId: string; pos: { x: number; y: number }; nameObj: LocalizedString } | null>(null);
```

- [ ] **Step 2: クリックハンドラを修正**

456-461行目を変更。

変更前:
```typescript
                    onClick={(e) => setEditingPhase({
                      timeSec: event.time,
                      eventId: evId,
                      pos: { x: e.clientX, y: e.clientY },
                      nameObj: phase.nameObj ?? { ja: '', en: '' },
                    })}
```

変更後:
```typescript
                    onClick={(e) => {
                      const isAtBoundary = phases.some(p => p.startTimeSec === event.time);
                      setEditingPhase({
                        timeSec: event.time,
                        phaseStartTimeSec: phase.startTimeSec,
                        eventId: evId,
                        pos: { x: e.clientX, y: e.clientY },
                        nameObj: isAtBoundary ? (phase.nameObj ?? { ja: '', en: '' }) : { ja: '', en: '' },
                      });
                    }}
```

変更点:
- `phaseStartTimeSec` を追加（囲んでいるフェーズの開始時刻）
- 境界行: 既存フェーズ名をプリフィル（編集モード）
- 非境界行: 空欄で開く（新規追加モード）

- [ ] **Step 3: 適用ハンドラを修正**

599-602行目を変更。

変更前:
```typescript
        onApply={(value) => {
          const isEmpty = !value.ja && !value.en && !value.zh && !value.ko;
          onSetPhaseAtTime(editingPhase.timeSec, isEmpty ? null : value);
          setEditingPhase(null);
        }}
```

変更後:
```typescript
        onApply={(value) => {
          const isEmpty = !value.ja && !value.en && !value.zh && !value.ko;
          if (isEmpty) {
            // 削除: 囲んでいるフェーズの境界を削除
            onSetPhaseAtTime(editingPhase.phaseStartTimeSec, null);
          } else {
            // 追加/更新: クリックした行の時刻に境界を設定
            onSetPhaseAtTime(editingPhase.timeSec, value);
          }
          setEditingPhase(null);
        }}
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/components/admin/TemplateEditor.tsx
git commit -m "fix: フェーズ編集の境界判定修正 — 削除が任意の行から可能に、非境界行は空欄で開く"
```

---

### Task 4: 全体ビルド確認 & TODO更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 全体ビルド**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 2: TODO.md 更新**

「実装済み未確認」のフェーズ編集項目を「修正済み未確認」に更新し、修正内容をメモ。

- [ ] **Step 3: 最終コミット**

```bash
git add docs/TODO.md
git commit -m "docs: フェーズ編集バグ修正の記録を TODO.md に追加"
```
