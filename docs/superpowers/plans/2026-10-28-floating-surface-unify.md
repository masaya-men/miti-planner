# 浮かぶものの見た目の統一 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 軽減表まわりの画面の上に浮かんで出るもの(窓・シート・通知・帯・メニュー・ツールチップ)を、1 つの素材クラス `.float-surface`(見本の案 C)で描き、MIL-SPEC のときも標準のダーク/ライトで出す。

**Architecture:** 素材は新しいクラス `.float-surface` と専用トークン `--float-*`(標準のダーク/ライトで値を持つ)。`glass-tier3` はヘッダー・サイドバーなど浮かばない所でも使われているので値を変えず、浮かぶものだけ `.float-surface` へ載せ替える。MIL-SPEC の掛け戻し(`standard-revert.css`)は今 `.theme-military .milspec-app .glass-tier3` だけに効くので、同じ節に `.float-surface` を足す(body 直下へ portal する窓は元から `.milspec-app` の外=標準)。崩れ止めは `ModalShell.guard` と同じ作法の見張りテスト。

**Tech Stack:** React 19 + TypeScript / Tailwind v4(Lightning CSS)/ vitest(happy-dom)/ Playwright(visual-regress)

**Spec:** `docs/superpowers/specs/2026-10-28-floating-surface-unify-design.md`

## Global Constraints

- 素材の値(spec の表そのまま): ダーク=背景 `rgba(255,255,255,.04)`・ぼかし 12px・縁 1px `rgba(255,255,255,.18)`・影 `0 16px 48px rgba(0,0,0,.30)` / ライト=背景 `rgba(255,255,255,.55)`・ぼかし 20px・縁 1px `rgba(0,0,0,.08)`・影 `0 8px 32px rgba(0,0,0,.08)` / 両方=内側の上辺 `inset 0 1px 0 rgba(255,255,255,.06)`・文字は標準の `--color-app-text`。
- `backdrop-filter` は直書き禁止。`--tw-backdrop-blur` 変数パターン(`.claude/rules/css-rules.md`)。
- 暗幕は窓と下から出るシートだけ(今の ModalShell と同じ `bg-black/50 backdrop-blur-[2px]`)。通知・帯・メニュー・ツールチップ・押した所に出る窓は暗幕なし。
- 形(大きさ・出る場所・角丸・動き)は今の各部品のまま。角丸だけ役割ごとに揃える: 真ん中の窓 16px(rounded-2xl)/シート 上だけ 20px/通知・帯 12〜16px/メニュー 10px/ツールチップ 8px(rounded-lg)/押した所に出る窓 12px(rounded-xl)。
- 対象外: `src/components/housing/`・`src/components/admin/`・`src/components/military/` 配下の MIL-SPEC 専用部品・常設の画面部品(ヘッダー・サイドバー・下ナビ・フッター・FAB 本体)・演出(チュートリアルの PillFly/PaletteHint/PartyAutoFill/CompletionCard 類・ProgressCelebration・PartyDragGhost・TutorialOverlay/Blocker の暗幕)・LandingPage・WelcomeSetup・MobileGuide。
- 1 ファイル 1 仕事・500 行以下(`src/architecture/__tests__/file-size.test.ts`)。生の色・文字サイズの直書きを増やさない(既存の見張り)。
- MIL-SPEC では浮かぶものの中身(文字・ボタン・入力欄)まで標準に戻す(spec「事前レビューで決めたこと」1)。

## Review Focus

1. **MIL-SPEC のボードの中にその場で描かれる浮かぶもの**(コピー中の帯・押した所に出る窓・メモの入力箱)が、portal されないため掛け戻しが効かず MIL-SPEC 色のまま残る → Task 1 の CSS テストで `.theme-military .milspec-app .float-surface` が掛け戻しの節にあることを固定し、Task 6 で本番ビルドの MIL-SPEC 画面で帯の背景色を実測する。
2. **ライトの窓が透けて文字が読みにくい**(表の色つきアイコンの上・動画背景の上)→ 自動では判定できない。Task 6 で masaya の実機確認一覧に足し、読みにくければ spec の決定 4 のとおり濃い値の見本を出す。
3. **素材を載せ替えた部品で、古い背景クラス(`bg-app-bg` 等)や inline の `--glass-tier3-bg` が残り、素材より後に効いて見た目が変わらない** → 見張り(Task 2)で「`float-surface` を持つ要素に `bg-` で始まる背景クラスと `--glass-tier3-bg` を同居させない」を検査する。
4. **ModalShell の `frame={false}` の窓・殻を使わない窓**が素材を付け忘れる → 見張りの対象を「殻の利用」ではなく「浮かぶものの規則に当たるファイル」で取る(Task 2)。
5. **浮かばない所(ヘッダー・サイドバー・フッター)の見た目が変わる** → `glass-tier3` の値は触らない。Task 6 の visual-regress で浮かぶもの以外の差が 0 件であることを確かめる。

