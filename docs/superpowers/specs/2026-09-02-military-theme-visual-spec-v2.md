# MIL-SPEC テーマ ビジュアル詳細スペック v2（参照画像マッチ用）

- 作成: 2026-09-02（セッションが長くなったため次セッションで本格実装。masaya 合意）
- 前提: `docs/superpowers/specs/2026-09-02-military-theme-design.md`（アーキ）+ `docs/superpowers/plans/2026-09-02-military-theme.md`（計画）
- **正典画像**: `docs/.private/theme-refs/allagan-dark.png` / `allagan-light.png`
  - 切り出し済み: `<scratchpad>/ref-header.png` `ref-toolbar.png` `ref-sidebar.png` `ref-tablehdr.png` `ref-footer.png`（再生成コマンドは §11）
- worktree: `.claude/worktrees/milspec-theme`（branch `milspec-theme`）。SDD ledger = `.superpowers/sdd/2026-09-02-military-theme/progress.md`
- dev: `npm run dev`（`.env.local` はコピー済み）

---

## 0. masaya の指摘（2026-09-02・v1 実装を見て）

1. **色味が参照画像に全然近づいていない** — 最優先で直す
2. **傷・汚れ（weathering）を完璧に** — 今の低アルファノイズだけでは不十分
3. hover で文字が消える不具合 → **修正済み**（commit 2851d258）
4. マウスホバー時の可読性は常に担保

---

## 1. パレット（v1 の誤り → 参照画像の実際）

### v1 の間違い
- 背景が黒すぎ（`--color-bg-primary: #0a1015`）。参照は **黒でなく脱色した濃紺グレー**。
- シアンを使いすぎ。参照では **見出し・ラベルは白**。シアンは「アクティブ / ライブ / 時刻 / 細い罫線」だけ。
- パネル面が単調。参照は全パネルが「角切り + L ブラケット + 隅ハッシュ + グランジ」で統一。

### Dark（参照 allagan-dark.png から採色）
| 用途 | 値（目安・実機で微調整） |
|---|---|
| 画面背景 `--color-bg-primary/secondary` | `#0d131b`（ごく暗い紺グレー。純黒にしない） |
| パネル面 `--color-bg-tertiary` / `--milspec-surface` | `#1a2430`〜`#151e28`（上が明るい微グラデ可） |
| パネル面2（凹んだ所・ツールバー地） | `#111925` |
| アクセント `--color-accent-primary` | `#79c6dc`（**やや彩度を落としたスチールシアン**。`#5fd4ff` は明るすぎ） |
| `--app-accent-rgb` | `121, 198, 220` |
| 本文 `--color-text-primary` | `#e6edf2`（ほぼ白） |
| 見出し（COMBAT ANALYSIS SYSTEM 等）| **白**（`#f0f4f7`）。シアンにしない |
| セカンダリ `--color-text-secondary` | `#9fb0be` |
| ミュート `--color-text-muted` | `#63788a` |
| 罫線 `--color-border` | `rgba(150, 178, 196, 0.16)`（**グレー寄り**、シアンにしない） |
| 罫線アクセント `--color-border-accent` | `rgba(121, 198, 220, 0.32)` |
| 機能・青(OK/進む) `--color-blue` | `#79c6dc`（=アクセントと同系） |
| 機能・緑(軽減後ダメージ / OPERATIONAL) | `#5fd97a`（明るい緑・**発光する**） |
| 機能・赤(致命) `--color-red` | `#f2555a`（+ 行背景に赤 tint `rgba(242,85,90,0.10)`） |
| 機能・橙(AA / エフェクト棒) `--color-amber` | `#f7a13c`（**発光する**縦バー） |
| ハザードチェブロン（ヘッダーのベイ間） | 赤 `#d0433c` + グレー `#7a828c` の斜線（§4） |

### Light（参照 allagan-light.png）
- 「同じ機体の設計図」。白基調 `#eef2f6` 画面 / `#ffffff` パネル / 細い青グレー線 `rgba(40, 84, 120, 0.16)`。
- アクセント濃シアン `#1183b0`。見出しは黒 `#12222f`。発光なし・線画。
- weathering は極薄（青写真の紙の粒状感程度）。

---

## 2. パネルシステム（**全パネル共通**・参照様式）

参照ではヘッダーの各ベイ、SCENARIO、フェーズ枠、表の列ヘッダー、フッターの各ブロック、モーダル…**すべて**同じ様式:

1. **角切り**: 左上 + 右下を斜めにカット（`clip-path: polygon()`、8〜10px）
2. **L 字ブラケット**: 角切りされない側（右上・左下）に 1px の L マーク（`::after` の複数 linear-gradient で 2 隅）
3. **1px 枠**: グレー寄りの hairline（`--color-border`）
4. **上光りの微グラデ**（Dark のみ・ごく浅く 3〜4%）
5. **隅ハッシュ "////"**: 右上に斜線ストリップ（grey）
6. **グランジ**（§3）

