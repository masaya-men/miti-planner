# MIL-SPEC v11 移植 — 区画③ 表の操作列 + ジョブ差込口 + 表 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軍事テーマの表の操作列・ジョブの差込口(J1〜J8 と基板)・表(見出し・行・効果アイコン・照準・描き込み)を、見本 v11 と同じ見た目・同じ動きにする。表の機能は 1 つも欠かさず、標準テーマの表は 1px も変えない。

**Architecture:** 操作列とジョブ欄は今の `Timeline.tsx` の controlBar の中に残し(横スクロールで列と一緒に動く・Timeline 内の状態をそのまま使える)、`isMilspecTable` のときだけ軍事専用の部品(`MilspecControlDeck` と差込口の `JobPickerRow` の見た目)に切り替える。標準の分岐の JSX は触らない。表の行・効果アイコンは DOM を変えず、軍事の CSS(見本 css:455-546)と小さな軍事専用の層(照準 1 個・描き込み・並び替えの FLIP)を足す。光は区画①の光エンジンに基板の経路 `bp:*` と `lk:tb` を足す。

**Tech Stack:** React 19 + Vite 7 + TypeScript / zustand / vitest / Playwright

**Spec:** `docs/superpowers/specs/2026-09-25-milspec-polish-design.md`(§6 性能・§11・末尾 2026-10-21 追記)。正典 = `C:\Users\masay\Desktop\FF14Sim\docs\.private\theme-refs\milspec-v11.js` / `milspec-v11.css`(以下 `js:` `css:`)。SP2 表点検 = `C:\Users\masay\Desktop\FF14Sim\docs\.private\2026-10-21-milspec-sp2-row-audit.md`。

## 決定事項(2026-10-21・Claude 判断・masaya が後で変更可)

- 見本と同じ完成度・同じアニメーション最優先(masaya)。表の常時アニメ(致死の斜線 crawl-v・効果帯のホバー時の光)も見本どおり入れる(spec §6 の「表内に常時アニメなし」を 2026-10-21 の決定で上書き)。**重さは `scroll-perf.mjs` で変更前後を測って報告する(合格条件にはしない)**
- 表の行の高さは本番の作り(1 段 25px × 攻撃数)のまま(spec §11)。見本の行の高さ・縦位置の補間は移植しない
- 致死: 行全体を赤くしない(spec)。致死の攻撃段だけ左に見本の斜線(css:502-503)・数字を赤(css:500)。SP2 で「全段に付く」問題(`:has(.dmg-slot.lethal)` が行全体の段に効く)は段単位に直す
- 操作列のキーの割り当て(見本 → 本体): 表を展開(横スライド)= hideEmptyRows / メモ(横ロッカー)= toolMode 'memo' / 罫線 = showRowBorders / 表示切替 = PiP(押すとメニュー・今のホバーで開く動きも残す)/ リキャスト = recastRowVisible / AA追加(キー)= AA 設定ポップオーバー(今の AA モードの切替動作も残す)/ 元に戻す・やり直す(丸キー)/ 軽減の削除メニュー(赤アイコンのキー)。キーを押すと `trafficBp(150)`、スイッチは `trafficBp(260)`(表を展開は 560)(js:1072-1081, 1022-1023)
- 差込口: 表示メンバーの数だけ(8 未満なら減らす)。並び順 = 今の表の列の順(partySortOrder)。ライトパーティ境目の IC `U2`(見本 j===3)は「ライトパーティ順のときだけ」置く(ロール別では蛇行配線)
- 照準: 表の中身(スクロールする側)に 1 個置き、スクロールしても対象と一緒に動く
- 行の描き込み(printRows): 見えている行だけ(全行の強制レイアウトはしない)。きっかけ = プランの切替・コンテンツの切替・電源投入(`milspec:power` の on)

## Global Constraints

