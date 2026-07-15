# 共有ツアー同期 MVP 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 幹事が組んだハウジングツアーを招待リンクで配り、参加者（ログイン不要）全員の画面を幹事の進行にリアルタイム同期する。

**Architecture:** 一方向ブロードキャスト。幹事の `useHousingTourStore` の state（currentIndex/phase/viewStartAt）を Firestore の小ドキュメントに書き、参加者は onSnapshot で読むだけ。家データは発行時にスナップショットとしてサーバー保存し初回1回だけ配る。招待リンク発行は API（Admin SDK）、進行更新は幹事クライアントの Firestore 直書き（rules で hostUid 保護）。

**Tech Stack:** React + TypeScript + Vite / Firebase Firestore（client SDK onSnapshot + Admin SDK）/ Vercel serverless（`api/housing/index.ts` 集約ルータ）/ zustand / vitest。

設計書: `docs/superpowers/specs/2026-07-15-shared-tour-sync-design.md`（この計画は spec を実装可能タスクに割ったもの。用語・データモデルは spec が正典）。

## Global Constraints

各タスクの要件はこのセクションを暗黙に含む。

- **新 API は `api/housing/index.ts` の `?action=` switch に畳む。実処理は `_` プレフィックスのヘルパーファイル**（Vercel が serverless 関数として deploy しないため関数数が増えない）。**新 top-level `api/` ファイルは1本も作らない**（Node 関数が既に12上限ギリギリ・[[reference_vercel_hobby_function_limit]]）。
- **匿名で読める経路は `verifyAppCheck` より前に return する「公開窓口」方式**（`PUBLIC_WINDOW_ACTIONS` 型）。`buildHeaders(false)` + サーバー `verifyAppCheck` の check-duplicate 方式は本番（`ENFORCE_APP_CHECK=true`）で匿名 403 になる（[[reference_appcheck_lazy_enumerate_anon_endpoints]]）。
- **書き込みハンドラの順序**: `verifyAppCheck(req,res)` → `applyRateLimit` → `getAuth().verifyIdToken(token)` → 自前 `setCors`（既存 `_registerListingHandler.ts` に倣う）。
- **`api/` 配下の相対 import は `.js` 拡張子必須**（Vercel Node ESM・無いと本番500・[[reference_vercel_api_esm_js_extension]]）。**Node Function は JSON import 不可**（実行時500・共有データは TS 定数で・[[reference_vercel_node_function_json_import]]）。
- **コメント・ドキュメントは日本語**（CLAUDE.md）。
- **push 前に `npm run build`（tsc -b 厳密・未使用変数/型不足NG・[[feedback_vercel_tsc_strict]]）+ `npx vitest run`**（pool=vmThreads・「RUN」で固まるので出力をパイプしない・[[reference_vitest_vmthreads_hang]]）。
- **rules のユニットテスト基盤は無い** → rules は手動レビュー + Phase 4 の統合スパイクで検証。
- Firestore client は `src/lib/firebase.ts` の `export const db`（persistentLocalCache 有効 = onSnapshot はキャッシュ→サーバーの順で発火しうる。初回描画は `metadata.fromCache` を無視して最新到達を待つ判断が要る）。
- Firestore client の書き込み/購読は `firebase/firestore` の `doc/getDoc/updateDoc/onSnapshot/collection/query/where` を使う。
- **本番デプロイはユーザーのローカル確認をゲートにする**（[[feedback_deploy]]・新機能を勝手に push しない）。ブランチ `feat/housing-shared-tour-sync` で作業。

---

## Phase 0: App Check スパイク（方式 a/b を確定 — 後続の参加者経路が分岐する）

### Task 0: 匿名 Firestore onSnapshot が通るか確定する

**Files:**
- 一時: `firestore.rules`（検証用の probe ルールを一時追加 → 検証後に撤去）

**なぜ最初か:** 参加者は未ログイン＝匿名で、LoPo は「閲覧のみ匿名は App Check を初期化しない」設計（`src/lib/appCheck.ts`）。Firestore に App Check enforcement が有効だと匿名 onSnapshot が 403 で弾かれる。ここで (a)/(b) を確定しないと Phase 1 の参加者経路（Task 1.8 / Task 2.3-2.4）が書けない。

- [ ] **Step 1: enforcement 状態をユーザーに確認**

ユーザー（masaya）に Firebase コンソール → Project Settings → App Check → APIs タブで **Cloud Firestore の enforcement が Enforced か Unenforced か**を確認してもらう。これだけで (a)/(b) が確定することが多い。

- [ ] **Step 2: 確証が要る場合のみ実機 probe**

