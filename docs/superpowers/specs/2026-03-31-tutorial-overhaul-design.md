# チュートリアル刷新 設計書

> 2026-03-31 第64セッション ブレインストーミングで確定

## 1. 概要

現在の1本通し28ステップチュートリアルを廃止し、**短い個別チュートリアル3本** + **チュートリアルメニュー**に刷新する。

### 刷新の動機（βテストフィードバック）
- 25+ステップが長すぎて離脱する
- 「見てね」ステップが退屈
- 数字入力が面倒、0入力で詰むバグ
- 戻ると進めなくなるバグ
- パルスが目立たない、薄くなっているのがわからない
- 攻撃追加ステップがテンプレートユーザーのフローとずれる

### 設計方針
- **新規設計・既存削除**（アプローチB）: 既存の`useTutorialStore.ts`と`TutorialOverlay.tsx`を新しい設計で完全に書き直す
- **データ駆動型**: チュートリアル定義は宣言的な配列。ステップの追加・削除・並べ替えは配列の編集だけで完結
- **独立アピール物体方式**: ボタン自体のCSSをいじらず、近くに浮かぶ「ピル」で誘導
- **戻るボタン廃止**: undo/redoロジック全削除。間違えたらスキップ→メニューから再実行
- **スポットライト廃止**: 画面を暗くしない。クリックブロックのみ残す

---

## 2. チュートリアル一覧

| ID | 名前（JA） | 名前（EN） | 発火条件 | 完了状態の保存 |
|---|---|---|---|---|
| `main` | はじめてガイド | Getting Started | 初回プラン作成時（timelineEvents空 + 未完了 + 共有リンクからでない） | localStorage |
| `add-event` | 攻撃の追加 | Adding Attacks | +ボタンまたは新規作成ボタンを**初めて**押したとき。どちらか1回で完了フラグが立つ | localStorage |
| `share` | 共有のしかた | How to Share | 共有ボタンを**初めて**押したとき | localStorage |

- 完了状態は`tutorial-storage`キーのlocalStorageに保存（既存キーを拡張）
- Firestoreには保存しない
- メニューからの再実行は完了状態に関係なく起動

---

## 3. 誘導UIデザイン

### ピルインジケーター
- **形状**: ピル型（角丸の小さなカプセル）
- **色**: `#22c55e`（ビビッドグリーン）。ダーク/ライトテーマ両対応
- **ラベル**: 4種類
  - `CLICK` — デフォルト。「このボタンを押して」
  - `TAP` — スマホ時の差し替え用（将来）
  - `CHECK` — 確認ステップ。「ここを見て」
  - `NEXT` — ステップ間の遷移。「次へ進もう」
- **アニメーション**: ボタン上でバウンド（`cubic-bezier(0.36, 0, 0.66, 1)` 1.4秒周期）
- **ピル飛行**: ターゲット変更時にCSS transitionで自然に移動。飛行中にラベル変化可能（CHECK → CLICK等）
- **配置**: ターゲット要素の外側に配置。ボタン自体のCSSは一切いじらない
- **矢印**: ピル内にSVGの下向きシェブロン（白）

### 吹き出しカード
- 緑系カードスタイル（ピルと統一感）
- テキストはi18nキー経由（ハードコーディング禁止）
- 画像スロットあり（WebP。チュートリアル用スクショ等。省略可能）
- 配置: ターゲットの近くに自動配置（上下左右で空きスペースを判定）

### クリックブロッカー
- 画面全体を覆う透明div（`z-index: 10000`、`pointer-events: auto`）
- ターゲット領域だけ`clipPath`でくり抜き（ターゲットのみ操作可能）
- 画面を暗くしない（スポットライト廃止）
- ターゲット外クリック時は何も起きない

---

## 4. メインチュートリアル（`main`）ステップ詳細

### ステップ一覧

