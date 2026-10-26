# 軽減表の回帰の自動確認(regress.mjs)

軽減表の横スクロール計画(設計書 `docs/superpowers/specs/2026-10-23-timeline-sticky-scroll-design.md` §4 の [自] 項目)を、変更の前後で機械的に比べる道具。アプリのコードは変えない。dev サーバー(既定 `http://localhost:5173`、`REGRESS_BASE_URL` で変更)に Playwright でつなぐ。

## 使い方
- 取る: `node scripts/sticky-scroll/regress.mjs --out=baseline`(全体で約 8〜12 分。結果は `.baseline/regress-<out>.json`・git に入れない)
- 比べる: `node scripts/sticky-scroll/regress.mjs --out=after --compare=baseline`(意図しない差があれば exit 1。許容は位置・寸法 0.5px、`precise` 配下(sheetWidth の実測など)は 0.01px。baseline が無いと exit 1)
- 絞る: `--only=standard`(条件 id に含まれる文字で絞る。`standard` / `military` / `1489` / `sheet` など)・`--probe=place,memo`(動作の確認だけ)・`--geom-only` / `--beh-only`・`--jobs=N`(同時に動かす数。既定 3)・`--list`(条件の一覧)
- 意図した変化を許す: `--allow=<項目>`(カンマ区切り・結果のパス(`条件id/項目/キー…`)に含まれる文字で一致)。例: `--allow=geomScrolled`(横に動かした状態=固定列にするので変わる)、`--allow=probe.hover/laneSide`。**使ったら報告書に理由を書く**。許容で見逃した差は「見逃した差分」として一覧に出る
- 終了コード: 0=成功(比較時は差 0)・1=意図しない差 or baseline が無い・2=確認の途中で失敗した項目がある(結果ファイルには `{error}` で残る)

## 条件(画面の呼び名: 本人=1489×679/DSR2.58・多数派=1920×1080/DSR2・大画面=2560×1440/DSR1・スマホ=390×844/DSR3)
- **幾何(`geom` / `geomScrolledMid` / `geomScrolledMax` / `geomExpanded`)は全 48 条件**: 画面 3 × テーマ 4(`standard-dark` `standard-light` `military-dark` `military-light`)× 表示 2(`lanes`=ふつう / `sheet`=スプシ)× 人数 2(`8p`=8 人・`4p`=「表示メンバー」で MT・H1・D1・D3 の 4 人だけ見せる=ふつう表示は横スクロールなし。スプシ表示は列が広いので 4 人でも横に長い)。条件 id 例 `1489-military-dark-sheet-8p`。
  注: 表の横幅は `--container-max: 1489px` で頭打ち。1920・2560 は表が画面の中央に寄って縦が伸びるだけで、スクロール入れ物の幅(1188px)は 1489 と同じ(位置の左端と高さが違う)
- **動作の確認(`probe.*`)は代表条件だけ**(組み合わせが多すぎるため。設計書の B 番号ごとに下記に決めた。`--list` でも見える):

| 確認(`probe.<名前>`) | 条件(画面-テーマ-表示-人数) |
|---|---|
| place・hover | 1489-standard-dark-lanes / 1489-standard-dark-sheet / 1489-military-dark-lanes / 1489-military-dark-sheet / 1920-standard-light-lanes(すべて 8p) |
| drag(+conflict) | 1489-standard-dark-lanes / 1489-standard-dark-sheet / 1489-military-dark-lanes |
| memo(+memoLimit) | 1489-standard-dark-lanes / 1489-standard-dark-sheet / 1489-military-dark-sheet / 1920-standard-light-lanes |
| cursor | 1489-standard-dark-lanes / 1489-standard-dark-sheet / 1920-standard-light-lanes |
| select・rows・view | 1489-standard-dark-lanes / 1489-military-dark-lanes(select・rows・view とも) |
| misc | 1489-standard-dark-lanes / 1489-standard-dark-sheet |
| milspec・print | 1489-military-dark-lanes / 1489-military-dark-sheet |
| mobile | `mobile-390-<テーマ 4 種>`(ふつう表示のみ) |