Step 1 で確定できない場合：`firestore.rules` に一時的に
```
match /shared_tours_probe/{id} { allow read: if true; allow write: if false; }
```
を足して `firebase deploy --only firestore:rules`、Admin SDK or コンソールで `shared_tours_probe/ping` に `{ t: 1 }` を1件置く。**未ログイン・App Check 未初期化**のブラウザ（本番 origin）で `onSnapshot(doc(db,'shared_tours_probe','ping'), ...)` を実行し、値が届くか / `permission-denied` になるかを見る。検証後 probe ルールと doc は撤去。

- [ ] **Step 3: 結果を記録して分岐を確定**

- **(a) 届く** → 参加者経路 = **匿名 onSnapshot 直読み**（Task 1.8 / 2.3 の本線）。
- **(b) 弾かれる** → 参加者経路 = **公開窓口 API ポーリング**（Task 1.8-ALT / 2.3-ALT。§末尾の代替タスク群に差し替え。live state を `action=shared-tour-state`（`PUBLIC_WINDOW_ACTIONS` に追加・verifyAppCheck 前 return・`Cache-Control: s-maxage=2` 程度）で数秒ポーリング）。

結果を `docs/.private/2026-07-15-shared-tour-appcheck-probe.md` に1行記録（本番設定の穴を公開 spec に書かない）。

---

## Phase 1: データモデル + 同期の骨格（同期が動く）

### Task 1.1: 型定義

**Files:**
- Create: `src/types/sharedTour.ts`

**Interfaces（後続タスクが依存する・そのまま使う）:**
```ts
export type TourPhase = 'moving' | 'viewing';
export type TourStatus = 'live' | 'ended';

/** 家1件の送信用スナップショット（MockListing の縮約・画像本体は含めず外部URL文字列のみ） */
export interface TourSnapshot {
  id: string;
  area?: string; ward?: number; buildingType?: 'house' | 'apartment';
  plot?: number; size?: 'S' | 'M' | 'L';
  apartmentBuilding?: 1 | 2; roomNumber?: number;
  roomKind?: 'private_chamber' | 'apartment_room';
  dc?: string; server?: string; region?: string;
  imageMode?: 'sns' | 'thumbnail' | 'none';
  postUrl?: string; ogImageUrl?: string;
  sourceImageUrls?: string[]; sourceImageAspectRatios?: number[];
  youtubeVideoId?: string; videoUrl?: string; videoPosterUrl?: string; videoAspectRatio?: number;
  thumbnailPath?: string; thumbnailPaths?: string[];
  title?: string; description?: string; tags?: string[];
  visibility?: 'public' | 'unlisted' | 'private';
}

/** shared_tours/{tourToken}（発行時に確定・以後不変・参加者は初回 get） */
export interface SharedTourMeta {
  tourToken: string;
  hostUid: string;
  snapshot: TourSnapshot[];
  containsHiddenAddress: boolean;
  createdAt: number;
}

/** shared_tours/{tourToken}/live/current（頻繁に変わる・参加者は onSnapshot） */
export interface SharedTourLiveState {
  status: TourStatus;
  currentIndex: number;
  phase: TourPhase;
  viewStartAt: number | null;
  lastActivityAt: number;
}

/** 家件数・スナップショットサイズの上限 */
export const SHARED_TOUR_MAX_STOPS = 100;
```

- [ ] **Step 1: ファイルを作成し上記型を貼る**（純粋な型定義なので単体テスト不要）
- [ ] **Step 2: `npm run build` で型が通ることを確認**
Run: `npm run build` / Expected: EXIT 0
- [ ] **Step 3: Commit**
```bash
git add src/types/sharedTour.ts
git commit -m "feat(shared-tour): 共有ツアー同期の型定義を追加"
```

### Task 1.2: MockListing → TourSnapshot 縮約（純関数 + test）

**Files:**
- Create: `src/lib/sharedTour/snapshot.ts`
- Test: `src/lib/sharedTour/snapshot.test.ts`

**Interfaces:**
- Consumes: `TourSnapshot`（Task 1.1）, `MockListing`（`src/data/housing/mockListings.ts`）
- Produces:
  - `toTourSnapshot(listing: MockListing): TourSnapshot`
  - `buildTourSnapshots(orderedIds: string[], pool: MockListing[]): TourSnapshot[]` — 順序を保ち、pool に無い id は捨てる
  - `snapshotContainsHiddenAddress(snaps: TourSnapshot[]): boolean` — `visibility !== 'public'` を1件でも含めば true

