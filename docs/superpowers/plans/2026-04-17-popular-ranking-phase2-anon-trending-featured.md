# 野良主流ランキング Phase 2: 匿名ID + 旬ランキング + featured活性化 + ポリシー更新 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 未ログインユーザーのコピーを匿名IDで集計母数に含め、ランキング軸を viewCount 順から「直近7日 copyCount 順」に変更し、featured を優先表示する。プライバシーポリシーを事実に合わせて更新する。

**Architecture:** (1) localStorage UUID を匿名集計IDとしてクライアント生成・保存・送信、(2) Firestore 共有プランドキュメントに `copyCountByDay` Map フィールドを追加し日別バケットで集計、(3) `/api/popular` GET は対象コンテンツの全プランを取得してメモリ上で直近7日スコアでソート、(4) MitigationSheet は featured があればそれを優先表示（見た目上の識別子なし）、(5) プライバシーポリシー Section 1/3/5/6 を4言語で更新。

**Tech Stack:** Vercel Serverless Functions (TypeScript) + React + Firebase Admin SDK + Vitest

**設計書:** `docs/superpowers/specs/2026-04-17-popular-ranking-redesign-design.md` の Phase 2 セクション

**前提:** Phase 1 (preview flag) が先に本番にデプロイされていること。

---

## ファイル構造

| ファイル | 種別 | 責任 |
|---------|------|------|
| `src/lib/anonCopyId.ts` | **新規** | localStorage ベースの匿名集計ID取得/生成ユーティリティ |
| `src/__tests__/anonCopyId.test.ts` | **新規** | 匿名IDユーティリティのユニットテスト |
| `api/popular/index.ts` | 修正 | POST: anonId パス追加 + copyCountByDay 更新、GET: ランキング計算を7日スコアに変更 |
| `src/components/MitigationSheet.tsx` | 修正 | fetch body に anonId 追加、featured 優先表示 |
| `src/components/PopularPage.tsx` | 修正 | fetch body に anonId 追加 |
| `src/components/SharePage.tsx` | 修正 | fetch body に anonId 追加 |
| `src/locales/ja.json` | 修正 | プライバシーポリシー 8キー更新 |
| `src/locales/en.json` | 修正 | 同上（英訳） |
| `src/locales/zh.json` | 修正 | 同上（中訳） |
| `src/locales/ko.json` | 修正 | 同上（韓訳） |

---

## Task 1: anonCopyId ユーティリティ作成 + テスト

**Files:**
- Create: `src/lib/anonCopyId.ts`
- Create: `src/__tests__/anonCopyId.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

Create `src/__tests__/anonCopyId.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAnonCopyId } from '../lib/anonCopyId';

describe('getAnonCopyId', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('初回呼び出しで UUID v4 形式のIDを生成し localStorage に保存する', () => {
    const id = getAnonCopyId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(localStorage.getItem('lopo_anon_copy_id')).toBe(id);
  });

  it('2回目以降の呼び出しで同じIDを返す', () => {
    const id1 = getAnonCopyId();
    const id2 = getAnonCopyId();
    expect(id1).toBe(id2);
  });

  it('localStorage が使えない環境では null を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled');
    });
    expect(getAnonCopyId()).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗することを確認**

Run: `rtk npx vitest run src/__tests__/anonCopyId.test.ts`

Expected: FAIL — `getAnonCopyId` がまだ存在しないため import エラー

- [ ] **Step 3: 実装を書く**

Create `src/lib/anonCopyId.ts`:

```ts
/**
 * 匿名コピー集計ID（localStorage保存）
 * 未ログインユーザーのコピー重複排除にのみ使用。
 * サーバはこのIDから個人を特定する手段を持たない。
 * ブラウザのデータクリアでリセットされる。
 */
const STORAGE_KEY = 'lopo_anon_copy_id';

export function getAnonCopyId(): string | null {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage 無効環境（プライベートブラウジング等）
    return null;
  }
}
```

- [ ] **Step 4: テスト再実行して pass 確認**

Run: `rtk npx vitest run src/__tests__/anonCopyId.test.ts`

Expected: PASS (3 tests)

- [ ] **Step 5: 全テストが壊れていないか確認**

Run: `rtk npm test`
Expected: 151/151 pass (既存148 + 新規3)

- [ ] **Step 6: コミット**

```bash
rtk git add src/lib/anonCopyId.ts src/__tests__/anonCopyId.test.ts
rtk git commit -m "feat: 匿名コピー集計IDユーティリティ（localStorage UUID）"
```

---

