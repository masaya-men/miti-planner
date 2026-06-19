# 進捗トラッキングHUD イテレーション2 設計書（記録トースト + 記録ドロワー + バグ2件）

- 日付: 2026-06-19
- ブランチ: `feat/progress-tracking-hud`（Plan1 + イテレーション1 = commit b3d94d4 の続き）
- 前提: Plan1 設計=`docs/superpowers/specs/2026-06-18-progress-tracking-hud-design.md` / ブレストノート=`docs/.private/2026-06-18-progress-hud-iteration2.md`
- ledger: `.git/sdd/progress.md`

## 背景

Plan1 + イテレーション1 をユーザー実機検証した結果、4項目の改善要望が出た。本書はその設計を確定する。
ビジュアル演出（トースト・ドロワー）はブラウザ visual companion でモックアップを動かして合意済み（モック=`.superpowers/brainstorm/4302-1781796445/content/` の `toast-combo-v4.html` / `drawer-v7.html`）。

## スコープ

- **対象 = PC（デスクトップ）**。スマホでの記録ドロワー化は既存 TODO「スマホ最適化」タスクに回す。本イテレーションはモバイルを**壊さない**ことだけ担保する（既存ボトムシート経路を維持／回帰なし）。
- **対象外**: Plan2（collab リアルタイム同期）、スマホ記録UXの作り込み。

## 不変制約（Plan1 から継続・厳守）

1. **軌跡 canvas / お祝い演出は試作 `4c0b94b` の 1:1 移植を保持**（PulseTrail/ProgressCelebration の canvas 定数・描画ロジックは変更しない）。[[feedback_keep_liked_prototype_visuals]]
2. **`progress` は空が正常** → 空上書きガード（isEmptyPlanData/RESEED_FIELDS）に含めない。
3. **store アクションはローカル set のみ**＋純粋閲覧者（collab readonly viewer）はブロック。collab 同期は Plan2。
4. **データ消失リスクのある経路を増やさない**（誤記録 undo は points 配列からの単純 splice のみ）。

---

## A.（バグ）記録モードのハイライトがフェーズ列/ラベル列で切れる

### 現象
記録モード中、行ホバーの青ハイライト（2px枠+bg10%）が、フェーズ列とラベル列の部分だけ表示されない（途切れる）。