- [ ] **Step 1: 失敗するテストを書く**
```ts
import { describe, it, expect } from 'vitest';
import { toTourSnapshot, buildTourSnapshots, snapshotContainsHiddenAddress } from './snapshot';
import type { MockListing } from '../../data/housing/mockListings';

const base = (over: Partial<MockListing>): MockListing => ({
  id: 'x', ownerUid: 'u', area: 'Mist', ward: 1, buildingType: 'house',
  plot: 1, size: 'M', imageMode: 'none', tags: [], visibility: 'public',
  createdAt: 0, lastConfirmedAt: 0, ...over,
} as MockListing);

describe('toTourSnapshot', () => {
  it('外部URLと住所を写すが ownerUid は落とす', () => {
    const s = toTourSnapshot(base({ id: 'a', sourceImageUrls: ['http://x/1.jpg'], imageMode: 'sns' }));
    expect(s.id).toBe('a');
    expect(s.sourceImageUrls).toEqual(['http://x/1.jpg']);
    expect((s as Record<string, unknown>).ownerUid).toBeUndefined();
  });
});

describe('buildTourSnapshots', () => {
  it('順序を保ち pool に無い id を捨てる', () => {
    const pool = [base({ id: 'a' }), base({ id: 'b' })];
    const out = buildTourSnapshots(['b', 'missing', 'a'], pool);
    expect(out.map(s => s.id)).toEqual(['b', 'a']);
  });
});

describe('snapshotContainsHiddenAddress', () => {
  it('unlisted/private を含むと true', () => {
    expect(snapshotContainsHiddenAddress([{ id: 'a', visibility: 'public' }])).toBe(false);
    expect(snapshotContainsHiddenAddress([{ id: 'a', visibility: 'unlisted' }])).toBe(true);
  });
});
```
- [ ] **Step 2: 失敗を確認**
Run: `npx vitest run src/lib/sharedTour/snapshot.test.ts` / Expected: FAIL（モジュール未定義）
- [ ] **Step 3: 実装**

`toTourSnapshot` は `TourSnapshot` の各フィールドを `listing` から明示コピー（`ownerUid` 等は写さない）。`undefined` のフィールドは **Firestore が undefined を受け付けないので、書き込み前に落とす**（`JSON.parse(JSON.stringify(...))` ではなく、値がある キーだけ入れるヘルパー `omitUndefined` を同ファイルに用意）。`buildTourSnapshots` は `orderedIds.map(id => pool.find(...)).filter(Boolean).map(toTourSnapshot)`。`snapshotContainsHiddenAddress` は `snaps.some(s => s.visibility && s.visibility !== 'public')`。
- [ ] **Step 4: パス確認**
Run: `npx vitest run src/lib/sharedTour/snapshot.test.ts` / Expected: PASS
- [ ] **Step 5: Commit**
```bash
git add src/lib/sharedTour/snapshot.ts src/lib/sharedTour/snapshot.test.ts
git commit -m "feat(shared-tour): MockListing→スナップショット縮約の純関数"
```

### Task 1.3: 寿命判定（純関数 + test）

**Files:**
- Create: `src/lib/sharedTour/lifecycle.ts`
- Test: `src/lib/sharedTour/lifecycle.test.ts`

**Interfaces:**
- Produces:
  - `SHARED_TOUR_IDLE_MS = 2 * 60 * 60 * 1000`（2時間）
  - `isTourExpired(live: Pick<SharedTourLiveState,'status'|'lastActivityAt'>, nowMs: number): boolean` — `status==='ended'` か `now - lastActivityAt > IDLE_MS` で true
  - `shouldGcSharedTour(meta: Pick<SharedTourMeta,'createdAt'>, live: Pick<SharedTourLiveState,'status'|'lastActivityAt'> | null, nowMs: number): boolean` — 物理削除対象判定（`live` 欠落 or `isTourExpired` かつ最終活動から猶予（例 6h）超）

- [ ] **Step 1: 失敗テスト**
```ts
import { describe, it, expect } from 'vitest';
import { isTourExpired, shouldGcSharedTour, SHARED_TOUR_IDLE_MS } from './lifecycle';

describe('isTourExpired', () => {
  it('ended は即 true', () => {
    expect(isTourExpired({ status: 'ended', lastActivityAt: 0 }, 0)).toBe(true);
  });
  it('2時間無操作で true', () => {
    expect(isTourExpired({ status: 'live', lastActivityAt: 0 }, SHARED_TOUR_IDLE_MS + 1)).toBe(true);
    expect(isTourExpired({ status: 'live', lastActivityAt: 0 }, SHARED_TOUR_IDLE_MS - 1)).toBe(false);
  });
});
describe('shouldGcSharedTour', () => {
  it('live doc 欠落は GC 対象', () => {
    expect(shouldGcSharedTour({ createdAt: 0 }, null, 0)).toBe(true);
  });
});
```
- [ ] **Step 2: 失敗確認** → **Step 3: 実装** → **Step 4: パス確認**（コマンドは Task 1.2 と同型）
- [ ] **Step 5: Commit**
```bash
git add src/lib/sharedTour/lifecycle.ts src/lib/sharedTour/lifecycle.test.ts
git commit -m "feat(shared-tour): 寿命/GC判定の純関数"
```

