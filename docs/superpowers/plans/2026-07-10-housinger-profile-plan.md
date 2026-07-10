# ハウジンガープロフィール 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development または superpowers:executing-plans でタスク単位に実行。チェックボックスで進捗管理。
>
> spec = `docs/superpowers/specs/2026-07-10-housinger-profile-design.md` (承認済み・本計画の正)。
> コード断片はすべて 2026-07-10 時点の main を採取済み。行番号は目安 — ずれていたら周辺を読んで合わせる。

**Goal:** 登録者(ハウジンガー)が任意で名乗れる公開プロフィール + 専用ページ + 個人タグ一体化。

**Architecture:** 公開プロフィール中央方式。`housing_profiles/{uid}` (公開read/サーバーwrite) を新設し、名前・アイコンは既存 `users/{uid}` から**サーバーが転記**する。個人タグ (`personal_tags`) は同じサーバー処理が一括更新し、名前の源泉は常に 1 箇所。

**Tech Stack:** React + zustand + Firestore (client read) + Vercel Node Functions (api/housing) + vitest。

## Global Constraints (全タスク共通)

- 会話・コメント・ドキュメントは日本語。**push 禁止** (コミットまで)。`docs/TODO.md` 編集禁止。
- ブランチ: `feat/housinger-profile`。タスク単位でコミット (`feat(housing): …` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`)。
- ハウジング UI 編集前に `.claude/rules/housing-design.md` を読む。装飾999pxピル/色付きalert箱/過剰glow禁止。
- 新規 UI 文言は「ハウジング」統一 (「物件」禁止)。呼称は「ハウジンガー」。
- ロケール JSON は該当ブロックのみ textual 編集。**ja/en/ko/zh 4言語 parity**。
- api/ の相対 import は `.js` 拡張子必須 (無いと本番500)。erasableSyntaxOnly (enum/パラメータプロパティ禁止)。
- クライアントの API 呼び出しは `buildHousingHeaders` 必須 (`src/lib/housingAuthHeaders.ts:14`)。
- 検証は `npm run build` + `npx vitest run` (出力をパイプしない)。
- Firestore シード/本番接続スクリプトは書いても**実行しない** (親セッションが差配)。

## ⚠ 実行前提 (順序制約)

1. **3 ブランチ (`feat/housing-register-improvements` / `feat/housing-tag-overhaul` / `feat/housing-ui-small-batch`) が main にマージされた後に着手する。** RegisterPage と TagPicker が本計画の変更対象と重なるため。
2. Task 8 (個人タグ接続) はタグ刷新 Phase B の**実装結果を読んでから**着手 (契約は Task 8 に明記。ファイル名が計画と違う場合は実装を正とする)。

---

## Task 1: 型・定数・検証の純関数

**Files:**
- Modify: `src/types/housing.ts` (末尾に追加)
- Create: `src/lib/housing/housingerProfile.ts`
- Test: `src/lib/housing/__tests__/housingerProfile.test.ts`

**Interfaces (Produces):** `HousingerProfile` 型 / `HOUSINGER_BIO_MAX_LENGTH` / `HOUSINGER_SNS_ALLOWED_HOSTS` / `validateHousingerSnsUrl(url: string): { ok: true } | { ok: false; error: 'invalid_url' | 'not_https' | 'host_not_allowed' }` / `personalTagIdForUid(uid: string): string` / `HOUSINGER_REPORT_REASONS` + `HousingerReportReason` + `isValidHousingerReportReason(v: unknown): v is HousingerReportReason`

- [ ] **Step 1: 失敗するテストを書く** (`housingerProfile.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import {
  validateHousingerSnsUrl,
  personalTagIdForUid,
  isValidHousingerReportReason,
  HOUSINGER_SNS_ALLOWED_HOSTS,
} from '../housingerProfile';

describe('validateHousingerSnsUrl', () => {
  it('許可ホスト (x.com) は ok', () => {
    expect(validateHousingerSnsUrl('https://x.com/lopo_ff14')).toEqual({ ok: true });
  });
  it('twitter.com / youtube.com / youtu.be / Lodestone (jp/na/eu) も ok', () => {
    for (const u of [
      'https://twitter.com/a',
      'https://www.youtube.com/@a',
      'https://youtu.be/abc',
      'https://jp.finalfantasyxiv.com/lodestone/character/12345/',
      'https://na.finalfantasyxiv.com/lodestone/character/12345/',
      'https://eu.finalfantasyxiv.com/lodestone/character/12345/',
    ]) expect(validateHousingerSnsUrl(u).ok, u).toBe(true);
  });
  it('http は not_https', () => {
    expect(validateHousingerSnsUrl('http://x.com/a')).toEqual({ ok: false, error: 'not_https' });
  });
  it('リスト外ホストは host_not_allowed (サブドメイン偽装 evil-x.com も拒否)', () => {
    expect(validateHousingerSnsUrl('https://evil.example.com/a').ok).toBe(false);
    expect(validateHousingerSnsUrl('https://evil-x.com/a').ok).toBe(false);
    expect(validateHousingerSnsUrl('https://x.com.evil.com/a').ok).toBe(false);
  });
  it('URL として不正なら invalid_url', () => {
    expect(validateHousingerSnsUrl('not a url')).toEqual({ ok: false, error: 'invalid_url' });
  });
});

describe('personalTagIdForUid', () => {
  it('hashed: prefix を剥がして personal_ を付ける (改名しても不変な決定的 ID)', () => {
    expect(personalTagIdForUid('hashed:abc123')).toBe('personal_abc123');
  });
  it('prefix なし uid はそのまま', () => {
    expect(personalTagIdForUid('abc123')).toBe('personal_abc123');
  });
});

describe('isValidHousingerReportReason', () => {
  it('定義済み4種のみ true', () => {
    expect(isValidHousingerReportReason('impersonation')).toBe(true);
    expect(isValidHousingerReportReason('nsfw')).toBe(false);
  });
});
```

- [ ] **Step 2: `npx vitest run src/lib/housing/__tests__/housingerProfile.test.ts` → FAIL を確認**

- [ ] **Step 3: 実装** (`src/lib/housing/housingerProfile.ts`)

```ts
/**
 * ハウジンガープロフィール (spec 2026-07-10-housinger-profile-design.md)
 * クライアント・サーバー (api/housing) 両方から import される純関数と定数。
 */

/** ひとこと自己紹介の最大文字数 (spec §3.1) */
export const HOUSINGER_BIO_MAX_LENGTH = 100;

/** SNS リンク許可ホスト (spec §6.1)。拡張はここに 1 行足すだけ。 */
export const HOUSINGER_SNS_ALLOWED_HOSTS = [
  'x.com', 'www.x.com',
  'twitter.com', 'www.twitter.com',
  'youtube.com', 'www.youtube.com', 'youtu.be',
  'jp.finalfantasyxiv.com', 'na.finalfantasyxiv.com', 'eu.finalfantasyxiv.com',
] as const;

export type SnsUrlValidation =
  | { ok: true }
  | { ok: false; error: 'invalid_url' | 'not_https' | 'host_not_allowed' };

export function validateHousingerSnsUrl(url: string): SnsUrlValidation {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'not_https' };
  // ホストは完全一致のみ (evil-x.com / x.com.evil.com を弾く)
  if (!(HOUSINGER_SNS_ALLOWED_HOSTS as readonly string[]).includes(parsed.hostname)) {
    return { ok: false, error: 'host_not_allowed' };
  }
  return { ok: true };
}

