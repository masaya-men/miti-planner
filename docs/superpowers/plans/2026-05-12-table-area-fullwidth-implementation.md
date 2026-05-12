# 表エリア全幅化 / メンバー列幅拡張 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユーザー画面 (CSS 1489 / DPR 2.58) でフォーカスモード時にタイムラインがピッタリ収まるよう、 メンバー列幅 (T/H 126 → 151px) と各列の左右マージン (2.9px) を導入する。 縦スクロールバーは非表示 (管理画面除く)、 横スクロールバーは「あえて溢れさせる」 UX 目印として残す。

**Architecture:** CSS 変数 (`--col-th-w` / `--col-member-pad-x`) を一元定義し、 `getColumnCssVar()` ヘルパー (`src/utils/calculator.ts`) でマージン込み全幅 calc() を返すよう拡張する。 これによりメンバー列幅を参照する Timeline.tsx / TimelineRow.tsx の inline `calc()` が削除され、 「メンバー列幅変更時に複数ファイル同期が必要」 という構造的リスクを排除する。 セッション 16 の対称性ロジック (VISUAL_OFFSET / fallbackColWidth) は内側エリア基準で動作し、 `useMeasuredMemberLayout` で padding を吸収することで触らずに済む。

**Tech Stack:** React + TypeScript + Tailwind v4 + Vite + Vitest。 既存 utility (`calculator.ts`) と layout hook (`Timeline.layoutHooks.ts`) を拡張。

---

## 現状 (ローカル試作 ブランチ `feat/table-area-fullwidth`)

ローカル試作で動作確認済 (= ユーザー目視承認済)。 本計画は試作の残作業 (リファクタ + 検証 + コミット + デプロイ) のみ扱う。

**試作で既に変更されたファイル**:
- `src/index.css` — `--col-th-w: 151px` / `--col-member-pad-x: 2.9px` / 縦スクロールバー非表示 + `[data-admin-page]` 除外
- `src/components/Timeline.tsx` — メンバー列ヘッダー (L2208) inline calc + padding 適用、 fallback 126 → 151
- `src/components/TimelineRow.tsx` — タイムライン本体セル (L631) inline calc
- `src/components/Timeline.layoutHooks.ts` — padding 吸収 (内側エリア計測)
- `src/components/admin/AdminLayout.tsx` — `data-admin-page` 属性追加
- `src/components/dev/ColumnWidthSlider.tsx` — 初期値更新 + マージンスライダー追加 (dev only)
- `docs/superpowers/specs/2026-05-12-table-area-fullwidth-design.md` — 最終確定値で更新済

**未着手 (本計画のスコープ)**:
- `src/utils/calculator.ts` の `getColumnCssVar` をマージン込み全幅返却にリファクタ
- `src/utils/__tests__/calculator.test.ts` の assertion 更新
- 上記リファクタを受けて Timeline.tsx / TimelineRow.tsx の inline calc 削除
- build + vitest 検証
- コミット (リファクタ + 試作分まとめて)
- main マージ + push + デプロイ確認

---

## File Structure

| ファイル | 変更内容 | 責務 |
|---|---|---|
| `src/utils/calculator.ts` | `getColumnCssVar` をマージン込み全幅返却に拡張 | メンバー列の幅 CSS 文字列を返す唯一の正解パス |
| `src/utils/__tests__/calculator.test.ts` | 新形式の calc() 文字列を expect | 上記の単体テスト |
| `src/components/Timeline.tsx` (L2208 周辺) | inline calc() を削除、 `getColumnCssVar()` 直渡し | メンバー列ヘッダー (ジョブアイコン部) の描画 |
| `src/components/TimelineRow.tsx` (L631 周辺) | inline calc() を削除、 `getColumnCssVar()` 直渡し | タイムライン本体の各イベント行のセル描画 |

その他のファイルは試作のままで完了。

---

## Task 1: `getColumnCssVar` をマージン込み全幅返却にリファクタ

**Files:**
- Modify: `src/utils/calculator.ts:25-28`

