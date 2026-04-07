# スマホ イベント追加・編集・削除 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホでカード長押し → ボトムシートからイベントの新規作成・編集・削除を行えるようにする。FABに「表を展開する」を追加し、チュートリアルに長押し案内を追加する。

**Architecture:** 新規コンポーネント `MobileContextMenu.tsx`（長押しボトムシート）を作成し、`MobileTimelineRow` に長押しハンドラを追加。`EventModal` はモバイルUIレイアウトのみ最適化（`isMobile` 分岐内のみ変更）。PC版のコードパスは一切触らない。

**Tech Stack:** React, TypeScript, Tailwind CSS, framer-motion, react-i18next, Zustand, lucide-react

**PC保護の原則:** 全ての変更は `isMobile` 分岐内またはモバイル専用ファイルに限定。既存のPC用コードパス・ロジック・スタイルは一切変更しない。

---

## ファイル構成

| ファイル | 役割 | 新規/変更 |
|---------|------|----------|
| `src/components/MobileContextMenu.tsx` | 長押しボトムシート（3メニュー項目） | 新規 |
| `src/components/MobileTimelineRow.tsx` | 長押しハンドラ追加 | 変更 |
| `src/components/MobileFAB.tsx` | 「表を展開する」項目追加 | 変更 |
| `src/components/EventModal.tsx` | モバイルUIレイアウト最適化 | 変更（isMobile分岐内のみ） |
| `src/components/Timeline.tsx` | 長押し→モーダル配線、ツールメニュー展開ボタン削除 | 変更（isMobile分岐内のみ） |
| `src/locales/ja.json` | 翻訳キー追加 | 変更 |
| `src/locales/en.json` | 翻訳キー追加 | 変更 |
| `src/locales/zh.json` | 翻訳キー追加 | 変更 |
| `src/locales/ko.json` | 翻訳キー追加 | 変更 |

---

### Task 1: 翻訳キー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: ja.json に翻訳キー追加**

`app` セクション（既存の `fab_theme` キーの後）に以下を追加:

```json
"fab_expand": "表を展開する",
"fab_collapse": "コンパクト表示",
"context_edit_event": "イベントを編集",
"context_edit_event_desc": "名前・ダメージ・種別を変更",
"context_add_event": "この時間にイベント追加",
"context_add_event_desc": "{time} に新しい攻撃を追加",
"context_delete_event": "イベントを削除",
"context_delete_event_desc": "この攻撃をタイムラインから削除",
"mobile_long_press_hint": "カードを長押しでイベントの追加・編集・削除ができます"
```

- [ ] **Step 2: en.json に翻訳キー追加**

```json
"fab_expand": "Expand Table",
"fab_collapse": "Compact View",
"context_edit_event": "Edit Event",
"context_edit_event_desc": "Change name, damage, type",
"context_add_event": "Add Event at This Time",
"context_add_event_desc": "Add a new attack at {time}",
"context_delete_event": "Delete Event",
"context_delete_event_desc": "Remove this attack from timeline",
"mobile_long_press_hint": "Long press a card to add, edit, or delete events"
```

- [ ] **Step 3: zh.json に翻訳キー追加**

```json
"fab_expand": "展开表格",
"fab_collapse": "紧凑视图",
"context_edit_event": "编辑事件",
"context_edit_event_desc": "更改名称、伤害、类型",
"context_add_event": "在此时间添加事件",
"context_add_event_desc": "在 {time} 添加新攻击",
"context_delete_event": "删除事件",
"context_delete_event_desc": "从时间轴中删除此攻击",
"mobile_long_press_hint": "长按卡片可添加、编辑或删除事件"
```

- [ ] **Step 4: ko.json に翻訳キー追加**