/**
 * 個人タグ ID を uid から決定的に導出 (spec §3.3。名前由来スラッグ禁止 = 改名で不変)。
 * uid は 'hashed:<hex>' 形式 (api/_lib/hashUid.ts)。prefix を剥いで使う。
 */
export function personalTagIdForUid(uid: string): string {
  return `personal_${uid.replace(/^hashed:/, '')}`;
}

/** プロフィール通報理由 (spec §6.2)。listing の REPORT_REASONS とは独立。 */
export const HOUSINGER_REPORT_REASONS = [
  'inappropriate_name', 'inappropriate_avatar', 'impersonation', 'other',
] as const;
export type HousingerReportReason = typeof HOUSINGER_REPORT_REASONS[number];
export function isValidHousingerReportReason(v: unknown): v is HousingerReportReason {
  return typeof v === 'string' && (HOUSINGER_REPORT_REASONS as readonly string[]).includes(v);
}
```

- [ ] **Step 4: `src/types/housing.ts` 末尾 (HousingReport の後) に型追加**

```ts
/**
 * housing_profiles/{uid} - ハウジンガー公開プロフィール (spec 2026-07-10)
 * read: 公開 (isPublished && !isModerationHidden) or 本人 / write: API (Admin SDK) のみ
 */
export interface HousingerProfile {
  displayName: string;            // users/{uid}.displayName のサーバー転記コピー
  avatarUrl: string | null;       // users/{uid}.avatarUrl の同上
  bio: string | null;             // ひとこと (HOUSINGER_BIO_MAX_LENGTH)
  snsUrl: string | null;          // 許可ホストのみ (validateHousingerSnsUrl)
  isPublished: boolean;
  isModerationHidden: boolean;    // 運営強制非公開。true なら公開扱いにしない
  reportCount: number;
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Step 5: テスト PASS 確認 → コミット** `feat(housing): ハウジンガーPFの型・SNS許可リスト・個人タグID導出`

---

## Task 2: Firestore ルールと複合インデックス

**Files:**
- Modify: `firestore.rules` (housing_user_meta ブロック `:439-442` の後に追加)
- Modify: `firestore.indexes.json` (housing_listings のインデックス群 `:12-44` に 1 本追加)

- [ ] **Step 1: `firestore.rules` に追加**

```
    // ハウジンガー公開プロフィール (spec 2026-07-10-housinger-profile-design.md)
    // 書き込みは API (Admin SDK) のみ。公開条件を満たすか本人のみ読める。
    match /housing_profiles/{uid} {
      allow get, list: if (resource.data.isPublished == true
                           && resource.data.isModerationHidden == false)
                       || isOwner(uid);
      allow write: if false;

      // プロフィール通報 (API 経由のみ。読みは管理者)
      match /reports/{reportId} {
        allow read: if request.auth != null && request.auth.token.admin == true;
        allow write: if false;
      }
    }
```

- [ ] **Step 2: `firestore.indexes.json` にハウジンガーページ用一覧クエリの複合インデックス追加** (漏れると本番で沈黙する — memory reference_firestore_composite_index)

```json
    {
      "collectionGroup": "housing_listings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "ownerUid", "order": "ASCENDING" },
        { "fieldPath": "visibility", "order": "ASCENDING" },
        { "fieldPath": "isHidden", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
```

- [ ] **Step 3: コミット** `feat(housing): housing_profiles ルールとハウジンガー一覧の複合インデックス` (デプロイは親セッションが差配。`firebase deploy --only firestore` は実行しない)

---

## Task 3: API — プロフィール upsert (公開/更新/非公開/同期を 1 本で)

**Files:**
- Create: `api/housing/_upsertHousingerProfileHandler.ts`
- Modify: `api/housing/index.ts` (import / switch case / default エラー文言の 3 箇所。`:1-68` 参照)
- Test: `api/housing/__tests__/upsertHousingerProfile.test.ts`

**Interfaces (Produces):** `POST /api/housing?action=upsert-housinger-profile`。Body = `{ isPublished?: boolean; bio?: string | null; snsUrl?: string | null }` (**名前とアイコンは body で受けない** = サーバーが `users/{uid}` から読む。改ざん不可)。Response 200 = `{ success: true, profile: HousingerProfile }`。エラー = 400 `invalid_bio` / `invalid_sns_url` / 400 `name_required` (users.displayName 空で公開しようとした) / 401 / 500。

**設計 (spec §3.2/§3.3):** ハンドラは常に「users/{uid} の現在値を読んで housing_profiles/{uid} へ転記 + personal_tags/{personalTagIdForUid(uid)} を同一トランザクションで upsert」する。body の isPublished/bio/snsUrl は差分指定 (undefined = 現状維持)。これ 1 本が publish / unpublish / bio・SNS 更新 / 名前・アイコン変更後の同期のすべてを兼ねる (冪等)。

- [ ] **Step 1: 純関数を切り出す前提で失敗するテストを書く**

ハンドラ内の入力検証を `export function validateUpsertBody(body: any)` として export し、テストする (checkDuplicatePrivate.test.ts:1-17 と同じ「ハンドラから export した純関数を直接テスト」方式):

```ts
import { describe, it, expect } from 'vitest';
import { validateUpsertBody } from '../_upsertHousingerProfileHandler.js';

describe('validateUpsertBody', () => {
  it('空 body は ok (全て現状維持 = 同期呼び出し)', () => {
    expect(validateUpsertBody({}).ok).toBe(true);
  });
  it('bio 100 文字以内 ok / 101 文字 invalid_bio', () => {
    expect(validateUpsertBody({ bio: 'あ'.repeat(100) }).ok).toBe(true);
    expect(validateUpsertBody({ bio: 'あ'.repeat(101) })).toEqual({ ok: false, error: 'invalid_bio' });
  });
  it('snsUrl はホワイトリスト検証 (リスト外 = invalid_sns_url)', () => {
    expect(validateUpsertBody({ snsUrl: 'https://x.com/a' }).ok).toBe(true);
    expect(validateUpsertBody({ snsUrl: 'https://evil.com/a' })).toEqual({ ok: false, error: 'invalid_sns_url' });
  });
  it('null は「消す」指定として ok', () => {
    expect(validateUpsertBody({ bio: null, snsUrl: null }).ok).toBe(true);
  });
  it('isPublished は boolean 以外拒否', () => {
    expect(validateUpsertBody({ isPublished: 'yes' }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: FAIL 確認 → ハンドラ実装**

`_confirmListingHandler.ts:1-85` の定型 (setCors → OPTIONS/method → verifyAppCheck → applyRateLimit(20/60_000) → verifyIdToken → transaction → error.message 分岐) をそのまま踏襲し、コア部分:

```ts
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import {
  HOUSINGER_BIO_MAX_LENGTH,
  validateHousingerSnsUrl,
  personalTagIdForUid,
} from '../../src/lib/housing/housingerProfile.js';

export function validateUpsertBody(body: any):
  | { ok: true; isPublished?: boolean; bio?: string | null; snsUrl?: string | null }
  | { ok: false; error: 'invalid_bio' | 'invalid_sns_url' | 'invalid_body' } {
  const { isPublished, bio, snsUrl } = body || {};
  if (isPublished !== undefined && typeof isPublished !== 'boolean') {
    return { ok: false, error: 'invalid_body' };
  }
  if (bio !== undefined && bio !== null) {
    if (typeof bio !== 'string' || bio.length > HOUSINGER_BIO_MAX_LENGTH) {
      return { ok: false, error: 'invalid_bio' };
    }
  }
  if (snsUrl !== undefined && snsUrl !== null) {
    if (typeof snsUrl !== 'string' || !validateHousingerSnsUrl(snsUrl).ok) {
      return { ok: false, error: 'invalid_sns_url' };
    }
  }
  return { ok: true, isPublished, bio, snsUrl };
}
```

トランザクション本体 (uid = verifyIdToken 済):

```ts
    const adminDb = getAdminFirestore();
    const userRef = adminDb.collection('users').doc(uid);
    const profileRef = adminDb.collection('housing_profiles').doc(uid);
    const tagRef = adminDb.collection('personal_tags').doc(personalTagIdForUid(uid));

