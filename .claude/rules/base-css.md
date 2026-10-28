---
paths:
  - "src/index.css"
  - "src/styles/base/**"
  - "src/components/**/*.css"
exclude:
  - "src/components/housing/**"
  - "src/components/military/**"
---

# 標準の CSS の置き場所(2026-10-28〜)

設計書: `docs/superpowers/specs/2026-10-28-index-css-colocation-design.md` / 見張り: `src/styles/__tests__/baseCssColocation.guard.test.ts`

- **標準の部品の見た目は部品の隣**に、部品と同じ名前の `.css` で置き、その部品が `import './<部品名>.css';` する(例: `RecastRow.tsx` の隣に `RecastRow.css`)。
- **共有 `src/styles/base/` に置けるのは** トークン(`tokens-*.css`)・全体に効く規則(`global.css`)・3 部品以上が使う共通部品(`glass.css`・`shared-parts.css`)・`@property`(`properties.css`)・`unused/` だけ。新しい共有は見張りの許可一覧に理由つきで足す。
- **`@layer` の中の規則は、移し先でも同じ `@layer` で包む**(段が変わると勝ち負けが変わる)。
- **入口 `src/index.css` は Tailwind の行・`@import`・`@theme`(と `@theme` が使う keyframes)だけ**。`@import` は `@import "tailwindcss"` の直後(でないと Tailwind が中身を捨てる)。`@theme` は `@import` 先へ移すと Tailwind の規則が消えるので入口に残す。
- **部品の隣の CSS は Tailwind の後処理を通らない**(書き方が変わることがある)。`@apply` を使うなら先頭に `@reference`。`@property` は部品の隣に置くと未対応ブラウザ向けの初期値が消えるので共有へ。
- **他の部品の見た目を、同じ詳細度で上書きしない**(部品の CSS はほぼ遅延読み込み=読み込み順が画面を開いた順で変わり、勝ち負けが不定になる)。上書きされる側の部品の CSS にまとめる。
- 確かめ方: `node scripts/css-colocation/compare-build.mjs --compare=<基準>`(欠け 0 / 重複 0 / 順番の入れ替わり 0)と visual-regress(`.claude/rules/visual-regress.md`)。