```json
"fab_expand": "테이블 펼치기",
"fab_collapse": "컴팩트 보기",
"context_edit_event": "이벤트 편집",
"context_edit_event_desc": "이름, 데미지, 유형 변경",
"context_add_event": "이 시간에 이벤트 추가",
"context_add_event_desc": "{time}에 새 공격 추가",
"context_delete_event": "이벤트 삭제",
"context_delete_event_desc": "이 공격을 타임라인에서 삭제",
"mobile_long_press_hint": "카드를 길게 눌러 이벤트를 추가, 편집 또는 삭제할 수 있습니다"
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし（翻訳キーの追加のみなので型エラーなし）

- [ ] **Step 6: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "i18n: スマホイベント管理・FAB展開ボタンの翻訳キー追加（4言語）"
```

---

### Task 2: MobileContextMenu コンポーネント作成

**Files:**
- Create: `src/components/MobileContextMenu.tsx`

**依存する型・コンポーネント:**
- `TimelineEvent` from `../types`
- `MobileBottomSheet` from `./MobileBottomSheet` （スワイプ閉じ付きの汎用ボトムシート）
- `Pencil`, `Plus`, `Trash2` from `lucide-react`
- `useTranslation` from `react-i18next`
- `formatTime` ユーティリティ（時間を `M:SS` 形式にフォーマット）

**事前確認:** `formatTime` の場所を確認すること。`src/utils/` 内または `Timeline.tsx` 内のヘルパー関数を探す。もし見つからなければ、インライン実装する（`Math.floor(time / 60) + ':' + String(time % 60).padStart(2, '0')`）。

- [ ] **Step 1: MobileContextMenu.tsx を作成**

```tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { TimelineEvent } from '../types';

interface MobileContextMenuProps {
    isOpen: boolean;
    onClose: () => void;
    event: TimelineEvent;
    time: number;
    onEdit: () => void;
    onAdd: () => void;
    onDelete: () => void;
    contentLanguage: string;
}

function formatTimeDisplay(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function getEventName(event: TimelineEvent, lang: string): string {
    if (typeof event.name === 'string') return event.name;
    return (event.name as Record<string, string>)[lang]
        || (event.name as Record<string, string>).en
        || (event.name as Record<string, string>).ja
        || '';
}

export const MobileContextMenu: React.FC<MobileContextMenuProps> = ({
    isOpen,
    onClose,
    event,
    time,
    onEdit,
    onAdd,
    onDelete,
    contentLanguage,
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    const timeStr = formatTimeDisplay(time);
    const eventName = getEventName(event, contentLanguage);

    const menuItems = [
        {
            key: 'edit',
            label: t('app.context_edit_event'),
            desc: t('app.context_edit_event_desc'),
            icon: <Pencil size={18} />,
            iconBg: 'bg-indigo-500/15',
            iconColor: 'text-indigo-400',
            onClick: onEdit,
            danger: false,
        },
        {
            key: 'add',
            label: t('app.context_add_event'),
            desc: t('app.context_add_event_desc', { time: timeStr }),
            icon: <Plus size={18} />,
            iconBg: 'bg-emerald-500/15',
            iconColor: 'text-emerald-400',
            onClick: onAdd,
            danger: false,
        },
    ];

    return (
        <>
            {/* 背景オーバーレイ */}
            <div
                className="fixed inset-0 z-[400] bg-black/50"
                onClick={onClose}
            />

            {/* ボトムシート */}
            <div className="fixed bottom-0 left-0 right-0 z-[401] bg-app-surface glass-panel rounded-t-2xl px-4 pt-3 pb-8 animate-[slideUp_200ms_ease-out]">
                {/* ドラッグハンドル */}
                <div className="w-9 h-1 bg-app-text/20 rounded-full mx-auto mb-3" />

                {/* コンテキストヘッダー */}
                <div className="flex items-center gap-3 mb-4 px-1">
                    <div className="w-1 h-7 bg-indigo-500 rounded-full" />
                    <div>
                        <div className="text-app-2xl font-bold text-app-text">{eventName}</div>
                        <div className="text-app-base text-app-text-muted">
                            {timeStr} · {event.target} · {event.damageAmount?.toLocaleString()} dmg
                        </div>
                    </div>
                </div>

                {/* メニュー項目 */}
                <div className="flex flex-col gap-1.5">
                    {menuItems.map((item) => (
                        <button
                            key={item.key}
                            onClick={() => { item.onClick(); onClose(); }}
                            className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-app-text/5 active:bg-app-text/10 transition-colors cursor-pointer w-full text-left"
                        >
                            <div className={clsx(
                                'w-9 h-9 rounded-[10px] flex items-center justify-center',
                                item.iconBg, item.iconColor
                            )}>
                                {item.icon}
                            </div>
                            <div>
                                <div className="text-app-2xl text-app-text">{item.label}</div>
                                <div className="text-app-base text-app-text-muted">{item.desc}</div>
                            </div>
                        </button>
                    ))}

                    {/* 区切り線 */}
                    <div className="h-px bg-app-border/60 my-1 mx-4" />

                    {/* 削除ボタン（分離） */}
                    <button
                        onClick={() => { onDelete(); onClose(); }}
                        className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-red-500/5 active:bg-red-500/10 transition-colors cursor-pointer w-full text-left"
                    >
                        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center bg-red-500/15">
                            <Trash2 size={18} className="text-red-400" />
                        </div>
                        <div>
                            <div className="text-app-2xl text-red-400">{t('app.context_delete_event')}</div>
                            <div className="text-app-base text-red-400/60">{t('app.context_delete_event_desc')}</div>
                        </div>
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </>
    );
};
```

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし（まだどこからもインポートされていないが、型チェック通過）

