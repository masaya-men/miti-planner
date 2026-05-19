# 廃止プロバイダーユーザー残骸削除 設計書 (Step 1 / hash 化マイグレーション 前段)

- **作成日**: 2026-05-20
- **作成者**: masaya-men + Claude (Opus 4.7)
- **対象**: Twitter / Google 廃止プロバイダー由来の残骸ユーザー 14 件を完全削除する一回限りのクリーンアップ
- **位置づけ**: hash 化マイグレーション全体計画の Step 1。 Step 2 (Discord 9 件 hash 化) は別 spec で扱う
- **依存**: なし (Step 2 への前提条件)

---

## 1. 背景と目的

### 1.1 経緯

セッション #39 (2026-05-19) で hash 化マイグレーションの準備中、 Firebase Auth に廃止プロバイダー由来の不要 uid が残っていることを確認した。 内訳:

- **Discord 9 件** (現役、 hash 化対象 — Step 2 で扱う)
- **Twitter 12 件** (廃止プロバイダー、 削除対象 — 実質本人 1 ユーザーの id 変動バグによる重複)
- **Google 2 件** (廃止プロバイダー、 削除対象 — 旧 admin uid 1 件 + 別人 1 件)

ユーザー本人による確認済 (2026-05-19): Twitter 12 件は全て本人由来、 Google 2 件 (旧 admin + 別人) も削除可能。 バックアップは不要 (準備メモ参照、 一部 backup json は既存だが復元予定なし)。

### 1.2 目的

1. **hash 化マイグレーション (Step 2) のテスト対象を Discord 9 件に絞る** — 廃止プロバイダー由来の orphan データが混ざった状態で Step 2 を進めると、 想定外のデータが migration ロジックに引っかかってバグ温床になる
2. **「個人情報持たない原則」 達成の前提条件**を整える — 廃止プロバイダーの実 id プレフィックス (`twitter:...`, `google:...`) を残したまま Step 2 を完了しても、 個人情報残骸は消えない
3. **Firestore のゴミ掃除** — 廃止ユーザーが作成した plans / shared_plans が orphan で残っている。 Phase 3 で BAN 機能を作るときに 「持ち主のいない data」 の扱いに困らないよう、 今のうちに掃除

### 1.3 非ゴール

- Twitter / Google プロバイダー自体の Firebase 設定無効化 (= 既に廃止確定、 別作業で対応)
- hash 化ロジックの実装 (Step 2 で扱う)
- Discord 9 件への変更 (一切触らない)

---

## 2. 削除対象の確定リスト

詳細な uid 列挙は [docs/.private/2026-05-19-hash-migration-prep.md](../../.private/2026-05-19-hash-migration-prep.md) §「23 ユーザー内訳」 を参照 (個人特定可能なため gitignore 配下)。

| プロバイダー | 件数 | 内訳 | admin claim | バックアップ |
|---|---|---|---|---|
| Twitter | 12 | 本人の id 変動残骸 | 全件なし | 一部既存 (不要、 準備メモ参照) |
| Google | 2 | 旧 admin (本人) + 別人 1 件 | 旧 admin は既にクリア済 | なし |
| **合計** | **14** | | **0 件** | |

### 2.1 安全制約 (最終ガード)

スクリプト起動時に以下を assert する:

1. **TARGET_UIDS 14 件の prefix が全て `twitter:` か `google:`** — 1 件でも `discord:` を含んでいたら即 abort (= 本人 Discord uid を含む全ての Discord アカウントを構造的に除外)
2. **admin claim を持つ uid を削除しようとしたら即 abort** — 実行直前に各 uid の `getUser().customClaims` を再取得して確認 (準備メモ時点では 0 件だが念のため、 二重防御)
3. **本人 Discord uid の値は spec には書かない** — 実値は `docs/.private/2026-05-19-hash-migration-prep.md` (gitignore) で参照

---

## 3. 削除スコープ (1 ユーザー分)

1 uid につき以下を全て削除する。 Firebase Auth account は復元不能なので**最後**に消す。

### 3.1 Firestore documents

