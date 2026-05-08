# ハウジング Sub-spec 2A Phase B 設計書 (アカウントリンク + 認証体験向上)

> **作成日**: 2026-05-08
> **ステータス**: 設計レビュー待ち
> **元設計書**: `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` §5.3
> **関連メモリ**: `feedback_auth_privacy.md` / `project_housing_phase_status.md`
> **Phase A**: 2026-05-08 完了 (commit d24031e)

---

## 1. 背景と目的

### 1.1 経緯

ハウジングツアー Phase 1 設計書 §5.3 の「アカウントリンク UI」を実装する Phase B を計画する過程で、ユーザーからより本質的な体験課題が提示された:

> 「軽減表を試しで使ってみたくてログインせずにプランをいくつも作った → やっぱり便利だからログインして使いたくなった → 今まで作ったプランをどうやって取り込む?」
>
> 「ログイン中アイコンの変更機能が無いことを忘れていた」

ブレインストーミングの結果、Phase B のスコープを「アカウントリンク単体」から **認証体験全体の底上げ** に拡張することが決定。具体的には次の 3 つを 1 つの Phase に束ねる:

- **B-1: ローカル取り込み** — 未ログインで作ったプランをログイン時にクラウドへ移植
- **B-2: アカウントリンク** — Discord ↔ X (Twitter) を 1 uid に紐づけ
- **B-3: アバター/表示名変更** — 初回ログイン時にしか設定できなかった項目を、いつでも変更可能に

### 1.2 LoPo 認証プライバシー原則(絶対遵守)

`docs/DESIGN_DECISIONS.md`「認証プライバシー方針 (2026-04-04確定)」と memory `feedback_auth_privacy.md` で確定済みの原則:

- メールアドレス・表示名・アバター等の個人情報を Firebase Auth に保存しない
- Firebase 標準 OAuth API (`signInWithPopup(auth, OAuthProvider)` / `linkWithCredential` / `linkWithPopup`) は使わない
- カスタムトークン方式 (`api/auth/_*Handler.ts`) を維持
- アカウントリンクは自前マッピングテーブル方式で実装

→ 元設計書 §5.3 の「`linkWithCredential` で同一 uid に複数 provider 紐づけ」は **採用不可**。本設計書で再定義する。

### 1.3 完成定義

- 全ユーザーが「未ログイン → ログイン」遷移時にデータを失わない
- Discord ユーザーと X ユーザーが、希望すれば 1 uid に統合できる
- アバター・表示名は LoginModal からいつでも変更可能
- 既存ログインフロー・既存データへの影響ゼロ
- i18n 4 言語 (ja/en/ko/zh) 完備、glass-tier3 トンマナ統一

---

## 2. スコープ

### 2.1 Phase B に含む

- ✅ B-1: 未ログイン状態 (ownerId='local') のプランをログイン時に取り込み
- ✅ B-1: 取り込みダイアログ (毎回確認 + 「次回から表示しない」)
- ✅ B-1: LoginModal 内に「ローカルプランを取り込む」明示ボタン (ローカル data 残存時のみ表示)
- ✅ B-1: 同名衝突自動採番 + 枠超過時の部分取り込み
- ✅ B-2: 自前マッピング `account_links/{provider:id} → primaryUid` 方式
- ✅ B-2: 連携用 OAuth フロー (既存エンドポイントに `mode=link` 追加)
- ✅ B-2: ログイン時の lookup 分岐 (account_links に該当があれば primaryUid で発行)
- ✅ B-2: 連携解除フロー
- ✅ B-2: LoginModal 内に「連携済み/未連携」セクション追加
- ✅ B-3: LoginModal のアバター画像をクリック → AvatarCropModal (既存) を開く
- ✅ B-3: LoginModal の表示名横に鉛筆アイコン → インライン編集
- ✅ i18n 4 言語追加 (新規 ~30 キー想定)
- ✅ Firestore セキュリティルール追加 (`account_links/`)

### 2.2 Phase B に含まない (明示的除外)

- ❌ Twitter 単独 uid (連携前) のデータ統合 — 連携後は孤立、警告のみ
- ❌ お気に入り等ハウジング固有データの取り込み — Sub-spec 2B 範囲
- ❌ 設定画面 (新規ページ) の新設 — LoginModal 内に集約
- ❌ アカウント連携の自動マージ提案 — ユーザー明示操作のみ
- ❌ 連携状態の他端末同期 — `account_links/` は Firestore で全端末共有されるため自動的に整合

---

## 3. アーキテクチャ概要

### 3.1 既存資産 (再利用)