- [ ] **Step 3: コミット**

```bash
git add src/components/MobileContextMenu.tsx
git commit -m "feat: MobileContextMenu 長押しボトムシート新規作成"
```

---

### Task 3: MobileTimelineRow に長押しハンドラ追加

**Files:**
- Modify: `src/components/MobileTimelineRow.tsx`

**安全性:** このファイルはモバイル専用コンポーネントなので、PC版への影響は一切なし。

**設計ポイント:**
- `onTouchStart` / `onTouchEnd` / `onTouchMove` で300msの長押し判定
- スクロール中は長押しキャンセル（5px以上動いたらキャンセル）
- 長押し成功時に `navigator.vibrate(10)` で触覚フィードバック
- 通常タップ（300ms未満）は既存の `handleTap` 動作を維持

- [ ] **Step 1: Props に onLongPress を追加**

`src/components/MobileTimelineRow.tsx` の Props interface（行20-37付近）に追加:

```typescript
onLongPress?: (event: TimelineEvent, time: number) => void;
```

props の分割代入にも追加。

- [ ] **Step 2: 長押しハンドラを実装**

`handleTap` 関数の前に、長押し用の ref と handler を追加:

```typescript
const longPressTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
const touchStartPosRef = React.useRef<{ x: number; y: number } | null>(null);
const isLongPressRef = React.useRef(false);

const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressRef.current = false;

    longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if (onLongPress && events.length > 0) {
            try { navigator.vibrate(10); } catch {}
            onLongPress(events[0], time);
        }
    }, 300);
};

const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    if (dx > 5 || dy > 5) {
        // スクロール中 → 長押しキャンセル
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    }
};

const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
};
```

- [ ] **Step 3: 既存の handleTap にガードを追加**

既存の `handleTap` 関数（行159付近）の先頭に長押し判定ガードを追加:

```typescript
const handleTap = (e: React.MouseEvent) => {
    // 長押し後のクリックイベントを無視
    if (isLongPressRef.current) {
        isLongPressRef.current = false;
        return;
    }
    // 以下、既存コードそのまま
    if (timelineSelectMode || labelSelectMode) {
        // ...
```

- [ ] **Step 4: JSX にタッチイベントを追加**

行180付近の `onClick={handleTap}` と同じ要素に:

```tsx
onTouchStart={handleTouchStart}
onTouchMove={handleTouchMove}
onTouchEnd={handleTouchEnd}
```

- [ ] **Step 5: memo の比較関数に onLongPress を追加**

行末の memo 比較関数（`areEqual` 等）に `onLongPress` の比較を追加。参照比較で OK:

