# Timeline.tsx 切り分け(整頓⑤)設計書

- 日付: 2026-10-27
- ブランチ: milspec-polish(未push)
- 位置づけ: 「整頓完了の定義 5 条件」の ⑤。完了後に列固定(`docs/superpowers/plans/2026-10-23-timeline-sticky-scroll.md`)Task 5 を再開する。

## 1. 意図と理由

`src/components/Timeline.tsx` は 5037 行。うち `Timeline` コンポーネント本体が 701〜5036 行の単一関数(useState 60 / useEffect・useLayoutEffect 38 / useCallback 46 / useMemo 25)。

- 小さな修正でも広範囲を読み直す必要があり、作業の質・速度・トークン使用量を悪化させている。
- 次の列固定 Task 5〜18 はこのファイルのスクロール同期・レイアウト計算・行ループ・見出しを触る。触る範囲を小さなファイルに閉じ込めておきたい。

masaya の言葉: 「見た目やアニメーションや機能などあらゆる部分が変わらず、今後のための整理整頓ができることが理想」。

## 2. ゴール / 非ゴール / アンチゴール

**ゴール**
- Timeline.tsx を役割ごとのファイルへ分割し、Timeline.tsx 本体を「部品を呼んで並べる司令塔」にする。目安 1500 行以下(数字は目安・無理に詰めない)。
- 列固定 Task 5〜18 が触る箇所(スクロール同期・レイアウト計算・見出し・行ループ・帯)が、それぞれ専用ファイルにまとまっている状態。
- 列固定計画 Task 5〜18 の Timeline.tsx 行番号参照を、分割後のファイル:行に付け替える(本作業の最終タスク)。

**非ゴール**
- 見た目・アニメーション・機能・性能の改善。バグを見つけても直さない(台帳に記録だけ)。
- TimelineRow.tsx / MobileTimelineRow.tsx / CSS の中身の変更。
- 列固定そのもの。

**アンチゴール(技術的に動いても失敗とみなす)**
- 画面の見た目が 1 画素でも変わる(visual-regress で差が出る)。
- 表のスクロール位置・同期・寸法が変わる(sticky-scroll regress / frame-sync で差が出る)。
- スクロール・描画が重くなる(TimelineRow の再描画回数が増える、perf A/B で悪化)。
- DOM の構造・クラス名・`data-*` 属性・id が変わる(CSS・テスト・検査スクリプトが依存)。
- 見張りテストを「通すために緩める」(許可リストの付け替えは可、上限を上げるのは不可)。

## 3. 制約(調査で判明した危険要因)

1. **描画中に ref を書く箇所**(現 718, 851, 1732, 1939-41, 2191-93, 2855, 2935, 2951, 2962): 読む側(effect・ハンドラ)より前で書かれる順序を保つ。
2. **effect の実行順**: 同じコミット内の useLayoutEffect / useEffect は宣言順に走る。特に sheetWidth(840)→ 位置合わせ直し(1560・`reanchorMountedRef` で初回スキップ)→ memberStartPx(2911・DOM を直接読む)。フックに移しても **フックの呼び出し順 = 元の宣言順** を保つ。
3. **共有 ref**: scrollContainerRef(38 か所)・timeToYMapRef(11)・sheetContainerRef(12)・readOnlyRef(24)は Timeline 本体で作り、引数で各フックへ渡す。
4. **参照の同一性**: TimelineRow / MobileTimelineRow は `rowPropsEqual` で比較される。stable*(useStableCallback)・damageMap(prevDamageMapRef + reuseEqualDamages)・rowSwapMarkers(reuseEqualArray)・rowLabels・sheetCols・mobileConflictingIds・sorted/visiblePartyMembers の参照を変えない。フックの戻り値はまとめたオブジェクトのまま子へ渡さず、個々の値を渡す。MitigationItem は React.memo(比較関数なし)なので渡すコールバックの参照も同様。
5. **行ループ(現 3535-3667)** は毎描画で Map を組み立てる IIFE。子コンポーネントにしても useMemo を足さない・計算のタイミングを変えない。
6. **render 時に window.innerWidth を読む値**(isMobileTimeline 819 / isMobileView 1312)は state 化しない。
7. **useMemo / useCallback を足しも消しもしない**(性能特性が変わる)。純粋に場所を移すだけ。
8. **ソース検査型の見張りテスト**:
   - `src/styles/__tests__/rawStyleRatchet.test.ts` + `rawStyleAllowlist.json`(Timeline.tsx = [18,0,0])。生色を含む JSX を移した先へ件数を付け替え、合計は増やさない。
   - `src/components/ui/__tests__/ModalShell.guard.test.ts` の LEGACY(`'Timeline.tsx': 'not-window'`)。`fixed inset-0` と `bg-black/` を含むファイルへ移すなら同じ扱いで登録。
   - `src/__tests__/modalBackdropClose.test.ts`: phase/label/event ポップオーバーは backdropClose と一緒に移す。
   - `PartyToggleStrip.test.tsx:53` のコメントが Timeline.tsx の memberLayout に言及(動作依存の注意書き)。移したらコメントの参照先を更新。
