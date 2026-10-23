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
