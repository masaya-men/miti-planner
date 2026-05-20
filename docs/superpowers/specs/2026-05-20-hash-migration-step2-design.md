# hash 化マイグレーション 設計書 (Step 2 / hash 化本体)

- **作成日**: 2026-05-20
- **作成者**: masaya-men + Claude (Opus 4.7)
- **対象**: Discord 10 件の uid を `discord:<生 ID>` → `hashed:<HMAC-SHA256(id+secret)>` に一斉移行する一回限りのマイグレーション
- **位置づけ**: hash 化マイグレーション全体計画の Step 2 (本体)。 Step 1 (廃止プロバイダー削除) は 2026-05-20 完了済
- **依存**: Step 1 完了が前提 (prod に Discord 10 件のみ存在する状態)

---

## 1. 背景と目的

### 1.1 経緯

セッション #39 (2026-05-19) で、 認証実装 ([api/auth/_discordHandler.ts:148](../../../api/auth/_discordHandler.ts#L148)) が `firebaseUid = \`discord:${discordUserId}\`` として Discord 生 ID をそのまま Firebase uid のプレフィックスに使っていることが判明した。 これにより:

- LoPo 管理者 (本人) は Firestore Console を開けば `ownerUid: discord:12345` から元 Discord ID を復元可能
- 技術的には Discord で個別 DM を送信可能 (= 「LoPo は連絡できない」 を厳密には保証できない)
- データ漏洩した場合、 元 Discord ID がそのまま流出 (= LoPo 利用者の Discord アカウントが特定される)

memory `feedback_auth_privacy.md` の方針 (「Discord/Twitter から id だけ取り出して即破棄、 Firebase uid は `discord:${id}` 形式」) とは整合しているが、 「LoPo 内部からも誰かわからない」 レベル (= GDPR の pseudonymization 完全達成) には届いていない。

### 1.2 目的

Discord 10 件の uid を以下の形式に移行する:

```
discord:<生 ID>  →  hashed:<HMAC-SHA256(discord_id, LOPO_PSEUDONYM_SECRET)>
```

これにより:

1. **LoPo 内部からも元 Discord ID 復元不能**: `hashed:abc123...` から元の Discord ID への逆引きは secret なしでは数学的に不可能 (sha256 の一方向性 + secret の長さ 32 bytes)
2. **データ漏洩耐性**: Firestore / Storage / Auth どのデータが漏れても、 secret が漏れない限り Discord ID は復元できない
3. **プライバシーポリシーの主張が真**: 「LoPo は元の Discord ID を保存せず、 LoPo 内部でも復元できない」 を文字通りの意味で書ける

### 1.3 非ゴール

- Custom Token から ID Token への切り替え (= 別議題、 別 spec)
- Discord 以外のプロバイダー対応 (Step 1 で削除済、 当面再開予定なし)
- ハウジング Phase 2 / Phase 3 機能の実装 (= 別 spec)
- admin_logs の actorUid 移行 (= ユーザー判断で対象外、 §3.5 参照)

---

## 2. hash アルゴリズムと secret 管理

### 2.1 hash アルゴリズム: HMAC-SHA256

```typescript
import { createHmac } from 'node:crypto';

export function hashUid(discordId: string, secret: string): string {
    return 'hashed:' + createHmac('sha256', secret).update(discordId).digest('hex');
}
```

**選択理由**:
- HMAC は 「secret と入力を正しく混ぜる」 ための業界標準プリミティブ
- Node.js 標準 `crypto` モジュールで 1 行実装可能
- length-extension attack に耐性あり (今回の用途では実害なしだが、 念のため)
- 単純連結 (`sha256(id + secret)`) と実用上同等の強度だが、 ベストプラクティスに従う
- Argon2id / scrypt は password hashing 用 KDF であり、 短い ID の pseudonymization には不適切 (時間がかかるだけで効果なし)

**出力例 (Discord ID は架空)**:
```
discord:000000000000000000
  ↓
hashed:8f2c1a9b3d4e5f6...  (64 文字の hex)
```

