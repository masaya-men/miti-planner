# スマホ イベント追加・編集・削除 設計書

## 概要

スマホでもPC版と同等のイベント管理機能（新規作成・編集・削除）を提供する。
既存の「通常タップ → 軽減追加」は維持し、「長押し → イベント操作」を追加する。

## 最重要制約

**PC版の機能を絶対に壊さない。** 既存ファイルの変更は全て `isMobile` 分岐内のみ。分岐外のコードは一切触らない。

## 設計原則

- ハードコーディングなし: 色・サイズ・角丸は既存Tailwindトークン/CSS変数を使用
- 多言語対応: 全テキストを翻訳キー管理（ja/en/zh/ko）
- 既存パターン踏襲: framer-motion、glass-panel、角丸14px等の既存UIと統一

---

## 1. 操作フロー

```
通常タップ → 軽減追加（現行のまま、変更なし）

長押し（300ms）
  → 触覚フィードバック（navigator.vibrate）
  → MobileContextMenu（ボトムシート）表示
    ├─ イベントを編集 → EventModal（編集モード）
    ├─ この時間にイベント追加 → EventModal（新規モード）
    └─ イベントを削除 → 確認ダイアログ → 削除実行
```

## 2. MobileContextMenu（新規コンポーネント）

### ファイル
`src/components/MobileContextMenu.tsx`（新規作成、モバイル専用）

### 構造
- **ヘッダー**: 長押ししたイベントの攻撃名・時間・種別・ダメージを表示
- **メニュー項目**:
  1. **イベントを編集**（紫アイコン）— 翻訳キー: `app.context_edit_event`
  2. **この時間にイベント追加**（緑アイコン）— 翻訳キー: `app.context_add_event`
  3. 区切り線
  4. **イベントを削除**（赤アイコン、赤背景）— 翻訳キー: `app.context_delete_event`

### 仕様
- 起動: カード長押し 300ms → `navigator.vibrate(10)` で触覚フィードバック
- 閉じる: オーバーレイタップ / 下スワイプ / メニュー選択後
- 削除: 確認ダイアログを挟む（翻訳キー: `app.context_delete_confirm`）
- アニメーション: framer-motion の下→上スライド（既存MobileFABと統一）
- z-index: 既存のボトムシートと同レベル

### Props
```typescript
interface MobileContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  event: TimelineEvent;        // 長押しされたイベント
  time: number;                // イベントの時間
  onEdit: (event: TimelineEvent) => void;
  onAdd: (time: number) => void;
  onDelete: (event: TimelineEvent) => void;
}
```

## 3. EventModal モバイル最適化

### 方針
既存 `EventModal.tsx` の `isMobile` 分岐内のレイアウトのみ変更。保存ロジック・バリデーション・逆算計算は一切触らない。

### モバイルレイアウト（1枚スクロールボトムシート）

フィールド配置（上から順に）:

1. **ドラッグハンドル**
2. **タイトル行**: 「イベント追加」or「イベント編集」 + 時間バッジ
3. **攻撃名**: テキスト入力（font-size: 16px、iOSズーム防止）
4. **種別 & 対象**: 横並び2列
   - 種別: 魔法/物理/不可避（3択ボタン）
   - 対象: AoE/MT/ST（3択ボタン）
5. **ダメージ**: 数値入力 + 逆算/直接トグル（ラベル横コンパクト配置）
6. **軽減スキル選択**: 逆算モード時のみ表示（grid-cols-6）
7. **時間（秒）**: 編集モード時のみ表示（新規時は自動入力で非表示）
8. **保存ボタン**: 幅100%、角丸14px

### PC版との差分（モバイル専用変更点）
- 種別 & 対象を横並び（縦スペース節約）
- 逆算/直接をラベル横のコンパクトトグルに変更
- 保存ボタンを下部固定で大きく表示
- 新規モードでは時間フィールドを非表示（長押しした行の時間を自動使用）

## 4. MobileTimelineRow 変更

