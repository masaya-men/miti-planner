# ラベル列の折り畳み機能 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムラインのラベル列にフェーズ列と同じ折り畳み機能（50px→16px薄いバー）を追加する

**Architecture:** `labelColumnCollapsed` (useState + localStorage) と `labelColumnVisible` (算出値) でラベル列の表示状態を管理。ラベルが空の場合はフェーズ折り畳み時に自動で畳まれる。幅変化には CSS transition 150ms を適用し、フェーズ列にも同じトランジションを追加して統一。

**Tech Stack:** React, TypeScript, Tailwind CSS, i18next, lucide-react

**設計書:** `docs/superpowers/specs/2026-04-14-label-column-collapse-design.md`

---

## ファイル構成

| ファイル | 役割 | 変更種別 |
|---|---|---|
| `src/components/Timeline.tsx` | 状態管理、ヘッダー、ショートカット、オーバーレイ | 修正 |
| `src/components/TimelineRow.tsx` | ラベル列セルの展開/折り畳み | 修正 |
| `src/components/HeaderGimmickDropdown.tsx` | 折り畳みトグルボタン追加 | 修正 |
| `src/locales/ja.json` | 日本語翻訳キー | 修正 |
| `src/locales/en.json` | 英語翻訳キー | 修正 |
| `src/locales/zh.json` | 中国語翻訳キー | 修正 |
| `src/locales/ko.json` | 韓国語翻訳キー | 修正 |

---

### Task 1: i18n キー追加（4言語）

**Files:**
- Modify: `src/locales/ja.json:367` (header_gimmick_tooltip 更新)
- Modify: `src/locales/en.json:363` (header_gimmick_tooltip 更新)
- Modify: `src/locales/zh.json:346` (header_gimmick_tooltip 更新)
- Modify: `src/locales/ko.json:346` (header_gimmick_tooltip 更新)
- 各ファイルに `nav_label_collapse`, `nav_label_expand` を追加

- [ ] **Step 1: ja.json — ツールチップ更新 + 新規キー2つ**

`src/locales/ja.json` を編集:

既存の行を変更:
```
"header_gimmick_tooltip": "ラベルにジャンプ (L)",
```
↓
```
"header_gimmick_tooltip": "ラベルにジャンプ (L) / 列の表示切替 (Shift+L)",
```

`nav_no_labels` の後に追加:
```json
"nav_label_collapse": "ラベル列を非表示",
"nav_label_expand": "ラベル列を表示",
```

- [ ] **Step 2: en.json — ツールチップ更新 + 新規キー2つ**

`src/locales/en.json` を編集:

既存の行を変更:
```
"header_gimmick_tooltip": "Jump to label (L)",
```
↓
```
"header_gimmick_tooltip": "Jump to label (L) / Toggle column (Shift+L)",
```

`nav_no_labels` の後に追加:
```json
"nav_label_collapse": "Hide label column",
"nav_label_expand": "Show label column",
```

- [ ] **Step 3: zh.json — ツールチップ更新 + 新規キー2つ**

`src/locales/zh.json` を編集:

既存の行を変更:
```
"header_gimmick_tooltip": "跳转到标签 (L)",
```
↓
```
"header_gimmick_tooltip": "跳转到标签 (L) / 切换列显示 (Shift+L)",
```

`nav_no_labels` の後に追加:
```json
"nav_label_collapse": "隐藏标签列",
"nav_label_expand": "显示标签列",
```

- [ ] **Step 4: ko.json — ツールチップ更新 + 新規キー2つ**

`src/locales/ko.json` を編集:

既存の行を変更:
```
"header_gimmick_tooltip": "라벨로 이동 (L)",
```
↓
```
"header_gimmick_tooltip": "라벨로 이동 (L) / 열 표시 전환 (Shift+L)",
```

`nav_no_labels` の後に追加:
```json
"nav_label_collapse": "라벨 열 숨기기",
"nav_label_expand": "라벨 열 표시",
```

