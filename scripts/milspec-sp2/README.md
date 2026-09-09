# MIL-SPEC SP2 検証ハーネス

SP2 は `themeStyle === 'military'` の PC `/miti` タイムライン表に `.theme-military` の
CSS と「軍事モード限定」の構造改変を重ねる作業。**絶対不変条件**は

> 標準モード (`themeStyle` 未設定) は `main` と 1px も違わず描画・動作する。

このディレクトリのスクリプトは、SP2 の各タスクがその不変条件を機械的に守れているかを
毎回検証するためのもの。**Task 1 は製品コードを一切変更しない** — `scripts/milspec-sp2/` と
リポジトリ直下 `.gitignore` の 1 行だけ。

前提: dev サーバ (`npm run dev`, 既定 `http://localhost:5173`) が起動していること。
別ポートなら `SP2_BASE_URL=http://localhost:xxxx` を環境変数で渡す。
Playwright 1.60.0 / chromium を使用。`.mjs` は `scripts/milspec-sp2/` 配下なので
プロジェクトの `node_modules`（`playwright`）を普通に解決する（`/tmp` に置くと解決できない）。

---

## `standard-invariance.mjs` — 標準モード不変ゴールデンテスト

```bash
# 初回 / 意図的にベースラインを更新するとき
node scripts/milspec-sp2/standard-invariance.mjs --save

# 以降の検証 (SP2 全タスクの Step で回す)
node scripts/milspec-sp2/standard-invariance.mjs        # exit 0 = 一致 / exit 1 = 差分
```

やること:

1. 標準モードの `/miti` を **dark / light 両方**で開く（`theme-storage` に
   `themeStyle:'standard'` を書く = 描画上は「未設定」と等価）。fixture でプラン選択済・
   8 人ジョブ設定・軽減 7 個を **store 注入**で決定的に組む。
2. `[data-timeline-root]` の **DOM 骨格**を採取: 各要素の `タグ名 + 安定 class + data 属性`。
   除外するもの = テキストノード / `style` 属性 / `hover:` `focus:` `animate-*` 等の
   状態・アニメ由来クラス / React 由来の不安定な `id`。
3. 主要要素の `getBoundingClientRect`（0.1px 丸め・許容 ±1.0px）:
   `#timeline-controls-inner` / `#timeline-header-inner` / `.timeline-scroll-container` /
   先頭 5 個の `[data-time-row]` / 先頭 3 個の `.recast-cell`。
4. `.timeline-scroll-container` の**縦スクロールバー幅** (`offsetWidth - clientWidth`)。
   標準モードはオーバーレイ scrollbar なので **0**（`--save` 時に 0 でなければ即 FAIL）。
5. viewport `1489 x 900` / `deviceScaleFactor: 1`（安定比較優先で 1 倍）。

`--save`: 現在値を `.baseline/standard-{dark,light}.json` に保存。
フラグなし: `.baseline/` と比較し、差分があれば行単位 diff を print して exit 1。

**このテストが落ちたら = SP2 の分岐 (`.theme-military` 条件) の入れ方が誤り。**
標準モードに構造 / クラス / レイアウトが漏れている。`.theme-military` スコープの外に
要素やクラスを足していないか確認する。ベースラインを更新してよいのは、標準モードを
意図的に変えたと確信できるときだけ。

## `military-smoke.mjs` — 軍事モード スモーク

```bash
node scripts/milspec-sp2/military-smoke.mjs      # exit 0 = 全操作 OK + console エラー 0
```

1. **標準ヘッダーに `button[aria-label*="MIL-SPEC"]` が可視**であることを assert
   （SP1 の失敗 = この入口を消したこと）。その後は実アクション
   `useThemeStore.getState().setThemeStyle('military')` で確実に軍事モードへ
   （`localStorage` 直書きショートカットは使わない）。