→ `.milspec-panel` を「完成品」にして、header/sidebar/table/footer/modal すべてに乗せる。v1 は個別に書いていて不統一。**1 クラスに集約**。

---

## 3. 汚し加工（weathering）— **v1 の弱点。ちゃんとやる**

参照画像は「使い込まれた実機」。3 レイヤーで作る:

### (a) 表面グレイン（全パネル・極薄）
- `feTurbulence fractalNoise baseFrequency ~0.9` を feColorMatrix で **低アルファに焼き込み**（v1 で実装済・`--milspec-noise`）。
- Dark: 明るいグレーを alpha ~0.05（埃）+ 別レイヤーで暗いグレーを `mix-blend-mode: multiply` alpha ~0.04（煤）。**2 方向**（今は明るい 1 方向だけ）。

### (b) エッジのグライム / ウォッシュ（凹み・角に汚れが溜まる）
- パネル内側に `box-shadow: inset` の暗いビネット（`inset 0 0 30px rgba(0,0,0,0.3)` + `inset 0 -14px 20px rgba(0,0,0,0.2)`）。v1 の `.milspec-wash` を全パネルに。
- 角切りのカット面沿いに濃い線（墨入れの強調）。

### (c) 傷・スクラッチ（**新規・重要**）
- パネルごとに 2〜4 本の細い斜めスクラッチ。SVG（`stroke-opacity 0.06`, `stroke-width 0.6`, 数本の `<path>`）を data-URI 化して `::after` オーバーレイ。2〜3 パターン用意し `background-position` を要素ごとに変えて散らす。
- チッピング（塗装剥がれ）: 角切りエッジ沿いに小さい不規則な明色/暗色の点を数個。

### (d) デカールの擦れ
- `.milspec-decal` / ステンシルに `mask-image: var(--milspec-noise)` を薄くかけて印字が少し掠れて見えるように。opacity 0.7〜0.85。

> 目標: 遠目には気づかない、近くで見ると「あ、汚れてる/傷ついてる」。TV ノイズにはしない（v1 初回の失敗）。

---

## 4. ヘッダー（参照 ref-header.png）

- ベイ構成（左から）: **LoPo ベイ** | 赤ハザードチェブロン | **タイトルベイ** | 縦罫線 | SHARE/EDIT MODE | **右アイコンベイ**（TUTORIAL / THEME / EXPORT）
- LoPo: 白ボールド（**普通のボールド**。v1 の等幅化はやり過ぎ）。右に「COMBAT ANALYSIS SYSTEM」白 / 「LOOP OPTIMIZER」グレー / 「Ver. 2.0.0」グレー + "////"
- **赤ハザードチェブロン**: `clip-path` の平行四辺形ウェッジ。`repeating-linear-gradient(-58deg, #d0433c 0 3px, #7a828c 3px 6px, transparent 6px 12px)`。v1 に `.milspec-chevron` 雛形あり（未配置）。ConsolidatedHeader の左グループとタイトルの間に `<div>` 追加が要る。
- タイトル: **白・大・普通のボールド**（ステンシル化しない）。romaji サブは grey mono uppercase。`[data-milspec-title]` の角切りプレートは good。
- 右アイコン: 細い白ラインアイコン + EN 白ボールド小 + JP grey 極小の 2 段。ラベル追加は DOM 変更（TutorialMenu 等別コンポーネント）→ 後回し可。
- 上端: subtle な明るい線（v1 の破線サイコフレームは強すぎ。控えめに）。

---

## 5. ツールバー（参照 ref-toolbar.png）

- 各ボタン = **細線フレーム**（塗り薄め）+ 角のブラケット + アイコンをミニ枠に + EN ボールド白 + JP grey の 2 段。
- アクティブ（LIGHT/ライトパーティ）= シアン fill + 上辺明るい + 文字 dark。
- MITIGATION と OPTIONS の間あたりに **"STAY" チェブロン decal**（グレー斜線の矢羽）。
- 行の右下が面取り（chamfer）。
- v1 は clip-path の単純 skew → 「枠 + ブラケット」寄りに作り直す。

---

## 6. サイドバー（参照 ref-sidebar.png）