- [ ] **Step 5: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
rtk git commit -m "feat: ラベル列折り畳み用i18nキー追加（4言語）"
```

---

### Task 2: HeaderGimmickDropdown に折り畳みボタン追加

**Files:**
- Modify: `src/components/HeaderGimmickDropdown.tsx`

- [ ] **Step 1: Props にisCollapsed/onToggleCollapse を追加**

`src/components/HeaderGimmickDropdown.tsx` を編集。

import に `PanelLeftClose, PanelLeftOpen` を追加:
```typescript
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
```

interface を更新:
```typescript
interface HeaderGimmickDropdownProps {
    isOpen: boolean;
    onClose: () => void;
    labels: Label[];
    onJump: (time: number) => void;
    triggerRef: React.RefObject<HTMLElement | null>;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}
```

コンポーネントの destructuring を更新:
```typescript
export const HeaderGimmickDropdown: React.FC<HeaderGimmickDropdownProps> = ({
    isOpen, onClose, labels, onJump, triggerRef, isCollapsed, onToggleCollapse
}) => {
```

- [ ] **Step 2: 折り畳みトグルボタンを追加**

`</div>` (最後の `document.body` の直前) の手前、ラベルリストの `</div>` の後に、HeaderPhaseDropdown と同じパターンで折り畳みボタンを追加:

`{/* 折りたたみトグル */}` のコメントから `</div>` まで、既存の閉じ `</div>` の直前に挿入:
```tsx
            {/* 折りたたみトグル */}
            <div className="border-t border-glass-border">
                <button
                    onClick={() => { onToggleCollapse(); onClose(); }}
                    className="w-full px-3 py-2.5 text-left text-app-lg text-app-text-muted hover:bg-glass-hover cursor-pointer transition-colors flex items-center gap-2"
                >
                    {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
                    {isCollapsed ? t('timeline.nav_label_expand') : t('timeline.nav_label_collapse')}
                </button>
            </div>
```

具体的な挿入位置: 既存コードの `</div>` (max-h-[300px]の閉じ) の後、createPortal の最外殻 `</div>` の前。

既存コード（108行目付近）:
```tsx
                )}
            </div>
        </div>,   ← この </div> の直前に挿入
        document.body
    );
```

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/HeaderGimmickDropdown.tsx
rtk git commit -m "feat: HeaderGimmickDropdownにラベル列折り畳みボタン追加"
```

---

### Task 3: Timeline.tsx — 状態管理 + ショートカット + ヘッダー

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: labelColumnCollapsed 状態 + トグル関数を追加**

`src/components/Timeline.tsx` の726行目付近、`phaseColumnCollapsed` の useState の直後に追加:

```typescript
    const [labelColumnCollapsed, setLabelColumnCollapsed] = useState(() => {
        try { return localStorage.getItem('lopo-label-col-collapsed') === 'true'; } catch { return false; }
    });
```

748行目付近、`handleTogglePhaseCollapse` の直後に追加:

```typescript
    const handleToggleLabelCollapse = () => {
        setLabelColumnCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('lopo-label-col-collapsed', String(next)); } catch {}
            return next;
        });
    };
```

- [ ] **Step 2: Shift+L ショートカットを追加**

`src/components/Timeline.tsx` の1622-1624行目付近、既存の `} else if (key === 'l') {` ブロックを変更:

変更前:
```typescript
            } else if (key === 'l') {
                e.preventDefault();
                setGimmickDropdownOpen(prev => !prev);
            }
```

変更後:
```typescript
            } else if (key === 'l' && e.shiftKey) {
                // Shift+L: ラベル列の表示/非表示
                e.preventDefault();
                if (gimmickDropdownOpen) setGimmickDropdownOpen(false);
                handleToggleLabelCollapse();
            } else if (key === 'l' && !e.shiftKey) {
                // L: ラベルドロップダウン開閉
                e.preventDefault();
                setGimmickDropdownOpen(prev => !prev);
            }
```

**注意**: `Shift+L` を `L` より先に判定すること（フェーズ列の Shift+P / P と同じパターン）。

- [ ] **Step 3: ヘッダー部分の書き換え — labelColumnVisible 算出 + 展開/折り畳み分岐**

`src/components/Timeline.tsx` のヘッダーIIFE内（2006-2060行付近）を変更。

2007行目付近の `const mobileLabelInPhaseSlot = !hasPhases;` の直後に `labelColumnVisible` の算出を追加:
```typescript
                                const mobileLabelInPhaseSlot = !hasPhases;
                                const hasLabels = labels.length > 0;
                                const labelColumnVisible = !labelColumnCollapsed && !(phaseColumnCollapsed && !hasLabels);
```

