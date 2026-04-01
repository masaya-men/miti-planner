# チュートリアル Fキー体験割り込みステップ 設計書

## 概要

メインチュートリアルの最後に、CompletionCardを一旦表示した後「ちょっと待って！」と割り込み、Fキー（フォーカスモード）を体験させてから本当の完了画面を出すユーモラスな演出を追加する。

## ユーザー体験フロー

```
ステップ12完了（軽減スキル配置）
  ↓
ステップ13 [fake-completion]: CompletionCard表示（ボタン無効化）
  ↓ ~1.5秒後
割り込みカード「ちょっと待って！」が左から登場
  → CompletionCardが衝撃でぐにゃっと変形しながら右上に吹き飛ぶ
  → 全面ブロックは維持（Fキー以外の操作不可）
  ↓
ステップ14 [focus-interrupt]: 割り込みカードで「Fキーを押してみて！」と案内
  → キーボードイベントでFキーのみ受付
  → ユーザーがFキーを押す → フォーカスモード発動
  ↓
ステップ15 [real-completion]: 本当のCompletionCard表示（ユーモア文言版）
  → ボタン押下でチュートリアル完了
```

## 操作ブロック要件

| フェーズ | ブロック範囲 | 許可する操作 |
|---------|------------|-------------|
| ステップ13 (fake-completion) | 全面ブロック | なし（ボタンも無効） |
| 割り込みアニメーション中 | 全面ブロック | なし |
| ステップ14 (focus-interrupt) | 全面ブロック（TutorialBlocker targetRect=null） | Fキーのみ |
| ステップ15 (real-completion) | CompletionCard内のボタンのみ | 「はじめる」ボタン |

**Fキーのブロック解除**: Layout.tsx のショートカットハンドラはそのまま動作する（TutorialBlockerはpointer-eventsのみブロックし、keydownはブロックしない）。ステップ14では `focus-mode:entered` イベントを Layout.tsx 側の Fキーハンドラ内から発火する（チュートリアルactive + 該当ステップ時のみ）。

## ステップ定義の変更

### tutorialDefinitions.ts

```typescript
// animation 型に追加
animation?: '...' | 'fake-completion-card' | 'focus-interrupt';

// ステップ定義変更
{
  id: 'main-13-fake-complete',
  target: null,
  pill: 'next',
  messageKey: 'tutorial.main.complete.message',  // 既存文言流用
  completionEvent: 'tutorial:fake-dismissed',
  animation: 'fake-completion-card',
},
{
  id: 'main-14-focus-mode',
  target: null,
  pill: 'next',
  messageKey: 'tutorial.main.focus_mode.message',
  descriptionKey: 'tutorial.main.focus_mode.description',
  completionEvent: 'focus-mode:entered',
  animation: 'focus-interrupt',
},
{
  id: 'main-15-real-complete',
  target: null,
  pill: 'next',
  messageKey: 'tutorial.main.real_complete.message',
  completionEvent: 'tutorial:dismissed',
  animation: 'completion-card',  // 既存CompletionCard再利用（文言は分岐）
},
```

## 新規コンポーネント

### FakeCompletionCard (`src/components/tutorial/animations/FakeCompletionCard.tsx`)

CompletionCardと同じ見た目だがボタン無効。~1.5秒後に以下のアニメーション:

1. 割り込みカードが左から勢いよくスライドイン
2. 衝突の衝撃でCompletionCardが:
   - `scaleX` を一瞬縮める（ぐにゃっと凹む）
   - その後 `rotate` + `x`/`y` で右上に吹き飛ぶ（放物線的）
   - `opacity: 0` でフェードアウト
3. 割り込みカードだけが残る
4. 割り込みカードの内容: 「あと1つだけ！」的なメッセージ
5. アニメーション完了後 `completeEvent('tutorial:fake-dismissed')` を発火

### FocusInterruptCard (同ファイル内 or 別コンポーネント)

- 「Fキーを押して表を大きくしてみよう！」と案内
- キーボード待ちアニメーション（Fキーアイコンのpulse等）
- TutorialBlocker active=true, targetRect=null で全面ブロック

## フォーカスモード復帰タイミング

ステップ15（real-completion）に進んだ瞬間、フォーカスモードを自動解除する。
Layout.tsx の Fキーハンドラで `focus-mode:entered` を発火した直後にフォーカスモードONになるが、
ステップ15のアニメーション（completion-card variant=real）のマウント時に `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))` 相当の処理でフォーカスモードをOFFに戻す。

