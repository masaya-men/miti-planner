# MIL-SPEC SP2 視覚突き合わせ 残差ノート

視覚忠実度プロトコル（プラン §テスト戦略）で詰めきれなかった差分の記録。
Task 10 の masaya 最終レビュー + SP2 後の統一調整に回す。

---

## Task 2 — ワークスペース端末キャップ + ROSTER ノート（zone: `wscap`）

`compare.mjs wscap` = mock `.workspace` / app `.milspec-ws`（cap/note は右端の小片なので
装甲板ごと撮って「表に対する位置・帯幅・文字サイズ・不透明度」を評価）。

### 反復
1. プラン Step 4 のスターター CSS をそのまま適用（cap: transparent→金属→#05070a、opacity 0.5 /
   note: opacity 0.42・text-align right）。probe で cap x=1475/w=14/opacity0.5、note "ROSTER 8 / 8" /
   "FULL PARTY" が DOM 上で描画されるのを確認。
2. mock の実測値（`mock-probe`）に合わせて是正:
   - cap グラデーションを mock 準拠の向きへ（ハード暗線を**左＝表の内容側**に、金属の照りを経て右へフェード）。
     `linear-gradient(90deg, #05070a 0 2px, --ms-raised-lo 3px, --ms-raised 45% 55%, --ms-raised-lo, transparent)`。
   - cap opacity 0.5 → **0.55**（mock 実測 0.55）。
   - note opacity 0.42 → **0.38**（mock 実測 0.38）、`text-align: right` を撤去（mock は `start`＝左寄せ・
     ragged right）、`right: 22px` → `20px`。letter-spacing は 0.14em（mock 実測 0.98px @7px＝0.14em）で一致。
   - light: スクリーンが常時ダークなので raised 白変数だと帯が浮く → 芯を鈍い金属グレー
     `rgba(120,140,158..)` に落とし、外縁ベゼル `#05070a` は残す override を追加。

### 残差（Task 10 / SP2 統一調整へ）
- **構造差（設計上の既知）**: mock は表が固定キャンバス幅で右側に空きマージンがあり、その空きに
  cap（列の終端）と note（空き領域の左上）がプロミネントに載る。実アプリは表（メンバー列）が
  `.milspec-ws-screen` 幅いっぱいに広がるため、`.milspec-ws-cap` は `right:0` = スクリーン右端の
  「端末ベゼル帯」として機能し、`.milspec-ws-note` は右上コーナー（＝ジョブチップ・ヘッダー行の上）に
  重なる。ブリーフ指定どおりの動的幅アダプテーション（固定 left 撤回・right:0 アンカー）。
- **note の可読性**: 上記により note が mock（空きダーク領域の上）より賑やかな領域（ヘッダー/チップ）に
  重なり、7px・opacity 0.38 では実効コントラストが mock 単体クロップより低い。mock 自体も極小テレメトリ
  デカール（`aria-hidden`）として意図的に淡いので「見えすぎない」方向は正しいが、最終位置（ヘッダーを
  避けて下げる / 右端の空きが出る狭幅時だけ出す等）は masaya ゲートで判断。
- **cap 位置**: mock は「列の終端」に立つ帯、実アプリは「表ビューポート右端」に立つ帯。列がビューポートより
  狭いとき（少人数・狭コンテンツ）は右側にダークな空きが出てその右端に cap が立つ ＝ mock の意図
  （空きゾーンを機能的に締める）とは一致するが、帯の絶対位置は列終端に追従しない（CSS のみで
  列終端追従は不可 ＝ Timeline のスクロール内部構造に触れないため）。