フェーズヘッダーの展開時クラスにトランジションを追加（2015行目付近）:
既存の `transition-colors` を `transition-[width,min-width,max-width,color] duration-150 ease-out` に変更。

フェーズヘッダーの折り畳み時クラスにもトランジションを追加（2029行目付近）:
既存の `transition-colors` を `transition-[width,min-width,max-width,color] duration-150 ease-out` に変更。

モバイルラベルヘッダー（2037行目付近）の条件を変更:
```typescript
// 変更前:
{mobileLabelInPhaseSlot && !phaseColumnCollapsed && (
// 変更後:
{mobileLabelInPhaseSlot && labelColumnVisible && (
```

PC ラベルヘッダー（2046-2060行目付近）を展開/折り畳み分岐に書き換え:

変更前:
```tsx
                                        {/* PC: ラベル列ヘッダー */}
                                        {!phaseColumnCollapsed && (
                                            <Tooltip content={t('timeline.header_gimmick_tooltip')}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="hidden md:flex w-[50px] min-w-[50px] max-w-[50px] flex-none border-r border-app-border h-full items-center justify-center bg-transparent text-app-text-muted font-black text-app-md cursor-pointer hover:text-app-text transition-colors"
                                                    onClick={() => setGimmickDropdownOpen(!gimmickDropdownOpen)}
                                                >
                                                    <span className="flex items-center gap-0.5">
                                                        {t('timeline.header_gimmick')}
                                                        <ChevronDown size={10} className="inline" />
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        )}
```

変更後:
```tsx
                                        {/* PC: ラベル列ヘッダー */}
                                        {labelColumnVisible ? (
                                            <Tooltip content={t('timeline.header_gimmick_tooltip')}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="hidden md:flex w-[50px] min-w-[50px] max-w-[50px] flex-none border-r border-app-border h-full items-center justify-center bg-transparent text-app-text-muted font-black text-app-md cursor-pointer hover:text-app-text transition-[width,min-width,max-width,color] duration-150 ease-out"
                                                    onClick={() => setGimmickDropdownOpen(!gimmickDropdownOpen)}
                                                >
                                                    <span className="flex items-center gap-0.5">
                                                        {t('timeline.header_gimmick')}
                                                        <ChevronDown size={10} className="inline" />
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <Tooltip content={`${t('timeline.nav_label_expand')} (Shift+L)`}>
                                                <div
                                                    ref={!mobileLabelInPhaseSlot ? gimmickHeaderRef : undefined}
                                                    className="w-[16px] min-w-[16px] max-w-[16px] flex-none border-r border-app-border h-full hidden md:flex items-center justify-center cursor-pointer hover:bg-app-surface2 transition-[width,min-width,max-width,color] duration-150 ease-out"
                                                    onClick={() => handleToggleLabelCollapse()}
                                                >
                                                    <ChevronDown size={12} className="text-app-text-muted -rotate-90" />
                                                </div>
                                            </Tooltip>
                                        )}
```

- [ ] **Step 4: HeaderGimmickDropdown への新props渡し**

`src/components/Timeline.tsx` で HeaderGimmickDropdown の呼び出し箇所を検索し、`isCollapsed` と `onToggleCollapse` を追加する。

