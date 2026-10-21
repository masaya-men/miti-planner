# MIL-SPEC v11 移植 — 区画④ フッター + レール / ⑤ 光の残り / ⑥ 大レバー + 電源投入 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フッターを見本 v11 の 22px の帯に、左レールを見本の基板レールにし、レールを走る光(rail:a / rail:b)を入れ、MIL-SPEC 表示のたびに見本の電源投入演出(暗転 → 区画が順に点灯 → ランプ順点灯 → 時計 → 銘板 → 全経路疾走 → タービン起動)を流す。

**Architecture:** 電源の状態は `<html data-ms-power="on|off">` に置く(光エンジン・CSS はこれを読む)。電源投入/断は `src/components/military/power.ts` の `powerOn()` / `powerOff()` が属性を書き換え、`window` へ `milspec:power` イベント(`detail: { state, reduced }`)を出す。各部品(CRT・ランプ・時計・銘板・タービン・表の描き込み)はこのイベントを購読して自分の演出を流す(部品どうしを直接つながない)。MODE レバー(区画②の ModeLever)が電源のスイッチになる。

**Tech Stack:** React 19 + Vite 7 + TypeScript / vitest(happy-dom・`--pool=forks`)/ Playwright

**Spec:** `docs/superpowers/specs/2026-09-25-milspec-polish-design.md`(§8 電源投入・§11・末尾 2026-10-21 追記)。正典 = `C:\Users\masay\Desktop\FF14Sim\docs\.private\theme-refs\milspec-v11.js` / `milspec-v11.css`(以下 `js:` `css:`)。前例 = 区画①②の計画(`docs/superpowers/plans/2026-10-21-milspec-v11-sidebar.md` / `-header.md`)。

## 決定事項(2026-10-21・Claude 判断・masaya が後で変更可)

- 見本と同じ完成度・同じアニメーション最優先(masaya)
- **フッター** = 見本 js:985-991(22px・装甲・`MIL-SPEC` 刻印・著作権 1 行・右に 法的情報▴ / Discord / X)。見本の「パルス設定」は置かない(撤去済み)。法的情報の中身は今の 4 項目(`/privacy` `/terms` `/about` `/about#contact`)を見本の見た目(css:549-555)で。リンクの下線は見本の信号線(css:556-562)。旧フッターの飾り(2 プレート・ハーネス・カーソル座標・計器・回転注意・排熱ファン 2 基)は撤去
- **レール** = 見本 buildRail js:397-415 + 縦の取っ手 js:861(パンチング・彫り込み・基板・バス rail:a0-7 / rail:b0-7(a の続きが b)・IC U7・ビア・柵・SMD・刻印 SIG-A / PULL・リベット)。高さは区画の実高(H)に合わせて縦に伸ばす(バス B の下端 = H−12、リベットは H に収まるものだけ)
- **サイドバーの開閉** = レールの取っ手で、見本 js:1093 の `tug` → 開閉(見本 `relayout('sb')` と同じ残像と FLIP)→ 200ms 後に `burst('rail:a',{rev:true,stagger:20})` `burst('rail:b',{stagger:20,chain:false})`
- **電源投入は MIL-SPEC の画面が出るたびに流す**(spec §8「毎回流す」)。MilspecLayout がマウントされた時点では電源 off(`data-ms-power="off"`・区画は暗い)。MODE レバーは「上」から始まり、**700ms 後に自動で下りて**(見本 js:1228)`powerOn()`。`?noboot` が URL にある・`prefers-reduced-motion` のときは最初から on(演出なし)
- **軍事 → 標準** = レバーを上げる → `powerOff()`(300ms の電源断・見本 js:1158)→ 直後に `setThemeStyle('standard')`(spec §8「0.3 秒程度の短い電源断だけ」に合わせ、標準の PAINTING オーバーレイは使わない)
- **区画の順番**(電源投入で順に点灯・見本 js:9 の 7 区画を本体の 6 区画に): sidebar → rail → header → vent → workspace → footer(`--pd = 140 + i*60ms`)

## Global Constraints