| ファイル | 役割 | 利用箇所 |
|---|---|---|
| `api/auth/_discordHandler.ts` | Discord OAuth + カスタムトークン | B-2 で `mode=link` 分岐追加 |
| `api/auth/_twitterHandler.ts` | Twitter OAuth + PKCE + カスタムトークン | B-2 で `mode=link` 分岐追加 |
| `src/store/useAuthStore.ts` | 認証状態管理 | B-1/B-2/B-3 で actions 追加 |
| `src/store/usePlanStore.ts` | プラン管理 + Firestore 同期 | B-1 で `importLocalPlans` action 追加 |
| `src/components/LoginModal.tsx` | アカウント関連 UI | B-1/B-2/B-3 全部の UI 拡張先 |
| `src/components/WelcomeSetup.tsx` | 初回ログイン時の表示名/アバター入力 | 影響なし (現状維持) |
| `src/components/AvatarCropModal.tsx` | クロップ + 128x128 WebP 変換 | B-3 で LoginModal から呼び出し |
| `src/utils/avatarUpload.ts` | `uploadAvatar` / `deleteAvatar` | B-3 でそのまま利用 |
| `src/utils/generateUniqueTitle.ts` | 同名衝突採番 | B-1 で利用 |

### 3.2 新規追加するもの

```
新規ファイル:
  src/lib/accountLinks.ts              アカウントリンクのクライアント API
  src/components/LocalImportDialog.tsx ローカル取り込みダイアログ
  src/components/AccountLinkSection.tsx LoginModal 内連携セクション
  src/components/DisplayNameEditor.tsx 表示名インライン編集
  api/auth/links.ts                    連携状態取得 (GET) + 解除 (POST) 統合エンドポイント

(既存ハンドラ修正:
  api/auth/_discordHandler.ts          mode=link 分岐 + lookup 分岐を追加
  api/auth/_twitterHandler.ts          mode=link 分岐 + lookup 分岐を追加)

新規 Firestore コレクション:
  account_links/{provider:id}   { primaryUid, linkedAt }

新規 Firestore セキュリティルール:
  account_links 全 read = false (Cloud Function 経由でのみアクセス)
  account_links 全 write = false (Admin SDK のみ)

新規 i18n キー (~30 キー × 4 言語 = 120 翻訳)

新規環境変数:
  なし (既存の DISCORD_/TWITTER_/FIREBASE_ で間に合う)
```

### 3.3 全体フロー図

```
未ログインユーザー
  ↓ プラン作成
  localStorage に保存 (ownerId='local')
  ↓ ログイン
  ┌──────────────────────────────┐
  │ B-1: ローカル取り込みダイアログ  │
  │ 「N 件のプランを取り込みますか?」│
  └──────────────────────────────┘
  ↓ OK
  新ID発行 + 同名採番 + Firestore 同期 + 枠チェック
  ↓
  通常ログイン継続

ログイン中ユーザー (LoginModal を開く)
  ┌──────────────────────────────┐
  │ アバター(クリックで変更) | 表示名 [🖊]      │ ← B-3
  │ 連携済み: ✓ Discord                          │ ← B-2
  │ 他SNSと連携: 𝕏 [連携する]                    │ ← B-2
  │ ローカルプランを取り込む (data あれば表示)   │ ← B-1
  │ ログアウト | アカウント削除                   │
  └──────────────────────────────┘

連携クリック (例: Discord ログイン中に X 連携)
  ↓
  POST /api/auth?provider=twitter&mode=link
  Authorization: Bearer <Firebase ID Token>
  ↓
  サーバー: ID Token 検証 → primaryUid 取得 → cookie に保存 → Twitter 認可URL返却
  ↓
  Twitter リダイレクト → 認可 → callback
  ↓
  GET /api/auth?provider=twitter&mode=link&code=...
  ↓
  サーバー: state検証 → Twitter ID 取得 → account_links/twitter:T1 = { primaryUid: 'discord:D1', linkedAt: now }
  ↓
  完了画面 → クライアントへリダイレクト → LoginModal で連携完了トースト

連携先プロバイダで再ログイン (例: 連携後に Twitter でログイン)
  ↓
  POST /api/auth?provider=twitter (通常モード)
  ↓
  Twitter 認可 → Twitter ID = T1 取得
  ↓
  サーバー: account_links/twitter:T1 を lookup → primaryUid='discord:D1' を取得
  ↓
  カスタムトークン発行 (uid='discord:D1' で発行) → クライアントへ
  ↓
  Discord 側のデータが見える状態でログイン完了
```

---

## 4. データモデル

### 4.1 `account_links/{provider:id}` — 新規

```typescript
// document path: account_links/discord:D1
// document path: account_links/twitter:T1
interface AccountLink {
  primaryUid: string;           // 紐づけ先の uid (例: 'discord:D1')
  linkedAt: Timestamp;
}
```

ドキュメント ID 自体が `discord:D1` `twitter:T1` の形式。

### 4.2 既存コレクションへの影響

