---
paths:
  - "src/components/military/**/*.css"
  - "src/styles/military.css"
  - "src/styles/military/**"
---

# MIL-SPEC の CSS の置き場所(2026-10-28〜)

設計書: `docs/superpowers/specs/2026-10-28-military-css-colocation-design.md`

- **部品の見た目は部品の隣**に、部品と同じ名前の `.css` で置き、その部品の `.tsx` が `import './<部品名>.css';` する(例: `header/ModeLever.tsx` の隣に `header/ModeLever.css`)。部品を消せば一緒に消える。
- 1 部品の CSS が 500 行を超えたら、その部品の中の意味のまとまりで分け、同じフォルダに置く(部品が import する)。
- **共有に置けるのは次の 7 種と `unused/` だけ**(`src/styles/military/`。入口 `src/styles/military.css` は `@import` だけで、起動時に全員分読む):
  - `palette.css` — 色の決まり(`--ms-*` / `--ma-*`)
  - `semantic-tokens.css` — 本番の意味トークン(`--color-*` 等)を MIL-SPEC へ付け替える
  - `standard-revert.css` — ボードの中に描く窓(`.glass-tier3`)を標準の見た目へ掛け戻す
  - `backdrop.css` — 画面全体の背景・走査線・フォント
  - `standard-parts.css` — **標準の部品を `.theme-military` で描き変える規則**(Timeline の行・リキャスト等)。標準の部品の隣には置かない
  - `boot-parts.css` — 起動時から読まれる MIL-SPEC 部品(`src/main.tsx` から静的 import で届く部品)の見た目
  - `primitives.css` — 3 つ以上の MIL-SPEC 部品が使う共通部品(装甲板・基板・押下フィードバック等)
  - `unused/` — JSX/TS に見つからない規則(消さずに集めた。確かめて消すのは別の作業。増やさない)
- **他の部品の見た目を同じ詳細度で上書きしない**。部品の CSS はほぼ遅延読み込みで、後読みの CSS 同士の並びは開いた順で変わるため、上書きは開き方次第で効いたり効かなかったりする。上書きが要るなら上書きされる側の部品の CSS に書く。
- 道具 = `scripts/css-colocation/`(`compare-build.mjs` でビルドの CSS の欠け・重複・順番の入れ替わりを前後比較 / `colocate.mjs --scope=military` は移行済み)。見張り = `src/components/military/__tests__/militaryCssColocation.guard.test.ts`(置き去りの CSS・許可外の共有・部品同士の順番頼り)。CSS を文字で読むテストは `src/styles/__tests__/militaryCssText.ts` 経由で読む。