## Task 2: API POST - anonId パス追加

**Files:**
- Modify: `api/popular/index.ts` (POST ハンドラ、現行181-232行目付近)

- [ ] **Step 1: 該当コードを Read で確認**

`api/popular/index.ts` の `req.method === 'POST'` 分岐内、UID検証と copyCount 加算のロジック。

- [ ] **Step 2: ヘルパー関数を先頭付近に追加**

`api/popular/index.ts` のファイル先頭（import文の直後、`const COLLECTION = 'shared_plans';` の後あたり）に追加:

```ts
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 今日の日付キー "YYYYMMDD" (UTC基準) */
function todayKey(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/** today から n 日前の日付キー */
function dayKeyDaysBefore(n: number): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
}
```

- [ ] **Step 3: POST ハンドラで anonId 経路を追加**

POST 処理内、既存の UID 取得ロジックの後（body から shareId を取る部分の後）に、anonId を取得し、UID が無い場合の処理を追加。現行:

```ts
            // uidがある場合: 重複チェック...
            let alreadyCounted = false;
            if (uid) {
                const copiedByRef = db.doc(`${COLLECTION}/${shareId}/copiedBy/${uid}`);
                const existing = await copiedByRef.get();
                if (existing.exists) {
                    alreadyCounted = true;
                } else {
                    const batch = db.batch();
                    batch.set(copiedByRef, { copiedAt: FieldValue.serverTimestamp() });
                    batch.update(docRef, { copyCount: FieldValue.increment(1) });
                    await batch.commit();
                }
            } else {
                // uid未提供（未ログイン）: カウントしない
                alreadyCounted = true;
            }
```

を以下に書き換え（UIDありは変更なし、UIDなしで anonId が妥当な場合のパスを追加）:

```ts
            // uidがある場合: UIDで重複排除
            // uidが無くanonIdが妥当な場合: 匿名IDで重複排除
            // どちらも無い場合: カウントしない
            const { anonId } = req.body;
            let alreadyCounted = false;
            if (uid) {
                const copiedByRef = db.doc(`${COLLECTION}/${shareId}/copiedBy/${uid}`);
                const existing = await copiedByRef.get();
                if (existing.exists) {
                    alreadyCounted = true;
                } else {
                    const batch = db.batch();
                    batch.set(copiedByRef, { copiedAt: FieldValue.serverTimestamp() });
                    batch.update(docRef, { copyCount: FieldValue.increment(1) });
                    await batch.commit();
                }
            } else if (typeof anonId === 'string' && UUID_V4_REGEX.test(anonId)) {
                const anonCopiedByRef = db.doc(`${COLLECTION}/${shareId}/anonCopiedBy/${anonId}`);
                const existing = await anonCopiedByRef.get();
                if (existing.exists) {
                    alreadyCounted = true;
                } else {
                    const batch = db.batch();
                    batch.set(anonCopiedByRef, { copiedAt: FieldValue.serverTimestamp() });
                    batch.update(docRef, { copyCount: FieldValue.increment(1) });
                    await batch.commit();
                }
            } else {
                // UIDも anonId も無い/不正 → カウントしない
                alreadyCounted = true;
            }
```

**注意**: このタスクではまだ `copyCountByDay` は触らない（Task 3で追加）。まず匿名ID経路の基礎だけ作る。

- [ ] **Step 4: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 5: コミット**

```bash
rtk git add api/popular/index.ts
rtk git commit -m "feat: /api/popular POST に匿名ID経路を追加（UUID v4検証つき）"
```

---

## Task 3: API POST - copyCountByDay バケット更新

**Files:**
- Modify: `api/popular/index.ts` (POST ハンドラ、Task 2 で書き換えた箇所)

- [ ] **Step 1: 既存のコードを Read で確認（Task 2 適用済み想定）**

Task 2 で追加した UID/anonId 両方のパスで `batch.update(docRef, { copyCount: FieldValue.increment(1) })` を呼んでいる箇所2箇所。

- [ ] **Step 2: 両方の `batch.update` を `copyCountByDay` 更新込みに変更**

両方のパス（UIDパス、anonIdパス）で共通して、`batch.update(docRef, ...)` の引数を以下のように変更：

**UIDパス** (Task 2 書き換え後のコード抜粋):
```ts
                    const batch = db.batch();
                    batch.set(copiedByRef, { copiedAt: FieldValue.serverTimestamp() });
                    batch.update(docRef, { copyCount: FieldValue.increment(1) });
                    await batch.commit();
```

