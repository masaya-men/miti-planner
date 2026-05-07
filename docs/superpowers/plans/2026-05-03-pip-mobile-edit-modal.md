# カンペ スマホ UX 改善 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ全画面カンペで「タップ → 中央モーダル → 攻撃切替+編集」の UX を実現し、同時に iOS Safari で動かないカラーピッカーを非表示化、リスト上下に弱めフェードを追加する。

**Architecture:** 全変更を `src/components/PipView.tsx` 内に閉じる。`mode === 'fullscreen'` 分岐内のみ。新 state `menuTime: number | null` でモーダル開閉管理、既存 `editingEventId` をモーダル内編集にも流用。PC 別ウィンドウ PiP（`mode === 'pip'`）は完全現状維持。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4 + framer-motion（モーダル登場アニメ）+ clsx + lucide-react

**Spec:** [docs/superpowers/specs/2026-05-03-pip-mobile-edit-modal-design.md](../specs/2026-05-03-pip-mobile-edit-modal-design.md)

---

## 実装方針メモ

- テスト: 純粋ロジックは既存 `src/__tests__/pipViewLogic.test.ts` に追加。コンポーネント DOM テストは新規 setup コストが高いため省略し、実機確認（spec 7.2/7.3）に依存。
- 各 Task で `npx tsc --noEmit` を通すこと。最終 Task で `npx vitest run` 全 PASS と `npm run build` 成功を確認。
- 各 Task 末尾で commit。最終 Task で push + Vercel 自動デプロイ。

---

### Task 1: モーダルの開閉骨格を実装

**Files:**
- Modify: `src/components/PipView.tsx`

**目的:** スマホ全画面で技名タップ → 画面中央モーダルが開く、× / 背景タップで閉じる、までの骨格。中身はまだ空でよい。

- [ ] **Step 1: `menuTime` state を追加**

`src/components/PipView.tsx` の `editingEventId` state 宣言の直後に追加：

```typescript
// ── モーダル開閉 state（スマホ時のみ。null = 閉じている） ──
const [menuTime, setMenuTime] = useState<number | null>(null);

const closeMenu = useCallback(() => {
    setMenuTime(null);
    setEditingEventId(null); // 編集中だった場合もクリア
}, []);
```

- [ ] **Step 2: 技名タップで `menuTime` を設定（スマホ時のみ）**

リスト本体（`cueGroups.map(...)` 内）の「攻撃名 + 切替バッジ」div の **`<span onDoubleClick={...}>` を以下に置き換え**：

```tsx
<span
    onDoubleClick={!isFs ? () => handleDoubleClick(event.id) : undefined}
    onClick={isFs ? () => setMenuTime(time) : undefined}
    className={clsx(
        "min-w-0 truncate leading-tight text-current/80",
        isFs ? "text-[17px] font-bold cursor-pointer" : "text-[10px] cursor-text",
    )}
    title={isFs ? t('timeline.pip_open_menu', t('timeline.pip_edit_hint')) : t('timeline.pip_edit_hint')}
>
```

注: `cursor-text` を fullscreen 時のみ `cursor-pointer` に変更（タップ可アフォーダンス）。`title` は fullscreen 時だけ `pip_open_menu` を試行（無ければ `pip_edit_hint` フォールバック）。

- [ ] **Step 3: モーダル DOM を return の最後（`</div>` の直前）に追加**

```tsx
{/* スマホ全画面: 編集モーダル */}
{isFs && menuTime !== null && (() => {
    const group = cueGroups.find(g => g.time === menuTime);
    if (!group) return null;
    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4"
            onClick={closeMenu}
        >
            <div
                className="relative glass-tier3 rounded-xl shadow-2xl w-full max-w-[360px] py-4 px-3"
                onClick={e => e.stopPropagation()}
                style={{ color: fgColor }}
            >
                <button
                    onClick={closeMenu}
                    className="absolute top-2 right-2 w-8 h-8 rounded flex items-center justify-center cursor-pointer text-current/40 hover:text-current hover:bg-current/10 transition-colors"
                    title={t('timeline.pip_close')}
                    aria-label={t('timeline.pip_close')}
                >
                    <X size={18} />
                </button>
                {/* TODO: Task 2 で攻撃リストを描画 */}
                <div className="text-center text-current/60 py-8 text-sm">
                    {group.events.length} event(s) at {formatTime(group.time)}
                </div>
            </div>
        </div>
    );
})()}
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/components/PipView.tsx
git commit -m "feat(pip): add modal scaffold for mobile cue sheet (open/close only)"
```

