# プラン同期の信頼性修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC⇔スマホ間のプランデータ同期を確実に動作させ、「いつ保存されたか」をユーザーが常に把握できるようにする

**Architecture:** Firestoreを正（Source of Truth）、localStorageをキャッシュとして扱う。アプリ復帰時にFirestoreからfetch（PULL追加）、編集後は積極的にpush（PUSHタイミング改善）、ログアウト時の盲目的な上書きを廃止。保存インジケータを3段階（ローカル保存→クラウド同期中→クラウド同期完了）に拡張。

**Tech Stack:** Firestore SDK (getDocs/setDoc), zustand, React (visibilitychange), i18n (ja/en/zh/ko)

---

## 根本原因（修正対象）

1. **PUSH不足**: 編集後のFirestore同期がタブ非表示/ページ離脱/プラン切替/5分定期のみ。タブ開いたままだと届かない
2. **PULL不在**: セッション中にFirestoreから最新データを取得する仕組みがない（ログイン時の1回のみ）
3. **forceSyncAll破壊**: ログアウト時に全プランを無条件pushし、serverTimestamp()で上書き → 他端末の新しいデータを古いデータで破壊
4. **インジケータ不足**: 「保存済み ✓」がlocalStorage保存のみを指し、クラウド同期状態が不明

---

## ファイル構成

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/planService.ts` | fetchAndMerge関数追加、updatePlanにタイムスタンプ比較追加 |
| `src/store/usePlanStore.ts` | pullFromFirestore/smartSync追加、forceSyncAll修正、saveStatus拡張 |
| `src/components/Layout.tsx` | visibilitychange復帰時のPULL追加、PUSHタイミング追加 |
| `src/components/ConsolidatedHeader.tsx` | インジケータ3段階表示 |
| `src/locales/ja.json` | 新i18nキー追加 |
| `src/locales/en.json` | 新i18nキー追加 |
| `src/locales/zh.json` | 新i18nキー追加 |
| `src/locales/ko.json` | 新i18nキー追加 |

---

### Task 1: planService — タイムスタンプ比較付きupdateとfetch関数

**Files:**
- Modify: `src/lib/planService.ts:62-77` (toFirestoreUpdate)
- Modify: `src/lib/planService.ts:214-237` (updatePlan)
- Modify: `src/lib/planService.ts:373-415` (syncDirtyPlans)
- Modify: `src/lib/planService.ts:280-354` (migrateLocalPlansToFirestore)
- Modify: `src/lib/planService.ts:421-432` (export)

- [ ] **Step 1: updatePlanにタイムスタンプ比較を追加**

`updatePlan`を修正して、Firestoreのデータがローカルより新しい場合はスキップする（上書き防止）。
戻り値を追加して、スキップされたかどうかを呼び出し元に伝える。

```typescript
// planService.ts — updatePlan を置き換え

/** 
 * プランを Firestore で更新（タイムスタンプ比較付き）
 * - リモートがローカルより新しい場合はスキップ（'skipped_newer_remote'）
 * - 存在しない場合はエラーをthrow → 呼び出し側でcreateにフォールバック
 * @returns 'updated' | 'skipped_newer_remote'
 */
async function updatePlan(
  plan: SavedPlan,
  uid: string,
): Promise<'updated' | 'skipped_newer_remote'> {
  const planRef = doc(db, COLLECTIONS.PLANS, plan.id);
  try {
    const snap = await getDoc(planRef);
    if (!snap.exists()) {
      throw new Error('NOT_EXISTS');
    }
    const current = snap.data() as FirestorePlan;
    if (current.ownerId !== uid) {
      throw new Error('NOT_OWNER');
    }
    // タイムスタンプ比較: リモートがローカルより新しければスキップ
    const remoteUpdatedAt = current.updatedAt instanceof Timestamp
      ? current.updatedAt.toMillis()
      : 0;
    if (remoteUpdatedAt > plan.updatedAt) {
      return 'skipped_newer_remote';
    }
    await setDoc(planRef, toFirestoreUpdate(plan, current.version), { merge: true });
    return 'updated';
  } catch (err) {
    throw err;
  }
}
```

- [ ] **Step 2: fetchAndMerge関数を追加**

Firestoreから最新データを取得し、ローカルデータとマージする関数。
PULL操作の核心部分。migrateLocalPlansToFirestoreのマージロジックを再利用可能な形で切り出す。

```typescript
// planService.ts — 同期ロジックセクションに追加