↓ 変更後:
```ts
                    const batch = db.batch();
                    batch.set(copiedByRef, { copiedAt: FieldValue.serverTimestamp() });
                    // copyCount 全期間 + 今日のバケット を同時更新
                    const today = todayKey();
                    const updates: Record<string, any> = {
                        copyCount: FieldValue.increment(1),
                        [`copyCountByDay.${today}`]: FieldValue.increment(1),
                    };
                    // 古いバケット（7日以上前）を間引く
                    const byDay: Record<string, number> = snap.data()?.copyCountByDay ?? {};
                    const pruneCutoff = dayKeyDaysBefore(7);
                    for (const key of Object.keys(byDay)) {
                        if (key < pruneCutoff) {
                            updates[`copyCountByDay.${key}`] = FieldValue.delete();
                        }
                    }
                    batch.update(docRef, updates);
                    await batch.commit();
```

**anonIdパス** も同じ内容に揃える（`copiedByRef` → `anonCopiedByRef` の違いのみ）。

**重要**: `snap` はこのブロックで既に `await docRef.get()` されている前提。Task 2 のコードでは snap 取得位置を確認し、もし POST ハンドラの冒頭（shareId 検証直後）で `await docRef.get()` されているなら問題なし。そうでなければ追加で取得。

- [ ] **Step 3: snap 取得タイミング確認**

Read で `api/popular/index.ts` POST 内を確認:

```ts
const docRef = db.collection(COLLECTION).doc(shareId as string);
const snap = await docRef.get();
if (!snap.exists) {
    return res.status(404).json({ error: 'not found' });
}
```

このブロックが UID/anonId 分岐より前にあることを確認。**あれば** Step 2 のコードがそのまま動く。なければ snap 取得を分岐内に移動する必要がある。

- [ ] **Step 4: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 5: コミット**

```bash
rtk git add api/popular/index.ts
rtk git commit -m "feat: copyCountByDay 日別バケット更新 + 古いキー間引き"
```

---

## Task 4: API GET - ランキングを7日スコアで並べ替え

**Files:**
- Modify: `api/popular/index.ts` (GET ハンドラ、現行142-179行目付近)

- [ ] **Step 1: 現行の GET ハンドラを Read で確認**

```ts
            const results = await Promise.all(
                ids.map(async (id) => {
                    // featured プランを取得
                    const featuredSnap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .where('featured', '==', true)
                        .limit(1)
                        .get();

                    // viewCount降順で上位3件を取得
                    const popularSnap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .orderBy('viewCount', 'desc')
                        .limit(3)
                        .get();

                    const plans: any[] = [];
                    for (const doc of popularSnap.docs) {
                        if (plans.length < 2) {
                            plans.push(mapDoc(doc));
                        }
                    }
                    const featured = featuredSnap.docs.length > 0
                        ? mapDoc(featuredSnap.docs[0])
                        : null;
                    return { contentId: id, plans, featured };
                })
            );
```

- [ ] **Step 2: viewCount orderBy を廃止し、全プラン取得 + メモリソートに変更**

上記ブロックを以下に書き換え：

```ts
            const windowStart = dayKeyDaysBefore(6);  // 今日を含めて7日間
            const results = await Promise.all(
                ids.map(async (id) => {
                    // featured プランを取得（変更なし）
                    const featuredSnap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .where('featured', '==', true)
                        .limit(1)
                        .get();

                    // 全プラン取得（orderBy なし、メモリ上で直近7日スコアでソート）
                    const allSnap = await db
                        .collection(COLLECTION)
                        .where('contentId', '==', id)
                        .get();

                    const scored = allSnap.docs.map(doc => {
                        const data = doc.data();
                        const byDay: Record<string, number> = data.copyCountByDay || {};
                        let score7d = 0;
                        for (const [key, n] of Object.entries(byDay)) {
                            if (key >= windowStart) score7d += n;
                        }
                        return { doc, score7d, copyCount: data.copyCount ?? 0 };
                    });

                    // スコア降順、tie-break は生涯copyCount降順
                    scored.sort((a, b) =>
                        b.score7d - a.score7d || b.copyCount - a.copyCount
                    );

                    const plans = scored.slice(0, 2).map(s => mapDoc(s.doc));

                    const featured = featuredSnap.docs.length > 0
                        ? mapDoc(featuredSnap.docs[0])
                        : null;
                    return { contentId: id, plans, featured };
                })
            );
```

**注意**: Firestore インデックスに `contentId` 単独フィールドのインデックスが必要（`viewCount` orderBy をやめたので）。単一フィールドのインデックスは Firestore が自動生成するので追加設定不要。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 4: コミット**