### 2.2 secret 管理: `LOPO_PSEUDONYM_SECRET`

| 項目 | 仕様 |
|---|---|
| 環境変数名 | `LOPO_PSEUDONYM_SECRET` |
| 値の生成 | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` で 64 文字 hex |
| 配備 | Vercel sensitive (prod / preview / dev 全環境同一値) |
| ローカル | masaya-men さんの `.env.local` に同じ値 |
| バックアップ | 1Password 等のパスワードマネージャに最低 1 箇所保管 |
| **rotation** | **不可** (失われたら全 hash 化データの参照が永遠に不能になる) |

**全環境同一値の理由**: LoPo は Firebase プロジェクトが本番 1 個 (`lopo-7793e`) のみで、 dev / preview / prod 全て同じ Firebase を見ている。 環境別 secret を使うと dev で生成した hashed uid が prod のデータと一致しなくなり、 開発時に本人 uid でログインできなくなる。

**漏洩リスク**: secret が漏れると hash の逆引き (brute force) が現実的になる可能性は依然として低い (Discord ID は 17-19 桁の数字 = 探索空間 10^18 程度) が、 secret は徹底的にローカル + Vercel sensitive のみで管理する。

---

## 3. migration 対象と非対象

### 3.1 対象 uid: Discord 10 件

詳細な uid 列挙は [docs/.private/2026-05-19-hash-migration-prep.md](../../.private/2026-05-19-hash-migration-prep.md) §「23 ユーザー内訳」 を参照 (個人特定可能なため gitignore 配下)。

| プロバイダー | 件数 | admin claim | 備考 |
|---|---|---|---|
| Discord | **10** | 1 件 (本人) | Step 1 後の最新状態 (prep memo 時点 9 件 + 新規 signup 1 件) |

### 3.2 安全制約 (Step 1 と同様)

スクリプト起動時に以下を assert する:

1. **TARGET_UIDS の全 prefix が `discord:`** — 1 件でも `hashed:` / `twitter:` / `google:` が混ざっていたら abort
2. **admin claim を持つ uid を移行する場合は事前に明示確認** — 削除ではないので abort はしないが、 dry-run で「admin claim 1 件あり (新 uid に再付与予定)」 と表示
3. **本人 Discord uid の値は spec には書かない** — 実値は gitignore 配下の準備メモを参照

### 3.3 migration が必要な Firestore コレクション/フィールド

[Step 1 設計書](2026-05-20-legacy-user-cleanup-design.md) と Explore agent の網羅調査結果に基づく完全リスト:

| 種別 | 対象 | 移行方法 |
|---|---|---|
| **doc id が uid** | `users/{uid}` | 旧 doc 読込 → 新 uid で create → 旧 doc delete |
| | `userPlanCounts/{uid}` | 同上 |
| | `housing_user_meta/{uid}` | 同上 (存在する場合のみ) |
| | `housing_favorites/{uid}` (subcoll `items/*` 含む) | 新 uid の doc + subcoll に全件 copy → 旧 delete |
| | `users/{uid}/featureSessions/*` | 新 uid の subcoll に全件 copy → 旧 delete |
| | `shared_plans/*/copiedBy/{uid}` (=他人の共有プランをコピーした履歴) | 全 shared_plans 走査 → `copiedBy/{oldUid}` 存在チェック → 新 uid で再作成 → 旧 delete |
| **フィールド値が uid** | `plans.ownerId` | `where ownerId == oldUid` で全件 → batched update to newUid |
| | `sharedPlanMeta.ownerId` | 同上 |
| | `shared_plans.ownerId` | 同上 |
| | `housing_listings.ownerUid` | 同上 (`where ownerUid == oldUid`) |
| | `housing_listings/*/reports.reporterUid` | 全 listing 走査 → reports subcoll を `where reporterUid == oldUid` で update |
| | `housing_tours.ownerUid` | `where ownerUid == oldUid` (Phase 2 未着手で実データなし想定、 あれば update) |

### 3.4 Firebase Storage の移行

| 種別 | 対象 | 移行方法 |
|---|---|---|
| アバター / ロゴ | `users/{uid}/avatar.webp`, `users/{uid}/team-logo.{jpg,webp}` | `bucket.file(oldPath).copy(newPath)` → 旧 delete |

Firebase Storage には rename API がないため、 「コピー → 旧削除」 の 2 段階。 コピー成功を確認した後に旧削除する (途中失敗しても旧データは残存)。

### 3.5 移行**しない**対象 (= 意図的に除外)

| 対象 | 理由 |
|---|---|
| `admin_logs.actorUid` | masaya-men さん判断 (2026-05-20)。 admin が本人 1 名のみのため個人特定リスクが低く、 過去の audit log を改変しないポリシー優先 |
| `shared_plans/*/anonCopiedBy/{anonId}` | `anonId` は uid ではなくランダム文字列 (匿名コピー用)、 prefix なし |
| プライバシーポリシーの過去版 | バージョン管理は別の話、 文章のみ更新 (§7 参照) |

### 3.6 Custom Claims の移行

- 旧 uid に admin claim (`role: 'admin'`) があれば、 新 uid 作成直後に同じ claim を付与する
- Firebase Auth の `setCustomUserClaims(newUid, oldClaims)` を呼ぶ
- Custom Claims の伝播 (約 1 時間の cache) があるため、 移行直後の admin 機能利用は token refresh が必要

---

## 4. スクリプト構造

### 4.1 ファイル配置

| 種別 | パス | 責任 |
|---|---|---|
| 新規 (gitignored) | `docs/.private/hash-migration-target-uids.json` | TARGET_UIDS 10 件の実値 |
| 新規 | `scripts/hash-migrate-users.ts` | 本体スクリプト (Dry-run + Execute + Rollback) |
| 新規 | `scripts/__tests__/hash-migrate-users.test.ts` | Pure logic (hashUid 関数、 parseFlags、 prefix 検証) の vitest テスト |
| 新規 | `api/_lib/hashUid.ts` | server-side 専用 HMAC-SHA256 ヘルパー (api/ 配下なのでクライアントバンドル混入リスクゼロ) |
| 既存 (modify) | `api/auth/_discordHandler.ts` | uid 生成を hashed: に変更 |
| 既存 (modify) | `src/components/LoginModal.tsx` | prefix チェックを撤廃 (provider は常に Discord) |
| 既存 (modify) | `src/components/WelcomeSetup.tsx` | 同上 |
| 既存 (modify) | `src/utils/logoUpload.ts` | 同上 |
| 既存 (modify) | `scripts/check-admin-claims.ts` | `hashed:` prefix に対応 |
| 新規 (gitignored) | `docs/.private/backups/2026-05-20-pre-hash/*.json` | 事前 backup 出力先 |

### 4.2 起動モード

| モード | コマンド | 動作 |
|---|---|---|
| **Backup** | `npx tsx scripts/hash-migrate-users.ts --backup` | 全 10 件の事前 backup を JSON に出力。 migration はしない |
| **Dry-Run** (デフォルト) | `npx tsx scripts/hash-migrate-users.ts` | 全 10 件の移行プランを pre-count 表示。 backup の存在も verify。 migration はしない |
| **Execute (人柱モード)** | `npx tsx scripts/hash-migrate-users.ts --execute --confirm --only=<oldUid>` | 1 件のみ migration。 本人 uid で最初に検証 |
| **Execute (本実行)** | `npx tsx scripts/hash-migrate-users.ts --execute --confirm` | 全 10 件 migration |
| **Rollback** | `npx tsx scripts/hash-migrate-users.ts --rollback --confirm --uid=<oldUid>` | 指定 uid のみ事前 backup から復元 |

### 4.3 Dry-Run 出力フォーマット (案)

```
=== DRY RUN: Hash Migration (Step 2) ===
Target uids: 10
Backup verified: docs/.private/backups/2026-05-20-pre-hash/*.json (10 files) ✓

[ 1/10] discord:000000000000000000 → hashed:8f2c1a9b3d4e5f6...
  - users doc:                exists
  - plans (ownerId match):    N
  - sharedPlanMeta:           N
  - shared_plans:             N (copiedBy/anonCopiedBy: N/N)
  - userPlanCounts:           exists
  - housing_user_meta:        exists
  - housing_listings:         N (reports: N)
  - housing_favorites items:  N
  - housing_tours:            N
  - featureSessions:          N
  - cross-ref copiedBy hits:  N  (このユーザーが他人の共有プランをコピー)
  - cross-ref reports hits:   N  (このユーザーが他人の物件を通報)
  - Storage files:            N
  - Auth account:             exists (provider: discord)
  - admin claim:              YES (will re-apply to new uid)

[ 2/10] discord:111111111111111111 → hashed:7e1b0c8a2c3d4e5...
  ...

=== Summary ===
Total Firestore writes (creates + updates + deletes): N
Total Storage copy + delete operations: N
Total Auth account create + delete: 10 + 10 = 20
Admin claim re-applications: 1
Pre-migration backup files: 10/10 ✓

Re-run with --execute --confirm to perform migration (all 10 uids at once).
Or with --execute --confirm --only=<oldUid> for single-uid (recommended for first run).
```

### 4.4 Execute 時の per-user フロー

```
for each oldUid in TARGET_UIDS:
  0. **「窓」 対策**: newUid (これから作る hashed: uid) の Auth ユーザーが既に存在するかチェック
     (= デプロイ後 migration 前に誰かが先回りログインして空アカウントを作っていないか確認)
     - 存在する場合:
       - そのアカウントに紐づくデータ件数を計上 (通常はゼロ件、 もしあれば backup に追記して保全)
       - 該当アカウントを deleteUser で削除
       - 「窓」 対策ログ出力: "Pre-existing newUid found and removed: X docs preserved to backup"
     - 存在しない場合: 通常通り進む
  1. 直前再確認: oldUid の Auth ユーザーが存在するか? admin claim を保持しているか?
  2. 新 uid 計算: newUid = `hashed:` + HMAC-SHA256(oldUid.replace('discord:', ''), secret)
  3. per-user 直前 backup (メモリ内 + disk 二重):
     - users/{oldUid} doc
     - 関連 Firestore doc 全件 (3.3 参照)
     - Storage ファイルメタデータ (実体はコピー前)
     - Auth user metadata + custom claims
  4. 新 uid で Auth ユーザー作成: auth.createUser({ uid: newUid })
  5. 旧 uid から admin claim を読み取り、 あれば新 uid に setCustomUserClaims
  6. Firestore 一括 copy (3.3 全リスト):
     - doc id が uid のもの: 新 uid で create
     - フィールド値が uid のもの: 全件 update
     - cross-references (他人のデータに残る oldUid): 全件 update
  7. Storage copy: users/{oldUid}/* を users/{newUid}/* に copy
  8. Verify: 新 uid 側のデータ件数が旧側と一致するか確認
  9. 旧 uid 全削除 (Step 1 の delete-legacy-users と同じ要領):
     - Firestore doc 全削除
     - Storage 全削除
     - Auth user 削除
  10. ログ出力: [n/10] Done oldUid → newUid (X copies, Y deletes)
  11. 失敗時: per-user rollback (auto)
      - 新 uid 側の作成済み doc / Storage / Auth を全削除
      - 旧 uid 側は手付かずで残るのでデータ無事
      - エラー詳細を出力 → 人間判断を仰ぐ
```

### 4.5 Rollback 関数 (`--rollback`)

backup ファイルから 1 uid を復元する一方向操作。 migration 中に予期せぬ失敗があり、 4.4 の自動 rollback でも復旧できない場合の最終手段。

```
1. backup ファイル読み込み (docs/.private/backups/2026-05-20-pre-hash/<oldUid>.json)
2. 新 uid 側に作成された doc / Storage / Auth ユーザーを全削除
3. 旧 uid 側 (もし削除済みなら) を backup から復元:
   - Auth user 再作成
   - admin claim 再付与
   - Firestore docs を backup JSON から re-create
   - Storage files は元 path に再アップロード
4. ログ出力: Rollback complete for <oldUid>
```

### 4.6 Idempotency

スクリプトは複数回実行しても安全:
- backup モード: 既存ファイルがあれば skip (上書きしない)
- dry-run: 副作用なし
- execute: 既に hash 化済みの uid (= prefix が `hashed:`) は skip
- rollback: backup が無ければエラー、 あれば冪等に復元

---

## 5. アプリ側コード変更

### 5.1 変更ファイル (migration 完了直後に同時 push)

| ファイル | 変更内容 |
|---|---|
| `api/_lib/hashUid.ts` (新規) | HMAC-SHA256 ヘルパー関数を export。 `api/` 配下なので Vercel serverless functions だけが import 可能、 クライアントバンドルに混入する経路がない |
| `api/auth/_discordHandler.ts:148` | `firebaseUid = \`discord:${id}\`` → `firebaseUid = hashUid(id, process.env.LOPO_PSEUDONYM_SECRET!)` |
| `src/components/LoginModal.tsx:240` | `{user.uid.startsWith('discord:') ? 'Discord' : ''}` → `{'Discord'}` (廃止プロバイダーいないため常に Discord) |
| `src/components/WelcomeSetup.tsx:57` | `const provider = user.uid.startsWith('discord:') ? 'discord' : 'twitter'` → `const provider = 'discord' as const` |
| `src/utils/logoUpload.ts:78` | 同上 |
| `scripts/check-admin-claims.ts:53-54` | `uid.startsWith('discord:')` / `uid.startsWith('twitter:')` → `uid.startsWith('hashed:')` で統一 |

### 5.2 `api/_lib/hashUid.ts` の実装

```typescript
import { createHmac } from 'node:crypto';

/**
 * Discord ID を pseudonymous な Firebase uid に変換する。
 *
 * 元の Discord ID は LoPo 内部でも復元できない (one-way hash + server-side secret)。
 * secret が失われると過去全データの参照が永遠に不能になるので、 必ず多重バックアップすること。
 *
 * @param discordId - Discord OAuth から取得した数値 ID (17〜19 桁の数字文字列)
 * @param secret - LOPO_PSEUDONYM_SECRET 環境変数の値 (64 文字 hex)
 * @returns `hashed:` プレフィックス + HMAC-SHA256 hex
 */
