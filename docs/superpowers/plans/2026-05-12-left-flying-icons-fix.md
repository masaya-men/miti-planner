# 軽減アイコン「左から飛んでくる」 現象修正 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハードリロード / 別ページから戻る場面で発生する軽減アイコンの「左 (x=0) から正位置への飛び」 を、 React の useLayoutEffect で paint 前に layout を確定させることで根本治療する。

**Architecture:** `src/components/Timeline.layoutHooks.ts` の `useEffect` を `useLayoutEffect` に変更するだけ。 React は useLayoutEffect 内の setState を paint 前に同期処理するため、 1 pass 目の「colStart=0」 状態は paint されなくなり、 ユーザーには「最初から正位置」 に見える。

**Tech Stack:** React 19, TypeScript, Vitest, Playwright

設計書: `docs/superpowers/specs/2026-05-12-left-flying-icons-fix-design.md`

---

## File Structure

**変更ファイル (1 つだけ)**:
- `src/components/Timeline.layoutHooks.ts`: import 行 + hook 内の 1 箇所 (`useEffect` → `useLayoutEffect`)

**変更しないファイル**:
- `src/components/Timeline.tsx`: `layoutReady` prop は保険として維持
- `playwright/timeline-responsive.spec.ts`: 列幅テストは無関係 (既存維持)
- すべての vitest テスト: 動作は同じ、 タイミングだけ早まる (既存維持)

---

## Task 1: useEffect を useLayoutEffect に変更

**Files:**
- Modify: `src/components/Timeline.layoutHooks.ts` (2 箇所、 import + hook 内)

- [ ] **Step 1: 現状ファイルを読んで内容を確認**

Run: `cat src/components/Timeline.layoutHooks.ts` で全体を確認 (50 行)。

確認したい箇所:
- 1 行目: `import { useState, useEffect } from 'react';`
- 24 行目あたり: `useEffect(() => { ... }, [entries]);`

- [ ] **Step 2: import 文を変更**

`src/components/Timeline.layoutHooks.ts:1` を編集:

```diff
-import { useState, useEffect } from 'react';
+import { useState, useLayoutEffect } from 'react';
```

- [ ] **Step 3: hook 内の useEffect 呼び出しを useLayoutEffect に変更**

`src/components/Timeline.layoutHooks.ts:24` を編集:

```diff
-  useEffect(() => {
+  useLayoutEffect(() => {
     const compute = () => {
       const next = new Map<string, MemberLayoutEntry>();
       for (const { id, el } of entries) {
         if (!el) continue;
         next.set(id, { left: el.offsetLeft, width: el.offsetWidth });
       }
       setLayout(next);
     };
```

ロジック本体は **一切変更しない**。 hook 名のみ変更。

- [ ] **Step 4: TypeScript 型チェック**

Run: `npx tsc --noEmit`
Expected: clean (出力なし)

- [ ] **Step 5: 既存テストが PASS することを確認**

Run: `npx vitest run`
Expected: `Test Files 65 passed (65) / Tests 636 passed (636)`

useLayoutEffect は useEffect と同じ API なので、 既存テストへの影響なし。 もし FAIL するならコード変更ミス。

- [ ] **Step 6: production build 成功確認**

Run: `npm run build`
Expected: `✓ built in N s` (警告のみ、 エラーなし)

- [ ] **Step 7: コミット**

```bash
git add src/components/Timeline.layoutHooks.ts
git commit -m "$(cat <<'EOF'
fix(Timeline): useLayoutEffect で軽減アイコンの「左から飛んでくる」 を根本治療

useEffect は paint 後実行のため、 1 pass 目で colStart=0 のアイコンが
画面に paint された後、 2 pass 目で正位置にジャンプして「飛び」 が見えていた。
useLayoutEffect に変更することで paint 前に同期再 render → 2 pass 目の正位置
状態のみが paint される。 ユーザーには「最初から正位置」 に見える。

設計書: docs/superpowers/specs/2026-05-12-left-flying-icons-fix-design.md

検証: vitest 636/636、 tsc clean、 build ✓

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: push**

```bash
git push
```

Vercel 自動デプロイが走る。

---

## Task 2: 本番動作確認 (ユーザー実機テスト)

**Files:** なし (ユーザーによる目視確認)

- [ ] **Step 1: Vercel デプロイ完了を待つ** (約 2-3 分)

- [ ] **Step 2: ユーザーに確認依頼**

確認項目:
- **A**: ハードリロード (Ctrl+Shift+R) 後にアイコンが「すでに置かれている」 状態か (= 飛びなし、 アニメなし)
- **B**: 別のページ (LP 等) から miti に戻ったときも同様に飛びなし
- **C**: プラン切替で従来通り正常動作 (= 飛びなし、 既存挙動維持)
- **D**: ブラウザタブ切替で従来通り正常動作

すべて OK ならクローズ。 NG があれば原因を再調査。

- [ ] **Step 3 (OK の場合): TODO.md 更新**

`docs/TODO.md` の「次セッション最優先」 セクションから「1. 左から飛んでくる」 を削除し、 [TODO_COMPLETED.md](../TODO_COMPLETED.md) に追記。

---

## 検証チェックリスト (Task 1 完了時)

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` 636/636 PASS
- [ ] `npm run build` ✓
- [ ] commit message が conventional commits 形式
- [ ] push 完了 + Vercel デプロイ確認

---

## 想定されない事態への対応

| 事態 | 原因可能性 | 対応 |
|---|---|---|
| vitest が FAIL | 編集ミス (import 文 typo 等) | diff 確認 → 修正 |
| ハードリロード後もまだ飛ぶ | 別の真因の可能性 (layout 計測対象の DOM がまだ存在しないタイミングがある等) | dev server で React DevTools の Profiler を使い、 render timing を確認 |
| プラン切替で従来と挙動が変わる | useLayoutEffect の依存配列の影響 | `[entries]` の比較ロジックは変更していないので、 ここで挙動変化は起きないはず |

---

## Plan Self-Review 結果

- ✅ **Spec coverage**: 設計書の全要求 (1 行変更、 既存テスト維持、 検証方法) を Task 1 でカバー
- ✅ **Placeholder scan**: TBD / TODO なし、 全 step が具体的
- ✅ **Type consistency**: `useLayoutEffect` の API は `useEffect` と完全同一 (型シグネチャ含む)
- ✅ **Scope**: 1 ファイル / 1 行変更、 単一 task に収まる

問題なし。