---

### Task 2: モーダル内に攻撃リスト + 切替動作

**Files:**
- Modify: `src/components/PipView.tsx`

**目的:** モーダル内に同時刻の攻撃をリスト表示し、攻撃名タップでそのイベントに切替してモーダル閉じる。

- [ ] **Step 1: モーダル内の `{/* TODO: Task 2 ... */}` div を以下に置き換え**

```tsx
<div className="flex flex-col gap-1 mt-2 pr-8">
    {group.events.map((ev, evIdx) => {
        const displayName = notes[ev.id] || ev.name[lang] || ev.name.ja || ev.name.en || '';
        const isCurrentlyShown = evIdx === ((eventIndexByTime[group.time] ?? 0) % group.events.length);
        return (
            <div
                key={ev.id}
                className={clsx(
                    "flex items-center gap-2 rounded-lg px-3 py-2 min-h-[44px]",
                    isCurrentlyShown ? "bg-current/10" : "hover:bg-current/5",
                )}
            >
                <button
                    onClick={() => {
                        if (!isCurrentlyShown) {
                            setEventIndexByTime(prev => ({ ...prev, [group.time]: evIdx }));
                        }
                        closeMenu();
                    }}
                    className="flex-1 min-w-0 text-left text-[17px] font-bold text-current/90 truncate cursor-pointer"
                    title={isCurrentlyShown ? t('timeline.pip_already_shown', '表示中') : t('timeline.pip_switch_to', 'この攻撃に切替')}
                >
                    {displayName}
                </button>
                {/* TODO: Task 3 で編集ボタンを追加 */}
            </div>
        );
    })}
</div>
```

注: `setEventIndexByTime` は既存 state setter。`isCurrentlyShown` で現在表示中の攻撃を視覚的にハイライト。

- [ ] **Step 2: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: 既存テスト全 PASS 確認**

Run: `npx vitest run --reporter=dot`
Expected: 335/335 PASS（既存テストに影響しないこと）

- [ ] **Step 4: Commit**

```bash
git add src/components/PipView.tsx
git commit -m "feat(pip): render event list in mobile modal with tap-to-switch"
```

---

### Task 3: モーダル内編集ボタン + 編集 input

**Files:**
- Modify: `src/components/PipView.tsx`

**目的:** 編集ボタン押下で攻撃名ラベル → input、Enter / blur で確定、Esc でキャンセル、確定時はモーダル閉じる。

- [ ] **Step 1: モーダル内の各行の `{/* TODO: Task 3 ... */}` を編集ボタンに置き換え**

該当箇所（Task 2 で書いた `<button>` の後ろ）：

```tsx
<button
    onClick={() => setEditingEventId(ev.id)}
    className="shrink-0 w-9 h-9 rounded flex items-center justify-center cursor-pointer text-current/60 hover:text-current hover:bg-current/10 transition-colors"
    title={t('timeline.pip_edit_hint')}
    aria-label={t('timeline.pip_edit_hint')}
>
    <Pencil size={16} />
</button>
```

そして import に `Pencil` を追加（`X` の隣）：

```typescript
import { X, Pencil } from 'lucide-react';
```

- [ ] **Step 2: 攻撃名ラベルを編集中は input に切り替え**

Task 2 で書いた `<button onClick={...} className="flex-1 ...">` を以下に置き換え：

```tsx
{editingEventId === ev.id ? (
    <input
        ref={editInputRef}
        defaultValue={displayName}
        onBlur={(e) => {
            handleEditConfirm(ev.id, e.target.value);
            closeMenu();
        }}
        onKeyDown={(e) => {
            if (e.key === 'Enter') {
                handleEditConfirm(ev.id, (e.target as HTMLInputElement).value);
                closeMenu();
            }
            if (e.key === 'Escape') {
                e.stopPropagation();
                setEditingEventId(null);
            }
        }}
        className="flex-1 min-w-0 bg-current/10 border border-current/30 rounded px-2 py-1 text-[17px] outline-none"
        style={{ color: fgColor }}
    />
) : (
    <button
        onClick={() => {
            if (!isCurrentlyShown) {
                setEventIndexByTime(prev => ({ ...prev, [group.time]: evIdx }));
            }
            closeMenu();
        }}
        className="flex-1 min-w-0 text-left text-[17px] font-bold text-current/90 truncate cursor-pointer"
        title={isCurrentlyShown ? t('timeline.pip_already_shown', '表示中') : t('timeline.pip_switch_to', 'この攻撃に切替')}
    >
        {displayName}
    </button>
)}
```