9. **公開 API を変えない**: `default Timeline` / `resolveContentId` / `isJoinerReadonly` は Timeline.tsx から引き続き export(移した場合は再 export)。import 元: MitiPlannerPage.tsx・CollabJoinerPage.tsx・Timeline.*.test.tsx・MitigationItem.milspec.test.tsx。

## 4. 分割の形(決定事項)

置き場所: 既存の `src/components/timeline/`。手法は 2 種類だけ。

- **(a) カスタムフック**: 状態+effect+ハンドラの塊を `useXxx(引数)` に移す。共有 ref・他フックの値は引数で受け、必要な値・関数を返す。
- **(b) 子コンポーネント**: return 内の大きな JSX 部分木を props 受けの部品に移す。DOM はそのまま。

切り出す塊(調査で特定したまとまりに対応。細かい境界・名前は計画で確定):

| 塊 | 手法 | 元の行(目安) | 難度 |
|---|---|---|---|
| MitigationItem + getMitigationColorClasses + 型 | 移動 | 135-700 | 低 |
| ダメージ計算(damageMap・競合・rowSwapMarkers・rowLabels・生存/シールド) | (a) | 1042-1063, 2458-2686 | 低 |
| ピクチャーインピクチャー | (a) | 796-804, 1230-1308 | 低 |
| スマホのフェーズ表示・エフェクト棒 | (a) | 1648-1870 | 中 |
| プレビュー強調 | (a) | 862-935 | 低 |
| スプシ表示の状態 | (a) | 752-765, 2190-2258, 2833-2857, 2939-2948 | 中 |
| メモ・共同編集カーソル | (a) | 829-836, 1111-1228, 1484-1527 | 中 |
| モーダル開閉+編集ハンドラ(密着のため 1 つ) | (a) | 806-1000, 1950-2457 | 高 |
| キーボード・ウィンドウイベント | (a) 種類ごと | 1096-1110, 1322-1398, 2691-2812 ほか | 中 |
| 列・レイアウト計算 | (a) | 819-860, 977-1029, 1887-1944, 2814-2969 | 高 |
| スクロールと横同期 | (a) | 1033-1040, 1450-1647 | 高 |
| 操作バー(MIL-SPEC デッキ含む) | (b) | 3040-3336 | 中 |
| 見出し行 | (b) | 3337-3469 | 中 |
| 行ループ | (b) | 3535-3667 | 高 |
| 帯(ホバー・フェーズ・ラベル・TL 選択) | (b) | 3668-3783 | 中 |
| PC の軽減アイコン・エフェクト棒のループ | (b) | 3784-4087 | 中 |
| 下部のバー・モーダル群 | (b) 数個に | 4138-4625 | 中 |
| スマホの軽減一覧シート・ツールシート | (b) | 4268-4540, 4626-4716 | 中 |
| phase/label/event ポップオーバー | (b) | 4717-4918 | 中 |
| AA バー・TL 選択バー・PiP | (b) | 4919-5036 | 低 |

**順番**: 難度の低い独立した塊から始め、高い塊(モーダル+編集・レイアウト・スクロール・行ループ)は後半。高い塊ほど小さく刻む。

**残すもの**: ストア購読・共通 ref の生成・フックの呼び出し(元の順序)・部品の配置。

### 4.1 順序の規則(Claude 判断)