- `users/{uid}` — **変更なし**。既存の `displayName`, `avatarUrl`, `provider` フィールドを B-3 で更新できるようにする (read/write のセキュリティルール変更不要、既に自分のドキュメント編集可)
- `plans/{planId}` — **変更なし**。B-1 でローカル plan 取り込み時、新 ID 発行 + ownerId=uid で新規作成
- `userPlanCounts/{uid}` — **変更なし**。B-1 取り込みも通常の plan 作成と同じ枠カウント増減

### 4.3 LocalStorage キー (新規)

```typescript
'lopo_local_import_dont_show'  // boolean string ('true' | undefined)
                                // ローカル取り込みダイアログ「次回から表示しない」フラグ
                                // 注: 各ユーザーがログインしたあと、表示しない選択をすればこのキーがセットされる
                                //    端末別で良い (uid 別ではない) — 別端末で別の選択ができたほうが自然
```

---

## 5. B-1: ローカル取り込み

### 5.1 トリガー

`onAuthStateChanged` (useAuthStore.ts) でログイン成功を検知後、次の条件を **すべて満たす** とダイアログ表示:

1. `localStorage.plan-storage` にプランが 1 件以上存在
2. それらの ownerId が `'local'` (ログアウト時に全消し されるので、通常ログイン中のプランは混ざらない)
3. `localStorage.lopo_local_import_dont_show !== 'true'`
4. ユーザーが LoginModal を介さずに自動表示する場合のみ ── ログイン直後の自動チェックは `onAuthStateChanged` callback の最後で実施

加えて、ユーザーが LoginModal の **明示ボタン** から呼んだ場合は条件 3 を無視 (常に表示)。

### 5.2 取り込みロジック

```typescript
// src/store/usePlanStore.ts に追加
interface ImportResult {
  imported: number;             // 取り込めた件数
  skipped: number;              // 枠超過でスキップした件数
  contentBreakdown: Record<string, { imported: number; skipped: number }>;  // コンテンツ別
}

async function importLocalPlans(uid: string): Promise<ImportResult> {
  const localPlans = get().plans.filter(p => p.ownerId === 'local');
  const result: ImportResult = { imported: 0, skipped: 0, contentBreakdown: {} };

  // 1. グローバル枠チェック
  const userMeta = await getDoc(doc(db, 'userPlanCounts', uid));
  const totalCurrent = userMeta.exists() ? userMeta.data().totalCount ?? 0 : 0;
  const totalRemaining = 50 - totalCurrent;

  // 2. コンテンツ別枠チェック
  const contentCounts = await fetchContentCounts(uid);  // { fru: 3, dmu: 5, ... }

  // 3. 取り込み計画
  const planToImport: SavedPlan[] = [];
  let totalUsed = 0;
  for (const local of localPlans) {
    const contentId = local.contentId;
    const currentCount = contentCounts[contentId] ?? 0;
    const breakdown = result.contentBreakdown[contentId] ??= { imported: 0, skipped: 0 };

    if (totalUsed >= totalRemaining || currentCount + breakdown.imported >= 5) {
      breakdown.skipped += 1;
      result.skipped += 1;
      continue;
    }

    breakdown.imported += 1;
    totalUsed += 1;
    planToImport.push(local);
  }

  // 4. ID 再発行 + 同名採番 + ownerId 書き換え + Firestore 同期
  for (const plan of planToImport) {
    const newId = generateNewId();
    const titleConflict = await checkTitleConflict(uid, plan.contentId, plan.title);
    const finalTitle = titleConflict ? generateUniqueTitle(plan.title, existingTitles) : plan.title;

    const newPlan = { ...plan, id: newId, ownerId: uid, title: finalTitle };
    await syncPlanToFirestore(newPlan);
    result.imported += 1;
  }

  // 5. 取り込み済みのローカルプランを削除 (skipped はローカルに残す)
  removeImportedFromLocal(planToImport.map(p => p.id));

  return result;
}
```

### 5.3 衝突処理

- **同名衝突**: `generateUniqueTitle()` で `(2)`, `(3)` 自動採番。コンテンツ単位で重複チェック
- **ID 衝突**: 取り込み時に新 UUID 発行 → Firestore 上の既存プランと **絶対衝突しない**
- **既存データ破損**: 新規追加のみ、既存プラン (ownerId=uid のもの) は **絶対に上書きされない**
- **枠超過**: コンテンツ 5 件制限 / 合計 50 件制限を順守、超過分は LocalStorage に残してダイアログで通知

### 5.4 UI

#### 5.4.1 取り込みダイアログ (`LocalImportDialog.tsx`)

```
┌─────────────────────────────────────┐
│ ローカルにあるプランを取り込みますか?  │
├─────────────────────────────────────┤
│ ログインしていない時に作ったプランが    │
│ N 件あります。クラウドに保存して、       │
│ 別の端末からも見られるようにしますか?    │
│                                     │
│ ▢ 次回から自動で表示しない            │
│                                     │
│  [取り込まない]    [取り込む]         │
└─────────────────────────────────────┘
```

