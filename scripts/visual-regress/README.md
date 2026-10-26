# visual-regress(全画面の見た目の自動比較)

設計書: `docs/superpowers/specs/2026-10-26-visual-regression-design.md`

変更の前後(base=比較元コミット / head=作業ツリー)を同じ条件で撮り、画素を比べて、差のあった画面だけの報告ページを作る。比較は画素を数えるだけなのでトークンを使わない。

## 使い方

```
node scripts/visual-regress/run.mjs                       # base=HEAD と作業ツリーを全カタログで A/B
node scripts/visual-regress/run.mjs --only=housing/       # キーに文字を含むものだけ(作業中はこれ)
node scripts/visual-regress/run.mjs --base=<rev>          # 比較元を指定
node scripts/visual-regress/run.mjs --jobs=4              # 並列数(既定 3)
node scripts/visual-regress/run.mjs --name=<名前>         # 出力先 .out/<名前>/(.out 直下 1 階層のみ)
node scripts/visual-regress/run.mjs --save-as=<名前>      # 片側だけ撮って保存(基準づくり)
node scripts/visual-regress/run.mjs --compare=<名前>      # 保存済みの基準と今を比べる
node scripts/visual-regress/run.mjs --inject-css=<file>   # head 側にだけ CSS を注入(検出力の確認用)
node scripts/visual-regress/run.mjs --calibrate           # 許容値の較正
node scripts/visual-regress/run.mjs --report-only=<名前>  # 撮影せず verdicts.json から報告を作り直す
node scripts/visual-regress/run.mjs --list                # カタログの条件一覧
```

- 5181(base)・5182(head)の dev サーバーを自動で起動・停止する。base は OS 一時フォルダの worktree。事前に同ポートを使わないこと。
- 比較は「コミット済み(base)」対「作業ツリー(head)」。**実行中、`src/` に比較対象外の未コミット変更を置かない**。no-op 確認は変更なしで回す。
- 出力: `.out/<名前>/report.html`(差ありのみ)、`.out/<名前>/crops/`(差の範囲の前後切り出し)、`result.json`。`.out/` と `.cache/` は gitignore。

## 終了コード

| コード | 意味 |
|---|---|
| 0 | 全部同じ |
| 1 | 差あり(撮影失敗なし) |
| 2 | 撮影失敗あり(差ありが混ざっても 2。報告にはどちらも載る) |

## Claude の仕分け手順

1. `report.html` / `result.json` の差あり・失敗のキーを確認する。
2. **crops だけ**を見る(`.out/<名前>/crops/`)。全体 PNG は開かない(トークン節約)。
3. `.out/<名前>/verdicts.json` を書く:
   ```json
   { "housing/panel-x__dark__pc__ja": { "verdict": "intended", "reason": "余白を 16px に統一した" } }
   ```
   `verdict` は `intended`(意図した変化)/ `broken`(崩れ)/ `unsure`(要確認)。`reason` は 1 行。
4. `node scripts/visual-regress/run.mjs --report-only=<名前>` で仕分け済みの報告を作り直す(`broken` と `unsure` が上に並ぶ)。masaya にはこの報告だけを見せる。
5. `broken` は直して再実行。意図した変化だけになったら完了報告に報告ページを添える。

## カタログ

`catalog/*.mjs`(site / housing / miti / miti-milspec / miti-mobile)。`_` で始まるファイルは読まれない。

- `catalog/_later.mjs`: 段階 1 では撮らない窓・画面の台帳。`stage: 2` = 見本や手順を足せば撮れる(ログイン必須・Firestore 直読みなど)/ `stage: 3` = 撮影対象外・専用の仕組みが要る。理由は必須。
- 新しい窓・画面を作ったらカタログに足す。撮れないなら `_later.mjs` に理由つきで。

## 限界(既知)

- Firestore 前提のページ(ログイン・管理画面・共有ツアー・ハウジンガーページ等)は撮れない(Firestore と `/api` は遮断し、人工の見本 `fixtures/` を返す)。`_later.mjs` で保留。
- 動き(アニメーション・遷移)は比べない。終点の静止画だけ。動きは vitest や sticky-scroll の道具が担当。
- 本番ビルドでなく dev サーバーの絵。本番ビルドとの差は対象外。
- 全カタログ(365 条件)の一回の実行は約 15 分。作業中は `--only` を使う。