```typescript
prevProps.onLongPress === nextProps.onLongPress
```

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/components/MobileTimelineRow.tsx
git commit -m "feat: MobileTimelineRow に長押しハンドラ追加（タップ動作は維持）"
```

---

### Task 4: Timeline.tsx に長押し→コンテキストメニュー→EventModal の配線

**Files:**
- Modify: `src/components/Timeline.tsx`

**安全性:** 追加する state と handler は全てモバイル専用。既存の `isModalOpen` / `selectedEvent` / `selectedTime` を再利用してEventModal を開くが、これらは既にPC版でも使われている共通の state。呼び出しフローが変わるだけでロジックは同一。

- [ ] **Step 1: MobileContextMenu のインポート追加**

`Timeline.tsx` の import セクション（他のモバイルコンポーネントの近く）に追加:

```typescript
import { MobileContextMenu } from './MobileContextMenu';
```

- [ ] **Step 2: コンテキストメニュー用の state 追加**

既存のモバイル関連 state（`mobileMitiFlow` 等）の近くに追加:

```typescript
const [mobileContextMenu, setMobileContextMenu] = useState<{
    isOpen: boolean;
    event: TimelineEvent | null;
    time: number;
} | null>(null);
```

- [ ] **Step 3: 長押しハンドラ関数を追加**

`handleMobileDamageClick` の近く（行1104付近）に追加:

```typescript
const handleMobileLongPress = useCallback((event: TimelineEvent, time: number) => {
    // 他のボトムメニューを閉じる
    setMobilePartyOpen(false);
    setMobileToolsOpen(false);
    setMobileMenuOpen(false);
    // コンテキストメニューを開く
    setMobileContextMenu({ isOpen: true, event, time });
}, [setMobilePartyOpen, setMobileToolsOpen, setMobileMenuOpen]);
```

- [ ] **Step 4: コンテキストメニューからの操作ハンドラを追加**

```typescript
const handleContextEdit = useCallback(() => {
    if (!mobileContextMenu?.event) return;
    setSelectedEvent(mobileContextMenu.event);
    setSelectedTime(mobileContextMenu.time);
    setIsModalOpen(true);
    setMobileContextMenu(null);
}, [mobileContextMenu]);

const handleContextAdd = useCallback(() => {
    if (!mobileContextMenu) return;
    setSelectedEvent(null);
    setSelectedTime(mobileContextMenu.time);
    setIsModalOpen(true);
    setMobileContextMenu(null);
}, [mobileContextMenu]);

const handleContextDelete = useCallback(() => {
    if (!mobileContextMenu?.event) return;
    setConfirmDialog({
        title: t('timeline.event_delete'),
        message: t('timeline.delete_event_confirm'),
        variant: 'danger',
        onConfirm: () => {
            removeEvent(mobileContextMenu.event!.id);
            setConfirmDialog(null);
            setMobileContextMenu(null);
        },
    });
}, [mobileContextMenu, t, removeEvent]);
```

- [ ] **Step 5: MobileTimelineRow に onLongPress prop を渡す**

`MobileTimelineRow` がレンダリングされている箇所（行2035, 2056, 2078, 2106 付近）に `onLongPress={handleMobileLongPress}` を追加。全ての `<MobileTimelineRow` に追加する。

例:
```tsx
<MobileTimelineRow
    // ...既存props...
    onLongPress={handleMobileLongPress}
/>
```

- [ ] **Step 6: MobileContextMenu の JSX を追加**

`EventModal` コンポーネントの近く（行2510付近）に追加:

```tsx
{mobileContextMenu?.event && (
    <MobileContextMenu
        isOpen={mobileContextMenu.isOpen}
        onClose={() => setMobileContextMenu(null)}
        event={mobileContextMenu.event}
        time={mobileContextMenu.time}
        onEdit={handleContextEdit}
        onAdd={handleContextAdd}
        onDelete={handleContextDelete}
        contentLanguage={contentLanguage}
    />
)}
```

- [ ] **Step 7: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 8: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: Timeline にモバイル長押し→コンテキストメニュー→EventModal の配線を追加"
```

---