    const v = validateUpsertBody(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });

    let resultProfile: any = null;
    await adminDb.runTransaction(async (tx) => {
      const [userSnap, profileSnap, tagSnap] = await Promise.all([
        tx.get(userRef), tx.get(profileRef), tx.get(tagRef),
      ]);
      if (!userSnap.exists) throw new Error('user_not_found');
      const userData = userSnap.data()!;
      const prev = profileSnap.exists ? profileSnap.data()! : null;

      const displayName = (userData.displayName || '').trim();
      const nextPublished = v.isPublished ?? prev?.isPublished ?? false;
      if (nextPublished && !displayName) throw new Error('name_required');

      const now = Date.now();
      const next = {
        displayName,
        avatarUrl: userData.avatarUrl ?? null,
        bio: v.bio !== undefined ? v.bio : prev?.bio ?? null,
        snsUrl: v.snsUrl !== undefined ? v.snsUrl : prev?.snsUrl ?? null,
        isPublished: nextPublished,
        isModerationHidden: prev?.isModerationHidden ?? false,
        reportCount: prev?.reportCount ?? 0,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      tx.set(profileRef, next);
      // 個人タグは同一 tx で一括転記 (spec §3.3: 名前の源泉はプロフィール 1 箇所)
      // ⚠ reportCount は既存値を必ず保持する (0 で上書きすると通報を握りつぶす)
      const prevTag = tagSnap.exists ? tagSnap.data()! : null;
      tx.set(tagRef, {
        id: personalTagIdForUid(uid),
        displayName,
        ownerUid: uid,
        createdAt: prevTag?.createdAt ?? now,
        reportCount: prevTag?.reportCount ?? 0,
        isHidden: !(next.isPublished && !next.isModerationHidden),
      }, { merge: true });
      resultProfile = next;
    });
    return res.status(200).json({ success: true, profile: resultProfile });
```

エラー分岐: `user_not_found` → 404、`name_required` → 400 `{ error: 'name_required' }`。

- [ ] **Step 3: `api/housing/index.ts` に action `upsert-housinger-profile` を配線** (import + case + default 文言末尾に `|upsert-housinger-profile` 追記)

- [ ] **Step 4: テスト PASS + `npm run build` → コミット** `feat(housing): ハウジンガープロフィール upsert API (公開/更新/同期を冪等1本化)`

---

## Task 4: API — プロフィール通報 + /admin 対応

**Files:**
- Create: `api/housing/_reportHousingerHandler.ts`
- Modify: `api/housing/index.ts` (action `report-housinger` 配線)
- Create: `api/admin/_housingerReportsHandler.ts`
- Modify: `api/admin/index.ts` (resource `housinger_reports` 配線。既存の resource 分岐 (`_housingReportsHandler` = `resource=housing_reports`) を読んで同じ形で足す)
- Create: `src/components/admin/AdminHousingerReports.tsx` (+ 管理画面のルート/ナビに追加。`AdminHousingReports.tsx` の登録箇所を grep して同じ場所に足す)
- Test: `api/housing/__tests__/reportHousinger.test.ts`

**Interfaces (Produces):**
- `POST /api/housing?action=report-housinger`。Body = `{ housingerUid: string; reason: HousingerReportReason; comment?: string }`。`reason==='other'` は comment 必須。保存先 = `housing_profiles/{housingerUid}/reports/{auto}` = `{ reporterUid, reason, comment?, createdAt }` + `reportCount` インクリメント (transaction)。同一 reporter+reason は 409 `duplicate_report`。自己通報は 403 `cannot_report_own`。**自動非表示はしない・被通報者への通知もしない** (spec §6.2: v1 は人の目で判断)。
- `GET /api/admin?resource=housinger_reports` = `reportCount > 0` のプロフィール一覧 (reports 最新20件同梱、reporterUid は返さない — `_housingReportsHandler.ts:63` と同方針)。
- `PATCH ?resource=housinger_reports&action=hide&uid=…` = `isModerationHidden: true` + `personal_tags/{personalTagIdForUid(uid)}.isHidden: true` を同一 tx で。
- `PATCH …&action=restore&uid=…` = 上記の逆 (isModerationHidden: false、タグは `isPublished && !isModerationHidden` で再計算)。
- `PATCH …&action=dismiss-one&uid=…&reportId=…` = report doc 削除 + reportCount-1 (`_housingReportsHandler.ts:123-175` の transaction 形を踏襲。通知連動削除は不要 = 通知を作っていないため)。

- [ ] **Step 1: 検証純関数のテスト** (`reason` ガード + other時comment必須 + housingerUid 必須) → FAIL 確認
- [ ] **Step 2: `_reportListingHandler.ts` の形 (重複チェック→transaction) を踏襲して実装**
- [ ] **Step 3: admin ハンドラ実装 + `AdminHousingerReports.tsx`** — `AdminHousingReports.tsx:57-122` の形 (apiFetch / confirm / showToast / fetchData 再読込) をそのまま踏襲。表示列 = アイコン・名前・ひとこと・SNS URL・通報一覧・[強制非公開] [復帰] [通報却下]。admin 文言は `admin.housinger_reports.*` (admin 画面は既存トンマナ = housing ルール対象外)
- [ ] **Step 4: テスト PASS + `npm run build` → コミット** `feat(housing): ハウジンガープロフィール通報 + /admin 強制非公開` (運営作業が /admin で完結すること — Firestore 直叩き禁止)

---

## Task 5: クライアントデータ層 (取得/キャッシュ/upsert 呼び出し + 変更追従)

**Files:**
- Create: `src/lib/housing/housingerProfileService.ts`
- Create: `src/components/housing/housinger/useHousingerProfile.ts`
- Modify: `src/hooks/auth/useAccountActions.ts` (`:17-33` の uploadAvatar / updateDisplayName)
- Test: `src/lib/housing/__tests__/housingerProfileService.test.ts`

**Interfaces (Produces):**

```ts
// housingerProfileService.ts
export function getHousingerProfile(uid: string): Promise<HousingerProfile | null>; // 公開条件を満たさない/不存在 = null。モジュール内 Map でセッションキャッシュ
export function invalidateHousingerProfileCache(uid: string): void;
export function getHousingerListings(uid: string): Promise<HousingListing[]>;       // 公開のみ・createdAt desc
export function upsertHousingerProfile(input: { isPublished?: boolean; bio?: string | null; snsUrl?: string | null }): Promise<{ ok: boolean; error?: string; profile?: HousingerProfile }>;
export function syncHousingerProfileBestEffort(): void; // 名前/アイコン変更後の追従。失敗は握りつぶす (console.warn のみ)
// useHousingerProfile.ts
export function useHousingerProfile(uid: string | null): { profile: HousingerProfile | null; loading: boolean };
```

- [ ] **Step 1: サービスのテスト** — キャッシュ(2回目は Firestore を叩かない・vi.mock('firebase/firestore'))、公開条件 false → null、`upsertHousingerProfile` 成功時に自分のキャッシュ invalidate。FAIL 確認
- [ ] **Step 2: 実装**
  - `getHousingerProfile`: `getDoc(doc(db, 'housing_profiles', uid))`。存在しない/`isPublished!==true`/`isModerationHidden===true` → null (rules 上、他人の非公開 doc は read 拒否 = **例外も null に丸める**)。結果 (null 含む) を Map キャッシュ。
  - `getHousingerListings`: `getGalleryListings` (`src/lib/housingListingsService.ts:126-138`) と同形で `where('ownerUid','==',uid)` + `where('visibility','==','public')` + `where('isHidden','==',false)` + `orderBy('createdAt','desc')` + `limit(200)` + client 側 `deletedAt == null` フィルタ (Task 2 のインデックスが前提)。
  - `upsertHousingerProfile`: `buildHousingHeaders(true)` → `POST /api/housing?action=upsert-housinger-profile`。`useHousingReport.ts:17-52` のエラーハンドリング形を踏襲。
  - `syncHousingerProfileBestEffort`: `void upsertHousingerProfile({}).catch(...)` 形。未ログイン時は何もしない。
- [ ] **Step 3: `useAccountActions.ts` に追従を配線** — `uploadAvatar` と `updateDisplayName` の成功直後に `syncHousingerProfileBestEffort()` を 1 行ずつ追加 (`removeAvatar` にも)。未公開ユーザーではサーバーが `isPublished:false` のまま転記するだけで無害 (冪等)。
- [ ] **Step 4: テスト PASS → コミット** `feat(housing): ハウジンガープロフィールのクライアント取得/キャッシュ/追従同期`

---

## Task 6: アカウントモーダルに「ハウジンガー公開」セクション

**Files:**
- Create: `src/components/housing/login/HousingerProfileSection.tsx`
- Modify: `src/components/housing/login/HousingAccountModal.tsx` (`housing-account-profile` div の直後・admin リンクの前にセクションを挿入)
- Modify: `src/styles/housing.css` (セクション用スタイル。既存 `.housing-account-*` の質感に合わせる)
- Modify: `src/locales/{ja,en,ko,zh}.json` (`housing.account` ブロックの後に `housing.housinger` ブロック新設)
- Test: `src/__tests__/housing/HousingerProfileSection.test.tsx`

**UI 仕様:**
- 見出し「ハウジンガー公開」+ 説明 1 行 (「名前とアイコンを登録ハウジングに表示し、あなたのページを公開します」)。
- 未公開時: [ハウジンガーとして公開する] ボタン。表示名が空なら disabled + 注記「先に表示名を設定してください」。
- 公開中: 「公開中」表示 + ひとこと入力 (`maxLength={HOUSINGER_BIO_MAX_LENGTH}` + 残字数)、SNSリンク入力 (`type="url"` + クライアント側 `validateHousingerSnsUrl` で保存前チェック・エラーは inline テキスト)、[保存]、[公開をやめる] (ConfirmDialog で確認 — 文言「ページと登録者表示が非公開になります。登録したハウジングは消えません」)。
- 自分のプロフィールは `getDoc(doc(db,'housing_profiles', uid))` 直読み (本人 read は rules 許可・キャッシュ不使用)。
- 保存/公開/停止は `upsertHousingerProfile` → 成功 showToast / 失敗 showToast(error)。
- 装飾禁止ルール厳守 (色付き箱にしない。`housing-account-button` の既存質感を流用)。

**i18n キー (ja の実値。en/ko/zh は同ブロック構造で自然な訳を付ける — 固有名詞「ハウジンガー」は en: Housinger / ko: 하우징어 / zh: 房主玩家 とする):**

```json
"housinger": {
    "account": {
        "title": "ハウジンガー公開",
        "description": "名前とアイコンを登録ハウジングに表示し、あなたのページを公開します",
        "publish": "ハウジンガーとして公開する",
        "nameRequired": "先に表示名を設定してください",
        "published": "公開中",
        "bioLabel": "ひとこと",
        "bioPlaceholder": "例: S字改築が好きです。見学歓迎!",
        "snsLabel": "SNSリンク",
        "snsPlaceholder": "https://x.com/... (X / YouTube / Lodestone)",
        "snsInvalid": "X / YouTube / Lodestone の https リンクのみ設定できます",
        "save": "保存",
        "unpublish": "公開をやめる",
        "unpublishConfirmTitle": "ハウジンガー公開をやめますか?",
        "unpublishConfirmBody": "ページと登録者表示が非公開になります。登録したハウジングは消えません",
        "toastSaved": "ハウジンガープロフィールを保存しました",
        "toastError": "保存に失敗しました。時間をおいて再度お試しください"
    }
}
```

- [ ] **Step 1: コンポーネントテスト** (未公開+名前なし→ボタン disabled / 公開中→bio・sns 入力表示 / sns 不正→エラー表示で保存不発) → FAIL
- [ ] **Step 2: 実装 + モーダルへ挿入 + CSS + 4言語ロケール**
- [ ] **Step 3: テスト PASS + `npm run build` → コミット** `feat(housing): アカウントモーダルにハウジンガー公開セクション`

---

## Task 7: 詳細パネルの登録者行 + ハウジンガーページ + ルート

**Files:**
- Modify: `src/components/housing/listing/HousingDetailContent.tsx` (`housing-detail-info` 内・`housing-detail-address` の直後 `:200` 付近)
- Create: `src/components/housing/housinger/HousingerByline.tsx` (詳細用の 1 行)
- Create: `src/components/housing/pages/HousingerPage.tsx`
- Modify: `src/App.tsx:107` 付近 (`listing/:listingId/edit` の Route の後に `<Route path="housinger/:uid" element={<HousingerPage />} />`)
- Modify: `src/components/housing/browse/ListingGrid.tsx` + `ListingCard.tsx` (`onAddToTour` を optional 化 — undefined ならカードの「ツアーに追加」ボタン非表示。既存呼び出し (BrowsePage) は無変更)
- Modify: `src/styles/housing.css` / `src/locales/{ja,en,ko,zh}.json`
- Test: `src/__tests__/housing/HousingerByline.test.tsx` / `src/__tests__/housing/HousingerPage.test.tsx`

**HousingerByline (詳細の登録者行):**

```tsx
// props: { ownerUid: string }
// useHousingerProfile(ownerUid) → profile が null なら「null を返す」(行ごと消える。spec §4.2/§6.3)
// 表示: <Link to={`/housing/housinger/${ownerUid}`} className="housing-detail-byline">
//   アイコン (avatarUrl || 頭文字プレースホルダ) + 名前 + 「のハウジング」
// </Link>
```

i18n: `housing.housinger.byline` = ja `"{{name}} のハウジング"` / en `"Housing by {{name}}"` / ko `"{{name}} 님의 하우징"` / zh `"{{name}} 的房屋作品"`。

**HousingerPage:**
- `useParams()` の `uid` → `getHousingerProfile(uid)` + `getHousingerListings(uid)` を並行取得。
- NotFound (profile null): `HousingDetailPage.tsx:40-57` のインライン形を踏襲 — `t('housing.housinger.unavailable')` (ja: 「このハウジンガーは公開されていません」) + `← 探すへ戻る` Link。
- ヘッダー: アイコン大 (96px 相当・CSS はトークン化) + 名前 (h2) + ひとこと + SNS リンク (`target="_blank" rel="noopener noreferrer"`、表示テキストはホスト名)。本人 (`useAuthStore` の uid 一致) なら [プロフィールを編集] → `useHousingModalStore.getState().openAccount()`。
- 一覧: `<ListingGrid listings={sorted} sort={sort} onSortChange={setSort} />` (onAddToTour なし = ボタン非表示)。0 件時は `EmptyResult` ではなく専用文言 `housing.housinger.noListings` (ja: 「公開中のハウジングはまだありません」)。
- [この人の家をまとめてツアー] ボタン: listings が 1 件以上で表示。`BrowsePage.tsx:66-73` の onStart と同形 — `orderTourStopIds(ids, listings)` → `useHousingTourStore.getState().setListings(…)` → `.start()` → `useHousingViewStore.getState().enterTourMode()` → `navigate('/housing/tour')`。i18n `housing.housinger.tourAll` (ja: 「この人の家をまとめてツアー」)。
- ページ全体は探す/詳細と同じ大パネルシェルの中 (`housing-detail-panel` 相当のラッパー。既存クラスの流用可否は HousingDetailPage の構造に合わせる)。

- [ ] **Step 1: Byline テスト** (公開 profile → 名前が出る+リンク先 / null → 何も描画しない) → FAIL → 実装 → PASS
- [ ] **Step 2: ListingGrid/ListingCard の optional 化** (既存テストが通ることを確認)
- [ ] **Step 3: HousingerPage テスト** (profile あり → 名前+一覧 / null → unavailable / 本人 → 編集ボタン) → FAIL → 実装 (ルート追加込み) → PASS
- [ ] **Step 4: 4言語ロケール + CSS → `npm run build` + `npx vitest run` → コミット** `feat(housing): 詳細の登録者行 + ハウジンガーページ (/housing/housinger/:uid)`

---

## Task 8: 個人タグ接続 (タグ刷新 Phase B との統合) + 探すのリンク

> **着手前にタグ刷新の実装結果を必ず読む**: `git log --oneline` で `feat/housing-tag-overhaul` のマージコミットを特定し、`src/data/housingTags.ts` / TagPicker / FilterPanel / personal_tags 関連 API の**実装を正**として以下の契約に合わせる。

**統合契約 (spec §3.3):**
1. `personal_tags` ドキュメントの作成・更新は **Task 3 の upsert ハンドラのみ**が行う。Phase B が独自の「個人タグ作成 API」を実装していた場合、その action は削除し、クライアント呼び出しを upsert-housinger-profile へ付け替える (1人1個制約は tagId が uid 決定的なので構造的に満たされる)。
2. TagPicker「個人」タブ: 未公開ユーザーには「ハウジンガーとして公開すると自分のタグが使えます」+ [公開設定を開く] (openAccount) を表示。公開中ユーザーには自分のタグ (名前) を表示して付与できる。他人のタグ検索 (フィルタ用途) は Phase B 実装のまま。
3. listing への personal タグ付与検証 (サーバー側): `personal_tags/{id}` の存在 + `isHidden === false` + `ownerUid === 自分` — Phase B が実装済みならそのまま。無ければ `_registerListingHandler` / `_updateListingHandler` に追加。
4. 探す側: FilterPanel で個人タグ 1 つで絞り込み中のとき、結果一覧の上に「`{{name}}` のハウジンガーページを見る →」リンク (`/housing/housinger/{ownerUid}`)。i18n `housing.housinger.viewPage`。タグ→uid の解決は `personal_tags/{tagId}.ownerUid` (公開 read 可の rules が Phase B に無ければ `allow get: if resource.data.isHidden == false` を追加)。

**Files (Phase B の実装次第で増減):** TagPicker / FilterPanel / BrowsePage / api ハンドラ / rules / ロケール 4 言語 / 対応テスト。

- [ ] **Step 1: Phase B 実装の読解メモをコミットメッセージに残す** (何をどう合わせたか)
- [ ] **Step 2: 契約 1→2→3→4 の順に実装。各契約ごとにテスト追加** (未公開→タブに公開導線 / 公開→自分のタグ付与可 / isHidden タグ付与拒否 / フィルタ中リンク表示)
- [ ] **Step 3: `npm run build` + `npx vitest run` → コミット** `feat(housing): 個人タグ=ハウジンガー名の一体化 (作成経路をプロフィール公開に一本化)`

---

## Task 9: 登録フォームの任意ブロック + 通報導線 UI

**Files:**
- Create: `src/components/housing/register/RegisterHousingerCta.tsx`
- Modify: `src/components/housing/pages/RegisterPage.tsx` (マージ後の新構成で、確認セクション `RegisterSectionConfirm` の**直前**にマウント)
- Create: `src/components/housing/report/HousingerReportModal.tsx` (+ HousingerPage のメニューから開く)
- Modify: ロケール 4 言語 / housing.css
- Test: `src/__tests__/housing/RegisterHousingerCta.test.tsx`

**RegisterHousingerCta 仕様:** ログイン済のみ表示。自分のプロフィールを 1 回読み、未公開なら 見出し「ハウジンガーとして名乗りますか?(任意)」+ 説明 1 行 + [設定する] (openAccount)。公開中なら 小さく「〇〇として公開中」 (i18n `housing.housinger.register.publishedAs` = ja `"{{name}} として公開中"`)。何も要求しない・入力必須にしない (spec §4.1)。

**HousingerReportModal 仕様:** `HousingReportModal.tsx:15-52` を踏襲した別モーダル (対象 = housingerUid)。reason は Task 1 の `HOUSINGER_REPORT_REASONS` を radio 列挙、i18n `housing.housinger.report.reason.*` (ja: 不適切な名前 / 不適切なアイコン / なりすまし / その他)。送信は `POST action=report-housinger`。成功/duplicate/error のトーストは listing 通報と同文言キー流用可。

- [ ] **Step 1: CTA テスト** (未ログイン→非表示 / 未公開→CTA / 公開中→名前表示) → FAIL → 実装 → PASS
- [ ] **Step 2: 通報モーダル実装 + HousingerPage へ配線** (ページヘッダーの控えめな「…」メニュー)
- [ ] **Step 3: 4言語 + `npm run build` + `npx vitest run` → コミット** `feat(housing): 登録フォームのハウジンガー導線 + プロフィール通報UI`

---

## Task 10: 全体検証

- [ ] `npm run build` (exit 0)
- [ ] `npx vitest run` 全緑 (パイプしない)
- [ ] `npx tsc -b --noEmit` エラーなし
- [ ] i18n parity 確認: 4 ファイルの `housing.housinger` ブロックのキー集合が一致すること (jq 等で機械比較)
- [ ] 変更ファイル一覧・コミット一覧・**親セッションへの引き継ぎ** (rules/indexes のデプロイ待ち・実機確認項目) を最終報告に列挙

**実機確認チェックリスト (ユーザー向け・報告に含める):**
1. アカウントモーダルで公開 ON → 名前必須ガード → 公開 → ひとこと/SNS 保存
2. 自分のハウジング詳細に登録者行が出る → クリックでページ → まとめてツアー
3. 名前変更 → 詳細・ページ・個人タグの表示が追従
4. 公開 OFF → 行・ページ・タグが消える (ハウジングは残る)
5. 別アカウントから通報 → /admin に出る → 強制非公開 → 表示から消える

## 受け入れ基準

- spec の全要件 (§2 確定判断 5 点・§4 画面 4 点・§6 安全 3 点) に対応するコード/テストが存在する
- 名前の書き込み経路が upsert ハンドラ 1 本に閉じている (grep で `housing_profiles` への set/update が他に無い)
- rules/indexes の変更がデプロイ待ちとして明示されている (勝手にデプロイしない)

## やらないこと (spec §8)

フォロー機能 / 人気順・実績数表示 / mypage 本実装 / プロフィール自動非表示閾値 / 許可ドメイン拡張 / 探すカードへの登録者表示
