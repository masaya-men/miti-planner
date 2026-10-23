# 軽減表 スプシモード 設計書

- 日付: 2026-10-22
- 作業場所: `.claude/worktrees/milspec-polish`(MIL-SPEC 大型アップデートの一部。WIP ゲート `useCanPreviewWip` の内側で作り、MIL-SPEC と一緒に公開する)
- 見本(正典): `docs/.private/2026-10-22-spreadsheet-mode-mockup/index.html` の **案 A**(masaya 選択)。つまみの初期値は見本の `VARIANTS.A`(index.html:308)= 列幅 28px / 帯 6px。アイコンだけ 85% より小さくする(下記)。
- 参考スプシ: 同フォルダ `reference-sheet.md` の URL(公開リポに URL は書かない)。CSV export で読めたので要約を §1.2 に置く。
- 議論メモ: `docs/.private/2026-08-05-collab-header-and-spreadsheet-mode.md` ②(本書で設計書化した。以後は本書が正)。
- 前提: 見た目切替 UI 設計書(`docs/superpowers/specs/2026-10-22-theme-switch-ui-design.md`)が先に入る。標準ヘッダーのボタン群・MIL-SPEC の H4 レバーはその後の状態を前提にする。

書き方の約束: 「masaya の決定」は §3 の各項に事実として書く。私(Fable)が決めたことは **(Fable の判断)** と明記する。コードの引用は `path:line` で、すべて実物を読んで確かめた(2026-10-22 時点の worktree)。

---

## 1. 目的(なぜ)

FF14 の軽減表は、コミュニティでは Google スプレッドシート(以下スプシ)で作る人が多い。縦に攻撃のタイミング、横に「1 スキル = 1 列」でチェックを入れていく形。

このモードの目的は **スプシで軽減表を作っている人が LoPo を開いた瞬間に「いつものやつだ、しかもカッコいい」と感じて、そのまま使えること**(= 利用者を増やす)。今の LoPo の表示(メンバーごとの列の中で、重なったスキルだけ動的にレーン分けする)に不満があるから作るのではない。

使われ方: 攻略の初期〜終盤の初期に、頻発するダメージに対して「どの軽減をどこに置くか」を、時間・攻撃名・ダメージ・スキルを行ごとに見ながら決める。

### 1.1 今の LoPo との関係(変えない部分・変える部分)

- 左側の列(フェーズ / ラベル / 時間 / 攻撃名 / 元ダメージ / 軽減後ダメージ)と「1 行 = 1 秒、攻撃の数だけ段が増える」行の作り、同時刻の扱いは **今のまま**。`src/components/timeline/rowLayout.ts` の行の配置係(`computeRowLayout`、`Timeline.tsx:1858-1886` で生成)をそのまま使う。
- 変えるのは **スキルを置く部分(メンバー列)だけ**。今は「メンバー列 1 本(T/H 151px・DPS 53px、`src/index.css:1583-1587`)の中に、時間が重なるアイコンだけ 12px ずつ右へずらす」(`Timeline.tsx:3629-3680`)。スプシモードでは「そのメンバーの全スキルを 1 列 28px で固定して横に並べる」。

### 1.2 参考スプシの要約(CSV export を読んだ結果)

- 左の列: Phase / Total Time / Time / Action / Type / Damage(Hit・DoT・tick の 3 列)。LoPo の左側の列とほぼ同じ役割。
- スキル列: **1 スキル = 1 列**。ジョブ単位で固まって並ぶ(ナイト 9 列 → 戦士 9 列 → 暗黒 9 列 → ガンブレ 9 列 → 白 12 列 → 占 … と続き、DPS の牽制/アドル等も列として存在)。軽減だけでなく Heal / Barrier の列も混ざる(見出し 1 行目で `Mitigation / Barrier / Heal` を区別)。
- 列見出しは多段: ジョブ名の行 → スキル名の行 → Assign(SELF / RANGE_PARTY / SINGLE_PARTY / RANGE_ENEMY)→ Charge(1〜3)→ Time(効果秒)→ Recast(秒)→ 物理/魔法/固有の係数 … と、スキルの定義そのものが見出しに書いてある。
- 配置の表し方: 使う行に **チェック(TRUE)**。効果時間中の行にも TRUE が連続して入る(例: リプライザル 15 秒 → 1:03〜1:16 の行が全部 TRUE)。対象指定スキル(SINGLE_PARTY)は `-`、チャージ技は隣の列に **残りチャージ数**(`2`)が書かれる。
- リキャストの見せ方は CSV には出ない(条件付き書式の色は export されない)。「リキャスト中が分かる」は LoPo 側で帯と線で表現する(§3.3)。
- 右端に軽減後の係数と HP バーの計算列がある。LoPo は「軽減後ダメージ」列が同じ役割。

要するに参考スプシの「1 スキル = 1 列・ジョブごとに固まる・列見出しにスキルの素性・使う行にチェック」をそのまま LoPo の行の仕組みの上に載せる。

---

## 2. ゴール / やらないこと / 失敗とみなすこと