```bash
rtk git add api/popular/index.ts
rtk git commit -m "feat: /api/popular GET を直近7日 copyCount スコア順に変更"
```

---

## Task 5: MitigationSheet の fetch に anonId を追加

**Files:**
- Modify: `src/components/MitigationSheet.tsx` (215行目付近の apiFetch POST 呼び出し)

- [ ] **Step 1: anonCopyId を import**

ファイル先頭の import 群に追加:

```tsx
import { getAnonCopyId } from '../lib/anonCopyId';
```

- [ ] **Step 2: POST body に anonId を追加**

該当コード（`copyPlan` 関数内）:

```tsx
        apiFetch('/api/popular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareId: entry.shareId }),
        }).catch(() => {});
```

↓ 変更後:

```tsx
        apiFetch('/api/popular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shareId: entry.shareId,
            anonId: getAnonCopyId(),
          }),
        }).catch(() => {});
```

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "feat: ボトムシートのコピーAPIに anonId を送信"
```

---

## Task 6: PopularPage の fetch に anonId を追加

**Files:**
- Modify: `src/components/PopularPage.tsx`

- [ ] **Step 1: anonCopyId を import**

```tsx
import { getAnonCopyId } from '../lib/anonCopyId';
```

- [ ] **Step 2: `/api/popular` POST 呼び出し全てに anonId を追加**

Grep で位置特定:
Run: `Grep -n "/api/popular" src/components/PopularPage.tsx`

各箇所（165行目付近、220行目付近など）の POST body を Task 5 と同様に anonId 追加。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/PopularPage.tsx
rtk git commit -m "feat: PopularPageのコピーAPIに anonId を送信"
```

---

## Task 7: SharePage の fetch に anonId を追加

**Files:**
- Modify: `src/components/SharePage.tsx`

- [ ] **Step 1: anonCopyId を import**

```tsx
import { getAnonCopyId } from '../lib/anonCopyId';
```

- [ ] **Step 2: `/api/popular` POST 呼び出し全てに anonId を追加**

Grep で位置特定（165, 201行目付近）。各箇所の POST body を Task 5 と同様に書き換え。

- [ ] **Step 3: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 4: コミット**

```bash
rtk git add src/components/SharePage.tsx
rtk git commit -m "feat: SharePageのコピーAPIに anonId を送信"
```

---

## Task 8: MitigationSheet で featured を優先表示

**Files:**
- Modify: `src/components/MitigationSheet.tsx`

- [ ] **Step 1: 現状のプレビュー対象エントリ取得コードを確認**

Grep で探す:
Run: `Grep -n "plans\?\.\[0\]" src/components/MitigationSheet.tsx`

該当箇所は複数ある（プレビュー取得 useEffect、handleCopyThis など）。

- [ ] **Step 2: featured 優先のヘルパを関数コンポーネント内に追加**

コンポーネント内（`const contentIds = ...` の直後あたり）に追加:

```tsx
  // featured があればそれを優先、なければ自動ランキング1位を返す
  const getRepresentativeEntry = (contentId: string): PopularEntry | null => {
    const d = popularData[contentId];
    if (!d) return null;
    return d.featured ?? d.plans?.[0] ?? null;
  };
```

- [ ] **Step 3: 既存の `plans[0]` 参照を置き換え**

以下の箇所を `getRepresentativeEntry(contentId)` に置き換え（または変数で受けて利用）:

- **プレビュー取得 useEffect** (現行108-125行目付近): `popularData[selectedId]?.plans?.[0]` → `getRepresentativeEntry(selectedId)`
- **handleCopyThis** (現行258-263行目付近): `popularData[selectedId]?.plans?.[0]` → `getRepresentativeEntry(selectedId)`
- **handleCopyAll** (現行267-272行目付近): `popularData[id]?.plans?.[0]` → `getRepresentativeEntry(id)`
- **handleCopyChecked** (現行277-281行目付近): 同上
- **カードレンダリング** (現行424行目付近): `popularData[contentId]?.plans?.[0]` → `getRepresentativeEntry(contentId)`（カード表示もfeatured優先、ただし見た目上の区別なし）

各箇所で `const entry = popularData[...]?.plans?.[0]` を `const entry = getRepresentativeEntry(...)` に書き換える。

- [ ] **Step 4: ビルド確認**