| 対象 | クエリ / パス | 補足 |
|---|---|---|
| `plans` | `where ownerId == uid` で全件 | batch delete (500 件未満想定) |
| `sharedPlanMeta` | `where ownerId == uid` で全件 | batch delete |
| `shared_plans` | `where ownerId == uid` で全件 | 各 doc の sub-collection `copiedBy/*` および `anonCopiedBy/*` を recursive delete してから本体削除 |
| `userPlanCounts/{uid}` | doc 直接 | 単一 doc |
| `housing_user_meta/{uid}` | doc 直接 | 存在しなければ skip |
| `housing_listings` | `where ownerUid == uid` で全件 | 各 doc の sub-collection `reports/*` を recursive delete してから本体削除 (廃止プロバイダーユーザーがハウジング登録してる可能性は低いが念のため対応) |
| `housing_favorites/{uid}` | sub-collection `items/*` 全件削除後、 本体 doc 削除 | 存在しなければ skip |
| `users/{uid}/featureSessions/*` | sub-collection 全件 | 存在しなければ skip |
| `users/{uid}` | doc 直接 | **Firestore 内では最後** |

### 3.2 Firebase Storage

| 対象 | パス | 補足 |
|---|---|---|
| アバター / ロゴ等 | `users/{uid}/*` 配下全ファイル | `bucket.getFiles({ prefix: 'users/${uid}/' })` で list → 全 delete |

### 3.3 Firebase Authentication

| 対象 | API | 補足 |
|---|---|---|
| Auth account | `getAuth().deleteUser(uid)` | **最後**、 復元不能 |

### 3.4 クロス参照クリーンアップ (廃止 uid が他人のデータに残っている残骸)

廃止ユーザーが「他のユーザーの」 共有プランをコピーしたり、 物件を通報したりしていた場合、 その記録に廃止 uid が field 値として残っている。 機能破壊はしないが、 「個人情報を持たない原則」 を完遂するために dry-run で必ずスキャンし、 hit があれば削除する。

| 対象 | クエリ | 期待件数 | 補足 |
|---|---|---|---|
| `shared_plans/*/copiedBy/{uid}` | 全 `shared_plans` doc をループしつつ `copiedBy/{uid}` doc を直接参照 → exists なら delete | 0 (廃止ユーザーは現役 plan を copy していない想定) | doc id 直接アクセスなので collection group index 不要。 14 uid × N shared_plans doc で完了 |
| `housing_listings/*/reports` の `reporterUid == uid` | 全 `housing_listings` doc をループしつつ各 listing の `reports` sub-collection を `where reporterUid == uid` で query | 0 (廃止ユーザーは Discord 必須のハウジング通報をしていない想定) | sub-collection 単位の query で collection group index 不要。 14 uid × N listings で完了 |

**処理タイミング**: 1 ユーザー分の削除フローの 「Firestore documents 削除直後 / Storage 削除前」 に挿入。 dry-run でも同じスキャンを実行し、 hit 数を出力。 hit が 0 でない場合は実行前に人間レビューを再度挟む。

---

## 4. スクリプト構造

### 4.1 ファイル配置

新規ファイル: `scripts/delete-legacy-users.ts`

既存の `scripts/check-admin-claims.ts` と同じパターン (firebase-admin SDK 直接呼び出し、 service account credential はローカル `.env.local` から読み込み) で書く。

### 4.2 起動モード

| モード | コマンド | 動作 |
|---|---|---|
| Dry-Run (デフォルト) | `npx tsx scripts/delete-legacy-users.ts` | 全 14 件の uid ごとに削除対象数を pre-count して表形式で出力。 削除はしない |
| Execute | `npx tsx scripts/delete-legacy-users.ts --execute --confirm` | 実削除。 `--execute` だけだと拒否、 `--confirm` 併用が必須 (誤起動防止) |

### 4.3 Dry-Run 出力フォーマット (案)

