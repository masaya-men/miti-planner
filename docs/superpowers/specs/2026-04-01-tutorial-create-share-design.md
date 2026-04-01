# チュートリアル改善設計書 — 新規作成 & 共有 & 軽減UI

**作成日**: 2026-04-01
**ブランチ**: `feature/tutorial-overhaul`
**アプローチ**: 既存データ駆動型チュートリアルシステムの拡張（アプローチA）

---

## 概要

3つの変更を実施する:

1. **`create-plan` チュートリアル新設** — 既存 `add-event` を廃止し、NewPlanModal操作→攻撃追加→軽減→結果確認の一連フローをガイド
2. **`share` チュートリアル修正** — ステップ1しか表示されないバグ修正 + フロー簡略化
3. **軽減UI変更** — EventModalの「N Selected」テキストを選択済みアイコン並び表示に変更

---

## 1. `create-plan` チュートリアル

### トリガー

- `main` の完了状態に関係なく、初回の「新規作成」ボタンクリック時に自動起動
- `completed['create-plan']` が false かつ `isActive` が false のとき
- TutorialMenu からの手動再実行も可能

### 状態管理

- `main` と同じスナップショット方式で開始前の状態を退避
- `startTutorial('create-plan')` 時に:
  - 現在のプランIDとスナップショットを `_savedPlanId` / `_savedSnapshot` に保存
  - `resetForTutorial()` は呼ばない（新規プラン作成がチュートリアルの一部なので）
- 終了時（完了・スキップ両方）に:
  - `ダンジョン_チュートリアル` プランを自動削除
  - 元のプランに復元
- `restoreUserState` の条件を `id === 'main'` → `id === 'main' || id === 'create-plan'` に変更

### ステップ定義（全10ステップ）

| # | id | 内容 | target | pill | animation | completionEvent |
|---|---|------|--------|------|-----------|-----------------|
| 1 | `create-1-open-modal` | テンプレにない表を作ろう！ | `[data-tutorial="new-plan-btn"]` | click | — | `create:modal-opened` |
| 2 | `create-2-level` | レベルを選ぼう | `[data-tutorial="level-max"]`（動的に最大レベル） | click | — | `create:level-selected` |
| 3 | `create-3-category` | 種類を選ぼう | `[data-tutorial="category-dungeon"]` | click | — | `create:category-selected` |
| 4 | `create-4-name` | 名前を代わりに入力しますね！ | `[data-tutorial="plan-name-input"]` | check | `typewriter-fill` | `create:name-filled` |
| 5 | `create-5-submit` | 作成ボタンを押そう | `[data-tutorial="create-plan-btn"]` | click | — | `create:plan-created` |
| 6 | `create-6-add-event` | 攻撃を追加しよう（+ボタン） | `[data-tutorial="add-event-btn"]` | click | — | `create:event-modal-opened` |
| 7 | `create-7-fill-event` | 攻撃名とダメージを入力 | `[data-tutorial="event-name-input"]` | check | `typewriter-fill` | `create:event-filled` |
| 8 | `create-8-miti` | 軽減を選ぼう（リプライザル） | `[data-tutorial="tutorial-skill-reprisal"]` | click | — | `create:miti-selected` |
| 9 | `create-9-save` | 保存して完了 | `[data-tutorial="event-save-btn"]` | click | — | `create:event-saved` |
| 10 | `create-10-complete` | 完了！ | null | next | `completion-card` | `tutorial:dismissed` |

### ステップ詳細

#### ステップ1: 新規作成ボタン
- Sidebar の新規作成ボタンに `data-tutorial="new-plan-btn"` を付与
- クリックでNewPlanModalが開き、`completeEvent('create:modal-opened')` 発火

#### ステップ2: レベル選択
- NewPlanModal のレベルタブに `data-tutorial="level-max"` を動的に付与（`LEVEL_OPTIONS[0]` = 常に最大レベル）
- クリックで `completeEvent('create:level-selected')` 発火

#### ステップ3: カテゴリ選択（ダンジョン）
- カテゴリボタンに `data-tutorial="category-dungeon"` を付与
- クリックで `completeEvent('create:category-selected')` 発火

#### ステップ4: タイプライター名前入力
- 名前入力欄に `data-tutorial="plan-name-input"` を付与
- `TypewriterFill` アニメーションが `ダンジョン_チュートリアル` を1文字ずつ入力
- ステップ定義に `typewriterConfig` フィールドを追加:
  ```ts
  typewriterConfig: {
    target: '[data-tutorial="plan-name-input"]',
    text: 'tutorial.create_plan.typewriter_name', // i18nキー（ja: ダンジョン_チュートリアル, en: Dungeon_Tutorial）
    charDelay: 80, // 1文字あたりms
  }
  ```
- React の dispatchEvent で input イベントを発火し、React state を更新
- 完了後に `completeEvent('create:name-filled')` を自動発火

#### ステップ5: 作成ボタン
- 作成ボタンに `data-tutorial="create-plan-btn"` を付与
- `handleCreate` 内で `completeEvent('create:plan-created')` 発火