Run: `rtk npm run build`
Expected: OK

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "feat: ボトムシートで featured を内部優先表示（UIバッジ無し）"
```

---

## Task 9: プライバシーポリシー ja.json 更新

**Files:**
- Modify: `src/locales/ja.json` (8キーの更新)

- [ ] **Step 1: privacy_last_updated を更新**

```json
"privacy_last_updated": "最終更新日: 2026年4月17日"
```

元の日付を新しい日付（実装日）に書き換え。Grep で `privacy_last_updated` を探して更新。

- [ ] **Step 2: privacy_section1_auto_items に1項目追加**

現在:
```json
"privacy_section1_auto_items": "共有プランが何人に見られたかを正しく数えるため、閲覧時のIPアドレスを元に戻せない形に変換して記録します（元のIPアドレスを復元することはできません）,不正アクセスを防ぐため、IPアドレスを一時的に記録します（最大1分で自動的に消えます）"
```

↓ 変更後:
```json
"privacy_section1_auto_items": "共有プランが何人に見られたかを正しく数えるため、閲覧時のIPアドレスを元に戻せない形に変換して記録します（元のIPアドレスを復元することはできません）,不正アクセスを防ぐため、IPアドレスを一時的に記録します（最大1分で自動的に消えます）,人気プランの集計を正しく行うため、あなたのブラウザで生成されたランダムな匿名ID（個人を特定しない文字列）を受け取ります"
```

- [ ] **Step 3: privacy_section3_items に1項目追加**

現在:
```json
"privacy_section3_items": "ログインとアカウントの管理,軽減プランの保存・端末間の同期・他の人との共有,不正アクセスや悪用の防止,サービスの利用状況の把握と改善"
```

↓ 変更後:
```json
"privacy_section3_items": "ログインとアカウントの管理,軽減プランの保存・端末間の同期・他の人との共有,人気プランの集計（どのプランがよく参考にされているかの把握）,不正アクセスや悪用の防止,サービスの利用状況の把握と改善"
```

- [ ] **Step 4: privacy_section5_storage_items に1項目追加**

現在:
```json
"privacy_section5_storage_items": "プランデータのキャッシュ（素早く表示するためのコピー）,テーマ設定（ダークモード/ライトモードの選択）,ログイン状態の一時的な保持"
```

↓ 変更後:
```json
"privacy_section5_storage_items": "プランデータのキャッシュ（素早く表示するためのコピー）,テーマ設定（ダークモード/ライトモードの選択）,ログイン状態の一時的な保持,人気プランの集計用の匿名ID（ランダムな文字列）"
```

- [ ] **Step 5: privacy_section5_storage_note を修正**

現在:
```json
"privacy_section5_storage_note": "これらのデータはお使いのブラウザの中だけに保存されます。サーバーに自動送信されることはありません。"
```

↓ 変更後:
```json
"privacy_section5_storage_note": "これらのデータは基本的にお使いのブラウザの中だけに保存されます。ただし「人気プランの集計用の匿名ID」だけは、あなたが共有プランをコピーする際にサーバーへ送信されます（個人を特定しない文字列であり、集計の二重カウントを防ぐためだけに使われます）。"
```

- [ ] **Step 6: privacy_section6_data_types に2項目を適切な位置に追加**

現在:
```json
"privacy_section6_data_types": "アカウント情報・軽減プラン,チームロゴ画像,共有プラン,閲覧者の記録（元に戻せない形に変換済み）,アクセス頻度の記録,ログイン用Cookie,ブラウザ内のキャッシュ"
```

↓ 変更後（「閲覧者の記録」の後に匿名IDを、その後に匿名コピー記録を挿入）:
```json
"privacy_section6_data_types": "アカウント情報・軽減プラン,チームロゴ画像,共有プラン,閲覧者の記録（元に戻せない形に変換済み）,匿名コピー集計ID（ランダムな文字列）,匿名コピー記録・日別コピー集計,アクセス頻度の記録,ログイン用Cookie,ブラウザ内のキャッシュ"
```

- [ ] **Step 7: privacy_section6_data_locations に対応2項目追加**

現在:
```json
"privacy_section6_data_locations": "Google Firebase（東京）,Google Firebase Storage（米国）,Google Firebase（東京）,Google Firebase（東京）,Upstash（米国東部）,お使いのブラウザ,お使いのブラウザ"
```

↓ 変更後（data_typesに対応する位置に2項目追加）:
```json
"privacy_section6_data_locations": "Google Firebase（東京）,Google Firebase Storage（米国）,Google Firebase（東京）,Google Firebase（東京）,お使いのブラウザ,Google Firebase（東京）,Upstash（米国東部）,お使いのブラウザ,お使いのブラウザ"
```

- [ ] **Step 8: privacy_section6_data_periods に対応2項目追加**

現在:
```json
"privacy_section6_data_periods": "アカウントを削除するまで,自分で削除するまで,基本的に無期限,無期限（元のIPアドレスに戻すことはできません）,最大1分で自動削除,最大5分で自動削除,自分で削除するまで"
```

↓ 変更後:
```json
"privacy_section6_data_periods": "アカウントを削除するまで,自分で削除するまで,基本的に無期限,無期限（元のIPアドレスに戻すことはできません）,自分でブラウザから削除するまで,日別集計は8日以上前のものを自動削除,最大1分で自動削除,最大5分で自動削除,自分で削除するまで"
```

- [ ] **Step 9: privacy_section6_note を修正**

現在:
```json
"privacy_section6_note": "ログインしていない場合、データはブラウザの中だけに保存され、サーバーには送信されません。"
```

↓ 変更後:
```json
"privacy_section6_note": "ログインしていない場合、本サービスに軽減プランが保存されることはありません。ただし、あなたが共有プランをコピーしたときに限り、集計の二重カウントを防ぐための匿名ID（個人を特定しない文字列）がサーバーへ送信されます。"
```

- [ ] **Step 10: JSON妥当性確認**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/ja.json','utf8'))"
```
Expected: エラーなし