- glass-tier3 + dialogIn 200ms スプリングアニメ
- ボタン: 取り込む = 青系 (app-blue 系の確定アクション)、取り込まない = ゴースト
- backdrop: bg-black/50 + ✕で閉じる (= 取り込まない扱い)
- インジケーター: なし (即時実行、進捗は完了トーストで)

#### 5.4.2 取り込み完了トースト (既存 toast システム流用)

成功時:
```
✓ N 件のプランを取り込みました
```

部分成功時 (枠超過):
```
✓ N 件取り込みました ・ M 件は枠不足で残してあります
```

エラー時:
```
✗ 取り込みに失敗しました。再試行しますか?
```

#### 5.4.3 LoginModal 内の明示ボタン

ログイン済み画面、ログアウトボタンの上に追加 (ローカル data がある時のみ表示):

```
┌─────────────────────────────────┐
│ ⬇ ローカルプランを取り込む (N件)  │
└─────────────────────────────────┘
```

クリック → `LocalImportDialog` を「次回から表示しない」フラグを無視して表示。

### 5.5 i18n キー追加

```
local_import.title              ローカルにあるプランを取り込みますか?
local_import.body               ログインしていない時に作ったプランが {{count}} 件あります。クラウドに保存して、別の端末からも見られるようにしますか?
local_import.dont_show_again    次回から自動で表示しない
local_import.confirm            取り込む
local_import.cancel             取り込まない
local_import.toast_success      {{count}} 件のプランを取り込みました
local_import.toast_partial      {{imported}} 件取り込みました ・ {{skipped}} 件は枠不足で残してあります
local_import.toast_error        取り込みに失敗しました
local_import.button_retry       再試行
local_import.modal_button       ローカルプランを取り込む ({{count}}件)
```

### 5.6 動作シナリオ別検証

| シナリオ | 期待動作 |
|---|---|
| 未ログイン → 初ログイン (ローカル 3 件) | ダイアログ → OK → 3 件取り込み完了 |
| 未ログイン → ログイン (枠 5/5、ローカル 3 件) | ダイアログ → OK → 0 件取り込み + 「3 件残してあります」 |
| 未ログイン → ログイン (合計 49/50、ローカル 3 件) | ダイアログ → OK → 1 件取り込み + 「2 件残してあります」 |
| 未ログイン → ログイン (同名 "FRU 練習" 既存 1 件、ローカル "FRU 練習" 1 件) | ダイアログ → OK → ローカル分は "FRU 練習 (2)" として取り込み |
| 「次回から表示しない」OK 後の再ログイン | ダイアログ自動表示なし、明示ボタンが LoginModal に表示 |
| 明示ボタン押下後 → 取り込み完了 → ローカル data 0 件に | 明示ボタン消える |
| ログアウト後の再ログイン (ローカル 0 件) | ダイアログ表示なし、明示ボタン非表示 (`signOut()` で localStorage 全消し済) |

---

## 6. B-2: アカウントリンク

### 6.1 連携 OAuth フロー (mode=link)

#### 6.1.1 既存ハンドラへの分岐追加

`api/auth/_discordHandler.ts` と `api/auth/_twitterHandler.ts` の両方に同じパターンで追加:

```typescript
// POST 時 (OAuth開始)
if (req.method === 'POST') {
  if (!(await verifyAppCheck(req, res))) return;

  const isLinkMode = req.query.mode === 'link';
  let primaryUid: string | null = null;

  if (isLinkMode) {
    // Authorization: Bearer <Firebase ID Token> から uid を確定
    const idToken = req.headers.authorization?.replace('Bearer ', '');
    if (!idToken) return res.status(401).json({ error: 'Missing ID token' });
    initAdmin();
    const decoded = await getAuth().verifyIdToken(idToken);
    primaryUid = decoded.uid;
  }

  const stateParam = crypto.randomBytes(16).toString('hex');
  const stateValue = isLinkMode ? `link:${primaryUid}:${stateParam}` : stateParam;

  // cookie に state を保存 (link mode の場合は primaryUid も含む)
  res.setHeader('Set-Cookie',
    `discord_oauth_state=${stateValue}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=300`
  );

  // 通常通り Discord 認可URL返却 (state は stateParam のみ Discord に渡す)
  // ...
}

// GET 時 (callback)
const cookies = parseCookies(req.headers.cookie || '');
const savedState = cookies['discord_oauth_state'];
const isLinkCallback = savedState?.startsWith('link:');

if (isLinkCallback) {
  // link:<primaryUid>:<stateParam> を分解
  const [, primaryUid, stateParam] = savedState.split(':');
  if (state !== stateParam) return res.status(400).json({ error: 'State mismatch' });

  // Discord ID 取得 (通常通り)
  // ...
  const discordUserId = /* ... */;

  // account_links/discord:<discordUserId> に primaryUid を書き込み
  initAdmin();
  await getFirestore().doc(`account_links/discord:${discordUserId}`).set({
    primaryUid,
    linkedAt: FieldValue.serverTimestamp(),
  });

  // 完了画面 (連携完了の旨を localStorage に書いてリダイレクト)
  res.send(`<script>
    localStorage.setItem('lopo_link_completed', JSON.stringify({ provider: 'discord', linkedTo: ${JSON.stringify(primaryUid)} }));
    window.location.href = localStorage.getItem('lopo_auth_return_url') || '/';
  </script>`);
  return;
}

// 通常ログインフロー (既存ロジック)
```