/**
 * Firestoreから最新データを取得し、ローカルデータとマージする（PULL操作）
 * 
 * マージ戦略（Last Writer Wins）:
 * - 両方に存在: updatedAt が新しい方を採用
 * - リモートのみ: ローカルに追加（他端末で作成されたプラン）
 * - ローカルのみ + ownerId=uid: リモートで削除された → ローカルからも除去
 * - ローカルのみ + ownerId='local': 未アップロード → 残す
 * 
 * @returns マージ結果 + ローカルで変更があった（=UIを更新すべき）プランID
 */
async function fetchAndMerge(
  localPlans: SavedPlan[],
  uid: string,
): Promise<{ merged: SavedPlan[]; changed: boolean }> {
  const remotePlans = await fetchUserPlans(uid);
  const remoteMap = new Map(remotePlans.map((p) => [p.id, p]));
  const localMap = new Map(localPlans.map((p) => [p.id, p]));

  const merged: SavedPlan[] = [];
  let changed = false;

  // ローカルプランを処理
  for (const local of localPlans) {
    const remote = remoteMap.get(local.id);
    if (remote) {
      if (remote.updatedAt > local.updatedAt) {
        // リモートが新しい → リモートを採用
        merged.push(remote);
        changed = true;
      } else {
        // ローカルが同じか新しい → ローカルを維持
        merged.push(local);
      }
    } else if (local.ownerId === 'local') {
      // 未アップロード → 残す
      merged.push(local);
    } else {
      // リモートで削除された → ローカルからも除去
      changed = true;
    }
  }

  // リモートのみのプラン（他端末で作成）
  for (const remote of remotePlans) {
    if (!localMap.has(remote.id)) {
      merged.push(remote);
      changed = true;
    }
  }

  merged.sort((a, b) => b.updatedAt - a.updatedAt);
  return { merged, changed };
}
```

- [ ] **Step 3: syncDirtyPlansのupdatePlan戻り値に対応**

`updatePlan`の戻り値が`'skipped_newer_remote'`の場合、createへのフォールバックをスキップする。

```typescript
// planService.ts — syncDirtyPlans 内のmap部分を修正

  const results = await Promise.allSettled(
    plansToSync.map(async (plan) => {
      if (plan.ownerId === 'local' || plan.ownerId === uid) {
        try {
          const result = await updatePlan(plan, uid);
          if (result === 'skipped_newer_remote') {
            // リモートが新しい → このプランはpushせずにスキップ（次回pullで取得される）
            return;
          }
        } catch {
          // updateが失敗 → 新規作成を試行
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
```

- [ ] **Step 4: エクスポートにfetchAndMergeを追加**

```typescript
export const planService = {
  fetchUserPlans,
  fetchAndMerge,      // ← 追加
  createPlan,
  updatePlan,
  deletePlan,
  checkPlanLimits,
  checkPlanExists,
  ensurePlanCounts,
  repairPlanCounts,
  migrateLocalPlansToFirestore,
  syncDirtyPlans,
};
```

- [ ] **Step 5: コミット**

```bash
git add src/lib/planService.ts
git commit -m "fix: updatePlanにタイムスタンプ比較追加 + fetchAndMerge関数追加"
```

---

### Task 2: usePlanStore — PULL操作とforceSyncAll修正

**Files:**
- Modify: `src/store/usePlanStore.ts:11-45` (PlanState interface)
- Modify: `src/store/usePlanStore.ts:207-268` (syncToFirestore)
- Modify: `src/store/usePlanStore.ts:275-319` (forceSyncAll)
- Add new method: pullFromFirestore

- [ ] **Step 1: PlanState interfaceにpullFromFirestoreとsyncStatus追加**

```typescript
// usePlanStore.ts — PlanState interfaceに追加

    // 保存インジケーター用（UIに実際の保存状態を反映）
    _saveStatus: 'idle' | 'saving' | 'saved';
    _cloudStatus: 'idle' | 'syncing' | 'synced' | 'error';  // ← 追加
    setSaveStatus: (status: 'idle' | 'saving' | 'saved') => void;

    // ...既存のアクション...

    /** Firestoreから最新データを取得してローカルとマージ（PULL操作） */
    pullFromFirestore: (uid: string) => Promise<void>;
    /** dirtyプランのみをpush（通常同期。editSyncとして呼ぶ用） */
    syncToFirestore: (uid: string, displayName: string) => Promise<void>;
    /** ログアウト前: dirtyプランのみをpush（全プラン盲目pushを廃止） */
    forceSyncAll: (uid: string, displayName: string) => Promise<void>;
```

- [ ] **Step 2: pullFromFirestore実装**

```typescript
// usePlanStore.ts — Firestore同期メソッドセクションに追加

            /**
             * Firestoreから最新データを取得してローカルとマージ（PULL操作）
             * アプリ復帰時・タブ復帰時に呼ぶ
             */
            pullFromFirestore: async (uid) => {
                const state = get();
                if (state._isSyncing) return;

                set({ _cloudStatus: 'syncing' });
                try {
                    const { merged, changed } = await planService.fetchAndMerge(
                        state.plans,
                        uid,
                    );
                    if (changed) {
                        set({ plans: merged });
                        // 現在開いているプランが更新された場合、MitigationStoreも更新
                        const currentPlanId = get().currentPlanId;
                        if (currentPlanId) {
                            const updatedPlan = merged.find(p => p.id === currentPlanId);
                            if (updatedPlan?.data) {
                                const localPlan = state.plans.find(p => p.id === currentPlanId);
                                // リモートの方が新しい場合のみMitigationStoreを更新
                                if (localPlan && updatedPlan.updatedAt > localPlan.updatedAt) {
                                    useMitigationStore.getState().loadSnapshot(updatedPlan.data);
                                }
                            }
                        }
                    }
                    set({ _cloudStatus: 'synced' });
                } catch (err) {
                    console.error('Firestore PULL エラー:', err);
                    set({ _cloudStatus: 'error' });
                }
            },
```

- [ ] **Step 3: forceSyncAllをdirtyプランのみに修正**

現在の`forceSyncAll`は全プランを盲目的にpushしている。
これをdirtyプランのみのpush + タイムスタンプ比較に修正する。

```typescript
// usePlanStore.ts — forceSyncAll を置き換え

            /**
             * ログアウト前にdirtyプランをFirestoreに同期
             * 旧実装: 全プランを盲目push → リモートの新しいデータを破壊するバグ
             * 新実装: dirtyプランのみpush + updatePlanのタイムスタンプ比較で安全に同期
             */
            forceSyncAll: async (uid, displayName) => {
                const FORCE_SYNC_TIMEOUT_MS = 10_000;

                const syncWork = async () => {
                    const state = get();
                    // 削除の処理
                    for (const planId of state._deletedPlanIds) {
                        try {
                            await planService.deletePlan(planId, uid, null);
                        } catch (err) {
                            console.error('Firestore強制削除エラー:', planId, err);
                        }
                    }
                    // dirtyプランのみを同期（タイムスタンプ比較はupdatePlan内で実行される）
                    if (state._dirtyPlanIds.size > 0) {
                        await planService.syncDirtyPlans(
                            state._dirtyPlanIds,
                            state.plans,
                            uid,
                            displayName,
                        );
                    }
                };

                try {
                    await Promise.race([
                        syncWork(),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('SYNC_TIMEOUT')), FORCE_SYNC_TIMEOUT_MS)
                        ),
                    ]);
                } catch (err) {
                    if (err instanceof Error && err.message === 'SYNC_TIMEOUT') {
                        console.warn('Firestore強制同期がタイムアウト（10秒）。ログアウトを続行します');
                    } else {
                        console.error('Firestore強制同期エラー:', err);
                    }
                } finally {
                    set({
                        _dirtyPlanIds: new Set<string>(),
                        _deletedPlanIds: new Set<string>(),
                        _lastSyncAt: Date.now(),
                        _isSyncing: false,
                    });
                }
            },
```

- [ ] **Step 4: syncToFirestoreにcloudStatus更新を追加**

```typescript
// usePlanStore.ts — syncToFirestore内、set({ _isSyncing: true }) の直後に追加
                set({ _isSyncing: true, _cloudStatus: 'syncing' });

// try ブロック末尾、同期完了setの中に追加
                    set((current) => {
                        // ...既存のdirty/deleted除去ロジック...
                        return {
                            _dirtyPlanIds: remainingDirty,
                            _deletedPlanIds: remainingDeleted,
                            _lastSyncAt: Date.now(),
                            _cloudStatus: 'synced',  // ← 追加
                        };
                    });

// catch ブロックに追加
                } catch (err) {
                    console.error('Firestore同期エラー:', err);
                    set({ _cloudStatus: 'error' });  // ← 追加
                }
```

- [ ] **Step 5: _cloudStatus初期値とpartialize確認**

```typescript
// usePlanStore.ts — 初期値追加（_saveStatusの下）
            _cloudStatus: 'idle' as const,

// partialize は変更不要（_cloudStatusはlocalStorageに保存しない = 正しい動作）
```

- [ ] **Step 6: コミット**

```bash
git add src/store/usePlanStore.ts
git commit -m "fix: PULL操作追加 + forceSyncAllの盲目push廃止 + cloudStatus追加"
```

---

### Task 3: Layout.tsx — PULL/PUSHタイミング改善

**Files:**
- Modify: `src/components/Layout.tsx:188-295` (自動保存useEffect)

- [ ] **Step 1: visibilitychange復帰時のPULLを追加**

タブが再表示された時にFirestoreからfetchする。これがPC⇔スマホ同期の核心。

```typescript
// Layout.tsx — onVisibilityChange を修正

        /** タブ切替時: 
         * 非表示 → localStorage保存 + Firestore PUSH
         * 再表示 → Firestore PULL（他端末の変更を取得）
         */
        const onVisibilityChange = () => {
            if (document.hidden) {
                // タブ非表示 → 保存 + PUSH
                if (localDebounceTimer) clearTimeout(localDebounceTimer);
                saveSilently();
                syncToCloud();
                usePlanStore.getState().setSaveStatus('saved');
            } else {
                // タブ再表示 → PULL（他端末の変更を取得）
                pullFromCloud();
            }
        };
```

- [ ] **Step 2: pullFromCloud関数を定義**

```typescript
// Layout.tsx — syncToCloud の下に追加

        /** Firestoreから最新データを取得（ログイン中のみ） */
        const pullFromCloud = () => {
            const authState = useAuthStore.getState();
            if (authState.user) {
                usePlanStore.getState().pullFromFirestore(
                    authState.user.uid,
                ).catch((err) => {
                    console.error('[LoPo] Firestore PULL エラー:', err);
                });
            }
        };
```

- [ ] **Step 3: 編集後のPUSHタイミングを追加 — debounce完了時にもクラウド同期**

現在、500msデバウンス後はlocalStorageにしか保存していない。
ここにクラウド同期も追加する（3分クールダウンはsyncToFirestore内で制御されるのでコスト問題なし）。

```typescript
// Layout.tsx — 500msデバウンスのsetTimeout内を修正

            localDebounceTimer = setTimeout(() => {
                const currentId = usePlanStore.getState().currentPlanId;
                if (currentId !== planIdAtChange) return;
                saveSilently();
                usePlanStore.getState().setSaveStatus('saved');
                // クラウド同期も試行（3分クールダウンで自動的に間引かれる）
                syncToCloud();
            }, 500);
```

- [ ] **Step 4: 5分定期バックアップをPULL+PUSHに変更**

```typescript
// Layout.tsx — 定期バックアップを修正

        // 5分ごとの定期同期（PUSH + PULL）
        const periodicSyncInterval = setInterval(() => {
            syncToCloud();
            pullFromCloud();
        }, 5 * 60 * 1000);
```

- [ ] **Step 5: コミット**

```bash
git add src/components/Layout.tsx
git commit -m "fix: タブ復帰時のPULL追加 + 編集後のPUSHタイミング改善"
```

---

### Task 4: 保存インジケータの3段階表示

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx:50-73` (SaveIndicator)
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/ko.json`

- [ ] **Step 1: i18nキーを追加**

各言語ファイルの `app` セクションに追加:

```json
// ja.json
"cloud_syncing": "同期中...",
"cloud_synced": "同期済み ☁",
"cloud_error": "同期エラー",
"local_only": "ローカルのみ"

// en.json
"cloud_syncing": "Syncing...",
"cloud_synced": "Synced ☁",
"cloud_error": "Sync error",
"local_only": "Local only"

// zh.json
"cloud_syncing": "同步中...",
"cloud_synced": "已同步 ☁",
"cloud_error": "同步错误",
"local_only": "仅本地"

// ko.json
"cloud_syncing": "동기화 중...",
"cloud_synced": "동기화 완료 ☁",
"cloud_error": "동기화 오류",
"local_only": "로컬 전용"
```

- [ ] **Step 2: SaveIndicatorを3段階表示に拡張**

```tsx
// ConsolidatedHeader.tsx — SaveIndicator を置き換え

const SaveIndicator: React.FC = React.memo(() => {
    const { t } = useTranslation();
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    const saveStatus = usePlanStore(s => s._saveStatus);
    const cloudStatus = usePlanStore(s => s._cloudStatus);
    const user = useAuthStore(s => s.user);

    if (!currentPlanId) return null;
    if (saveStatus === 'idle' && cloudStatus === 'idle') return null;

    // 表示優先度: saving > cloud_syncing > cloud_error > cloud_synced > saved
    let text: string;
    let className: string;

    if (saveStatus === 'saving') {
        text = t('app.saving');
        className = 'text-app-text/50 animate-pulse';
    } else if (cloudStatus === 'syncing') {
        text = t('app.cloud_syncing');
        className = 'text-app-text/50 animate-pulse';
    } else if (cloudStatus === 'error') {
        text = t('app.cloud_error');
        className = 'text-red-400';
    } else if (cloudStatus === 'synced') {
        text = t('app.cloud_synced');
        className = 'text-app-text';
    } else if (saveStatus === 'saved') {
        // ログイン中なら「保存済み」の後にクラウド状態も表示
        text = user ? t('app.saved') : t('app.saved');
        className = 'text-app-text';
    } else {
        return null;
    }

    return (
        <span
            className={clsx(
                "text-app-base transition-opacity duration-300",
                className,
            )}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
            {text}
        </span>
    );
});
SaveIndicator.displayName = 'SaveIndicator';
```

- [ ] **Step 3: useAuthStoreのimport追加**

ConsolidatedHeader.tsxの先頭importに `useAuthStore` がなければ追加:

```typescript
import { useAuthStore } from '../store/useAuthStore';
```

- [ ] **Step 4: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx src/locales/ja.json src/locales/en.json src/locales/zh.json src/locales/ko.json
git commit -m "feat: 保存インジケータを3段階に拡張（ローカル/同期中/同期完了）"
```

---

### Task 5: 統合テスト — PC⇔スマホシナリオの動作確認

- [ ] **Step 1: ビルド確認**

```bash
npm run build
```

エラーがあれば修正。

- [ ] **Step 2: 手動テストシナリオの確認リスト**

以下のシナリオが正常に動作することを確認:

1. **基本PUSH**: 編集 → 500ms後に「保存済み ✓」→ 3分クールダウン後に「同期済み ☁」
2. **タブ非表示PUSH**: 編集 → タブ切替 → Firestoreにpush（devtools Networkで確認）
3. **タブ復帰PULL**: 別端末で編集 → 元の端末でタブ復帰 → 最新データが反映
4. **ログアウト安全性**: 端末Aで編集 → 端末Bでログアウト → 端末Aのデータが消えない
5. **削除同期**: 端末Aで削除 → 端末Bでタブ復帰 → 削除が反映
6. **未ログイン時**: インジケータが「保存済み ✓」のみ（クラウド関連表示なし）
7. **オフライン時**: localStorageで動作継続、復帰時に同期

- [ ] **Step 3: コミット + push**

```bash
git add -A
git commit -m "fix: PC⇔スマホ同期の信頼性修正 — PULL追加・forceSyncAll安全化・インジケータ3段階化"
git push origin main
```