export function hashUid(discordId: string, secret: string): string {
    if (!secret || secret.length < 32) {
        throw new Error('LOPO_PSEUDONYM_SECRET が未設定または短すぎます (32 文字以上の hex を期待)');
    }
    return 'hashed:' + createHmac('sha256', secret).update(discordId).digest('hex');
}
```

**配置理由**: `api/_lib/` (アンダースコア prefix) は Vercel serverless functions の内部ヘルパー専用ディレクトリ。 import 経路がサーバー側 (`api/auth/_discordHandler.ts` 等) のみで、 Vite のクライアントバンドルから物理的に参照不能。 `src/lib/` に置くと将来うっかりクライアントから import される可能性があるため、 `api/_lib/` を採用。

migration スクリプト (`scripts/hash-migrate-users.ts`) も同じ関数を使うが、 scripts は Node.js で直接実行されるため `api/_lib/hashUid.ts` を import すれば良い (Vite ビルドを通らない)。

### 5.3 i18n 変更

なし。 UI 表示テキストの変更を伴わない (provider 表示が `'Discord'` 固定になるだけ)。

---

## 6. 実行順序とデプロイ

### 6.1 事前準備 (1 日前 〜 数時間前)

1. **secret 生成**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` で 64 文字 hex を生成 (Claude が実行 → masaya-men さんがコピー)
2. **secret 保管**:
   - masaya-men さんの `.env.local` に `LOPO_PSEUDONYM_SECRET=<value>` を追記
   - 1Password 等の信頼できるパスワードマネージャに保存
   - 「失うと全データ参照不能」 と明示メモを添える
