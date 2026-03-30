# サイドバー プラン行UI改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーのプラン行を5点改善 — ホバーボタン表示・名前truncate修正・削除メニュー追加・+ボタン上限表示・トースト色修正

**Architecture:** ContentTreeItem内のプラン行divを構造変更。アクションボタン群を常にレンダリングし、CSSのgroup-hoverで表示制御。⋮メニューに削除ボタン（軽量確認付き）を追加。翻訳キー4件追加。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Zustand, i18next

---

## Task 1: 翻訳キー追加（ja.json, en.json）

**Files:**
- Modify: `src/locales/ja.json:360-363`
- Modify: `src/locales/en.json:356-359`

- [ ] **Step 1: ja.jsonにキー追加**

`sidebar`セクション末尾（`csv_exported`の後）に追加:

```json
"delete_single": "削除",
"delete_single_confirm": "タップで削除",
"plan_limit": "上限 {{current}}/{{max}}"
```

- [ ] **Step 2: en.jsonにキー追加**

同じ位置に追加:

```json
"delete_single": "Delete",
"delete_single_confirm": "Tap to delete",
"plan_limit": "Limit {{current}}/{{max}}"
```

- [ ] **Step 3: ビルド確認**

Run: `npx tsc --noEmit`

---

## Task 2: プラン行の構造変更（ホバーボタン + truncate修正）

**Files:**
- Modify: `src/components/Sidebar.tsx:268-348`

- [ ] **Step 1: 親divからtruncateを削除し、group/planを追加**

268行目の親divのclassNameを変更:
- `truncate` を削除
- `group/plan` を追加

```tsx
<div
    role="button"
    tabIndex={0}
    className={clsx(
        "flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 cursor-pointer active:scale-[0.98] group/plan",
        currentPlanId === plan.id
            ? "bg-app-text/10 text-app-text font-bold"
            : "text-app-text hover:bg-glass-hover",
        "relative"
    )}
    // onClick, onKeyDown は既存のまま
>
```

- [ ] **Step 2: プラン名をtruncate付きspanでラップ**

300-301行目を変更:

```tsx
<span className={clsx("w-1 h-1 rounded-full shrink-0", currentPlanId === plan.id ? "bg-app-text" : "bg-app-text-muted/40")} />
<span className="truncate min-w-0">{plan.title}</span>
```

- [ ] **Step 3: アクションボタン群の表示条件をgroup-hoverに変更**

302-347行目の`{currentPlanId === plan.id && (<>...</>)}`を以下に変更:

```tsx
<div className={clsx(
    "flex items-center shrink-0 transition-opacity duration-150",
    currentPlanId === plan.id
        ? "opacity-100"
        : "opacity-0 group-hover/plan:opacity-100"
)}>
    <Tooltip content={t('sidebar.duplicate_plan')}>
        <button
            onClick={(e) => {
                e.stopPropagation();
                const newPlan = usePlanStore.getState().duplicatePlan(plan.id);
                if (!newPlan) {
                    showToast(t('sidebar.duplicate_limit_reached'), 'error');
                }
            }}
            className="ml-auto shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
        >
            <Copy size={9} />
        </button>
    </Tooltip>
    <Tooltip content={t('app.rename')}>
        <button
            onClick={(e) => { e.stopPropagation(); startEditing(plan.id, plan.title, e); }}
            className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
        >
            <Pencil size={9} />
        </button>
    </Tooltip>
    {/* ⋮ メニュー */}
    <div className="relative" ref={menuPlanId === plan.id ? menuRef : undefined}>
        <button
            onClick={(e) => { e.stopPropagation(); setMenuPlanId(menuPlanId === plan.id ? null : plan.id); }}
            className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
        >
            <MoreVertical size={9} />
        </button>
        {menuPlanId === plan.id && (
            <div className="absolute right-0 top-6 z-50 min-w-[140px] py-1 bg-app-bg border border-app-border rounded-lg shadow-lg">
                <button
                    onClick={(e) => { e.stopPropagation(); handleCSVExport(plan); }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-app-text hover:bg-app-text/5 transition-colors cursor-pointer"
                >
                    <Download size={11} />
                    {t('sidebar.export_csv', 'CSV ダウンロード')}
                </button>
                <div className="border-t border-app-border my-1" />
                {/* 削除ボタン — Task 3で実装 */}
            </div>
        )}
    </div>
</div>
```