### Task 5: EventModal モバイルUIレイアウト最適化

**Files:**
- Modify: `src/components/EventModal.tsx`

**安全性（最重要）:**
- 変更は全て `isMobile` 分岐内のレイアウト JSX のみ
- `handleSubmit`, `handleCalculate`, `toggleMitigation` 等のロジックは一切変更しない
- チュートリアル連携コードは一切変更しない
- PC用のスタイル・ポジショニングは一切変更しない

**最適化内容:**
1. 種別（魔法/物理/不可避）と対象（AoE/MT/ST）を横並び2列に
2. 逆算/直接トグルをラベル横にコンパクト配置
3. 保存ボタンを幅100%で大きく
4. タイトル行に「イベント追加」/「イベント編集」の表示

- [ ] **Step 1: 現在のモバイルレイアウトを確認**

`EventModal.tsx` の行434-460付近のisMobile分岐を読み、現在のモバイルレイアウト構造を確認する。変更前のレイアウトをメモする。

- [ ] **Step 2: モバイル用タイトル表示を追加**

モバイルのドラッグハンドル（行460付近）の後に、モバイル専用のタイトル行を追加:

```tsx
{isMobile && (
    <div className="flex justify-between items-center mb-3">
        <h3 className="text-app-3xl font-bold text-app-text">
            {initialData ? t('app.context_edit_event') : t('app.context_add_event')}
        </h3>
        {initialTime !== undefined && (
            <span className="text-app-base text-app-text-muted bg-app-text/5 px-2.5 py-1 rounded-lg">
                {Math.floor((initialData?.time ?? initialTime) / 60)}:{String(Math.floor((initialData?.time ?? initialTime) % 60)).padStart(2, '0')}
            </span>
        )}
    </div>
)}
```

- [ ] **Step 3: 種別 & 対象の横並びレイアウト（モバイル専用）**

ダメージ種別と対象のセクションを、モバイル時のみ `flex` 横並びに変更。既存のPC用レイアウトは `!isMobile &&` でガードして残す。

モバイル用の横並びレイアウト:
```tsx
{isMobile && (
    <div className="flex gap-3 mb-3">
        <div className="flex-1">
            <label className="text-app-base text-app-text-muted mb-1.5 block">{t('event.damage_type')}</label>
            <div className="flex gap-1">
                {/* 魔法/物理/不可避ボタン — 既存のロジックをそのまま使用 */}
            </div>
        </div>
        <div className="flex-1">
            <label className="text-app-base text-app-text-muted mb-1.5 block">{t('event.target')}</label>
            <div className="flex gap-1">
                {/* AoE/MT/STボタン — 既存のロジックをそのまま使用 */}
            </div>
        </div>
    </div>
)}
```

注意: ボタンの `onClick` ハンドラ（`setDamageType`, `setTarget`）は既存のものを再利用。新たなロジックは追加しない。

- [ ] **Step 4: 逆算/直接トグルのコンパクト配置（モバイル専用）**

ダメージ入力セクションで、モバイル時のみラベル横にトグルを配置:

```tsx
{isMobile && (
    <div className="flex justify-between items-center mb-1.5">
        <label className="text-app-base text-app-text-muted">{t('event.damage')}</label>
        <div className="flex bg-app-text/5 rounded-lg p-0.5">
            <button
                type="button"
                onClick={() => setInputMode('reverse')}
                className={clsx(
                    "px-2.5 py-1 text-app-xs rounded-md transition-colors",
                    inputMode === 'reverse' ? 'bg-indigo-500/15 text-indigo-400' : 'text-app-text-muted'
                )}
            >
                {t('event.reverse')}
            </button>
            <button
                type="button"
                onClick={() => setInputMode('direct')}
                className={clsx(
                    "px-2.5 py-1 text-app-xs rounded-md transition-colors",
                    inputMode === 'direct' ? 'bg-amber-500/15 text-amber-400' : 'text-app-text-muted'
                )}
            >
                {t('event.direct')}
            </button>
        </div>
    </div>
)}
```

注意: `inputMode`, `setInputMode` は既存の state を再利用。

