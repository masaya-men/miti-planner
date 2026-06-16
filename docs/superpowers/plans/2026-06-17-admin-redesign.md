# 管理画面リデザイン（共通シェル横展開）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面の全ルート（14ナビページ＋ウィザード4本）を共通シェル `AdminPage`（固定ヘッダー＋本文スクロール）に揃え、フォントを可読な M PLUS 1 に統一して「使いやすく・本体と地続き」にする。

**Architecture:** `AdminLayout` の main は既に `overflow-hidden flex-col` 化済み（スクロールは各ページが担う）。各ナビページを `AdminPage`（既存・テンプレ管理で実証済）でラップし、見出し→`title`、ページ全体に効く操作→`actions`、件数等→`meta` に移す。内部に独自スクロール（`max-h-[70vh] overflow-y-auto`）を持つページはそれを外し、AdminPage の body スクロールに一本化。ウィザードは固定ヘッダーを載せず、main の overflow-hidden で潰れないようルートを `h-full` のスクロール領域にする。

**Tech Stack:** React + TypeScript, react-router (outlet), react-i18next, Tailwind v4, Vitest, vite（`npm run dev:admin` サンドボックスで実機確認）。

---

## 前提・参照（実装者は必ず先に読む）

- 設計書: [docs/superpowers/specs/2026-06-17-admin-redesign-design.md](../specs/2026-06-17-admin-redesign-design.md)
- **正典の実例**: [src/components/admin/AdminTemplates.tsx](../../../src/components/admin/AdminTemplates.tsx)（既に AdminPage でラップ済。すべてのページはこの形に倣う）
- 共通シェル: [src/components/admin/AdminPage.tsx](../../../src/components/admin/AdminPage.tsx)
- 受け皿: [src/components/admin/AdminLayout.tsx:80](../../../src/components/admin/AdminLayout.tsx#L80)（main = `flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col`）
- ルート定義: [src/App.tsx:102-120](../../../src/App.tsx#L102)

### AdminPage の使い方（正典パターン）

```tsx
import { AdminPage } from './AdminPage';

return (
  <AdminPage
    title={t('admin.xxx_title')}              // 旧 <h1> の中身をここへ
    meta={条件 ? 件数等 : undefined}          // 任意。眺めて分かる補足
    actions={<>...ページ全体に効く操作...</>}  // 任意。新規/同期/全体フィルタ等
  >
    {/* 旧 return 直下の本文（h1 は除く）をそのまま入れる */}
  </AdminPage>
);
```

### ヘッダー集約ルール（設計書 §4 の要約）
- **actions に集約する**: 新規作成・同期・ページ全体の絞り込み/タブ/検索/CSV など「常にアクセスしたい・スクロールで消えると困る」操作。
- **本文に残す**: テーブル行ごとの編集/削除、選択中アイテムの保存/Undo、ポップオーバー起点ボタンなど「対象の近くにある方が分かりやすい」文脈アクション。
- 迷ったら「スクロールで消えると困るか？」。困る→ヘッダー、困らない→本文。

### 各タスク共通の検証手順（毎回やる）
1. `npm run dev:admin` でサンドボックス起動（既に起動中なら HMR で反映）。
2. 対象ページを開き、(a) 見出しと主要操作が上部に固定され、本文だけがスクロールするか (b) フォントが M PLUS 1 か (c) レイアウト崩れ・英語表示崩れがないか を目視。
3. 問題なければコミット。1ページ＝1コミット（memory `feedback_one_fix_one_verify`）。

---

## Phase A: 共通シェルのテスト固め

### Task A1: AdminPage の単体テスト

**Files:**
- Create: `src/components/admin/__tests__/AdminPage.test.tsx`

- [ ] **Step 1: テストを書く（失敗する状態）**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AdminPage } from '../AdminPage';

describe('AdminPage', () => {
  it('title を見出しとして表示する', () => {
    render(<AdminPage title="テスト見出し">本文</AdminPage>);
    expect(screen.getByRole('heading', { name: 'テスト見出し' })).toBeInTheDocument();
  });

  it('children（本文）を表示する', () => {
    render(<AdminPage title="t">本文ここ</AdminPage>);
    expect(screen.getByText('本文ここ')).toBeInTheDocument();
  });

  it('meta を渡すと表示する', () => {
    render(<AdminPage title="t" meta="60件">x</AdminPage>);
    expect(screen.getByText('60件')).toBeInTheDocument();
  });

  it('actions を渡すと表示する', () => {
    render(<AdminPage title="t" actions={<button>新規</button>}>x</AdminPage>);
    expect(screen.getByRole('button', { name: '新規' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 失敗（または成功）を確認**

Run: `npx vitest run src/components/admin/__tests__/AdminPage.test.tsx`
Expected: AdminPage は既存実装なので **PASS する想定**。もし import パス等で落ちたら修正。これは「正典シェルの契約」を固定するための回帰テスト。

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/admin/__tests__/AdminPage.test.tsx
rtk git commit -m "test(admin): AdminPage 共通シェルの契約テスト(title/meta/actions/children)"
```

---

## Phase B: 単純ページの横展開（h1＋本文型）

各タスクの手順は同型: ①ファイルを読む ②`AdminPage` を import ③return 直下のルート `<div>` を `<AdminPage ...>` に置換し、旧 `<h1>` を撤去して `title` へ ④ページ全体に効く上部操作を `actions` へ（無ければ省略）⑤閉じタグを `</AdminPage>` に ⑥サンドボックス目視 ⑦コミット。**内部に `max-h-[...] overflow-y-auto` を持たない**ことを確認（持っていたら Phase C 対象なので止めて報告）。

### Task B1: AdminDashboard

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: AdminPage でラップ**
  - `import { AdminPage } from './AdminPage';` を追加。
  - 旧ルート `<div className="space-y-10">` ＋ 先頭の `<h1>{t('admin.dashboard')}</h1>` を、`<AdminPage title={t('admin.dashboard')}>` に置換。
  - 本文（統計/外部ツール/アクションカード/同期/最近の変更/復元）はそのまま children に。`space-y-10` は children を包む内側 `<div className="space-y-10">` として残す（セクション間余白を維持）。
  - actions: ダッシュボードはページ全体操作なし → 省略（同期ボタンは「最近の変更」近くの文脈なので本文のまま）。
- [ ] **Step 2: サンドボックス目視**（`/admin`）— 見出し固定・本文スクロール・M PLUS 1。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminDashboard.tsx
rtk git commit -m "feat(admin): ダッシュボードを AdminPage シェルへ移行(固定ヘッダー)"
```

### Task B2: AdminContents

**Files:**
- Modify: `src/components/admin/AdminContents.tsx`

- [ ] **Step 1: ラップ**
  - 旧見出し＋「+ コンテンツ追加」ボタンが flex で並ぶ行を、`title={t('admin.contents_title')}` ＋ `actions={<button onClick={startAdd}>...追加...</button>}` に分解（既存ボタンの onClick / ラベル i18n キーはそのまま流用）。
  - テーブルの `overflow-x-auto`（横スクロール）はそのまま本文に残す（縦の独立スクロールではないので問題なし）。
  - 行ごとの編集/削除ボタンは本文のまま（文脈アクション）。
- [ ] **Step 2: サンドボックス目視**（`/admin/contents`）。fixtures が無い場合は空表示でも構造確認のみ。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminContents.tsx
rtk git commit -m "feat(admin): コンテンツ管理を AdminPage シェルへ移行"
```

### Task B3: AdminConfig

**Files:**
- Modify: `src/components/admin/AdminConfig.tsx`

- [ ] **Step 1: ラップ** — `title={t('admin.config_title')}`。上部アクション無し（保存はフォーム下部の文脈ボタンなので本文のまま）。loading 分岐も AdminPage の children 内に収める。
- [ ] **Step 2: サンドボックス目視**（`/admin/config`）。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminConfig.tsx
rtk git commit -m "feat(admin): 設定を AdminPage シェルへ移行"
```

### Task B4: AdminBackups

**Files:**
- Modify: `src/components/admin/AdminBackups.tsx`

- [ ] **Step 1: ラップ** — `title={t('admin.backups_title')}`。`actions` に「更新（リロード）ボタン」＋「フィルタボタン群（all/skills/stats/contents/servers/template）」を集約（ページ全体に効くため）。各バックアップ行の「復元」ボタンは本文のまま（文脈）。フィルタ群が横に長い場合は `actions` 内で `flex flex-wrap gap-2`。
- [ ] **Step 2: サンドボックス目視**（`/admin/backups`）— フィルタ切替が固定ヘッダーで効くこと。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminBackups.tsx
rtk git commit -m "feat(admin): バックアップを AdminPage シェルへ移行(更新/フィルタをヘッダー集約)"
```

### Task B5: AdminLogs

**Files:**
- Modify: `src/components/admin/AdminLogs.tsx`

- [ ] **Step 1: ラップ** — `title={t('admin.logs_title')}`。`actions` に「リロードボタン」＋「フィルタボタン群（7種）」を集約。ログ本体は表示のみなので本文。
- [ ] **Step 2: サンドボックス目視**（`/admin/logs`）。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminLogs.tsx
rtk git commit -m "feat(admin): ログを AdminPage シェルへ移行(リロード/フィルタをヘッダー集約)"
```

### Task B6: AdminUgc

**Files:**
- Modify: `src/components/admin/AdminUgc.tsx`

- [ ] **Step 1: ラップ** — `title={t('admin.ugc_title')}`。説明文は本文先頭に残す。検索バー（input + button）は `actions` に集約（ページ主操作）。旧ルートの `max-w-2xl` は本文を包む内側 div として残す（ヘッダーは全幅、本文だけ幅制限）。検索結果のロゴ削除は文脈なので本文。
- [ ] **Step 2: サンドボックス目視**（`/admin/ugc`）。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminUgc.tsx
rtk git commit -m "feat(admin): UGC(ロゴ)を AdminPage シェルへ移行(検索をヘッダー集約)"
```

### Task B7: AdminFeatured

**Files:**
- Modify: `src/components/admin/AdminFeatured.tsx`

- [ ] **Step 1: ラップ** — このページは `<h1>` が無く、内部で browse/search にセグメント分岐。`title` は i18n キー `t('admin.featured_title')`（[AdminLayout NAV](../../../src/components/admin/AdminLayout.tsx#L24) と同じキー）を使う。view 切替セグメントコントロールは `actions` に集約。各ビュー（PopularBrowseView / 検索）の本体は children。
- [ ] **Step 2: サンドボックス目視**（`/admin/featured`）— セグメント切替が固定ヘッダーで効く。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminFeatured.tsx
rtk git commit -m "feat(admin): 注目(Featured)を AdminPage シェルへ移行(view切替をヘッダー集約)"
```

### Task B8: AdminSystemNotifications

**Files:**
- Modify: `src/components/admin/AdminSystemNotifications.tsx`

- [ ] **Step 1: ラップ** — `title={t('system_notif.admin.page_title')}`。`actions` に「新規通知ボタン（openNew）」を集約。各 item の publish/edit/delete は文脈なので本文。EditModal は fixed overlay のままで影響なし。
- [ ] **Step 2: サンドボックス目視**（`/admin/notifications`）。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminSystemNotifications.tsx
rtk git commit -m "feat(admin): システム通知を AdminPage シェルへ移行(新規をヘッダー集約)"
```

### Task B9: AdminHousingReports

**Files:**
- Modify: `src/components/admin/AdminHousingReports.tsx`

- [ ] **Step 1: ラップ** — `title={t('admin.housing_reports.title')}`。説明文は本文先頭。上部アクション無し。物件カードの「物件を見る/非表示」、通報の「却下」は文脈なので本文。
- [ ] **Step 2: サンドボックス目視**（`/admin/housing-reports`）。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminHousingReports.tsx
rtk git commit -m "feat(admin): ハウジング通報を AdminPage シェルへ移行"
```

### Task B10: AdminStats

**Files:**
- Modify: `src/components/admin/AdminStats.tsx`

- [ ] **Step 1: ラップ** — `title`（旧 `<h1>ステータス管理</h1>` の i18n キーを使用。ハードコード文字列なら既存の i18n キーに直すか、既存表記を尊重して `t(...)` 化。**新規ハードコードは増やさない**＝既にキーがあればそれ、無ければ既存文字列のまま `title` に渡す）。保存ボタン（dirty）は「ページ全体の保存」なので `actions` に集約。3セクション（LevelModifiers/PatchStats/DefaultStatsByLevel）の各テーブル `overflow-x-auto` は横スクロールなので本文のまま。
- [ ] **Step 2: サンドボックス目視**（`/admin/stats`）— 保存ボタンが固定ヘッダーに常駐し、長い表をスクロールしても押せる。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminStats.tsx
rtk git commit -m "feat(admin): ステータス管理を AdminPage シェルへ移行(保存をヘッダー常駐)"
```

### Task B11: AdminTranslations

**Files:**
- Modify: `src/components/admin/AdminTranslations.tsx`

- [ ] **Step 1: ラップ** — `title={t('admin.translations_title')}`。上部操作が多い（カテゴリタブ / コンテンツ select / グループフィルタ / 未翻訳フィルタ / 進捗 / CSVツール / 保存）。**全部を actions に詰めると窮屈になる恐れ**があるため次の方針:
  - `actions`: 保存ボタン＋未翻訳フィルタ＋進捗表示（常に見たい/押したい）。
  - 本文先頭に「操作バー」divを残す: カテゴリタブ・コンテンツ select・グループフィルタ・CSVツール（切替頻度が中程度・横幅を食う）。
  - 旧ルートの `max-w-[1200px]` は本文を包む内側 div として残す。
- [ ] **Step 2: サンドボックス目視**（`/admin/translations`）— 保存と進捗が固定で見える。崩れがあれば操作バーの配分を調整（ユーザー確認チェックポイント）。
- [ ] **Step 3: コミット**
```bash
rtk git add src/components/admin/AdminTranslations.tsx
rtk git commit -m "feat(admin): 翻訳管理を AdminPage シェルへ移行(保存/進捗をヘッダー常駐)"
```

---

## Phase C: 内部スクロール/2カラムページ（作り込み要・ユーザー確認チェックポイントあり）

このフェーズは独立スクロールの 2 カラム構造を持ち、AdminPage の body スクロールと二重化する。**各タスクは実装前にサンドボックスで現状を確認し、レイアウト方針をユーザーに1行で確認してから着手する**（設計書 §9 の残論点）。

### Task C1: AdminServers

**Files:**
- Modify: `src/components/admin/AdminServers.tsx`

- [ ] **Step 1: 構造確認** — タブ（dc/housing/sizes/tags）＋ DC タブは2カラム（左DC選択/右サーバー一覧）。各パネルが `max-h-[70vh] overflow-y-auto`。
- [ ] **Step 2: ラップ方針**
  - `title={t('admin.servers')}` ＋ サブテキスト（dcCount/serverCount）を `meta` に。
  - タブナビ（4タブ）＋保存ボタンを `actions` に集約（常に切替・保存したい）。
  - 2カラムの各パネルの `max-h-[70vh]` を撤去し、代わりに2カラムコンテナを `flex-1 min-h-0` にして各パネルを `overflow-y-auto` で**親（AdminPage body）の高さに追従**させる（70vh 固定をやめ、画面高に合わせる）。これにより固定ヘッダー下で各カラムが自然にスクロール。
- [ ] **Step 3: サンドボックス目視**（`/admin/servers`）— タブ切替・保存がヘッダー固定、2カラムが画面高でスクロール、崩れなし。
- [ ] **Step 4: コミット**
```bash
rtk git add src/components/admin/AdminServers.tsx
rtk git commit -m "feat(admin): サーバー管理を AdminPage シェルへ移行(タブ/保存ヘッダー集約・2カラム高さ追従)"
```

### Task C2: AdminSkills

**Files:**
- Modify: `src/components/admin/AdminSkills.tsx`

- [ ] **Step 1: 構造確認** — 2カラム（左ジョブ選択/右スキル一覧）、各 `max-h-[70vh] overflow-y-auto`。保存ボタン（dirty）あり。サブテキスト（jobCount/skillCount）。
- [ ] **Step 2: ラップ方針**
  - `title`（旧見出し「スキル管理」の i18n キー。無ければ既存表記を尊重）＋ jobCount/skillCount を `meta` に。
  - 保存ボタンを `actions` に集約。
  - 2カラムは C1 と同じく `max-h-[70vh]` 撤去 → コンテナ `flex-1 min-h-0` ＋ 各パネル `overflow-y-auto` で画面高追従。
  - スキル追加/編集/削除モーダル（fixed overlay）は影響なし。
- [ ] **Step 3: サンドボックス目視**（`/admin/skills`）。
- [ ] **Step 4: コミット**
```bash
rtk git add src/components/admin/AdminSkills.tsx
rtk git commit -m "feat(admin): スキル管理を AdminPage シェルへ移行(保存ヘッダー集約・2カラム高さ追従)"
```

---

## Phase D: ウィザード4本（固定ヘッダーは載せず、潰れ防止のみ）

ウィザードは独自のステップUI（AdminWizard / WizardHeader）と自前スクロールを持つ。AdminPage は**使わない**（二重ヘッダー/二重スクロールになるため）。main が `overflow-hidden` になったので、ウィザードのルートが画面高で自前スクロールするように `h-full` 化するだけにとどめる。

### Task D1: 共有ウィザードシェル `AdminWizard` の高さ・スクロール安全化

**Files:**
- Modify: `src/components/admin/wizard/AdminWizard.tsx`（ContentWizard / TemplateWizard / JobWizard が利用）

- [ ] **Step 1: 構造確認** — AdminWizard のルート要素とスクロール領域を読む。
- [ ] **Step 2: 高さ追従化** — ルート要素を `h-full min-h-0 flex flex-col` にし、ステップ本文領域を `flex-1 min-h-0 overflow-auto` にする（既にそうなっていれば、ルートに `h-full` を足すだけ）。固定したいステップヘッダー/プログレスは `shrink-0` のまま上部に残す。
- [ ] **Step 3: サンドボックス目視**（`/admin/content-wizard`, `/admin/template-wizard`, `/admin/job-wizard`）— ステップヘッダー固定・本文スクロール・潰れ無し。
- [ ] **Step 4: コミット**
```bash
rtk git add src/components/admin/wizard/AdminWizard.tsx
rtk git commit -m "fix(admin): ウィザード共通シェルを画面高追従+本文スクロール化(overflow-hidden main 対応)"
```

### Task D2: StatsWizard（AdminWizard 非経由のブランチ構造）

**Files:**
- Modify: `src/components/admin/wizard/StatsWizard.tsx`

- [ ] **Step 1: 構造確認** — Mode selector ＋ AddBranch/EditBranch/LevelBranch が各々独立。WizardHeader を使用。AdminWizard は経由しない。
- [ ] **Step 2: 高さ追従化** — 各 Branch（および DoneScreen / Mode selector）の最上位要素を `h-full min-h-0 flex flex-col` にし、本文を `flex-1 min-h-0 overflow-auto`。WizardHeader は `shrink-0`。共通化できるなら各 Branch を包む小さなラッパー `<div className="h-full min-h-0 flex flex-col">` を1つ作って使い回す（DRY）。
- [ ] **Step 3: サンドボックス目視**（`/admin/stats-wizard` の3ブランチ）。
- [ ] **Step 4: コミット**
```bash
rtk git add src/components/admin/wizard/StatsWizard.tsx
rtk git commit -m "fix(admin): StatsWizard 各ブランチを画面高追従+本文スクロール化"
```

---

## Phase E: 仕上げ（全ルート通し検証＋ビルド）

### Task E1: 全18ルートのスクロール健全性チェック

- [ ] **Step 1: サンドボックスで全ルート巡回** — `/admin`, contents, templates, skills, translations, stats, servers, config, backups, logs, ugc, featured, notifications, housing-reports, content-wizard, template-wizard, job-wizard, stats-wizard。各ページで「上部固定・本文スクロール・潰れ/はみ出し無し・フォント M PLUS 1」を確認。未移行で潰れているページが無いこと（移行漏れ＝設計書 §8 の最大リスク）。
- [ ] **Step 2: 気づいた崩れがあれば該当 Task に戻って修正**（このステップではコミット不要、修正は各ページのコミットに含める）。

### Task E2: ビルド＋テスト（push 前必須）

- [ ] **Step 1: 型・ビルド** — Run: `npm run build`（tsc -b は厳密。未使用 import / 型不足 / erasable syntax に注意＝memory `feedback_vercel_tsc_strict` / `reference_erasable_syntax_test_mocks`）。Expected: EXIT 0。
- [ ] **Step 2: テスト** — Run: `npx vitest run`（出力をパイプしない＝memory `reference_vitest_appcheck_teardown`）。Expected: 既知の失敗（housing TopBar 4件 / HousingWorkspace 1件、設計書外）以外は緑。AdminPage テストが緑。
- [ ] **Step 3: TODO 更新** — `docs/TODO.md`「現在の状態」に「管理画面リデザイン＝全18ルート AdminPage 化完了・M PLUS 1 化」を反映。完了詳細は TODO_COMPLETED.md へ。
- [ ] **Step 4: コミット**
```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(todo): 管理画面リデザイン(全18ルート共通シェル化)完了を反映"
```

- [ ] **Step 5: 本番反映** — ユーザー判断でまとめて push（memory `feedback_vercel_builds`：ビルド回数節約のため push はまとめる）。デプロイ後、本物の `/admin` で1ページ実機確認（memory `feedback_endpoint_user_verification`）。

---

## Self-Review（このプランの自己点検）

- **Spec coverage**: 設計書 §2（A案/フォント）→ 既実装＋Phase 全体。§3（AdminPage/Layout/font）→ 既実装＋Task A1 でテスト固め。§4（集約ルール）→ 各 Task に反映。§5.1（14ページ）→ templates 既＋B1-B11(11)＋C1-C2(2)=14。§5.2（ウィザード4本）→ D1（3本）＋D2（1本）。§7（テスト/ビルド）→ A1, E2。§8（移行漏れリスク）→ E1。すべて被覆。
- **Placeholder scan**: 「TBD/後で」等なし。各ページの title キー・actions 対象・スクロール方針を具体記載。ハードコード見出し（Stats/Skills）は「新規ハードコードを増やさない」明示。
- **Type consistency**: `AdminPage` の props（title/meta/actions/children）は実装（[AdminPage.tsx](../../../src/components/admin/AdminPage.tsx)）と一致。`max-h-[70vh]` 撤去→`flex-1 min-h-0`＋`overflow-y-auto` は C1/C2/D で同一表現。
- 注意: 各ページの厳密な現行コードは実装者（subagent）がファイルを読んで確認する前提（正典 = AdminTemplates の差分パターン）。i18n キーが未存在の見出し（Stats/Skills）は新規キーを足さず既存表記を尊重する方針を明記済み。