### ゴール
- 標準テーマ・MIL-SPEC テーマの両方で、ヘッダーのボタン 1 つで「今の表示(レーン表示)」⇄「スプシ表示」を切り替えられる。
- スプシ表示では、表示中の全メンバーの全スキル(DPS の軽減も)が 1 列 28px で常に並ぶ。列の順は軽減追加モーダルと同じ。
- マスをクリックでその場に置く。置いたものをもう一度クリックで消える。
- 置いたスキルは今と同じ 6px の帯で効果時間が伸び、そのあとリキャストが明けるまで細い薄赤の線が続く。**リキャスト中のマスと、今使えるマスがひと目で分かる。**
- 8 人分は画面に収まらない前提。素の横スクロール + 既存の「表示メンバー絞り込み」で見る範囲を絞る。
- 共同編集では各参加者が自分の画面だけ好きなモードにできる(閲覧者も)。モードが違う相手のカーソルは出さない。
- 今のレーン表示は一切変わらない。

### やらないこと
- スマホ版(`isMobileTimeline`)。PC だけ。
- 時刻ラベル列を固定したままの横スクロール(2026-06-18 に撤回済み・再挑戦しない)。
- スキルごとの列幅の可変化、列の並び替え、列の折りたたみ。
- 一般公開(WIP ゲートの撤去)。MIL-SPEC と一緒の大型アップデートで公開する。
- 表示モードを軽減表ごとに覚えること、共同編集でモードを同期すること。
- PiP 表示(`PipView.tsx`)、共有プレビュー(`MitigationSheetPreview.tsx`)、共有ページ。これらは今まで通りレーン表示のまま(Fable の判断: 範囲を表本体に限る)。

### 失敗とみなすこと(動いても不合格)
- 列がズレる: 見出しのスキルアイコンと、行のマス・置いたアイコン・帯・線の横位置が合わない(横スクロール中・サイドバー開閉後・メンバー表示切替後を含む)。
- 置いたのに見えない / 消したのに残る(共同編集の相手側を含む)。
- 既存のレーン表示が 1px でも変わる(列幅・アイコン位置・帯・競合の脈動・矢印・リキャスト行)。既存テストが落ちる。
- 共同編集で、相手のカーソルが変な所に出る(モードが違う相手のカーソルが見える、同じモードの相手のカーソルがズレる)。
- 標準テーマで作ったものが MIL-SPEC で浮く(色の直書きでトークンを通らない)。
- 65 列 × 全行を 1 マス 1 要素で描いて重くなる(§4 のパフォーマンス)。
- リキャスト中のマスを押したとき、何も起きない・無言で置かれる(揺れ + 赤いトーストが出ること)。
- ツールチップや文言が 5 言語のどれかで欠ける。

---

## 3. 決まったこと

### 3.1 入口: ヘッダーのボタンと表示モードの持ち方

**ボタンの場所(masaya 決定)**: ヘッダーの「テーマ切替ボタンの左隣」。

- 標準ヘッダー `src/components/ConsolidatedHeader.tsx`: 右端の並びは `TutorialMenu`(290-294、閲覧者では出ない)→ 区切り線 → **昼夜(Sun/Moon)ボタン(297-309)** → `MilspecStyleToggle`(311-318、`canPreviewWip` のときだけ)→ `LanguageSwitcher`(321)→ ログイン。見本(index.html:239-246)は **昼夜ボタンの左** に表アイコンを置いている。ここに `Tooltip` 付きの `iconBtnBase + iconBtnDefault`(56-66)のボタンを足す。ON のときは `iconBtnActive`(66)で反転(見本の `.ib.on`)。アイコンは見本の表グリッド(index.html:241 の SVG)。閲覧者(`readOnly`)でも出す(§3.8)。`ConsolidatedHeader.viewer.test.tsx` が viewer のボタン無効化を見ている(113-139)ので、新ボタンは「無効化しない側」に入れる。
- MIL-SPEC ヘッダー `src/components/military/header/AuxPanel.tsx:96-117`: H4 区画は左から AUX(チュートリアル)→ DSP(昼夜ロッカー `ThemeRocker`、`decor.h4.rocker = {x: MW-187, w: 17}`)→ MODE(T 字レバー `ModeLever`、`decor.h4.lever = {x: MW-150, w: 36}`)→ COM(丸キー 4 つ)。座標は `src/components/military/headerGeometry.ts:153-160`、板は `:81-85`(幅 353、`:98` で `x: MW-357`)。**ロッカーとレバーの間は 20px しかなく、そのまま「レバーの左隣」に鍵を足す余地はない。** (Fable の判断) H4 の板を左へ広げ(`pts` の 353 と `:98` の `w`/`x`)、AUX・DSP・MODE の x を同じ分だけ左へずらして、ロッカーとレバーの間に COM と同じ丸キー(`circ(…, 9.6)`、`:128`)を 1 つ置く。右端基準の部品(レバー・COM・ID)は画面上で動かさない(見た目切替設計書 §3-D のルール)。広げた分は H3 のメーター(`iw = MW - 879`、`:111`)が縮む。`showClock = iw >= 300` なので、1189 幅では時計が消える可能性がある → §6 の質問 3。文言は見た目切替と同じ要領で `MilspecTitleTooltip` が LoPo のツールチップに置き換える。
- 両方とも `useCanPreviewWip()`(`src/hooks/useCanPreviewWip.ts:12-15`)が true のときだけ描く(ConsolidatedHeader.tsx:122 と同じ)。