- [ ] **Step 11: コミット**

```bash
rtk git add src/locales/ja.json
rtk git commit -m "docs(privacy): 日本語ポリシー — 匿名ID集計の追記（Section 1/3/5/6）"
```

---

## Task 10: プライバシーポリシー en.json 更新

**Files:**
- Modify: `src/locales/en.json` (同じ8キーを英訳で更新)

- [ ] **Step 1: Task 9 と同じ8キーを en.json で特定**

Grep で `privacy_section1_auto_items` や `privacy_section3_items` 等を検索して位置確認。

- [ ] **Step 2: 各キーを英訳版で更新**

各キーの英訳テンプレ（既存の英訳トーンに合わせる）:

`privacy_last_updated`: `Last updated: April 17, 2026`

`privacy_section1_auto_items` に追加項目: `To accurately count popular plans, we receive a random anonymous ID (a string that does not identify you personally) generated in your browser`

`privacy_section3_items` に追加項目: `Counting popular plans (understanding which plans are most referenced)`

`privacy_section5_storage_items` に追加項目: `A random anonymous ID used for popular-plan counting`

`privacy_section5_storage_note` 全文差し替え: `These data are primarily stored only within your browser. However, the "anonymous ID for popular-plan counting" is sent to our server when you copy a shared plan (it is a non-identifying string used only to prevent double-counting).`

`privacy_section6_data_types` に追加2項目: `Anonymous copy-counting ID (random string)` と `Anonymous copy records and daily copy aggregation`

`privacy_section6_data_locations` 対応2項目: `Your browser` と `Google Firebase (Tokyo)`

`privacy_section6_data_periods` 対応2項目: `Until you clear your browser data` と `Daily aggregation entries older than 8 days are auto-deleted`

`privacy_section6_note` 全文差し替え: `If you are not logged in, no mitigation plan is stored on our service. However, only when you copy a shared plan, an anonymous ID (a non-identifying string) is sent to our server to prevent double-counting in the aggregation.`