### Task 1.4: create-shared-tour API ハンドラ

**Files:**
- Create: `api/housing/_createSharedTourHandler.ts`
- Create: `api/housing/_sharedTourCreateLogic.ts`（純検証ロジック）
- Create: `api/housing/_sharedTourCreateLogic.test.ts`
- Modify: `api/housing/index.ts`（import + switch に `case 'create-shared-tour'`）

**Interfaces:**
- Produces（クライアントが叩く契約）: `POST /api/housing?action=create-shared-tour`、body `{ snapshot: TourSnapshot[] }`、認証必須。返り `{ tourToken: string }`。
- 純ロジック `parseCreateSharedTourRequest(body: unknown): { ok: true; snapshot: TourSnapshot[]; containsHiddenAddress: boolean } | { ok: false; reason: 'empty' | 'too_many' | 'bad_shape' }` — 件数 `1..SHARED_TOUR_MAX_STOPS`、各要素に `id` があるか等の最小検証。

- [ ] **Step 1: 純ロジックの失敗テスト**
```ts
import { describe, it, expect } from 'vitest';
import { parseCreateSharedTourRequest } from './_sharedTourCreateLogic';

describe('parseCreateSharedTourRequest', () => {
  it('空は reject', () => {
    expect(parseCreateSharedTourRequest({ snapshot: [] })).toMatchObject({ ok: false, reason: 'empty' });
  });
  it('101件は reject', () => {
    const many = Array.from({ length: 101 }, (_, i) => ({ id: `s${i}` }));
    expect(parseCreateSharedTourRequest({ snapshot: many })).toMatchObject({ ok: false, reason: 'too_many' });
  });
  it('正常は containsHiddenAddress を算出', () => {
    const r = parseCreateSharedTourRequest({ snapshot: [{ id: 'a', visibility: 'unlisted' }] });
    expect(r).toMatchObject({ ok: true, containsHiddenAddress: true });
  });
});
```
Note: `_sharedTourCreateLogic.ts` は `snapshotContainsHiddenAddress` を再実装せず、`src/lib/sharedTour/snapshot` から import できない（api/ と src/ の境界。api は src を import しない慣習に従い、判定を api 側にも小さく複製 or 共有可能なら相対 import + `.js`）。**まず既存 api ハンドラが src/ を import しているか確認し、していなければ api 内に最小複製**（DRY より境界優先。理由をコメントに明記）。
- [ ] **Step 2: 失敗確認**
Run: `npx vitest run api/housing/_sharedTourCreateLogic.test.ts` / Expected: FAIL
- [ ] **Step 3: 純ロジック実装** → **Step 4: パス確認**
- [ ] **Step 5: ハンドラ実装**（`_createSharedTourHandler.ts`）

既存 `_registerListingHandler.ts` の冒頭を雛形にする：`setCors` → OPTIONS 早期return → `verifyAppCheck(req,res)`（false なら return）→ `applyRateLimit`（§Task 3.1 で強化）→ `getAuth().verifyIdToken(token)` で `hostUid` 取得（未ログインは401）→ `parseCreateSharedTourRequest(req.body)` → `nanoid()` で `tourToken` → `getAdminFirestore()` で
```
shared_tours/{tourToken} = { tourToken, hostUid, snapshot, containsHiddenAddress, createdAt: Date.now() }
shared_tours/{tourToken}/live/current = { status:'live', currentIndex:0, phase:'moving', viewStartAt:null, lastActivityAt: Date.now() }
```
を batch で作成 → `res.json({ tourToken })`。import は全て `.js` 拡張子（`./_sharedTourCreateLogic.js` 等）。
- [ ] **Step 6: index.ts に配線**

`index.ts:25-42` の import 群に `import { createSharedTourHandler } from './_createSharedTourHandler.js';`、switch（`:58-94`）に `case 'create-shared-tour': return createSharedTourHandler(req, res);`。ヘッダコメントの action 一覧にも追記。
- [ ] **Step 7: build 確認 + Commit**
Run: `npm run build` / Expected: EXIT 0
```bash
git add api/housing/_createSharedTourHandler.ts api/housing/_sharedTourCreateLogic.ts api/housing/_sharedTourCreateLogic.test.ts api/housing/index.ts
git commit -m "feat(shared-tour): 招待発行API(create-shared-tour)を追加"
```