これにより:
- ユーザーがFを押す → フォーカスモード発動（サイドバー・ヘッダー消える）
- 次のステップに進む → 自動でフォーカスモード解除（UIが戻る）
- 元のUI全体が見える状態で「今度こそ完了！」カードを表示

**実装**: Layout.tsx に `exitFocusMode` 関数をカスタムイベント(`shortcut:exit-focus`)で呼び出せるようにし、CompletionCard（variant=real）のマウント時にこのイベントを発火する。

## CompletionCard の文言分岐

### 方法: i18nキーを分ける

```json
// 既存（1回目の偽CompletionCard用 — そのまま使う）
"tutorial.completion.title": "基本操作はこれで完璧！"

// 新規（2回目の本当のCompletionCard用）
"tutorial.completion_real.title": "今度こそ、本当に完了！"
"tutorial.completion_real.menu_hint": （既存と同じ内容を流用）
"tutorial.completion_real.start_button": "本当にはじめる"
```

CompletionCard に `variant?: 'default' | 'real'` propを追加し、`real` の場合は `completion_real.*` キーを使う。

## Layout.tsx の変更

Fキーハンドラ内で、チュートリアルがアクティブかつステップ14の場合に `completeEvent('focus-mode:entered')` を発火:

```typescript
if (key === 'f') {
  e.preventDefault();
  // チュートリアル: focus-mode体験ステップの完了
  const tutStore = useTutorialStore.getState();
  if (tutStore.isActive) {
    tutStore.completeEvent('focus-mode:entered');
  }
  // 既存のフォーカスモードトグル処理...
}
```

## TutorialOverlay.tsx の変更

`renderAnimation` に2つの新しいcaseを追加:

```typescript
case 'fake-completion-card':
  return <FakeCompletionCard onComplete={() => {
    useTutorialStore.getState().completeEvent('tutorial:fake-dismissed');
  }} />;
case 'focus-interrupt':
  return <FocusInterruptCard />;
```

ブロッカー制御:
```typescript
// fake-completion-card と focus-interrupt は全面ブロック
{(step.animation === 'fake-completion-card' || step.animation === 'focus-interrupt') && (
  <TutorialBlocker targetRect={null} active={true} />
)}
```

## i18n キー追加

### ja.json
```json
"focus_mode": {
  "message": "あと1つだけ！",
  "description": "「F」キーを押して、表だけの集中モードを体験してみよう！"
},
"real_complete": {
  "message": "今度こそチュートリアル完了！"
}
```

### en.json
```json
"focus_mode": {
  "message": "One more thing!",
  "description": "Press \"F\" to try Focus Mode — it hides everything but the table!"
},
"real_complete": {
  "message": "Tutorial complete — for real this time!"
}
```

### completion_real キー
```json
"completion_real": {
  "title": "今度こそ、本当に完了！",
  "menu_hint": "チュートリアルはいつでも「チュートリアルを見る」から見返せます。",
  "start_button": "本当にはじめる"
}
```

## アニメーション詳細（Framer Motion）

### CompletionCard吹き飛ばし
```typescript
// ぐにゃっと凹んで右上に飛ぶ
animate: {
  scaleX: [1, 0.85, 1.1],  // 横に凹む→反動で膨らむ
  scaleY: [1, 1.15, 0.9],  // 縦に伸びる→縮む
  rotate: [0, -5, 25],     // 傾く
  x: [0, -20, 600],        // 左に押されて→右に飛ぶ
  y: [0, 10, -400],        // 少し下がって→上に飛ぶ
  opacity: [1, 1, 0],      // 飛びながらフェードアウト
}
transition: { duration: 0.8, times: [0, 0.2, 1] }
```

### 割り込みカードスライドイン
```typescript
initial: { x: -500, rotate: -10 }
animate: { x: 0, rotate: 0 }
transition: { type: 'spring', stiffness: 200, damping: 20 }
```

## 影響範囲

| ファイル | 変更内容 |
|---------|---------|
| `src/data/tutorialDefinitions.ts` | ステップ13変更 + 14・15追加、animation型拡張 |
| `src/components/tutorial/animations/FakeCompletionCard.tsx` | **新規** |
| `src/components/tutorial/animations/CompletionCard.tsx` | variant prop追加 |
| `src/components/tutorial/TutorialOverlay.tsx` | renderAnimation拡張 + ブロッカー追加 |
| `src/components/Layout.tsx` | Fキーハンドラにtutorialイベント発火追加 + `shortcut:exit-focus`イベント対応 |
| `src/locales/ja.json` | i18nキー追加 |
| `src/locales/en.json` | i18nキー追加 |