**表示モードの保存(masaya 決定)**: 全体共通で 1 つ。端末のブラウザに保存。軽減表ごとに覚えない。同期しない。

- (Fable の判断) 置き場は `src/store/useThemeStore.ts` の persist(`name: 'theme-storage'`, `version: 2`、31-70)。`timelineView: 'lanes' | 'sheet'` を足し、`version: 3` に上げて `migrate` で未設定なら `'lanes'`。`useMitigationStore` は `partialize`(1848)で軽減表のデータと一緒に保存される store なので使わない。
- (Fable の判断) 実際に使う値は `resolveThemeStyle`(81-86)と同じ考え方で関数にする: `resolveTimelineView(saved, canPreview, tutorialActive, isMobile)` → WIP 権限なし / チュートリアル中(`TimelineRow.tsx:647-651` の `data-tutorial="miti-cell-mt-4"` 等はレーン表示のマスに付いている)/ スマホは常に `'lanes'`。保存値は消さない。コンポーネント用に `useEffectiveTimelineView()` を用意し、`Timeline.tsx:771` の `isMilspecTable` の隣で `isSheetView` を決める。

### 3.2 列の作り方(レーン分けとは別ロジック)

**今の仕組み(変えない)**
- メンバー列の幅は `getColumnCssVar(member.role)`(`src/utils/calculator.ts:27-30`)= `--col-th-w` 151px / `--col-dps-w` 53px + 左右 `--col-member-pad-x`(`src/index.css:1583-1591`)。行のマスは `TimelineRow.tsx:644-670`(`visiblePartyMembers` を 1 人 1 マス)、ヘッダー側は `JobPickerRow.tsx:54-66`(`data-member-id` 付き)で、この要素を `useMeasuredMemberLayout`(`Timeline.layoutHooks.ts`、呼び出し `Timeline.tsx:2691-2721`)が実測して `memberLayout: Map<id, {left, width}>` にする。
- 置いたアイコンの横位置は `Timeline.tsx:3629-3680`: `PLACEMENT_STEP = 12` / `ICON_WIDTH = 24` / `VISUAL_OFFSET = 2`、時間が重なるものを左から 12px 刻みで詰める(Phase 1)。`absoluteLeft = colStart + VISUAL_OFFSET + candidateLeft`(`:3756`)。

**スプシモード(masaya 決定 + 実装の置き方)**
- 1 スキル = 1 列固定、列幅 28px(見本 `--col-w`)。横の罫線なし(既存の `showRowBorders` 設定は今まで通り効かせる。既定 OFF)。
- メンバー列の幅 = そのメンバーの列数 × 28px(+ 左右 pad は 0 にする。Fable の判断: 28px 刻みを崩さないため)。`TimelineRow` と `JobPickerRow` の `style.width` をモード別に出し分ける。**`data-member-id` の要素はそのまま残し、`memberLayout` の実測の仕組みを流用する**(列の左端はこれで取れる)。
- アイコンの横位置: `left = memberLayout.left + skillIndex × 28 + (28 − iconPx) / 2`。レーン分け(Phase 1)は通さない。同じ秒に同じスキルは 1 つしか置けない(§3.4)ので衝突はない。
- (Fable の判断) 列の定義(メンバー → 列の配列 `{mitigationId, def}`)は純粋関数 `buildSheetColumns(member, jobMitigations, currentLevel)` に切り出して単体テストする。描画・クリック判定・帯/線・競合矢印の 4 か所が同じ配列を使う。
- 競合の画面外矢印 `Timeline.tsx:2736-2759` は `columnCenterX = layout.left + layout.width / 2`(メンバー列の中央)。スプシモードでは **そのスキルの列の中央** にする。

**列の順(masaya 決定)**: 軽減追加モーダルと同じ。出どころは `src/components/MitigationSelector.tsx`:
- `allJobMitigations = MITIGATIONS.filter(m => m.jobId === jobId)`(128)。`MITIGATIONS` は `useMitigations()`(`src/hooks/useSkillsData.ts:22-25`、Firestore マスタ → 無ければ `src/data/mockData.ts` の静的データ)。牽制・アドル・ランパート等のロール共通技は `mockData.ts:777-823` でジョブごとに `feint_drg` のように展開されている。
- 絞り込み(146-190): レベル(`minLevel`/`maxLevel` と `currentLevel`)、`hidden`、`requires`(前提技の効果中だけ)。
- 並び(190): `getMitigationPriority(id)`(`mockData.ts:137-145`、`MITIGATION_DISPLAY_ORDER` `:3-136` の添字。`_pld` などのジョブ接尾辞と `_v2` を剥がして引く)。
- スプシモードの列は **レベル絞り込みと `hidden` は同じに、`requires` の絞り込みはしない**(masaya: スキルは常に全部並ぶ)。`requires` 技(サンサイン等)は列があり、前提が無い時刻はマスが押せない(§3.4 の判定がそのまま返す)。レベル絞り込みを通すのは、`feint` と `feint_base`(`mockData.ts:82-83`)のような版違いで同じ技の列が 2 本並ぶのを防ぐため。
- セラフィズム中の名前/アイコン差し替え(`MitigationSelector.tsx:190-208`)は列見出しでは行わない(Fable の判断)。置いたアイコンは `MitigationItem` の `getEffectiveIcon`(`Timeline.tsx:481-508`)が今まで通り面倒を見る。

