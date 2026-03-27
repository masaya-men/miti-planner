# 技術ノート

開発中に発生した問題と解決策の記録。同じ問題を繰り返さないために残す。

---

## 1. Lightning CSS が backdrop-filter を削除する問題

### 発生日
- 初回: 2026-03-27（glass-tier系クラス）
- 再発: 2026-03-27（glass-popular系クラス、empty-liquid-glass）

### 症状
- 開発環境（`npm run dev`）ではガラスのぼかしが正常に表示される
- ビルド後（`npm run build`）やVercelデプロイ後にぼかしが消える
- DevToolsで見ると `backdrop-filter` プロパティ自体がCSSに存在しない

### 原因
Tailwind CSS v4 は内部で **Lightning CSS** というツールを使ってCSSを最適化している。
Lightning CSS は `-webkit-backdrop-filter` と `backdrop-filter` の両方が書かれていると、
標準の `backdrop-filter` を「重複」として削除してしまう。

```css
/* ❌ NG: ビルド後に backdrop-filter が消える */
.my-glass {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

### 解決策
`backdrop-filter` を直接書かず、Tailwindが内部で使う `--tw-backdrop-blur` CSS変数を設定する。
こうするとTailwindの仕組みで `-webkit-` 版も標準版も両方正しく出力される。

```css
/* ✅ OK: Tailwind変数パターン — Lightning CSSに削除されない */
.my-glass {
  --tw-backdrop-blur: blur(12px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
}
```

### 確認方法
ビルド後に以下のコマンドで `backdrop-filter` が出力に含まれているか確認する:
```bash
npx vite build && grep -o "backdrop-filter" dist/assets/*.css | wc -l
```
0件なら問題が再発している。

### 対象ファイル
- `src/index.css` — すべてのカスタム `backdrop-filter` 定義

### 注意
**今後 `backdrop-filter: blur(...)` を新しいCSSクラスに追加する場合は、必ずこのTailwind変数パターンを使うこと。直接書くとビルド時に消える。**

---

## 2. conic-gradient回転が要素の縦横比で歪む問題

### 発生日
- 2026-03-27（glass-card-sweep — 零式セクション vs 絶セクション）

### 症状
- 同じCSSクラス（`glass-card-sweep`）なのに、横長の要素と正方形に近い要素で光走りの見え方が全く違う
- 横長の要素: 光が薄い、細い、回転が逆に見える
- 正方形に近い要素: 正常に見える

### 原因
`glass-card-sweep::before` のサイズが `width: 200%; height: 200%` だった。
`%` は親要素の幅・高さに対する比率なので、横長の親要素（例: 1200x400px）では `::before` が 2400x800px の横長楕円になる。
`conic-gradient` は中心から等角度で色が広がるため、楕円上に描くと光点の移動速度・太さ・見かけの方向が歪む。

### 解決策
`::before` のサイズを `200vmax`（ビューポートの大きい辺の200%）に固定し、常に正方形を維持する。
`overflow: hidden`（親の `.glass-card-sweep` に設定済み）で親の外はクリップされるため、表示上の問題はない。

```css
/* ❌ NG: 親の縦横比に依存して歪む */
.glass-card-sweep::before {
  width: 200%; height: 200%;
  margin-top: -100%; margin-left: -100%;
}

/* ✅ OK: 常に正方形 — 光走りが全要素で均一 */
.glass-card-sweep::before {
  width: 200vmax; height: 200vmax;
  margin-top: -100vmax; margin-left: -100vmax;
}
```

### 注意
**conic-gradient で回転アニメーションを作る場合、`::before` のサイズは `%` ではなく `vmax` 等の絶対単位で正方形にすること。**

---
