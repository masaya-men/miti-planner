# 管理画面リデザイン（共通方針）設計書

- 日付: 2026-06-17
- ステータス: 設計確定（ユーザー承認待ち）
- 関連: `docs/superpowers/specs/2026-06-16-admin-sandbox-design.md`（道具）、memory `feedback_admin_design`（赤ん坊でも使える明快さ）/ `feedback_housing_admin_complete`
- 前提ツール: `npm run dev:admin`（管理画面サンドボックス）で実機を見ながら1ページずつ進める

---

## 1. 背景・目的

### 困りごと（ユーザー言）
「ネイティブアプリ風」と言ったが、本質は**使いやすさ**。具体的には:
- 固定されるべきヘッダー（ページ名・主要操作）が固定されておらず、スクロールすると一緒に流れて消える。
- 見た目が本体（LoPo 軽減表）のアプリ画面と乖離している。

### 調査で確認した実際の差（事実）
- 本体 [Layout.tsx](../../../src/components/Layout.tsx): 固定ヘッダー（折りたたみ・スプリング）、開閉サイドバー、グリッド背景、テーマ切替、`--container-max` 中央寄せ。
- 管理画面 [AdminLayout.tsx:80](../../../src/components/admin/AdminLayout.tsx#L80) / [AdminDashboard.tsx:157](../../../src/components/admin/AdminDashboard.tsx#L157): `<main className="flex-1 overflow-auto p-6">` の中にページ見出し `<h1>` が同居 → スクロールで見出しもアクションも流れる。サイドバー固定・テーマ切替なし・中央寄せなし。
- 差の核心は「装飾」ではなく**骨組み（ヘッダー固定・余白・フォント）が本体と別物**である点。

### ゴール
全14ナビページ（＋ウィザード）に共通の「土台」を1回決め、横展開して**使いやすさ**と**本体との地続き感**を出す。

---

## 2. 確定した方向（A案＝土台だけ揃える）

検討した2軸のうち **A案** を採用（ユーザー承認済・サンドボックス実機で確認）。

- **A案（採用）**: 共通の管理画面シェルを作り ①ページヘッダーを固定 ②本体と同じ余白・ボタン・機能色・テーマを継承。ただし**装飾（浮くガラス・グリッド背景・派手アニメ）は持ち込まず、管理画面は「クリアで明快」に保つ**。管理画面の最優先は「赤ん坊でも安全に使える明快さ」（memory `feedback_admin_design`）。
- B案（不採用）: ガラスヘッダー・グリッド背景まで本体そっくりに。情報密度の高い管理作業では装飾がノイズになる。

### フォント（確定）
- 管理画面は「見て触る道具」として**可読性を最優先**。本体の装飾フォント Rajdhani ではなく、**素直な M PLUS 1 を主役**にする。
- M PLUS 1 は [index.html:29](../../../index.html#L29) で既に読み込み済 → **新規フォント追加なし（ネットワークコスト増ゼロ）**。本体とも「同じ M PLUS 1 系」で地続き。
- 実装は `[data-admin-page]` 配下のみに効くCSS1ルール（[src/index.css](../../../src/index.css)）。本体は Rajdhani のまま不変。
- 禁止フォント（Inter）は使わない（`.claude/rules/ui-design.md`）。

---

## 3. アーキテクチャ / コンポーネント

### 3.1 共通ページシェル `AdminPage`（新規・試作済）

`src/components/admin/AdminPage.tsx`。全管理ページの土台。

```
<AdminPage title meta? actions?>
  ...本文...
</AdminPage>
```

- **header（固定・スクロールしない）**: 左＝ページ名 + 補足(meta：件数・絞り込み状態等)、右＝ページ固有アクション(actions スロット)。下に区切り線。
- **body（ここだけスクロール）**: header の下で単独スクロール。
- 構造は CSS の `position: sticky` ではなく **flex 縦並び（header = `shrink-0` / body = `flex-1 min-h-0 overflow-auto`）** で実現。padding と sticky offset の干渉が無く堅牢。

### 3.2 受け皿としての `AdminLayout`（変更済）

- main を `flex-1 overflow-auto p-6` → **`flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col`** に変更。高さを与えるだけにして、スクロールは各ページ（AdminPage の body）が担う。
- **重要な帰結**: main が `overflow-hidden` になったため、**AdminPage でラップしていないページはスクロールできなくなる**。よって outlet にぶら下がる全ルートを移行する必要がある（§5）。

### 3.3 フォント差し替え（変更済）

`src/index.css` の `@layer base` に1ルール追加:
```css
[data-admin-page] {
  font-family: 'M PLUS 1', system-ui, sans-serif;
  letter-spacing: 0;
}
```

---

## 4. 各ページ移行ポリシー（横展開のルール）

各ページを `AdminPage` でラップする際の判断基準。**1ページずつサンドボックスで実機確認しながら**進める（memory `feedback_one_fix_one_verify`）。

1. **title**: 既存の `<h1>`（i18nキー）をそのまま `title` に移す。ページ内の `<h1>` は撤去。
2. **meta**: 件数・絞り込み状態など「眺めて分かる補足」があれば `meta` に。無ければ省略。
3. **actions（ヘッダー右への集約）**:
   - **集約する**: そのページの「主要操作」「常にアクセスしたい操作」。例＝新規作成ボタン、同期ボタン、ページ全体に効く絞り込み/選択ドロップダウン（テンプレ管理のコンテンツ選択は集約済）。
   - **集約しない（本文に残す）**: 特定の行・選択状態に紐づく文脈アクション（行ごとの削除/ロック、選択中アイテムの保存・Undo、ポップオーバー起点ボタン等）。これらは対象の近くにある方が分かりやすい。
   - 迷ったら「スクロールで消えると困るか？」で判断。困るならヘッダー、困らないなら本文。
4. **本文**: 残りはそのまま body に置く。テーブル・カード・セクションは現状の構造を尊重し、骨組み移行のみ（このパスでは中身の作り直しはしない）。
5. **ボタン/入力のスタイル**: 既存のトークン経由スタイル（機能色：青=進む/OK、赤=危険、黄=警告）を踏襲。新規に色を足さない。

---

## 5. 対象ルート一覧と移行アプローチ

`/admin` outlet（[App.tsx:102-120](../../../src/App.tsx#L102)）にぶら下がる全ルート。main が `overflow-hidden` のため**全て**処理が必要。

### 5.1 ナビ14ページ（AdminPage でラップ）
| # | ルート | コンポーネント | 状態 |
|---|--------|----------------|------|
| 1 | index | AdminDashboard | 未 |
| 2 | contents | AdminContents | 未 |
| 3 | templates | AdminTemplates | **✅ 試作済（実例）** |
| 4 | skills | AdminSkills | 未 |
| 5 | translations | AdminTranslations | 未 |
| 6 | stats | AdminStats | 未 |
| 7 | servers | AdminServers | 未 |
| 8 | config | AdminConfig | 未 |
| 9 | backups | AdminBackups | 未 |
| 10 | logs | AdminLogs | 未 |
| 11 | ugc | AdminUgc | 未 |
| 12 | featured | AdminFeatured | 未 |
| 13 | notifications | AdminSystemNotifications | 未 |
| 14 | housing-reports | AdminHousingReports | 未 |

### 5.2 ウィザード4本（別扱い）
content-wizard / template-wizard / job-wizard / stats-wizard。多段ステップの独自UIを持つため、`AdminPage` の標準ヘッダーは馴染まない可能性が高い。**最低限「自前でスクロール領域を持つ」ことだけ保証**する（`overflow-hidden` の main で潰れないように、ルート要素を `h-full overflow-auto` でラップする等）。固定ヘッダー化するか否かは各ウィザードを見て個別判断。

### 5.3 サンドボックスの fixtures
- 現状ダミーは**テンプレート管理のみ**（[2026-06-16-admin-sandbox-design.md](./2026-06-16-admin-sandbox-design.md)）。
- 他ページを実機確認するには `src/dev/adminSandbox/fixtures/` に1ページずつダミーを足す。骨組み移行自体はダミー無しでも成立するが、「太った状態」での触り心地確認のため、移行と同時にそのページの fixtures を足すのが望ましい。

### 5.4 進め方
1ページ＝1コミット相当の粒度で、(a) AdminPage ラップ (b) 必要なら fixtures 追加 (c) サンドボックス実機確認 (d) 次へ。テンプレ管理を雛形にして横展開。

---

## 6. 非ゴール（このパスでやらないこと）

- ガラス/グリッド/派手アニメの導入（A案で除外）。
- 各ページの**機能・データフロー・ロジックの作り直し**（骨組みと見た目の土台のみ）。
- サイドバー自体の作り直し（開閉化・ガラス化など。現状の固定 `w-56` を維持。必要なら別タスク）。
- 本体（軽減表 / ハウジング / LP）への変更（管理画面に閉じる）。

---

## 7. テスト・ビルド方針

- `AdminPage` の単体テスト: title/meta/actions が描画される、actions/meta 省略時に出ない。
- 移行した各ページ: クラッシュせず描画される（既存テストがあれば追従）。
- **ビルド必須**: push 前に `npm run build`（tsc -b は厳密）+ `vitest run`（memory `feedback_vercel_tsc_strict`）。未使用 import / 型不足に注意。
- erasable syntax 制約に注意（memory `reference_erasable_syntax_test_mocks`）。
- 本番ビルド成果物にサンドボックスコードが混入しないことは道具側の設計で担保済。

---

## 8. リスク

- **最大リスク=移行漏れ**: main が `overflow-hidden` のため、未移行ルート（ウィザード含む全18）はスクロール不能になる。**全ルート移行完了までは「管理画面リデザイン」を本番マージしない**。横展開途中のブランチ状態では未移行ページが一時的にスクロール不能になる（サンドボックス確認時は移行済ページのみ見る）。
- i18n: 既存キーをそのまま移すだけ。英語表示の崩れ確認（`.claude/rules/i18n.md`）。

---

## 9. 確定した設計判断 / 残論点

### 確定
- 共通シェル `AdminPage`（固定ヘッダー + 本文スクロール、装飾なし）。
- 管理画面フォント = M PLUS 1（`[data-admin-page]` スコープ、追加読み込みなし）。
- ヘッダーアクション集約の判断基準（§4-3）。
- テンプレ管理を実例・雛形とし、全ルートへ横展開。ウィザードは別扱い（§5.2）。

### 残論点（実装中に決める・必要ならユーザー確認）
- **テーマ切替を管理画面にも置くか**: 本体にはあるが管理画面には無い。サイドバー下部に小さく置くと便利だが、スコープ拡大になるため**今回は保留**（やるなら別途合意）。
- **テーブルの数字可読性**: 数値列に `tabular-nums` を当てるか等の微調整は、横展開しながら気になれば随時。