| # | target | pill | 内容 | completionEvent | 特殊演出 |
|---|---|---|---|---|---|
| 1 | サイドバーのコンテンツ | CLICK | 「戦うボスを選ぼう」 | `content:selected` | — |
| 2 | パーティ編成ボタン | CLICK | 「パーティを編成しよう」 | `party:opened` | — |
| 3 | ヒーラースロット | CLICK | 「どのスロットにも入れられるよ」→ DPSを入れさせる | `party:job-set` | — |
| 4 | 配置したジョブ | CLICK | 「間違えても削除できるよ」→ 削除させる | `party:job-removed` | — |
| 5 | パレットの指定ジョブ2つ | CLICK | 「ジョブを選んでみよう」→ 2つ押させる | `party:two-set` | 2つだけピルでアピール |
| 6 | — | — | 残り6枠が自動で埋まる | `party:auto-filled` | **PartyAutoFill演出** |
| 7 | パーティ閉じるボタン | CLICK | 「完了！閉じよう」 | `party:closed` | — |
| 8 | 赤いダメージセル → 軽減セル | CHECK → CLICK | 致死ダメージ確認 → ピルが飛行して軽減セルへ移動 → CLICKに変化 | `mitigation:cell-clicked` | **PillFly演出** |
| 9 | 軽減セレクター内の軽減 | CLICK | 「この軽減を置こう」 | `mitigation:added` | — |
| 10 | — | — | 完了画面 | `tutorial:dismissed` | **CompletionCard演出** |

### ステップ6: PartyAutoFill演出の詳細
1. ユーザーが2つジョブを配置した直後に発動
2. パレット上の残りのプリセットジョブアイコンの位置を`getBoundingClientRect()`で取得
3. 各アイコンの「分身」（clone要素）を生成
4. 分身がランダムな弧を描く軌道で空のスロットへ飛行
5. スロットに到着時に「カチャッ」と収まるスケールアニメーション
6. 全スロット埋まったら`party:auto-filled`イベントを発火
7. チュートリアル用プリセットパーティから、ユーザーが選んだ2ジョブ以外の6ジョブを使用

### ステップ8: PillFly演出の詳細
1. ピルがCHECK状態で赤いダメージセルの近くに表示（バウンド中）
2. 1.5秒後に自動でピルが軽減を置くべきセルへ飛行開始（ユーザー操作不要）
3. 飛行中にラベルがCHECK → CLICKにcrossfade
4. 到着後、通常のバウンドアニメーションに戻る
5. ユーザーがセルをクリックしたら`mitigation:cell-clicked`で次へ

### ステップ10: CompletionCard の内容
- お祝いメッセージ: 「基本操作はこれで完璧！」
- 機能紹介リスト:
  - 共有ボタン: 「プランを共有できます。ログインするとチームロゴも設定できるよ！」
  - 新規作成ボタン: 「リストにないコンテンツはここから作成」
  - チュートリアルメニュー: 「いつでもここから見返せます」

---

## 5. 個別チュートリアル

### 攻撃追加チュートリアル（`add-event`）

**発火条件**: +ボタンまたは新規作成ボタンを初めて押したとき（どちらか1回で`add-event`の完了フラグが立つ）

| # | target | pill | 内容 | completionEvent |
|---|---|---|---|---|
| 1 | 攻撃名入力欄 | CLICK | 「攻撃名を入力しよう」 | `event:name-entered` |
| 2 | ダメージ入力欄 | CLICK | 「受けるダメージを入力」+ スクショ切り抜き画像（FF14のダメージ表示画面） | `event:damage-entered` |
| 3 | 軽減アイコン | CLICK | 「軽減を選ぼう」 | `event:miti-selected` |
| 4 | 追加ボタン | CLICK | 「追加で保存！」 | `event:saved` |

- ダメージ入力で0や空の場合: チュートリアル中はモーダル側で最低値を強制（0入力の詰みバグ防止）

### 共有チュートリアル（`share`）