JSON の形: `conds.<条件id>.items.<項目>`。位置は `[left, top, width, height]`(画面基準の px・3 桁丸め)。`rows.<秒>` は行が複数に分かれても比べられるよう外接矩形と、各セルの矩形(`phase` `label` `time` `mechanic` `counters` `jobCols`)。軽減アイコンなど順番が変わりうるものは位置でソートして記録。

## 設計書 §4 [自] 項目 → JSON のキー(`conds.<条件id>.items.` の下)
| 項目 | キー |
|---|---|
| A1 固定列のずれ(横に動かした位置) | `geomScrolledMid` / `geomScrolledMax`(`header` `rows` `icons` `memos` `cursors`)。固定化後は意図して変わる=`--allow=geomScrolled` |
| B1.1 置く(ふつう) | `probe.place`(`selector` `afterPlaceDelta` `placed`) |
| B1.2 スプシで押して置く・もう 1 回で消す | `probe.place`(`cellRect` `afterTap1` `afterPlaceDelta` `afterTap2Delta` `popover`) |
| B1.3 縦ドラッグ・端の自動スクロール | `probe.drag`(`afterValidDrag` `autoScroll`) |
| B1.4 置けない所へ落とすと戻り通知 | `probe.drag`(`invalidTimeBefore/After` `invalidToast` `invalidIconBackRect`) |
| B1.5 競合の輪・画面外の矢印・押して飛ぶ | `probe.conflict`(`ring` `ringRects` `arrows` `afterClickScrollTop` `arrowsAfter`) |
| B1.6 右クリック削除・取り消し・やり直し | `probe.place`(`afterRightClickDelta` `afterUndoDelta` `afterRedoDelta`) |
| B2.1 メモ作成の xRatio | `probe.memo.created`(クリック位置と保存された `timeSec` `xRatio`) |
| B2.2 情報列の上は作らない(横に動かしても) | `probe.memo`(`infoClickCreatesInput` `scrolledInfoClickCreatesInput` `scrolledMemoCountDelta`) |
| B2.3 既存メモの表示位置 | `geom.memos`(+ `geomScrolled*.memos`) |
| B2.4 メモのドラッグ・編集・右クリック削除 | `probe.memo`(`afterDrag` `memoRectAfterDrag` `editInput` `afterRightClickDelta`) |
| B2.5 メモ上限の通知 | `probe.memoLimit` |
| B3.1 自分のカーソル送信値 | `probe.cursor`(`sentLane` `sentTimeCol` `sentMechanicCol` `scrolledSent*`) |
| B3.2 相手のカーソル表示位置 | `geom.cursors`(+ `geomScrolled*.cursors`) |
| B3.3 表示モード違いの相手 | `probe.cursor`(`remoteDrawnWhenPeerViewDiffers` `rosterHasViewField`)。現状のコードは view を見ないので描く(基準として記録) |
| B3.4 カーソル OFF | `probe.cursor.sentCountAfterOff` |
| B4.1 行のホバー(背景・下線・太字・「+」) | `probe.hover`(`none` `infoSide` `counterSide` `laneSide` の `rowCss` `rowAfter` `timeCss` `plusCss` `jobCss` `rowHoverMatches`) |
| B4.2 ホバー強調・固定列の上では出さない | `probe.hover`(`laneSideHl` `hlOverInfo` と各 `hl`) |
| B4.3 スプシの列ツールチップ | `probe.hover`(`colTooltipOverLane` `colTooltipOverInfo`・スプシのみ。MIL-SPEC では null) |
| B4.4 フェーズを表から選ぶモード | `probe.select`(`hoverInfo` `hoverLane` `afterClick` ほか) |
| B4.5 進捗の記録モード | `probe.hover`(`recordModeLaneHover` `recordModeInfoHover` `clickLaneRecordedPoints` `clickInfoRecordedPoints` `mitsDelta` `selectorOpenedInRecordMode`) |
| B5.1 空の行を隠す切替で中央の時刻が残る | `probe.rows`(`beforeExpand` `afterExpand` `afterCollapseBack` `rowCountExpanded`) |
| B5.2 ジャンプ(進捗の時刻へ・プラン切替で先頭へ) | `probe.rows`(`afterJumpTo300` `afterPlanSwitch`)。「攻撃の保存後のジャンプ」は未検証(モーダル経路が深い) |
| B5.3 リキャスト行 | `probe.rows`(`recastTop` `recastScrolled250`) |
| B5.4 フェーズ列・ラベル列の折りたたみ | `probe.rows`(`infoInitial` `infoPhaseCollapsed` `infoBothCollapsed` `infoRestored`) |
| B5.5 戦闘前(-10 秒) | `geomExpanded.preStartRowExists`(切替の UI は無く常に表示) |
| B6.1 表の展開(約 1500 行) | `geomExpanded`(`rowCount` `sheet` `scroller`)・`probe.rows.rowCountExpanded` |
| B6.2 スプシ表示の切替 | `probe.view`(`afterToggleView` `afterToggleBack`)。「列を隠す・罫線の別設定」は未検証 |
| B6.3 パーティの表示/非表示 | `probe.view`(`afterHideD4` `afterHideD3D4` `afterShowBack`) |
| B7.5 MIL-SPEC の照準 | `probe.milspec`(`overIcon` `overMechanic` `overHeader` `overIconScrolledMax`) |
| B7.7 行の描き込みの動き | `probe.print`(動きを減らす設定を切った別ページ) |
| B8.1 スマホの DOM の骨組み | `mobile.skeletonSha256`(style 属性を除いた DOM の SHA-256)・`elementCount` `tagCount` `firstRows` `scroller` `header` |
| B9.1 チュートリアルの目印 3 つ | `geomExpanded.tutorial`(`add-event-btn` `tutorial-damage-cell-4-aoe` `miti-cell-mt-4` の rect) |
| B9.2 横に短いとき(4 人) | `geom.scroller`(`scrollWidth`=`clientWidth`・`4p` のふつう表示。`geomScrolled*` が無い) |
| B9.3 横に長いとき(8 人・1489) | `geom.scroller`(`scrollWidth`>`clientWidth`)・`geomScrolledMax` |
| B9.4 サイドバーの開閉 | `probe.misc`(`sidebarOpen` `sidebarClosed` `sidebarReopened`) |
| B9.5 文字の拡大(`--text-scale-multiplier` 1.3) | `probe.misc.textScale13` |
| B9.6 閲覧専用 | `probe.misc`(`readOnly*`) |
| B9.7 キーボードで表の中へ移ったとき | `probe.misc`(`focusRightmostFromLeft` `focusRightmostAfter` `focusLeftmostFromRight` `focusLeftmostAfter`=アイコンへフォーカスしたときの scrollLeft と位置) |
| 計画共通の実測 | `geom.sheet.offsetWidth` / `geom.scroller.{scrollWidth,clientWidth}` / `geom.precise`(sheetWidth 相当の 0.01px 精度の実測) / `geom.rowCount`([data-time-row] の数) |

