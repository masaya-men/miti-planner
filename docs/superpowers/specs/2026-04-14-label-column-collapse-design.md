# ラベル列の折り畳み機能 設計書

**日付**: 2026-04-14
**ステータス**: 承認済み

---

## 概要

タイムラインのラベル列（PC: 50px幅）に、フェーズ列と同じ折り畳み機能（16px薄いバー）を追加する。
フェーズ列との連動ロジックにより、空のラベル列はフェーズ折り畳み時に自動で畳まれる。

## 要件

### 状態管理

- **新しい状態**: `labelColumnCollapsed: boolean`
- **永続化**: `localStorage` キー `'lopo-label-col-collapsed'`
- **初期値**: localStorage から復元、なければ `false`

### ラベル列の表示判定（算出値）

```typescript
const labelColumnVisible = !labelColumnCollapsed && !(phaseColumnCollapsed && !hasLabels);
```

| フェーズ畳み | ラベル畳み | ラベルあり | ラベル列 |
|---|---|---|---|
| false | false | - | **50px**（展開） |
| false | true | - | **16px**（折り畳み） |
| true | false | true | **50px**（展開） |
| true | false | false | **16px**（自動折り畳み） |
| true | true | - | **16px**（折り畳み） |

**重要**: ラベル列は常に画面上に存在する（50px or 16px）。完全消滅(0px)はしない。
16pxバーが常に残ることで、ユーザーが列の存在に気づける。

### トグル関数

```typescript
const handleToggleLabelCollapse = () => {
    setLabelColumnCollapsed(prev => {
        const next = !prev;
        try { localStorage.setItem('lopo-label-col-collapsed', String(next)); } catch {}
        return next;
    });
};
```

フェーズ列の `handleTogglePhaseCollapse` と同じパターン。

## UI操作

### キーボードショートカット

- `Shift+L` — ラベル列の展開/折り畳みトグル（PCのみ、768px以上）
- `L`（既存）— ラベルジャンプドロップダウン開閉（変更なし）

### ヘッダー（展開時 — 50px）

既存のラベルヘッダーをそのまま使用:
- テキスト: "ラベル" + ChevronDown
- クリック: ドロップダウン開閉
- ツールチップを更新: `"ラベルにジャンプ (L) / 列の表示切替 (Shift+L)"`

### ヘッダー（折り畳み時 — 16px）

フェーズ列の折り畳みヘッダーと同じパターン:
- 幅: `w-[16px] min-w-[16px] max-w-[16px]`
- アイコン: `ChevronDown size={12} className="text-app-text-muted -rotate-90"`（左向き矢印）
- クリック: `handleToggleLabelCollapse()` で展開
- ツールチップ: `"ラベル列を表示 (Shift+L)"`
- ホバー: `hover:bg-app-surface2`
- PC表示のみ: `hidden md:flex`

### ドロップダウン（HeaderGimmickDropdown）

既存のラベルジャンプ一覧の下に折り畳みボタンを追加:
- テキスト: 展開時 → "ラベル列を非表示" / 折り畳み時 → "ラベル列を表示"
- アイコン: `PanelLeftClose`（展開時）/ `PanelLeftOpen`（折り畳み時）
- クリック後ドロップダウンを閉じる
- HeaderPhaseDropdown の折り畳みボタンと同じパターン

## アニメーション

### 幅トランジション（新規）

ラベル列とフェーズ列の両方に適用:
```
transition-[width,min-width,max-width] duration-150 ease-out
```

- ヘッダーと各行セルの両方に追加
- 既存の `transition-colors` と併用
- 50px ↔ 16px（ラベル）、60px ↔ 16px（フェーズ）が 150ms でスムーズに変化
- 展開・折り畳み両方向で同じアニメーション
- **既存動作への影響**: フェーズ列は現在アニメーションなし（瞬時切り替え）。このトランジション追加により、フェーズ列にも同じ150msアニメーションが付く（改善）

## i18n

### 更新するキー

| キー | ja | en |
|---|---|---|
| `timeline.header_gimmick_tooltip` | "ラベルにジャンプ (L) / 列の表示切替 (Shift+L)" | "Jump to label (L) / Toggle column (Shift+L)" |

### 新規キー

| キー | ja | en | zh | ko |
|---|---|---|---|---|
| `timeline.nav_label_collapse` | "ラベル列を非表示" | "Hide label column" | "隐藏标签列" | "라벨 열 숨기기" |
| `timeline.nav_label_expand` | "ラベル列を表示" | "Show label column" | "显示标签列" | "라벨 열 표시" |

zh/ko の `header_gimmick_tooltip` も同じパターンで更新。

## 変更ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `Timeline.tsx` | `labelColumnCollapsed` state追加、`labelColumnVisible` 算出、ヘッダー展開/折り畳み分岐、`Shift+L`ショートカット、幅トランジション追加（フェーズ列にも） |
| `TimelineRow.tsx` | ラベルセルの条件を `labelColumnVisible` に変更、折り畳み時の16pxセル追加、幅トランジション追加 |
| `HeaderGimmickDropdown.tsx` | 折り畳みボタン追加、`isCollapsed`/`onToggleCollapse` props追加 |
| `ja.json` | ツールチップ更新 + 新規キー2つ |
| `en.json` | ツールチップ更新 + 新規キー2つ |
| `zh.json` | ツールチップ更新 + 新規キー2つ |
| `ko.json` | ツールチップ更新 + 新規キー2つ |

### 変更しないファイル

- `MobileTimelineRow.tsx` — モバイルは24px固定、折り畳み非対応（フェーズ列と同じ方針）
- `usePlanStore.ts`, `planService.ts` — ストア・永続化の変更なし
- `lastOpenedStore.ts` — 関係なし

## テスト方針

- 既存の148テストが全パスすることを確認
- 手動テスト: 
  - Shift+Lでラベル列が畳まれる/展開される
  - フェーズを畳んだ時、ラベルありなら残る、なしなら自動折り畳み
  - ドロップダウンの折り畳みボタンが動作する
  - ページリロード後も状態が保持される
  - 150msのトランジションアニメーションが動作する