#### 6.1.2 ログイン時 lookup 分岐

通常ログイン (mode 無し) の最後、カスタムトークン発行直前に追加:

```typescript
// _discordHandler.ts (loginモード)
const discordUserId = /* ... */;
const candidateUid = `discord:${discordUserId}`;

// account_links を lookup
initAdmin();
const linkDoc = await getFirestore().doc(`account_links/${candidateUid}`).get();
const finalUid = linkDoc.exists ? linkDoc.data()!.primaryUid : candidateUid;

const customToken = await getAuth().createCustomToken(finalUid, {
  provider: 'discord',  // ログイン経路は Discord (display 用、機能には影響なし)
});
```

これにより、Discord でログインしようとしても account_links に該当があれば primaryUid (=元の Twitter uid 等) でログインする。

### 6.2 連携解除フロー

`src/lib/accountLinks.ts` に新設:

```typescript
export async function unlinkAccount(provider: 'discord' | 'twitter'): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not logged in');

  // クライアント側では account_links に直接 write できない (rule で禁止)
  // → Cloud Function or API endpoint 経由
  await apiFetch('/api/auth/unlink', {
    method: 'POST',
    body: JSON.stringify({ provider }),
    headers: { 'Content-Type': 'application/json' },
  });
}
```

サーバー側は `api/auth/links.ts` の POST handler 内に統合 (§3.2 の通り、関数枠節約のため GET/POST 同居):

```typescript
// api/auth/links.ts (新規, GET + POST 同一ファイル)
export default async function linksHandler(req, res) {
  if (req.method === 'POST') return handleUnlink(req, res);
  if (req.method === 'GET') return handleGetLinks(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleUnlink(req, res) {
  if (!(await verifyAppCheck(req, res))) return;
  const idToken = req.headers.authorization?.replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: 'Missing ID token' });
  initAdmin();
  const decoded = await getAuth().verifyIdToken(idToken);
  const primaryUid = decoded.uid;

  const { provider } = JSON.parse(req.body);

  // account_links を逆引き: primaryUid に紐づく provider のリンクを探す
  const snapshot = await getFirestore()
    .collection('account_links')
    .where('primaryUid', '==', primaryUid)
    .get();

  for (const doc of snapshot.docs) {
    if (doc.id.startsWith(`${provider}:`)) {
      await doc.ref.delete();
    }
  }

  res.status(200).json({ ok: true });
}
```

### 6.3 連携状態の取得

`src/lib/accountLinks.ts`:

```typescript
export async function getLinkedProviders(uid: string): Promise<{
  discord: boolean;
  twitter: boolean;
}> {
  // クライアントから account_links を直接 read できないため、API 経由
  const res = await apiFetch('/api/auth/links', { method: 'GET' });
  return res.json();
}
```

サーバー側は同 `api/auth/links.ts` 内 GET handler:

```typescript
async function handleGetLinks(req, res) {
const idToken = req.headers.authorization?.replace('Bearer ', '');
const decoded = await getAuth().verifyIdToken(idToken);
const primaryUid = decoded.uid;

const snapshot = await getFirestore()
  .collection('account_links')
  .where('primaryUid', '==', primaryUid)
  .get();

const result = { discord: false, twitter: false };
for (const doc of snapshot.docs) {
  if (doc.id.startsWith('discord:')) result.discord = true;
  if (doc.id.startsWith('twitter:')) result.twitter = true;
}

// 加えて、現在 uid 自体のプロバイダも連携扱いとする
if (primaryUid.startsWith('discord:')) result.discord = true;
if (primaryUid.startsWith('twitter:')) result.twitter = true;

res.status(200).json(result);
```

### 6.4 セキュリティルール

`firestore.rules`:

```javascript
match /account_links/{key} {
  allow read: if false;   // クライアントから直接読まない (API 経由)
  allow write: if false;  // クライアントから書かない (Admin SDK 経由)
}
```

### 6.5 UI

#### 6.5.1 LoginModal 内 連携セクション (`AccountLinkSection.tsx`)

ログイン済み画面、現在のアバター/表示名表示の下に追加:

```
┌──────────────────────────────────────┐
│ 連携済み                              │
│   ✓ Discord                          │
│   ✓ X (Twitter)              [✕解除] │
│                                      │
│ 他のSNSと連携                         │
│   𝕏 X (Twitter)              [連携]  │
│   どちらで入っても同じデータが見られます│
└──────────────────────────────────────┘
```