- 順序を保つ対象は **effect(種類ごと: useLayoutEffect 同士・useEffect 同士)の相対順** と **描画中の ref 書き込み・DOM 読み取りの相対順** だけ。useState / useMemo / useCallback / useRef の宣言は、依存する値より後にある限り、場所を動かしてよい(フック呼び出し順の変化は、各フックが毎回同じ順で呼ばれる限り挙動に影響しない)。
- 飛び地の塊をまとめると上の相対順が崩れる場合は、**フックを複数に割って元の順序を保つ**(例: レイアウト計算を「前半」「後半」の 2 フックに分ける)。順序変更を「検証で見る」方式は取らない。
- 共有 ref は Timeline 本体で作って引数で渡す。描画中の書き込みは、その値を計算するフックの中に置き、そのフックを読む側のフックより先に呼ぶ。effect・ハンドラ内での読み取りは描画後なので、書き込みが同じ描画中のどこかで済んでいれば順序の制約はない。
- 塊ごとに計画へ「移す effect・描画中書き込みの一覧(元の行)」を書き、移動後に順序が保たれているかを差分レビューで確認する。

### 4.2 見張りテストの扱い(Claude 判断)

- rawStyleAllowlist.json: Timeline.tsx の件数を移した先のファイルへ新設・付け替えするのは可。**全ファイル合計が増えないこと**が条件。
- 見張りテストの**追加**は可(非ゴールではない)。MitigationItem には再描画回数の見張りが無いので、その塊を触る前に `TimelineRow.renderCount.test.tsx` と同じ方式で追加する。
- 外部から Timeline.tsx を import しているのは default / resolveContentId / isJoinerReadonly だけ。`vi.mock('…/Timeline')` は無い(10-27 grep で確認)。

## 5. 検証(機械が判定する)

**作業前に 1 回(基準づくり)**
- visual-regress: 既存基準 `dpr2` をそのまま使う(10-27 に 323 件一致を確認済)。着手時に `--compare=dpr2` で一致を再確認してから始める。
- sticky-scroll: `regress.mjs --out=split-base` / `shots.mjs --out=split-base`(作業前の HEAD で撮る)。
- perf: 列固定計画の Ruling P14(変更前後を同じ時間帯に交互に測る A/B)。

**1 つ切り出すごと**
- `npx tsc -b` が 0。
- 対象を絞った vitest: `src/components/__tests__/Timeline*` ・ `TimelineRow.renderCount` ・ `MitigationItem.milspec` ・ `PartyToggleStrip` ・ 見張り 3 本(rawStyleRatchet / ModalShell.guard / modalBackdropClose)。
- 1 塊 = 1 コミット。

**区切りごと(数塊ごと・計画で区切りを定義)**
- `visual-regress --compare=dpr2 --only=<表のある画面>` で一致。
- `sticky-scroll regress --compare=split-base` と `shots --compare=split-base` で差 0。

**最後(push 前ゲート)**
- `npm run build` 0 / `npm run test:gate` 全通過。
- `visual-regress --compare=dpr2` 全 323 件一致。
- sticky-scroll regress / shots / frame-sync で差 0。
- perf A/B(P14): スクロールの p95・ブロック時間が誤差範囲内。最後に加えて、高難度の塊(列・レイアウト計算/スクロール/行ループ)を終えた区切りでも 1 回測る(Claude 判断)。
- 目標 1500 行は目安。全塊を切り出して届かなくても、追加で切ることはしない。
- 敵対レビュー(fresh context): 「挙動が変わった箇所」だけを探させる。

差が出たら、その塊を戻して原因を特定してから再挑戦(同じ塊で 2 回失敗したら止めて相談)。

## 6. 最終タスク: 列固定計画の参照付け替え

分割後、列固定計画 Task 5〜18 と台帳(`.superpowers/sdd/2026-10-23-timeline-sticky-scroll/progress.md`)の Timeline.tsx 行参照を、新しいファイル:行に書き換える。計画の中身(手順・判定)は変えない。

## 7. 実装者に任せること

- 各塊の正確な境界・ファイル名・フック名・props 名。
- 区切り(どの塊の後で visual-regress / sticky-scroll を回すか)。
- 下部モーダル群の分け方の粒度。
- 判断に迷ったら「挙動が変わらない方」「差分が小さい方」を選ぶ。