#### ステップ6: +ボタン（攻撃追加）
- テンプレート下部の+ボタンに `data-tutorial="add-event-btn"` を付与
- クリックで EventModal が開き、`completeEvent('create:event-modal-opened')` 発火

#### ステップ7: タイプライター攻撃名＆ダメージ入力
- 2段階のタイプライター入力:
  1. 攻撃名入力欄（`event-name-input`）に攻撃名を入力
  2. 完了後、ダメージ入力欄（`event-actual-damage-input`）にダメージ値を入力
- ステップ定義に複数フィールド対応の `typewriterConfig` を拡張:
  ```ts
  typewriterConfig: {
    fields: [
      { target: '[data-tutorial="event-name-input"]', text: 'tutorial.create_plan.typewriter_event_name', charDelay: 80 },
      { target: '[data-tutorial="event-actual-damage-input"]', text: 'tutorial.create_plan.typewriter_event_damage', charDelay: 120 },
    ]
  }
  ```
- ピルとカードが入力中のフィールドに追従
- 全フィールド完了後に `completeEvent('create:event-filled')` 自動発火

#### ステップ8: 軽減選択（リプライザル）
- カードのメッセージで「野戦治療の陣とディヴァインベールは押しておきました！」と伝える
- ステップ7のタイプライター完了時（EventModal表示中）に野戦治療の陣とディヴァインベールをプログラム的に `selectedMitigations` に追加
- リプライザルボタンの `data-tutorial="tutorial-skill-reprisal"` をターゲット
- クリックで `completeEvent('create:miti-selected')` 発火

#### ステップ9: 保存
- 保存ボタン `data-tutorial="event-save-btn"` をクリック
- `completeEvent('create:event-saved')` 発火

#### ステップ10: 完了画面
- `completion-card` アニメーション（既存の CompletionCard を再利用）
- 計算結果が表に反映されたことを示すメッセージ
- 「わかった」クリックで `completeEvent('tutorial:dismissed')` → チュートリアル終了 → 状態復元

### 新アニメーション: `typewriter-fill`

新コンポーネント `src/components/tutorial/animations/TypewriterFill.tsx`

```ts
interface TypewriterFillProps {
  config: TypewriterConfig;
  onComplete: () => void;
}
```

**動作フロー:**
1. `config.fields`（または単一の `config.target`/`config.text`）を順番に処理
2. 対象の input 要素を取得
3. i18nキーからテキストを解決
4. `charDelay` ms ごとに1文字ずつ追加
5. React の `nativeInputValueSetter` + `input` イベント で React state を更新
6. 全フィールド完了後に `onComplete()` コールバック

**TutorialOverlay への統合:**
- `renderAnimation()` に `case 'typewriter-fill'` を追加
- `step.typewriterConfig` からコンフィグを取得して `TypewriterFill` に渡す

### TutorialStep 型の拡張

```ts
export interface TypewriterFieldConfig {
  target: string;       // CSSセレクタ
  text: string;         // i18nキー
  charDelay?: number;   // デフォルト 80ms
}

export interface TypewriterConfig {
  fields: TypewriterFieldConfig[];
}

export interface TutorialStep {
  // ...既存フィールド...
  animation?: 'palette-hint' | 'party-auto-fill' | 'pill-fly' | 'completion-card' | 'typewriter-fill';
  typewriterConfig?: TypewriterConfig;
}
```

---

## 2. `share` チュートリアル修正

### バグの原因（3つ）

1. **`ShareModal.tsx` の `handleCopy` で `completeEvent('share:url-copied')` が呼ばれていない** — ステップ1が永遠に完了しない
2. **ステップ2が `target: null` + `animation` なし + `cardAnchor` なし** — 仮に進んでもカード位置が不定
3. **`share:tutorial-done` を発火するコードが存在しない**

### 修正後の設計（2ステップ）

| # | id | 内容 | target | pill | completionEvent |
|---|---|------|--------|------|-----------------|
| 1 | `share-1-open` | 共有ボタンを押してみよう | `[data-tutorial="share-copy-btn"]` | click | `share:modal-opened` |
| 2 | `share-2-done` | 画像などを設定して共有しよう！ | null | next | `share:tutorial-done` |

### ステップ詳細

#### ステップ1: 共有ボタン
- 既存の `data-tutorial="share-copy-btn"` を活用
- ShareButtons のクリックで ShareModal が開く
- ShareModal の `useEffect`（isOpen=true時）で `completeEvent('share:modal-opened')` 発火

#### ステップ2: ガイドカード
- `target: null` だがカード中央表示（ShareModal の上に重なる形）
- `cardAnchor: '[data-tutorial-modal]'` でShareModal基準に配置、もしくは画面中央
- pill は `next`（「わかった」ボタン表示）
- 「わかった」クリックで `completeEvent('share:tutorial-done')` 発火
- チュートリアル完了処理で ShareModal をクローズし、状態を復元

### 状態復元