### Task 1.5: Firestore rules

**Files:**
- Modify: `firestore.rules`（`housing_tours` ブロックの後 / 末尾の catch-all の前）

**Interfaces:** クライアント直書きは live サブコレクションのみ・hostUid 限定。メタは Admin のみ。

- [ ] **Step 1: rules を追加**
```
match /shared_tours/{tourToken} {
  allow read: if true;      // 公開読み（tourToken が事実上の鍵・list は許可しない）
  allow write: if false;    // メタは Admin SDK（create-shared-tour API）経由のみ
  match /live/{docId} {
    allow read: if true;
    allow update: if isAuthenticated()
      && get(/databases/$(database)/documents/shared_tours/$(tourToken)).data.hostUid == request.auth.uid
      && request.resource.data.status in ['live','ended']
      && request.resource.data.currentIndex is int
      && request.resource.data.phase in ['moving','viewing']
      && request.resource.data.lastActivityAt is int;
    allow create, delete: if false; // 生成/削除は Admin（create-shared-tour / GC cron）
  }
}
```
（`isAuthenticated` は `firestore.rules:10-22` の既存ヘルパー。`get(...)` で親 doc の hostUid を照合。）
- [ ] **Step 2: 構文チェック**
Run: `firebase deploy --only firestore:rules --dry-run`（可能なら）/ 少なくとも `firebase firestore:rules` の lint。**rules ユニットテスト基盤は無いので、実挙動は Phase 4 の統合スパイクで検証**（Global Constraints）。
- [ ] **Step 3: Commit**（デプロイはユーザーゲート・ここでは commit のみ）
```bash
git add firestore.rules
git commit -m "feat(shared-tour): shared_tours の Firestore ルール（公開読み+hostUid書き）"
```

### Task 1.6: クライアント発行 API 関数

**Files:**
- Modify: `src/lib/housingApiClient.ts`（末尾に関数追加）

**Interfaces:**
- Produces: `createSharedTour(snapshot: TourSnapshot[]): Promise<{ tourToken: string }>` — `buildHousingHeaders(true)`（ログイン必須・App Check 付与）で `POST /api/housing?action=create-shared-tour`。

- [ ] **Step 1: 既存 `registerListing`（`:41` 付近）を雛形に関数を追加**。エラーは既存の投げ方に合わせる。
- [ ] **Step 2: build 確認**
Run: `npm run build` / Expected: EXIT 0
- [ ] **Step 3: Commit**
```bash
git add src/lib/housingApiClient.ts
git commit -m "feat(shared-tour): クライアントの招待発行API関数"
```

### Task 1.7: 幹事の live state 直書き

**Files:**
- Create: `src/lib/sharedTour/hostSync.ts`

**Interfaces:**
- Consumes: `db`（`src/lib/firebase.ts`）, `SharedTourLiveState`
- Produces:
  - `pushHostState(tourToken: string, patch: Pick<SharedTourLiveState,'currentIndex'|'phase'|'viewStartAt'>): Promise<void>` — `updateDoc(doc(db,'shared_tours',tourToken,'live','current'), { ...patch, lastActivityAt: Date.now() })`
  - `endHostTour(tourToken: string): Promise<void>` — `updateDoc(..., { status:'ended', lastActivityAt: Date.now() })`

- [ ] **Step 1: 実装**（薄いラッパ。純ロジックが無いので単体テストは付けず、Phase 4 の実機で検証。関数境界を小さく保つ）
- [ ] **Step 2: build 確認 + Commit**
```bash
git add src/lib/sharedTour/hostSync.ts
git commit -m "feat(shared-tour): 幹事のライブstate直書き"
```

### Task 1.8: 参加者フック（本線 = 匿名 onSnapshot 直読み。Phase 0 が (a) の場合）

**Files:**
- Create: `src/lib/sharedTour/useJoinTour.ts`

**Interfaces:**
- Consumes: `db`, `SharedTourMeta`, `SharedTourLiveState`, `isTourExpired`（Task 1.3）
- Produces: `useJoinTour(tourToken: string): { kind: 'connecting'|'notfound'|'ended'|'viewing'; meta: SharedTourMeta | null; live: SharedTourLiveState | null }`

- [ ] **Step 1: 実装**