**列数の見込み**(静的データ `mockData.ts` を数えた。レベル絞り込み前): pld 13 / war 12 / drk 10 / gnb 12 / whm 14 / sch 24 / ast 18 / sge 18 / 近接 DPS 0〜3 + 牽制 / 遠隔 1〜3 + アドル等。8 人で **おおむね 45〜65 列 = 1,260〜1,820px**。左側の固定列は約 570px(`index.css:1576-1580`)なので 1489 幅では収まらない → 横スクロール(`Timeline.tsx:3226` の `md:overflow-x-auto` と `:3279` の `md:w-max md:min-w-full` が既にある)+ メンバー絞り込み。

### 3.3 見た目(案 A)

数値は見本の実測コメント(index.html:8-11)と案 A(index.html:308-309, 162-163)から:
- 行高 25px(`ROW_UNIT_PX.pc`、`rowLayout.ts:13`)。変えない。
- 列幅 28px、横罫線なし、縦罫線は 1px `border-app-border`(見本 `rgba(255,255,255,.10)`)。ジョブの境目は少し濃い線(見本 `--line2`)。
- 置いたアイコン: 今の `MitigationItem` と同じ作り(黒 50% 地・角丸・`border-app-border`、`Timeline.tsx:545-556`)。**大きさは 85% より小さく(masaya)**。(Fable の判断) 初期値 **18px(75%)**。28px 列で左右 5px 空く。1 か所のトークン `--sheet-icon-px` で持ち、DevTools でその場で変えて実機で詰められるようにする(列幅も `--sheet-col-w`、帯も `--sheet-band-w`)。
  - `MitigationItem` は `MITI_ICON_PX`(24、`rowLayout.ts:16`)を幅・高さ・帯の始点(`Timeline.tsx:528, 550, 625`)・縦オフセット(`mitiIconOffset`、`rowLayout.ts:128`)に直接使っている。**`iconPx` を prop(既定 `MITI_ICON_PX`)で受け取れるようにし、帯の始点 `top = iconPx / 2`、縦オフセット `(unitPx − iconPx) / 2` にする。** 既定値のまま呼べばレーン表示は 1px も変わらない。
- 効果時間の帯: 今と同じ 6px、ロール色 / ライトパーティ色は `getMitigationColorClasses`(`Timeline.tsx:150-230`)を流用。高さは今の `barStartY / barEndY / effectiveEndTime` の計算(`Timeline.tsx:3690-3752`、`hideEmptyRows` の切り詰め・maxTime クリップ・ホロスコープ/巨星/WD/バリア消費の切り詰め込み)をそのまま使う。
- リキャスト中の線: 帯の終点(効果 1 秒以下の技はアイコン中央)から `rowLayout.topOf(time + def.recast) + unitPx / 2` まで、幅 2px、薄赤(見本 `rgba(239,68,68,.45)`)。`maxTime` と `hideEmptyRows` の切り詰めは帯と同じルール。(Fable の判断) これは `MitigationItem` の中ではなく、同じ絶対座標系に置く別の薄い要素 `data-mit-cd` として親(シート層)が描く。`MitigationItem` の「廃止したリキャスト点線」(`Timeline.tsx:272, 643`)は復活させない。
  - チャージ技(`maxCharges`、`resourceTracker.ts:291-365` でチャージ数を模擬)は、1 回使っただけでは使える。(Fable の判断) チャージ技の線は「残りチャージが 0 になった区間」だけ引く。難しければ最初は「チャージ技は線なし、押せるかどうかは §3.4 の判定に任せる」でよい。どちらにしても **線の有無と押せるかどうかが矛盾しないこと**。
- 列見出しは 2 段(masaya): 上段 = ジョブアイコン + ジョブ名 + 位置(MT 等)、下段 = スキルアイコン(静的・状態計算なし)。
  - 上段は今の `JobPickerRow`(操作列 `#timeline-controls-inner` の右端、`Timeline.tsx:3081-3090`、高さ h-7 = 28px = 見本の `--hd-group-h`)の位置。幅が足りる列(3 列以上。Fable の判断)はジョブ名と位置を添え、狭ければアイコンだけ。クリックでジョブ変更・右クリックで解除は今のまま。
  - 下段は今のヘッダー行 `#timeline-header-inner`(`Timeline.tsx:3095-3216`、h-10 = 40px = 見本の 39px)のメンバー領域。今ここには `RecastRow`(`:3209-3215`)がある。スプシモードでは **`RecastRow` を描かず、列ごとの静的スキルアイコン(`def.icon`、ツールチップにスキル名 + リキャスト秒 + 効果秒)を描く**(Fable の判断: 線がリキャストの表示を兼ねる。ツールバーの「リキャスト表示」ボタン `:2999-3010` はスプシモードでは隠す)。MIL-SPEC の `renderMilspecIdle`(`:2681-2689`)もスプシモードでは使わない。
