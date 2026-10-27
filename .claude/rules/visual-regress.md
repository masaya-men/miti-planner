---
paths:
  - "src/**/*.tsx"
  - "src/**/*.css"
  - "src/styles/**"
---

# 見た目の回帰テスト(visual-regress)の決まり

道具: `scripts/visual-regress/`(使い方は同フォルダの README.md)。全画面×テーマ×PC/スマホ×言語を前後で撮って画素比較する。

- **見た目の整理(色・余白・窓の部品・CSS の移動)**: 作業の前後で `node scripts/visual-regress/run.mjs` を回し、**仕分け済みの報告**(`verdicts.json` を書いて `--report-only` で作り直した `report.html`)を添えて完了報告する。仕分けは Claude が crops(差の範囲の縮小切り出し)だけを見て行う。全体の PNG は開かない。
- **中身の整理(ロジックの切り分け・store・共同編集)**: 先に「今の動き」を固定する vitest を足してから作り直す。写真は余白・色・はみ出ししか見えない。両方にまたがる変更は両方回す。
- **新しい窓・画面**: `scripts/visual-regress/catalog/` に足す(漏れは Task 9 のカタログ漏れテストが落とす)。ログイン等で撮れないものは `_later.mjs` に理由つきで書く。`data-testid` が要るときは、それだけの独立コミットをリファクタ着手前に入れる。
- **回し方**: 作業の前に `--save-as=<名前>` で基準を保存(約 21 分)、作業中は `--compare=<名前> --only=<キーの一部>` で触った画面だけ、区切りの最後に `--compare=<名前>` で全体 1 回(約 11 分)。`--compare` は作業ツリーをそのまま撮るのでコミット不要。
- 表の位置・動作は `scripts/sticky-scroll/regress.mjs`、横スクロールの同時移動は `frame-sync.mjs` が担当。表に触る変更では併用する。