---

### Task 0: 比較の基準を撮る(作業前)

**Files:** なし(`scripts/visual-regress/.out/baselines/pre-float/` に出力・git 管理外)

- [ ] **Step 1: 今の HEAD の見た目を基準として保存**

Run: `node scripts/visual-regress/run.mjs --save-as=pre-float`(約 21 分。バックグラウンドで流してよい)
Expected: 終了時に保存件数が出てエラー 0。

### Task 1: 素材 `.float-surface` とトークン、MIL-SPEC の掛け戻し

**Files:**
- Create: `src/styles/base/float-surface.css`(クラス `.float-surface` だけ)
- Modify: `src/styles/base/tokens-dark.css`(`:root, .theme-dark` の節に `--float-*` 5 つ)・`src/styles/base/tokens-light.css`(`.theme-light` の節に同じ 5 つ)・`src/index.css`(`glass.css` の次に `@import "./styles/base/float-surface.css";`)・`src/styles/military/standard-revert.css`(掛け戻しの節と `:where()` の節の選択子に `.theme-military .milspec-app .float-surface` を足す)・`src/styles/__tests__/military-overlay-island.test.ts`(節の取り出しを複数選択子に対応)
- Test: `src/styles/__tests__/floatSurface.test.ts`

**Interfaces:**
- Produces: CSS クラス `float-surface`(背景・ぼかし・縁・影・文字色を持つ。角丸・余白・位置は持たない)。トークン `--float-bg` `--float-blur` `--float-border` `--float-shadow` `--float-inset`。

- [ ] **Step 1: 失敗するテストを書く** — `floatSurface.test.ts`(CSS を文字で読む。既存の `militaryCssText.ts` と同じ読み方で base の CSS を読む)

```ts
it('ダークのトークンが案 C の値', () => {
  expect(darkBlock).toContain('--float-bg: rgba(255, 255, 255, 0.04)');
  expect(darkBlock).toContain('--float-blur: 12px');
  expect(darkBlock).toContain('--float-border: rgba(255, 255, 255, 0.18)');
  expect(darkBlock).toContain('--float-shadow: 0 16px 48px rgba(0, 0, 0, 0.3)');
  expect(darkBlock).toContain('--float-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06)');
});
it('ライトのトークンが案 C の値', () => { /* 0.55 / 20px / rgba(0, 0, 0, 0.08) / 0 8px 32px rgba(0, 0, 0, 0.08) / 同じ inset */ });
it('.float-surface はぼかしを --tw-backdrop-blur 経由で掛け、backdrop-filter: blur( を直書きしない', ...);
it('index.css が float-surface.css を読み込む', ...);
it('MIL-SPEC の掛け戻しの節と :where の節が .theme-military .milspec-app .float-surface を含む', ...);
```

- [ ] **Step 2: 失敗を確かめる** — Run: `npx vitest run src/styles/__tests__/floatSurface.test.ts` / Expected: 5 件 FAIL
- [ ] **Step 3: 実装** — `.float-surface { --tw-backdrop-blur: blur(var(--float-blur)); background: var(--float-bg); border: 1px solid var(--float-border); box-shadow: var(--float-shadow), var(--float-inset); color: var(--color-app-text); }` と backdrop-filter の変数パターン(`glass.css` の `.glass-tier3` と同じ形)。掛け戻しは standard-revert.css の 2 つの節の選択子を `A,\nB {` の形に。island テストの `blockOf` は「選択子の並びにその選択子を含む節」を取るように直す(既存 3 件は通ったまま)。
- [ ] **Step 4: 通ることを確かめる** — Run: `npx vitest run src/styles/__tests__/floatSurface.test.ts src/styles/__tests__/military-overlay-island.test.ts` / Expected: 全件 PASS
- [ ] **Step 5: Commit** — `feat(ui): 浮かぶものの素材 float-surface(案 C)と MIL-SPEC の掛け戻し`

