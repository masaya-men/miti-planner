# AA追加モードのフロー刷新 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AA追加モードの UX を「設定→有効化→配置」の分離フローから、ワンクリックで設定モーダルが開き→配置モードに入る統合フローに刷新する。配置中はマウス追従ツールチップで現在の設定を常に表示する。

**Architecture:** 既存の AASettingsPopover を「AA配置開始フロー」として改修し、「追加開始」ボタンを追加。配置モード中はフローティングバー（Sidebar.tsx の multiSelect パターン流用）を画面下部に表示し、設定確認 + 終了ボタンを提供。マウスカーソルにはツールチップが追従する。

**Tech Stack:** React 19 + TypeScript + Zustand + Tailwind CSS v4 + i18n (react-i18next) + clsx + createPortal

---

## ファイル構成

| 操作 | ファイル | 責務 |
|------|---------|------|
| 修正 | `src/components/AASettingsPopover.tsx` | 設定ポップオーバーに「追加開始」ボタンを追加 |
| 修正 | `src/components/Timeline.tsx` | AA ボタン→ポップオーバー連携変更、フローティングバー追加、マウス追従ツールチップ追加、歯車ボタン削除 |
| 修正 | `src/locales/ja.json` | 新 i18n キー追加 |
| 修正 | `src/locales/en.json` | 新 i18n キー追加 |

---

## 新フロー概要

```
【現行】
  Swordボタン → AA有効化（設定は歯車から別途）→ クリックで配置

【新フロー】
  Swordボタン → 設定ポップオーバーが開く（ダメージ・属性・対象入力）
  → 「追加開始」ボタン → AA配置モードに入る
  → 画面下部にフローティングバー表示（「AA: 50,000 (MT/魔法) | 設定変更 | ✕ 終了」）
  → マウスに「AA: 50,000 をクリックで追加」ツールチップが追従
  → タイムラインクリックで配置（既存ロジック維持）
  → フローティングバーの ✕ or Escape で終了
```

---

### Task 1: i18n キーの追加

**Files:**
- Modify: `src/locales/ja.json:67-77`
- Modify: `src/locales/en.json` (同じセクション)

- [ ] **Step 1: ja.json に新しいキーを追加**

`aa_settings` セクションに以下のキーを追加:

```json
"aa_settings": {
    "title": "AA追加モード",
    "popover_header": "オートアタック設定",
    "target": "対象タンク",
    "damage": "基本ダメージ量",
    "type": "ダメージ属性",
    "phys": "物理",
    "magic": "魔法",
    "dark": "ユニーク",
    "help_text": "バフやデバフの影響を受けていない状態で実際に受けた数値を入力してください。",
    "start_adding": "追加開始",
    "floating_label": "AA: {{damage}} ({{target}}/{{type}})",
    "cursor_tooltip": "AA: {{damage}} をクリックで追加",
    "change_settings": "設定変更",
    "end_mode": "終了",
    "damage_required": "ダメージ量を入力してください"
}
```

- [ ] **Step 2: en.json に英語版キーを追加**

```json
"aa_settings": {
    "title": "Add AA Mode",
    "popover_header": "Auto-Attack Settings",
    "target": "Target Tank",
    "damage": "Base Damage",
    "type": "Damage Type",
    "phys": "Physical",
    "magic": "Magical",
    "dark": "Unique",
    "help_text": "Enter the actual damage received without any buffs or debuffs applied.",
    "start_adding": "Start Adding",
    "floating_label": "AA: {{damage}} ({{target}}/{{type}})",
    "cursor_tooltip": "AA: {{damage}} — click to add",
    "change_settings": "Settings",
    "end_mode": "End",
    "damage_required": "Please enter damage amount"
}
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: AA追加モード刷新用のi18nキーを追加"
```

---

### Task 2: AASettingsPopover に「追加開始」ボタンを追加

**Files:**
- Modify: `src/components/AASettingsPopover.tsx`

- [ ] **Step 1: props に onStartAdding コールバックを追加**

`AASettingsPopoverProps` インターフェースに追加:

```typescript
interface AASettingsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AASettings;
    onSettingsChange: (settings: AASettings) => void;
    triggerRef?: React.RefObject<HTMLElement | null>;
    onStartAdding: () => void;  // ← 追加
}
```

コンポーネントの引数にも `onStartAdding` を追加。

- [ ] **Step 2: ポップオーバーのフッターに「追加開始」ボタンを追加**

`</div>` (body の閉じ) と `</div>` (ルートの閉じ) の間、つまり `{/* Body */}` セクションの `</div>` の直後に追加:

```tsx
{/* Footer — 追加開始ボタン */}
<div className="px-4 pb-4 pt-1">
    <button
        onClick={() => {
            if (settings.damage > 0) {
                onStartAdding();
                onClose();
            }
        }}
        disabled={settings.damage <= 0}
        className={clsx(
            "w-full py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer",
            settings.damage > 0
                ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                : "bg-app-text/20 text-app-text/40 cursor-not-allowed"
        )}
    >
        {settings.damage > 0
            ? t('aa_settings.start_adding')
            : t('aa_settings.damage_required')
        }
    </button>
</div>
```

- [ ] **Step 3: 動作確認**

1. `npm run dev` でローカル起動
2. AA ボタンをクリック → ポップオーバーが開く
3. ダメージ未入力時 → ボタンがグレーアウト、「ダメージ量を入力してください」表示
4. ダメージ入力後 → ボタンが有効化、「追加開始」表示

- [ ] **Step 4: コミット**

```bash
git add src/components/AASettingsPopover.tsx
git commit -m "feat: AASettingsPopoverに追加開始ボタンを追加"
```

---

### Task 3: Timeline.tsx — AA ボタンのフロー変更（歯車削除 + ワンクリック統合）

**Files:**
- Modify: `src/components/Timeline.tsx:1370-1410` (コントロールバーの AA セクション)
- Modify: `src/components/Timeline.tsx:704-706` (状態変数)

- [ ] **Step 1: AA ボタンのクリック動作を変更**

**現行** (行1378): `onClick={() => setIsAaModeEnabled(!isAaModeEnabled)}`

**変更後**: クリックで以下の動作に:
- AA モード OFF の場合 → ポップオーバーを開く（`setAaSettingsOpen(true)`）
- AA モード ON の場合 → AA モードを終了（`setIsAaModeEnabled(false)`）

```tsx
<button
    onClick={() => {
        if (isAaModeEnabled) {
            setIsAaModeEnabled(false);
        } else {
            setAaSettingsOpen(!aaSettingsOpen);
        }
    }}
    className={clsx(
        "flex-1 flex items-center justify-center gap-2 px-2 md:px-3 h-full transition-all duration-300 group/btn cursor-pointer",
        isAaModeEnabled
            ? "text-app-accent"
            : "text-app-text"
    )}
>
    <Sword size={14} className={clsx("transition-transform duration-300 group-hover/btn:scale-110 shrink-0", isAaModeEnabled ? "text-app-text" : "")} />
    <span className="font-black text-[10px] uppercase tracking-wider hidden md:block">{t('aa_settings.title')}</span>
</button>
```

- [ ] **Step 2: 歯車ボタンを削除**

行1389-1400 の歯車ボタン（`<button ref={aaSettingsButtonRef} ...>`）を削除する。

`aaSettingsButtonRef` はもう歯車ボタンではなく、AA ボタン自体を指すように変更:
- AA ボタンの `<button>` に `ref={aaSettingsButtonRef}` を追加

- [ ] **Step 3: AASettingsPopover に onStartAdding を渡す**

```tsx
<AASettingsPopover
    isOpen={aaSettingsOpen}
    onClose={() => setAaSettingsOpen(false)}
    settings={aaSettings}
    onSettingsChange={setAaSettings}
    triggerRef={aaSettingsButtonRef}
    onStartAdding={() => setIsAaModeEnabled(true)}
/>
```

- [ ] **Step 4: 動作確認**

1. AA ボタン（Sword アイコン）をクリック → ポップオーバーが開く
2. 設定入力 →「追加開始」→ AA モード ON（ボタン色変化）
3. もう一度 AA ボタンをクリック → AA モード OFF

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: AAボタンをワンクリック統合フローに変更、歯車ボタン削除"
```

---

### Task 4: フローティングバーの追加（AA配置モード中に画面下部に表示）

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: フローティングバーの JSX を追加**

Timeline コンポーネントの return 内、既存 JSX の末尾（閉じタグの手前）に createPortal でフローティングバーを追加。Sidebar.tsx の multiSelect フローティングバー（行1160-1220）のパターンを流用:

```tsx
{/* AA 配置モード フローティングバー */}
{createPortal(
    <div className={clsx(
        "fixed bottom-6 left-1/2 z-[99980] flex items-center gap-3 px-5 py-2.5",
        "bg-app-bg border border-app-text/15 rounded-2xl",
        "shadow-[0_8px_32px_rgba(0,0,0,.6)]",
        "transition-all duration-300",
        isAaModeEnabled
            ? "opacity-100 translate-x-[-50%] translate-y-0 pointer-events-auto"
            : "opacity-0 translate-x-[-50%] translate-y-10 pointer-events-none"
    )}>
        {/* 現在の設定ラベル */}
        <span className="text-[11px] font-black text-app-text whitespace-nowrap">
            <Sword size={12} className="inline mr-1.5 -mt-0.5" />
            {t('aa_settings.floating_label', {
                damage: aaSettings.damage.toLocaleString(),
                target: aaSettings.target,
                type: t(`aa_settings.${aaSettings.type === 'magical' ? 'magic' : aaSettings.type === 'physical' ? 'phys' : 'dark'}`)
            })}
        </span>
        <div className="w-px h-5 bg-app-text/10 shrink-0" />
        {/* 設定変更ボタン */}
        <button
            onClick={() => setAaSettingsOpen(true)}
            className="py-1.5 px-3 rounded-lg text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
        >
            <Settings size={12} className="inline mr-1 -mt-0.5" />
            {t('aa_settings.change_settings')}
        </button>
        <div className="w-px h-5 bg-app-text/10 shrink-0" />
        {/* 終了ボタン */}
        <button
            onClick={() => setIsAaModeEnabled(false)}
            className="py-1.5 px-3 rounded-lg text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer whitespace-nowrap active:scale-95"
        >
            <X size={12} className="inline mr-1 -mt-0.5" />
            {t('aa_settings.end_mode')}
        </button>
    </div>,
    document.body
)}
```

- [ ] **Step 2: Escape キーで AA モード終了**

既存の useEffect（キーボードイベント）に追加するか、新規 useEffect を追加:

```tsx
useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && isAaModeEnabled) {
            setIsAaModeEnabled(false);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [isAaModeEnabled]);