- [ ] **Step 3: JSON妥当性確認**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/en.json','utf8'))"
```

- [ ] **Step 4: コミット**

```bash
rtk git add src/locales/en.json
rtk git commit -m "docs(privacy): English policy — anonymous ID counting additions"
```

---

## Task 11: プライバシーポリシー zh.json 更新

**Files:**
- Modify: `src/locales/zh.json`

Task 10と同じ構造で中訳テンプレ:

`privacy_last_updated`: `最后更新日期：2026年4月17日`

`privacy_section1_auto_items` 追加: `为了准确统计人气计划，我们会接收您浏览器生成的随机匿名ID（不能识别个人的字符串）`

`privacy_section3_items` 追加: `统计人气计划（了解哪些计划被频繁参考）`

`privacy_section5_storage_items` 追加: `用于人气计划统计的匿名ID（随机字符串）`

`privacy_section5_storage_note` 差し替え: `这些数据基本上只保存在您的浏览器中。但是「用于人气计划统计的匿名ID」会在您复制共享计划时发送到服务器（这是一个不能识别个人的字符串，仅用于防止统计重复计数）。`

`privacy_section6_data_types` 追加2項目: `匿名复制统计ID（随机字符串）` と `匿名复制记录与每日复制汇总`

`privacy_section6_data_locations` 対応2項目: `您的浏览器` と `Google Firebase（东京）`

`privacy_section6_data_periods` 対応2項目: `直到您从浏览器中删除` と `每日汇总数据8天以上自动删除`

`privacy_section6_note` 差し替え: `未登录时，本服务不会保存您的减伤计划。但是，仅当您复制共享计划时，为了防止统计的重复计数，会向服务器发送匿名ID（不能识别个人的字符串）。`

- [ ] **Step 1: 上記9箇所の中訳値で zh.json を更新**

`src/locales/zh.json` の該当8キー (`privacy_last_updated`, `privacy_section1_auto_items`, `privacy_section3_items`, `privacy_section5_storage_items`, `privacy_section5_storage_note`, `privacy_section6_data_types`, `privacy_section6_data_locations`, `privacy_section6_data_periods`, `privacy_section6_note`) を上記テンプレの値に書き換え。

- [ ] **Step 2: JSON妥当性確認**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/zh.json','utf8'))"
```
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/locales/zh.json
rtk git commit -m "docs(privacy): 中文策略 — 匿名ID统计的追加"
```

---

## Task 12: プライバシーポリシー ko.json 更新

**Files:**
- Modify: `src/locales/ko.json`

Task 10と同じ構造で韓訳テンプレ:

`privacy_last_updated`: `최종 업데이트: 2026년 4월 17일`

`privacy_section1_auto_items` 追加: `인기 플랜을 정확하게 집계하기 위해, 브라우저에서 생성된 무작위 익명 ID(개인을 식별할 수 없는 문자열)를 수신합니다`

`privacy_section3_items` 追加: `인기 플랜의 집계(어떤 플랜이 자주 참조되는지 파악)`

`privacy_section5_storage_items` 追加: `인기 플랜 집계용 익명 ID(무작위 문자열)`

`privacy_section5_storage_note` 差し替え: `이 데이터는 기본적으로 브라우저 내부에만 저장됩니다. 다만 「인기 플랜 집계용 익명 ID」만은, 공유 플랜을 복사할 때 서버로 전송됩니다(개인을 식별할 수 없는 문자열이며, 집계의 중복 카운트를 방지하기 위해서만 사용됩니다).`

`privacy_section6_data_types` 追加2項目: `익명 복사 집계 ID(무작위 문자열)` と `익명 복사 기록 및 일별 복사 집계`

`privacy_section6_data_locations` 対応2項目: `사용자의 브라우저` と `Google Firebase(도쿄)`

`privacy_section6_data_periods` 対応2項目: `브라우저에서 직접 삭제할 때까지` と `일별 집계는 8일 이상 지난 것은 자동 삭제`

`privacy_section6_note` 差し替え: `로그인하지 않은 경우, 본 서비스에 경감 플랜이 저장되지 않습니다. 다만, 공유 플랜을 복사할 때에 한해, 집계의 중복 카운트를 방지하기 위한 익명 ID(개인을 식별할 수 없는 문자열)가 서버로 전송됩니다.`

- [ ] **Step 1: 上記9箇所の韓訳値で ko.json を更新**

`src/locales/ko.json` の同8キーを上記テンプレの値に書き換え。

- [ ] **Step 2: JSON妥当性確認**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/ko.json','utf8'))"
```
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/locales/ko.json
rtk git commit -m "docs(privacy): 한국어 정책 — 익명 ID 집계 추가"
```

---

## Task 13: 統合動作検証 + テスト + push

- [ ] **Step 1: ビルド + テスト全パス**

```bash
rtk npm run build && rtk npm test
```
Expected: ビルドOK + 151/151 pass

- [ ] **Step 2: dev server で手動検証**

Run: `rtk npm run dev`

検証項目:
- [ ] **匿名ID生成**: シークレットウィンドウでアプリ開く → ボトムシート→コピー → DevTools で localStorage に `lopo_anon_copy_id` があり UUID v4 形式か
- [ ] **匿名dedup**: 同ブラウザで同じプランを2回コピー → Firebase Console で `anonCopiedBy/{uuid}/{shareId}` が1件のまま、`copyCount` も1しか増えない
- [ ] **日別バケット**: コピー → Firestore で `shared_plans/{id}.copyCountByDay.20260417` が増えるか
- [ ] **旧キー間引き**: Firestore で手動に `copyCountByDay.20260408` (9日前のキー) を入れてからコピー → そのキーが消えるか
- [ ] **旬ランキング**: 異なる日別カウントを持つ2つのプランを用意し、直近7日の多い方が1位になるか
- [ ] **featured優先**: Firestore で任意のプランに `featured: true` を立てる → ボトムシートで優先表示されるか（見た目は区別なし）
- [ ] **featured解除**: `featured: false` に戻す → 自動ランキング1位に戻るか
- [ ] **プライベートブラウジング**: localStorage 無効で落ちずに動作し、カウントされないこと

- [ ] **Step 3: プライバシーポリシー表示確認**

`/privacy` を開いて4言語で切り替え:
- [ ] 「匿名ID」「日別コピー集計」関連文言が全4言語で正しく表示される
- [ ] Section 5 の note と Section 6 の note が新文言になっている
- [ ] 最終更新日が 2026年4月17日になっている

- [ ] **Step 4: TODO.md 更新**

`docs/TODO.md` の「今セッションの完了事項」に追加:
```
- ✅ 野良主流ランキング Phase 2: 匿名ID集計 + 旬ランキング + featured活性化 + ポリシー更新
```

- [ ] **Step 5: TODO.md コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs: Phase 2 完了 TODO更新"
```

