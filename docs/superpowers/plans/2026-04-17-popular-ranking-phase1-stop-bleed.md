# 野良主流ランキング Phase 1: viewCount自己強化ループ止血 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボトムシート/人気ページのプレビュー取得で viewCount が増える自己強化ループを断つ。

**Architecture:** `/api/share` GET に `preview=true` クエリパラメータを追加し、true の時のみ viewCount インクリメントをスキップ。フロント側のプレビュー取得コードにフラグを付与。共有リンク直接アクセス（SharePage）は従来通りカウント継続。

**Tech Stack:** Vercel Serverless Functions (TypeScript) + React + Vitest

**設計書:** `docs/superpowers/specs/2026-04-17-popular-ranking-redesign-design.md` の Phase 1 セクション

---

## ファイル構造

| ファイル | 変更内容 |
|---------|---------|
| `api/share/index.ts` | GETハンドラで `req.query.preview === 'true'` なら viewCount 更新ロジックをスキップ |
| `src/components/MitigationSheet.tsx` | プレビュー取得の fetch URL に `&preview=true` を付加 |
| `src/components/PopularPage.tsx` | 同上 |

---

## Task 1: API側で preview フラグ対応を追加

**Files:**
- Modify: `api/share/index.ts` (GET ハンドラ内の viewCount 更新ロジック、現行213-228行目付近)

- [ ] **Step 1: 現在のコードを確認**

Run: Read `api/share/index.ts` の 200〜230行目

期待: 以下のような構造を確認
```ts
} else if (req.method === 'GET') {
    const { id } = req.query;
    ...
    // 閲覧数を+1（IPベースの簡易重複排除、fire-and-forget）
    const fwd = req.headers['x-forwarded-for'];
    const fwdStr = Array.isArray(fwd) ? fwd[0] : (fwd || '');
    const viewerIp = (fwdStr || req.socket?.remoteAddress || '').split(',')[0].trim();
    if (viewerIp) {
        ...
        batch.update(docRef, { viewCount: FieldValue.increment(1) });
        ...
    }
```

- [ ] **Step 2: viewCount 更新ブロックを preview フラグで囲む**

`api/share/index.ts` 内、GETハンドラの viewCount 更新ロジックの最外周に preview 判定を追加。

変更箇所（`if (viewerIp) {` の直前）:

```ts
            // 閲覧数を+1（IPベースの簡易重複排除、fire-and-forget）
            // ただし preview=true のクエリ時はスキップ（ボトムシート/人気ページのプレビュー取得で自己強化ループを起こさないため）
            const isPreview = req.query.preview === 'true';
            const fwd = req.headers['x-forwarded-for'];
            const fwdStr = Array.isArray(fwd) ? fwd[0] : (fwd || '');
            const viewerIp = (fwdStr || req.socket?.remoteAddress || '').split(',')[0].trim();
            if (!isPreview && viewerIp) {
                // 既存の viewers サブコレクション判定 + viewCount increment ロジック（変更なし）
                const ipHash = createHash('sha256').update(viewerIp + id).digest('hex').slice(0, 16);
                const viewRef = db.collection(COLLECTION).doc(id as string).collection('viewers').doc(ipHash);
                viewRef.get().then((s: any) => {
                    if (!s.exists) {
                        const batch = db.batch();
                        batch.set(viewRef, { at: Date.now() });
                        batch.update(docRef, { viewCount: FieldValue.increment(1) });
                        batch.commit().catch(() => {});
                    }
                }).catch(() => {});
            }
```

ポイント: 既存の `if (viewerIp)` を `if (!isPreview && viewerIp)` に変更するだけで、内側ロジックはそのまま。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`

Expected: エラーなく通る（警告は既存のchunk size警告のみ）

- [ ] **Step 4: コミット**

```bash
rtk git add api/share/index.ts
rtk git commit -m "feat: /api/share GET に preview=true フラグを追加（viewCountスキップ）"
```

---

## Task 2: MitigationSheet のプレビュー取得に preview フラグ付与

**Files:**
- Modify: `src/components/MitigationSheet.tsx` (プレビュー取得 useEffect の apiFetch 呼び出し、現行114〜124行目付近)

- [ ] **Step 1: 現在のコードを Read で確認**

`MitigationSheet.tsx` 110〜130行目付近、以下のコードを探す：

```tsx
    setPreviewLoading(true);
    apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
```

- [ ] **Step 2: URL に `&preview=true` を追加**

該当行を以下に書き換え：

```tsx
    setPreviewLoading(true);
    apiFetch(`/api/share?id=${encodeURIComponent(entry.shareId)}&preview=true`)
      .then(res => res.ok ? res.json() : Promise.reject())
```

注意: `copyPlan` 内の `apiFetch(/api/share?id=...)` は **変更しない**。これはコピー実行時のデータ取得で、コピーという能動操作なのでviewCount計上されて良い（設計通り）。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "feat: ボトムシートのプレビュー取得に preview=true フラグ付与"
```

---

## Task 3: PopularPage のプレビュー取得に preview フラグ付与

**Files:**
- Modify: `src/components/PopularPage.tsx`