3. **Vercel 環境変数追加**: ダッシュボードから `LOPO_PSEUDONYM_SECRET` を sensitive で prod / preview / dev 全環境に追加
4. **TARGET_UIDS JSON 作成**: `docs/.private/2026-05-19-hash-migration-prep.md` から Discord 10 件の uid を `docs/.private/hash-migration-target-uids.json` に転記

### 6.2 本実行 (静かな時間帯を選ぶ。 masaya-men さんは平日昼間で OK と判断)

**重要**: コード変更を**先に**デプロイし、 その後 migration を実行する。 逆順だと旧コードが `discord:` uid を生成し続け、 migration で新 uid に移したデータを参照できなくなる (詳細は §6.3)。

```
Phase A: 事前 backup
  1. npx tsx scripts/hash-migrate-users.ts --backup
  2. docs/.private/backups/2026-05-20-pre-hash/ に 10 件の JSON が出力されたことを確認

Phase B: Dry-Run
  3. npx tsx scripts/hash-migrate-users.ts
  4. 出力を目視確認 (Summary 行が想定値か、 admin 1 件検出されているか)

Phase C: アプリ側コードのデプロイ (= migration より先!)
  5. アプリ側変更 (§5.1) を 1 commit にまとめる
  6. rtk git push
  7. Vercel 自動デプロイを待つ (1-2 分)
  8. デプロイ完了確認 (Vercel ダッシュボード)
  9. **この時点で、 新規ログインがあると hashed: uid の空 Auth user が作成される可能性がある**
     (= 「窓」 が開く。 §6.3 参照)。 すぐに Phase D に進む

Phase D: 人柱 migration (本人 uid のみ)
  10. npx tsx scripts/hash-migrate-users.ts --execute --confirm --only=discord:<本人 uid>
      → スクリプトが Phase C で誰かが先回りログインして hashed: 空 Auth user を作っていたら検出して
        その人の (空) Auth user を削除してから移行を実施する (= §4.4 Step 0 で対応)
  11. masaya-men さんが LoPo を再読み込み → 旧トークンが無効化されてログイン画面が表示される
  12. Discord ボタンクリック → 新コードが hashed: token を生成 → migration 済の hashed: Auth ユーザーでログイン成立
  13. 自分の軽減表 / ハウジング登録 / アバター / admin 画面アクセスが全て正常か確認
  14. (このまま 5-10 分 LoPo を触り続けて、 不審な挙動がないか観察)

Phase E: 残り 9 件本実行
  15. npx tsx scripts/hash-migrate-users.ts --execute --confirm
      (--only なしで、 既に hash 化済の本人 uid は skip、 残り 9 件のみ処理)
  16. 完了ログを確認

Phase F: 最終検証
  17. npx tsx scripts/check-admin-claims.ts 実行 → 全 10 件が hashed: prefix、 admin 1 件
  18. Firestore Console で plans / housing_listings の spot check (discord: prefix が残っていないか)
  19. masaya-men さんがもう一度 LoPo に再ログイン → 全機能正常確認

Phase G: プライバシーポリシー更新 (別 commit)
  20. §7 の通り更新
  21. rtk git push → Vercel デプロイ
```

