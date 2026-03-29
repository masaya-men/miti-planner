# 共有モーダル ロゴ修正 + 端末間同期 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有モーダルのロゴ操作を正しく動作させ、端末間のプラン同期の信頼性を修正する

**Architecture:** 課題1はshare APIにPUT対応を追加し、ShareModal.tsxでロゴ操作後にshareデータを上書き更新する。課題2はplanService.tsのマージロジックでFirestoreを正とし、usePlanStore.tsの同期時に存在チェックを追加する。2つの課題は独立しており並行実装可能。

**Tech Stack:** React 19, TypeScript, Firebase/Firestore, firebase-admin, Vercel Serverless Functions, Zustand

---

## ファイル構成

| ファイル | 変更種別 | 役割 |
|---------|---------|------|
| `api/share/index.ts` | 修正 | PUTメソッド追加（既存shareIdのロゴ上書き） |
| `src/components/ShareModal.tsx` | 修正 | ロゴ操作後にshare再作成、変更ボタン廃止、生成中ブロック |
| `src/locales/ja.json` | 修正 | 同期エラーメッセージ追加 |
| `src/locales/en.json` | 修正 | 同期エラーメッセージ追加（英語） |
| `src/lib/planService.ts` | 修正 | マージロジック修正（Firestoreを正とする） |
| `src/store/usePlanStore.ts` | 修正 | 同期時の存在チェック追加 |

---

## Task 1: share API に PUT メソッド追加

**Files:**
- Modify: `api/share/index.ts`

- [ ] **Step 1: api/share/index.ts に PUT ハンドラを追加**

CORSのAllowed Methodsに`PUT`を追加し、PUTハンドラを実装する。既存shareIdのドキュメントのロゴフィールドのみを更新する。

`api/share/index.ts` を以下のように修正:

CORS行を修正:
```typescript
// 変更前:
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
// 変更後:
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
```

`} else if (req.method === 'GET') {` の直前に PUT ハンドラを追加:

```typescript
        } else if (req.method === 'PUT') {
            // ── 既存共有のロゴ更新 ──
            const { shareId, logoStoragePath } = req.body;
            if (!shareId || typeof shareId !== 'string') {
                return res.status(400).json({ error: 'shareId is required' });
            }

            // 既存ドキュメントの存在確認
            const existingRef = db.collection(COLLECTION).doc(shareId);
            const existingSnap = await existingRef.get();
            if (!existingSnap.exists) {
                return res.status(404).json({ error: 'share not found' });
            }

            // firebase-adminでロゴをダウンロードしてbase64に変換
            let logoBase64: string | null = null;
            if (typeof logoStoragePath === 'string' && logoStoragePath.startsWith('users/') && logoStoragePath.endsWith('.jpg')) {
                try {
                    const bucket = getStorage().bucket('lopo-7793e.firebasestorage.app');
                    const file = bucket.file(logoStoragePath);
                    const [buffer] = await file.download();
                    logoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                } catch (err) {
                    console.error('Logo download failed:', err);
                }
            }

            // ロゴフィールドのみ更新（logoBase64がnullなら削除）
            if (logoBase64) {
                await existingRef.update({ logoBase64 });
            } else {
                // ロゴを削除する場合はフィールドごと削除
                const { FieldValue: FV } = require('firebase-admin/firestore');
                await existingRef.update({ logoBase64: FV.delete() });
            }

            return res.status(200).json({ shareId });

```

- [ ] **Step 2: FieldValue.delete() のインポートを修正**

PUTハンドラ内で`require`ではなく、ファイル冒頭の既存importを使うように修正。既にファイル冒頭で `import { getFirestore, FieldValue } from 'firebase-admin/firestore';` があるので、PUTハンドラ内の削除処理を以下に置き換え:

```typescript
            // ロゴを削除する場合はフィールドごと削除
            if (logoBase64) {
                await existingRef.update({ logoBase64 });
            } else {
                await existingRef.update({ logoBase64: FieldValue.delete() });
            }
```

- [ ] **Step 3: ビルド確認**