## 注意
- 動作の確認の一部(カーソル送信・閲覧専用・記録モード・プラン切替)は dev の store を直接読む(dev 専用)。本番ビルドでは動かない。
- 「スマホ」「MIL-SPEC の行の描き込み」以外は動きを減らす設定(reduced motion)で取る。ホバーの変化はアニメーションが終わるまで待ってから記録する。
- 固定化(Task 11 以降)で `[data-time-row]` が 2 つに分かれても、行は外接矩形で記録するので位置は比べられる。数そのもの(`rowCount`)は意図して変わる=`--allow=rowCount`。

# 画面写真(shots.mjs)

変更の前後で同じ画面を撮って比べる道具(設計書 §4 の [写] 項目・§10 段階 0-2)。アプリのコードは変えない。接続先は regress.mjs と同じ(`REGRESS_BASE_URL`、既定 `http://localhost:5173`)。

## 使い方
- 撮る: `node scripts/sticky-scroll/shots.mjs --out=baseline`(約 8〜9 分。`tolerance.json` が無いときだけ、同じ画面を 3 回撮って許容を決める。`--calibrate` で撮り直し)
- 比べる: `node scripts/sticky-scroll/shots.mjs --out=after --compare=baseline`(約 3 分。許容外があれば exit 1・撮影に失敗した条件があれば exit 2)
- 絞る: `--only=<条件 id に含まれる文字>`・`--jobs=N`(既定 3)・`--list`。`--only` で許容を撮り直したときは、撮っていない写真の許容を残して混ぜ込む
- 安全策: `--out` と `--compare` が同じ名前なら止める(比べる元が消えるため)・比べた写真が 0 枚なら exit 1
- 検出力の確認(使い捨て): `--inject-css=<file>` で撮影時に CSS を足す(例 `#timeline-header-inner{transform:translateX(3px)}`)。比べて exit 1 になるかを見る。普段は使わない
- 結果: `.baseline/shots/<out>/<条件id>/<写真名>.png`・許容 `.baseline/tolerance.json`(どちらも git に入れない)