2. 以下を順に実行し、各ステップ後に非 whitelist の `console.error` / `pageerror` が
   0 件であることを確認（1 件でも exit 1）:
   1. 入口 assert + 軍事モード + fixture 投入
   2. 配置済み軽減バーを**実マウス pointer 列でドラッグ**して別時刻へ（store の `time` が変化）
   3. 折りたたむボタン (Area A) ON/OFF → `hideEmptyRows` トグル
   4. AA 追加ボタン → ポップオーバー表示 → Esc で閉じる
   5. メモボタン ON/OFF → `toolMode` `idle → memo → idle`
   6. リキャスト行トグル (Area C) OFF/ON
   7. フェーズヘッダー click → ドロップダウン → フェーズジャンプ（`scrollTop` 変化）
   8. `.timeline-scroll-container` を `scrollBy({left:300})` →
      `#timeline-header-inner` / `#timeline-controls-inner` の `transform` が
      コンテナ実 `scrollLeft` と一致（±2px）
   9. `scrollBy({top:400})` → `.recast-num` が変化 or 例外なし（Task 7 以降で本実装）
   10. 配置した軽減を右クリックで削除

**console エラー whitelist**（`_fixture.mjs` の `HARMLESS_CONSOLE`）: dev では
App Check / Firebase `permission-denied` / Firestore の権限不足 / analytics / HTTP 403 /
`Failed to load resource` が無害に出る（マスターデータは別経路でロードされ動作する）。
部分一致（小文字化）で判定し、それ以外の `console.error` / `pageerror` だけを失敗扱いにする。
whitelist に載ったものは `[info]` として件数と代表例を print する。

## `compare.mjs` — 視覚忠実度プロトコル用スクショ採取

```bash
node scripts/milspec-sp2/compare.mjs <zone>
# zone: controlbar header recast tbody mitbar workspace jobchips scrollbar wscap
```

- モック側 = `docs/.private/theme-refs/milspec-mockup.html`（`#ctl` / `#tune` の
  dev パネルを `display:none` にしてから）対応要素を `.compare/<zone>-mock.png` へ。
- アプリ側 = dev の軍事モード `/miti`（`military-smoke.mjs` と同じ fixture）で
  対応する実要素を `.compare/<zone>-app.png` へ。viewport 1489×900。
- 2 枚のパスを print して終了。**画像比較の判断は実装者が Read で行う**。
- Task 1 時点ではアプリ側の軍事要素（`[data-milspec-recast-band]` 等）が未実装。
  見つかった要素だけ撮り、無ければ warning を出して crash しない。

fixture のセットアップ関数は `_fixture.mjs` の `applyFixture()` を 3 スクリプトで共有。

---

## `.baseline/` と `.compare/` の意味

| ディレクトリ | git | 中身 | 使い方 |
|---|---|---|---|
| `scripts/milspec-sp2/.baseline/` | **コミットする** | 標準モードの構造 JSON（dark / light）。非公開情報なし | SP2 着手前の標準モードの契約。以降の全タスクでこれと一致することを確認 |
| `scripts/milspec-sp2/.compare/` | **gitignore** | 突き合わせスクショ。`*-mock.png` は**非公開モックアップ由来**（このリポジトリは公開） | 作業ツリー内でのみ `Read` して視覚差分を判断。コミット禁止 |

## 視覚忠実度プロトコル

プラン §テスト戦略の視覚忠実度プロトコル（`compare.mjs` の各 zone をモックと突き合わせ、
モック準拠に追い込む）は**実装者が完遂する**。masaya のレビューは **Task 10 の 1 回のみ**。

## `_fixture.mjs` — 共有モジュール

- `launch({ theme })` — Playwright 起動（viewport 1489×900 / DSR 1 / 初回オーバーレイ抑制 initScript）
- `gotoMiti(page)` — `/miti` へ移動しマウント待ち（`networkidle` は Firestore onSnapshot で
  発火しないため `domcontentloaded` + 固定 `waitForTimeout`）
- `applyFixture(page, { military })` — store 注入で決定的な fixture を組む（プラン選択・
  8 人ジョブ・軽減 7 個・任意で軍事モード）。dynamic import が失敗したら例外を投げる
  （= 壊れたら BLOCKED 報告。fragile な UI クリックへフォールバックしない）
- `attachConsoleRecorder(page)` / `HARMLESS_CONSOLE` / `isHarmless()`
- fixture 定数: `EVENT_FIXTURE` / `PHASE_FIXTURE` / `PARTY_FIXTURE` / `MITIGATION_FIXTURE`
