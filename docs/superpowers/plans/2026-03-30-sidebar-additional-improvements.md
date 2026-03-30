# サイドバー追加改善 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** サイドバーの3点改善 — 削除スピナーアニメーション、プラン名ツールチップ、ボタン群のレイアウト移動

**Architecture:** Sidebar.tsx内のContentTreeItemに削除アニメーション用stateとTooltip追加。Sidebar本体のJSXブロック入れ替えでレイアウト変更。

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Lucide React icons

---

## Task 1: 削除ボタンのスピナーアニメーション

**Files:**
- Modify: `src/components/Sidebar.tsx:104-105` (state追加)
- Modify: `src/components/Sidebar.tsx:377-400` (Portal内メニューの削除ボタン)

現在の動作: 「削除」クリック → 即座に「クリックで削除」に変化
目標の動作: 「削除」クリック → 赤スピナー(400ms) → 「クリックで削除」に変化

- [ ] **Step 1: deleteAnimatingステートを追加**

`src/components/Sidebar.tsx` 105行目の直後に追加:

```tsx
const [deleteAnimating, setDeleteAnimating] = React.useState(false);
```

- [ ] **Step 2: メニュー閉じ時にdeleteAnimatingもリセット**

135行目付近のuseEffect（menuPlanId閉じ時リセット）を更新:

```tsx
React.useEffect(() => {
    if (!menuPlanId) { setConfirmDeletePlanId(null); setMenuPos(null); setDeleteAnimating(false); }
}, [menuPlanId]);
```

- [ ] **Step 3: 削除ボタンの3段階表示を実装**

Portal内の `{confirmDeletePlanId === plan.id ? (` 部分を以下に変更:

```tsx
{confirmDeletePlanId === plan.id ? (
    deleteAnimating ? (
        <div className="w-full flex items-center justify-center py-1.5">
            <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
    ) : (
        <button
            onClick={() => {
                usePlanStore.getState().deletePlan(plan.id);
                setMenuPlanId(null);
                setConfirmDeletePlanId(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-white bg-red-500 hover:bg-red-600 transition-colors cursor-pointer rounded-sm"
        >
            <Trash2 size={11} />
            {t(isTouchDevice ? 'sidebar.delete_single_confirm_tap' : 'sidebar.delete_single_confirm_click')}
        </button>
    )
) : (
    <button
        onClick={() => {
            setDeleteAnimating(true);
            setConfirmDeletePlanId(plan.id);
            setTimeout(() => setDeleteAnimating(false), 400);
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
    >
        <Trash2 size={11} />
        {t('sidebar.delete_single')}
    </button>
)}
```

- [ ] **Step 4: ビルド確認**

Run: `npx tsc --noEmit`

---

## Task 2: プラン名にツールチップ追加

**Files:**
- Modify: `src/components/Sidebar.tsx:313` (プラン名span)

プラン名が省略表示（truncate）されている場合、ホバーでフルネームを表示する。

- [ ] **Step 1: プラン名spanをTooltipでラップ**

313行目の `<span className="flex-1 truncate min-w-0">{plan.title}</span>` を以下に変更:

```tsx
<Tooltip content={plan.title} position="top">
    <span className="flex-1 truncate min-w-0">{plan.title}</span>
</Tooltip>
```

`Tooltip`コンポーネントは既にインポート済み（17行目）。

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit`

---

## Task 3: ボタン群のレイアウト移動

**Files:**
- Modify: `src/components/Sidebar.tsx:1091-1178` (JSXブロック入れ替え)

現在の順序: ボタン群(1091-1128行) → レベル/カテゴリタブ(1130-1178行) → コンテンツ一覧
変更後: レベル/カテゴリタブ → ボタン群 → コンテンツ一覧

- [ ] **Step 1: レベル/カテゴリタブとボタン群の順序を入れ替え**

1091-1178行を以下の順序に変更:

1. レベルタブ + カテゴリタブ（元1130-1178行のdiv、クラス`px-3 space-y-2 shrink-0 mb-3`）を先に配置
2. ボタン群（元1091-1128行のdiv、クラス`px-3 flex items-center gap-1 mb-2 shrink-0 flex-wrap`）を後に配置

具体的には、現在の:
```
{/* ボタン群 */}
<div className="px-3 flex items-center gap-1 mb-2 shrink-0 flex-wrap">...</div>

{/* レベル/カテゴリタブ */}
<div className="px-3 space-y-2 shrink-0 mb-3">...</div>
```

を以下に入れ替える:
```
{/* レベル/カテゴリタブ */}
<div className="px-3 space-y-2 shrink-0 mb-3">...</div>

{/* ボタン群 */}
<div className="px-3 flex items-center gap-1 mb-2 shrink-0 flex-wrap">...</div>
```

コード内容は一切変更せず、2つのdivブロックの順序のみ入れ替える。

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit && npx vite build`

---

## Task 4: Escapeキー対応をTODO.mdに記録

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: TODO.mdの「UI改善」セクションに追記**

```markdown
- [ ] **Escapeキーでモーダル・メニューを閉じる** — 全モーダル・ドロップダウンでEscapeキー対応。×ボタンを押さなくても閉じられるようにする
```