- [ ] **Step 6: push**

```bash
rtk git push
```

Vercel で自動デプロイ。本番で再度手動検証を実施。

---

## 受け入れ基準（設計書 Phase 2 と同義）

### 匿名ID集計
- [ ] 未ログイン状態でコピーすると `copyCount` が +1 される
- [ ] 同じブラウザで同じプランを2回コピーしても +1 のまま（localStorage が有効な間）
- [ ] localStorage 無効環境でもエラーにならない（ただしカウントされない）

### 旬ランキング
- [ ] `copyCountByDay.YYYYMMDD` が正しく +1 される
- [ ] 7日以上前のキーが削除される
- [ ] `/api/popular` GET のレスポンスが「直近7日 copyCount 順」で並んでいる
- [ ] `copyCountByDay` が未定義のプランもスコア 0 として扱われエラーにならない

### featured優先
- [ ] Firestore で `featured: true` を立てたプランがボトムシートのプレビュー対象になる
- [ ] `featured` を外すと自動ランキング1位に戻る
- [ ] UI上、featured か自動ランキング1位かは見た目で区別されない（バッジ等なし）

### プライバシーポリシー
- [ ] 4言語（ja/en/zh/ko）で Section 1 / Section 3 / Section 5 / Section 6 が更新されている
- [ ] Section 5 storage_note が「匿名IDはサーバー送信される」旨を明記している
- [ ] Section 6 note が「未ログインでも匿名IDだけはサーバーに送られる」旨を明記している
- [ ] Section 6 のデータ表に「匿名コピー集計ID」「匿名コピー記録・日別コピー集計」が追加されている
- [ ] `privacy_last_updated` の日付が更新されている

### 品質保証
- [ ] 既存 + 新規テスト 151/151 pass
- [ ] ビルド成功
- [ ] 本番で手動検証全項目 OK

---

## リスクと緩和

| リスク | 緩和策 |
|-------|-------|
| 既存ログイン済みコピー破壊 | Task 2 で UID パスは構造変更なし（copyCount更新までの if-branch を維持、追加のみ） |
| anonId ゴミデータ | Task 2 で UUID v4 regex検証、通らなければ null扱い（400は返さない後方互換） |
| copyCountByDay 古いデータ未処理 | Task 3 でコピー毎に 7日以上前のキーを `FieldValue.delete()` |
| ランキングが母数小でブレる | featured 優先表示で対応済み（Task 8） + tie-break に全期間 `copyCount` を使用 |
| Firestore 読み取りコスト増 | `s-maxage=900` の既存 edge cache で抑制、1コンテンツあたり <100 プランの現実的スケール内 |
| ポリシー更新漏れ | Task 9-12 で 4言語別にコミット、各タスクの受け入れ基準で個別チェック |
| JSON 構文エラー | 各言語タスクで JSON妥当性確認を Step 10 等で明示 |

---

## 所要時間見積

- Task 1: 30分（テスト込み）
- Task 2: 30分
- Task 3: 20分
- Task 4: 30分
- Task 5-7: 各10分 × 3 = 30分
- Task 8: 30分
- Task 9: 45分（8キー手作業更新）
- Task 10-12: 各30分 × 3 = 1.5時間（翻訳込み）
- Task 13: 1時間（手動検証）

**合計**: 約 6〜7時間（集中して1日で完結可能）