### 変更内容
長押しハンドラの追加（`isMobile`分岐内のみ）

### 実装方針
- `onTouchStart` / `onTouchEnd` で300ms判定
- 長押し中にスクロールされた場合はキャンセル（`onTouchMove`で判定）
- 長押し成功時に `onLongPress` コールバック実行
- 通常タップ（300ms未満）は既存の軽減追加動作を維持

## 5. MobileFAB 変更

### 追加項目
「表を展開する / 表を折りたたむ」をナビゲーション項目の先頭（一番上）に追加。

```
FAB項目（上から）:
1. 表を展開する ← 新規追加
2. Phase
3. Label
4. Search
─── 区切り線 ───
5. Sync
6. Language
7. Theme
```

### 仕様
- アイコン: 展開時 `ChevronsDown`、折りたたみ時 `ChevronsUp`（lucide-react）
- トグル動作: 押すたびに展開/折りたたみ切替
- 翻訳キー: `app.fab_expand` / `app.fab_collapse`

### ツールメニューからの削除
ツールメニュー内の既存「表を展開する」ボタンは削除する（FABに移動するため）。

## 6. チュートリアル追加

### スマホ初回表示時
- 長押し操作の案内を追加
- 表示タイミング: スマホでタイムラインを初めて表示した時
- 内容: 「カードを長押しでイベントの追加・編集・削除ができます」
- 翻訳キー: `tutorial.mobile_long_press`
- 既存のチュートリアル基盤（step管理）に乗せて実装

## 7. 翻訳キー一覧

| キー | ja | en |
|------|----|----|
| `app.context_edit_event` | イベントを編集 | Edit Event |
| `app.context_edit_event_desc` | 名前・ダメージ・種別を変更 | Change name, damage, type |
| `app.context_add_event` | この時間にイベント追加 | Add Event at This Time |
| `app.context_add_event_desc` | {time} に新しい攻撃を追加 | Add a new attack at {time} |
| `app.context_delete_event` | イベントを削除 | Delete Event |
| `app.context_delete_event_desc` | この攻撃をタイムラインから削除 | Remove this attack from timeline |
| `app.context_delete_confirm` | このイベントを削除しますか？ | Delete this event? |
| `app.context_delete_confirm_yes` | 削除する | Delete |
| `app.context_delete_confirm_no` | キャンセル | Cancel |
| `app.fab_expand` | 表を展開する | Expand Table |
| `app.fab_collapse` | 表を折りたたむ | Collapse Table |
| `tutorial.mobile_long_press` | カードを長押しでイベントの追加・編集・削除ができます | Long press a card to add, edit, or delete events |

※ zh/ko の翻訳は実装時に追加

## 8. 変更ファイル一覧

| ファイル | 変更内容 | PC影響 |
|---------|---------|--------|
| **新規:** `MobileContextMenu.tsx` | 長押しボトムシート | なし（新規） |
| `MobileTimelineRow.tsx` | 長押しハンドラ追加 | なし（モバイル専用） |
| `MobileFAB.tsx` | 展開ボタン追加（7項目に） | なし（モバイル専用） |
| `EventModal.tsx` | モバイルUIレイアウト最適化 | なし（isMobile分岐内のみ） |
| `Timeline.tsx` | 長押し→モーダル呼び出し配線 | なし（isMobile分岐内のみ） |
| ツールメニュー関連 | 展開ボタン削除 | なし（FABに移動） |
| 4言語ファイル | 翻訳キー追加 | なし（キー追加のみ） |
| チュートリアル関連 | 長押し案内ステップ追加 | なし（モバイル分岐のみ） |

## 9. テスト戦略

- **PC回帰テスト**: EventModal の既存テスト全パス確認
- **モバイル手動テスト**: 長押し→メニュー→各操作の動作確認
- **タップ/長押し判定**: 300ms閾値の動作（タップで軽減追加、長押しでメニュー）
- **スクロール中の長押しキャンセル**: スクロール操作と長押しが干渉しないこと