### 6.3 タイミング上の重要事項

#### なぜ「コードデプロイ → migration」 の順か

| 順序 | 問題 |
|---|---|
| **migration → デプロイ** (NG) | 旧コードが残っている間、 ログイン試行があると discord:<id> token が発行される。 migration で discord:<id> Auth ユーザーは削除済 → signInWithCustomToken が**新規空アカウントを暗黙作成**する。 ユーザーは軽減表もハウジングも空に見える (実データは hashed:<id> 側にある)。 致命的 |
| **デプロイ → migration** (OK / 採用) | 新コードが hashed:<id> token を発行。 migration 完了後は問題なく動作。 デプロイ完了から migration 開始の間に「窓」 が開くが、 影響は限定的 (下記) |

#### Phase C 完了 〜 Phase D 完了の「窓」 (約 1-3 分) のリスク

- 新コードはデプロイ済、 でも migration は未実施 = hashed:<id> Auth ユーザーがまだ存在しない
- この間に誰かが新規ログインすると:
  - 新コード → hashed:<id> token 発行
  - signInWithCustomToken → hashed:<id> Auth ユーザーが**新規空**で作成される (実データは discord:<id> 側にある)
  - ユーザーには「軽減表が空に見える」 状態が一時的に発生
- **対策**: migration スクリプトの per-user 処理冒頭で「hashed:<新 uid> Auth ユーザーが既に存在するか」 を確認し、 もし存在したらその空アカウントを削除してから本来の migration を進める (§4.4 Step 0)
- Discord 10 人 + 平日昼間 + 窓は数分のみなので、 実際に該当するユーザーが出る確率は低い