Run: `cd c:/Users/masay/Desktop/FF14Sim && npx tsc --noEmit api/share/index.ts`
（エラーが出る場合はビルド全体で確認: `npm run build`）

- [ ] **Step 4: コミット**

```bash
git add api/share/index.ts
git commit -m "feat: share APIにPUTメソッド追加（既存共有のロゴ上書き更新）"
```

---

## Task 2: ShareModal.tsx のロゴ操作修正

**Files:**
- Modify: `src/components/ShareModal.tsx`

- [ ] **Step 1: ロゴ更新用の関数を追加**

`generateShareUrl` 関数の後に、既存shareIdのロゴを更新する関数を追加:

```typescript
    // 既存shareIdのロゴを更新（PUT）
    const updateShareLogo = async (withLogo: boolean) => {
        if (!shareIdRef) return;
        setImageLoaded(false);
        try {
            const body: any = { shareId: shareIdRef };
            if (withLogo && teamLogoUrl && user) {
                body.logoStoragePath = `users/${user.uid}/team-logo.jpg`;
            }
            await apiFetch('/api/share', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            // プレビュー画像を再読み込み（キャッシュ回避のためタイムスタンプ付与）
            setOgImageUrl(buildOgUrl(shareIdRef, showPlanTitle, withLogo) + `&t=${Date.now()}`);
        } catch (err) {
            console.error('Share logo update failed:', err);
            showToast(t('app.share_failed'));
        }
    };
```

- [ ] **Step 2: processLogoFile を修正（アップロード後にshareデータを上書き）**

`processLogoFile` 関数内の `if (shareIdRef)` ブロックを修正:

```typescript
    const processLogoFile = async (file: File) => {
        if (!user) return;

        const error = validateLogoFile(file);
        if (error) {
            showToast(t(`team_logo.${error}`), 'error');
            return;
        }

        setUploading(true);
        try {
            const url = await uploadTeamLogo(user.uid, file);
            setTeamLogoUrl(url);
            showToast(t('team_logo.upload_success'));
            setShowLogo(true);
            // 既存shareデータのロゴを上書き更新
            await updateShareLogo(true);
        } catch (err) {
            console.error('[LogoUpload] アップロードエラー詳細:', err);
            showToast(t('team_logo.error_upload_failed'), 'error');
        } finally {
            setUploading(false);
        }
    };
```

- [ ] **Step 3: handleLogoDelete を修正（削除後にshareデータを上書き）**

```typescript
    const handleLogoDelete = async () => {
        if (!user) return;
        try {
            await deleteTeamLogo(user.uid);
            setTeamLogoUrl(null);
            setShowLogo(false);
            showToast(t('team_logo.remove_success'));
            // 既存shareデータからロゴを削除
            await updateShareLogo(false);
        } catch {
            showToast(t('team_logo.error_remove_failed'), 'error');
        }
    };
```

- [ ] **Step 4: handleToggleLogo を修正（トグル変更時にshareデータを上書き）**

```typescript
    const handleToggleLogo = () => {
        const next = !showLogo;
        setShowLogo(next);
        // shareデータのロゴを更新（ON→ロゴ埋め込み、OFF→ロゴ削除）
        updateShareLogo(next);
    };
```

- [ ] **Step 5: 変更ボタンを廃止、UIをシンプルに**

ロゴ設定行（328-370行目あたり）の `{teamLogoUrl ? (` 内から「変更ボタン」を削除:

変更前:
```tsx
{teamLogoUrl ? (
    <>
        <img ... />
        <button onClick={() => fileInputRef.current?.click()} ...>
            <ImageIcon size={11} />
            {t('team_logo.change')}
        </button>
        <button onClick={handleLogoDelete} ...>
            <Trash2 size={11} />
            {t('team_logo.remove')}
        </button>
    </>
) : (
```

