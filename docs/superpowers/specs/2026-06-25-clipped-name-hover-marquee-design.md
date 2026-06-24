# 見切れ攻撃名のホバー・マーキー 設計書

- **日付**: 2026-06-25
- **対象**: タイムラインで見切れている(クリップされた)攻撃名を、ホバー時にマーキー(横スクロール)で読めるようにする
- **元要望**: `docs/superpowers/specs/2026-06-22-event-or-attack-design.md` §5「見切れ名のホバー・マーキー」(2択攻撃で長名が増えるのが動機・全クリップ攻撃名に適用)+ 2026-06-25 ユーザーメモ
- **ブランチ**: `feat/clipped-name-marquee`(main=本番デプロイ済から分岐)
- **位置づけ**: UX 改善のみ。データモデル・型・i18n の変更なし。`EventNameSpan` 1 箇所 + CSS。

---

## 1. 確定した設計判断(brainstorming 2026-06-25・ユーザー承認済)

- **対象 = 見切れている攻撃名だけ**。見切れていない名前は一切何もしない(従来どおり)。
- **行(`group`)ホバー → マーキー**: ホバーした行の見切れ攻撃名が「開始前に一拍 → ゆっくり流れる → 端で一拍 → 戻る」を **1 往復だけ**実行して停止(ループしない)。
- **攻撃名そのもの(セル)ホバー → ツールチップ**: マーキーは止まり、従来どおり吹き出しで全文表示。
- **常にどちらか一方だけ**: セルホバーは行ホバーを上書きする(物理的にセルは行の内側にあるため、両方成立しないよう CSS で排他)。
- **reduced-motion 尊重**: 設定が有効なユーザーには流さない(静止)。名前ホバーの吹き出しで全文を確認できる。
- **適用範囲 = タイムラインの攻撃名(`EventNameSpan`)のみ**。他の見切れテキスト(スキル名等)は今回スコープ外(YAGNI・将来同パターンで横展開可)。

---

## 2. 現状(実コード・grounding 済)

- 描画コンポーネント: `src/components/TimelineRow.tsx` の `EventNameSpan`(`:23-45`)。
  - `name: string` を受け取り、`truncate`(overflow hidden + text-overflow ellipsis + white-space nowrap)で省略表示。
  - **既に** `ResizeObserver` でマウント/リサイズ時に `el.scrollWidth > el.clientWidth` を判定 → `truncated` state(`:25-34`)。#59 の forced reflow 対策でこの形になっている([[reference_perf_forced_reflow_resizeobserver]])。
  - 見切れている時だけ `Tooltip`(`:36`)でフルネームを吹き出し表示。
- 行構造: `TimelineRow` 外側に `group`(行全体・`group-hover:` を `:448` 等で使用)、各イベントスロットに `group/slot`(`:462`/`:517`)。`EventNameSpan` の使用箇所 = 1イベント時 `:478`、2イベント時 `:534`。
- → **`group`(行) と スロット内の名前は CSS で区別可能**。マーキーのトリガー(行)とツールチップ(名前)を別ハンドルにできる。

---

## 3. 機能設計

### 3.1 `EventNameSpan` の DOM 再構成
マーキーには「クリップ窓(固定幅・overflow hidden)」と「その中を動くテキスト」の二層が必要。現在の単層 `<span class="truncate">` を二層化する:

```
Tooltip(content = 見切れ時のみ name)
  └─ <span class="clip">         ← 外側: overflow hidden / white-space nowrap / 固定幅(クリップ窓)
        └─ <span class="text">   ← 内側: テキスト本体。静止時は省略(…)、行ホバー時は展開して translateX
```

- 静止時: 内側 `.text` が省略表示の主体(`max-width:100%` / `overflow:hidden` / `text-overflow:ellipsis` / `white-space:nowrap` / `display:inline-block`)。見た目は現状と同一。
- 行ホバー時(見切れ時のみ): 内側を展開(`max-width:none` / `overflow:visible` / `text-overflow:clip`)し、外側 `.clip` がクリップ窓として効く。内側を `translateX` で流す。

### 3.2 見切れ判定とスライド距離(ResizeObserver・ホバー時に読まない)
既存の `ResizeObserver` を流用し、マウント/リサイズ/`name` 変化時にのみ計測する:

- 見切れ判定: 内側テキストの全幅 > 外側クリップ窓の幅(`textEl.scrollWidth > clipEl.clientWidth`)。
- スライド距離: `distance = textEl.scrollWidth - clipEl.clientWidth`(はみ出しぶん)。
- 結果を要素に反映:
  - 見切れ時 `data-clipped` 属性を付与(CSS のトリガー印)。
  - CSS 変数 `--marquee-distance: -{distance}px` をインラインで設定(keyframes が参照)。
  - 等速にするため、距離に比例した `--marquee-duration` も設定(例: `distance / SPEED_PX_PER_SEC` 秒、下限・上限でクランプ)。
- **`onMouseEnter`/`onMouseMove` で `scrollWidth` を読まない**(#59 の罠)。計測は ResizeObserver コールバック内のみ。

### 3.3 アニメーション(CSS keyframes・translateX・1往復)
`src/index.css` に keyframes を追加(既存 `system-notif-marquee`(`:1582` 付近・運営通知バーの常時ループ型)とは別物。命名は既存 `lopo-*` 系に合わせる):

```css
@keyframes lopo-name-marquee {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(0); }                       /* 開始前に一拍 */
  50%  { transform: translateX(var(--marquee-distance)); } /* 端まで流す */
  65%  { transform: translateX(var(--marquee-distance)); } /* 端で一拍 */
  100% { transform: translateX(0); }                       /* 戻る */
}
```

- トリガー: 行ホバー かつ 見切れ時のみ。例(セレクタは実装時に確定):
  - `.group:hover [data-clipped] .text { animation: lopo-name-marquee var(--marquee-duration) ease-in-out 1; }`
  - 1往復で停止 = `animation-iteration-count: 1`(ループしない)。
- **排他**: セル(名前)ホバー時はマーキーを止めてツールチップに譲る。
  - `[data-clipped]:hover .text { animation: none; }`(セルホバーが行ホバーを上書き)。
- **reduced-motion**: `@media (prefers-reduced-motion: reduce) { .text { animation: none !important; } }`。

### 3.4 ツールチップ(従来維持)
- `Tooltip` は今までどおり「見切れ時のみ」フルネームを表示。トリガーは名前(`.clip`/`.text`)ホバー。
- 行ホバーでマーキー中 → 名前に乗せた瞬間、3.3 の排他でマーキー停止 + ツールチップ表示に切り替わる。

---

## 4. スコープ外
- スキル名・対象バッジなど攻撃名以外の見切れテキストへのマーキー(将来 `EventNameSpan` の構造を共通コンポーネント化して横展開可能)。
- マーキー速度のユーザー設定。

---

## 5. 影響ファイル
| 対象 | 変更 |
|---|---|
| `src/components/TimelineRow.tsx` | `EventNameSpan` を二層 DOM 化 + ResizeObserver で `data-clipped`/`--marquee-distance`/`--marquee-duration` を設定 |
| `src/index.css` | `@keyframes lopo-name-marquee` + トリガー/排他/reduced-motion ルール(既存マーキー `system-notif-marquee` とは別) |

データモデル・型・i18n・他コンポーネントは変更なし。

---

## 6. テスト計画
- ユニット: 見切れ判定 & スライド距離の純関数化が可能なら unit(全幅≤窓→非クリップ / 全幅>窓→クリップ+距離)。難しければ `EventNameSpan` のレンダーテストで `data-clipped` 付与を確認(jsdom は実レイアウトを持たないため、`scrollWidth`/`clientWidth` をモックして検証)。
- 既存テスト回帰ゼロ(`TimelineRow` 周辺)。
- push 前 `npm run build`(Vercel tsc -b 厳密)+ `vitest run`([[feedback_vercel_tsc_strict]])。
- 実機([[feedback_endpoint_user_verification]]・DPR 2.58 の本人画面と一般 1920 両方を意識):
  1. 長い攻撃名を作り、行をなぞって 1 往復マーキー → 停止を確認。
  2. 名前に乗せてマーキー停止 + 吹き出し表示を確認(排他)。
  3. 見切れていない名前は無反応。
  4. OS の reduced-motion ON で静止 + 吹き出しのみ。
  5. 1イベント行 / 2イベント行 の両方。

---

## 7. 完了後
v1 実機確認 → OK で main へ merge + デプロイ。TODO「後追い候補」から本項目を消し込み。