```

- [ ] **Step 3: 動作確認**

1. AA ボタン → 設定 → 「追加開始」→ 画面下部にフローティングバー出現
2. フローティングバーに「AA: 50,000 (MT/魔法)」と表示
3. 「設定変更」クリック → ポップオーバー再表示
4. 「終了」クリック → AA モード OFF、フローティングバー消滅
5. Escape キー → 同上

- [ ] **Step 4: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: AA配置モード中のフローティングバーを追加"
```

---

### Task 5: マウス追従ツールチップの追加

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: マウス位置の追跡 state を追加**

Timeline コンポーネント内（状態変数エリア、行704付近）に追加:

```tsx
const [aaMousePos, setAaMousePos] = useState({ x: 0, y: 0 });
```

- [ ] **Step 2: タイムラインスクロールエリアに onMouseMove を追加**

タイムラインのスクロールコンテナ（`scrollContainerRef`）に `onMouseMove` を追加:

```tsx
onMouseMove={isAaModeEnabled ? (e) => setAaMousePos({ x: e.clientX, y: e.clientY }) : undefined}
```

- [ ] **Step 3: マウス追従ツールチップ JSX を追加**

フローティングバーと同じ場所（createPortal）に追加:

```tsx
{/* AA モード マウス追従ツールチップ */}
{isAaModeEnabled && createPortal(
    <div
        className="fixed z-[99990] pointer-events-none px-3 py-1.5 rounded-lg bg-app-bg/95 border border-app-text/20 shadow-lg text-[11px] font-black text-app-text whitespace-nowrap transition-opacity duration-100"
        style={{
            left: `${aaMousePos.x + 16}px`,
            top: `${aaMousePos.y - 8}px`,
        }}
    >
        <Sword size={11} className="inline mr-1.5 -mt-0.5" />
        {t('aa_settings.cursor_tooltip', {
            damage: aaSettings.damage.toLocaleString()
        })}
    </div>,
    document.body
)}
```

- [ ] **Step 4: 動作確認**

1. AA モード有効化 → マウスをタイムライン上で動かす
2. マウスに「AA: 50,000 をクリックで追加」が追従する
3. AA モード終了 → ツールチップ消滅

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: AA配置モード中のマウス追従ツールチップを追加"
```

---

### Task 6: フローティングバーから設定変更した場合の再開フロー

**Files:**
- Modify: `src/components/Timeline.tsx`
- Modify: `src/components/AASettingsPopover.tsx`

- [ ] **Step 1: AA モード中の設定変更対応**

フローティングバーの「設定変更」で開いたポップオーバーは、設定変更のみ行い AA モードを維持する。「追加開始」ボタンは AA モード中は不要なので非表示にする。

AASettingsPopover に `isAaActive` prop を追加:

```typescript
interface AASettingsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AASettings;
    onSettingsChange: (settings: AASettings) => void;
    triggerRef?: React.RefObject<HTMLElement | null>;
    onStartAdding: () => void;
    isAaActive?: boolean;  // ← 追加: AAモード中かどうか
}
```

フッターボタンを条件分岐:

```tsx
{/* Footer */}
{!isAaActive && (
    <div className="px-4 pb-4 pt-1">
        <button
            onClick={() => {
                if (settings.damage > 0) {
                    onStartAdding();
                    onClose();
                }
            }}
            disabled={settings.damage <= 0}
            className={clsx(
                "w-full py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all duration-200 cursor-pointer",
                settings.damage > 0
                    ? "bg-app-text text-app-bg hover:opacity-80 active:scale-[0.98]"
                    : "bg-app-text/20 text-app-text/40 cursor-not-allowed"
            )}
        >
            {settings.damage > 0
                ? t('aa_settings.start_adding')
                : t('aa_settings.damage_required')
            }
        </button>
    </div>
)}
```

- [ ] **Step 2: Timeline.tsx で isAaActive を渡す**

```tsx
<AASettingsPopover
    isOpen={aaSettingsOpen}
    onClose={() => setAaSettingsOpen(false)}
    settings={aaSettings}
    onSettingsChange={setAaSettings}
    triggerRef={aaSettingsButtonRef}
    onStartAdding={() => setIsAaModeEnabled(true)}
    isAaActive={isAaModeEnabled}