```
=== DRY RUN: Legacy User Cleanup ===
Target uids: 14 (Twitter 12 + Google 2)

[ 1/14] twitter:abc123...
  - users doc:                exists
  - plans (ownerId match):    3
  - sharedPlanMeta:           0
  - shared_plans:             0 (copiedBy / anonCopiedBy entries: 0 / 0)
  - userPlanCounts:           exists
  - housing_user_meta:        not found
  - housing_listings:         0
  - housing_favorites items:  0
  - featureSessions:          0
  - cross-ref copiedBy hits:  0  (other users' shared_plans where this uid copied)
  - cross-ref reports hits:   0  (other users' listings where reporterUid == this uid)
  - Storage files (users/{uid}/*):  2
  - Auth account:             exists (provider: twitter)
  - admin claim:              none ✓

[ 2/14] twitter:def456...
  ...

=== Summary ===
Total Firestore documents to delete: 47
Total Storage files to delete: 8
Total Auth accounts to delete: 14
Admin claim hits (must be 0): 0 ✓
Re-run with --execute --confirm to perform deletion.
```

### 4.4 Execute 時の処理フロー

```
1. assert prefix (all twitter: or google:)
2. assert no discord: in TARGET_UIDS
3. for each uid in TARGET_UIDS sequential:
   a. re-fetch customClaims → assert no admin
   b. delete Firestore (in order documented in §3.1)
   c. clean cross-references (§3.4): copiedBy / reports
   d. delete Storage files
   e. delete Auth account
   f. log progress: [n/14] Done uid (X docs, Y cross-refs, Z files, auth deleted)
4. Final: print summary
   - successful deletes: 14/14
   - skipped (already gone): X
   - errors: Y
```

### 4.5 エラー時の挙動

| 状況 | 挙動 |
|---|---|
| prefix / admin assert 失敗 | 即 abort、 削除一切しない |
| Firestore doc が既に存在しない | skip して続行 (idempotent) |
| Storage file が既に存在しない | skip して続行 |
| Auth `auth/user-not-found` | skip して続行 |
| その他の予期せぬエラー | **即 abort**、 詳細ログ出力。 「現在 n 件まで処理済、 残り (14 - n) 件未着手」 を明示 |

「即 abort」 を選ぶ理由: 部分削除状態のままで盲目的に続行するより、 一度止めて状況を人間が把握してから再開する方が安全。 idempotent なので、 修正後の再実行で 「すでに消えてるものは skip」 して途中から続行できる。

---

## 5. 削除前後の検証

### 5.1 Dry-Run 結果の人間レビュー

`npx tsx scripts/delete-legacy-users.ts` を実行して dry-run 出力を確認:

- 14 件の合計削除 doc 数が 想定範囲か (準備メモから想定: 30-60 docs 程度)
- admin claim hits == 0 か
- 想定外のハウジング登録 (housing_listings ヒット) がないか
- 想定外の shared_plans が他人にコピーされて popular になってないか (= Step 1 で消すと困らないか)

このレビューがユーザー (本人) の最終承認ゲートとなる。

### 5.2 Execute 後の trace 検証

実削除完了後、 以下を実行して残骸ゼロを確認:

1. **`npx tsx scripts/check-admin-claims.ts` 再実行**
   - 期待結果: 全 Auth ユーザー数が **9 件** (Discord 9 件のみ。 実行中の新規 signup があれば +N、 その場合は新規 uid を個別確認)
   - admin claim 保有: **1 件のみ** (本人 Discord uid、 実値は gitignore 配下の準備メモ参照)
2. **Firestore Console での spot check (任意)**
   - `plans` collection で `ownerId` field が `twitter:` または `google:` で始まる doc が 0 件
   - `shared_plans` 同様
   - `housing_listings.ownerUid` 同様
3. **Firebase Storage Console での spot check (任意)**
   - `users/twitter:*` / `users/google:*` フォルダが消えている

### 5.3 想定影響範囲 (= 既存機能が壊れないかの確認)