**注意**: この時点ではshowToastの第2引数`'error'`も含める（Task 5を先取り）。

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`

---

## Task 3: ⋮メニューに削除ボタン追加（軽量確認付き）

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: confirmDeletePlanIdステートを追加**

99-101行目付近（menuPlanIdの隣）に追加:

```tsx
const [confirmDeletePlanId, setConfirmDeletePlanId] = React.useState<string | null>(null);
```

- [ ] **Step 2: menuPlanIdのリセット時にconfirmDeletePlanIdもリセット**

118-127行目のuseEffect内、`setMenuPlanId(null)`の直後に`setConfirmDeletePlanId(null)`を追加。

また、menuPlanIdがnullになったら（メニューが閉じたら）確認状態もリセットするuseEffectを追加:

```tsx
React.useEffect(() => {
    if (!menuPlanId) setConfirmDeletePlanId(null);
}, [menuPlanId]);
```

- [ ] **Step 3: メニュー内の区切り線の後に削除ボタンを追加**

```tsx
<div className="border-t border-app-border my-1" />
{confirmDeletePlanId === plan.id ? (
    <button
        onClick={(e) => {
            e.stopPropagation();
            usePlanStore.getState().deletePlan(plan.id);
            setMenuPlanId(null);
            setConfirmDeletePlanId(null);
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer rounded-sm"
    >
        <Trash2 size={11} />
        {t('sidebar.delete_single_confirm')}
    </button>
) : (
    <button
        onClick={(e) => {
            e.stopPropagation();
            setConfirmDeletePlanId(plan.id);
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
    >
        <Trash2 size={11} />
        {t('sidebar.delete_single')}
    </button>
)}
```

- [ ] **Step 4: lucide-reactのインポートにTrash2を追加**

ファイル先頭のlucide-reactインポートに`Trash2`が既にあることを確認（既存: Trash2はline 36にある）。

- [ ] **Step 5: ビルド確認**

Run: `npx tsc --noEmit`

---

## Task 4: +ボタンの上限時表示変更

**Files:**
- Modify: `src/components/Sidebar.tsx:354-362`

- [ ] **Step 1: +ボタンの条件分岐を追加**

354-362行目を以下に変更:

```tsx
{isActive && !multiSelect.isEnabled && (
    contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT ? (
        <div className="flex-1 text-[10px] py-1 px-2 font-medium flex items-center gap-2 text-app-text-muted/40">
            {t('sidebar.plan_limit', { current: contentPlans.length, max: PLAN_LIMITS.MAX_PLANS_PER_CONTENT })}
        </div>
    ) : (
        <button
            onClick={() => onSelect(content, true)}
            className="flex-1 text-left text-[10px] py-1 px-2 rounded-md transition-colors font-medium flex items-center gap-2 text-app-text-muted hover:text-app-text hover:bg-glass-hover cursor-pointer active:scale-[0.98]"
        >
            <Plus size={10} className="shrink-0" />
            {t('sidebar.add_plan')}
        </button>
    )
)}
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`

---

## Task 5: コピー上限トーストのエラー色修正

**Note:** Task 2のStep 3で既に`showToast(msg, 'error')`に変更済み。このタスクは確認のみ。

- [ ] **Step 1: showToastの呼び出しを確認**

Sidebar.tsx内の`showToast(t('sidebar.duplicate_limit_reached'))`が全て`showToast(t('sidebar.duplicate_limit_reached'), 'error')`になっていることを確認。

- [ ] **Step 2: 最終ビルド確認**

Run: `npx vite build`

---

## Task 6: コミット

- [ ] **Step 1: git add & commit**

```bash
git add src/components/Sidebar.tsx src/locales/ja.json src/locales/en.json
git commit -m "ui: サイドバーのプラン行UI改善5件"
```
