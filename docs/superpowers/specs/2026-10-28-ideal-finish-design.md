# 全体を理想にする仕上げ 設計書(2026-10-28)

## 目的
masaya 10-28「本当に全体を妥協なく」。アプリの見た目や動きを新しくする作業ではなく、**ファイルの中身を理想の形に揃えきる**仕上げ。終わったら新機能(楽しい作業)へ進む。並行できる所は並行で、なるべく早く。

## ゴール(機械で判定できる形)
1. 400〜500 行のファイル 41 本(下の表)が、すべて「1 ファイル 1 仕事」になっている。分割後に 400 行を超えて残るのは「1 つの仕事なので切れない」と理由を書いたものだけ。
2. commit の直前に、大きさの見張り(`src/architecture/__tests__`)と共通の見た目の見張りが毎回動く。
3. 重複部品・紛らわしい名前・古い記録の点検が終わり、見つかった物は直すか、理由つきで残している。
4. 外側を押したときの動きが全部 1 つの仕組みに揃っている。手書きの外側検知は見張りテストで禁止されている。

## やらないこと
- 見た目の変更(visual-regress は全部一致が合格)。動きの変更は ④ で決めた分だけ。
- データ・自動生成・翻訳(file-size-limits.json の ignore)の分割。
- **管理画面の 2 本(AdminTemplates 436・TemplateEditor 400)の分割**: 管理画面は Apple HIG での作り直しが別作業として決まっているので、今分けると二度手間になる(Claude 判断・作り直しの時に 1 仕事 1 ファイルで書く)。
- firestore.rules(Firebase の仕様で 1 ファイル。例外に登録済み)。

## ① 意味単位の分割(39 本)
スキル project-hygiene「分け方の決まり」に従う: 切る所は仕事の境目にする・上限まで詰めない・名前に「+」が要るならまだ混ざっている・CSS は順番を保ったまま見出しで切る・切れない物は無理に切らず報告。検証: tsc 0 / 対象テスト通過 / テスト名の一覧が同じ / CSS は compare-build で欠け 0 / visual-regress の該当画面が一致。

担当の組(同じ画面のものを 1 組にまとめ、ファイルは組をまたいで重ならない):
| 組 | ファイル |
|---|---|
| A 表(標準) | timeline/MitigationItem.tsx・Timeline.tsx・MobileTimelineRow.tsx・GridOverlay.tsx・timeline/TimelineMobileSheets.tsx・__tests__/Timeline.sheet.test.tsx |
| B 窓・取り込み | ShareImportSheet.tsx・LocalImportDialog.tsx・__tests__/LocalImportDialog.test.tsx・__tests__/LimitResolutionSheet.test.tsx・NewPlanModal.tsx・EventForm.tsx・MitigationSelector.tsx・lib/sheetImport/__tests__/gridRowsFromResult.test.ts |
| C 設定・サイドバー・法務 | PulseSettings.tsx・PartySettingsModal.tsx・sidebar/ContentTreeItem.tsx・LegalPage.tsx・styles/stgy.css |
| D MIL-SPEC | military/MilspecContentTree.tsx・styles/military/standard-parts.css・styles/military/primitives.css |
| E ハウジング 見る側 | housing/browse/ListingCard.tsx・ListingCard.css・EphemeralAddPanel.tsx・housing/tour/TourNavMap.tsx・TourNavMap.css・__tests__/housing/BrowseWardMap.test.tsx |
| F ハウジング 登録側 | housing/register/HousingRegisterImageField.tsx・housing/edit/__tests__/HousingEditSourcePanel.test.tsx・pages/__tests__/RegisterPage.multiUrlMerge / multiUrlYoutube / editRegression.test.tsx・__tests__/housing/parseHousingFromText.test.ts |
| G サーバー・道具 | api/share/index.ts・api/share/_housingerPageHandler.ts・lib/collab/collabProvider.ts・scripts/sticky-scroll/frame-sync.mjs・scripts/delete-legacy-users.ts |

## ② commit 直前の見張り
- `.husky/pre-commit` の gitleaks の後に `./node_modules/.bin/vitest run src/architecture/__tests__ --reporter=dot` を足し、失敗したら exit 1(スキル「セットアップ」8)。数秒で終わる見張りだけを入れ、全件のテストは入れない。
- 共通の見た目の見張り: 雛形 `shared-look.test.ts`+`shared-look.json` を `src/architecture/__tests__/` に置く。見張る書き方は棚卸し(③)で決める。候補は「浮かぶ面の手書き(float-surface 以外の背景+ぼかし+影)」「角の丸みの直書き」「お知らせの手書き」。今ある数は凍らせて、減らすだけにする。わざと 1 本足して落ちることを確かめる。
- `.claude/rules/` の部品用の決まりに「新しい UI の前に共通の部品を探す・凍らせた書き方はまねしない」を短く足す。