- 連携状態は `getLinkedProviders(uid)` で取得 (LoginModal 開いた時に loading state 込みで)
- 連携先プロバイダのアイコンは LoginModal の既存 SVG と同じものを再利用
- 「[連携]」ボタンは既存の border + ホバーカラーパターン (Discord = `hover:bg-[#5865F2]/10`, Twitter = `hover:bg-app-surface2`)
- 「[✕解除]」は赤系 (app-red-border + hover:bg-app-red-dim)
- **現在のログイン provider 自体の表示**: 「連携済み」セクション先頭に `✓ {provider} (ログイン中)` の行を追加。解除ボタンなし、グレーアウトの注記表示 (= 現在のログイン経路を解除すると即ログアウトになる UX 不整合を回避)
- **既に連携済みのプロバイダ**: 「連携済み」セクションに `✓ {provider}` で表示し `[✕解除]` ボタン表示
- **未連携のプロバイダ**: 「他のSNSと連携」セクションに `[連携]` ボタンで表示
- 同じプロバイダが「ログイン中 + 連携済み」両方になることはない (account_links には自身の uid は登録されないため)

#### 6.5.2 連携前警告ダイアログ

```
┌─────────────────────────────────────┐
│ X (Twitter) と連携しますか?           │
├─────────────────────────────────────┤
│ X でアカウントを連携すると、次回から    │
│ X でログインしても同じデータが見られる    │
│ ようになります。                       │
│                                     │
│ ⚠ 注意: 過去に X 単独でログインして    │
│ 別のデータを作っていた場合、それは見え   │
│ なくなります。                         │
│                                     │
│  [キャンセル]    [連携する]           │
└─────────────────────────────────────┘
```

#### 6.5.3 連携完了 / 解除完了トースト

```
✓ X (Twitter) と連携しました
✓ X (Twitter) との連携を解除しました
✗ 連携に失敗しました ({{error}})
```

### 6.6 i18n キー追加

```
account_link.linked_section            連携済み
account_link.unlinked_section          他のSNSと連携
account_link.benefit_text              どちらで入っても同じデータが見られます
account_link.link_button               連携する
account_link.unlink_button             解除
account_link.confirm_link_title        {{provider}} と連携しますか?
account_link.confirm_link_body         {{provider}} でアカウントを連携すると、次回から {{provider}} でログインしても同じデータが見られるようになります。
account_link.confirm_link_warning      過去に {{provider}} 単独でログインして別のデータを作っていた場合、それは見えなくなります。
account_link.confirm_link_cta          連携する
account_link.confirm_link_cancel       キャンセル
account_link.confirm_unlink_title      {{provider}} との連携を解除しますか?
account_link.confirm_unlink_body       解除すると、{{provider}} で次にログインした時は別のアカウント扱いになります。
account_link.toast_link_success        {{provider}} と連携しました
account_link.toast_unlink_success      {{provider}} との連携を解除しました
account_link.toast_link_error          連携に失敗しました
account_link.toast_unlink_error        解除に失敗しました
```

### 6.7 動作シナリオ別検証

| シナリオ | 期待動作 |
|---|---|
| Discord ログイン中 → X 連携 → 次回 X でログイン | `discord:D1` の uid でログイン、Discord 側のプランが見える |
| Discord ログイン中 → X 連携 (X 単独 uid に過去のプランあり) | 警告ダイアログで OK → 連携。X 側 uid のプランは Firestore に残るがアクセス不能 |
| Discord ログイン中 → 同じ Discord uid で再連携試行 | 自分の Discord は連携セクションに表示しない (= 連携ボタン無し)、解除ボタンも無し |
| 連携解除 → X で再ログイン | `twitter:T1` 単独 uid で新規ログイン (= 新規アカウント扱い、空データ) |
| Twitter で先にログイン → 後で Discord 連携 | `twitter:T1` がプライマリ。account_links/discord:D1 = primaryUid: twitter:T1 |

---

## 7. B-3: アバター/表示名変更

### 7.1 既存資産の組み合わせ

新規実装はほぼなし。既存の以下を LoginModal に配線:

- `AvatarCropModal` を LoginModal から呼び出し可能に
- `uploadAvatar(uid, blob)` でアップロード
- `deleteAvatar(uid)` でアバター削除 (= 元のイニシャル文字に戻る)
- 表示名は Firestore `users/{uid}.displayName` を直接 update

### 7.2 UI

#### 7.2.1 アバター変更

LoginModal ログイン済み画面のアバター画像 (40x40 表示) を **クリック可能** にする:

```jsx
<button onClick={() => setShowAvatarCropModal(true)}>
  <img src={profileAvatarUrl ?? placeholder} className="w-10 h-10 rounded-full" />
  <Camera className="absolute bottom-0 right-0" />  {/* hover で表示 */}
</button>
```