`useEffect`：`getDoc(doc(db,'shared_tours',tourToken))` → 無ければ `kind='notfound'`。あれば `meta` を保持し `onSnapshot(doc(db,'shared_tours',tourToken,'live','current'))` を購読。snapshot ごとに `isTourExpired(live, Date.now())` を評価し true なら `kind='ended'`、それ以外は `kind='viewing'`。`return () => unsub()`。persistentLocalCache のため `snap.metadata.fromCache` が true の初回は `connecting` を維持し、サーバー到達後に確定（Global Constraints）。
- [ ] **Step 2: build 確認 + Commit**
```bash
git add src/lib/sharedTour/useJoinTour.ts
git commit -m "feat(shared-tour): 参加者の購読フック（匿名onSnapshot直読み）"
```

> **Phase 0 が (b) の場合は Task 1.8 を「参加者フック-ALT」に差し替える**（末尾）。

---

## Phase 2: UI

### Task 2.1: 幹事「みんなを招待」+ 招待リンク + 終了

**Files:**
- Modify: `src/components/housing/pages/TourNavPage.tsx`（招待発行の state・配線）
- Create: `src/components/housing/tour/TourInvitePanel.tsx`（招待ボタン/リンク表示/終了ボタンの表示部品）

**Interfaces:**
- Consumes: `createSharedTour`（1.6）, `pushHostState`/`endHostTour`（1.7）, `buildTourSnapshots`/`snapshotContainsHiddenAddress`（1.2）, `useHousingTourStore`（`listingIds`/`currentIndex`/`phase`/`viewStartAt` と pool）

- [ ] **Step 1: TourInvitePanel（表示専用）を作る**。props: `tourToken: string|null`, `onInvite: ()=>void`, `onCopy: ()=>void`, `onEnd: ()=>void`, `inviteWarning: string|null`。未発行時は「みんなを招待」ボタン + 一言案内「招待した後は家を足せないので、見せたい家は始める前に組んでください」。発行後は短縮リンク（`${location.origin}/housing/tour/${tourToken}`）+ コピー + 「ツアー終了」。
- [ ] **Step 2: TourNavPage に配線**。`tourToken` を `useState`。`onInvite`：`buildTourSnapshots(listingIds, pool)` → `snapshotContainsHiddenAddress` が true なら Task 2.2 の警告を挟む → `createSharedTour(snaps)` → `tourToken` 保持 + `localStorage.setItem('lopo_shared_tour_token', token)`。既存の `next`/`prev`/`startViewing` 呼び出し直後に `tourToken` があれば `pushHostState(token, { currentIndex, phase, viewStartAt })` を呼ぶ（ストアの購読値を渡す。ストア自体は変更しない）。`onEnd`：`endHostTour(token)` + token クリア。
- [ ] **Step 3: build + 手動確認（ローカル）**。`npm run dev` で発行ボタン→リンク生成→操作でエラーが出ないこと（同期の実確認は Phase 4）。
- [ ] **Step 4: Commit**
```bash
git add src/components/housing/pages/TourNavPage.tsx src/components/housing/tour/TourInvitePanel.tsx
git commit -m "feat(shared-tour): 幹事の招待ボタン/リンク/終了UI"
```

### Task 2.2: 住所露出警告（C案）

**Files:**
- Create: `src/components/housing/tour/TourAddressExposureDialog.tsx`
- Modify: `src/components/housing/pages/TourNavPage.tsx`（onInvite の前段に挟む）

**Interfaces:** `snapshotContainsHiddenAddress` が true のとき発行前にダイアログ。「この住所は参加者全員に見えます」＋一時追加が含まれるなら「持ち主の許可を取ってから追加してください」。`続行 / やめる`。ハウジングのトンマナ（[[feedback_housing_no_ai_pills]]・honey/汎用ピル禁止・[root直下モーダルは --housing-* トークン付与 [[reference_housing_root_modal_tokens]]]）に従う。

- [ ] **Step 1: ダイアログ部品を作る**（既存 housing モーダルの作法を踏襲・トークン付与）
- [ ] **Step 2: onInvite に配線**（続行で `createSharedTour` へ、やめるで中断）
- [ ] **Step 3: build + Commit**
```bash
git add src/components/housing/tour/TourAddressExposureDialog.tsx src/components/housing/pages/TourNavPage.tsx
git commit -m "feat(shared-tour): 住所露出警告ダイアログ(C案)"
```

### Task 2.3: 参加者ページ + ルート

**Files:**
- Create: `src/components/housing/pages/JoinTourPage.tsx`
- Modify: `src/App.tsx`（lazy ルート `/housing/tour/:tourToken`）

**Interfaces:** `useJoinTour(tourToken)`（1.8）の `kind` で分岐表示。`connecting`→スピナー、`notfound`→「このツアーは見つかりません」、`ended`→「このツアーは終了しました」、`viewing`→Task 2.4 の閲覧専用描画。文言は collab の JoinerNotice 作法・i18n（`src/i18n` の housing 名前空間に4言語 parity・[[feedback_locale_json_textual_edit]] で該当ブロックのみ追記）。