### Task 2: 見張り(浮かぶものは素材を使う)

**Files:**
- Create: `src/components/ui/__tests__/floatSurface.guard.test.ts`

**Interfaces:**
- Produces: 見張りの例外一覧 `PENDING: Record<string, string>`(まだ載せ替えていない部品のパス→理由「Task N で載せ替え」)と `EXEMPT: Record<string, string>`(浮かぶものではない/対象外の部品→理由)。Task 3〜5 は自分の部品を `PENDING` から消す。

- [ ] **Step 1: 見張りを書く**(`ModalShell.guard.test.ts` と同じ作法: `src/components/` を歩き、`housing`・`admin`・`military`・`__tests__` を除く)
  - 規則(見逃しを出さない側): `createPortal(` を含む、または className に `fixed` と `z-[` を同時に含む `.tsx` は「浮かぶもの候補」。
  - 候補は次のどれかで合格: `float-surface` を含む/`<ModalShell` を使い `frame={false}` を含まない/`<MobileBottomSheet` を使う/`TOOLTIP_BOX_CLASS` を使う/`EXEMPT` か `PENDING` にある。
  - `it('PENDING と EXEMPT のファイルが実在する')`、`it('PENDING にあるのに float-surface を使っていたら一覧から消し忘れ')`。
  - Review Focus 3: `it('float-surface と同じ className 文字列に bg- の背景クラスや --glass-tier3-bg を同居させない')`(行単位の素朴な検査でよい)。
  - `EXEMPT` は spec の「対象外」の部品(AppFooter・GridOverlay・MobileBottomNav・MobileHeader・Sidebar・MobileFab 本体・LandingPage・WelcomeSetup・MobileGuide・PartyDragGhost・tutorial の演出と暗幕・ProgressCelebration・layout/AuthRedirectingOverlay・layout/LayoutOverlays・timeline/TimelinePipLayer・sidebar の常設部品 など、規則に当たったもの全部を 1 つずつ理由つきで)。
  - `PENDING` は spec の「対象」の部品全部(Task 3〜5 の割り当てを理由に書く)。
- [ ] **Step 2: 通ることを確かめる** — Run: `npx vitest run src/components/ui/__tests__/floatSurface.guard.test.ts` / Expected: PASS
- [ ] **Step 3: 落ちることを確かめる** — `PENDING` から 1 件消して FAIL を見る→戻す。
- [ ] **Step 4: Commit** — `test(ui): 浮かぶものは素材 float-surface を使う見張り`

### Task 3: 共通の殻 4 つ(窓・シート・ツールチップ・通知)

**Files:**
- Modify: `src/components/ui/ModalShell.tsx`(枠の `glass-tier3` → `float-surface`、inline の `--glass-tier3-bg: var(--share-modal-bg)` を外す)・`src/components/MobileBottomSheet.tsx`(シート本体に `float-surface`、上だけ 20px の角丸)・`src/components/ui/Tooltip.tsx`(`TOOLTIP_BOX_CLASS` の `glass-tier3` → `float-surface`)・`src/components/Toast.tsx`(`glass-tier3` → `float-surface`)・`floatSurface.guard.test.ts`(該当を PENDING から外す)
- Test: `src/components/ui/__tests__/ModalShell.test.tsx` があれば追記、無ければ作成

- [ ] **Step 1: 失敗するテスト** — `it('殻の枠は float-surface を持ち、--glass-tier3-bg を inline で持たない')`(render して `[role="dialog"]` の class と style を見る)・`it('TOOLTIP_BOX_CLASS は float-surface を含み glass-tier3 を含まない')`
- [ ] **Step 2: 失敗を確かめる** — `npx vitest run src/components/ui/__tests__/` / FAIL
- [ ] **Step 3: 実装**(上の Files のとおり)。ModalShell を className で背景・縁・影を上書きしている窓(`grep -rn "<ModalShell" src/components` で className を確認)の上書きを外す。
- [ ] **Step 4: 通ることを確かめる** — `npx vitest run src/components/ui src/components/__tests__` / PASS
- [ ] **Step 5: Commit** — `feat(ui): 窓・シート・ツールチップ・通知の殻を float-surface に`

### Task 4: 独自に描いている窓・シート・押した所に出る窓