**発火条件**: 共有ボタンを初めて押したとき

| # | target | pill | 内容 | completionEvent |
|---|---|---|---|---|
| 1 | 共有モーダル内のコピーボタン | CHECK | 「このURLを共有しよう」 | `share:url-copied` |
| 2 | — | — | ログイン状態に応じたカード表示 | `share:tutorial-done` |

- 未ログイン: 「ログインするとチームロゴを設定できるよ！」
- ログイン済み: 「チームロゴを設定してみよう」

---

## 6. チュートリアルメニュー

- 既存の「チュートリアルを見る」ボタンの見た目はそのまま
- クリックでドロップダウンメニューを表示
- メニュー項目:
  1. はじめてガイド（✓ 完了済みマーク）
  2. 攻撃の追加（✓ 完了済みマーク）
  3. 共有のしかた（✓ 完了済みマーク）
- 完了済みの✓はlocalStorageの完了フラグを参照
- 全テキストi18n対応
- クリックで該当チュートリアルを起動（完了済みでも再実行可能）

---

## 7. データ駆動型の定義構造

各チュートリアルを宣言的に定義する。ステップの追加・削除・並べ替えは配列の編集だけで完結する。

```typescript
interface TutorialStep {
  id: string;                          // ユニークID
  target: string;                      // CSSセレクタ（data-tutorial属性）
  pill: 'click' | 'tap' | 'check' | 'next'; // ピルのラベル
  messageKey: string;                  // i18n: メインメッセージ
  descriptionKey?: string;             // i18n: 補足説明（省略可）
  image?: string;                      // 画像パス（省略可）
  completionEvent: string;             // この文字列のイベントで次ステップへ
  animation?: string;                  // 特殊演出名（省略可）
  pillTransition?: {                   // ピル飛行の定義（省略可）
    toTarget: string;                  // 飛行先のCSSセレクタ
    toLabel: 'click' | 'tap' | 'check' | 'next'; // 到着後のラベル
  };
}

interface TutorialDefinition {
  id: string;                          // 'main' | 'add-event' | 'share'
  nameKey: string;                     // i18n: メニュー表示名
  triggerCondition: string;            // 発火条件の識別子
  steps: TutorialStep[];
}
```

**追加・編集のやり方:**
- ステップ追加 → `steps`配列に1オブジェクト追加 + `ja.json`/`en.json`にi18nキー追加
- ステップ削除 → 配列から該当オブジェクトを削除
- 順番変更 → 配列の順番を入れ替え
- テキスト変更 → `ja.json`/`en.json`のi18nキーを編集するだけ
- 新しいチュートリアル追加 → `TUTORIALS`オブジェクトに新しい`TutorialDefinition`を追加

---

## 8. 状態管理（Zustand: useTutorialStore）

```typescript
interface TutorialState {
  // 現在の状態
  activeTutorialId: string | null;     // 実行中のチュートリアルID
  currentStep: number;                 // 現在のステップindex

  // 完了状態（localStorage永続化）
  completed: Record<string, boolean>;  // { main: false, 'add-event': false, share: false }

  // アクション
  startTutorial: (id: string) => void;        // チュートリアル開始
  completeEvent: (eventName: string) => void;  // イベント完了（次ステップへ進む判定）
  skipTutorial: () => void;                    // スキップ（確認ダイアログあり）

  // 内部
  _savedSnapshot: TutorialSnapshot | null;     // 開始前の状態退避（メインのみ）
}
```

- `completeEvent`が呼ばれると、現在のステップの`completionEvent`と照合し、一致したら`currentStep++`
- 最終ステップ完了で`completed[id] = true`をlocalStorageに保存
- メインチュートリアルはチュートリアル用テンプレートデータを使うため、開始前に現在の状態をスナップショットとして退避し、終了時に復元する（既存の仕組みを簡素化して再利用）

---

## 9. ファイル構成