## 撮るもの(合計 196 枚 / 36 条件)
- デスクトップ 8 人 24 条件(画面 1489・1920・2560 × テーマ 4 × ふつう/スプシ、横スクロール 0): `page`(画面全体)・`top`(ボタンの欄+見出しの帯)・`scrollbar`(表の入れ物の下端 80px)
- 1489・1920 の 16 条件だけ追加: `hover-info` `hover-lane`(0:15 の行に乗せた状態・B4.1)・`expanded`(表の展開・B6)・`myjob`(MYジョブ強調・B4.6)・`conflict`(競合の赤い輪・B1.5。画面外の矢印は 1489 だけ出る=1920 以上では 465 秒の行も画面内)・`record`(進捗の記録モードでレーンに乗せた青い枠・B4.5)
- 2560 の 4 人(横に短い・B9.2)8 条件: `page` `top` `scrollbar`
- スマホ 390×844(DSR3)× テーマ 4(B8): `page`
- 撮る前に動きを止める: reduced motion・transition 無効・有限のアニメは終点へ・無限のものは 0 で停止・video は 0 秒で停止。MIL-SPEC 見出しの実時刻の表示(`.milspec-drums` `.milspec-dtg-txt`)は毎回変わるので隠す。
- B1.7 並べ替えの横すべり(MIL-SPEC `slideOnSort`)は動きなので撮らない=**[目](ユーザーの実機確認)で確かめる**。

## 許容の決め方
- 差は 8×8 画素のブロックごとの平均色差(RGB の最大差)が 6 を超えたブロックの数 / 全ブロック数。MIL-SPEC の面には毎回ちがう粒状ノイズがあり、画素ごとに数えると同じ画面でも約 0.4% 違うため、粒を均すブロック方式にした。
- 許容 = 同じ画面を 3 回撮った 3 通りの差の最大値 × 1.5。ただし下限は全ブロックの 0.05% かつ 10 ブロック。写真ごとの値と既定値(`defaultTolRatio`・未登録の写真用)を `tolerance.json` に持つ。2 回撮りだと許容がぎりぎりで偽の差が出たので 3 回にした。
- 実際の値(今回): 既定 2.01%・ふつうテーマの最大 0.75%・1489 の MIL-SPEC ダークの `page` は 0.08%・2560 の `top`(小さい切り出し)が最大 2.01%。大半は下限(0.05% / 10 ブロック)。

## notes(撮った写真を見て書いた。推測は「候補」)
- ボタンの欄の背景(設計書 §12): 動画は画面全体の背景(`.milspec-backdrop` の `video` 1 本、位置 0,0 から画面いっぱい)で、ボタンの欄の外枠自身には背景が無い(computed `background-image: none`)。写真では欄の中は装甲の金属面とジャック基板の地で埋まって動画は透けていない=「欄の後ろは無地(装甲の面)」が写真からの見立て(候補。窓にした理由の確認は固定化後の写真と合わせて)。
- 横バーが「浮いて見える」理由(§8.3): headless の Chromium は `::-webkit-scrollbar` を描かないため、この道具の写真には横バーが写らない(`scrollbar.png` の下端にバーは無い)。理由は写真からは確認できていない=実機のスクショが要る。§8.3 の候補(別部品として置かれている・目盛りが細かく明るい・下の縁との二重の段差)は未確認のまま。
- 比較の注意: 写真は dev サーバーの描画なので、サーバーを起動し直した直後は初回のビルドで読み込みが遅く、撮り直しが要ることがある(撮影失敗は exit 2)。

