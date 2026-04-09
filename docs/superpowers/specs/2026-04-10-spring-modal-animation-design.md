# スプリングモーダルアニメーション設計

## 概要

軽減アプリ内の主要モーダル4つに、クリック位置起点のスプリング出現アニメーションを導入する。参考: https://ics.media/entry/260402/ のモーダルUIセクション。

## 目的

- ボタンをクリック→モーダルが「そこから生まれる」ことで、操作と結果の因果関係を視覚的に伝える
- 控えめなスプリング(1回のオーバーシュート)で自然な物理感を付与
- モーダルのデザイン(見た目・レイアウト)は一切変更しない

## 対象モーダル

| モーダル | ファイル | 現在のアニメーション |
|---------|---------|-------------------|
| AA設定 | `src/components/AASettingsPopover.tsx` | Tailwind `animate-in fade-in zoom-in-95` |
| ジョブピッカー | `src/components/JobPicker.tsx` | framer-motion `scale:0.95, y:-10` |
| フェーズ/ラベル追加 | `src/components/BoundaryEditModal.tsx` | framer-motion `scale:0.95, y:10` |
| イベント追加 | `src/components/EventModal.tsx` | CSSのみ `transition-all duration-200` |

## スコープ外

- LoginModal, ShareModal, NewPlanModal等の画面全体操作系モーダル
- モーダルのデザイン・レイアウト変更
- 閉じるアニメーションの複雑化(元の位置に戻す等)

## アニメーション仕様

### 出現(open)

1. トリガーボタンの `onClick` から `event.clientX/Y` を取得
2. モーダルがクリック座標を起点に出現
   - `initial`: クリック位置、`scale: 0.2`、`opacity: 0`
   - `animate`: 画面中央、`scale: 1`、`opacity: 1`
3. スプリングトランジション(参考サイトのdefault相当)
   - `type: "spring"`, `stiffness: 380`, `damping: 25`
   - 1回の軽いオーバーシュートで収まる
4. backdrop: `opacity: 0→1` を 200ms ease-out

### 消失(close)

- `exit`: `scale: 0.95`、`opacity: 0`、duration 150ms
- 元のクリック位置には戻さない(参考サイトと同じ挙動)
- シンプルなフェードアウト+縮小

### フォールバック

- クリック座標が取得できない場合(キーボード操作等): 画面中央から出現(従来と同等)
- `prefers-reduced-motion` 対応: スプリングをスキップし即座に表示

## 実装方針

### クリック座標の受け渡し

各モーダルの `props` に `originPoint?: { x: number; y: number }` を追加。トリガー側で `onClick` イベントから座標を渡す。

### motionTokens.ts への追加

```ts
export const SPRING = {
  // 既存...
  dialog: { type: 'spring', stiffness: 380, damping: 25 },
};
```

### 各モーダルの変更

framer-motion の `initial` を動的に計算:

```ts
const centerX = window.innerWidth / 2;
const centerY = window.innerHeight / 2;

initial={{
  x: originPoint ? originPoint.x - centerX : 0,
  y: originPoint ? originPoint.y - centerY : 0,
  scale: 0.2,
  opacity: 0,
}}
animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
exit={{ scale: 0.95, opacity: 0 }}
transition={{ type: "spring", stiffness: 380, damping: 25 }}
```

### 安全策

- 作業前にコミットを作成し、問題発生時にrevert可能にする
- モバイル時はボトムシート挙動を維持(BoundaryEditModal等)

## パラメータ調整

実装後にブラウザで確認し、stiffness/dampingを微調整する。参考値:

| 設定 | stiffness | damping | 印象 |
|------|-----------|---------|------|
| default(採用) | 380 | 25 | 控えめ、1回オーバーシュート |
| gentle | 300 | 24 | より柔らかい |
| bouncy | 380 | 15 | 2-3回跳ねる(今回不採用) |