クリック → 既存 `AvatarCropModal` 表示 → クロップ → `handleAvatarComplete(blob)` で `uploadAvatar(uid, blob)` 呼び出し → Firestore 更新 → useAuthStore の `profileAvatarUrl` 更新。

**アバター削除 UI** (アバター設定済みユーザーのみ表示): アバター画像直下に控えめテキストリンクで配置:

```jsx
{profileAvatarUrl && (
  <button
    onClick={handleDeleteAvatar}
    className="mt-1 text-app-base text-app-text-muted/50 hover:text-app-text-muted transition-colors cursor-pointer"
  >
    {t('avatar.delete_button')}
  </button>
)}
```

クリック → ConfirmDialog「アバターを削除しますか?」→ OK → `deleteAvatar(uid)` 呼び出し → Firestore + Storage クリア → useAuthStore 更新 → トースト「アバターを削除しました」。アバター削除後はイニシャル文字 (表示名の頭文字) が表示される。

#### 7.2.2 表示名変更

LoginModal ログイン済み画面の表示名横に鉛筆アイコン:

```
┌─────────────────────────┐
│ [アバター] 太郎 [🖊]       │
│            Discord でログイン中│
└─────────────────────────┘
```

クリック → インライン入力フィールド (既存 WelcomeSetup と同じスタイル):

```
┌─────────────────────────┐
│ [アバター] [太郎___] 0/30 │
│            [保存] [キャンセル]│
└─────────────────────────┘
```

保存 → Firestore `users/{uid}.displayName` を update → useAuthStore の `profileDisplayName` 更新 → トースト「表示名を変更しました」。

バリデーション:
- 1〜30 文字 (既存 WelcomeSetup と同じ)
- 空文字保存禁止
- 変更後の名前が現在と同じなら no-op

### 7.3 コスト試算 (既出)

| 規模 | Storage 容量 | 帯域 (月) |
|---|---|---|
| 100ユーザー | ~1 MB | ~5 MB |
| 1万ユーザー | ~100 MB | ~150 MB |
| 10万ユーザー | ~1 GB | ~1.5 GB |

無料枠 (Storage 5 GB / 帯域 1 GB/日) 内、問題なし。

### 7.4 i18n キー追加

```
profile.edit_display_name        表示名を編集
profile.save                     保存
profile.cancel                   キャンセル
profile.toast_name_updated       表示名を変更しました
profile.toast_name_error         表示名の変更に失敗しました
avatar.change_button             アバターを変更
avatar.delete_button             アバターを削除
avatar.toast_uploaded            アバターを変更しました
avatar.toast_deleted             アバターを削除しました
avatar.toast_upload_error        アップロードに失敗しました
```

---

## 8. UI トンマナ統一 (絶対遵守事項)

### 8.1 グローバルルール

memory `feedback_design_approval.md` / `feedback_admin_design.md` 準拠:

- デザイン変更は必ず実装前に承認 (UI 完成前にユーザー確認)
- 既存 LoginModal / WelcomeSetup / ConfirmDialog のトンマナを継承
- glass-tier3 / `--share-modal-bg` / `dialogIn 200ms` アニメ統一
- `app-text` / `app-text-muted` / `app-border` / `app-surface2` 等の既存 CSS 変数のみ使用
- AI グラデ禁止、Inter フォント禁止 (Rajdhani + M PLUS 1 のみ)
- マウス追従 UI 禁止

### 8.2 インジケーター流用

- ローディング: 既存 ConsolidatedHeader / Layout の loading パターンを使う (新規スピナー作らない)
- トースト: 既存 toast システム (`useToast` hook) を流用、新規トーストコンポーネント作らない
- 確認ダイアログ: 既存 `ConfirmDialog.tsx` を流用、新規ダイアログ作らない (LocalImportDialog / 連携確認 / 解除確認 / アバター削除確認すべて ConfirmDialog ベース or wrapper)

### 8.3 レスポンシブ

- LoginModal は既にスマホ/PC 両対応 (中央表示) → そのまま継承
- 新セクションは縦に積む (横配置はしない、スマホで折り返し回避)
- 連携ボタン・編集ボタンはタッチターゲット 44x44px 以上

---

## 9. テスト計画

### 9.1 ユニットテスト (vitest)

| 対象 | テストケース |
|---|---|
| `importLocalPlans()` | 0 件 / 全件入る / 一部スキップ / 全スキップ / 同名衝突 |
| `getLinkedProviders()` | 連携 0 / 1 / 2 件、現在 uid のプロバイダ込み |
| `unlinkAccount()` | 正常系 / 該当なし / 異常認証 |
| `account_links` lookup logic | 連携あり / 連携なしで finalUid 切替 |

### 9.2 結合テスト

- ログイン → ローカル取り込みダイアログ表示 → OK → Firestore に新プラン追加
- ログイン → アバター変更 → Firestore + Storage 更新 → useAuthStore 反映
- 連携 → 解除 → 再連携 → account_links 状態が一貫