| 対象 | 影響 |
|---|---|
| 本人 Discord uid + admin 機能 | **影響なし** (prefix assert + admin assert で守る) |
| 既存 Discord 8 ユーザー | **影響なし** (別 doc / 別 uid) |
| 軽減表ページの popular 機能 | shared_plans を 1 ユーザー (実質 Twitter 残骸の 1 人) が共有していた場合 → コピー済みの他人の plans は別 collection に複製されてるので **影響なし**。 まだコピーしてない人が共有 URL を踏むと 404 になる (= 廃止ユーザーの共有 URL を踏む人はほぼいない想定) |
| ハウジング登録 (Discord 必須) | **影響なし** (Discord 9 件は一切触らない) |
| Vercel デプロイ | **不要** (scripts/ のみの変更、 本番動作に影響なし) |

---

## 6. テスト戦略

### 6.1 Unit test の要否

Step 1 は **一回限りの一方向 cleanup** であり、 idempotent なロジックなので unit test は過剰。 代わりに以下で確実性を担保する:

1. **Dry-Run 出力の人間レビュー** (§5.1) — 削除対象が確定リストと一致するか目視確認
2. **Prefix / admin assert** (§2.1) — コード内 assert で守る、 1 件でも違反したら abort
3. **Idempotent 設計** — 失敗時の部分削除状態から再開可能

### 6.2 Dev 環境での動作確認

Step 1 は本質的に prod 専用の cleanup なので、 dev 環境では実行できない (= 削除対象ユーザーが dev に存在しない)。 代わりに:

- **`--execute --confirm` を付けずに dry-run のみを** dev 環境 (もしくは prod に向けた状態) で実行して、 スクリプトの動作を検証
- Dry-Run 出力が想定通り (14 件、 admin 0、 削除対象 doc 数が現実的) であることを確認してから本実行

---

## 7. 段階実施計画

### Phase 1: スクリプト作成

1. `scripts/delete-legacy-users.ts` を新規作成
2. TARGET_UIDS 14 件を hardcode (準備メモから転記)
3. Dry-Run モードを先に完成させて動作確認 (この時点では実削除コードは未実装でも OK、 順序的には dry-run 先)
4. Execute モードを追加実装

### Phase 2: 人間レビュー

1. ローカルで dry-run 実行 → 出力をユーザーに見せる
2. 想定通りなら次へ、 想定外があれば原因を調査 (例: housing_listings に Twitter ユーザーがいるなら、 そのユーザーをどう扱うか判断)

### Phase 3: 実削除

1. `--execute --confirm` で本実行
2. 全 14 件削除完了を確認
3. `scripts/check-admin-claims.ts` 再実行で残骸ゼロを確認

### Phase 4: Step 2 への引き継ぎ

1. Step 1 完了 = hash 化対象は Discord 9 件のみに確定
2. Step 2 (hash 化マイグレーション本体) の brainstorming へ移行

---

## 8. ロールバック可能性

| 項目 | ロールバック可否 | 補足 |
|---|---|---|
| Firestore document 削除 | **不可** (バックアップなしで実行) | ユーザー本人確認済みで復元不要 |
| Storage file 削除 | **不可** | 同上 |
| Auth account 削除 | **不可** (Firebase の仕様) | 同 uid での新規 signup は別 uid 扱い |

「ロールバック不可」 を受け入れる根拠:

1. ユーザー本人による確認済 (2026-05-19)
2. admin 無し、 ハウジング登録なし期待 (dry-run で再確認)
3. Twitter 12 件は本人由来、 Google 2 件は本人 (旧 admin) + 別人 — 別人 1 件の同意は取らないが、 廃止プロバイダー由来でログイン不能のため利用継続不能
4. データ消失リスクより、 hash 化マイグレーション (Step 2) を綺麗な状態で進める利益が大きい

---

## 9. 参照リンク

- 準備メモ (個人特定情報含む、 gitignore): [docs/.private/2026-05-19-hash-migration-prep.md](../../.private/2026-05-19-hash-migration-prep.md)
- Custom Claims 確認スクリプト (既存): [scripts/check-admin-claims.ts](../../../scripts/check-admin-claims.ts)
- ユーザーデータバックアップスクリプト (既存、 本 Step 1 では未使用): [scripts/backup-user-data.ts](../../../scripts/backup-user-data.ts)
- Firestore Rules: [firestore.rules](../../../firestore.rules)
- hash 化マイグレーション全体: Step 2 design は別途作成 (2026-05-20 以降)