注: 編集中は編集ボタンも非表示にしたい。編集ボタン側を以下のように囲む：

```tsx
{editingEventId !== ev.id && (
    <button onClick={() => setEditingEventId(ev.id)} ...>
        <Pencil size={16} />
    </button>
)}
```

- [ ] **Step 3: 既存 useEffect (autoFocus) はそのまま流用**

`useEffect(() => { if (editingEventId && editInputRef.current) { ... } }, [editingEventId])` は変更不要。モーダル内 input の `ref={editInputRef}` で同じく autofocus + select される。

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 5: 既存テスト全 PASS 確認**

Run: `npx vitest run --reporter=dot`
Expected: 335/335 PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/PipView.tsx
git commit -m "feat(pip): inline edit input within mobile modal (Enter/blur confirm, Esc cancel)"
```

---

### Task 4: スマホ時の行内 inline 編集 input を非表示 + ダブルタップを PC 限定

**Files:**
- Modify: `src/components/PipView.tsx`

**目的:** スマホでは行内 inline 編集 input が出ないようにする（モーダル内編集に一本化）。PC は現状維持。

- [ ] **Step 1: 行内 inline 編集 input ブロックを `!isFs` 条件で囲む**

[PipView.tsx](../../../src/components/PipView.tsx) のリスト本体（`cueGroups.map(...)` 内、Task 1 の Step 2 で触った `<span>` の周辺）：

現状の構造：
```tsx
{editingEventId === event.id ? (
    <input ... />
) : (
    <>
        <span onClick={...} onDoubleClick={...}>...</span>
        {notes[event.id] && (<button>×</button>)}
    </>
)}
```

これを以下に変更（スマホ時は行内 input を出さず、常に span を表示）：

```tsx
{!isFs && editingEventId === event.id ? (
    <input ... />
) : (
    <>
        <span
            onDoubleClick={!isFs ? () => handleDoubleClick(event.id) : undefined}
            onClick={isFs ? () => setMenuTime(time) : undefined}
            className={clsx(
                "min-w-0 truncate leading-tight text-current/80",
                isFs ? "text-[17px] font-bold cursor-pointer" : "text-[10px] cursor-text",
            )}
            title={isFs ? t('timeline.pip_open_menu', t('timeline.pip_edit_hint')) : t('timeline.pip_edit_hint')}
        >
            {notes[event.id] || (event.name[lang] || event.name.ja || event.name.en || '')}
        </span>
        {notes[event.id] && (
            <button ...>×</button>
        )}
    </>
)}
```

注: Task 1 で `<span>` の onClick / onDoubleClick / className を既に変更したため、このタスクでは「`editingEventId === event.id` の条件に `!isFs &&` を追加」だけが本質的変更。

- [ ] **Step 2: 型チェック + 既存テスト**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: tsc エラーなし、335/335 PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PipView.tsx
git commit -m "fix(pip): hide row-inline edit input on mobile (modal-only path)"
```

---

### Task 5: スマホ時カラーピッカー & デフォルト色スウォッチを非表示

**Files:**
- Modify: `src/components/PipView.tsx`

**目的:** iOS Safari で動かないカラーピッカーボタン・hidden input・デフォルト色スウォッチをスマホ時に描画しない。

- [ ] **Step 1: カラーピッカーブロック全体を `!isFs && (...)` で囲む**

該当範囲: ツールバーの `{/* カラーピッカー: ... */}` コメントから `})()}`（デフォルト色スウォッチ IIFE 終端）まで。

```tsx
{!isFs && (
    <>
        {/* カラーピッカー: 細リム色相環 + 中央に現在色 */}
        <button onClick={() => colorInputRef.current?.click()} ...>
            <span ... />
        </button>
        <input ref={colorInputRef} type="color" ... />

        {/* デフォルト色スウォッチ */}
        {(() => {
            const defaultColor = getDefaultBgColor(theme, null);
            const isAtDefault = bgColor.toLowerCase() === defaultColor.toLowerCase();
            return (
                <button onClick={resetBgColor} disabled={isAtDefault} ...>
                </button>
            );
        })()}
    </>
)}
```