- [ ] **Step 5: 保存ボタンのモバイル最適化**

保存ボタンのクラスにモバイル分岐を追加（幅100%、大きめ）:

```tsx
<button
    type="submit"
    className={clsx(
        "font-semibold uppercase transition-colors",
        isMobile
            ? "w-full py-3.5 rounded-xl text-app-2xl bg-app-blue text-white active:scale-[0.98]"
            : "px-4 py-1.5 rounded-md text-app-base bg-app-blue text-white hover:bg-app-blue-hover"
    )}
>
    {t('common.save', '保存')}
</button>
```

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 7: 既存テスト確認**

Run: `npx vitest run`
Expected: 全テスト PASS（EventModal のロジックは未変更なので既存テストに影響なし）

- [ ] **Step 8: コミット**

```bash
git add src/components/EventModal.tsx
git commit -m "feat: EventModal モバイルUIレイアウト最適化（isMobile分岐内のみ）"
```

---

### Task 6: MobileFAB に「表を展開する」追加

**Files:**
- Modify: `src/components/MobileFAB.tsx`

**安全性:** モバイル専用コンポーネントのためPC影響なし。

- [ ] **Step 1: インポートにアイコン追加**

lucide-react のインポートに `Rows3, AlignJustify` を追加:

```typescript
import {
    MoreHorizontal, X, List, Tag, Search,
    Cloud, CloudCheck, CloudUpload, CloudAlert,
    Globe, Sun, Moon,
    Rows3, AlignJustify,  // 追加
} from 'lucide-react';
```

- [ ] **Step 2: Props に onToggleExpand と hideEmptyRows を追加**

```typescript
interface MobileFABProps {
    onToggleTheme: () => void;
    theme: string;
    onPhaseJump?: () => void;
    onLabelJump?: () => void;
    onMechanicSearch?: () => void;
    onToggleExpand?: () => void;   // 追加
    hideEmptyRows?: boolean;       // 追加
}
```

props の分割代入にも追加。

- [ ] **Step 3: navItems の先頭に展開ボタン追加**

`navItems` 配列（行106付近）の先頭に追加:

```typescript
const navItems = [
    {
        key: 'expand',
        label: hideEmptyRows ? t('app.fab_expand') : t('app.fab_collapse'),
        icon: hideEmptyRows ? <Rows3 size={20} /> : <AlignJustify size={20} />,
        onClick: () => { close(); onToggleExpand?.(); },
        accent: false,
    },
    // ...既存のphase, label, search項目
];
```

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: エラーなし（props は optional なので呼び出し元の変更は次タスク）

- [ ] **Step 5: コミット**

```bash
git add src/components/MobileFAB.tsx
git commit -m "feat: MobileFAB に表の展開/折りたたみボタンを追加"
```

---

### Task 7: Timeline.tsx — FABに展開props渡し & ツールメニューから展開ボタン削除

**Files:**
- Modify: `src/components/Timeline.tsx`

**安全性:** FABはモバイル専用。ツールメニューの展開ボタン削除もモバイル専用の `MobileBottomSheet` 内のみ。PC版のツールバー（行1567-1583付近）は一切変更しない。

- [ ] **Step 1: MobileFAB に展開 props を渡す**

Timeline.tsx 内で `MobileFAB` がレンダリングされている箇所を探し、以下の props を追加:

```tsx
<MobileFAB
    // ...既存props...
    onToggleExpand={handleTogglePhaseCollapse}
    hideEmptyRows={hideEmptyRows}
/>
```

注意: `handleTogglePhaseCollapse` ではなく、`hideEmptyRows` / `setHideEmptyRows` を使用する。確認が必要:

実際には展開ボタンは `hideEmptyRows` のトグルなので:

```tsx
onToggleExpand={() => {
    const store = useMitigationStore.getState();
    store.setHideEmptyRows(!store.hideEmptyRows);
}}
hideEmptyRows={hideEmptyRows}
```

- [ ] **Step 2: ツールメニューから展開ボタンを削除**