#### 既ログインユーザーの体験

- Phase C デプロイ後も、 既に discord:<id> token を持つ既ログインユーザーは引き続き普通に LoPo を使える (token 有効期間は約 1 時間)
- Phase D/E で各ユーザーの discord:<id> Auth ユーザーが削除されると、 そのタイミングで session が無効化される
- ユーザー視点では「ログアウトされた」 → 「Discord でログイン」 → 「全データ復帰」 で完了 (論点 5 で合意した通り何も特別な UI は出さない)

### 6.4 失敗時の対応マトリックス

| Phase | 失敗内容 | 対応 |
|---|---|---|
| A (backup) | ファイル生成失敗 | 原因調査 (disk full / 権限) → 再実行 |
| B (dry-run) | 想定外の件数 / admin 検出 | 内容確認 → 設計見直し or 続行判断 |
| C (人柱) | 本人 migration 失敗 | per-user rollback 自動実行 → 旧 uid 復活 → ログイン可能 → 原因調査 |
| C (本人ログイン NG) | migration 後にログイン不能 | secret の Vercel/local 不一致 / コード未デプロイ等を疑う。 最悪 `--rollback --uid=<本人 uid>` で復元 |
| D (残り 9 件) | 途中失敗 | 失敗した 1 件のみ per-user rollback 自動 → 既に成功した分は維持 → 失敗原因調査後に残りを再実行 |
| E (Vercel デプロイ失敗) | ビルドエラー等 | 即原因修正 + 再 push。 旧コードのまま → 新 hashed: uid でログイン試行は失敗 (一時的にサービス停止状態) |
| F (検証で異常) | 軽減表が空 / アバター消失等 | 該当 uid を `--rollback` で復元 → 原因調査 |