# 同時移動の検出(frame-sync.mjs)

横スクロール中に見出し(ボタンの欄のジョブ選択の行・見出しのリキャスト欄)が本文から 1 拍遅れていないかを測る道具(設計書 §5.3・§10 段階 0-3)。アプリのコードは変えない。接続先は regress.mjs と同じ(`REGRESS_BASE_URL`)。

## 使い方
- 測る: `node scripts/sticky-scroll/frame-sync.mjs --mode=all`(wheel / thumb / key の 3 通り。約 1 分半)。コマ数・ずれたコマ数・最大ずれ(px)を 3 通り別と合計で出す。結果は `.baseline/frame-sync-<out>.json`(`--out=名前`)
- 検出の確認(今のコード): ずれたコマ ≥1 が出れば道具は正しい。`--expect-zero` を付けるとずれたコマが 1 つでもあれば exit 1(固定化後の合格判定用)。測定が成立しなければ exit 2
- ブラウザ: 既定 `--browser=chromium`(CDP `Page.startScreencast` で全コマを取り、画素から目印の x を読む)。`--browser=webkit|firefox` は screencast が無いので rAF の二点サンプリング(同じコマで見出し側と本文側の `getBoundingClientRect().left` の差)。コンポジタ側だけで進むスクロール(つまみ・矢印キー)の遅れは rAF では見えない=「ずれなし」は弱い証拠
- 目印: 試験用 CSS(`page.addStyleTag`)で見出し側に洋紅・本文のメンバー列に水色の 3px の縁(outline)を付ける。DOM が変わったら `--selector-header=` `--selector-header2=`(`none` で無効)`--selector-body=` で差し替える
- 他: `--vp=1489|1920|2560` `--theme=…` `--view=lanes|sheet` `--party=8|4`(横に動かせる 8 人・1489 が既定)`--method=raf` `--keep-frames`(コマを `.baseline/frame-sync-frames/` に保存)
- thumb(つまみのドラッグ): headless の Chromium は既定で `--hide-scrollbars` が付くので、この道具は起動時に外している(つまみが描かれる)。Firefox の headless はバーが描かれず「未対応」と出る
- 終了コード: 0=成功 / 1=`--expect-zero` でずれたコマあり / 2=測定が成立していない(1 つも測れていない・失敗か「測定不成立」のモードがある・`--expect-zero` のとき未対応のモードがある)。環境で使えないモード(Firefox の thumb など)は `--allow-unsupported=thumb`(カンマ区切り)で許せる(未対応のものだけに効く。失敗・測定不成立は許せない)
- 測定不成立: 読めなかったコマ(目印の左右の縁が両方見えない・間隔が DOM の実測と合わない=左端が切れたコマ)が全体の 20% を超える、または動いている間の有効なコマが 10 枚未満。出力に読めなかったコマの数と割合を出す
- 目印の要素は 1 つずつ(最初に見つかったもの)。見出し側は `--selector-header=` と `--selector-header2=`、本文は `--selector-body=`、動かす入れ物は `--selector-scroll=`(既定 `.timeline-scroll-container`)で差し替える。**見出しの構造が変わったら(Task 10 以降)、リキャスト欄が無くなる等で `--selector-header2` の既定が見つからなくなる。使わない帯は `--selector-header2=none` を明示する**
- 自己検証: `--self-test` は見出し側の目印も本文と同じ入れ物の中(本文の別の行の同じ列)に付ける。2 つは必ず一緒に動くので、ずれたコマ 0 と出れば道具の読み取りに偽のずれが無い。ずれを検出できる(今のコードで「ずれあり」)ことと対で確認する
- しきい値は `--thresh=`(既定 0.5px。合否を動かすためには使わない)・`--mode-timeout=`(1 通りの上限 ms。既定 120000)