- `share` チュートリアルも `restoreUserState` の対象に追加
- ただし ShareModal のクローズは別途必要（チュートリアル完了時にモーダル閉じるコールバックを発火）
- 実装案: `useTutorialStore` に `onComplete` コールバックフィールドを追加するか、ShareButtons 側で `completed['share']` を watch して閉じる

---

## 3. 軽減UI変更

### 対象

`src/components/EventModal.tsx` 624行目:
```tsx
// 変更前
<span className="...">{selectedMitigations.length} Selected</span>
```

### 変更後

```tsx
// 選択済み軽減アイコンを横並び表示
<div className="flex items-center gap-1">
  {selectedMitigations.slice(0, 4).map(mitId => {
    const mit = MITIGATIONS.find(m => m.id === mitId);
    if (!mit) return null;
    return (
      <img
        key={mitId}
        src={mit.icon}
        alt={mit.name[lang]}
        className="w-5 h-5 rounded"
      />
    );
  })}
  {selectedMitigations.length > 4 && (
    <span className="text-[10px] text-app-text-muted">
      +{selectedMitigations.length - 4}
    </span>
  )}
</div>
```

### 仕様
- 0個: 何も表示しない
- 1〜4個: アイコンを横並び表示（各 20x20px）
- 5個以上: 最初の4個 + `+N` テキスト
- チュートリアルとの依存関係: なし（チュートリアルはボタンの `data-tutorial` セレクタのみ参照）

---

## 変更対象ファイル一覧

### 新規作成
- `src/components/tutorial/animations/TypewriterFill.tsx` — タイプライター演出コンポーネント

### 変更
- `src/data/tutorialDefinitions.ts` — `add-event` → `create-plan` 置換、`share` 修正、型拡張
- `src/store/useTutorialStore.ts` — `restoreUserState` 条件拡張、`create-plan` スナップショット対応
- `src/components/tutorial/TutorialOverlay.tsx` — `typewriter-fill` アニメーション追加
- `src/components/NewPlanModal.tsx` — `data-tutorial` 属性追加、チュートリアルイベント発火
- `src/components/EventModal.tsx` — 軽減UI変更（アイコン並び）、チュートリアルイベント発火
- `src/components/ShareModal.tsx` — `completeEvent` 呼び出し追加
- `src/components/ShareButtons.tsx` — チュートリアルイベント連携
- `src/components/Timeline.tsx` — +ボタンに `data-tutorial` 属性追加
- i18n ファイル（ja/en）— 新規チュートリアルメッセージ追加
- `src/components/tutorial/TutorialMenu.tsx` — `add-event` → `create-plan` 表示名変更

### 削除
- `add-event` チュートリアル定義（`create-plan` に置換）

---

## i18n キー（新規追加）

### create-plan チュートリアル
- `tutorial.menu.create_plan` — メニュー表示名
- `tutorial.create_plan.open_modal.message` — テンプレにない表を作ってみよう！
- `tutorial.create_plan.open_modal.description` — 好きなダンジョンやコンテンツの軽減表を一から作れます
- `tutorial.create_plan.level.message` — レベルを選ぼう
- `tutorial.create_plan.category.message` — 種類を選ぼう（ダンジョンを選んでみましょう）
- `tutorial.create_plan.name.message` — 代わりに入力しますね！
- `tutorial.create_plan.submit.message` — 作成ボタンを押そう
- `tutorial.create_plan.add_event.message` — 攻撃を追加してみよう
- `tutorial.create_plan.fill_event.message` — 攻撃名とダメージを入力します
- `tutorial.create_plan.fill_event.description` — ゆっくり入力するので見ていてください
- `tutorial.create_plan.miti.message` — 軽減を選ぼう
- `tutorial.create_plan.miti.description` — 野戦治療の陣とディヴァインベールは押しておきました！リプライザルを押してみましょう
- `tutorial.create_plan.save.message` — 保存しよう
- `tutorial.create_plan.complete.message` — 完了！
- `tutorial.create_plan.typewriter_name` — ダンジョン_チュートリアル / Dungeon_Tutorial
- `tutorial.create_plan.typewriter_event_name` — ja: `ボス攻撃` / en: `Boss Attack`
- `tutorial.create_plan.typewriter_event_damage` — ja: `120000` / en: `120000`（数値なのでi18n不要、定数で直接指定）

### share チュートリアル（修正）
- `tutorial.share.open.message` — 共有ボタンを押してみよう
- `tutorial.share.done.message` — 画像などを設定して共有しよう！
- `tutorial.share.done.description` — OGP画像やチームロゴを設定して、完成した軽減表をみんなに共有できます

---

## 注意事項

- `prefers-reduced-motion` 対応: タイプライター演出は reduced-motion 時に即座に全文表示
- NewPlanModal のレベルタブは `LEVEL_OPTIONS[0]` を常に最大レベルとして扱う（レベルキャップ更新に自動対応）
- チュートリアル用プランの削除は `restoreUserState` 内の既存ロジック（`title.endsWith('_チュートリアル')` or `'_Tutorial'`）で対応済み