---

## 7. プライバシーポリシー更新

### 7.1 更新対象

| ファイル | 内容 |
|---|---|
| `docs/superpowers/specs/2026-03-30-privacy-policy-update-design.md` (or 後継 spec) | Step 2 完了に伴うポリシー変更内容を追記 |
| LP の `/privacy` ページ (`src/i18n/locales/{ja,en,ko,zh}.json` の privacy section) | hash 化を明記 |

### 7.2 追加文言 (ja 原文)

```
LoPo は Discord のユーザー ID を、 サーバー側で保管している秘密鍵と組み合わせて
HMAC-SHA256 で hash 化した値のみを保存します。 元の Discord ID は LoPo の
データベースには一切保存されず、 LoPo 運営者を含む LoPo 内部からも復元することは
できません。

この hash 化により、 万が一 LoPo のデータが漏洩した場合でも、 利用者の Discord
アカウントが特定されるリスクは極めて低くなります。
```

(環境変数名 `LOPO_PSEUDONYM_SECRET` のような実装詳細はユーザー向け文章には含めない)

i18n: ja / en / ko / zh の 4 言語で同等の文言を追加 (i18n キー追加)。

---

## 8. テスト戦略

### 8.1 vitest unit test (`scripts/__tests__/hash-migrate-users.test.ts`)

| テスト | 内容 |
|---|---|
| `hashUid` 決定性 | 同じ入力で常に同じ出力 (10 回試行) |
| `hashUid` secret なしで throw | secret 引数が空文字 / undefined で例外 |
| `hashUid` 形式 | `^hashed:[0-9a-f]{64}$` にマッチ |
| `hashUid` 入力依存性 | 異なる discordId で異なる出力 |
| `hashUid` secret 依存性 | 同じ discordId でも secret が違えば異なる出力 |
| `parseFlags` | `--backup` / `--execute --confirm` / `--rollback --uid=X` / `--only=X` の組み合わせ |
| `assertPrefixSafe` | `discord:` 以外を混ぜると throw |