- マスのホバー: 見本はホバーでその列のアイコンを薄く予告する(index.html:151)。(Fable の判断) 1 行 1 メンバーのマスを React で細分化しない(§4)。ホバー予告は「シートに 1 個だけある予告用の要素を、`pointermove` で直接 style を書いて動かす」(`CursorOverlay.tsx` と同じ rAF 直書きの作法)か、初版では省く。マウス追従 + state 更新は禁止(`.claude/rules/ui-design.md`)。
- リキャスト中のマスを押したとき(masaya): マスが揺れて(見本 `.shake` 0.25s)、「置けません」と同じ赤いトースト。今のトーストは `MitigationItem` のローカル state(`Timeline.tsx:358, 513-519`、`bg-red-600 rounded-full` 下中央)で、文言は `t('timeline.cannot_place_here')`(`:473`、`src/locales/ja.json:510`)。(Fable の判断) 同じ見た目を小さなコンポーネントに切り出して `MitigationItem` とシートで共用し、文言は判定の `message`(例 `mitigation.cd_remaining` "CD 12s")があればそれを添える。`showToast`(`src/components/Toast.tsx:17`)は右上の通知用なので使わない。
- テーマ: 色は Tailwind の `app-*` トークン(`src/index.css:8-19`)か `MitigationItem` の既存クラスだけで作る。MIL-SPEC は `milspecTable.css:245-275` が `[data-mit-icon]` / `[data-mit-bar]` / `[data-mit-end]` を上書きしているので、スプシモードの要素にも同じ `data-mit-*` フックを付ければ自動で軍事の質感になる。新しい要素(`data-mit-cd`、列見出し、縦罫線)の MIL-SPEC 側は `--ma-*` トークン(`src/styles/military.css:174-211`、線は `--ma-dng` 系を薄く)で書き足す。

### 3.4 操作: クリックで置く / もう一度で消す

**今の仕組み**
- マスのクリック → `onCellClick(member.id, time, e)`(`TimelineRow.tsx:659`)→ `handleCellClick`(`Timeline.tsx:2137-2158`): 進捗記録モードなら到達点を記録 / `readOnly` なら無視 / メモモードなら無視 / ジョブ未設定なら無視 → `MitigationSelector` を開く(`:4236-4246`)。
- モーダルで選ぶ → `handleMitigationSelect`(`:2254-2277`)が `AppliedMitigation` を組み立てて `addMitigation`: `{ id: genId(), mitigationId, time, duration: mitigation.duration, ownerId, targetId: _targetId, linkedMitigationId: _linkedMitigationId }`。型は `src/types/index.ts:106-115`。
- モーダルで「同じ時刻に既に置いた技」を押すと削除(`MitigationSelector.tsx:209-214`、`onRemove = removeMitigation`、`Timeline.tsx:4240`)。
- 置けるかの判定は `validateMitigationPlacement(def, time, ownerMitigations, t)`(`src/utils/resourceTracker.ts:423-430`)。前提技・戦闘外・フェアリー・チャージ・**リキャスト(:650-676)** を見る。リキャスト中のクリック配置は今 `{ available: false, conflictOverride: true }` で「赤いが押せる」(競合の脈動と矢印で知らせる方式)。ドラッグは `ALLOW_DRAG_INTO_CONFLICT` で警告つき許可。
- 対象指定(`scope === 'target'`、インターベンション等)と展開戦術(`copiesShield`)は、置く前に相手 / コピー元の鼓舞を選ぶ(`MitigationSelector.tsx:216-258`)。純粋な判定は `src/utils/mitigationTapResolver.ts:19-41` の `resolveMitigationTap` に切り出されている(スマホも共用)。
- 共同編集中の `addMitigation` は store が Yjs ハンドラへ委譲する(`src/store/useMitigationStore.ts:1363-1385`)。スプシモードで新しく触る必要はない。

**スプシモード(masaya 決定 + 実装の置き方)**
- マスのクリック = その場に配置。`handleCellClick` の前段のガード(記録モード / readOnly / メモモード / ジョブ未設定)はそのまま通し、その後ろでモード分岐する。
- クリック位置 → スキル: `TimelineRow` のメンバーのマスは **1 人 1 要素のまま**(§4)。`e.clientX − 要素の left` を 28 で割って `skillIndex` を出し、`buildSheetColumns` の配列から `def` を引く。
- 同じ owner・同じ `mitigationId`・同じ `time` の配置が既にあれば `removeMitigation(id)`(= もう一度クリックで削除)。
- 無ければ `validateMitigationPlacement`。`available` か `warning` なら配置。`available: false`(`conflictOverride` 含む)なら **置かずに揺れ + トースト**(masaya: 案 A。今のモーダルの「赤いが押せる」とは違う挙動で、スプシモードだけの話)。
- `resolveMitigationTap` が `selectTarget` / `selectShield` を返す技は即配置できない。(Fable の判断) マスの位置に小さなポップオーバー(8 人のジョブアイコン、または鼓舞の一覧)を出して選ばせる。`MitigationSelector.tsx:456-600`(`selectedSingleTargetMit` / `selectedCopyShieldMit` のサブビュー)と同じ材料。→ §6 の質問 2。
- `AppliedMitigation` の組み立ては `handleMitigationSelect` と同じ形(`duration: def.duration`、`targetId`、`linkedMitigationId`)。`handleMitigationSelect` から組み立て部分を関数に切り出して共用する。
- 置いたあとの縦ドラッグ・右クリック削除・ツールチップは `MitigationItem` のまま(横には動かない: `left` は列で固定)。ドラッグの警告つき許可もそのまま。

