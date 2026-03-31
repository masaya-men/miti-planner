---
paths:
  - "**/*.css"
  - "src/**/*.tsx"
---

# CSSルール

## backdrop-filter 禁止
`backdrop-filter: blur(...)` を直接書くな。Tailwind v4のLightning CSSがビルド時に削除する。
必ず `--tw-backdrop-blur` 変数パターンを使うこと。

```css
/* NG */
backdrop-filter: blur(12px);

/* OK */
--tw-backdrop-blur: blur(12px);
-webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
```

## conic-gradient 回転要素
`::before` のサイズは `%` ではなく `200vmax` で正方形にすること。`%` は親要素の縦横比で歪む。

## clip-path: path() 禁止
ブラウザ互換性が低い。SVG evenodd方式を使う。