- [ ] **Step 1: Grep で `/api/share` を探して位置特定**

Run: `Grep -n "/api/share" src/components/PopularPage.tsx`

PopularPage には複数の `/api/share` 呼び出しがある。**コピー実行時の呼び出し（copyPlan系）には付けず、プレビュー表示系にのみ付ける**。

- [ ] **Step 2: 該当箇所を特定して Read**

PopularPage.tsx 内でプレビュー表示のための fetch（ユーザーが意図的にコピーしていない、単に表示のための取得）を1つ特定する。現状のコード構造で、プランを「見るだけ」の呼び出しパスがあればそこに `&preview=true` を付ける。

**判定ルール**:
- コピー実行動線（`handleCopy` 等） → 変更しない（カウントされるべき）
- 単なる表示/プレビュー動線 → `&preview=true` 付与

- [ ] **Step 3: 書き換え**

特定した URL リテラルに `&preview=true` を追加。例:

```tsx
// 変更前
apiFetch(`/api/share?id=${encodeURIComponent(shareId)}`)

// 変更後
apiFetch(`/api/share?id=${encodeURIComponent(shareId)}&preview=true`)
```

- [ ] **Step 4: 対象呼び出しが無ければスキップ**

PopularPage にプレビュー表示用の `/api/share` GET が無い（全てコピー実行時のみ）場合、このタスクは空のコミットを避け次タスクへ進む。この場合、コミットメッセージは以下のノート付きで空コミットを打たない:

```bash
# 対象なしの場合、何もコミットせず Task 4 へ
```

- [ ] **Step 5: ビルド確認（変更があった場合）**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 6: コミット（変更があった場合）**

```bash
rtk git add src/components/PopularPage.tsx
rtk git commit -m "feat: PopularPageプレビュー取得に preview=true フラグ付与"
```

---

## Task 4: 手動動作検証（dev環境）

**前提**: Task 1-3 が完了している。

- [ ] **Step 1: dev server 起動**

Run: `rtk npm run dev`
Expected: Vite が起動し `http://localhost:5173` でアクセス可能

- [ ] **Step 2: Firebase Console で対象プランの viewCount を記録**

適当な `shared_plans` ドキュメント1件（例: ボトムシートに出てくる M9S の top plan）の `viewCount` 現在値をメモ。

- [ ] **Step 3: ボトムシートを開く**

ブラウザで野良主流ボタン押下 → M9S のプレビューが表示される

- [ ] **Step 4: Firebase Console で viewCount 確認**

該当プランの `viewCount` が **変化していない** こと。

Expected: Task 2 適用前なら viewCount +1、Task 2 適用後は変化なし。

- [ ] **Step 5: 共有リンク直接アクセスを検証**

`http://localhost:5173/share/<shareId>` を直接開く → viewCount が +1 される（変更なしのSharePageパス）

Expected: 従来通り viewCount +1

- [ ] **Step 6: preview=true のバックエンド単独テスト**

Run:
```bash
curl "http://localhost:3000/api/share?id=<shareId>&preview=true"
```
（Vercel devで動かしている場合のポート、適宜調整）

Expected: 正常レスポンス、Firebase Console の viewCount 変化なし

---

## Task 5: テストと push

- [ ] **Step 1: vitest 実行**

Run: `rtk npm test`
Expected: 148/148 pass（既存テスト全てパス）

- [ ] **Step 2: ビルド最終確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 3: TODO.md 更新**

`docs/TODO.md` の「今セッションの完了事項」に以下を追加:
```
- ✅ 野良主流ランキング Phase 1: viewCount 自己強化ループ止血
```

- [ ] **Step 4: TODO.md コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs: Phase 1 止血完了 TODO更新"
```

- [ ] **Step 5: push**

```bash
rtk git push
```

Vercel で自動デプロイ → 本番でボトムシート開いて viewCount の増加が止まっていることを確認。

---

## 受け入れ基準（設計書 Phase 1 と同義）

- [ ] ボトムシートを開いてプレビュー表示しても、対象プランの `viewCount` が増えない
- [ ] `/share/<id>` URLを直接開いた時は従来通り `viewCount` が増える
- [ ] `/api/share?id=xxx` （preview無し）の旧呼び出しは従来通り動く（後方互換）
- [ ] 既存テスト 148/148 pass
- [ ] ビルド成功

---

## リスクと緩和

| リスク | 緩和策 |
|-------|-------|
| preview フラグ付与漏れ | Task 2-3 で 3ファイルを明示的に指定、該当行確認後のみ変更 |
| SharePage 誤って preview 化 | SharePage は **変更しない** と明記、Task 3 で PopularPage のみ判断 |
| 既存の IP重複排除ロジック破壊 | `if` 条件の追加のみで内部ロジック不変、grep で既存の `viewRef.get` 周辺コード変化なし確認 |

---

## 所要時間見積

- Task 1: 15分
- Task 2: 10分
- Task 3: 15分（PopularPage のコード調査込み）
- Task 4: 20分（Firebase Console確認含む）
- Task 5: 10分

**合計**: 約1時間〜1.5時間