- [ ] **Step 1: 既存 `getColumnCssVar` 関数の現状を確認**

Read `src/utils/calculator.ts:20-28`. 現状:

```ts
/**
 * パーティメンバー列の CSS 幅式を返す。
 * src/index.css の `--col-th-w` (タンク/ヒーラー) と `--col-dps-w` (DPS) を参照。
 * clamp(min, vw, max) で 1366-3840 全 viewport をカバー。
 */
export const getColumnCssVar = (role: string): string => {
    if (role === 'tank' || role === 'healer') return 'var(--col-th-w)';
    return 'var(--col-dps-w)';
};
```

- [ ] **Step 2: マージン込み全幅返却にリファクタ**

Edit `src/utils/calculator.ts:20-28`:

```ts
/**
 * パーティメンバー列の CSS 幅式を返す (マージン込みの全幅)。
 * src/index.css の `--col-th-w` (タンク/ヒーラー) / `--col-dps-w` (DPS) +
 * `--col-member-pad-x` × 2 (セッション 17 で追加された左右マージン) の合計。
 *
 * 内側 (アイコン配置エリア) を直接参照したい場合は元の CSS 変数 (var(--col-th-w) 等) を使う。
 */
export const getColumnCssVar = (role: string): string => {
    const innerVar = role === 'tank' || role === 'healer' ? 'var(--col-th-w)' : 'var(--col-dps-w)';
    return `calc(${innerVar} + var(--col-member-pad-x) * 2)`;
};
```

- [ ] **Step 3: TypeScript 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし (戻り値型 `string` は変わらず、 既存呼び出し元への型影響なし)

---

## Task 2: `getColumnCssVar` 単体テストの更新

**Files:**
- Modify: `src/utils/__tests__/calculator.test.ts:120-135`

- [ ] **Step 1: 既存テストの確認**

Read `src/utils/__tests__/calculator.test.ts:120-135`. 現状の assertion:

```ts
it('タンクは var(--col-th-w) を返す', () => {
    expect(getColumnCssVar('tank')).toBe('var(--col-th-w)');
});

it('ヒーラーは var(--col-th-w) を返す', () => {
    expect(getColumnCssVar('healer')).toBe('var(--col-th-w)');
});

it('DPS (および未知ロール) は var(--col-dps-w) を返す', () => {
    expect(getColumnCssVar('dps')).toBe('var(--col-dps-w)');
    expect(getColumnCssVar('unknown')).toBe('var(--col-dps-w)');
});
```

- [ ] **Step 2: 新形式の calc() 文字列を期待する assertion に更新**

Edit `src/utils/__tests__/calculator.test.ts:120-135`:

```ts
it('タンクはマージン込み全幅の calc() を返す', () => {
    expect(getColumnCssVar('tank')).toBe('calc(var(--col-th-w) + var(--col-member-pad-x) * 2)');
});

it('ヒーラーはマージン込み全幅の calc() を返す', () => {
    expect(getColumnCssVar('healer')).toBe('calc(var(--col-th-w) + var(--col-member-pad-x) * 2)');
});

it('DPS (および未知ロール) はマージン込み全幅の calc() を返す', () => {
    expect(getColumnCssVar('dps')).toBe('calc(var(--col-dps-w) + var(--col-member-pad-x) * 2)');
    expect(getColumnCssVar('unknown')).toBe('calc(var(--col-dps-w) + var(--col-member-pad-x) * 2)');
});
```

- [ ] **Step 3: vitest 実行で 3 件 pass 確認**

Run: `npx vitest run src/utils/__tests__/calculator.test.ts`
Expected: PASS (該当 3 件含む全テスト)

---

## Task 3: Timeline.tsx のメンバー列ヘッダー inline calc を削除

**Files:**
- Modify: `src/components/Timeline.tsx:2208-2214`

- [ ] **Step 1: 現状の inline calc を確認**

Read `src/components/Timeline.tsx:2208-2214`. 現状:

```tsx
style={{
    width: `calc(${getColumnCssVar(member.role)} + var(--col-member-pad-x) * 2)`,
    minWidth: `calc(${getColumnCssVar(member.role)} + var(--col-member-pad-x) * 2)`,
    maxWidth: `calc(${getColumnCssVar(member.role)} + var(--col-member-pad-x) * 2)`,
    paddingLeft: 'var(--col-member-pad-x)',
    paddingRight: 'var(--col-member-pad-x)',
}}
```

- [ ] **Step 2: `getColumnCssVar()` 直渡しにシンプル化**

Edit `src/components/Timeline.tsx:2208-2214`:

```tsx
style={{
    width: getColumnCssVar(member.role),
    minWidth: getColumnCssVar(member.role),
    maxWidth: getColumnCssVar(member.role),
    paddingLeft: 'var(--col-member-pad-x)',
    paddingRight: 'var(--col-member-pad-x)',
}}
```

注: padding は引き続き必要 (= 内側 padding は別概念で、 width 計算とは独立。 width は全幅、 padding は中身を縮める)。

- [ ] **Step 3: TypeScript 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 4: TimelineRow.tsx の本体セル inline calc を削除

**Files:**
- Modify: `src/components/TimelineRow.tsx:631-635`

- [ ] **Step 1: 現状の inline calc を確認**

Read `src/components/TimelineRow.tsx:631-635`. 現状:

```tsx
style={{
    width: `calc(${getColumnCssVar(member.role)} + var(--col-member-pad-x) * 2)`,
    minWidth: `calc(${getColumnCssVar(member.role)} + var(--col-member-pad-x) * 2)`,
    maxWidth: `calc(${getColumnCssVar(member.role)} + var(--col-member-pad-x) * 2)`,
}}
```

- [ ] **Step 2: `getColumnCssVar()` 直渡しにシンプル化**

Edit `src/components/TimelineRow.tsx:631-635`:

```tsx
style={{ width: getColumnCssVar(member.role), minWidth: getColumnCssVar(member.role), maxWidth: getColumnCssVar(member.role) }}
```

注: 本体セルには padding を入れない (= ホバー / クリック領域を全幅にして UX を優先)。 罫線位置 (= border-r) は width = 156.8 (151 + 5.8) で揃う。

- [ ] **Step 3: TypeScript 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

---

## Task 5: 統合検証 (build + vitest)

**Files:** 検証のみ

- [ ] **Step 1: 全テスト実行**

Run: `npx vitest run`
Expected: 全 pass。 もし他のテストが calculator の戻り値依存で fail したら、 そのテストも更新する (Task 2 の延長として)

- [ ] **Step 2: 本番ビルド**

Run: `npm run build`
Expected: ビルド成功、 TypeScript エラーなし、 Tailwind / Vite ビルドが完了

memory: `feedback_vercel_tsc_strict.md` の通り、 Vercel は tsc 厳密モード。 未使用 import / 型不一致は必ず取り除く。

- [ ] **Step 3: ローカル dev server でユーザー画面の最終目視確認**

ローカル dev server (既に起動中) で軽減アプリページを開き、 以下を再確認:
- フォーカスモード時にタイムラインがピッタリ収まる
- 通常モード時はあえて溢れて横スクロールバーが見える
- 配置済み軽減アイコン / 縦罫線 / ジョブアイコンが揃っている
- 縦スクロールバーは消えている (軽減アプリ)
- 管理画面 (`/admin`) の縦スクロールバーは復活している

問題があれば Task 1〜4 を見直す。 問題なければ次へ。

---

## Task 6: コミット (試作分 + リファクタをまとめて)

**Files:** 全変更ファイル

- [ ] **Step 1: 変更ファイル確認**

Run: `rtk git status`
Expected: 以下のファイルが modified:
- src/index.css
- src/components/Timeline.tsx
- src/components/TimelineRow.tsx
- src/components/Timeline.layoutHooks.ts
- src/components/admin/AdminLayout.tsx
- src/components/dev/ColumnWidthSlider.tsx
- src/utils/calculator.ts
- src/utils/__tests__/calculator.test.ts
- docs/superpowers/specs/2026-05-12-table-area-fullwidth-design.md
- docs/superpowers/plans/2026-05-12-table-area-fullwidth-implementation.md (本ファイル)
- docs/TODO.md (互い違いチラつき記録分)

