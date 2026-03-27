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