/>
```

- [ ] **Step 3: 動作確認**

1. AA モード有効中 → フローティングバーの「設定変更」→ ポップオーバーが開く
2. 「追加開始」ボタンは非表示
3. ダメージを変更 → ポップオーバーを閉じる → フローティングバーのラベルが更新されている
4. マウス追従ツールチップも新しいダメージ値を表示

- [ ] **Step 4: コミット**

```bash
git add src/components/AASettingsPopover.tsx src/components/Timeline.tsx
git commit -m "feat: AA配置モード中の設定変更フローを追加"
```

---

### Task 7: コントロールバーのAAボタン表示最適化

**Files:**
- Modify: `src/components/Timeline.tsx:1370-1410`

- [ ] **Step 1: AAモード有効時のボタン外観を調整**

AA モード有効中はコントロールバーのボタンも「有効中」であることを示す。歯車は削除済みなので、ボタン全体のスタイルを調整:

```tsx
<div className={clsx(
    "flex items-center gap-0 relative rounded-md transition-all duration-300 overflow-hidden h-6 w-full",
    isAaModeEnabled && "bg-app-text/10 ring-1 ring-app-text/20"
)}>
    <button
        ref={aaSettingsButtonRef}
        onClick={() => {
            if (isAaModeEnabled) {
                setIsAaModeEnabled(false);
            } else {
                setAaSettingsOpen(!aaSettingsOpen);
            }
        }}
        className={clsx(
            "flex-1 flex items-center justify-center gap-2 px-2 md:px-3 h-full transition-all duration-300 group/btn cursor-pointer",
            isAaModeEnabled
                ? "text-app-accent"
                : "text-app-text"
        )}
    >
        <Sword size={14} className={clsx("transition-transform duration-300 group-hover/btn:scale-110 shrink-0", isAaModeEnabled ? "text-app-text" : "")} />
        <span className="font-black text-[10px] uppercase tracking-wider hidden md:block">{t('aa_settings.title')}</span>
    </button>
</div>
```

- [ ] **Step 2: 動作確認**

1. AA モード OFF → ボタンは通常表示
2. AA モード ON → ボタンに薄いリングが付く
3. ON 状態でボタンクリック → AA モード OFF

- [ ] **Step 3: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: AAモード有効時のコントロールバーボタン表示を最適化"
```

---

### Task 8: 最終統合テスト + クリーンアップ

**Files:**
- Modify: `src/components/Timeline.tsx` (不要な state/ref の削除)

- [ ] **Step 1: 不要なコードの削除**

- `aaSettingsButtonRef` は AA ボタン自体を指すように変更済み → 確認
- 歯車ボタン関連のコードが残っていないか確認
- `aaSettingsOpen` の初期値・リセットタイミングが正しいか確認

- [ ] **Step 2: 全フロー通し確認**

1. **初回フロー**: AA ボタン → ポップオーバー → ダメージ 50000 入力 → MT / 魔法 →「追加開始」→ フローティングバー表示 → マウス追従ツールチップ表示
2. **配置**: タイムライン行クリック → AA イベント配置 → モードは維持
3. **設定変更**: フローティングバー「設定変更」→ ポップオーバー → ダメージ変更 → 閉じる → フローティングバー更新
4. **終了**: フローティングバー「終了」→ モード OFF → バー消滅 → ツールチップ消滅
5. **Escape**: AA モード中に Escape → 終了
6. **イベントクリック**: AA モード中にイベントをクリック → AA モード終了（既存動作維持）
7. **ダメージ0ガード**: ダメージ未入力で「追加開始」ボタンが無効であること
8. **英語モード**: 言語を EN に切り替えてフローティングバー・ツールチップの表示確認

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

エラーがないことを確認。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: AA追加モードのフロー刷新（統合完了）"
```