**Files:**
- Modify: MitigationSelector・BoundaryEditModal・EventModal・AASettingsPopover・ClearMitigationsPopover・PartyStatusPopover・PartySettingsModal・PulseSettings・progress/ProgressRecordPanel・collab/OwnerCollabPanel・timeline/TimelinePopovers・timeline/sheet/SheetHiddenPopover・timeline/sheet/SheetTargetPopover・LimitResolutionSheet・ShareImportSheet・fflogsImport/FFLogsMobileSheet・MobilePartySettings・MobileContextMenu(いずれも `src/components/` 配下)・`floatSurface.guard.test.ts`

- [ ] **Step 1: 各部品の浮かぶ箱の要素から、背景・縁・影・ぼかしのクラス(`glass-tier3`・`bg-*`・`border-*` の外枠・`shadow-*`・inline の `--glass-tier3-bg`)を外して `float-surface` を付ける。** 角丸は Global Constraints の役割の値へ。中の区切り線・ボタン・入力欄は触らない。
- [ ] **Step 2: PENDING から該当を消す**
- [ ] **Step 3: 確かめる** — Run: `npx vitest run src/components` / Expected: PASS(既存のテストで class を見ているものが落ちたら、期待値を float-surface に直す。挙動のテストは変えない)
- [ ] **Step 4: Commit** — `feat(ui): 独自の窓・シート・押した所に出る窓を float-surface に`

### Task 5: 通知・帯・小さなメニュー・チュートリアルの説明の箱

**Files:**
- Modify: progress/ProgressRecordToast・timeline/sheet/PlacementToast・RenderPendingIndicator・ImportProgressOverlay・timeline/TimelineDialogs(コピー中の帯)・Memo/MemoFloatingBar・Memo/MemoInputBox・timeline/TimelineModeBars・sidebar/SidebarFloatingBar・ImportMenu・HeaderToolsMenu・HeaderPhaseDropdown・HeaderGimmickDropdown・HeaderMechanicSearch・HeaderTimeInput・LanguageSwitcher・JobPicker・ui/ContextMenu・pip/PipEditMenu・collab/PresenceControls・fab/(開いた中身)・timeline/sheet/SheetColumnTooltip・tutorial/TutorialCard・tutorial/TutorialMenu・`floatSurface.guard.test.ts`

- [ ] **Step 1: Task 4 の Step 1 と同じ載せ替え。** 括りが曖昧なもの(MemoInputBox・fab の中身)は「画面の上に浮かんで出て、閉じれば消えるか」で決め、浮かばないなら `EXEMPT` へ理由つきで移す。
- [ ] **Step 2: PENDING を空にする**(空になったら `it('PENDING は空')` を足して以後の追加を止める)
- [ ] **Step 3: 確かめる** — Run: `npx vitest run src/components` / PASS
- [ ] **Step 4: Commit** — `feat(ui): 通知・帯・メニュー・説明の箱を float-surface に`

### Task 6: 全体の確かめと記録

**Files:**
- Modify: `docs/.private/2026-10-22-big-update-announcement-list.md`(実機確認一覧に 1 行)・`docs/TODO.md`

- [ ] **Step 1: ゲート** — Run: `npm run test:gate` と `npm run build` / Expected: 失敗 0・build exit 0
- [ ] **Step 2: 見た目の比較** — Run: `node scripts/visual-regress/run.mjs --compare=pre-float` / Expected: 変わった撮影 id が全部「浮かぶものを写したもの」(win-*・sheet・toast・tooltip 等)。浮かぶもの以外が変わっていたら原因を直して撮り直す。意図どおりなら `--save-as=pre-float --only=<キー>` ではなく、新しい基準 `post-float` を `--save-as=post-float` で保存。
- [ ] **Step 3: MIL-SPEC の実測(Review Focus 1)** — 本番ビルド(`.superpowers/sdd/2026-10-23-timeline-sticky-scroll/wip-build-recipe.md` 方式)を Playwright で開き、MIL-SPEC ダークでイベントをコピーして、コピー中の帯の computed `background-color` が `rgba(255, 255, 255, 0.04)` であることを確かめる(1 回で報告)。
- [ ] **Step 4: 記録** — 実機確認一覧に「浮かぶものの統一: ライトの窓が読みやすいか/MIL-SPEC の上で窓・帯・通知・ツールチップが標準の見た目か」を 1 行。TODO の「浮かぶものの統一」を完了に。
- [ ] **Step 5: Commit** — `docs: 浮かぶものの統一の完了を記録`