行2856-2893付近の `MobileBottomSheet` 内から、展開ボタン（`<button>` で `setHideEmptyRows` を呼んでいるもの、行2857-2873）を削除する。

undo/redo ボタン（行2874-2893）はそのまま残す。undo/redo の外側 `<div className="flex gap-2">` ラッパーはundo/redoだけ残すよう調整。

変更後:
```tsx
<MobileBottomSheet
    isOpen={mobileToolsSheetOpen}
    onClose={() => setMobileToolsSheetOpen(false)}
    title={t('mobile.tools_title')}
    height="55vh"
>
    <div className="flex flex-col gap-3">
        <div className="flex gap-2">
            {/* undo/redo ボタンのみ残す */}
            <button ... undo ... />
            <button ... redo ... />
        </div>

        <div className="h-px bg-app-border" />
        {/* FFLogs Import, Auto Plan, みんなの軽減表はそのまま */}
```

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 4: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: FABに展開ボタン接続 & ツールメニューから展開ボタン削除"
```

---

### Task 8: チュートリアル — 長押し案内の追加

**Files:**
- Modify: `src/components/Timeline.tsx` または適切なモバイルコンポーネント

**方針:** 既存のチュートリアル基盤（`useTutorialStore` + `tutorialDefinitions.ts`）は複雑なステップ管理システム。今回は簡易的な「初回表示ヒント」として、localStorage で制御するトースト表示にする。既存チュートリアルフローには組み込まない（スコープの肥大化を防ぐため）。

- [ ] **Step 1: Timeline.tsx にモバイル初回ヒントを追加**

モバイルビュー初回表示時にトーストを出す。Timeline.tsx のモバイル分岐内に:

```typescript
// モバイル長押しヒント（初回のみ）
useEffect(() => {
    if (!isMobileView) return;
    const key = 'lopo-mobile-longpress-hint-shown';
    if (localStorage.getItem(key)) return;
    // 少し遅延して表示（画面描画後）
    const timer = setTimeout(() => {
        // 既存のトースト機能があればそれを使う、なければ Toast コンポーネント呼び出し
        // showToast は Layout.tsx 等から props で渡されている可能性あるので要確認
        localStorage.setItem(key, 'true');
    }, 2000);
    return () => clearTimeout(timer);
}, [isMobileView]);
```

注意: 既存のトースト表示方法（`Toast.tsx` のインスタンスがどこで管理されているか）を確認して、適切な方法で呼び出す。トースト呼び出しの仕組みがなければ、`window.dispatchEvent` で custom event を使うか、Zustand store 経由で呼ぶ。

- [ ] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: スマホ初回表示時に長押しヒントのトースト表示"
```

---

### Task 9: 最終ビルド & テスト & PC回帰確認

**Files:** なし（検証のみ）

- [ ] **Step 1: 全体ビルド**

Run: `npm run build`
Expected: エラー・警告なし

- [ ] **Step 2: 全テスト実行**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 3: PC回帰確認チェックリスト**

手動確認:
1. PC版で EventModal が正常に開く（+ボタンクリック）
2. PC版で EventModal の保存が正常動作する
3. PC版で逆算計算が正常動作する
4. PC版のチュートリアルが正常動作する
5. PC版のツールバー（展開ボタン、undo/redo）が正常動作する
6. PC版の表示に崩れがないこと

- [ ] **Step 4: モバイル動作確認チェックリスト**

手動確認:
1. 通常タップ → 軽減追加が動作する（既存動作維持）
2. 長押し → ボトムシートが表示される
3. 「イベントを編集」→ EventModal が編集モードで開く
4. 「この時間にイベント追加」→ EventModal が新規モードで開く
5. 「イベントを削除」→ 確認ダイアログ → 削除実行
6. FAB に展開ボタンが表示される
7. 展開ボタンが正常にトグルする
8. 初回表示時にヒントトーストが出る
9. 2回目以降はヒントが出ない

- [ ] **Step 5: コミット（最終調整があれば）**

```bash
git add -A
git commit -m "fix: スマホイベント管理の最終調整"
```