- **SCENARIO パネル**: 角切り + ブラケット。見出し「SCENARIO」白 caps + 「シナリオ」grey。右上 "////" + 小マーク。
- NEW/IMPORT/TEMPLATE/DELETE: 小さい角切り枠ボタン。EN ラベルに **色収差の二重刷り**（`.milspec-echo` + `data-text`）。IMPORT は緑。JP ラベル下。
- 「至天の座アルカディア零式：ヘビー級1」= 白ボールド（**普通**。v1 の等幅 ▚ マーカーはやり過ぎ）。
- フェーズ群: 各グループが角切り + ブラケットのパネル。「1層 ⌄」白ボールド大。「PHASE 01」grey mono caps + 右へ伸びる細い下線。
- プラン項目: `◆` シアンダイヤ（グループ）+ `•` ドット + 名前。**選択項目 = シアン枠 + シアン tint 背景の pill**、右に edit/attach/copy アイコン。
- 下部: BACKUP/RESTORE をドックボタン化。
- **左端**: 縦のイエロー/黒ハザードストライプ（v1 はシアン → **黄黒**に）+ 最下部に「X」エンブレム + 「DEPLOYMENT / 展開を支援する」。
- 右端: 細いスクロールバー + `<` 折りたたみタブ。

---

## 7. タイムライン表（参照 ref-tablehdr.png）

- 「TIMELINE」タブ = **色収差二重刷り**。
- 列ヘッダー: 「TIME 時間 / ENEMY ACTION 敵の攻撃 / ORIGINAL DAMAGE 元のダメージ / MITIGATED DAMAGE 軽減後ダメージ」。EN 白 caps ボールド + JP grey。各セルが **角切り枠 + 右上 "////"** + 微グラデ。「TIME」に下線。ヘッダー行下端にシアンライン。
- データ行: 時刻 = シアン mono。ダメージ = mono。軽減後 = **緑 + 発光**。致命 = **赤枠 + 赤背景 tint**。行 hover = `inset 2px 0 シアン`。
- スコープ風の薄いグリッド背景（プロット領域）。
- **エフェクト棒（縦・効果時間）**: 発光する縦バー（AA=橙、軽減=シアン/緑）。上端に三角キャップ。`src/index.css` の `@property --mobile-effect-bar-progress` は**絶対に触らない**（2026-08-14 スクロール性能の根治）。色と box-shadow だけ。
- 上部の時間軸: 0:00 / 0:20 / 0:30 + tick、シアン。
- **perf 注意**: タイムラインは DOM 数万個。行ごとの重い装飾（複数 pseudo / SVG）は避ける。色 + 1〜2 の軽い box-shadow まで。[[reference_perf_content_visibility]]。

---

## 8. フッター HUD（参照 ref-footer.png・**Phase 2.1 / 新規コンポーネント**）

現状は 24px の薄帯にデカール 2 個だけ。参照は 4 ブロックの HUD 帯（PC のみ・開閉式）:

1. **enemy LEGEND / アイコン凡例**: 「enemy」に色収差。防御バフ / 軽減バフ(緑) / 回復バフ(黄) / ダメージ増加(赤) / その他(紫) のアイコン + ラベル。各ミニ角切り枠。**タイムラインのバフアイコンと対応**（実用）。
2. **DECAL CODE**: 「PX-042 / MTG-81A / FX-CHIP」mono + 右に極小マイクロテキスト塊 + "////"
3. **中央エンブレム**: アラガン紋章 SVG（`src/components/military/svg/MilspecCrest.tsx` 新規・orig design §8.1）+ 「ALLAGAN RESEARCH DIVISION / COMBAT SIMULATION DEPARTMENT」白 + 「AR-<YYMMDD>」大 mono + 「DO NOT REMOVE」極小。
   - **§12 遵守**: 「PROPERTY OF GARLEMALD EMPIRE」等の偽所有権表記は**入れない**。A.R.D 系の文言のみ。
4. **SYSTEM STATUS / システムステータス**: 信号強度バー（緑）+ 「OPERATIONAL / 正常稼働中」緑発光 + ● 脈動（`prefers-reduced-motion` で停止）。

実装: 新規 `MilspecFooterHUD.tsx`（`themeStyle==='military'` && `window.innerWidth>=768` のみ描画・開閉状態 localStorage）。`AppFooter.tsx` から委譲。plan Task 2.1 参照。

---

## 9. 色収差の二重刷り（echo）

参照の「TIMELINE」「NEW」「IMPORT」等のラベルにかかっている chromatic aberration の二重刷り。
- v1 に `.milspec-echo` 雛形あり（`::before` シアン -1px / `::after` 赤 +1px、`content: attr(data-text)`）。
- 適用: 対象要素に `class="milspec-echo"` + `data-text="TIMELINE"`。ConsolidatedHeader / Sidebar dock / Timeline タブ。
- Light では控えめ（赤を薄く）。

---

## 10. v1 でやったこと（commits・milspec-theme ブランチ）