### 3.5 表示メンバーの絞り込みと横スクロール(masaya 決定)

- 列数は減らさない。見る範囲は **既存の `PartyVisibilityMenu`**(`src/components/PartyVisibilityMenu.tsx`、store の `hiddenPartyMemberIds` / `toggleHiddenPartyMember` / `setHiddenPartyMemberIds`、`useMitigationStore.ts:76, 880-884`)で絞る。`visiblePartyMembers`(`Timeline.tsx:2675-2679`)と `visibleMitigations` の除外(`:3524-3530`)がそのまま効く。
- 横スクロールは素のまま(時刻ラベル列の固定はしない)。
- 共同編集に入ると `hiddenPartyMemberIds` は空に戻る(`useMitigationStore.ts:588`)。スプシモードでも同じ。

### 3.6 共同編集: presence に表示モードを 1 項目足す(masaya 決定)

- 各参加者が独立して自分のモードを選ぶ。閲覧者(`readOnly`)も切り替えられる。データは変わらないので権限と無関係。
- 相手のカーソルは「シート幅に対する比率 `xRatio` + 秒」で届く(`src/components/Memo/coords.ts:90-101`、送信 `Timeline.tsx:1445-1476`、描画 `src/components/collab/CursorOverlay.tsx:56-73`)。モードが違うと横の意味が変わるので、**自分とモードが違う相手のカーソルは描かない**。
  - `PresenceState`(`src/lib/collab/presence.ts:7-12`)に `view: 'lanes' | 'sheet'` を足す。`RosterEntry`(15-22)と `buildRoster`(56-77)にも通す。古いクライアントで `view` が無い場合は `'lanes'` 扱い。
  - 自分の値: `collabProvider.ts:400-411` の `localPresence` に初期値、`:447-458` の `syncLocalPresence`(store の変化を `presenceHandle.update` に流す)に `timelineView` の変化も流す(`useThemeStore.subscribe`)。
  - `CursorOverlay.tsx:33-37` の `peers` の絞り込みに `r.view === myView` を足す。
- メモ(`PlanMemo`、`src/types/index.ts:243-255`)は **作者を持たない**。軽減表のデータとして全員で共有され(`yjsPlanData.ts:8` `MEMOS_KEY`)、横位置は `xRatio`(`coords.ts:97-110`、作成時 `Timeline.tsx:1071-1109` がシート幅から計算)。「表示モードが違う相手のメモを隠す」は、メモが誰のものか分からないので **そのままでは実装できない**。→ §6 の質問 1(私の案: メモに「作った時のモード」を 1 項目持たせ、同じモードの時だけ描く)。

### 3.7 テーマと WIP ゲート(masaya 決定)
- 標準・MIL-SPEC の両方でトークン経由(§3.3 末尾)。
- 公開まで `useCanPreviewWip` の内側。ボタンもモードの解決も(§3.1)。

### 3.8 閲覧者(共同編集の読み取り専用)
- 切替はできる(masaya)。置く・消すは `readOnlyRef`(`Timeline.tsx:687-689`)のガードで今まで通り不可。

### 3.9 i18n(5 言語同時・`feedback_i18n_all_5_languages_upfront`)
新キー(訳語は私の案。`src/locales/{ja,en,zh,zh-Hant,ko}.json`、`src/locales/__tests__/zh-hant-completeness.test.ts` が zh と zh-Hant のキー一致を見る):
- `app.timeline_view_switch`: 表示を切り替える / Switch table view / 切换表格显示 / 切換表格顯示 / 표 보기 전환
- `timeline.sheet_col_tooltip`: `{{name}}（リキャスト {{recast}}秒 / 効果 {{duration}}秒）` 相当を 5 言語
- 既存で足りるもの: `timeline.cannot_place_here`、`mitigation.cd_remaining`、`mitigation.next_charge_in`、`mitigation.select_target`、`mitigation.select_shield`。

---

## 4. 制約