- 区画①②の Global Constraints をすべて引き継ぐ(標準テーマ 1px 不変・`military-smoke` / `no-video-in-standard` exit 0・`.theme-military` 前置・`milspec-` 接頭辞・`--ma-*` 読み替え・i18n 5 言語同時で該当ブロックだけ編集・見本ファイルはコミットしない・テストは `__tests__/`・コミットは一時ファイル + `git commit -F`・末尾 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`・コメント日本語・実装役はサブエージェントを起動しない)
- 動きは見本の値(時間・イージング・キーフレーム・遅延・乱数の幅)をそのまま移す
- 部品ごとの CSS は部品の隣の CSS ファイルでもよい(区画②の前例)。全規則 `.theme-military` 前置
- vitest は `node node_modules/vitest/vitest.mjs run --pool=forks <ファイル>`。型は `rtk npx tsc -b`

## Review Focus

1. **電源 off のまま止まる**(自動で下りるタイマーがアンマウント・タブ非表示・素早い切替で消える)→ Task 3 のテスト「マウント後 700ms で on」「アンマウントでタイマーが残らない」
2. **軍事 → 標準に戻れない / 標準 → 軍事で演出が二重に走る** → Task 3 / Task 4 のテスト
3. **フッター 22px で法的情報の一覧が切れる・画面外に出る** → Task 1 の zone-fit + 一覧を開いた状態の検査
4. **レールの高さが 679 以外(720 / 1080 / 1440)で配線が切れる・はみ出す** → Task 2 のテスト + zone-shot の高さ違い
5. **「動きを減らす」で暗いまま・演出が出る** → Task 3 のテスト

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| Create `src/components/military/railGeometry.ts` | レールの見本座標(高さ H の関数) |
| Modify `src/components/military/MilspecRail.tsx` (+ CSS) | 見本のレール |
| Modify `src/components/military/MilspecFooter.tsx` (+ CSS) | 見本のフッター |
| Modify `src/components/military/relayout.ts` | `kind: 'sb'`(サイドバーの開閉の動き) |
| Modify `src/components/military/MilspecLayout.tsx` / `military.css` | フッターの行 22px・電源の初期状態・区画の暗幕 `.milspec-dim` |
| Create `src/components/military/power.ts` | `powerOn()` / `powerOff()` / `isPowered()` / `onPower(fn)` |
| Modify `header/ModeLever.tsx` | 電源スイッチとして動く(上 = off・下 = on・700ms 後の自動投入) |
| Modify `header/MilspecCrt.tsx` `header/MeterPanel.tsx` `header/Nameplate.tsx` / `MilspecVent.tsx` ほか | `milspec:power` の購読(各自の演出) |
| Modify `scripts/milspec-polish/zone-shot.mjs` / `scripts/milspec-sp2/military-smoke.mjs` / `scripts/milspec-polish/zone-fit.mjs` | フッター・レールの突き合わせ・操作・電源 |

---

### Task 1: フッター(見本の 22px の帯)

**Files:** `MilspecFooter.tsx` + テスト / CSS(フッター用・見本 css:549-562, 565-566)/ `military.css`(行定義のフッター `clamp(64px,5.5vw,82px)` → `22px`・表とのすき間 3px(見本 yF=657・表の下端 yF−3))

**Interfaces:**
- `MilspecFooter()` — `MilspecArmor id="ftr"`(pts = js:985 `[[0,0],[MW−10,0],[MW,10],[MW,22],[8,22],[0,14]]`・tone chs・b2・wx chips 0.6。MW = 区画の実幅・横は x > MW/2 の点が動く frame で可)/ 刻印 `MIL-SPEC`(12,8.5)/ 著作権(62,7.5)= `t('footer.copyright')` + ` · ` + `t('footer.disclaimer')`(静的・下線なし)/ 右寄せ(right 16・top 7.5・gap 16)= 法的情報▴(`aria-expanded`・押すと一覧が出る = 見本 js:1109 の WAAPI 300ms)・Discord・X(今のフッターと同じ URL・target=_blank・rel)
- 法的情報の一覧: 今の 4 項目を見本 `.legal-pop` の見た目(ボタンの上・left −12・bottom 18)で。外側クリックで閉じる(今の作りを残す)。フッターの区画は 22px なので、一覧は区画の外へはみ出して出す(overflow visible・z 順で表の上)
- 撤去: 2 プレート・ハーネス(`MilspecHarness` の import とファイル。他で使っていなければ削除)・カーソル座標・計器・回転注意・排熱ファン(`useTurbineCluster(2)` の呼び出し)。**旧タービン CSS(`.milspec-tb-cluster2` 等)はヘッダーの火花・蒸気が `.milspec-tb-spark` / `-steam` を使うので、それ以外の使われていない規則だけ消す**(grep で確認)
- テスト: 著作権・法的情報・Discord・X が出る / 法的情報で一覧が開閉(aria-expanded)/ 一覧の 4 項目のリンク先 / 旧ハーネス・ファンが無い

- [ ] Step 1〜4(TDD)/ Step 5: Commit `feat(milspec): フッターを v11 の 22px の帯に(法的情報の一覧・信号線の下線)`

---

### Task 2: 左レール(基板・光の経路・取っ手でサイドバー開閉)

**Files:** Create `railGeometry.ts` + テスト / Modify `MilspecRail.tsx` + テスト / `relayout.ts` + テスト / CSS(レール用・見本 css:335-353, 604-605, 565)

**Interfaces:**
- `railLayout(H: number): { L: number; busA: Pt[][]; busB: Pt[][]; ic: {...}; vias: ...; fence: ...; smd: ...; labels: ...; rivets: Pt[]; pull: { x: 4, y: number, w: 14, h: 44 } }` — 見本 js:397-415(バス A = `busPaths([[7,0],[7,84],[8.3,85.3],[8.3,172],[7,173.3],[7,250]],8,1.3)`・バス B = `[[7,270.5],[7,396],[5.7,397.3],[5.7,506],[7,507.3],[7,L]]`・L = H−12)。取っ手の y は見本 318(= H 679 の中ほど)→ `Math.round(H/2 − 22)`。リベットは y+20 が L 未満のものだけ
- 基板の SVG 文字列は `pcb.ts` の部品関数(`cu` `via` `silk` `smd`)で作る。経路名 `rail:a0..7`(`data-trace-next="rail:b{k}"`)・`rail:b0..7`
- `MilspecRail(props: { isSidebarOpen; onToggleSidebar })` — 見本の部品全部 + 縦の取っ手 `button.milspec-pull.is-v`(`aria-expanded`・`aria-label` は今の文言キー)。押す = js:1093(`tug` → 260ms 後に開閉 → 200ms 後に rail の burst)
- `relayoutZones(app, change, kind: 'hdr' | 'sb', reduced)` — 見本 js:763-781 の 'sb' 分岐(サイドバーの残像が左へ抜ける・他の区画が FLIP)。MilspecLayout の `onToggleSidebar` をこれでラップ(区画②の header と同じ作り)。キーボードでのサイドバー開閉があれば同じく動き付きに
- テスト: H=679 / 1080 で L・バス B の終点・取っ手の y / 経路名が DOM にある / 取っ手で開閉・aria-expanded / relayout 'sb' の動き(reduced で即時)

- [ ] Step 1〜4 / Step 5: Commit `feat(milspec): 左レールを v11 の基板に(光の経路・取っ手でサイドバー開閉の動き)`

---

### Task 3: 電源(power.ts・区画の暗幕・MODE レバーを電源スイッチに)

**Files:** Create `power.ts` + テスト / Modify `header/ModeLever.tsx` + テスト / `MilspecLayout.tsx` / `military.css`(見本 css:16, 140-141, 180, 333, 612-615 → `html.theme-military[data-ms-power="off"] ...`)/ `fx/engine.ts`(必要なら)

**Interfaces:**
- `power.ts`: `isPowered(): boolean`(属性 != 'off')/ `powerOn(opts?: { reduced?: boolean }): void` / `powerOff(opts?): Promise<void>`(300ms の電源断が終わったら解決)/ `onPower(fn: (e: { state: 'on' | 'off'; reduced: boolean }) => void): () => void`(`window` の `milspec:power` イベントの購読)
  - `powerOn` = 見本 js:1159-1179 の順: 属性 on → reduced なら終わり → 暗転 `div.milspec-blackout`(見本 `#blackout`・`{0→1(0.25)→0.85(0.5)→0}` 260ms)→ 各区画の `--pd`(決定事項の順・140+i*60ms)を設定して暗幕 `.milspec-dim` を透明へ(css:613 の transition)→ イベント発行(部品は各自の演出)→ 全経路疾走(js:1174-1176 の burst / coreFire / trafficBp / pulse の呼び出しをそのまま)→ 900ms 後 `scanBall`(通気口のランプ列を探して)
  - `powerOff` = js:1158: 暗転 `{0→0.7→0.1→0}` 300ms → `--pd` を 0 → 属性 off → イベント
- 区画の暗幕: 各 `[data-ms-zone]` に `span.milspec-dim`(aria-hidden・pointer-events none・z 30・off で opacity 0.55)。背景動画の暗幕(本体 `.milspec-backdrop-veil`)は off で 0.85(css:16 相当)
- `MilspecLayout`: マウント時に `data-ms-power="off"`(`?noboot` または reduced なら on のまま)。アンマウントで属性を外す(標準テーマに残さない)
- `ModeLever`: 位置 = `isPowered()` に追従(off = 上・on = 下)。マウント後 700ms で自動で下ろす(`settle(true)` → 240ms 後 `powerOn()`。見本 js:1228)。ユーザーが下ろす = powerOn。上げる = `await powerOff()` → `setThemeStyle('standard')`。`aria-checked` = 電源状態。タイマーはアンマウントで消す
- テスト: マウント直後は off・700ms+380ms+240ms で on / reduced・`?noboot` で最初から on / アンマウントでタイマーが残らない・属性が消える / 上げると powerOff の後に setThemeStyle('standard') / powerOn の順(暗転・--pd・イベント)

- [ ] Step 1〜4 / Step 5: Commit `feat(milspec): 電源の状態と MODE レバー(MIL-SPEC を開くたびに電源投入・戻るときは電源断)`

---

### Task 4: 部品ごとの電源投入の演出(イベント購読)

**Files:** `header/MilspecCrt.tsx` / `header/MeterPanel.tsx` / `header/Nameplate.tsx`(と useNameplateText)/ `MilspecLed` を使うランプ群 / テスト

**Interfaces(すべて `onPower` を購読。off では見本の消灯表示、on で次の演出):**
- CRT: `boot` を付け直し + 420ms 後に描き込み(js:1165)
- ランプ順点灯: 区画内の点灯中のランプ(NET 以外)を一旦消し、180 + i*45ms で点灯 + flick(js:1166)。対象はヘッダー・サイドバーの `MilspecLed` のうち on のもの(`document.querySelectorAll` で拾う実装でよい)
- 時計: transition なしで 0 → 380ms 後に `1.1 + k*0.12`s の transition で現在値へ(2200ms 後に transition を戻す)(js:1168-1169)
- 銘板: 空にして 520ms 後に表示(パタパタ)(js:1171)
- タービン: 1000ms 後に TRB を自動で押す(js:1178)
- 表の描き込み(`printRows(620)` js:1172)は区画③の担当(イベントを購読して流す)。この計画では何もしない
- off のとき: ランプ消灯(css:140-141)・時計のコロン(css:316)・CRT の画面が黒(css:333)・押し込まれた連動キーの下縁(css:180)— CSS で済むものは Task 3 の CSS

- [ ] Step 1〜4 / Step 5: Commit `feat(milspec): 電源投入の部品ごとの演出(CRT・ランプ順点灯・時計・銘板・タービン自動起動)`

---

### Task 5: 検査・突き合わせ

**Files:** `zone-shot.mjs`(`--zone=footer|rail`・`--power=on|off` の撮影・電源投入 1.5 秒後に撮る)/ `military-smoke.mjs`(step: レールの取っ手でサイドバー開閉・法的情報の一覧・電源が 2 秒以内に on になる・MODE レバーで標準へ戻る)/ `zone-fit.mjs`(フッターの既知の失敗が消える → **全区画で違反 0**)

- [ ] ゲート: standard-invariance / military-smoke / no-video-in-standard / zone-fit 全 exit 0 / zone-shot footer・rail を dark・light・en・高さ 679/1080 で exit 0 / 見本との突き合わせ(実装役が画像を見て差の一覧)
- [ ] Commit `test(milspec): フッター・レール・電源の突き合わせと操作検査`

---

## 実行の割り当て(司令塔用メモ)

- 区画②(ヘッダー)の Task 8・10 が終わってから着手(MilspecLayout・military.css・ModeLever が重なる)
- Task 1 と Task 2 はファイルが重ならなければ並行可(military.css の行定義は Task 1 だけが触る)。Task 3 → Task 4 は直列
- 実装 Sonnet・レビュー Sonnet、Task 3(電源の状態遷移)と最終レビューは Opus