## 性能の基準(perf-baseline.mjs・run-measurements-wrap.mjs)
設計書 §9・§10 段階 0-4。測定本体は `scripts/milspec-polish/scroll-perf.mjs`(引数 `--axis=x|y` `--dsr` `--view=lanes|sheet` `--dataset=synthetic|normal|heavy` `--mode=raf|wheel` `--runs` `--trace` `--out-dir` を追加。既定は従来どおり)。必ず**本番ビルド**で測る(MIL-SPEC を含めるには `.superpowers/sdd/2026-10-23-timeline-sticky-scroll/wip-build-recipe.md` の WIP 開放ビルド)。結果の置き場は `scripts/sticky-scroll/.baseline/perf/`(git に入れない)。
- 24 条件(縦/横 × `standard`/`military` × `lanes`/`sheet` × `synthetic`/`normal`/`heavy`)を取る: `SP2_BASE_URL=http://localhost:4184 node scripts/sticky-scroll/perf-baseline.mjs --save --trace`(約 30〜40 分)。名前は `baseline-<axis>-<theme>-<view>-<dataset>`(例 `baseline-x-military-sheet-heavy`)。`--only=<文字>` で絞る・`--list` で一覧。
- 変更後に比べる: `... perf-baseline.mjs --compare`(p95 または総ブロック時間が 10% 超悪化=exit 1、条件違い=exit 2)。別名で残すなら `--save --prefix=after-x`。
- 本物のホイール(横は Shift)での 1 本: `node scripts/milspec-polish/scroll-perf.mjs --axis=x --dsr=2.58 --mode=wheel --out-dir=scripts/sticky-scroll/.baseline/perf --save=baseline-wheel-x-...`
- 置く・消す(押してから描くまで): `SP2_BASE_URL=... node scripts/sticky-scroll/run-measurements-wrap.mjs --name=baseline-standard [--theme=military]` → `.baseline/perf/run-measurements-<name>.json`。親リポジトリの `run-measurements.cjs` は書き換えず、メモリ上で出力先・向き先・条件を差し替えて実行する。
- Layerize / Commit の時間は `--trace` で各 JSON の `trace` に記録(通常の 5 回の後の追加 1 回・合否には使わない)。

### 性能計測の安定化の手順と判定の規則(Fix round 1)
- 横スクロールの速度は動ける距離(scrollWidth-clientWidth)に比例させ、1 往復 = 2 秒に固定(短い表でもコマ数を稼ぐ)。縦は従来の一定速度。
- 計測の前に同じスクロールを 1 秒空走(結果は捨てる)→ CDP `HeapProfiler.collectGarbage` を 1 回 → 計測。
- 測れたコマ数が `--min-frames`(横の既定 100。縦は重さ自体が測定対象なので既定 0=確かめない)未満の回は「止まった回」として捨てて測り直す(上限超えで「測定不成立」exit 3)。`perf-baseline.mjs` は横を 40 にしている(スプシ表示の横は CPU 4 倍で 3 秒に 100 コマ出せない条件があるため)。
- 外れ値: p95 が中央値の 3 倍を超えた回は捨てて、その回だけ測り直す(上限 `--max-discard` 既定 3)。捨てた数は出力の `discarded=` と JSON に出る。
- `perf-baseline.mjs` は runs 既定 9(`scroll-perf.mjs` 単体の既定は 5)。ホイール基準 2 本(`baseline-wheel-{x,y}-standard-lanes-normal`)も含めて 26 件。
- 判定(`--compare`): p95 は「2 コマ(33.4ms)以上」かつ 10% 超の悪化、ブロック時間は「100ms 以上」かつ 10% 超の悪化のときだけ悪化(exit 1)。条件違い・基準なしは exit 2(再試行しない)、想定外の例外は exit 3(perf-baseline が 1 回だけやり直す)。
- heavy の前提: 「空の行を隠す」を OFF にする操作は `#timeline-controls-inner` の**最初のボタン**を押すことに依存し、`MIN_ROWS`(heavy は 1000 行以上)で成立を確かめる。UI でそのボタンの位置・意味が変わったら heavy は不成立になる(その時は `scroll-perf.mjs` の該当箇所を直す)。