### 根本原因（確定）
- ハイライトは行自身の CSS: [index.css:1351](../../src/index.css#L1351) `.timeline-scroll-container[data-record-mode="1"] [data-time-row]:hover { box-shadow inset 2px + bg-app-blue/10 }`。
- フェーズ列・ラベル列は**行とは別の絶対配置オーバーレイ**で、行の**上**に不透明 `bg-app-surface2 z-10` で重なる：[Timeline.tsx:3036](../../src/components/Timeline.tsx#L3036)（フェーズ区間）/ [Timeline.tsx:3087](../../src/components/Timeline.tsx#L3087)（ラベル区間）。
- → 行の box-shadow/bg がこれらオーバーレイに隠れ、その列だけ青枠が消える。

### 修正方針
- 記録モード中（`.timeline-scroll-container[data-record-mode="1"]`）だけ、フェーズ/ラベル区間オーバーレイの背景を**透過**させる CSS を追加し、下の行ハイライトを透かす。
  - 例: `[data-record-mode="1"] [data-phase-overlay], [data-record-mode="1"] [data-label-overlay] { background: transparent; }`（フェーズ/ラベルのオーバーレイに識別用 `data-*` 属性を付与する。フェーズ名テキストは残すが背景塗りだけ消す）。
  - 文字（フェーズ名）が読めなくなる懸念があれば、背景は完全透過でなく `rgba` を薄める。実機で確認。
- **共有 DOM/CSS のため、記録モード以外（通常表示・select-mode）の見た目が変わらないことを実機総点検**（[[feedback_structural_refactor_runtime_audit]]）。記録モード限定セレクタなので通常時は不変のはずだが、目視で確認する。

---

## B.（新規）記録トースト

記録（到達点クリック）した瞬間、グラフ帯の中央にメッセージを重ねて表示する。光の玉は後ろを通り続ける。クリア時は対象外（既存 ProgressCelebration が担う）。

### B-1. 比較ロジック・データ
- 記録は `useMitigationStore.recordReachedPoint(sec)`（既存）で `progress.points` に1点追加。
- トーストの**種別**:
  - 記録する `reachedPos` が、**記録前の最高 reachedPos（prevMax）より大きい** → `kind = 'update'`（最高到達点を更新）
  - そうでない → `kind = 'nice'`（更新ならず）
- トーストの**数字 %** = `computeProgressPercent(progress, total)`（記録後の最高到達点 ÷ 全長・既存純粋関数）。update でも nice でも「現在の最高%」を出す＝後退記録でも数字は減らない。
- `total`（タイムライン全長秒）= `Math.max(...timelineEvents.map(e=>e.time))`（HUD 既存と同じ）。

### B-2. 文言（i18n・4言語）
- 既存 namespace `progress` に追加（過不足ゼロで ja/en/ko/zh）:
  - `record_toast_update` = 例(ja)「最高到達点を更新！ 現在 {{pct}}%」
  - `record_toast_nice` = 例(ja)「ナイス！ この調子 現在 {{pct}}%」
- 「現在」「%」位置は各言語で自然に。数字 `{{pct}}` をアクセント色で強調（実装で span 分割）。

### B-3. 演出（確定＝「起動型・順次」合体演出）
立ち上がり約1.3秒 → **4秒**表示 → ホログラム明滅でフェードアウト。順次:
1. **ホログラム起動**: トースト全体 opacity を明滅させながら立ち上げ（flicker keyframes）＋水色の**走査線**がグラフ帯を上から下へ1回走る。
2. **文字デコード解読**: prefix 文字（「最高到達点を更新！ 現在 」等）を span 分割し、各文字をランダムなカナ/記号でスクランブル → 左から順に正解へロック。
3. **数字カウントアップ**: `{{pct}}` を 0 → 目標値へ easeOutCubic でカウント（カウント中はグロー強）。
- 色トーン: 文字 `#dff4ff`、数字 `#bfe9ff`・太字。背景はごく薄い暗色 radial ハロー（ピル枠ではない）。
- タイミング参考値（モック `toast-combo-v4.html` の seq）: holoDur=780 / decStart=320,decDur=700 / numStart=880,numDur=560 / HOLD=4000 / out=440。**微調整は実装後に実機で**。
- **連続記録**で多重再生しないよう、再生のたびに前アニメを無効化する世代トークン（モック実装の `token` 相当）を持つ。

### B-4. 配置・コンポーネント
- グラフ帯（`JourneyStrip` 内の中央 PulseTrail 領域＝[ProgressTrackingHUD.tsx:215](../../src/components/progress/ProgressTrackingHUD.tsx#L215)）の中央に重ねる新コンポーネント `ProgressRecordToast`。光の玉 canvas より上の z、`pointer-events:none`。
- **発火**: 記録時に種別と pct を載せた一時状態を持たせて HUD が監視 → 再生。実装案 = `useProgressRecording`（または別の transient store）に `toast: { kind, pct, ts } | null` を持ち、`commitReachedPos` で算出してセット、トーストが再生後に自動クリア。
  - `commitReachedPos`（[useProgressRecording.ts:23](../../src/components/progress/useProgressRecording.ts#L23)）が記録前 prevMax を読み、`recordReachedPoint` 実行後に kind/pct を確定して toast をセットする。
- **viewer（collab readonly）でも記録自体ができないので**トーストも出ない（記録経路がブロック済み）。

---

## C.（改善）記録ドロワー（PC）

### C-1. 開閉とトリガ
- グラフ帯クリック（既存 `useProgressRecording.openPanel()`・[ProgressTrackingHUD.tsx:303](../../src/components/progress/ProgressTrackingHUD.tsx#L303)）で、**中央の進捗エリアから下へ横長ドロワーがホログラム演出で降りる**。
  - 現状の PC ポップオーバー（[ProgressRecordPanel.tsx:296](../../src/components/progress/ProgressRecordPanel.tsx#L296) `PCPopover`・固定 top:52/right:16）を**ドロワーに作り替える**。
  - 演出 = clip 上→下展開 + ホログラム明滅 + 走査線（モック `drawer-v7` 準拠・トーストと同じ世界観）。位置はヘッダー幅に合わせた横長、グラフ帯の直下。
- **開いた瞬間に記録モード ON**（`recordMode=true`）。現状の「記録開始」トグルボタンは**廃止**。
- 閉じる: 外側クリック / Esc / 記録完了時（既存どおり `commitReachedPos` が `panelOpen:false, recordMode:false`）。記録モード中の外側クリックはタイムライン打点に使うため閉じない挙動は維持（[ProgressRecordPanel.tsx:303](../../src/components/progress/ProgressRecordPanel.tsx#L303) の現行ロジック踏襲）。

### C-2. 中身（脱ピル・最小限）
上から:
1. **プロンプト**: `progress.drawer_prompt_main`「今日はどこまで進みましたか？」/ `progress.drawer_prompt_sub`「タイムラインをクリックして記録しましょう」（中央・i18n）。
2. **光の道（フェーズナビ・案1）**: 旧 `PhaseJumpButtons`（縦積みボタン）を置換。
   - 細い発光ライン上に、各フェーズを**開始時間に比例した x 位置**でノード（小さな発光ドット）＋下にフェーズ名（`getPhaseName(phase.name, contentLanguage)`）。
   - **道のどこをクリックしても、その x の比例時間へジャンプ**: clickX/lineWidth × total → `time`。既存 `window.dispatchEvent(new CustomEvent('progress:jump-to-time', { detail:{ time } }))` を発火（[Timeline.tsx:1227](../../src/components/Timeline.tsx#L1227) のリスナ→`handleNavJump`）。
   - **実装注意**: `handleNavJump` は `timeToYMap` に存在する時間しかジャンプしない（[Timeline.tsx:885](../../src/components/Timeline.tsx#L885)）。道の任意時間は**最寄りの有効行時間にスナップ**してから dispatch する（厳密さ不要・ユーザー合意）。スナップは道側で行うか、`handleNavJump` を任意時間対応に拡張するかは実装で選ぶ（道側スナップが影響範囲小）。
   - `phases` が空ならセクション非表示（現行 `PhaseJumpButtons` と同じ）。
   - 記録モードのクリック横取り（行 onClickCapture）とは独立。道はドロワー内要素なので干渉しない。
3. **活動日数・時間（ドラッグスクラブ）**: 旧 `Stepper`（±ボタン）を置換。
   - 数字を左右ドラッグで増減。**感度 = 16px で 1**（低感度・細かく合わせやすい）。タップ用に小さな −/＋ も併設。箱なし（点線下線のみ）。
   - 既存 store: `progress.activeDays/activeHours` + `setActiveDays/setActiveHours`。0 未満は 0 にクランプ。
   - **perf 配慮**（[[feedback_code_quality]] / ui-design「マウス追従UI禁止」との整合）: これは**ドラッグ中のみ**発火する境界つき pointermove であり常時マウス追従ではない。ドラッグ中はローカル state で表示更新し、**pointerup で store へコミット**（グローバル再レンダーを毎フレーム起こさない）。
   - 折りたたみ（任意入力）の扱いは現行 `ActiveTimeSection` を踏襲（既値があれば開いた状態）。
4. **踏破**（旧 `ClearSection`）: ラベルを**「踏破」**に（絵文字なし・文字のみ・箱を最小化）。`setCleared(true)`、クリア済みなら解除リンク。i18n `progress.clear` の値を「踏破」へ（現「クリア（踏破）」）。
5. **直前を取り消す（アイコンのみ）**: 旧 `DailyBestList`（記録一覧）は**廃止**。代わりに**このセッションで最後に記録した1点だけ undo** できるアイコンボタン（`↶` 等・文字なし）。
   - 機構: `useProgressRecording` に `lastRecordedTs: number | null` を持ち、`commitReachedPos` でセット。undo は `progress.points` から `ts === lastRecordedTs` の点を探して削除し、`lastRecordedTs=null`。
   - 既存 `removeProgressPoint(index)` を使うため、ts→index 解決を行う（または ts 指定削除を追加）。最後の点が無い/既に消えていれば非表示 or 無効。

### C-3. 記録フロー（PC・完成形）
グラフ帯クリック → ドロワーが降りる（記録モード ON）→（必要なら光の道で大まかにジャンプ）→ 大タイムラインの行クリックで打点（既存 `TimelineRow` onClickCapture [TimelineRow.tsx:327](../../src/components/TimelineRow.tsx#L327) / `handleAddClick` [Timeline.tsx:1479](../../src/components/Timeline.tsx#L1479)）→ 記録 → **トースト（B）** → ドロワー閉じる。

### C-4. モバイル（今回は非破壊のみ）
- スマホは既存の `MobileBottomSheet` 経路を維持。ドロワー化・道・記録モード ON 自動化など**モバイル特有の作り込みはしない**（ボトムシートが打点用タイムラインを覆う問題があるため別タスク）。
- 共有していた `PanelBody` を PC ドロワー用に作り替える際、**モバイルが回帰しないこと**を最優先。最小実装としてモバイルは現行挙動（記録開始ボタン等）を残してよい。PC/モバイルでコンポーネントを分岐する。完全なモバイル対応は「スマホ最適化」タスクへ。

---

## D.（バグ）グラフ帯/開閉ハンドルにホバーするとグラフアニメが止まる

### 現象
ハンドル（やヘッダー）にマウスホバーすると、グラフの光の玉アニメが一瞬止まる/頭から再起動する。

### 根本原因（確定）
- ハンドルホバーで `setIsHovered(true)`（[ConsolidatedHeader.tsx:458](../../src/components/ConsolidatedHeader.tsx#L458)）→ ConsolidatedHeader 全体が再レンダー。
- → 子 `ProgressTrackingHUD`→`JourneyStrip` が `cornerX/cornerY`（と `yTop`）を**毎レンダー新規配列生成**（[ProgressTrackingHUD.tsx:186](../../src/components/progress/ProgressTrackingHUD.tsx#L186)）。
- → `PulseTrail` の `useEffect` 依存 `[cornerX, cornerY, count, fullLine]`（[ProgressTrackingHUD.tsx:146](../../src/components/progress/ProgressTrackingHUD.tsx#L146)）が変化 → canvas アニメ破棄＆ `start=0` で頭から再起動。
- 試作は SEED 静的だったため顕在化しなかった。

### 修正方針
- `JourneyStrip` 内で `cornerX/cornerY`（および `yTop`）を **`useMemo`**（deps = `points`, `cleared` 等の実データ）で安定化。親の無関係な再レンダーで配列 identity が変わらなくなり、`PulseTrail` の effect が壊れない。
- **canvas 描画ロジック（PulseTrail 内部）は不変**＝1:1移植を保持。修正は data-binding 層（JourneyStrip の配列生成）のみ。見た目は変わらない。
- 補強案（任意）: `PulseTrail` を `React.memo` 化。ただし useMemo だけで十分なら過剰。

---

## テスト方針

- **A**: CSS のみ。自動テスト困難 → 実機目視（記録モードでフェーズ/ラベル列を含め行全体に青枠）。
- **B**: 比較ロジック（kind 判定 = reachedPos>prevMax / pct=computeProgressPercent）を純粋関数化して単体テスト。演出は実機目視。
- **C**:
  - 光の道の time マッピング（clickX→time、最寄りスナップ）を純粋関数化して単体テスト。
  - undo（lastRecordedTs→該当点削除）の store テスト。
  - 活動スクラブの値クランプ（0未満→0）テスト。
- **D**: `cornerX/cornerY` の identity 安定をテスト（同一 points で再レンダーしても同じ参照）。
- **normalizeProgress**: イテレーション1 で未追加だった migration 単体テストを本イテレーションで追加（防御は多重だが安全網）。
- 全体: `npm run build`（tsc 厳密）+ `vitest run`（既知 housing 5件のみ赤が許容ベースライン）。

## 完了後

- 最終レビュー → **実機総点検（A/B/C/D + 4言語 + 記録モード ON/OFF 回帰 + collab viewer 表示）** → main merge = 本番デプロイ。
- 本機能は**デフォルト ON・本番ヘッダー直撃**のため、merge（自動デプロイ）前にユーザー実機確認を**必須**とする。

## スコープ外（次フェーズ）

- スマホでの記録ドロワー/道/記録モード作り込み = 既存 TODO「スマホ最適化」。
- Plan2 = collab リアルタイム同期（progress を全要素ライブ同期）。