- [ ] **Step 1: JoinTourPage を作る**（view-kind 分岐）
- [ ] **Step 2: App.tsx にルート追加**（既存 `/collab/:roomToken` の lazy 定義に倣う・`:92` 付近）
- [ ] **Step 3: build + Commit**
```bash
git add src/components/housing/pages/JoinTourPage.tsx src/App.tsx src/i18n/*
git commit -m "feat(shared-tour): 参加者ページとルート"
```

### Task 2.4: 参加者の閲覧専用ツアー描画

**Files:**
- Modify: `src/components/housing/pages/JoinTourPage.tsx`（viewing 時の描画）
- 必要なら Modify: `src/components/housing/tour/TourProgressPanel.tsx`（`readOnly` prop で3ボタンを非表示）

**Interfaces:** `meta.snapshot` を既存ツアー描画の pool 相当に流し込み、`live.currentIndex`/`phase`/`viewStartAt` を適用。操作ボタンは非表示、「幹事が案内中」表示。既存 `TourShowcasePanel`/`TourNavMap`/`TourPhaseZone` を再利用（これらは表示専用なので props に snapshot 由来の値を渡すだけ）。`useElapsed(live.viewStartAt)` で見学経過。

- [ ] **Step 1: viewing 描画を実装**。`TourProgressPanel` に `readOnly?: boolean` を足し、true のとき3ボタン群を「幹事が案内中」テキストに置換（既存 props はそのまま）。
- [ ] **Step 2: build + 手動確認** → **Step 3: Commit**
```bash
git add src/components/housing/pages/JoinTourPage.tsx src/components/housing/tour/TourProgressPanel.tsx
git commit -m "feat(shared-tour): 参加者の閲覧専用描画"
```

---

## Phase 3: 寿命 + 悪用対策

### Task 3.1: 悪用ガード（発行ハンドラ強化）

**Files:**
- Modify: `api/housing/_createSharedTourHandler.ts`
- Modify: `api/housing/_sharedTourCreateLogic.ts`（サイズ検証は既存・ここでは同時数）

**Interfaces:** 発行時に (1) `applyRateLimit`（既存 `src/lib/rateLimit.js` の作法）で ip/uid 単位の連打抑制、(2) `where('hostUid','==',uid)` で当該ユーザーの既存 live ツアー数を数え、上限（例1件）を超えるなら**古いものを ended にしてから**新規発行（or 拒否）、(3) snapshot の総バイト目安が Firestore 1MiB に収まるガード（件数上限に加え、`JSON.stringify(snapshot).length` の粗チェック）。

- [ ] **Step 1: 同時数判定の純ロジック test**（`resolveHostQuota(existingLiveCount, max): 'ok'|'evict'|'reject'` を `_sharedTourCreateLogic.ts` に足して単体テスト）
- [ ] **Step 2: ハンドラに配線**（rate limit → quota → サイズ）。具体閾値は `docs/.private/2026-07-15-shared-tour-hardening.md` に記録（公開 spec に穴の地図を書かない・[[project_housing_scale_hardening]]）。
- [ ] **Step 3: build + vitest + Commit**
```bash
git add api/housing/_createSharedTourHandler.ts api/housing/_sharedTourCreateLogic.ts api/housing/_sharedTourCreateLogic.test.ts
git commit -m "feat(shared-tour): 発行の悪用ガード(rate/同時数/サイズ)"
```

### Task 3.2: GC cron（物理削除）

**Files:**
- Create: `api/housing/_gcSharedToursHandler.ts`
- Create: `api/housing/_gcSharedToursLogic.ts` + `._test.ts`（`shouldGcSharedTour` を api 側に再利用 or 複製）
- Modify: `api/housing/index.ts`（`case 'gc-shared-tours'`）
- Modify: `vercel.json`（`crons` に1エントリ）

**Interfaces:** `GET /api/housing?action=gc-shared-tours`、cron 専用。CRON_SECRET チェック（fail-closed・既存 `check-sns-tweets` パターン）→ `shared_tours` を batch（上限 例 300 件/回）で走査 → `shouldGcSharedTour` が true のものをサブコレクションごと Admin SDK で削除。

