# 浮かぶもの(窓・シート・通知・メニュー・ツールチップ)の見た目の統一 設計書

2026-10-28 masaya と決定。見本=`docs/.private/2026-10-28-floating-surface-mockup/index.html`(gitignore 済・案 C を選択)。

## なぜ

軽減表(標準テーマ)の画面の上に浮かんで出てくるもの(窓・下から出るシート・通知・コピー中の帯・小さなメニュー・ツールチップ・押した所に出る窓)が、部品ごとにバラバラな見た目になっている。理由は、機能を足すたびに個別に見た目を書いてきたから(共通の殻 ModalShell と中身の部品 ModalParts ができたのは 2026-10-26)。

- 例: 窓(ModalShell)=ダークは透けるガラス・ライトは白地 / 通知(Toast)=ライトでも半透明(`rgba(255,255,255,.15)`) / コピー中の帯・取り込みメニュー=透けない `bg-app-bg` / 下から出るシート 3 本=独自の見た目。
- MIL-SPEC では、色の決まり(意味トークン)が `.theme-military` でまとめて MIL-SPEC 用に差し替わるため、標準の部品で描いた浮かぶものまで「古い MIL-SPEC 風」に染まる(masaya 指摘: イベントコピー中の帯)。標準へ掛け戻す仕組み `src/styles/military/standard-revert.css` は `.theme-military .milspec-app .glass-tier3` の内側にしか効かず、body 直下へ出る窓(ModalShell は portal)や glass-tier3 を使わない帯には効かない。

## ゴール

1. 浮かぶものは全部、**1 つの素材**(背景・透け方・ぼかし・縁・影・文字色)で描く。素材は見本の **案 C「ガラス強め」**。ライトもダークも案 C(色の値だけライト用/ダーク用)。
2. **MIL-SPEC のときも、浮かぶものは標準のダーク/ライトで描く**(MIL-SPEC のダーク→標準ダーク、MIL-SPEC のライト→標準ライト)。MIL-SPEC 用の窓は作らない(masaya 10-28。旧計画の SP4「編集モーダルの軍事化」はやらない)。
3. 新しく浮かぶものを作る時に、同じ素材を使わないと落ちる見張り(テスト)を付ける。

## 素材の値(見本の案 C そのまま)

| | ダーク | ライト |
|---|---|---|
| 背景 | `rgba(255,255,255,.04)` | `rgba(255,255,255,.55)` |
| ぼかし | 12px | 20px |
| 縁 | 1px `rgba(255,255,255,.18)` | 1px `rgba(0,0,0,.08)` |
| 影 | `0 16px 48px rgba(0,0,0,.30)` | `0 8px 32px rgba(0,0,0,.08)` |
| 内側の上辺の光 | `inset 0 1px 0 rgba(255,255,255,.06)` | 同じ |
| 文字 | 標準の `--color-text-primary` / muted | 同じ |

- 窓と下から出るシートだけ、後ろに暗幕(今の ModalShell と同じ `bg-black/50 backdrop-blur-[2px]`)。通知・帯・メニュー・ツールチップ・押した所に出る窓は暗幕なし。
- **変わる所の注意**: ライトの窓は今「白地(透けない)」→ 案 C で「透けるガラス」になる。これは masaya が見本のライトで見て選んだ結果(意図した変更)。ライトで文字が読みにくくならないかは実装後に実機で masaya が見る(公開前の確認一覧に足す)。
- 色の値は CSS 変数(トークン)として 1 か所に置く。CSS の決まり(`.claude/rules/css-rules.md`)どおり `backdrop-filter` は `--tw-backdrop-blur` 経由。

## 形(役割ごとに違ってよい・今の形を保つ)

素材だけ揃え、大きさ・出る場所・角丸・出方の動きは今の各部品のまま(見本でもそうした)。ただし同じ役割どうしは揃える: 真ん中の窓=角丸 16px / 下から出るシート=上だけ 20px / 通知・帯=12〜16px / メニュー=10px / ツールチップ=8px / 押した所に出る窓=12px。中身(見出し・×・ボタン・入力欄)は既存の ModalParts を使う。

## 対象

軽減表まわり(`src/components/` のうち housing・admin・military を除く)で、画面の上に浮かんで出るもの全部。今の時点の候補(実装時に漏れなく棚卸しし直す):