| commit | 内容 |
|---|---|
| 29af250d / 1c69f6e4 | Phase 0: themeStyle 軸 + html クラス |
| 00d1415a | military.css 骨格（意味トークン再定義） |
| 9b57b258 | Orbitron / Share Tech Mono 自前ホスト |
| c6d66442 | MilspecStyleToggle + i18n 5 言語 + ヘッダー配置（DEV ガード） |
| 83c94a78 | MilspecTunePanel（開発専用・?tune） |
| 0bcad2a3 → 792d0e9d | ヘッダー MGEX 密度 → 無機質フラット化 |
| 3b7af200 | 語彙を実機質感に再構築 + 汚しノイズ + sidebar/table/footer hook |
| 49c5d5fa | サイドバー内部 + 表ヘッダー + フッター帯 |
| 2851d258 | **hover 文字消え不具合 修正** |

### 既存の DOM フック（`data-milspec-*`）
- `data-milspec-header`（ConsolidatedHeader 本体） / `data-milspec-titlebar`（上段） / `data-milspec-toolbar`（下段） / `data-milspec-chrome`（デカール層） / `data-milspec-wordmark` / `data-milspec-title`
- `data-milspec-sidebar`（motion.aside） / `data-milspec-dock`（ボタンバー） / `data-milspec-sect`（シリーズ見出し）
- `data-milspec-table`（Timeline glass-panel） / `data-milspec-thead`（列ヘッダー行 headerRef）
- `data-milspec-footer`（AppFooter） / `data-milspec-mobile-header` / `data-milspec-mobile-logo`

### `military.css` の現状の構造
- L1-166: Phase 0（意味トークン再定義・フォント・body）
- L167+: 語彙（トークン / `.milspec-*` プリミティブ / 汚し / パネル）+ 画面別（ヘッダー / サイドバー / 表 / モーダル / フッター）

### 調整パネル（`?tune` or localStorage `milspec-tune=1` + DEV + military）
`--milspec-tune-glow / -corner / -scanline / -grid / -panel-line / -decal / -hazard` が効く。`-accent-hue` `-accent-sat` は未配線。

---

## 11. 次セッションの進め方（推奨）

1. **パレット修正を最優先**（§1）— `military.css` L55-142 の `.theme-military.theme-dark` / `.theme-light` を参照採色で書き換え。ここだけで印象が大きく変わる。masaya に dark/light 両方見せて色を合意。
2. **`.milspec-panel` を完成品に**（§2 + §3）— 角切り + ブラケット + ハッシュ + 3 層 weathering（グレイン 2 方向 + ウォッシュ + スクラッチ SVG + デカール擦れ）。単体で完璧にしてから全画面へ。
3. **ヘッダー再構築**（§4）— 赤チェブロン追加、タイトル/ロゴを普通のボールドに戻す、上端ライン控えめに。
4. **サイドバー**（§6）— 左を黄黒ハザードに、SCENARIO/フェーズをパネル化、選択 pill、echo ラベル、X エンブレム + DEPLOYMENT。
5. **表**（§7）— 列ヘッダーをパネル化、時刻/数値 mono シアン、緑発光/赤枠、エフェクト棒。perf 注意。
6. **フッター HUD**（§8）— 新規 `MilspecFooterHUD.tsx` + `MilspecCrest.tsx`。
7. masaya 実機確認 → **引き算**（強すぎる装飾を削る）。
8. スプシモード（別タスク）→ 全部揃ったら敵対レビュー → main へ1本化。

### crop コマンド（参照画像の細部を見る）
```
node -e "const s=require('./node_modules/sharp'); const src='C:/Users/masay/Desktop/FF14Sim/docs/.private/theme-refs/allagan-dark.png'; const o='<scratchpad>';
[['ref-header',{left:0,top:0,width:1666,height:90}],['ref-toolbar',{left:290,top:92,width:900,height:78}],['ref-sidebar',{left:0,top:88,width:285,height:520}],['ref-tablehdr',{left:290,top:190,width:560,height:130}],['ref-footer',{left:290,top:800,width:1360,height:150}]]
.forEach(([n,b])=>s(src).extract(b).resize({width:Math.min(b.width*2,1600)}).toFile(o+'/'+n+'.png'));"
```
（dark は 1666×944）

---

## 12. 未解決の小物 / 注意

- SegmentButton（Sort・タブ）: 広い `button` セレクタが内部ボタンに当たり、pill インジケータと矩形コンテナがズレる。専用マーカーが要る。
- ConsolidatedHeader の chrome デカール層は px/% 直値で配置 → 画面幅で重なる。幅追従の配置か、要素を減らす。
- `.env.local` が worktree 内にコピー済み（gitignore `*.local`・SessionStart hook が毎回警告。worktree 破棄時に消す）。
- standard テーマは全 commit で不変を維持（data 属性のみ・CSS 非適用）。検証は headless で確認済み。