## ③ 点検(重複・名前・古い記録)
読むだけの棚卸しを先に行い、一覧を `docs/.private/2026-10-28-ideal-finish-audit.md` に置く。
- 重複: 同じ見た目・同じ処理が 3 か所以上ある物 → 共通の部品へ(② の見張りの対象にもする)。
- 名前: ファイル名と中身の仕事が合わない物・名前に「+」「Misc」「Utils」の類が付いた物。
- 古い記録: 撤去済みの機能(みんなの軽減表 等)を指すコメント・文書・翻訳キー・設定の残り。docs は TODO_COMPLETED や DESIGN_DECISIONS と食い違う記述。
直す時は「消さずに移す」を基本にし、コードは tsc / knip / テストで確かめる。

## ④ 外側を押したときの動き
**決まり**(masaya 10-27・10-28): 浮かぶもの全部で「外側を押す=閉じるだけ。その 1 回は下の物に届けない」。閉じないのは、入力の途中のときと処理中のときだけ。窓・シートは 10-27 に ModalShell の backdropClose で済んでいる。
**今**: メニュー・押した所に出る窓・ドロップダウンの外側検知が 33 か所で手書きになっている。mousedown と click が混ざっていて、どれも押した操作が下へ届く。
**仕組み**(Claude 判断): 共通のフック `src/hooks/useDismissOnOutside.ts` を作る。
- `pointerdown`(capture)で、押した所が中か外かを決める。中とみなすのは、パネル本体・開くボタン・パネルから portal で出した子(引数で ref の配列を渡す)。
- 外なら閉じる。続く `click` を 1 回だけ capture で止めて、下へ届けない(下の物の mousedown 系で動く処理も届かないかは、実装の最初に 33 か所の下にある物を確かめて決める)。
- 中で押して外で離した場合は閉じない。チュートリアル中は閉じない(useEscapeClose と同じ扱い)。
- 重なったときは一番手前のものだけが反応する(useEscapeClose と同じスタック方式)。
- 対象外: Tooltip / MilspecTitleTooltip の「押したら隠す」(閉じる物ではない)、範囲選択、引っ張って更新、スクロールの見た目の切り替え、MilspecKey。
- 見張り: `src/**`(テストとフックを除く)で document/window に `mousedown|pointerdown|click` を足して外側を判定する書き方を禁止する(今の数で凍らせて 0 にする)。
- 動きのテスト: フック単体(外で閉じる・下に届かない・中で押して外で離すと閉じない・重なりは手前だけ)+実ブラウザ(Playwright)で代表 5 か所(ヘッダーのツールメニュー・言語切替・ハウジングの並び替え・通知のベル・右クリックメニュー)。

## ⑤ これまでの宿題の回収(masaya 10-28「全体を妥協なく」で追加)
TODO.md に残った小物を全部片付ける: (a) MIL-SPEC の見張りが「起動時の MIL-SPEC 部品に隣の CSS」を止めない (b) `.milspec-mh-rl` が boot-parts にある(本来 standard-parts) (c) `src/__tests__` を noCircularImports と同時に回すと止まる (d) 属性だけ・要素だけの規則が順番の見張り(cssRules.mjs findOrderPairs)に掛からない (e) colocate.mjs が途中で throw すると書き換えが半端に残る(書く前に全部の行き先を検査) (f) 全体実行の時だけまれに落ちるテストの根因 (g) plans の copyCount/useCount(firestore.rules を先に緩めて deploy→コードから消す。rules の deploy は masaya に確認してから)。

## ⑥ CSS のテーマ指定を部品から抜く(スキル project-hygiene「CSS とフォルダの理想の形」)
今は部品の CSS 約 50 本にテーマの指定(`[data-theme]` 等)が書かれている。理想は「テーマは決まりの名前(CSS 変数)に値を入れるだけ・部品は var() を読むだけ」「強さの順番は @layer で 1 か所に宣言」「定義の無い var() を見張る」。書き換えを伴うので、まず測って(本数・種類)から別の設計書に起こし、1 部品ずつ visual-regress で一致を確かめて進める。見張り=部品の CSS のテーマ指定の数を凍らせて減らすだけ。

## 並行の順番
- **波 1(同時に)**: ② の pre-commit 部分・③ の棚卸し(読むだけ)・④ の共通フックとテスト・① の組 A, B, D, F, G。
- **波 2**: ④ の 33 か所の乗せ替え(① の組 C, E と重なる PulseSettings・PartySettingsModal・ListingCard を含むので、組 C, E は乗せ替えの後に行う)。② の共通の見た目の見張り(③ の結果を使う)。
- **波 3**: ③ の修正・組 C, E の分割・⑤ の宿題(波 1 から並行可。ファイルが重ならない物から)
- **波 4**: ⑥ テーマ指定の抜き出し(① の分割が終わってから。分割と同じ CSS を触るため)→ 最終ゲート(test:gate・build・visual-regress 全体・compare-build)。
- 担当(Sonnet)は別 worktree で作業し、commit はしない。親が検収して cherry-pick・commit する(memory: 並行稼働中に親が commit すると混入するので、検収は担当が終わってから)。

## 合格(最後に 1 回)
test:gate 失敗 0・build 0・tsc 0・knip 0・visual-regress 全体一致(④ で意図して変えた「下に届かない」による差は理由つきで基準を更新)・compare-build 欠け 0・file-size の見張りで 400 行超は理由つきの物だけ。