- **パフォーマンス(最重要)**: 行は 1 秒 1 行(`gridLines` は −10〜`fightDuration`、`Timeline.tsx:1836-1844`)。「空の行を隠す」OFF だと数百〜千行近くある。65 列 × 全行を 1 マス 1 DOM にすると数万要素になり不合格。**行のマスは今まで通り 1 メンバー 1 要素**(`TimelineRow.tsx:644-670`)にし、縦罫線は CSS(`repeating-linear-gradient` を 28px ピッチ)で描き、クリックは座標で列を割り出す(§3.4)。置いたアイコン・帯・線は今と同じく「配置の数だけ」絶対配置する(行 × 列ではない)。`TimelineRow` は `rowPropsEqual` でメモ化されている(`TimelineRow.tsx:367, 669`、`timeline/rowPropsEqual.ts`)ので、新しく渡す列情報は参照が安定したもの(useMemo)にする。大量行は `content-visibility: auto` の既存方針(memory `reference_perf_content_visibility`)。
- **既存表示を壊さない**: `isSheetView === false` のとき、`TimelineRow` / `JobPickerRow` / `MitigationItem` / `Timeline` の出力が今と同一であること(既定値で呼ぶだけで分岐を通らない作り)。関係する既存テスト: `src/components/__tests__/Timeline.layout.test.tsx`(列の実測)、`MitigationItem.milspec.test.tsx`(`data-mit-bar` / `data-mit-icon`)、`Timeline.recastBand.milspec.test.tsx`(`.recast-cell` の有無)、`TimelineRow.milspecAttrs.test.tsx`、`TimelineRow.multiAttack.test.tsx`、`ConsolidatedHeader.viewer.test.tsx`、`src/lib/collab/__tests__/`(presence / collabProvider)、`src/components/timeline/__tests__/`。これらは全部通ること。新しい純粋関数(列の生成・クリック座標 → 列・線の高さ)には単体テストを付ける。
- **CSS ルール**(`.claude/rules/css-rules.md`): `backdrop-filter` の直書き禁止、`clip-path: path()` 禁止。`CSS zoom` 禁止(memory `feedback_no_css_zoom_scaling`)。寸法は px 固定か `clamp(min, vw, base)`(基準 1489)。
- **UI ルール**(`.claude/rules/ui-design.md`): 色は白黒 + 既存トークン。赤は「危険・できない」の意味で使う(リキャスト線・トーストは該当)。マウス追従 UI(mousemove + state)禁止。見た目に関わる変更は実装前に masaya の承認(この設計書 + 見本がその承認)。
- **i18n**(`.claude/rules/i18n.md`): UI 文字列はすべて i18n キー経由。5 言語同時。
- **MIL-SPEC の質感**: 新しい要素は見本の下書きではなく本番の MIL-SPEC 水準(`milspecTable.css` の既存の上書きと同じ書き方で `--ma-*` を使う)。
- **検証**: 開発中は対象テストだけ(`npx vitest run <path>`)。実機は 1489×679・DPR 2.58 のスクショで見本と突き合わせる(memory `feedback_visual_fidelity_requires_screenshot_diff`)。push 前は `npm run build` + `npm run test:gate`。
- **共同編集の検証**: 2 タブで「片方レーン・片方スプシ」「両方スプシ」の 2 ケース。相手のカーソルの表示/非表示と、置く・消すの反映を確かめる(memory `reference_collab_two_client_version_skew`: 両タブともリロードしてから)。

---

## 5. 作る人に任せること

- 列情報をどう `TimelineRow` に渡すか(`visiblePartyMembers` に列数を添えるか、別 Map を渡すか)。`rowPropsEqual` の比較対象に入れること。
- クリック座標 → 列の割り出しを `TimelineRow` 側でやるか、`Timeline` の `handleCellClick` でやるか(どちらでもよいが純粋関数に切り出してテスト)。
- 列見出し上段(ジョブ名 + 位置)の文字の出し方と「狭いときはアイコンだけ」の閾値。
- ホバー予告(§3.3)を初版に入れるか。入れるなら rAF 直書きで。
- チャージ技の線(§3.3)の実装範囲。
- 対象指定 / 展開戦術のポップオーバーの見た目(§6 の答え次第)。
- MIL-SPEC H4 の広げ方の数値(§3.1)。右端基準の部品を動かさないこと・レバーの左に置くこと・`showClock` の扱いだけが条件。
- `MitigationItem` の `iconPx` prop をどう通すか(prop か、親の CSS 変数を読むか)。既定で今と同じ出力になることが条件。
- ファイル分割: `Timeline.tsx` は 4,711 行あるので、スプシモード固有の描画(列見出し下段・線・ポップオーバー)は `src/components/timeline/sheet/` に新しいファイルで置く(memory `feedback_code_quality`)。

---

## 6. masaya への質問(返信本文に同じものを載せる)

1. メモ(§3.6): 作者が無いので「相手のメモを隠す」はできない。(a) メモに作った時のモードを記録し、同じモードの時だけ描く(私の案)/ (b) 両モードで描く(横位置のズレは許容)/ (c) スプシモードではメモ機能を出さない。
2. 対象指定スキルと展開戦術(§3.4): (a) マスを押した後に小窓で相手 / 鼓舞を選ぶ(私の案)/ (b) 相方タンク(MT↔ST)へ自動で置き、鼓舞は有効なものが 1 つの時だけ置ける。
3. MIL-SPEC のボタン位置(§3.1): レバーの左に鍵を足すには H4 の板を左へ広げる必要があり、狭い画面(幅 1189 まで縮んだとき)でメーターの時計が消える可能性がある。それでよいか / 別の場所(COM の 5 つ目など)でもよいか。

## 追記: 確認役の質問への回答(Claude の判断・2026-10-22)
- **列の無い軽減の描き方(Claude の判断)**: 列は「元の技」単位。`hidden` の差し替え技(例: セラフィズム中のマニフェステーション/アクセッション)・レベル違いの版・仮想アイテム(`isVirtual`/`parentId`)は、元の技(差し替え元・`_base`・`parentId`)の列に描く。どの列にも寄せられないものが出たら描画せず dev でだけ警告(「置いたのに見えない」をテストで検出する)。
- **共有リキャスト(Claude の判断)**: `getSharedCooldownIds` で共有している技は、どちらを置いても、共有相手の列にも薄赤の線を引き、その列も押せない扱いにする(線と「押せない」は常に一致させる)。
- **後ろ向きの判定(Claude の判断)**: 後で使う予定と重なる配置(`available:true, warning:true`)は、通常表示と同じく置けて警告を出す。表示モードで置ける・置けないが変わらないようにするため。