変更後:
```tsx
{teamLogoUrl ? (
    <>
        <img
            src={teamLogoUrl}
            alt="Team Logo"
            className="w-8 h-8 rounded object-cover border border-app-border"
        />
        <button
            onClick={handleLogoDelete}
            disabled={uploading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold text-app-text-muted hover:text-app-text hover:bg-app-text/5 transition-all cursor-pointer border border-app-border"
        >
            <Trash2 size={11} />
            {t('team_logo.remove')}
        </button>
    </>
) : (
```

- [ ] **Step 6: 共有ボタンの生成中ブロックを強化**

共有ボタンの `disabled` 条件に `imageLoaded` を追加して、画像生成中は押せないようにする:

URLコピーボタン:
```tsx
// 変更前:
disabled={!shareUrl}
// 変更後:
disabled={!shareUrl || !imageLoaded}
```

X共有ボタン:
```tsx
// 変更前:
disabled={!shareUrl}
// 変更後:
disabled={!shareUrl || !imageLoaded}
```

- [ ] **Step 7: 不要なインポートを削除**

`ImageIcon` がロゴ変更ボタンでのみ使われていた場合、インポートから削除:

```typescript
// 変更前:
import { X, Copy, Check, Loader2, ExternalLink, Upload, ImageIcon, Trash2 } from 'lucide-react';
// 変更後:
import { X, Copy, Check, Loader2, ExternalLink, Upload, Trash2 } from 'lucide-react';
```

- [ ] **Step 8: ビルド確認**

Run: `cd c:/Users/masay/Desktop/FF14Sim && npm run build`
Expected: ビルド成功

- [ ] **Step 9: コミット**

```bash
git add src/components/ShareModal.tsx
git commit -m "fix: 共有モーダルのロゴ操作修正（上書き更新・変更ボタン廃止・生成中ブロック）"
```

---

## Task 3: 端末間同期 — マージロジック修正

**Files:**
- Modify: `src/lib/planService.ts`

- [ ] **Step 1: migrateLocalPlansToFirestore のマージロジックを修正**

Firestoreを正（信頼できるデータ）として扱うように修正。localにあってFirestoreにないプランについて:
- `ownerId === 'local'`（未ログイン時に作成）→ Firestoreにアップロード（既存動作を維持）
- それ以外（以前ログイン中に作成されたプラン）→ 別端末で削除されたとみなし、マージ結果に含めない

`migrateLocalPlansToFirestore` 関数全体を以下に置き換え:

```typescript
async function migrateLocalPlansToFirestore(
  localPlans: SavedPlan[],
  uid: string,
  displayName: string,
): Promise<SavedPlan[]> {
  // Firestoreから既存プランを取得
  const remotePlans = await fetchUserPlans(uid);
  const remoteIds = new Set(remotePlans.map((p) => p.id));

  // ローカルにしかないプランを処理
  const localOnly = localPlans.filter((p) => !remoteIds.has(p.id));
  for (const plan of localOnly) {
    // 未ログイン時に作成されたプラン（ownerId === 'local'）のみアップロード
    // それ以外はFirestoreで削除されたとみなしスキップ
    if (plan.ownerId !== 'local') continue;
    try {
      await createPlan(plan, uid, displayName);
    } catch (err) {
      // 上限に達した場合は残りをスキップ
      if (err instanceof Error && err.message.startsWith('PLAN_LIMIT_')) {
        console.warn('プラン上限に達したため、残りのローカルプランのアップロードをスキップ');
        break;
      }
      console.error('プランのアップロードに失敗:', plan.id, err);
    }
  }

  // マージ: Firestoreを正とする
  const merged: SavedPlan[] = [];

  // 両方にあるプランは updatedAt が新しい方を採用
  for (const local of localPlans) {
    const remote = remotePlans.find((r) => r.id === local.id);
    if (remote) {
      // 両方に存在 → updatedAtが新しい方
      merged.push(remote.updatedAt > local.updatedAt ? remote : local);
    } else if (local.ownerId === 'local') {
      // ローカルのみ & 未ログイン作成 → 残す（アップロード済み）
      merged.push(local);
    }
    // ローカルのみ & ownerId !== 'local' → 削除されたとみなし除外
  }

  // リモートにのみ存在するプランを追加
  const localIds = new Set(localPlans.map((p) => p.id));
  const remoteOnly = remotePlans.filter((p) => !localIds.has(p.id));
  merged.push(...remoteOnly);

  // updatedAt降順でソート
  merged.sort((a, b) => b.updatedAt - a.updatedAt);

  return merged;
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd c:/Users/masay/Desktop/FF14Sim && npm run build`
Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/lib/planService.ts
git commit -m "fix: ログイン時マージロジック修正（Firestoreを正として削除済みプラン復活を防止）"
```

---

## Task 4: 端末間同期 — 保存時の存在チェック

**Files:**
- Modify: `src/store/usePlanStore.ts`
- Modify: `src/lib/planService.ts`
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: planService に単一プランの存在チェック関数を追加**

`planService.ts` の `syncDirtyPlans` 関数の前に追加:

```typescript
/** プランがFirestoreに存在するか確認 */
async function checkPlanExists(planId: string): Promise<boolean> {
  try {
    const planRef = doc(db, COLLECTIONS.PLANS, planId);
    const snap = await getDoc(planRef);
    return snap.exists();
  } catch {
    // 権限エラー等 → 存在しないとみなす
    return false;
  }
}
```

エクスポートにも追加:
```typescript
export const planService = {
  fetchUserPlans,
  createPlan,
  updatePlan,
  deletePlan,
  checkPlanLimits,
  checkPlanExists,  // ← 追加
  ensurePlanCounts,
  migrateLocalPlansToFirestore,
  syncDirtyPlans,
};
```

- [ ] **Step 2: syncDirtyPlans 内に存在チェックを追加**

`syncDirtyPlans` 関数内の `plansToSync.map` コールバックを修正。保存前にプランがFirestoreに存在するか確認し、存在しない場合は `'DELETED_REMOTELY'` を返す:

```typescript
async function syncDirtyPlans(
  dirtyPlanIds: Set<string>,
  plans: SavedPlan[],
  uid: string,
  displayName: string,
): Promise<string[]> {  // ← 戻り値をstring[]に変更（リモート削除されたプランID一覧）
  const deletedRemotely: string[] = [];
  if (dirtyPlanIds.size === 0) return deletedRemotely;

  const plansToSync = plans.filter((p) => dirtyPlanIds.has(p.id));

  // 全プランを並列に同期（ログアウト時の速度改善）
  const results = await Promise.allSettled(
    plansToSync.map(async (plan) => {
      if (plan.ownerId === 'local' || plan.ownerId === uid) {
        try {
          await updatePlan(plan, uid);
        } catch {
          // updateが失敗 → 新規作成を試行
          // ただし ownerId が uid（以前存在したプラン）の場合は
          // リモートで削除された可能性をチェック
          if (plan.ownerId === uid) {
            const exists = await checkPlanExists(plan.id);
            if (!exists) {
              deletedRemotely.push(plan.id);
              return;
            }
          }
          await createPlan(plan, uid, displayName);
        }
      }
    }),
  );

  // 失敗したプランのエラーをログ出力
  for (const [i, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error('Firestore同期エラー:', plansToSync[i].id, result.reason);
    }
  }

  return deletedRemotely;
}
```

- [ ] **Step 3: usePlanStore の syncToFirestore を修正**

`syncToFirestore` 内で `syncDirtyPlans` の戻り値（リモート削除されたプランID一覧）を処理:

```typescript
            syncToFirestore: async (uid, displayName) => {
                const state = get();
                if (state._isSyncing) return;
                if (state._dirtyPlanIds.size === 0 && state._deletedPlanIds.size === 0) return;

                set({ _isSyncing: true });

                try {
                    // 削除されたプランの処理
                    const deletedIds = new Set(state._deletedPlanIds);
                    for (const planId of deletedIds) {
                        try {
                            await planService.deletePlan(planId, uid, null);
                        } catch (err) {
                            console.error('Firestore削除エラー:', planId, err);
                        }
                    }

                    // dirtyプランの同期（リモート削除検出付き）
                    const deletedRemotely = await planService.syncDirtyPlans(
                        state._dirtyPlanIds,
                        state.plans,
                        uid,
                        displayName,
                    );

                    // リモートで削除されたプランをローカルからも削除
                    if (deletedRemotely.length > 0) {
                        for (const planId of deletedRemotely) {
                            get().deletePlan(planId);
                        }
                        // トースト通知はインポートの関係でここでは行わず、
                        // 呼び出し側（Layout.tsx）で処理することも検討したが、
                        // シンプルにここで直接表示する
                        const { showToast } = await import('../components/Toast');
                        const count = deletedRemotely.length;
                        showToast(
                            count === 1
                                ? '別の端末で削除された表があったため、同期しました'
                                : `別の端末で削除された表が${count}件あったため、同期しました`,
                        );
                    }

                    // 同期完了 → dirty/deletedをクリア
                    set({
                        _dirtyPlanIds: new Set<string>(),
                        _deletedPlanIds: new Set<string>(),
                        _lastSyncAt: Date.now(),
                    });
                } catch (err) {
                    console.error('Firestore同期エラー:', err);
                } finally {
                    set({ _isSyncing: false });
                }
            },