- 区画①②の Global Constraints をすべて引き継ぐ(標準テーマ 1px 不変・`standard-invariance` / `military-smoke` / `no-video-in-standard` exit 0・`.theme-military` 前置・`milspec-` 接頭辞・`--ma-*` 読み替え・i18n 5 言語同時で該当ブロックだけ編集・見本ファイルはコミットしない・テストは `__tests__/`・コミットは一時ファイル + `git commit -F`・末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`・コメント日本語・実装役はサブエージェントを起動しない)
- `Timeline.tsx` / `TimelineRow.tsx` / `JobPickerRow.tsx` / `MitigationItem` は標準と共有。**標準の分岐の JSX・class・DOM は変えない**。軍事の分岐は `isMilspecTable` の中だけ
- military-smoke の表の step(3〜6, 8, 11, 13, 14)のセレクタ契約: 変える場合は smoke を同じタスクで直す。`#timeline-controls-inner [data-member-id]`(列の実測元・smoke step 11)は軍事でも残す
- 見本 css:619 の全称 `*{animation:none}`(reduced)は `.theme-military` 配下に閉じる
- vitest は `node node_modules/vitest/vitest.mjs run --pool=forks <ファイル>`。型は `rtk npx tsc -b`

## Review Focus

1. **列の位置がずれる**(差込口・基板・効果アイコン・表の列)— 差込口の位置は `useMeasuredMemberLayout` と同じ実測(memberLayout)から。表示メンバー数 8 未満・並び替え・横スクロール・サイドバー開閉 → Task 3 のテスト + smoke step 11
2. **表の機能の欠け**(AA モード・PiP メニュー・軽減の削除の確認・undo/redo の無効・読み取り専用)→ Task 2 のテスト
3. **標準の表が変わる** → 全タスクで standard-invariance
4. **照準がスクロール中にずれる / 消えない** → Task 5 のテスト + smoke
5. **描き込みが全行で走って固まる** → Task 6 のテスト(見えている行だけ)

---

### Task 1: 表の区画の装甲と画面(zb)・操作列の区画(zt)の器

**Files:** `MilspecWorkspace.tsx`(+ テスト)/ `Timeline.tsx`(controlBar の外枠に軍事のときだけ class / 高さ 40・下に 4px)/ CSS(表用・新ファイル可)

- 表の装甲 = 見本 js:966-967(輪郭・画面の窪み `fill: var(--ma-screen-bg)`・wx)を表の区画(操作列の下端 + 4px 〜 区画の下端)に `MilspecArmor`。四隅の印(js:975)・縁の暗がり(js:974・css:545-546)・刻印 `T-DISP` `SCOPE 1 · TL-FEED`(js:976)。旧 `.milspec-ws` の装甲・飾りは撤去
- 操作列の器: 軍事のとき controlBar の外枠を高さ 40(見本)、表との間 4px。中身は Task 2・3
- テスト: 軍事で装甲と刻印がある / 標準で何も変わらない(既存テスト)

- [ ] TDD → Commit `feat(milspec): 表の区画の装甲と画面・操作列の器`

### Task 2: 操作列のキー(MilspecControlDeck)

**Files:** Create `src/components/military/table/MilspecControlDeck.tsx`(+ テスト)/ `Timeline.tsx`(controlBar の内側を `isMilspecTable ? <MilspecControlDeck {...今のボタンが使う値と関数と ref} /> : <今の JSX>`)/ CSS

- 見本 js:942-962 をそのまま: 装甲 tb(輪郭・scribe・wx)+ 括弧見出し `TABLE DISPLAY 表示`・`EDIT 編集`(css:106-108)/ 横スライド「表を展開」(css:245-258・slideKnob 620ms js:722-731)/ 横ロッカー ×4(js:947-949・hrH js:276・css:182-214)/ キー 3 列(AA追加 = aaOut・元に戻す/やり直す = stadium + 丸キー・軽減の削除メニュー = trOut の赤アイコン)/ 赤い差し色(js:958)/ 副装甲 bp(js:959-961・基板の床の窪み)/ 漏れ光 `lk:tb`(`M 0 -2 H 幅`)
- ポップオーバー(AASettingsPopover・ClearMitigationsPopover・PiP メニュー)は今の ref の代わりにキーの button を triggerRef に(位置は getBoundingClientRect 基準なので見た目に依存しない)
- 光: キー `trafficBp(150)`・スイッチ `trafficBp(260)`・表を展開 `trafficBp(560)`
- テスト: 各キー/スイッチで今と同じ store 操作・ポップオーバーが開く・読み取り専用で押せない・undo/redo の無効表示・aria(role=switch・aria-checked・aria-label)

- [ ] TDD → standard-invariance・smoke(step 3〜6 を新キーで押すよう直す)→ Commit `feat(milspec): 表の操作列を v11 のキーとスイッチに`

### Task 3: ジョブの差込口と基板(J1〜J8)

**Files:** Create `src/components/military/table/backplane.ts`(純関数・見本 buildBackplane js:431-466 → SVG 文字列)+ テスト / Create `table/MilspecJackRow.tsx`(+ テスト)/ `JobPickerRow.tsx`(任意の `variant?: 'socket'` を追加。標準は既定で不変)/ `Timeline.tsx`(軍事のとき variant と基板層)

- 差込口 = 見本 css:379-392 の 34×26(フランジ・六角ナット ×2・シェル・口)+ ジョブアイコン。`data-member-id` を残す。クリック = 今の handleJobIconClick・右クリック = 今の解除
- 基板 = 列の中心 x(memberLayout の left + width/2)から見本の式で: バス `bp:b0..3`・扇 `bp:f{j}{r|l}{0..5}`(端子 via)・列間の蛇行 `bp:m{j}{0..1}` + SMD + via(`b−a < 8` は省略)・ライトパーティ順のときだけ j=3 の IC `U2` と `LP1 | LP2`・シルク `J1..`・`BUS`
- ホバーで `burst('bp:f{j}r'/'l', { n: 6, stagger: 16, len: 6 })`(js:465)
- 並び替え(partySortOrder の変化)= 差込口が抜けて浮いて滑って刺さる(js:657-664・880ms・delay 30+rand*90)+ 760ms 後に burst。効果アイコンも 820ms で滑る(js:640-647。MitigationItem の左位置の変化を FLIP。軍事のときだけ)
- テスト: 列中心からの経路名と数(8 人 / 6 人)・ライトパーティ順だけ U2・クリックで handleJobIconClick・並び替えで animate が呼ばれる(reduced で呼ばれない)・smoke step 11 の列整合

- [ ] TDD → smoke → Commit `feat(milspec): ジョブの差込口と基板(並び替えで抜けて滑って刺さる)`

### Task 4: 表の見出しと行の見た目(CSS 中心)

**Files:** CSS(military.css の表の規則 1195-1299 を見本 css:455-507 に置き換え)/ `TimelineRow.tsx`(軍事でだけ効く data 属性の追加が必要な場合のみ・標準の見た目は不変)

- 見出し(css:461-471・ロール色線 css:475・見出しボタンの下線 300ms)/ ゼブラ(css:478)/ 行ホバー + 左バー `::after`(css:479-482)/ 段ホバー(css:493)/ 致死の段の斜線 crawl-v(css:502-503)と数字の赤(css:500)— 段単位(SP2 の全段問題を直す)/ 同時刻の括弧 + ×N(css:488-489)/ 攻撃の種類の色帯(css:496-497)/ フェーズの縦書き(css:504-506)/ 時刻・ダメージの数字(Plex Mono 10.5px css:486, 498)
- 旧の行ごとのぼかし影・全セル影・メンバー列の ::after 点(military.css 1211-1260)は見本に無いので撤去
- ライトテーマの値(見本 #app.pc の該当)
- リキャスト帯は今の位置のまま、見た目を見本の質感(装甲の帯・刻印)に合わせる

- [ ] standard-invariance・smoke・Timeline 関連 vitest → Commit `feat(milspec): 表の見出しと行を v11 の見た目に(致死は段単位の斜線)`

### Task 5: 効果アイコン・照準

**Files:** CSS(css:507-517)/ `MitigationItem`(軍事でだけ効く終点の目盛り要素が必要なら追加・標準は不変)/ Create `table/MilspecReticle.tsx`(+ テスト)/ `Timeline.tsx`(軍事のとき sheetContainer の中に 1 個)

- 効果アイコン(角丸・影・ホバーで浮く)・効果帯(見本のグラデ・ホバーで charge の光 1s)・終点の目盛り(10×1・#9fe6f7)
- 照準 = 見本 js:1027-1053 / css:518-539: sheetContainer に pointerover を 1 個(委譲)・対象 = 効果アイコン / 攻撃段 / 時刻セル / 見出しボタン・四隅 + 十字 + タグ(readout は見本の書式)・右端で flip・lock のキーフレーム・pointerleave で消える。座標は sheetContainer 基準(スクロールで一緒に動く)
- テスト: 対象に乗ると位置とタグ・離れると消える・reduced で transition なし

- [ ] TDD → smoke → Commit `feat(milspec): 効果アイコンの帯と終点・表の照準`

### Task 6: 行の描き込み(printRows)と光の配線

**Files:** Create `table/printRows.ts`(+ テスト)/ `Timeline.tsx` または MilspecWorkspace(購読)/ CSS(css:540-542)

- `printRows(container: HTMLElement, base: number): void` — 見えている `[data-time-row]` だけに class を付け直し(`--d = base + i*32ms`・printin 300ms)、効果アイコン層を `base + 行数*32 + 60` 後に 360ms で表示(js:672-676)
- きっかけ: プラン切替(200)・コンテンツ切替(160)・`milspec:power` の on(620)
- 光: 表側の energy(`trafficBp` / `lk:tb`)は区画①のエンジンがそのまま使う(経路が DOM にあることを確認)
- テスト: 見えている行だけ・reduced で何もしない・タイマーが残らない

- [ ] TDD → Commit `feat(milspec): 表の行の描き込み(見えている行だけ)`

### Task 7: 検査・計測・突き合わせ

- `zone-shot.mjs` に `--zone=table`(見本 `#z-tb` + `#z-tbl`)
- `scroll-perf.mjs --theme=military --compare=base-military` を変更前後で同じ時間帯に交互に測り、結果を TODO に記録(合格条件にしない)
- ゲート: standard-invariance / military-smoke / no-video / zone-fit(表・操作列の違反 0)/ zone-shot table dark・light・en
- Commit `test(milspec): 表の突き合わせ・スクロール性能の計測`

## 実行の割り当て(司令塔用メモ)

- 区画②の Task 8・10 と、区画④⑤⑥の後に着手(Timeline・MilspecWorkspace・military.css が重なる)。順番は ②の残り → ④⑤⑥ → ③ でも、③ → ④⑤⑥ でもよい(MilspecLayout の行定義はどちらも触る → 直列)
- Task 2・3・5 のレビューは Opus(標準と共有のファイル)。他は Sonnet