## 追記: masaya の回答(2026-10-22)
- **メモ(Q1 = b・意図の明確化)**: どちらの表示でも出す。ただし「どのジョブの列に貼ったか」は守る(masaya:「左右のずれ且つそのジョブの列の中なら問題ない」)。実現方法(Claude の判断): 保存する座標は今の通常表示の xRatio のまま(データの形は変えない・古いクライアントと互換)。表示時に、通常表示のレイアウトで xRatio →(メンバー列, 列内の割合)に変換し、スプシ表示では同じメンバー列の同じ割合の位置に出す。スプシ表示でメモを作る/動かすときは逆変換して通常表示の xRatio で保存する。メンバー列の外(左側の情報列)は両表示で同じなのでそのまま。§3 の「表示モードが違う相手のメモを隠す」はこれで不要。
- **カーソル共有(Claude の判断)**: メモと同じ変換で、表示モードが違う相手のカーソルも同じジョブの列の中に出す。presence の表示モード項目は変換の判断にだけ使い、相手を隠す処理は不要。
- **対象指定(Q2 = a)**: マスを押したら、その場に小さな窓を出して相手(展開戦術は鼓舞)を選ぶ。
- **切替ボタンの場所(Q3・masaya 決定)**: 標準・MIL-SPEC の両方で、今の「みんなの軽減表」ボタンの場所(標準 ConsolidatedHeader の下段 / MIL-SPEC H5 の右側)に、**ジョブの表示/非表示の 1 クリック切替(メンバーごとのトグル)とスプシモード切替**を置く。§3 の「テーマ切替の左隣」は取り消し。「みんなの軽減表」機能は撤去(別タスク・データは消さずに止めるだけ)。見た目は見本で相談してから決める。
- **跡地の部品(masaya 決定 2026-10-23)**: 標準 = 見本 docs/.private/2026-10-23-header-slot-mockup/ の **S1**(ロール別に区切った丸トグル 8 個 + 2 択スイッチ・左へ約 +90px)。MIL-SPEC = **M1**(SORT と同じ連動キーでジョブ 8 個 + 2 択の連動キー・x684〜952)。**歯車(表示メンバーのポップオーバー)は標準・MIL-SPEC とも撤去**(masaya「要らなくなるはず」)。
- **歯車の中身の行き先(Claude の判断)**: 全員表示 = トグル列の左端に「ALL」キー 1 個(全員表示中は点灯・押すと全員表示に戻す)。全員非表示・反転・「その人だけ表示」は廃止(masaya「簡単操作なのでダブルクリック等も要らない」)。
- **見出しと文言(masaya 決定 2026-10-23)**: 部品のまとまりごとに見出しを付ける。2 択は見出し「表の見た目」+ 選択肢「ふつう / スプシ」。ジョブのトグル列は見出し「表示メンバー」(Claude の案・MIL-SPEC は SORT と同じ小見出し)。5 言語の訳は実装時に用意。

## 追記(2026-10-23 masaya 実機確認 1 回目)
- 不具合(根因調査→修正): ①置く/消すが遅い(本番ビルドで再計測して判断) ②リキャストの線が消えない ③リキャストの線が次の行の半分まで出る → スプシ表示では時間の行の下端で終える ④メモはふつう/スプシの両方で、そのジョブの列の中に出す(出ない場合は不具合) ⑤MIL-SPEC→標準へ戻す切替がとても重く、読み込み表示も無い
- 見た目: リキャストの線が分かりづらい → 見本で案を出して選んでもらう
- 新機能: スプシの技の列を一番上(列見出し)で表示/非表示。隠した技はジョブの欄に「+」を出し、そこから選んで再表示。見本で案を出す
- 列見出しのジョブ名・MT 等の文字は削除(ジョブアイコンのみ)
- 見出し欄: 「表示メンバー」「表の見た目」「並び替え」は小さい文字のラベルをボタンの上に置いて横幅を節約(進捗記録の欄が狭すぎるため)
- 「表の見た目」「並び替え」の切替はボタンのどこを押しても切り替わる
- 「表示メンバー」の並びは並び替えの状態に関係なく、タンク/ヒーラー/DPS で区切った固定順(今のロール別の見た目)
- 決定(2026-10-23 見本 `docs/.private/2026-10-23-sheet-feedback-mockup/`): Q1=案 b(線を 2→4px・終わりの行の下端に横棒・標準/MIL-SPEC 両方)。**効果時間中の帯とリキャストの線が切れ目なくスムーズにつながる形**にする。Q2=案 b(列見出しの技アイコンを押すと隠れる。ジョブ欄の「+(数)」→小窓で選んで再表示。設定は全体で 1 つ)。Q3=ラベル案 A(ボタンの上・10px・左寄せ・ボタン 36→32px)。MIL-SPEC の見出し欄は案 A の考え方に合わせる