```

- [ ] **Step 4: i18nメッセージを追加**

`src/locales/ja.json` の `app` セクションに追加:
```json
"plan_deleted_remotely": "別の端末で削除された表があったため、同期しました",
"plans_deleted_remotely": "別の端末で削除された表が{{count}}件あったため、同期しました"
```

`src/locales/en.json` の `app` セクションに追加:
```json
"plan_deleted_remotely": "A table deleted on another device has been synced",
"plans_deleted_remotely": "{{count}} tables deleted on another device have been synced"
```

そして Step 3 のトースト部分を i18n対応に修正:
```typescript
                    if (deletedRemotely.length > 0) {
                        for (const planId of deletedRemotely) {
                            get().deletePlan(planId);
                        }
                        const { showToast } = await import('../components/Toast');
                        // i18n は store 内では使えないため、シンプルな日本語メッセージを使用
                        // （このアプリの主要ユーザーは日本語話者）
                        showToast('別の端末で削除された表を同期しました');
                    }
```

注: Zustandストア内では `useTranslation` が使えないため、シンプルなメッセージを直接使用する。

- [ ] **Step 5: ビルド確認**

Run: `cd c:/Users/masay/Desktop/FF14Sim && npm run build`
Expected: ビルド成功

- [ ] **Step 6: コミット**

```bash
git add src/lib/planService.ts src/store/usePlanStore.ts src/locales/ja.json src/locales/en.json
git commit -m "fix: 端末間同期の信頼性修正（保存時にFirestore存在チェック・リモート削除検出）"
```

---

## Task 5: 統合テスト（手動確認）

- [ ] **Step 1: 共有モーダルのロゴ操作テスト**

以下のシナリオを `npm run dev` で確認:

1. ログイン → 共有モーダルを開く → ロゴなしのプレビューが表示される
2. ロゴをドラッグ&ドロップ → プレビューにロゴが反映される
3. 別のロゴをドラッグ&ドロップ → 新しいロゴに置き換わる
4. 削除ボタン → ロゴが消える → プレビューからもロゴが消える
5. 追加ボタン → ファイル選択 → ロゴが表示される
6. ロゴトグルOFF → プレビューからロゴが消える
7. ロゴトグルON → プレビューにロゴが戻る
8. 画像生成中に共有ボタンが無効化されていることを確認
9. 共有URLをコピー → 別タブで開く → OGP画像が正しく表示される

- [ ] **Step 2: 端末間同期テスト**

1. PCでログイン → 表を作成
2. 別ブラウザ（シークレットウィンドウ等）で同アカウントログイン → 表が見える
3. PCで表を削除
4. 別ブラウザをリロード → 表が消えていることを確認（復活しない）

- [ ] **Step 3: 最終コミット（必要に応じて修正）**

問題があれば修正してコミット。