HeaderGimmickDropdown の呼び出し箇所に props を追加:
```tsx
<HeaderGimmickDropdown
    isOpen={gimmickDropdownOpen}
    onClose={() => setGimmickDropdownOpen(false)}
    labels={labels}
    onJump={handleNavJump}
    triggerRef={gimmickHeaderRef}
    isCollapsed={labelColumnCollapsed}
    onToggleCollapse={handleToggleLabelCollapse}
/>
```

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat: Timeline.tsxにラベル列折り畳み状態管理+ショートカット+ヘッダー追加"
```

---

### Task 4: Timeline.tsx — オーバーレイの条件更新

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: フェーズオーバーレイの条件はそのまま**

フェーズオーバーレイ（2377行目）は `!phaseColumnCollapsed` のまま変更不要。フェーズが畳まれたらフェーズオーバーレイは非表示で正しい。

- [ ] **Step 2: ラベルオーバーレイの条件を更新**

`src/components/Timeline.tsx` の2423行目付近を変更:

変更前:
```typescript
{!phaseColumnCollapsed && labels.length > 0 && (() => {
```

変更後:
```typescript
{labelColumnVisible && labels.length > 0 && (() => {
```

ここで `labelColumnVisible` を使うには、このスコープで変数が見える必要がある。ヘッダーIIFE内で定義した `labelColumnVisible` はそのスコープ内のみ。オーバーレイはIIFEの外にあるため、オーバーレイの直前に再度算出するか、IIFE外に定義する。

**解決策**: `labelColumnVisible` を IIFE の外（Timeline コンポーネントのトップレベル）で定義する。ヘッダーIIFE内の算出は削除し、トップレベルの算出を参照する。

具体的には、748行目付近の `handleToggleLabelCollapse` の後に追加:
```typescript
    const hasLabels = labels.length > 0;
    const labelColumnVisible = !labelColumnCollapsed && !(phaseColumnCollapsed && !hasLabels);
```

そしてヘッダーIIFE内の `const hasLabels` と `const labelColumnVisible` の行は削除する（トップレベルの変数を参照）。

- [ ] **Step 3: ラベルオーバーレイの left 位置を動的に調整**

ラベルオーバーレイ（2444行目付近）の `left` と `w` は現在、フェーズ列が60pxであることを前提にハードコードされている:
```tsx
hasPhases
    ? "hidden md:block left-[60px] w-[50px]"
    : "left-0 w-[24px] md:left-[60px] md:w-[50px]"
```

フェーズ列が畳まれている時（16px）にラベルが表示される場合、left の値が変わる。

変更後:
```tsx
hasPhases
    ? `hidden md:block ${phaseColumnCollapsed ? 'left-[16px]' : 'left-[60px]'} w-[50px]`
    : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:left-[16px]' : 'md:left-[60px]'} md:w-[50px]`
```

同様に、TL選択モードのハイライトオーバーレイ（2474行目付近）も更新:

変更前:
```tsx
labelSelectMode
    ? (phases.length > 0 ? "hidden md:block left-[60px] w-[50px]" : "left-0 w-[24px] md:left-[60px] md:w-[50px]")
    : "left-0 w-[24px] md:w-[60px]"
```

変更後:
```tsx
labelSelectMode
    ? (phases.length > 0
        ? `hidden md:block ${phaseColumnCollapsed ? 'left-[16px]' : 'left-[60px]'} w-[50px]`
        : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:left-[16px]' : 'md:left-[60px]'} md:w-[50px]`)
    : `left-0 w-[24px] ${phaseColumnCollapsed ? 'md:w-[16px]' : 'md:w-[60px]'}`
```

- [ ] **Step 4: TimelineRow への labelColumnVisible prop 渡し**

`src/components/Timeline.tsx` の TimelineRow 呼び出し（2318行目付近）に `labelColumnVisible` を追加:

```tsx
<TimelineRow
    ...
    phaseColumnCollapsed={phaseColumnCollapsed}
    labelColumnVisible={labelColumnVisible}
    ...
/>
```

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat: オーバーレイ条件とleft位置をlabelColumnVisibleに対応"
```

---

### Task 5: TimelineRow.tsx — ラベルセルの展開/折り畳み

**Files:**
- Modify: `src/components/TimelineRow.tsx`

- [ ] **Step 1: TimelineRowProps に labelColumnVisible を追加**

`src/components/TimelineRow.tsx` の interface（56行目付近）に追加:

```typescript
    phaseColumnCollapsed?: boolean;
    labelColumnVisible?: boolean;
    hasPhases?: boolean;
```

コンポーネント内のdestructuringにも `labelColumnVisible` を追加。

- [ ] **Step 2: フェーズセルにトランジション追加**

フェーズ列の展開時セル（190行目付近）のクラスに幅トランジションを追加:

既存クラス末尾に追加:
```
md:cursor-pointer md:hover:bg-app-surface2
```
↓
```
md:cursor-pointer md:hover:bg-app-surface2 transition-[width,min-width,max-width] duration-150 ease-out
```

フェーズ列の折り畳み時セル（221行目）にもトランジションを追加:
```tsx
// 変更前:
<div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block" />
// 変更後:
<div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block transition-[width,min-width,max-width] duration-150 ease-out" />
```

- [ ] **Step 3: ラベルセルを展開/折り畳み分岐に書き換え**

`src/components/TimelineRow.tsx` の224-257行目付近を変更:

変更前:
```tsx
            {/* Label Column — スマホ: フェーズなし→フェーズ位置に表示 / PC: 常に表示 */}
            {!phaseColumnCollapsed && (
                <div
                    data-label-col
                    className={clsx(
                        "md:flex md:w-[50px] md:min-w-[50px] md:max-w-[50px] border-r border-app-border h-full items-center justify-center cursor-pointer hover:bg-app-surface2",
                        hasPhases ? "hidden" : "w-[24px] flex md:w-[50px]",
                    )}
                    onClick={(e) => {
                        if (labelSelectMode) {
                            onTimelineSelect?.(time);
                            return;
                        }
                        if (window.innerWidth < 768) {
                            handleMobileTap(e);
                        } else {
                            onLabelAdd?.(time, e);
                        }
                    }}
                    onMouseEnter={() => {
                        if (labelSelectMode) {
                            onTimelineSelectHover?.(time);
                        }
                    }}
                >
                    {!(timelineSelectMode || labelSelectMode) && (
                        <Tooltip content={t('timeline.add_label')} position="top">
                            <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                                <Plus size={14} />
                            </div>
                        </Tooltip>
                    )}
                </div>
            )}
```

変更後:
```tsx
            {/* Label Column — スマホ: フェーズなし→フェーズ位置に表示 / PC: 展開or折り畳み */}
            {labelColumnVisible ? (
                <div
                    data-label-col
                    className={clsx(
                        "md:flex md:w-[50px] md:min-w-[50px] md:max-w-[50px] border-r border-app-border h-full items-center justify-center cursor-pointer hover:bg-app-surface2 transition-[width,min-width,max-width] duration-150 ease-out",
                        hasPhases ? "hidden" : "w-[24px] flex md:w-[50px]",
                    )}
                    onClick={(e) => {
                        if (labelSelectMode) {
                            onTimelineSelect?.(time);
                            return;
                        }
                        if (window.innerWidth < 768) {
                            handleMobileTap(e);
                        } else {
                            onLabelAdd?.(time, e);
                        }
                    }}
                    onMouseEnter={() => {
                        if (labelSelectMode) {
                            onTimelineSelectHover?.(time);
                        }
                    }}
                >
                    {!(timelineSelectMode || labelSelectMode) && (
                        <Tooltip content={t('timeline.add_label')} position="top">
                            <div className="hidden md:flex items-center justify-center w-full h-full text-app-text-muted opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
                                <Plus size={14} />
                            </div>
                        </Tooltip>
                    )}
                </div>
            ) : (
                <div className="w-[16px] min-w-[16px] max-w-[16px] border-r border-app-border h-full hidden md:block transition-[width,min-width,max-width] duration-150 ease-out" />
            )}
```

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/TimelineRow.tsx
rtk git commit -m "feat: TimelineRowのラベルセルに展開/折り畳み分岐追加"
```

---

### Task 6: ビルド確認 + 手動テスト

**Files:** なし（検証のみ）

- [ ] **Step 1: TypeScriptビルド確認**

```bash
rtk npm run build
```

エラーがあれば修正する。

- [ ] **Step 2: テスト実行**

```bash
rtk vitest run
```

既存148テストが全パスすることを確認。

- [ ] **Step 3: 手動テスト項目（ローカル開発サーバーで確認）**

以下を確認:
1. **Shift+L** でラベル列が畳まれる（50px→16px、150msアニメーション）
2. **Shift+L** 再度で展開される（16px→50px、150msアニメーション）
3. **Shift+P** でフェーズ列にも150msアニメーションが付いている
4. ラベルドロップダウン内に「ラベル列を非表示」ボタンが表示される
5. ドロップダウンのボタンクリックで畳み/展開が切り替わる
6. **フェーズを畳んだ時**:
   - ラベルあり → ラベル列は50pxで残る
   - ラベルなし → ラベル列は16pxに自動折り畳み
7. ページリロード後も折り畳み状態が保持される（localStorage）
8. 折り畳み時のラベルオーバーレイ（区間表示）が非表示になる
9. モバイル表示（768px未満）に影響がないこと

- [ ] **Step 4: 最終コミット（必要な修正があれば）**

```bash
rtk git add -A && rtk git commit -m "fix: ラベル列折り畳みの手動テスト修正"
```