- [ ] **Step 2: 差分の最終確認**

Run: `rtk git diff --stat`
Expected: 変更行数の概観確認

- [ ] **Step 3: 全変更をステージ + コミット**

```bash
rtk git add src/index.css \
    src/components/Timeline.tsx \
    src/components/TimelineRow.tsx \
    src/components/Timeline.layoutHooks.ts \
    src/components/admin/AdminLayout.tsx \
    src/components/dev/ColumnWidthSlider.tsx \
    src/utils/calculator.ts \
    src/utils/__tests__/calculator.test.ts \
    docs/superpowers/specs/2026-05-12-table-area-fullwidth-design.md \
    docs/superpowers/plans/2026-05-12-table-area-fullwidth-implementation.md \
    docs/TODO.md

rtk git commit -m "$(cat <<'EOF'
feat(timeline): 表エリア全幅化 - T/H 列幅 126→151px、 マージン 2.9px、 縦スクロールバー非表示

セッション 17 ローカル試作で実機目視確定:
- T/H 列幅 126 → 151px (6 アイコン対称、 セッション 16 の対称性思想踏襲)
- DPS 列幅 53px 維持 (2 アイコン対称)
- 各メンバー列の左右マージン 2.9px (新規 CSS 変数 --col-member-pad-x)
- 縦スクロールバー非表示 (グローバル、 管理画面 [data-admin-page] のみ復活)
- 横スクロールバーは残す (通常モード時の「あえて溢れさせる」 UX 目印)

構造リファクタ:
- getColumnCssVar (calculator.ts) をマージン込み全幅返却に拡張
- Timeline.tsx と TimelineRow.tsx の inline calc() を削除し一元化
- Timeline.layoutHooks.ts で padding 吸収 (内側エリア計測)
- calculator.test.ts assertion を新形式に更新

dev tool: ColumnWidthSlider にマージンスライダー追加 (動的微調整)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: コミット成功、 pre-commit hook (gitleaks 等) も通過

注: もし pre-commit hook で失敗した場合は、 fix → 再ステージ → 新規 commit する。 `--amend` は使わない (CLAUDE.md ガイドライン)。

---

## Task 7: main ブランチへマージ

**Files:** git のみ

- [ ] **Step 1: main へ切替**

Run: `rtk git checkout main`
Expected: 切替成功

- [ ] **Step 2: feat/table-area-fullwidth を main にマージ**

Run: `rtk git merge feat/table-area-fullwidth --no-ff`
Expected: マージコミット作成 (no-fast-forward で履歴を残す)

代替案: `rtk git merge feat/table-area-fullwidth` (fast-forward でも可)。 プロジェクト慣習に合わせる。

- [ ] **Step 3: ブランチクリーンアップ**

Run: `rtk git branch -d feat/table-area-fullwidth`
Expected: ブランチ削除成功 (マージ済なので安全)

---

## Task 8: push + Vercel デプロイ確認

**Files:** デプロイ

- [ ] **Step 1: リモート push**

Run: `rtk git push origin main`
Expected: push 成功

memory `feedback_vercel_builds.md`: Vercel Hobby プラン月 100 ビルド制限。 不要な push はまとめる。 本コミットは大きい変更なので単独 push で OK。

- [ ] **Step 2: Vercel デプロイ自動開始確認**

Vercel ダッシュボードで本プロジェクトのデプロイ状況確認。 通常 push 後 1-2 分でビルド開始 → 3-5 分でデプロイ完了。

ユーザーに「Vercel のビルドが完了したら本番で再確認してください」 と依頼。

- [ ] **Step 3: 本番動作確認 (ユーザー依頼)**

本番 URL で以下を確認:
- フォーカスモード時にタイムラインがピッタリ収まる
- 通常モード時は意図通り溢れる
- 縦スクロールバー消える / 横は残る
- 管理画面のスクロールバー残る
- PWA キャッシュで古い形式が残る場合は memory `feedback_pwa_cache_after_deploy.md` の通りハードリロード / SW アンロード提案

---

## Task 9: dev server 停止 + TODO.md 更新

**Files:** `docs/TODO.md`

- [ ] **Step 1: dev server 停止**

ローカル dev server を停止。 Bash で起動した場合は kill 等で対処。

- [ ] **Step 2: TODO.md 更新**

セッション 17 の作業を整理:
- 「次セッション最優先 1」 (= 表エリア全幅化) を完了マーク → `docs/TODO_COMPLETED.md` に移動
- 「次セッション最優先」 セクションの 2 (リキャスト専用行) と 3 (効果中スキル最上行残し) は残す
- 「バグ・不具合」 の「互い違い再配置チラつき」 はそのまま残す (= 別タスクとして対応予定)
- 「現在の状態」 セクションを更新 (= 「最新本番デプロイ: セッション 17 末、 表エリア全幅化完了」)

memory `feedback_clean_environment.md`: TODO.md 100 行以内を維持。 セッション終了時 `wc -l docs/TODO.md` で確認。

- [ ] **Step 3: TODO.md コミット**

```bash
rtk git add docs/TODO.md docs/TODO_COMPLETED.md
rtk git commit -m "docs(todo): セッション 17 完了タスクを整理 (表エリア全幅化クローズ)"
rtk git push origin main
```

注: TODO.md 更新は本番影響ゼロなので、 Vercel ビルドは走るがコンテンツ変更ない (= memory `feedback_vercel_builds.md` 的にはやや無駄)。 本実装コミットと一緒にまとめても良いが、 心理的に「実装完了 → ユーザー本番確認 → TODO 整理」 の順で進めるのが安全。

---

## スコープ外 (本計画では扱わない)

- リキャスト専用行 (TODO.md 次セッション最優先 2) → 別 spec / 別 plan で
- 効果中スキル最上行残し (TODO.md 次セッション最優先 3) → 別 spec / 別 plan で
- 互い違い再配置チラつき (TODO.md バグ・不具合 中) → 別タスクで対応
- ColumnWidthSlider 自体の削除 (= dev ツールとして維持、 今後のチューニングで活用)

---

## Self-Review

### 1. Spec coverage

| spec の確定事項 | 対応タスク |
|---|---|
| T/H 列 アイコン配置エリア 151px | 試作で完了 (`src/index.css`) |
| DPS 列 53px 維持 | 試作で完了 |
| マージン 2.9px | 試作で完了 |
| 全モード共通 (通常モードあえて溢れさせる) | 試作で完了 |
| 縦スクロールバー非表示 (管理画面除外) | 試作で完了 (`AdminLayout.tsx` + `index.css`) |
| 横スクロールバー残す | デフォルト動作で OK |
| 既存フォーカスモード機能変更なし | 試作で確認済 |
| 1920+ ユーザー対応 (sizing 思想 v2 通り) | 固定値なので自動的に余白拡大 |
| 影響範囲確認 (罫線 / ジョブアイコン / 配置済みアイコン 等) | Task 5 Step 3 で目視 |
| getColumnCssVar リファクタ (構造的リスク対処) | Task 1〜4 |

### 2. Placeholder scan

- TBD / TODO / 「detail later」 → なし ✓
- 「Add appropriate error handling」 等の曖昧 → なし ✓
- 全 Step に具体的なコードまたはコマンド ✓

### 3. Type consistency

- `getColumnCssVar(role: string): string` 戻り値型は不変 ✓
- Timeline.tsx / TimelineRow.tsx での呼び出しシグネチャ変更なし ✓

### 4. Scope

- 単一 PR にまとまる適切なサイズ ✓
- 後続タスク (リキャスト専用行 / 効果中スキル最上行残し) を分離 ✓