### 8.2 Firebase 実 IO 部分

Step 1 と同じ方針: **unit test 過剰、 dry-run 出力を「テスト」 扱い + 人柱テスト (Phase C) を事実上の integration test とする**。

### 8.3 Dev 環境での動作確認

Firebase が本番 1 個のみのため dev 環境では再現困難。 代替策:

- **空の Vercel preview 環境で auth handler のコード変更を試す**: Vercel preview デプロイで `LOPO_PSEUDONYM_SECRET` が読めるか、 hash 化された uid が生成されるか確認 (ただし実 Firebase に書き込みは行わないようにする = preview からのログインを避ける)
- **scripts/hash-migrate-users.ts は dry-run で全パスを通す**: --execute なしの状態で 10 件分の集計が全て成功するか確認

---

## 9. ロールバック可能性

| 項目 | ロールバック可否 | 補足 |
|---|---|---|
| 1 uid の migration | **可** | per-user backup から自動復元 (4.4 の Step 11) / 手動 (--rollback) |
| 全 10 件 migration | **可** | 事前 backup から個別に rollback 可能 |
| secret 漏洩 | **不可** | rotation 不可なので、 漏洩しないよう徹底管理 |
| `LOPO_PSEUDONYM_SECRET` 紛失 | **不可** | 全 hash 化データが永遠に参照不能 (= サービス停止に近い)。 多重バックアップで防ぐ |
| プライバシーポリシー更新の取り消し | 可 | git revert で対応 |

---

## 10. 完了の定義

- ✅ Discord 10 件全ての uid が `hashed:` prefix になっている
- ✅ `scripts/check-admin-claims.ts` 出力で 「総ユーザー数 10、 admin 1 (本人 hashed: uid)」 を確認できる
- ✅ Firestore に `discord:` prefix で始まる ownerId / actorUid / reporterUid 等のフィールドが残っていない (admin_logs.actorUid を除く、 これは意図的に除外)
- ✅ Firebase Storage に `users/discord:*` パスが残っていない
- ✅ masaya-men さんの再ログインで全機能 (軽減表 / 共有 / ハウジング / アバター / admin) が正常動作
- ✅ アプリ側コード変更 (§5.1) が deployed
- ✅ プライバシーポリシー更新 deploy 済
- ✅ `LOPO_PSEUDONYM_SECRET` が 1Password + .env.local + Vercel 環境変数の 3 箇所にバックアップ済

---

## 11. 参照リンク

- 準備メモ (個人特定情報含む、 gitignore): [docs/.private/2026-05-19-hash-migration-prep.md](../../.private/2026-05-19-hash-migration-prep.md)
- Step 1 設計書: [2026-05-20-legacy-user-cleanup-design.md](2026-05-20-legacy-user-cleanup-design.md)
- Step 1 実装プラン: [../plans/2026-05-20-legacy-user-cleanup.md](../plans/2026-05-20-legacy-user-cleanup.md)
- Auth 実装: [api/auth/_discordHandler.ts](../../../api/auth/_discordHandler.ts) / [src/store/useAuthStore.ts](../../../src/store/useAuthStore.ts)
- Firestore Rules: [firestore.rules](../../../firestore.rules)
- Storage Rules: [storage.rules](../../../storage.rules)
- 既存 prefix チェック箇所: [src/components/LoginModal.tsx:240](../../../src/components/LoginModal.tsx#L240) / [src/components/WelcomeSetup.tsx:57](../../../src/components/WelcomeSetup.tsx#L57) / [src/utils/logoUpload.ts:78](../../../src/utils/logoUpload.ts#L78)
- 認証プライバシー方針 memory: `feedback_auth_privacy.md`
- プロジェクト進捗 memory: `project_hash_migration_status.md`