### 9.3 E2E (Playwright)

- ゲスト → プラン作成 → Discord ログイン → 取り込みダイアログ → OK → ギャラリーに反映
- Discord ログイン → X 連携クリック → モック OAuth → 連携完了トースト
- LoginModal 開く → アバタークリック → 画像アップロード → クロップ → 反映

### 9.4 実機検証チェックリスト (Phase B 完了時)

- [ ] 未ログインで FRU プラン 1 件作成 → Discord ログイン → ダイアログ → OK → ギャラリーに反映
- [ ] 「次回から表示しない」OK 後の再ログイン → ダイアログ非表示、明示ボタン表示
- [ ] 明示ボタン → ダイアログ表示 → OK → 取り込み完了
- [ ] 枠 5/5 状態でローカル 1 件 → 取り込み試行 → 「枠不足」通知 + ローカルに残る
- [ ] Discord ログイン中 → X 連携 → 警告 OK → OAuth → 完了トースト
- [ ] ログアウト → X で再ログイン → Discord 側のデータが見える
- [ ] LoginModal でアバタークリック → クロップ → 反映
- [ ] LoginModal で表示名鉛筆 → 編集 → 保存 → 反映
- [ ] 4 言語 (ja/en/ko/zh) で全 UI 文字列が表示 (英語/韓国語/中国語表示崩れチェック含む)

---

## 10. リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| Firebase ID Token 検証失敗 | 連携 OAuth 開始できない | 既存の verifyAppCheck と同様の error response、ユーザーに「再ログインしてください」表示 |
| account_links への二重書き込み (連携先 ID が他の primaryUid に既に紐づき) | 別アカウントの乗っ取り恐れ | 連携時に既存ドキュメントが存在するかチェック、自分の primaryUid と異なるなら拒否 |
| ローカル取り込み中の Firestore 書き込み失敗 | 部分的に取り込みされる | atomic batch 化、失敗時はロールバック、エラートースト |
| アバターアップロード中のネットワーク断 | 古いアバター URL のまま | try-catch + エラートースト、Firestore 更新は uploadBytes 成功後のみ |
| 大量のローカルプラン (100+ 件) | 取り込みダイアログが永遠に表示 | 表示は「N 件」と件数のみ、リストは出さない (UX シンプル維持) |
| Vercel 関数枠 (現状 9/12) | 新エンドポイント 2 個追加で 11/12 | mode=link を既存ハンドラに統合、unlink/links は同一エンドポイント (/api/auth/links) に統合可能 |

### 10.1 Vercel 関数枠詳細

新規追加:
- `/api/auth/links` (GET=連携状態取得 / POST=解除) ← 1 関数

既存 `/api/auth?provider=...` は mode=link 分岐で対応 (新エンドポイント追加なし)。

→ 9/12 → **10/12** で 2 枠余裕あり。

---

## 11. 実装サブスペック分解

Phase B を 3 サブスペックに分解、依存関係順に実装:

### Sub-spec B-3: アバター/表示名変更 (土台、最も独立)
- 既存 AvatarCropModal を LoginModal から呼び出し
- 表示名インライン編集
- 工数: 0.5 日
- 依存: なし
- リスク: 低 (既存 API のみ)

### Sub-spec B-1: ローカル取り込み (中、独立)
- `importLocalPlans()` action 追加
- LocalImportDialog 新規コンポーネント
- LoginModal 内明示ボタン追加
- onAuthStateChanged callback 拡張
- 工数: 0.5〜1 日
- 依存: なし
- リスク: 中 (枠制限ロジック・同名衝突の境界値)

### Sub-spec B-2: アカウントリンク (重、最後)
- `account_links/` Firestore コレクション + ルール
- mode=link OAuth 分岐 (Discord/Twitter 両ハンドラ)
- /api/auth/links エンドポイント新設
- ログイン時 lookup 分岐
- AccountLinkSection 新規コンポーネント
- 工数: 1〜1.5 日
- 依存: B-3 完了後 (LoginModal の構造が安定してから連携セクションを足したい)
- リスク: 高 (既存ログインフローへの影響、セキュリティルール、複数 callback 経路)

### 全体工数: 2〜3 日

---

## 12. 実装順序の推奨

1. **B-3** (アバター/表示名) — 既存資産の組み合わせのみ、LoginModal の UI 構造を整理する
2. **B-1** (ローカル取り込み) — 独立した新機能、ユーザー価値最大、リスク中
3. **B-2** (アカウントリンク) — 既存ログインフローに手を入れる、リスク高、最後にやる

各サブスペックごとにコミット → 動作確認 → 次へ進める。B-1 完了時点で push + デプロイし、ユーザー実機検証してから B-2 に進む。

---

**承認後、`superpowers:writing-plans` で 3 サブスペックの実装プランを作成します。**