- 真ん中の窓: ModalShell を使う 22 本(殻の既定の枠を案 C にすれば一括で変わる)
- 押した所に出る窓: MitigationSelector・BoundaryEditModal・EventModal ほか、AASettingsPopover・ClearMitigationsPopover・PartyStatusPopover・timeline/sheet の SheetHiddenPopover・SheetTargetPopover・timeline/TimelinePopovers
- 下から出るシート: MobileBottomSheet と、独自の見た目の LimitResolutionSheet・ShareImportSheet・fflogsImport/FFLogsMobileSheet・MobilePartySettings・MobileContextMenu
- 通知: Toast・progress/ProgressRecordToast・timeline/sheet/PlacementToast・RenderPendingIndicator・ImportProgressOverlay
- 帯: TimelineDialogs のコピー中の帯・Memo/MemoFloatingBar・timeline/TimelineModeBars・sidebar/SidebarFloatingBar
- 小さなメニュー: ImportMenu・HeaderToolsMenu・HeaderPhaseDropdown・HeaderGimmickDropdown・HeaderMechanicSearch・HeaderTimeInput・LanguageSwitcher・JobPicker・ui/ContextMenu・pip/PipEditMenu・collab/PresenceControls・Memo/MemoInputBox・MobileFab の開いた中身(fab/*)
- ツールチップ: ui/Tooltip(TOOLTIP_BOX_CLASS)・timeline/sheet/SheetColumnTooltip
- チュートリアルの説明の箱: tutorial/TutorialCard・TutorialMenu(Claude 判断で対象。説明の窓だから)

## 対象外

- ハウジング(`/housing`・独自の世界観)
- 管理画面(`/admin`)。**別プロジェクトで Apple の Human Interface Guidelines に沿って作り直す**(スマホ操作対応も含む・masaya 10-28)ので、今回は触らない(二度手間を避ける Claude 判断)
- MIL-SPEC 専用の部品(`src/components/military/` 配下)。ただし MIL-SPEC の画面で出る標準の浮かぶものは対象(ゴール 2)
- 画面の一部として常に出ているもの(ヘッダー・サイドバー・下のナビ・フッター・FAB のボタン本体・表の上の覆い)
- 演出(チュートリアルの PillFly・PaletteHint・PartyAutoFill・CompletionCard 類・ProgressCelebration・ドラッグ中の影 PartyDragGhost・TutorialOverlay/Blocker の暗幕)
- LandingPage・WelcomeSetup・MobileGuide(初回の案内画面。窓ではなく画面)

## 見張り(テスト)

- 「浮かぶもの」を見つける規則(例: portal で body 直下に出す/`fixed` で z の高い要素)に当たる部品は、共通の素材のクラス(または殻)を使っていること。使わない部品は理由つきの例外一覧に載せる(載せ替えたら一覧から消す・消し忘れも落ちる)。既存の `src/components/ui/__tests__/ModalShell.guard.test.ts` と同じ作法。
- MIL-SPEC の画面で、浮かぶものの意味トークンが標準の値になっていること(既存の `military-overlay-island.test.ts` の作法を広げる)。
- 見張りが本当に落ちることを、わざと壊して一度確かめる。

## 確かめ方

- `npm run test:gate` 失敗 0・`npm run build` 成功・tsc 0。
- 見た目の自動比較 `scripts/visual-regress/`: 浮かぶものの写真は変わる(意図)。変わった一覧が「浮かぶものだけ」であることを確かめ、基準を撮り直す。浮かぶもの以外の写真が変わったら不具合。
- MIL-SPEC の画面で、コピー中の帯・共有の窓・通知・ツールチップが標準の見た目で出ることを本番ビルドで確かめる。
- masaya の実機確認(公開前の一覧 `docs/.private/2026-10-22-big-update-announcement-list.md` に足す): ライトの窓が読みやすいか/MIL-SPEC の上で浮かぶものが標準の見た目か。

## 事前レビューで決めたこと(2026-10-28)

1. **MIL-SPEC で標準に戻す範囲=外枠だけでなく中身も全部**(見出し・文字・ボタン・入力欄・アイコンの色まで)。masaya「MIL-SPEC 用の窓は作らない、標準のダーク・ライトのものをそのまま使う」より。浮かぶものの根で、意味トークン一式を標準の値に掛け戻す(standard-revert.css の `--std-*` と同じ考え方)。
2. **事実(確認済み)**: テーマのクラスは `<html>` に付く(`src/store/useThemeStore.ts` の applyThemeClasses: `theme-dark`/`theme-light` + MIL-SPEC なら `theme-military`)。body 直下へ portal で出す窓も `.theme-military` の内側になる=今は MIL-SPEC 色に染まる。MIL-SPEC のライト/ダークは標準と同じ `theme-light`/`theme-dark` で分かるので、**CSS だけで決められる**(状態の受け渡しは要らない)。
3. ModalShell を使う窓で、className で背景・縁などを個別に上書きしているものは、棚卸しで見つけて上書きを外す(一括で変わらない分は 1 本ずつ。Claude 判断)。
4. **ライトで読みにくい所が出たら**: 案 C の値は固定せず、Claude が「背景の濃さを上げた値」を見本で並べて masaya が選ぶ(実機確認の結果による差し戻しを許す・Claude 判断)。
5. visual-regress の振り分け: 変わった写真の一覧を撮影 id ごとに Claude が目で見て、浮かぶもの以外が変わっていたら不具合として直す。浮かぶものだけになってから基準を撮り直す(Claude 判断)。
6. 見張りの規則は**見逃しを出さない方を優先**(拾いすぎは理由つきの例外一覧で受ける。例外一覧が長くなってもよい・Claude 判断)。
7. MemoInputBox・MobileFab の開いた中身など括りが曖昧なものは、棚卸しで「画面の上に浮かんで出て、閉じれば消えるか」で決める(Claude 判断)。

## 作る人に任せること

- 素材のクラス名・トークン名・置き場所(1 ファイル 1 仕事。共通の見た目は共通の部品から)。
- 「浮かぶもの」の機械的な見つけ方の規則と、例外一覧の中身。
- 部品ごとの載せ替えの順番と、ModalShell・MobileBottomSheet などの殻に載せるか、素材のクラスだけ付けるか。
- MIL-SPEC で標準に掛け戻す仕組みの作り(standard-revert.css を広げる・浮かぶもの側で標準トークンを付け直す 等)。