- [ ] **Step 1: GC 判定 test**（Task 1.3 の `shouldGcSharedTour` を流用。api 境界で複製する場合は同じ振る舞いの test を api 側にも）
- [ ] **Step 2: ハンドラ実装**（CRON_SECRET → 走査 → 削除・バッチ上限。10秒タイムアウト厳守）
- [ ] **Step 3: index.ts に case 追加 + vercel.json crons に追加**
```json
{ "path": "/api/housing?action=gc-shared-tours", "schedule": "30 * * * *" }
```
- [ ] **Step 4: build + vitest + Commit**（CRON_SECRET は既存流用・新規 env 不要）
```bash
git add api/housing/_gcSharedToursHandler.ts api/housing/_gcSharedToursLogic.ts api/housing/_gcSharedToursLogic.test.ts api/housing/index.ts vercel.json
git commit -m "feat(shared-tour): 期限切れツアーのGC cron"
```

---

## Phase 4: 統合・実機

### Task 4.1: 実機通しチェックリスト（ユーザーと実施）

**Files:** なし（検証のみ）。[[feedback_endpoint_user_verification]] / [[feedback_no_screenshots_local_verify]]（目視はユーザーに振る）。

- [ ] **Step 1: rules を本番/ステージングに反映**（`firebase deploy --only firestore:rules`・ユーザー承認後）
- [ ] **Step 2: 通しシナリオ**（2タブは両方最新版リロード・[[reference_collab_two_client_version_skew]]）
  - 幹事（ログイン）でツアー開始 → 「みんなを招待」→ リンク発行
  - 別ブラウザ（未ログイン・シークレット）でリンクを開く → 今の位置に合流して見える（★Phase 0 (a)/(b) どちらでも動くこと）
  - 幹事が次へ/見学 → 参加者画面が同期して動く・見学タイマーが両方で進む
  - 非公開/一時追加を含めて発行 → 警告が出る
  - 幹事「ツアー終了」→ 参加者に「終了しました」
  - リンクを2時間放置想定（lastActivityAt を過去にした doc で）→ 参加者に「終了しました」
- [ ] **Step 3: 結果をユーザーに報告 → OK が出たら main へマージ判断**（`finishing-a-development-branch`）

---

## 代替タスク群（Phase 0 が (b) = 匿名 onSnapshot 不可 の場合のみ）

### Task 1.8-ALT: 参加者フック（公開窓口ポーリング）

- `api/housing/index.ts` の `PUBLIC_WINDOW_ACTIONS` に `'shared-tour-state'` を追加（verifyAppCheck 前 return）。`_publicWindow.ts` に `shared-tour-state` を足し、`shared_tours/{token}/live/current` を Admin SDK で読んで返す。`Cache-Control: s-maxage=2, stale-while-revalidate=2`（数秒粒度・[[reference_vercel_cf_window_caching]]）。
- `useJoinTour` は onSnapshot の代わりに `setInterval` で `GET /api/housing?action=shared-tour-state&token=...` を 2〜3秒ポーリング。`isTourExpired` 判定は同じ。meta は同様に公開窓口 `action=shared-tour-meta`（初回1回）で取得。
- リアルタイム性は数秒粒度に落ちるがツアー用途では許容。書き込み側（幹事）は Task 1.7 のまま（幹事はログイン済で App Check 通る → Firestore 直書き可）。

---

## Self-Review（この計画 vs spec）

- **spec §3 体験** → Task 2.1/2.2/2.3/2.4（幹事招待・警告・参加者ページ・閲覧専用）で網羅。
- **spec §5 データモデル** → Task 1.1（型）/ 1.4（doc 生成）/ 1.5（rules）。
- **spec §6 スナップショット** → Task 1.2。
- **spec §7 書き込み経路** → Task 1.4（発行API）/ 1.7（幹事直書き）。
- **spec §8 読み取り + rules** → Task 1.5 / 1.8（+ALT）。
- **spec §9 悪用対策** → Task 3.1。
- **spec §10 寿命/GC** → Task 1.3（判定）/ 3.2（cron）/ 2.3（ended 表示）。
- **spec §11 UI** → Phase 2 全体。
- **spec §12 R1（App Check）** → Phase 0 + 代替タスク群。**R2 時計ズレ** → 既存 useElapsed 流用（新規作業なし・許容明記）。**R3 関数枠** → Global Constraints + 全 API タスクが index.ts 集約。**R4 1MiB** → Task 3.1 のサイズガード。
- **spec §13 テスト** → 純関数 test（1.2/1.3/1.4/3.1/3.2）+ 統合スパイク（Phase 4）+ rules は手動（基盤無し明記）。
- 型整合: `TourSnapshot`/`SharedTourLiveState`/`tourToken` は全タスクで同名。`pushHostState`/`endHostTour`/`createSharedTour`/`useJoinTour`/`buildTourSnapshots` のシグネチャは定義タスクと消費タスクで一致。