```
src/
  store/
    useTutorialStore.ts           ← 新規作成（旧ファイルを置き換え）
  data/
    tutorialDefinitions.ts        ← 新規: 3つのチュートリアル定義（データのみ）
    tutorialTemplate.ts           ← 既存: チュートリアル用タイムラインデータ（再利用）
  components/
    tutorial/                     ← 新規ディレクトリ
      TutorialOverlay.tsx         ← 新規: オーケストレーター（旧ファイルを置き換え）
      TutorialPill.tsx            ← 新規: ピルインジケーター
      TutorialCard.tsx            ← 新規: 吹き出しカード
      TutorialBlocker.tsx         ← 新規: クリックブロック層
      TutorialMenu.tsx            ← 新規: ドロップダウンメニュー
      animations/
        PartyAutoFill.tsx         ← 新規: パーティ飛行演出
        PillFly.tsx               ← 新規: ピル飛行変化演出
        CompletionCard.tsx        ← 新規: 完了画面
  locales/
    ja.json                       ← チュートリアル関連キー追加
    en.json                       ← 同上
```

### 削除対象
- `src/components/TutorialOverlay.tsx`（旧: 809行）
- `src/store/useTutorialStore.ts`（旧: 753行）
- 旧チュートリアル関連のCSSアニメーション（`src/index.css`内の`tutorial-*`キーフレーム）

### 再利用
- `src/data/tutorialTemplate.ts`（43行）— チュートリアル用タイムラインデータ生成

---

## 10. 既存コードとの統合ポイント

各コンポーネントからチュートリアルストアへイベントを発火する仕組みは既存と同じ:

```typescript
useTutorialStore.getState().completeEvent('content:selected')
```

### 統合が必要なコンポーネント
- `MitiPlannerPage.tsx` — チュートリアル開始条件の判定（既存ロジックを簡素化）
- `Sidebar.tsx` — コンテンツ選択イベント発火
- `PartySettingsModal.tsx`（または該当コンポーネント）— パーティ関連イベント発火
- `Timeline.tsx` — 軽減配置イベント発火
- `EventModal.tsx`（または該当コンポーネント）— 攻撃追加イベント発火
- コントロールバーの「チュートリアルを見る」ボタン — `TutorialMenu`に差し替え

### data-tutorial属性
ターゲット要素には`data-tutorial="xxx"`属性を付与する（既存の仕組みを継続）。新しいターゲットが必要な場合は属性を追加するだけ。

---

## 11. 多言語対応

全テキストはi18nキー経由。ハードコーディング禁止。

### 追加するi18nキーの例

```json
{
  "tutorial": {
    "menu": {
      "main": "はじめてガイド",
      "add_event": "攻撃の追加",
      "share": "共有のしかた"
    },
    "main": {
      "step1": { "message": "戦うボスを選ぼう", "description": "..." },
      "step2": { "message": "パーティを編成しよう", "description": "..." },
      "...": "..."
    },
    "completion": {
      "title": "基本操作はこれで完璧！",
      "share_hint": "プランを共有できます。ログインするとチームロゴも設定できるよ！",
      "new_plan_hint": "リストにないコンテンツはここから作成",
      "menu_hint": "いつでもここから見返せます"
    }
  }
}
```

---

## 12. 将来の拡張

- **新チュートリアルの追加**: `tutorialDefinitions.ts`に新しい定義を追加 + i18nキー追加 + 発火条件を該当コンポーネントに追加するだけ
- **YouTube埋め込み**: LP/ハウジングツアーで活用予定。チュートリアルでは不使用（容量的に不要）
- **スクリーンショット画像**: 攻撃追加チュートリアルのダメージ入力ステップで、FF14のダメージ表示画面のスクショ切り抜きを吹き出し内に表示
- **スマホ対応**: ピルのラベルをCLICK→TAPに自動切替。吹き出しの配置をモバイル最適化