- [ ] **Step 2: 型チェック + 既存テスト**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: tsc エラーなし、335/335 PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PipView.tsx
git commit -m "fix(pip): hide color picker on mobile (iOS Safari incompatible)"
```

---

### Task 6: リスト本体に上下フェード追加

**Files:**
- Modify: `src/components/PipView.tsx`

**目的:** スマホ全画面時のみ、カンペリスト本体の上下に弱め（24px）の mask-image フェードを追加。

- [ ] **Step 1: リスト本体 div に `style` プロパティを追加**

[PipView.tsx](../../../src/components/PipView.tsx) のリスト本体 div（`flex-1 overflow-y-auto`）：

現状：
```tsx
<div
    className={clsx(
        "flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden",
        isFs ? "px-2 py-1" : "px-1.5 py-1",
    )}
    style={{ scrollbarWidth: 'none' }}
>
```

これを以下に変更：

```tsx
<div
    className={clsx(
        "flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden",
        isFs ? "px-2 py-1" : "px-1.5 py-1",
    )}
    style={{
        scrollbarWidth: 'none',
        ...(isFs && {
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent)',
            maskImage: 'linear-gradient(to bottom, transparent 0, black 24px, black calc(100% - 24px), transparent)',
        }),
    }}
>
```

- [ ] **Step 2: 型チェック + 既存テスト**

Run: `npx tsc --noEmit && npx vitest run --reporter=dot`
Expected: tsc エラーなし、335/335 PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/PipView.tsx
git commit -m "feat(pip): add subtle vertical fade mask to mobile cue list"
```

---

### Task 7: 統合確認 + push + デプロイ

**目的:** 全変更を本番にデプロイし、ユーザーに実機確認を依頼。

- [ ] **Step 1: 本番ビルド成功確認**

Run: `npm run build`
Expected: ビルド成功（エラーなし。既存の chunk 警告は許容）

- [ ] **Step 2: 全テスト PASS 確認**

Run: `npx vitest run --reporter=dot`
Expected: 335/335 PASS

- [ ] **Step 3: 型チェック clean**

Run: `npx tsc --noEmit`
Expected: 出力なし

- [ ] **Step 4: push**

```bash
git push
```

Vercel が自動デプロイ。完了まで 1-2 分。

- [ ] **Step 5: docs/TODO.md の「現在の状態」を更新**

`docs/TODO.md` の「現在の状態」セクション末尾に当セッションのまとめを 1 段落追加。直前セッション（2026-05-02 Ko-fi 透明性）の前に挿入。

- [ ] **Step 6: TODO.md commit + push**

```bash
git add docs/TODO.md
git commit -m "docs(todo): 2026-05-03 カンペスマホ UX 改善（編集モーダル + カラーピッカー非表示 + 上下フェード）"
git push
```

- [ ] **Step 7: ユーザーに実機確認依頼**

spec 7.2/7.3 のチェックリストに沿って実機確認を依頼。PWA キャッシュ対策（アプリ完全終了 → 再起動）も案内。

---

## Self-Review メモ（実装者向け）

- 各 task は PipView.tsx 1 ファイルへの局所変更。依存関係は Task 1 → 2 → 3 → 4 の順（モーダル骨格 → リスト → 編集 → 行内 input 非表示）。Task 5 / 6 は独立、いつ入れても OK だが順番通りで問題なし。
- 既存 `cycleEventAtTime`（`+N` バッジ用）は本タスクで使用しない（モーダル内では `setEventIndexByTime(prev => ({ ...prev, [time]: evIdx }))` で直接 index 設定）。`+N` バッジは現状動作維持。
- `pip_open_menu` `pip_switch_to` `pip_already_shown` の i18n キーは spec 上「不要」だが、実装で `t('key', 'fallback')` 形式でフォールバック付き呼び出しすれば、後で i18n 追加するときも動く。今回は追加しない（spec 6 の方針）。
- スコープ厳守: 全変更は `mode === 'fullscreen'` 分岐内。`isFs` チェックを徹底。
