# LoPo 完了済みタスクアーカイブ

このファイルはTODO.mdから移動した完了済みタスクです。思考の邪魔にならないよう分離しています。

## 完了 (2026-05-20 セッション 42・ハウジング ログイン UI 整備)

**目的**: ハウジング (`/housing`) に Discord ログイン UI 一式を導入。 hash 化完了で「LoPo は連絡できません」 が事実として真になった状態で文言適用。

### 完了内容

- 設計書: [docs/superpowers/specs/2026-05-20-housing-login-ui-design.md](superpowers/specs/2026-05-20-housing-login-ui-design.md)
- 実装プラン: [docs/superpowers/plans/2026-05-20-housing-login-ui.md](superpowers/plans/2026-05-20-housing-login-ui.md)
- **戦略 B 採用**: ハウジング専用 UI を新規作成、 認証データ操作ロジックは hook `useAccountActions` で LoPo と共通化
- **新規 hook**: `src/hooks/auth/useAccountActions.ts` (avatar / displayName / signOut / delete 5 操作)
- **新規 store**: `src/store/useHousingModalStore.ts` (login / account / register モーダル状態 + URL クエリ駆動)
- **新規 UI**: `HousingLoginModal.tsx` / `HousingAccountModal.tsx` (ハニーゴールドトンマナ、 HousingPanelModal ラッパー流用)
- **TopBar 右端**: 未ログイン → pill ログインボタン、 ログイン済 → アバター丸 (LoPo の感覚と統一)
- **URL クエリ駆動**: `?register=open` で登録モーダルを開閉、 ブラウザバックで閉じる業界水準 UX
- **モーダルスタッキング**: 登録 (z-50) + ログイン/アカウント (z-60) の 2 層、 data-modal-role 属性で CSS から切替
- **× で閉じる挙動**: 経路 B (登録モーダル経由) では両方一緒に閉じる + URL クリア (`closeLogin` の fromRegister 分岐)
- **i18n**: `housing.login.*` / `housing.account.*` / `housing.topbar.*` の 22 キーを ja 値で追加、 en/ko/zh は空キーで先行 (fallbackLng='ja' + returnEmptyString=false で ja にフォールバック)
- **CSS**: housing.css に 22 クラス + 15 token 追加、 ハードコード 0 件 (housing-design.md 準拠)
- **既存 LoPo の refactor**: `LoginModal.tsx` も同じ `useAccountActions` を使うよう変更 (動作変更ゼロ)

### 6 項目達成状況

| # | 項目 | 状態 |
|---|---|---|
| 1 | ハウジング版 LoginModal | ✅ |
| 2 | ハウジング版 AccountModal (5 機能、 ローカル取込は除外) | ✅ |
| 3 | TopBar 右端 ログイン/アバターボタン | ✅ |
| 4 | モーダルスタッキング (z-50/60、 data-modal-role) | ✅ |
| 5 | ログイン後の登録モーダル復元 (saveReturnUrl 拡張 + ?register=open) | ✅ |
| 6 | × で閉じた時の挙動 (経路 A/B 分岐) | ✅ |

### 結果

ハウジング画面で完全に独立したログイン UI が動作。 LoPo 軽減表側の認証データ操作ロジックは hook 共有でメンテナンス 1 箇所に集約。 hash 化と組み合わせて「LoPo は連絡できない / 個人情報を持たない」 主張が UI 文言で真として伝わる状態に。

## 完了 (2026-05-20 セッション 41・hash 化マイグレーション Step 2 完了)

**目的**: Discord 10 件の Firebase uid を `discord:<生 ID>` → `hashed:<HMAC-SHA256(id+secret)>` に移行し、 LoPo 内部からも元 Discord ID を復元不能にする。 GDPR pseudonymization 完全達成。

### 完了内容

- 設計書: [docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md](superpowers/specs/2026-05-20-hash-migration-step2-design.md)
- 実装プラン: [docs/superpowers/plans/2026-05-20-hash-migration-step2.md](superpowers/plans/2026-05-20-hash-migration-step2.md)
- 新規ヘルパー: `api/_lib/hashUid.ts` (HMAC-SHA256, server-only)
- 新規スクリプト: `scripts/hash-migrate-users.ts` (backup/dry-run/execute/rollback) / `scripts/preflight-hash-migration.ts` / `scripts/verify-hash-migration.ts` / `scripts/fix-avatar-urls-for-uid.ts`
- 環境変数: `LOPO_PSEUDONYM_SECRET` を Vercel sensitive (prod/preview) + .env.local + iPhone メモ の 3 箇所に保管 (rotation 不可)
- アプリ側変更: `api/auth/_discordHandler.ts` (hashUid 経由) / `src/components/LoginModal.tsx` / `src/components/WelcomeSetup.tsx` / `src/utils/logoUpload.ts` の prefix 判定撤廃 / `scripts/check-admin-claims.ts` の hashed: 対応
- プライバシーポリシー文書更新 ja/en/ko/zh (`legal.privacy_section1d_*`)
- prod 実行: 10/10 件 hashed 化、 verify 全 PASS、 check-admin-claims で確認

### 課題 / 教訓

- **migration script の順序バグ**: 初回 execute 後の再 execute で window sweep が正規の hashed: Auth user を誤削除するバグを本番で発見。 即座に rollback + script 修正 + 再 execute で復旧
- **本人 Storage 消失**: 上記バグの auto-rollback で本人 Storage が消えた (backup は metadata のみで実体復元不可)。 LoPo UI 経由で再アップロードで対応
- 学び: Step 順序は単独 task テストだけでなく「reentrant scenario (=失敗後の再実行)」 テストも必須

### 結果

LoPo の認証システムが「個人情報を持たない」 大原則を完全達成。 プライバシーポリシーの主張が文字通り真になった。

## 完了 (2026-05-20 セッション 40・hash 化マイグレーション Step 1 完了)

**目的**: hash 化マイグレーション (Step 2) のテスト対象を Discord 専用に絞り、 「個人情報を持たない大原則」 の前提条件を整える。 廃止プロバイダー (Twitter / Google) 由来の uid 残骸を関連データごと完全削除。

### 完了内容

- **設計書**: [docs/superpowers/specs/2026-05-20-legacy-user-cleanup-design.md](superpowers/specs/2026-05-20-legacy-user-cleanup-design.md) (Step 1 完全仕様 + §3.4 クロス参照対応)
- **実装プラン**: [docs/superpowers/plans/2026-05-20-legacy-user-cleanup.md](superpowers/plans/2026-05-20-legacy-user-cleanup.md) (13 タスク、 subagent-driven 実行)
- **新規スクリプト**: [scripts/delete-legacy-users.ts](../scripts/delete-legacy-users.ts) (Dry-Run + Execute、 idempotent、 prefix/admin 二重防御 + bare Firebase UID 対応、 cross-ref scan 付き)
- **prod 実削除**:
  - Firebase Auth: 14 件削除 (Twitter 12 + Google 2)
  - Firestore documents: 29 件削除 (plans 18 / userPlanCounts 8 / users 2 / housing_user_meta 1)
  - Cross-references: 0 件 (廃止ユーザーは現役機能未使用 = Task 7 dry-run で予測通り)
  - Storage files: 0 件
- **検証**: scripts/check-admin-claims.ts 再実行で「総 10 件 / Discord のみ / admin 1 (本人) / Twitter Google グループ消滅」 確認
- **既存機能影響**: ゼロ。 Discord 10 件 (本人 admin + 他 9 名) は一切変更なし、 ハウジング・軽減表・LP 正常動作維持
- **Vercel デプロイ不要** (scripts/ のみの変更で本番動作に影響なし)

### Step 1 中に発見した plan 欠陥

- `assertPrefixSafe` が bare Firebase UID (Google built-in provider が生成する 28 文字英数字 UID) を弾くバグを Task 7 で発見・修正 (commit e5ebd4c)。 spec / plan は `google:` プレフィックス前提で書かれていたが実 uid は prefix 無し
- 新規 Discord ユーザー 1 件 (`discord:704...`、 2026-05-19 15:28 UTC 登録) が prep memo 後に追加されていた → Step 2 対象は **Discord 10 件** (本人 1 + 他 9) に確定

### 結果

prod は Discord 10 件のみ、 hash 化マイグレーション Step 2 (本体) の前提条件達成。 Step 2 brainstorming に直行可能。

## 完了（2026-05-19 セッション 39・hash 化マイグレーション準備調査）

**背景**: ハウジング ログイン UI 整備の brainstorming 中、 認証実装の中身 (`firebaseUid = discord:<生 ID>`) が「個人情報を持たない大原則」 と乖離していることが判明。 hash 化マイグレーションを**ハウジング UI 整備より優先**で実施する方針に転換。

### 完了内容 (調査 + 準備、 実装はまだ)

- **認証フロー全文読了**: `api/auth/_discordHandler.ts` (181 行) / `api/auth/index.ts` (18 行) / `src/store/useAuthStore.ts` (312 行)
- **hash 化処理の不在を確定**: 全リポジトリ grep (`createHash|sha256|pseudonym|anonymiz|hash.*id|hash.*uid|salt`) でゼロヒット。 `crypto` モジュールは OAuth state パラメーター生成にのみ使用
- **23 ユーザー把握**: Firebase Console + 新規スクリプト [scripts/check-admin-claims.ts](scripts/check-admin-claims.ts) で確定。 Discord 9 / Google 2 (廃止) / Twitter 12 (廃止)
- **admin 状況確定**: 本人 Discord 1 件のみ ✅、 他人ゼロ、 旧 Google admin はクリア済み
- **3 層 admin 防御の堅牢性確認**: フロント (AdminGuard) / API (verifyAdmin) / Firestore Rules すべて role==='admin' チェック、 Custom Claims は秘密鍵署名で偽造不可
- **設計書 §6.4 / §11 / §16 / §17.2 読了**: quota = 累計 30 + 31〜は 1 日 5、 信用スコア/BAN は Phase 3 で予定 (現時点未実装)、 通報の自動非表示は 3 件で発火 (運営介入なし)
- **プライバシーポリシー文書 確認**: `docs/superpowers/specs/2026-03-30-privacy-policy-update-design.md` 読了、 Discord ID の扱いが明文化されていないことを確認
- **新規スクリプト**: `scripts/check-admin-claims.ts`
- **準備メモ**: `docs/.private/2026-05-19-hash-migration-prep.md` (3 ステップ計画 + brainstorming 8 論点 + 文言素材)
- **memory 追記**:
  - `feedback_housing_design_independent.md` (ルール先読み手順 + 新規モーダル要素は事前承認フロー追加)
  - `feedback_housing_admin_complete.md` (新規 — ハウジング運営作業は全部 /admin で完結)
  - `project_hash_migration_status.md` (新規 — 計画状況)
- **ハウジング ログイン UI 文言確定**: 「ユーザー目線・柔らかく・嘘なし」 で 3 bullet 形式 (hash 化完了後に LoginModal に適用)
- **Phase 3 通報フロー仕様 確定**: 自分の登録は編集・削除可、 「ちがった」 通報で登録者にアプリ内通知、 異議申し立ては LoPo Discord DM 受付 → 管理画面で reportCount リセット、 すべて `/admin` で完結

## 完了（2026-05-19 セッション 38・ハウジング登録モーダル トンマナ統一）

**背景**: Phase 2A 検証中に判明した「中身まったく見えない」「タグが長すぎる」 を根本対応。

### 完了内容 (15 commit、 push + Vercel デプロイ完了)

- 新モーダル本番未反映を修正 (HousingWorkspace の旧 HousingRegisterModal を HousingRegisterFormModal に差し替え)
- panel chrome 統一 (HousingPanelModal 新規追加、 LiquidGlassPanel ラッパー + housing-panel-head)
- モーダル中身もハウジングトンマナ化 (.housing-input / .housing-textarea / .housing-label / .housing-register-form の form 基礎 CSS 新規追加 121 行)
- HousingRegisterTagPicker 再設計 (147 タグ flex-wrap → 選択 chips + 検索 + カテゴリタブ + 高さ固定 200px)
- 確認モーダル `<pre>{JSON.stringify}</pre>` → `<dl>` 構造化表示に整形
- i18n 4 言語に `tag_search_placeholder` / `tag_no_results` / `tag_pick_hint` / `tags` / `room_number` / `parent_house_size` 追加
- 登録 API 400 解消、 実機で登録成功確認済 (X URL 貼って自動入力 → 即「登録する」 押せる動線完成)
- 触ったファイル: HousingPanelModal (新規) / HousingRegisterFormModal / HousingRegisterForm / HousingRegisterChecklist (新規) / HousingRegisterTagPicker / HousingRegisterDescriptionField / FavoritesModal / HousingWorkspace / styles/housing.css / locales 4 言語 / housingFieldState (test 含む)

### 既知バグ (hash 化完了後に再開)

- `fieldState.confirm()` を呼んでも state="confirmed" に切り替わらない (右上 ✅ バッジ・checklist の「そのままで OK」 両方とも Playwright で click しても state 不変)。 React StrictMode / useCallback closure / createPortal 越しの reconciliation のいずれかが疑い。 isReadyToSubmit を auto-filled 許容にして回避中

## 完了（2026-05-19 セッション 37・ハウジング Phase 2A 登録モーダル + SNS URL 自動推定 実装）

**背景**: セッション 36 で確定した設計書 (`docs/superpowers/specs/2026-05-19-housing-sns-auto-extraction-design.md`) + 17 task TDD 実装計画 (`docs/superpowers/plans/2026-05-19-housing-sns-auto-extraction.md`) を `superpowers:subagent-driven-development` skill で完走。

### 完了内容 (17 task + 5 fix commit、 main へ直 commit)

- **Task 1** `9637c74`: `parseTweetUrl` 純関数 (X URL → tweet ID、 7 test PASS)
- **Task 2** `e8354de`: `parseHousingFromText` 骨格 + masterData に `Small`/`Medium`/`Large` alias 追加 (2 test PASS)
- **Task 3** `f207090` + `7ecd47c`: 略称・俗語・自由文・棄却ケース対応 (11 test PASS、 substring 探索 + 日本語 ward-plot fallback、 ASCII 短 alias 誤一致防止 fix)
- **Task 4** `b0412eb`: `LavenderBeds` aliases に「葉脈」 追加
- **Task 5** `f271191` + `942763a`: Vercel Edge Function `/api/tweet-meta` (syndication CDN プロキシ、 7 test PASS、 LoPo 初の Edge runtime、 photos 型安全性向上 + vitest 環境衝突 fix)
- **Task 6** `fc6f316`: `useHousingFieldState` hook (5 state 遷移、 7 test PASS)
- **Task 7** `5bf7cac`: `housing.css` にバッジ + ✅ チェックアニメ (bounce + draw + ripple + glow) + スピナー + slide-in/out class 追加 (199 行)
- **Task 8** `b77d801`: `HousingRegisterFieldBadge` コンポ (5 test PASS)
- **Task 9** `2b84291`: i18n 4 言語に 30 キー追加 (`snsUrl` / `tweetPreview` / `fieldBadge` / `fieldError` / `address` / `type` / `confirm` / `cancel`)
- **Task 10** `e12674d`: `HousingRegisterSnsUrlField` + `useTweetFetch` hook (7 test PASS、 AbortController 経由のキャンセル対応)
- **Task 11** `318bb58`: `HousingRegisterTweetPreview` (3 test PASS)
- **Task 12** `aa6e76c`: `HousingRegisterTypeSelector` + `RoomNumberField` + `ParentHouseSizeField` (3 test PASS)
- **Task 13** `1744237`: `HousingRegisterAddressFields` に番地 31-60 で拡張街注記表示 (2 test 追加)
- **Task 14** `f89c6a4`: `HousingRegisterForm` 統合 (state + 自動入力配線 + 動的フィールド、 3 test PASS、 150ms ずらしタイピング演出 + `prefers-reduced-motion` 対応)
- **Task 15** `a627e1f`: `HousingRegisterFormModal` (createPortal + body scroll lock + 最終確認サブモーダル、 4 test PASS、 既存 `workspace/HousingRegisterModal` との名前衝突回避のため別名採用)
- **Task 16** `e165ddd`: `HousingPage` の `register` タブを新モーダルに置き換え (1 file 変更、 旧 `HousingRegisterView` は workspace shell 等 3 箇所が参照のため未削除)
- **Task 17** `(本コミット)`: `network` error key を 4 言語に追加、 TODO.md + TODO_COMPLETED.md 更新、 push、 デプロイ確認
- **Task 6 follow-up** `(別 commit)`: `parseHousingFromText` の `dc`/`server` 変数に明示的型注釈追加 (Vercel tsc 厳密モード対応)

### 検証

- **build**: green (`npm run build` 6.05s success)
- **vitest**: 120 files / 910 tests PASS / 2 skipped (pre-existing Sub-spec 2B 用) / 0 failed
- **TypeScript**: strict mode clean (`tsc -b` 0 errors)

### Plan からの逸脱 (記録、 詳細は session 37 ログ参照)

1. **Plan が Next.js App Router 前提だった** → Vite + Vercel Functions 構造に全面読み替え (LoPo は React Router + Vite)
2. `'use client'` ディレクティブ削除、 `useTranslations from next-intl` → `useTranslation from react-i18next` + 完全キーパス
3. テストでの `vi.stubGlobal('fetch')` top-level 呼び出しが vitest を破壊 → `vi.spyOn(globalThis, 'fetch')` パターンに統一
4. `Small`/`Medium`/`Large` alias を masterData に追加 (Plan 欠落)
5. 日本語「6番地6番」 形式の wardPlot fallback 正規表現追加 (Plan 欠落)
6. `HousingRegisterForm` で既存 `AddressFields` の renderBadge prop 化を避け、 dc/server/area/ward/plot は inline 再実装 (互換性最大化)
7. `HousingRegisterFormModal` という別名採用 (Phase 1 `workspace/HousingRegisterModal` との衝突回避)
8. `HousingRegisterView.tsx` 削除を見送り (3 箇所が参照、 Phase 1 互換維持)

### Phase 2A polish (次セッション以降の優先度低)

- `HousingRegisterView.tsx` の dead-code 撤去 (workspace/HousingRegisterModal も併せて整理)
- `AddressFields` を新モーダルに統合する `renderBadge` 拡張 (現状 inline 重複)
- `/api/tweet-meta` の rate limiting (Cloudflare 移行時に Workers KV 利用)
- tweet photos の `alt` 属性アクセシビリティ向上 (現状 `alt=""`)
- substring 探索 false positive 監視 (アパート 「アパート」 が無関係テキストに誤一致するリスク)

---

## 完了（2026-05-18/19 セッション 34・ハウジング 個室・アパート対応 schema 確定）

**背景**: Phase 2B (Sub-spec 2B 系) 着手前にスキーマ確定が必須 (`docs/.private/2026-05-17-housing-room-types-design.md` で議論メモあり)。 公式仕様を調べ直し (Empyreum wing 概念は誤解、 削除確定。 FC 個室 1-512 / アパ部屋 1-90 / 個人宅は個室不可 等)、 議論メモ §7 の論点 5 件を brainstorming → spec → plan → subagent-driven の標準フローで完走。 UI 本格刷新は **本セッション scope 外** (Sub-spec 2B 系の別 plan で扱う)。

### 完了内容

- **Spec 作成**: `docs/superpowers/specs/2026-05-18-housing-room-types-design.md` (確定論点まとめ)
- **Plan 作成**: `docs/superpowers/plans/2026-05-18-housing-room-types.md` (7 task + 統合確認)
- **Task 1** (`4e2eb89`): 定数追加 (`PRIVATE_CHAMBER_RANGE` 1-512) + `PLOT_RANGE` を 1-30 に訂正 (subdivision 別)
- **Task 2** (`5777c31`): `HousingListing` 型を spec §3.1 で全面置換 — `subdivision: 'main'|'sub'`, `buildingType: 'house'|'apartment'`, `ownerType: 'personal'|'fc'`, `roomKind: 'private_chamber'|'apartment_room'`, `roomNumber` 追加、 旧 `apartmentRoom` 廃止、 `HOUSING_SIZES` から `'Apartment'`/`'PrivateRoom'` 削除
- **Task 3** (`c493328`): `buildAddressKey` を新キー構造 (`${dc}|${server}|${area}|W${ward}|S${sub}|H${plot}|C${room}` 等) で全面置換 + TDD 9 ケース、 `AddressInput` 型シグネチャ先取り更新。 ownerType は key 非参加 (誤登録での重複検知漏れ防止)
- **Task 4** (`2e5a173` + follow-up): `validateAddress` を整合性制約 4 パターン (個人宅 / FC 全体 / FC 個室 / アパ部屋) + 不正組合せ 8 reject で全面書き直し + TDD 12 ケース
- **Task 5** (`0ed4c0c`): `api/housing/_registerListingHandler.ts` の listing 構築を新 schema 対応 (条件付き spread 形式)
- **Task 6** (`32810f8` + follow-up): `firestore.rules` の `housing_listings` create/update に整合性制約 4 パターンを `||` で表現、 helper 5 個新規追加 (`isValidSubdivision`/`isValidBuildingType`/`isValidOwnerType`/`isValidPrivateChamberNumber` 等)、 既存 `isValidHousingSize`/`isValidPlot` も縮小修正
- **Task 7** (`8941d11` + follow-up): `src/lib/housingListingsService.ts` に関連登録特定クエリ 3 つ追加 (`findChambersInPlot`/`findHouseForChamber`/`findApartmentRoomsInWard`) + TDD 4 ケース
- **Task 8** (`db5cafa`): 既存 UI (HousingRegisterAddressFields/HousingRegisterView)、 store (useHousingFilterStore)、 mock (mockListings)、 Filter (FilterPanel) を新 schema 互換に暫定対応、 既存テスト 4 ファイルの fixture 修正、 Apartment 関連テスト 2 件を `it.skip` 化 (Sub-spec 2B で復活前提のコメント明示)
- **Final review fixes**: i18n 4 言語の plot.out_of_range を 1〜60 → 1〜30 に訂正、 `ChamberQuery`/`ApartmentQuery` に `dc`/`server` フィールド必須追加 (Sub-spec 2B 詳細ページ実装前に異 DC/サーバー混入リスクを潰す)

### 検証

- **build**: green (`tsc -b && vite build` success)
- **vitest**: 109 ファイル 850 PASS / 2 skipped (Sub-spec 2B 用、 意図的) / 0 failed
- **TypeScript**: strict mode clean
- **gitleaks**: pass

### Spec / Plan 未対応の引き継ぎ事項 (Sub-spec 2B)

- 登録モーダル 4 タイプ選択 UI (spec §4.1)
- 物件詳細ページの関連登録表示 (spec §4.2)
- 通報 UI 分離 + 家主異議申し立て (spec §5.2/§5.3、 運営連絡先 URL 決定含む)
- Phase 1 設計書 (`2026-05-07-housing-tour-phase1-design.md`) の §4.2/§4.3/§6.1/§6.5/§7/§9.3 改訂
- skip テスト 2 件 (FilterPanel Apartment チップ / HousingRegisterAddressFields Apartment 選択) の新 schema 対応

### ファイル変更概要

- 新規: spec / plan / 3 テストファイル (`src/__tests__/housing/{housingDuplicate,housingValidation,housingListingsService}.test.ts` — vitest config に合わせて配置)
- 修正: 型定義 / validation / addressKey / handler / Rules / service / 既存 UI 5 ファイル / 既存テスト 5 ファイル / i18n 4 言語

---

## 完了（2026-05-18 セッション 33・軽減アプリ 共有チュートリアル UX 刷新）

**背景**: ユーザー実機検証で `share` チュートリアル (2 ステップ) に 3 つの UX バグが判明。 ① 軽減表を開いていないと共有ボタンが出ず TutorialMenu から起動できない、 ② ステップ 2/2 表示中に背後の「共有について」 モーダル (PopularConsentDialog) が操作可能、 ③ 2/2 終了で ShareModal が強制クローズされ最初からやり直し。 brainstorming → writing-plans → executing-plans の標準フローで完走。

### 完了内容

- **設計判断**: 起動ロジック「案 C」 採用 — TutorialMenu からの初学を廃止し、 共有ボタン初回クリック時に自動発火、 完了/スキップ後にメニューに項目出現する流れに。 z-index 重ね順は既に意図通りだったので変更不要 (下: ShareModal `9999` → 中: PopularConsentDialog `10000` → 上: TutorialBlocker `10001` → TutorialCard `10002`)
- **Task 1**: `tutorialDefinitions.ts` の `shareTutorial` を 2 ステップ → 1 ステップに削減 (`share-1-done` のみ、 旧 `share-1-open` ステップ削除)
- **Task 2**: `useTutorialStore.confirmExit` で `activeTutorialId === 'share'` のときスキップでも `completed.share = true` をセット (再学習導線確保)、 vitest 3 件追加
- **Task 3**: `TutorialOverlay` の TutorialBlocker active 条件を `target=null && pill='next'` でも全面ブロックに拡張 (バグ ② 修正)
- **Task 4**: `ShareModal` の `completeEvent('share:modal-opened')` 削除 + 未使用 import 整理
- **Task 5**: `ShareButtons` の onClick で `completed.share === false && !isActive` のとき `startTutorial('share')` 自動発火、 強制クローズ useEffect (27-35 行) 削除 (バグ ③ 修正)
- **Task 6**: `TutorialMenu` の表示条件に `id !== 'share' || completed['share']` フィルター追加 — share 項目は完了/スキップ後のみ表示
- **Task 7**: i18n 4 言語 (ja/en/zh/ko) から `tutorial.share.open.message` キー削除

### 検証

- **vitest**: 109 ファイル 851 件 PASS (+3 from session 32 = 848 → 851)
- **TypeScript**: strict mode clean
- **build**: 成功、 PWA precache 199 entries (5.95 MB)
- **実機検証**: デプロイ後にユーザー目視で確認予定 (UX バグ性質上 Playwright での機械検証は不向き)

### ファイル変更

- 変更: `src/data/tutorialDefinitions.ts`, `src/components/ShareButtons.tsx`, `src/components/ShareModal.tsx`, `src/components/tutorial/TutorialOverlay.tsx`, `src/components/tutorial/TutorialMenu.tsx`, `src/store/useTutorialStore.ts`, `src/locales/{ja,en,zh,ko}.json`
- 新規: `src/__tests__/useTutorialStore.share.test.ts`, `docs/superpowers/specs/2026-05-18-tutorial-share-improvements-design.md`, `docs/superpowers/plans/2026-05-18-tutorial-share-improvements.md`

### 既存ユーザーへの影響 (合意済)

`completed['share']` が `false` の既存ユーザーは、 デプロイ後 1 回だけ案内カードが出る。 「わかった」 で消えて以降は通常動作。 「そんなに使われてないから OK」 でユーザー承諾済。

---

## 完了（2026-05-18 セッション 32・Housing Sub-spec 2B Plan F (Finishing)）

**背景**: セッション 31 で Plan B/D/E まで完成、ユーザー実機確認で基本動作 OK。残り「リリース可能化」 (登録モーダル接続 / ルート整備 / a11y / E2E / 親仕様改訂) を Plan F として一括対応。subagent-driven-development スキルで 12 task + final gap fix を完走。

### 完了内容

- **Task 1**: `src/lib/housing/housingListingsMockService.ts` 抽象層 (Phase 2 で Firestore に差し替え予定、既存 `housingListingsService.ts` (Firestore 同住所検索) と命名衝突回避のため `Mock` 接尾辞)
- **Task 2**: `src/lib/housing/useReducedMotion.ts` フック + AutoScrollList 統合 (SceneryVideo は既存のインライン match、refactor は iterate-first で後回し)
- **Task 3**: `SkeletonCard` (pinterest / right-panel variants、reduced-motion で shimmer 停止)、housing.css に新規 token + class 追加、ビュー未接続だが Phase 2 で接続予定
- **Task 4**: `HousingToast` (info / error variants、`role="status"`、ref guard で onClose identity の timer reset を回避)、グローバル `showToast()` と二重化を JSDoc で明記
- **Task 5**: `HousingRegisterModal` で Sub-spec 2A の `HousingRegisterView` をラップ、未ログイン時は LoginModal 連携、`window.location.hash = 'register'` レガシールートを置き換え、4 言語 i18n 完備
- **Task 6**: TopBar に検索 input 追加、`useHousingFilterStore.setSearchText` に直結 (既存 i18n `topbar.search_placeholder` 再利用)
- **Task 7**: `/housing/p/:listingId` で該当カード pre-expanded、`useParams` → `focusListingId` → CenterArea → PinterestView (useEffect で URL 変更にも追従)、CenterArea が focus 時に強制 pinterest mode 切替
- **Task 8**: `/housing/tour/:tourId` で local store に listings あれば auto-enter (ref guard で再発火防止、`useHousingTourStore.getState()` で subscriber 化を避ける)、Phase 2 で Firestore 復元
- **Task 9**: a11y スモークテスト追加 (全 button accessible name 必須 + 全 img alt 必須)、既存コードは compliant で fix 不要、ガードとして将来回帰検知
- **Task 10**: Playwright E2E 4 シナリオ追加 (browse / filter / listing-url / tour-url) 全 pass
- **Task 11**: 親仕様 (`2026-05-07-housing-tour-phase1-design.md`) §7/§8/§10.1/§11.2/§18 を Sub-spec 2B 参照に書き換え (-131 / +22 行)
- **Task 12**: 最終ビルド検証 (vitest 847 pass、tsc clean、build OK、Plan F の E2E 4 件 pass)
- **Gap fix**: 「完了の定義」 で TopBar register CTA が必須だったが Task 5 時点で抜けていた → TopBar に register ボタン追加 (favorites と theme の間、honey-soft pill)

### 設計判断

- **housingListingsService 命名衝突**: 既存 `src/lib/housingListingsService.ts` (Firestore 本物) と plan の指定パス `src/lib/housing/housingListingsService.ts` が同名だったため、Mock 側を `housingListingsMockService.ts` にリネームしてヘッダーコメントで境界明示
- **ハードコード color/px 完全排除**: housing-design.md の strict rule (TSX 内 rgb/rgba/hex 直書き禁止) を全実装で遵守、必要に応じて新規 token をhousing.css に追加 (`--housing-skeleton-block` / `--housing-toast-info-bg` / 等)
- **defensive infra**: SkeletonCard / HousingToast / housingListingsMockService の 3 つは Phase 2 統合を JSDoc で明示、Plan F 時点ではビュー未接続でも OK

### コード品質・検証

- **commits**: 21 (各 task TDD → spec review → code quality review → fix → 必要に応じて再 review)
- **vitest**: 847 pass (Session 31 から +27)、新規 8 test files
- **TypeScript**: strict mode clean (`tsc --noEmit` エラーなし)
- **build**: 5.92s、PWA precache 199 entries (5.9 MB)
- **Playwright**: Plan F の 4 件 pass、pre-existing `timeline-responsive` 5 件 fail は別件
- **subagent-driven-development**: implementer → spec reviewer → code quality reviewer の 3 段階で各 task 検証、scope creep 防止に有効
- 実機検証は次セッションで対応 (push + Vercel deploy 後)

---

## 完了（2026-05-16 セッション 24・攻撃ジャンプ UI スマホドリルダウン化）

**背景**: スマホで攻撃ジャンプ UI を開き複数回出現する攻撃名を押すと、 1段目 (検索 + 攻撃名リスト) と 2段目 (出現箇所サブリスト) が縦積みになり、 ポップオーバー全高 (最大 ~750px) が可視高さを超えて 2段目選択肢が画面外にはみ出して押せない問題。

### 完了内容

- **スマホでドリルダウン方式に変更** ([HeaderMechanicSearch.tsx](src/components/HeaderMechanicSearch.tsx)): `isMobile && selectedMechanic !== null` のとき 1段目を非表示にして 2段目を入れ替え表示。 2段目ヘッダに「←」 戻るボタン (`ChevronLeft`) と「×」 閉じるボタンを並べた。 PC は左右並列のまま (現状維持)
- **i18n キー追加**: `timeline.nav_mechanic_back` を 4 言語 (ja/en/zh/ko) に追加

### コード品質・検証

- TypeScript build 通過 (strict)
- vitest 71 ファイル 694 tests 全 pass (回帰なし)
- 実機本番で OK 確認済

---

## 完了（2026-05-16 セッション 23・共有取込シート UX 整備）

**背景**: セッション 22 で残った共有取込プレビューのホイール不可をついに完全解消 (子コンポーネント側の取りこぼし)。 ついでにスマホ軽減追加シートをジョブ別セクション化し、 共有取込/上限解消シートのトンマナを「みんなの軽減表」 と統一。

### 完了内容

- **共有取込プレビュー ホイール完全復活**: セッション 22 では親 [ShareImportSheet.tsx](src/components/ShareImportSheet.tsx) の useSmoothWheelScroll を撤去したが、 子の [MitigationSheetPreview.tsx](src/components/MitigationSheetPreview.tsx) 内部にもう 1 つ自前 spring が残っていた。 prop `disableSmoothScroll` で個別 ON/OFF できる構造に変更 → ShareImportSheet からだけ disable。 MitigationSheet / LimitResolutionSheet は従来通り spring 維持
- **スマホ軽減追加シート ジョブ別セクション化**: [Timeline.tsx](src/components/Timeline.tsx) のフラット 5 列 + 複雑 scope ソートを廃止 → パーティ編成順 (MT→D4) のジョブ別セクション + 各セクション内は PC モーダルと同じ `getMitigationPriority` 順。 セクションヘッダーに「MT [ジョブアイコン] 暗黒騎士」 表示
- **スマホ軽減追加シート 使用不可オーバーレイ視認性向上**: グレーアウト `bg-black/60` → `bg-black/30`、 メッセージを box 中央 → 下端配置で奥のスキルアイコンを透視可能に、 button に `overflow-hidden` 追加で文字はみ出し防止
- **共有取込/上限解消シートのトンマナ統一**: `--glass-tier3-bg: var(--share-modal-bg)` でライト白基調化、 高さ `h-[80vh]` 固定 / 角丸 `rounded-t-[20px]` / 左カラム PC 幅 280px / padding `p-3` で「みんなの軽減表」 と統一 ([ShareImportSheet.tsx](src/components/ShareImportSheet.tsx) / [LimitResolutionSheet.tsx](src/components/LimitResolutionSheet.tsx))
- **MitigationSheetPreview ヘッダー整理**: `getJobLabel` (substring(0,3) 雑切り) を撤去 → ジョブ列ヘッダーをジョブアイコン (14px) に、 SKILL 列ヘッダー文字を削除 (列幅は維持)。 3 シート (共有取込 / 上限解消 / みんなの軽減表) すべてに反映

### コード品質・検証

- TypeScript build 通過 (strict)
- vitest 71 ファイル 694 tests 全 pass (回帰なし)
- 実機本番で OK 確認済

**結果**: 「共有取込モーダルだけトンマナ違う」 「ジョブ名が変に省略」 「ホイール効かない」 の 3 大課題が同セッションで解消。 「みんなの軽減表」 と「共有取込」 で見た目が揃い、 ユーザーが期待していた統一感を実現。

---

## 完了（2026-05-16 セッション 22・バグ 5 件 + admin リファクタ + 同期ボタンインジケータ化）

**背景**: セッション 21 末で記録した 4 バグ (スマホアイコン見切れ / DMU 出ない / ホイール不可 / 同期 error 一時表示) を解消。 途中で admin 「コンテンツ管理」 が長年機能していなかったことが判明し、 一括修正。 同期ボタンも仕様確定済の「インジケータ化」 を同セッションで実装。

### 完了内容

- **致命: スマホ Timeline 左端ジョブアイコン見切れ** ([Timeline.tsx](src/components/Timeline.tsx)): MitigationItem (PC 用ドラッグアイコン) rendering ブロックに `!isMobileTimeline` ガード追加。 元々 mobile は MitiIcons (MobileTimelineRow 内) が表示を担うのに PC 用も呼ばれて colStart=0 で左端に貼り付いていた。 1 行修正
- **高: DMU が NewPlanModal に出ない**: `scripts/seed-contents.ts` を新規作成し contents.json → Firestore /master/contents をスマートマージ書込。 DMU 含む全 64 items を反映。 副次的に「contents.json 更新後の Firestore 同期問題」 を 1 コマンド化
- **高: NewPlanModal の並び順**: [NewPlanModal.tsx](src/components/NewPlanModal.tsx) の filteredBosses をシリーズ単位で patch 降順にソート。 「新しいパッチが上」 のユーザー期待を回復
- **高: admin コンテンツ管理が機能していなかった (積年バグ)**: ドロップダウンの KNOWN_SERIES の ID (`arcadion_hw` 等) が実体 (`aac_heavy` 等) と乖離していて NewPlanModal に出ないという長年の地雷。 [AdminContentForm.tsx](src/components/admin/AdminContentForm.tsx) / [AdminContents.tsx](src/components/admin/AdminContents.tsx) / [ContentWizard.tsx](src/components/admin/wizard/ContentWizard.tsx) の 3 ファイルで (1) KNOWN_SERIES 撤廃して CONTENT_SERIES から動的取得 (2) 絶 (ultimate) は seriesId = id 自動 + 新規時は series 同時作成 (3) 新シリーズモードに名前 (JA/EN) 入力追加 + series オブジェクトを API に同送
- **高: admin 同期ボタン smart merge 統一**: [_syncHandler.ts](api/admin/_syncHandler.ts) が JOBS/MITIGATIONS/patchStats を完全上書きしていて、 admin で追加したスキル / ジョブを消す危険があった。 seed-skills-stats.ts と同じスマートマージ方式に統一。 [seed-skills-stats.ts](scripts/seed-skills-stats.ts) もジョブ / patchStats のマージを追加して挙動を統一
- **高: 共有リンク取込プレビュー ホイール不可**: `useSmoothWheelScroll` の hook が条件レンダリング要素には `enabled` プロップを渡す必要がある (= hook の JSDoc にも明記された罠) のに、 [ShareImportSheet.tsx](src/components/ShareImportSheet.tsx) / [LimitResolutionSheet.tsx](src/components/LimitResolutionSheet.tsx) / [LocalImportDialog.tsx](src/components/LocalImportDialog.tsx) の 3 箇所で渡していなかった。 全て `enabled: isOpen` 相当を渡す形に修正
- **中: 同期 error 一時表示**: `pullFromFirestore` ([usePlanStore.ts](src/store/usePlanStore.ts)) の失敗が `_cloudStatus='error'` を設定していた。 5 分定期 PULL / タブ切替 PULL の失敗が「再試行成功後にしばらくしてエラー表示 → リロードで治る」 の原因。 PULL は読み取りのみでデータ影響なしなので、 失敗時は直前の状態を維持するように変更。 PUSH 失敗のエラー表示は維持
- **同期ボタン UI インジケータ化** (相談で仕様確定済): [SyncButton.tsx](src/components/SyncButton.tsx) を「ボタン」 から「インジケータ」 に格下げ。 通常時 = CloudCheck (色なし・文言なし) / 同期中 = RotateCw くるくる回転 (色なし・文言なし) / エラー時のみ赤 + 文言 (タップで再試行)。 スマホ FAB からは sync メニュー完全撤去 ([MobileFAB.tsx](src/components/MobileFAB.tsx))

### 副産物 (継続利用ツール)

- **`scripts/seed-contents.ts`**: contents.json → Firestore /master/contents をスマートマージ同期。 今後 add-content.mjs で新ボス追加後に 1 コマンドで Firestore 反映できる
- **`scripts/audit-contents.ts`**: Firestore master/contents の健全性チェック。 「seriesId が壊れた items が無いか」 等を一発で監査

### TODO / memory 更新

- TODO.md の「相談したい」 から同期ボタン UI 改修 entry を完了として削除
- バグセクションから完了 4 件 (致命 / 高 3 / 中 1) を削除
- memory `feedback_content_firestore_sync.md` を更新: 「seed-contents.ts を実行する」 が正規ワークフロー

### コード品質・検証

- TypeScript build 通過 (strict)
- vitest 71 ファイル 694 tests 全 pass (回帰なし)
- 既存 Firestore データに対しては audit-contents で「異常なし」 確認済

**結果**: ローカル開発を最大限活用しつつ admin の積年バグも一掃。 「今後 admin から普通に追加すれば NewPlanModal にもサイドメニューにも出る」 状態を確立。 Vercel ビルド 1 つで全部反映。

---

## 完了（2026-05-13 セッション 19 終盤・タイムライン末尾 stop + 点線廃止 + ジャンプドロップダウン scroll + vitest hang 対策）

**背景**: 占星ドロー chain prompt 完了後、 ユーザーがタイムライン本体の挙動に複数の懸念を表明。 また vitest プロセスの hang 問題が顕在化したため、 開発環境改善も並行実施。

### 完了内容

- **タイムライン末尾の scroll stop** (commit b30b537): 内側コンテンツ div に `overflow-hidden` 追加 + 末尾余白 70vh → 50vh。 子要素 (フェーズ overlay 等) の overflow が親の scrollHeight に含まれなくなり、 最終イベントが画面中央付近で確実にスクロール末尾になる。 フェーズ高さ計算ロジックには一切触らない (= 過去苦労した安定区画を保護)
- **リキャスト点線描画廃止** (commit b30b537): `<div className="...border-dotted...">` 削除。 セッション 18 のリキャスト専用行が clockswipe 形式で十分代替可能なため。 副次的に「学者列だけ点線が下まで伸びる」 本番限定バグ (= 真因不明、 ローカルでは再現せず) の疑似解決
- **ジャンプドロップダウン scroll 修正** (commit 18733ac): `HeaderGimmickDropdown` / `HeaderPhaseDropdown` / `HeaderMechanicSearch` の内部リストが内部スクロール不可だった問題を、 `onWheel` で `scrollTop += deltaY` する形に変更。 ユーザー要望どおりスムーズスクロールは使わず最もシンプルな実装
- **vitest プロセス hang の自動 cleanup hook** (.claude/settings.local.json): Windows + Git Bash + npx 環境でセッション間にゾンビ vitest が蓄積する問題。 SessionStart hook で 1.5h 以上経過した vitest プロセスを自動 kill。 vitest.config.ts にも teardownTimeout / hookTimeout 追加

### コード品質・検証

- npm run build 6.03s 成功 (TypeScript strict mode)
- 過去の SCH バグ 2 件 + ユーザー報告データ (`afterLastEvent: []`) 検証 → 想定通り
- ユーザー実機での 「学者列だけ伸びる」 症状は真因不明のまま (= 描画削除で疑似解決)、 必要なら別セッションで再調査の余地あり
- リキャスト計算 (resourceTracker / scholarAutoInsert) は完全別ファイルで描画変更に影響なし

**結果**: 4 つの commit (c225291 / 18733ac / b30b537 / 設定変更) を本番デプロイ。 セッション 19 全体としては実装 + 検証 + 開発環境改善まで完了。

---

## 完了（2026-05-13 セッション 19・占星術師ドロー chain prompt）

**背景**: セッション 18 末で実装方針確定済みだった「ユーザーが手動で astral_draw / umbral_draw を 1 個置いた時に "以降 60 秒毎に交互配置しますか?" と確認するモーダル」を完成。 学者の AetherflowChainPromptModal パターンを流用、 違いは「交互ロジック」 のみ。

### 完了内容

- `buildAstrologianDrawChainFrom()` 追加 (src/utils/astrologianAutoInsert.ts) — startKind と逆のスキルから 60s 毎に交互配置、 既存ドローとの時刻差 <60s でスキップ (リキャスト 55s より安全マージン)
- `useMitigationStore` に `astrologianDrawChainPrompt` state + `dismiss`/`confirm` action 追加。 partialize 対象外で localStorage 非永続化 (リロード時に勝手に出ない)
- `addMitigation` で `!autoHidden` かつ astral_draw / umbral_draw 配置時にプロンプト トリガー
- `AstrologianDrawChainPromptModal.tsx` 新規 64 行 — AetherflowChainPromptModal と同一デザイン (glass-tier3 / 青 OK ボタン / Esc・×・背景クリックで閉じる)
- i18n 4 言語追加 (FF14 公式訳語準拠: ドロー/Draw/점지/抽卡)
- `Layout.tsx` でモーダル統合

### コード品質・検証

- vitest 678/678 PASS (新規 8 件含む)、 npm run build 5.98s 成功
- 過去 SCH バグ 2 件 (9eafdf8「元の位置に戻る」 / 9787fd8「リキャスト未満配置」) の判例を AST 側でも回避確認済み: 5 store サイトすべて `hasAnyAstrologianDraw` ガード設置済み、 衝突閾値 60s で recast 55s より厳しめ

**結果**: 実装 ~250 行、 1 セッション完結 (見込み ~150 行を超えたのはテスト追加分)。 commit 後 push + Vercel デプロイまで完了。

---

## 完了（2026-05-13 セッション 18・リキャスト専用行 ツールバー統合版）

**背景**: セッション 17 で表エリア全幅化 (T/H 151px、 6 アイコン対称) を完了。 次の目玉機能として「現在時刻でリキャスト中のスキルを FF14 ゲーム内 HUD と同じ clockswipe 形式で表示」 を実装。 brainstorming で「ツールバー統合 (案 C1)」 を採択 — 新規行を作らず、 既存ジョブアイコンを controlBar に物理移動し、 元のヘッダー位置にリキャスト中アイコンを配置。

**設計書 / 計画書**:
- `docs/superpowers/specs/2026-05-13-recast-row-design.md`
- `docs/superpowers/plans/2026-05-13-recast-row.md`

### 完了内容

- **clockswipe 形式**: FF14 公式と同一 (12 時起点・時計回りに透明領域広がる、 conic-gradient で実装)
- **配置済みスキルのリキャスト中のみ表示**、 明けたら即非表示 (動的)
- **列ごと**: T/H 列最大 6 個、 DPS 列最大 2 個。 超過時は残時間短い順に削除 → 残ったものを配置時刻順で並び替え
- **同 species 複数配置は最近 1 回に集約** (= ゲーム内 HUD と同じ動作)
- **スクロール上端時刻に連動**: ref + CSS variable で DOM 直接更新 (React 再レンダーなし、 GPU 描画)
- **ツールバー統合 (案 C1)**: ジョブアイコンを `JobPickerRow` として controlBar に物理移動、 ヘッダーには `RecastRow` を配置 → 新規行ゼロ
- **位置整合**: Playwright で 8 メンバー列実測、 本文配置済みアイコンと x 座標完全一致 (diff 0.00px)
- **視認性ブラッシュアップ**: overlay 0.55→0.40、 残秒テキスト 10→8px
- **Clock アイコン ON/OFF トグル** (Area C、 デフォルト ON、 localStorage 永続化)
- **Tooltip 対応** (各 RecastIcon にスキル名表示)
- **テーマトークン経由** (ダーク/ライト両対応)
- **i18n** ja/en/ko/zh

### コード品質

- 純粋関数 (recastRow.ts): 16 ユニットテスト、 nested Map 衝突回避、 上限/並び順/同 species 統合 全カバー
- React コンポーネント: forwardRef + useImperativeHandle、 静的 DOM 戦略 (アイコン追加削除なし、 CSS variable で表示切替)
- Map 化最適化 (mitigationDefs O(N×M) → O(N))
- 既存機能リグレッションゼロ (handleScrollSync、 ジョブピッカー機能、 配置済みアイコン、 フェーズオーバーレイ 全て無傷)

**結果**: feat/recast-row ブランチで TDD → spec/code-quality 2 段階レビュー × 7 タスク → main マージ。 vitest 669/669 PASS、 tsc clean、 build ✓。 Playwright 実機検証済み。

---

## 完了（2026-05-12 セッション 17・表エリア全幅化 / メンバー列幅拡張）

**背景**: セッション 14 で sizing 思想 v2 (container max-width 1489) を導入したが、 「フォーカスモード時にタイムラインが画面端まで広がる」 という本来の目的が未達。 メンバー列幅 (T/H 126 / DPS 53) の合計が利用可能幅に届かず、 タイムライン右側に約 153px の空白が残っていた。

**設計書 / 計画書**:
- `docs/superpowers/specs/2026-05-12-table-area-fullwidth-design.md`
- `docs/superpowers/plans/2026-05-12-table-area-fullwidth-implementation.md`

### 完了内容

- T/H 列幅 126 → **151px** (6 アイコン対称、 セッション 16 の対称性思想踏襲)
- DPS 列幅 53px 維持 (2 アイコン対称)
- 各メンバー列の左右マージン **2.9px** (新規 CSS 変数 `--col-member-pad-x`、 実機目視確定)
- 縦スクロールバー非表示 (グローバル、 管理画面 `[data-admin-page]` のみ復活)
- 横スクロールバーは残す (通常モード時の「あえて溢れさせる」 UX 目印 = サイドバー閉じ導線)
- 構造リファクタ: `getColumnCssVar` をマージン込み全幅返却に拡張、 Timeline.tsx / TimelineRow.tsx の inline calc 一元化
- `useMeasuredMemberLayout` で padding 吸収 (内側エリア計測)
- dev tool: ColumnWidthSlider にマージンスライダー追加 (動的微調整可)

**結果**: 1 commit + 1 merge push 済、 vitest 636/636 PASS、 tsc clean、 build ✓

---

## 完了（2026-05-12 セッション 16・軽減アイコン列の対称化 + 互い違いバグ修正 + 左飛びバグ部分修正）

**背景**: セッション 15 で軽減アイコン中央寄せシフトを実装したが「ユーザー意図と乖離」 で revert。 セッション 16 で真因解明:
- 真因は「列幅を超えてる」 ではなく「**最大個数を置いたときの左右余白が非対称**」
- 整数列幅では DPR 2.6 環境で完全 0 ズレ不可能 (subpixel rendering の構造的制約)
- 同時に互い違い配置のバグ + 「左から飛んでくる」 バグも発見

**結果**: 3 commits push 済 (24308e0 / 5a7abc1 / b983c78)、 vitest 636/636 PASS、 tsc clean、 build ✓

### 完了内容

- **列幅 対称化** (b983c78): T/H 126px / DPS 53px 固定 (viewport 非依存)
  - 真因 = DPR snap 3 要因の累積:
    1. 列ヘッダー `border-r` 1px → DPR 2.6 で 0.77 CSS px に snap
    2. アイコン inner div `border border-app-border` も同様に snap → 絵柄が outer の 0.8px 内側
    3. 絶対配置 `style.left` の subpixel round で実描画位置が +0.5px → 5 個並べで累積バイアス
  - 整数列幅では W=125.36 が真の完全対称、 整数化で 0.23px ズレ残 (許容)
  - 列幅は viewport / サイドメニュー / 表エリア幅 いずれにも依存しない固定値
- **互い違いバグ修正** (b983c78): `displayItems.sort` を時刻順最優先に変更
  - 旧: recast 順最優先 → 短 recast の異時刻アイコンが先に配置 → 長 recast (上段、 時刻早い) が後から衝突回避で右にずれていた
  - 新: 時刻順最優先、 同時刻のみ recast/horoscope/id でタイブレーク
- **左飛びバグ修正 (部分)** (24308e0): `MitigationItem` に `layoutReady` prop、 layout 未確定間 visibility: hidden
  - ローカル dev では消失したが本番で再発 → 次セッションで再対応
- **DEV 用ツール** (b983c78): `ColumnWidthSlider.tsx` 新規 (`import.meta.env.DEV` のみ表示)
  - スライダーで列幅をリアルタイム変更 + 実 DOM 計測 (アイコン位置・罫線距離) 表示
  - 本番ビルドには含まれない

### 振り返り / 教訓

- ユーザーの観察報告 (「右余白がない」) を「右側にめり込む」 と推測で誤解した時間があった → user_reports_are_facts ルール再確認
- 整数列幅 + 整数 CSS px の世界では DPR-snap の影響で完全対称は数学的に不可能、 これを認めた上で「ほぼ対称」 を許容するのが正解
- アイデア (リキャスト専用行、 表エリア全幅化、 効果中スキル最上行残し) を記録漏れしていた問題が発覚 → `feedback_record_ideas_immediately.md` 追加で再発防止

### 残課題 (セッション 17 へ引き継ぎ)

- 列幅 0.5px ズレ (許容範囲、 列幅拡張時に同時治療予定)
- 表エリア全幅化 / リキャスト専用行 / 効果中スキル最上行残し の 3 大計画 (詳細: `docs/.private/2026-05-12-table-area-improvements.md`)

---

## 完了（2026-05-12 セッション 16 末・左から飛んでくるバグ 根本治療）

**背景**: セッション 16 で `layoutReady` (1 フレーム visibility:hidden) を実装したが本番で再発。 brainstorming で真因を特定し、 React の `useLayoutEffect` で根本治療。

**結果**: ユーザー本番実機 OK 確認。 1 commit push 済。

### 真因

`useEffect` は paint **後**に実行される → 1 pass 目で `colStart=0` のアイコンが画面に paint された後、 2 pass 目で正位置にジャンプ。 これが「左 (x=0) から飛んでくる」 現象。

プラン切替 (C) で発生しなかった理由 = Timeline コンポーネントが unmount されず `memberLayout` Map が継続保持されていたため。 A (ハードリロード) / B (別ページから戻る) では新規マウントで Map がリセット → 1 pass が必ず空。

### 修正内容

`src/components/Timeline.layoutHooks.ts` の **1 行のみ**変更:

```diff
-import { useState, useEffect } from 'react';
+import { useState, useLayoutEffect } from 'react';
...
-  useEffect(() => {
+  useLayoutEffect(() => {
```

`useLayoutEffect` は paint **前**に実行され、 内部の `setState` も同期再 render される。 結果として 1 pass 目の「colStart=0」 状態は paint されず、 2 pass 目の正位置のみが画面に出る。 ユーザー視覚的には「最初から正位置にある」 状態。

### 既存機能の保持

- `MitigationItem` の `layoutReady` prop + `visibility: hidden` ロジックは保険として維持
- 既存テスト 636/636 そのまま PASS
- パフォーマンス影響なし (useLayoutEffect 内は 8 要素の `offsetLeft`/`offsetWidth` 読込のみ、 1ms 未満)

### 設計書 / 実装プラン

- `docs/superpowers/specs/2026-05-12-left-flying-icons-fix-design.md`
- `docs/superpowers/plans/2026-05-12-left-flying-icons-fix.md`

### 振り返り / 教訓

- brainstorming で真因を分析する段階で「プラン切替で発生しない理由」 を考察したのが突破口
- ユーザー仮説「ローディング画面で隠れている」 は方向は正しいが原因が違った (= Timeline の unmount 有無)
- 1 行変更で根本治療できた = React の lifecycle 理解が決定的に重要だった

---

---

## 完了（2026-05-12 セッション 15・UI 調整 — 全 shell 中央寄せ + 軽減アイコン均等分散 + ツールバー仕切り整合）

**背景**: セッション 14 で sizing 思想 v2 を適用した後、 ユーザーが実機 (DevTools 3840 emulation) で確認したところ 3 件の課題を発見:
1. ヘッダーとサイドメニューが ultrawide で広がっていく (Timeline 単独のみ中央寄せだった)
2. 軽減アイコンの左右余白が非対称 (列幅いっぱいに置いても右側に余白が残る)
3. ツールバーの仕切りが表の縦罫線とズレており、 列を進むごとに累積していた

**結果**: 3 commits、 build / vitest / tsc / playwright (6/6) 全 PASS

### 完了内容

- **Task A** (b3954c9): app-shell 全体を 1489px 中央寄せ
  - `src/components/Layout.tsx` 最外層 (`data-app-shell`) に `md:max-w-[var(--container-max)] md:mx-auto` 適用
  - `src/components/Timeline.tsx` の単独 max-width を除去 (二重化回避)
  - Playwright 中央寄せテストを `data-app-shell` ベースに更新、 左右余白の差 < 5px を assert
  - **挙動**: ultrawide で Sidebar + 主コンテンツ全体が 1489px に収まり、 両側に均等余白
- **Task B** (4605a48): 軽減アイコンを均等分散配置
  - `src/components/Timeline.tsx` の配置ロジックを 3 phase に分離 (placement → cluster shift → rendering)
  - Phase 1: 既存のレーン詰めロジック (PLACEMENT_STEP=12) で `candidateLeft` 確定
  - Phase 2: 非仮想アイコンが 2 個以上のとき `clusterShift = (colWidth - minLeft - maxLeft - ICON_WIDTH - 2*VISUAL_OFFSET) / 2` を計算
  - Phase 3: `absoluteLeft = colStart + VISUAL_OFFSET + candidateLeft + clusterShift`
  - **挙動**: 1 個のときは左寄せ維持 (中央配置の不格好さを回避)、 2 個以上は左右余白均等
  - 例 (タンク列 125px、 5 アイコン): 旧 [0, 12, 24, 36, 48] → 新 [24.5, 36.5, 48.5, 60.5, 72.5]、 両側余白 26.5px
- **Task C** (04532be): ツールバー仕切り線を表列幅 CSS 変数と整合
  - `src/components/Timeline.tsx` の control bar 3 箇所 (Area B/C/D) の固定 px を `calc(var(--col-*-w) - 1px)` に置換
  - Area B: `md:w-[199px]` → `md:w-[calc(var(--col-mechanic-w)-1px)]` (MECHANIC 列上)
  - Area C: `md:w-[99px]` → `md:w-[calc(var(--col-counter-w)-1px)]` (U.Dmg 列上)
  - Area D: `md:w-[99px]` → `md:w-[calc(var(--col-counter-w)-1px)]` (Dmg 列上)
  - **挙動**: 全 viewport (1366-3840) でツールバー仕切りが表列境界と pixel 単位で揃う、 累積ズレ消失

### 検証

- build PASS、 vitest 636/636 PASS、 tsc clean、 Playwright 6/6 PASS

---

## 完了（2026-05-12 セッション 14・sizing 思想 v2 適用 — 全プロジェクト共通思想に統合）

**設計書**: [docs/superpowers/plans/2026-05-12-sizing-philosophy-application.md](superpowers/plans/2026-05-12-sizing-philosophy-application.md)
**統合 spec**: [docs/superpowers/specs/2026-05-12-sizing-philosophy-alignment.md](superpowers/specs/2026-05-12-sizing-philosophy-alignment.md)
**全プロジェクト共通思想**: `C:\Users\masay\.claude\design-philosophy-sizing.md` (v2、 max=base + container max-width)
**結果**: 5 commits、 build / vitest / tsc / playwright (6/6) 全 PASS

### 背景

AllMarks 側で全プロジェクト共通の sizing philosophy が確定 (`~/.claude/design-philosophy-sizing.md`)。 「開発者画面 = MAX、 ultrawide では余白増えるだけ」 という思想を LoPo にも適用。 セッション 13 で実装した「max = base × 1.4〜1.6」 (上下伸縮型) を「max = base」 (上限固定型) に修正。

### 完了内容

- **Task 1** (a740cd0): 列幅 7 token の clamp max を base に統一
  - col-th-w: 180 → **125** (base)、 col-dps-w: 80 → **50**、 phase 80→60、 label 70→50、 time 80→60、 mechanic 280→200、 counter 140→100
  - 1366 ノート: vw 自然値で base × 0.917 ≈ 92% 縮小 (不変)、 1489 で base、 1920+ で **max 固定**
- **Task 2** (91e491f): Playwright 期待値を新方針に更新
  - 1366: 115/46、 1489: 125/50、 1920+: **125/50 で固定** (旧 161/64, 180/80 から変更)
- **Task 3** (78cd6e0): 共通基盤トークン追加
  - `font-size: 16px` を `:root` に明示 (ブラウザ font 設定の影響を無効化)
  - `--container-max: 1489px` (= 開発者画面幅、 ultrawide で中央寄せ用)
  - `--text-scale-multiplier: 1` (将来のアプリ内 text size UI 用に予約)
- **Task 4** (b5b8532): font-size tokens 15 個 を clamp+vw 化 (max=base)
  - 全 14 token (-plus 含む) を PC 用 media query で clamp 上書き
  - 1489 で既存 px 値 (10/11/12/13/14/16/18/20/24/26/36) と一致、 1920+ で max 固定
  - モバイル (< 768px) は既存固定 px のまま (変更なし)
- **Task 5+6** (6b46c78): Timeline 最外層に container max-width 適用 + audit
  - Timeline.tsx 最外層に `md:max-w-[var(--container-max)] md:mx-auto` + `data-timeline-root` 属性
  - **適用判定 (audit 結果)**:
    - Timeline 最外層: **適用** (ultrawide で間延びするメインコンテンツ)
    - LandingPage: **見送り** (内部で既に max-w-[1200px] mx-auto 自己完結)
    - Layout.tsx の Sidebar + main flex container: **不適** (Sidebar ごと制限される)
    - Sidebar / Modal: **不適** (既存 max-w 持つ、 portal mount 等)
  - Playwright 中央寄せ assertion 追加 (3840 viewport で container 幅 ≤ 1489 + container.x > 0)
- **Task 7** (本コミット): TODO 整理 + plan/spec ファイルを追加 + push

### 検証結果

| viewport | T/H 列 | DPS 列 | font-size-base (10px ベース) |
|---|---|---|---|
| 1366 ノート | 115px | 46px | 9.16px (92%) |
| **1489 (本人)** | **125px** ← max | **50px** ← max | **10px** ← max |
| 1920 | **125px** ← 固定 | **50px** ← 固定 | **10px** ← 固定 |
| 2560+ | **125px** ← 固定 | **50px** ← 固定 | **10px** ← 固定 |
| 3840 | **125px** + 中央寄せ余白 | **50px** + 中央寄せ余白 | **10px** + 中央寄せ余白 |

build PASS、 vitest 636/636 PASS、 tsc clean、 Playwright 6/6 PASS (5 viewport + container max-width 中央寄せ assertion)。

### 追加メモ

- `getColumnCssVar()` / `useMeasuredMemberLayout` フックは変更不要 (CSS 変数経由なので clamp 値変更を自動追従)
- `getMemberRefCallback` (セッション 13 で追加) は不変動作確認済
- グローバル `~/.claude/CLAUDE.md` の LoPo 固有メモも削除済 (思想ノイズクリーンアップ)
- アプリ内 text size 設定 UI (`data-text-scale` 属性 + multiplier) は将来 Phase で実装、 CSS 変数のみ予約済

---

## 完了（2026-05-12 セッション 13・タイムライン列幅フルレスポンシブ化 C 案）

**設計書**: [docs/superpowers/plans/2026-05-12-timeline-full-responsive.md](superpowers/plans/2026-05-12-timeline-full-responsive.md) (7 タスク・940 行)
**実行**: `superpowers:subagent-driven-development` で各 task に implementer + spec reviewer + code quality reviewer の 3 段階レビュー
**結果**: 11 commits、636/636 vitest PASS、Playwright 5/5 PASS、tsc clean、build success

### 完了内容
- **Task 1** (07a1146, 064dbfa): `src/index.css` に列幅 CSS 変数追加。`--col-th-w: clamp(110px, 8.395vw, 180px)` / `--col-dps-w: clamp(45px, 3.358vw, 80px)` / `--col-phase-w` / `--col-label-w` / `--col-time-w` / `--col-mechanic-w` / `--col-counter-w` / `--col-header-chunk-w` / collapsed バリアント。1489 基準で全 viewport を proportionally にカバー
- **Task 2** (4f8b706, db6f5f7): `getColumnCssVar(role)` を `src/utils/calculator.ts` に追加。CSS 式 `'var(--col-th-w)'` / `'var(--col-dps-w)'` を返す。旧 `getColumnWidth` は `@deprecated` 注釈付きで一旦残置
- **Task 3** (cbc4c65, 81b1bca): `src/components/Timeline.tsx` の固定 px Tailwind クラス 15 箇所を `w-[var(--col-*-w)]` に置換。RAW/TAKEN の冗長な `md:` prefix 整理
- **TimelineRow.tsx 設計書漏れ補正** (1ebd982): PC body 行を担う `src/components/TimelineRow.tsx` の 7 箇所も同じパターンで CSS 変数化。Header と Body の列幅整合性を確保
- **Task 4** (c6edda1, 44f0ec1): `src/components/Timeline.layoutHooks.ts` 新規作成。`useMeasuredMemberLayout` フックで `offsetLeft`/`offsetWidth` + `ResizeObserver` + `window.resize` 監視。`refVersion` state + ref-callback パターンで初回マウント時の ref 解決を処理。`data-member-role` / `data-member-id` 属性追加 (Playwright 用)。`MAX_LEFT` 計算を `layout?.width ?? fallback` に置換
- **Task 5** (9409c67): deprecated `getColumnWidth()` を `calculator.ts` から削除。`src/` 配下の参照 0 件確認
- **Task 6** (3f18abc): Playwright 5 viewport (1366/1489/1920/2560/3840) 回帰テスト追加。`@playwright/test` devDependency + chromium のみインストール。1489 で `Math.round(width) === 125` (tank) / `=== 50` (dps) 厳密検証。他 viewport は ±0.5px tolerance
  - **付随バグ修正**: `setMemberHeaderRef` のインライン ref コールバック `(el) => ...` が毎レンダーで新インスタンス生成 → React が detach/attach 繰り返し → `setRefVersion` 無限ループ → ErrorBoundary。`getMemberRefCallback(id)` を `useRef<Map>` でキャッシュし安定化
- **Task 7** (3bde442 + 本コミット): TODO 更新 + push

### キーポイント
- **1489 厳密検証**: `1489 * 0.08395 ≈ 125.00` (T/H), `1489 * 0.03358 ≈ 50.00` (DPS) が clamp の中央域で確定。Playwright で round 後の整数値で `.toBe(125)` / `.toBe(50)` 厳密一致
- **2pass 測定の挙動**: 初回レンダーで refs が null のため軽減アイコンは fallback (125/50) で 1 フレーム描画。その直後の useEffect で実測値に上書き
- **DPR 非依存**: clamp + vw は CSS 論理 px ベース。本人 DPR 2.58 / 多数派 DPR 1 でも計算結果同じ
- **Phase 2 (別プラン)**: フォント (`--font-size-*`) と spacing の rem 化は影響範囲が広い (LP/モーダル/サイドバー全体) ため別建てに切り出し済

### 検証結果
| viewport | tank 実測 | dps 実測 | 期待 |
|----------|----------|---------|------|
| 1366 | ~115px | ~46px | clamp min 寄り |
| **1489 (本人)** | **125px (round 厳密)** | **50px (round 厳密)** | 基準値 |
| 1920 | ~161px | ~64px | 多数派 |
| 2560 | 180px | 80px | max クランプ |
| 3840 | 180px | 80px | max クランプ |

## 完了（2026-05-08）

### Sub-spec 2A: Registration (画像なしモード) 完了 2026-05-08
- [x] タグマスタ 147 件 × 4 言語 i18n (`src/data/housingTags.ts` + ja/en/ko/zh.json)
- [x] フォーム入力検証 純粋関数 (`src/utils/housingValidation.ts`、validateAddress/Tags/Description/RegistrationDraft)
- [x] 登録枠 D 案ロジック 純粋関数 (`src/utils/housingQuota.ts`、累計 30 まで無制限 + 30 超過後 1 日 5 件、UTC 日付ベース、同日削除で count 戻し)
- [x] 同住所キー生成 純粋関数 (`src/utils/housingDuplicate.ts`、`buildAddressKey` で `dc|server|area|W{n}|P{n}|size[|R{n}]` 形式)
- [x] `HousingListing.addressKey: string` 必須フィールド追加 (型 + firestore.rules 検証 + 本番 rules デプロイ)
- [x] Firestore listings 読取 service (`src/lib/housingListingsService.ts`、`findListingsByAddressKey`)
- [x] `/api/housing` 3 アクション (can-register / register-listing / check-duplicate)、Admin SDK + AppCheck + RateLimit + runTransaction でアトミック
- [x] API クライアントラッパー (`src/lib/housingApiClient.ts`、QuotaExhaustedError 含む)
- [x] HousingPage 3 タブ (探す/回る/登録) 切替 + URL ハッシュ同期 (`HousingPage.tsx` + `HousingTabBar.tsx` + `HousingPlaceholderView.tsx`)
- [x] 登録フォーム本体 (`HousingRegisterView.tsx`) + 住所入力フィールド + タグピッカー (5 件上限) + 紹介文入力 (200 文字) + 残り枠表示 + 重複警告ダイアログ + オンボーディングダイアログ + 未ログインプロンプト
- [x] App.tsx の `/housing` ルートを `HousingComingSoonPage` から `HousingPage` に差し替え
- [x] 437 tests PASS (既存 + 新規 約 80 件) / tsc clean / npm run build 成功
- [x] Playwright 自動チェック 7/7 OK (3 タブ表示 / オンボーディング初回 → 「はじめる」で閉じる / LocalStorage flag で再訪時 0 / 未ログイン `/miti` 誘導 / 探す・回るタブのプレースホルダ)
- 設計書: `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` §6 / §11 / §12
- 実装プラン: `docs/superpowers/plans/2026-05-08-housing-sub-spec-2a-registration.md` (26 tasks、3,682 行)
- 実装フロー: subagent-driven-development で各タスクごとに implementer + spec reviewer + quality reviewer の 3 段階レビュー
- スコープ外 (後続): 画像 3 択 (SNS URL / サムネアップロード) は Sub-spec 2C / ギャラリー検索は Sub-spec 2B / リキッドグラス + ルーペは Sub-spec 2C 以降

## 完了（2026-05-01）
- [x] **PiP（Floating Timeline）復活**: 過去に「Chrome の Document Picture-in-Picture API は OS レベル透過不可」で UI 非表示にしていたカンペビューを復活。仕様変更: ①透過機能完全撤去（将来 Chrome 透過対応で再検討）②単一選択 → 多選（個別/全員/任意組合せをジョブピッカー多選で統合）③自ジョブ未設定時 全員フォールバック ④透過の代わりに背景カラーピッカー追加（テーマ別デフォルト #0F0F10/#FAFAFA + localStorage `pip-bg-color` 永続化、HTML5 native input[type=color] + LoPo 風小色丸ボタン）⑤PC 起動ボタン disable 撤廃（自ジョブ未設定でも開ける）⑥モバイル FAB「カンペ」項目復活。設計書 `docs/superpowers/specs/2026-05-01-pip-revival-design.md`、実装プラン `docs/superpowers/plans/2026-05-01-pip-revival.md`、subagent-driven-development で 8 task + 最終レビュー進行。純粋関数 3 つ（`computeCueItems` / `computeInitialSelection` / `getDefaultBgColor`）を `src/utils/pipViewLogic.ts` に TDD 抽出（16 tests）し、PipView.tsx 本体改修。i18n 4 言語で 3 キー追加 / 2 キー削除。最終 328 tests PASS（既存 312 + 新規 16）、tsc clean、`npm run build` 成功。最終レビューで Important 1 件（cursor-pointer 欠落）fix 済み、Minor 3 件は本番実機確認で判断、Nice-to-have 2 件は次タスクで対応可。
- [x] **「自分のプラン」バッジ機能 諦め決定**: 共有 API が ownerId を Firestore に書き込んでいないため動作不能。LoPo は個人特定情報を一切収集しない方針 → ownerId 書き込みは仕様禁止。今後は公式ロゴ OGP で自分のプランを識別する運用に切替。バッジ実装コードは残置（_popularHandler.ts と PopularBrowseView.tsx）、撤去するかは別途相談。

## 完了（2026-04-28）
- [x] **OGP プレビュー「永遠に生成中」5 段階修正**: ①SW NetworkOnly で `/og/` を SW 介入から除外 ②`<img>` に key 追加で URL 変更時の再マウント保険 ③`setOgImageUrl(null)` 挟みで bail-out 回避 ④closure 回避で `processLogoFile` から logoUrl 引数化（真の根本原因） ⑤PUT レート制限 5→15 で連続操作の失敗トースト解消。
- [x] **野良主流 OGP 表示ポリシー整理**: プラン名 OGP 焼き込み機能を全削除、ボトムシート/X 共有テキストからプラン名撤去、共有モーダル初回 POST 直前に同意ダイアログ、ロゴトグル＝身元公開意思の明確化、4 言語常駐キャプション。
- [x] **致命バグ修正＋自動採番**: 野良主流ボトムシートからのコピーで `ownerId: ''` 空文字になり雲同期で「別端末で削除」誤判定→プラン消失バグを修正（`ownerId: 'local'` 統一）。`generateUniqueTitle` で野良コピー＋下にコピーの両方で同コンテンツ内重複時に `(2)` 自動採番。
- [x] **PopularConsentDialog ライトモード白背景化**: 他主要モーダルと同じ `--share-modal-bg` 適用。
- [x] **スマホ空行操作対応**: イベントのない行でもタップ→軽減追加シート、長押し→EventModal が開くよう `events.length > 0` ガード撤去。

## 完了（2026-04-20）
- [x] **LP SEO 改善（レベル 1）**: index.html / 4 言語 locale / LandingPage.tsx を更新、「FF14 軽減表」等の検索キーワードをメタタグに反映（多言語 ja=軽減表、en=mitigation sheet、ko=경감 시트、zh=减伤轴）。
- [x] **Vercel 2026 年 4 月セキュリティインシデント対応**: Vercel CLI 導入、監査（不正侵入痕跡ゼロ確認）、全カスタム環境変数を production/preview で sensitive 化（29本）。

## 完了（2026-04-18）
- [x] **サイドバータブのリセットバグ修正**: プラン削除/コピー等の操作でタブが勝手に零式へ戻るバグを解消。useEffect 依存配列から `plans` を外し、`currentPlanId === null` の else 分岐を削除（ユーザー選択中のタブを保持）。旧サイドバーUI時代の名残。
- [x] **ヘッダー縦罫線の太さ統一**: 3本の罫線を `w-px shrink-0` で統一（サブピクセル圧縮対策）。完全に揃わないケース残るが実害なしで放置判断。
- [x] **フェーズ/ラベル隣接規約の本質修正**: 境界罫線消失バグを根本解消。新規約 `phase[i].endTime + 1 === phase[i+1].startTime` で描画仕様と整合。`loadSnapshot` 時に旧規約データを自動修復。全219テストPASS、実機検証済み。
- [x] **隣接フェーズ/ラベル境界追従**: `updatePhase/Label*Time` 4関数で追従挙動を統一。被せた側が隣を追従、最低幅1秒で停止。新規テスト19ケース追加。
- [x] **最終フェーズ/ラベル endTime 修正**: `ensurePhase/LabelEndTimes` に `maxTime` 引数追加、15呼び出し元で `timelineEvents` 最大時刻を渡すよう修正。
- [x] **admin画面 i18n キー生表示修正**: ja/en/zh/ko 全4言語で `admin` オブジェクトの閉じ `}` 位置ズレ修正（`ugc_*`/`featured_*` キーが backup 内に誤配置）。
- [x] **Phase 3 実装完了**: 管理画面 Featured 設定UI + OGP 高速化 + 削除防止。`PATCH /api/popular`、`AdminFeatured.tsx`、`/og/{hash}.png` 静的配信、`keepForever` で cron 削除除外。11 commits。
- [x] **3層防御の自動診断 全プロジェクト対応**: `check-secret-defense-layers.sh`（SessionStart 診断）、`setup-secret-defense.sh` に Layer C 自動適用追加、グローバル CLAUDE.md にセキュリティ標準セクション追加、Booklage にも適用。
- [x] **シークレット漏洩 3層防御 導入**: Layer A (SessionStart worktree scan) / Layer B (gitleaks pre-commit) / Layer C (GitHub Secret Scanning + Push Protection)。worktree に staged で残っていた `.env.vercel-check` が契機（commit/push 未遂、実害なし）。
- [x] **Phase 2 本番観察完了**: UID 重複排除、anonId 新規記録、App Check 強制、クライアント dedup すべて動作確認。
- [x] **shared_plans 管理人テスト 179件一括削除**（ツイート用 `5lCMACDB` のみ残存）。
- [x] **OGP 画像 X 表示問題 最終解決**: Firebase Storage 静的キャッシュ + Lazy 生成 + 週次 Cron。`lopoly.app/og/{hash}.png`、30日未使用削除、4言語 Privacy Policy `privacy_section6` 追加。

## 完了（2026-04-17）
- [x] フェーズ/ラベル追加: 強制2秒間バグ修正（endTime計算: containingPhase引き継ぎ+maxEventTimeフォールバック）
- [x] ボトムシートUX改善: 初期ロード全面スピナー + コピー進捗実値・パルス・最低400ms（本番確認済み）
- [x] 通知音パス修正: FFXIV_SE/FFXIV_Notification.mp3 へ更新
- [x] 野良主流ランキング再設計 + Phase 1/Phase 2 実装
- [x] タンクLBスキル追加（Lv1/2/3 × 4ジョブ）

## 完了（2026-04-16 後半）
- [x] リタージーオブベル: 管理画面から追加→Firestoreデータ修正（ID正規化+family追加）→seed事故で消失→mockData.ts追加で復元
- [x] 管理画面SkillWizard改善: クリーンID生成（ランダムサフィックス廃止）、family入力欄追加、IDプレビュー・編集・重複チェック
- [x] seed-skills-stats.tsをマージ型に変更（管理画面追加スキルがseedで消えない）
- [x] ディヴァインカレス: requiresWindow=30追加（Divine Grace 30秒ウィンドウ）

## 完了（2026-04-16）
- [x] OGP共有画像: アスペクト比維持（正方形強制→長辺1056pxリサイズ、object-fit: contain）
- [x] 共有モーダル: ライトテーマ視認性改善（--share-modal-bg変数でShareModalのみ白背景化）
- [x] 利用規約: UGCセクション追加（著作権帰属・ライセンス・免責・削除権限・通知窓口、4言語対応）
- [x] ShareModal: ロゴアップロード注意書き追加（利用規約リンク付き、4言語対応）
- [x] 管理画面: UGC管理ページ追加（shareId検索→ロゴ確認・削除）
- [x] プラン複製バグ修正: コピー→開く→「別端末で削除」誤判定を修正（ownerId:'local'設定）
- [x] NewPlanModal: パーティクリア漏れ修正（前プランのジョブ引き継ぎバグ）
- [x] UIブラッシュアップ: タイムライン行ホバーライン（4セル下辺、CSS変数調整可能）
- [x] ライトモード: 5モーダル白背景化（削除確認・FFLogs・ログイン・オートプラン・新規作成）
- [x] チュートリアルカード: 緑バーはみ出し修正（overflow-hidden）
- [x] UGC管理: ロゴ削除時にハッシュブロックリスト登録（SHA-256で再共有防止、個人情報保存なし、4言語対応）
- [x] ヒールスキル15種追加（WHM6/SCH4/SGE4/AST1、4言語対応、公式データベースから正確なデータ取得）
- [x] 秘策：展開戦術を個別スキルに分離（秘策+展開戦術）
- [x] アスペクト・ヘリオス/コンジャンクション・ヘリオスを常時表示化
- [x] リリーゲージ実装（初期3、20秒リチャージ、ハート・オブ・ソラス消費）
- [x] ケーラコレ/タウロコレの軽減10%排他制御（exclusiveWith機能追加）
- [x] 鼓舞/Eディアグノシスのhidden解除
- [x] 展開戦術バリアコピー実装: 鼓舞のバリア値（バフ込み）を参照してパーティにコピー、鼓舞選択UI付き
- [x] 秘策(SCH)クリ確・ゾーエ(SGE)×1.5の消費型バフをバリア計算に反映
- [x] 生命回生法・クラーシス等のtarget指定healingIncreaseをバリア計算に反映
- [x] 展開戦術の効果時間を鼓舞の残り時間に動的連動
- [x] 瞬発スキル（duration≤1秒）のエフェクト棒を非表示化
- [x] 罫線トグルボタンの即時反映修正（getState()→リアクティブ購読）
- [x] 法務: 利用規約整備 — UGC著作権免責・ライセンス付与・禁止事項・削除権限・通知窓口（消費者契約法配慮）

## 完了（2026-04-14）
- [x] プラン複製時に最新テンプレートのイベントを自動使用（軽減・パーティは保持、圧縮済みプラン対応）
- [x] 幽霊フェーズ除去: CSVインポート残骸のデフォルトフェーズ削除+テンプレート読み込み時自動フィルタ
- [x] ラベル列折り畳み機能（Shift+L / ドロップダウンボタン、16pxバー、localStorage永続化）
- [x] ラベル列スマート連動（フェーズ畳み時：ラベルありなら残る、なしなら自動折り畳み）
- [x] フェーズ名空白対応（テンプレートで空名→オーバーレイ非表示、ドロップダウンはPhase Nフォールバック）
- [x] フェーズ名変換修正（Sidebar/usePlanStore: || → ?? でフォールバック除去）

## 完了（2026-04-13）
- [x] フェーズ/ラベルのendTime必須化リファクタ
- [x] サイドバー大幅改築（設計確定・実装完了）
- [x] SVGパスエラー: LoPoButton.tsxのpathをResizeObserver+数値計算に修正
- [x] Firestore削除同期エラー: ownerId='local'除外+権限エラー時リトライ停止
- [x] WHMリタージーオブベル: 管理画面から追加+Firestoreデータ修正済み
- [x] SCH鼓舞激励の策 / SGE Eディアグノシス: hidden解除+展開戦術バリアコピー実装
- [x] UGC管理: ロゴ削除→ハッシュブロックリスト方式で解決
- [x] 管理ダッシュボード（シンプル版）— ユーザー数・プラン数 + 外部リンク3つ
- [x] ランディングページのLangToggle（2言語→4言語対応）
- [x] コンテンツ名のzh/ko翻訳（contents.json + 管理画面対応）
- [x] Firestoreへのzh/koマイグレーション実行（63件反映済み）
- [x] スキル・ジョブ名のzh/ko翻訳（mockData.ts 21ジョブ+123スキル、Firestore同期済み）
- [x] テンプレート技名のzh/ko翻訳機能（管理画面FFLogsモーダル拡張済み）
- [x] 古いプランの自動アーカイブ（30件超過時）→ 過去零式は自動アーカイブ化済み
- [x] 全カテゴリ7日未使用でサイレント圧縮済み

## 完了（2026-04-09）
- [x] フッターglass効果: Layout.tsx + PopularPage.tsxにglass-tier3 glass-frame適用
- [x] チュートリアルSTEP1-3サイドバーハンドル右罫線消失バグ修正（右側代替ライン追加）
- [x] 同一時刻イベントの表示順保証: MT→ST→AoEの順で常に表示（Timeline.tsx eventsByTime）
- [x] PC版ヘッダー開閉ハンドル・SyncButton雲アイコンの位置ずれ修正（glass CSS定義順序修正）
- [x] PC版パーティ編成モーダルのクリック不能修正（endDrag再レンダー+SlotItem内部定義問題）
- [x] パーティ編成D&D時テキスト選択反応修正（user-select:none追加）
- [x] パーティ編成ジョブアイコン常時表示に変更
- [x] スマホ長押し時テキスト選択修正（user-select:none追加）
- [x] スマホヘッダーコンテンツ名省略修正（subtitleサイズ+muted色に縮小）
- [x] glass-panelのborder/shadow除去、画面いっぱい化
- [x] FAB言語切替を横一列spring展開に実装
- [x] 長押しチュートリアルをMobileGuide 6枚目に追加
- [x] ラベル分裂 → Phase/Labelリファクタリングで根本解決
- [x] テンプレートエディタ空ラベル編集不可 → undefinedマッチ修正

## 完了（2026-04-06 セッション2）
- [x] ジョブ名ツールチップが言語設定に追従しない → getPhaseName()でzh/ko対応、フォールバック順en優先に修正
- [x] Tooltipのz-indexをモーダルより上に変更（9999→99999）
- [x] テンプレート保護: 管理画面保存時にlockedAt自動付与（FFLogs自動登録で上書き防止）
- [x] テンプレートエディタ一括編集（チェックボックス選択 + AAフィルタ + 一括変更ポップアップ）
- [x] AA一括対象指定（MT/ST等を一括で設定）→ 一括編集機能に統合
- [x] 技名ソート・フィルタ（AAのみ表示→一括指定等）→ AAフィルタに統合
- [x] 翻訳管理画面にジョブ名カテゴリを追加（スキルカテゴリ内、zh/ko翻訳管理可能に）
- [x] ClearMitigationsPopoverのジョブ名表示を多言語対応
- [x] PartySettingsModalの残存ハードコード（job.name?.ja）を修正

## 完了（2026-04-06）
- [x] **新規作成で空テーブル** — テンプレート読み込みスキップ、コンテンツ名+プラン名のみ保持、hideEmptyRows=false
- [x] **互換配置UIの青ハイライト** — 選択中カードを透き通った青（blue-500/10）に変更、resetは赤のまま
- [x] **フォーカスモード左右対称化** — 右罫線ストリップ追加（フォーカスモード時のみ表示、スプリングアニメーション）
- [x] **フォーカスモード用ボタン** — 右ストリップにテーマ切替・ジョブハイライト・保存インジケーター（弾むアニメーション付き）
- [x] **フッター間隔修正** — mb-2→mb-4、ヘッダーハンドル〜表の間隔と統一
- [x] **フォーカスモード時ヘッダー間隔修正** — paddingTop 36→23で展開時と同じ間隔に
- [x] **保存インジケーターアニメーション修正** — animate-spin→animate-pulse（雲が回転しなくなった）
- [x] **サイドバーカテゴリボタン横スクロール** — ホイールで横スクロール対応

## 完了（2026-04-05 セッション2）
- [x] **チュートリアルデータ消失の根本修正** — ログイン後プラン自動読み込み廃止、スナップショットsessionStorage保存、チュートリアル中localStorage永続化停止
- [x] **FFLogsダメージ精度改善** — cast2パス方式、AoE中央値（タンク除外）、同名技統一、パケット分離マージ、両タンクTB扱い、playerDetailsネスト対応、FFLogsモーダルz-index修正、ログインボタン修正、multiplier+max+5%バッファ、TB同名技統一、auto-register LocalizedString対応
- [x] **スマホUI大幅改善** — 軽減ボトムシート、リキャスト表示、メニュー排他制御、ノッチ対応、競合ハイライト
- [x] **PC UI改善** — ラベル末尾表示修正、ツールチップ、ジョブアイコン拡大
- [x] **バグ修正** — スプシダメージ取込、WelcomeSetupキャンセル、logsインポート全面書換、保存警告削除、zh/ko黒塗りバグ
- [x] **myMemberIdスナップショット共有** — 端末間でmyMemberIdを共有

## 完了（2026-04-05 整理）
- [x] **言語切替UIの見直し** → 地球儀アイコン+ドロップダウンにシンプル化（ツールチップ・ホバー反転・回転アニメーション付き）
- [x] **GitHub Public化** → リポジトリ公開、シークレット漏洩チェック・.gitignore徹底完了
- [x] **セキュリティ・プライバシー調査** → Public化前に実施済み
- [x] **デザイントークン Phase 2** → タイポグラフィ値調整完了（CSS変数の値変更のみで全UI反映）
- [x] **PC⇔スマホ同期が全く機能しない** → 修正済み（PULL追加・forceSyncAll安全化・タイムスタンプ比較・インジケータ3段階化）
- [x] **PWAでGoogleログインできない** → Googleログイン自体を廃止。Discord/Twitterはリダイレクト方式のためPWAでも動作
- [x] **チュートリアルSTEP1: スクロール禁止してないため進行不可になる** → wheel/touchmoveブロック追加
- [x] **チュートリアル開始時: サイドバーの罫線が一部消える** → チュートリアル中のみ代替罫線表示
- [x] **新プランを開いたとき表の一番上にスクロールされない** → currentPlanId監視でscrollTopリセット
- [x] **エクスポート/インポート機能** → バックアップ/復元として実装済み（個人情報除外、平文JSON、2段階確認）

## 完了（2026-04-01）
- [x] **管理者ログインモード** — LoginModalにisAdmin時のみ黄色の管理画面ボタン表示。メアドやUID漏洩なし（Firebase Custom Claims判定）
- [x] **フォントサイズ全体拡大** — data-font-scale="1"、最低12px、表エリア・フッター除外
- [x] **チュートリアル全面刷新** — mainマージ+デプロイ済み
- [x] **テンプレート管理画面リデザイン設計書** — 承認済み（`docs/superpowers/specs/2026-04-01-template-editor-redesign.md`）
- [x] **βフィードバック整理** — `docs/BETA_FEEDBACK.md` に11項目を対応状況付きでまとめ

## 完了（第63セッション 2026-03-31）
- [x] **コントロールバーのアイコン配置見直し** — チートシートボタンをArea Cに無効化状態で移動。フローティングビュー切り替えUI削除
- [x] **ヘビー級まとめ共有** — まとめて共有モード中、シリーズ名横にチェックボックス追加。各層の1番目のプランを一括選択/解除
- [x] **AA設定ボタンのスタイル修正** — 黒塗り→アウトライン+ホバー反転
- [x] **コピートーストのスタイル統一+ESC対応** — 他トーストと同じデザインに統一、ESCでキャンセル可能
- [x] **キーボードショートカット追加** — S(サイドバー), H(ヘッダー), P(パーティ), F(フォーカスモード)
- [x] **ツールチップのテーマ配色統一** — 反転配色を廃止、ダークはダーク/ライトはライトに

## 完了（第61セッション 2026-03-31）
- [x] **管理画面ウィザードファースト刷新** — 全11タスク実装完了＋本番デプロイ。ウィザード共通フレームワーク（useWizard + AdminWizard）、ダッシュボードをアクションカード方式に刷新、コンテンツ/テンプレート/スキル/ステータス各ウィザード、スキル編集/ジョブ追加ウィザード、バックアップ復元API+画面、監査ログAPI+画面。新規10ファイル、変更5ファイル、i18n 149キー追加

## 完了（第60セッション 2026-03-31）
- [x] **12関数→7関数に圧縮完了** — admin(3→1), auth(2→1), template(2→1), share+share-page(2→1)に統合。`_` プレフィックスのハンドラーファイル+ルーターindex.ts方式。Discord/Twitter開発者コンソールのコールバックURL変更済み
- [x] **OGP画像追加** — public/ogp.pngが存在せずDiscordプレビューが表示されなかった問題を修正
- [x] **プラン未選択時の空パネルデザイン刷新** — 完了確認
- [x] **ステータス表示** — ライトモードでデザイン見直し完了確認
- [x] **Firestoreバックアップ設定** — 週次（月曜）自動バックアップ、14日保持で設定完了
- [x] **LoPo管理マニュアル作成** — 全キー・URL・手順を `C:\Users\masay\Desktop\LoPo管理マニュアル\` に保存

## 完了（第58セッション 2026-03-31）
- [x] **ログイン促進UI実機確認＆改善** — シークレットウィンドウで表示確認OK。ShareModalゲストヒント文言をチームロゴ限定→汎用表現に改善。サイドバー名前入力ダイアログにもログイン促進テキスト+LoginModal追加
- [x] **CSP強化** — vercel.jsonに`object-src 'none'`（プラグイン禁止）、`base-uri 'self'`（baseタグ注入防止）、`form-action 'self'`（フォーム送信先制限）を追加

## 完了（第57セッション 2026-03-31）
- [x] **i18nハードコーディング精査** — PartyStatusPopover(スキル名21個→SKILL_DATA動的取得)、MitiPlannerPage/LandingPage(document.title)、CsvImportModal(UIテキスト全件)、ErrorBoundary(エラーメッセージ)、ConsolidatedHeader/ShareButtons/SharePage(defaultValue日本語削除)、CheatSheetView/TimelineRow(alt属性)
- [x] **非ログインユーザーへのログイン促進UI** — NewPlanModal・ShareModalに非ログイン時のさりげない案内テキスト+ログインリンク追加（★実機確認未完了→第58セッションで要確認）

## 完了（第56セッション 2026-03-31）
- [x] **アプリ動作パフォーマンスの最適化** — React.memo（MitigationItem, ContentTreeItem, SaveIndicator）+ useShallow（Timeline, Sidebar, ConsolidatedHeader, CheatSheetView, Layout）+ useCallback（Timeline内6ハンドラ）+ Layout.tsx分割（MobileHeader, MobilePartySettings切り出し）
- [x] **サイドメニュー・ヘッダーの開閉パフォーマンス最適化** — 上記React.memo+useShallowで対応
- [x] **イベントポップオーバー改善** — glass-tier3追加、削除ボタン赤文字+角丸、Escape対応
- [x] **Redo修正** — Ctrl+Shift+Zでe.keyが大文字'Z'になる問題をtoLowerCase()で解決 + canUndo/canRedoリアクティブセレクタ追加
- [x] **MyJobボタン黄色統一** — PartySettingsModal, MobilePartySettings, ConsolidatedHeader, MobileBottomNavの全箇所で黄色に変更
- [x] **JobMigrationModalライトモード修正** — text-white→text-app-text、ダーク専用背景除去、createPortalでbody描画（ヘッダー埋まり問題修正）
- [x] **オートプランi18n翻訳キー追加** — auto_plan_title/confirm/confirm_mobileをen.json/ja.jsonに追加
- [x] **ConfirmDialogのi18nハードコーディング修正** — confirmLabel/cancelLabelをt()キーに変更

## 完了（第55セッション 2026-03-30）
- [x] **MitigationSelectorにEscapeキー対応追加** — useEscapeCloseフック適用。対象選択サブビュー表示中はEscでスキル一覧に戻り、スキル一覧でEscを押すとモーダル全体を閉じる段階的閉じ動作

## 完了（第54セッション 2026-03-30）
- [x] **Escapeキーでモーダル・メニューを閉じる** — useEscapeCloseフック（スタック機構付き）で全モーダル14個+ポップオーバー3個+Sidebar⋮メニューに対応
- [x] **PartyStatusPopover contentLanguage依存修正** — useMemoの依存配列にcontentLanguageを追加（言語切替時にスキルプレビューが再計算されないバグ修正）
- [x] **パーティメンバーID定数の共通化** — Layout.tsx(2箇所)・Timeline.tsx(2箇所)・useTutorialStore.ts(1箇所)の重複をsrc/constants/party.tsに集約

## 完了（第53セッション 2026-03-30）
- [x] **Sidebar: button入れ子問題** — 親button→div role=button化、ホバーボタン表示、⋮メニューPortal化、削除ボタン追加、プラン名ツールチップ、レイアウト変更

## 完了（第51セッション 2026-03-30）
- [x] **Firestore同期修正** — 端末間同期が動作していなかった問題を修正。migrateOnLoginでのFirestore書き戻し、dirtyフラグ管理、3分クールダウン、forceSyncAllタイムアウト、カウンター自動修復（repairPlanCounts）、5分定期バックアップ同期
- [x] **Firestore同期: 3分クールダウン実装** — syncToFirestoreに_lastSyncAtチェック追加
- [x] **起動時Firestore読み込み非ブロッキング化** — チームロゴ読み込みをバックグラウンド化
- [x] **forceSyncAllタイムアウト追加** — 10秒でタイムアウト（ログアウトハング防止）
- [x] **beforeunload警告拡張** — ログイン中+未同期の変更がある場合にも警告表示

## 完了（第50セッション 2026-03-30）
- [x] **プライバシーポリシーの内容確認** — 第50セッションで全面改訂済み（9→11セクション、外部サービス表・保存期間表新設、平易な日本語化）

## 完了（第45セッション 2026-03-30）
- [x] **包括的セキュリティ監査** — API・フロントエンド・Firebase 3方面から35件の問題を検出、28件修正
- [x] **OAuth CSRF保護** — Discord OAuthにstate+HttpOnly cookie追加
- [x] **OAuthトークンXSS修正** — JSON.stringifyエスケープ（Discord/Twitter）
- [x] **全APIエラーレスポンスからdetails除去** — 6ファイル
- [x] **CORS制限強化** — *.vercel.app全許可 → lopo-miti(-xxx)のみ
- [x] **/api/share保護** — レート制限+ボディサイズ制限+viewCount IP重複排除
- [x] **ADMIN_SECRETタイミングセーフ比較** — crypto.timingSafeEqual使用
- [x] **Firestoreルール強化** — plansのread制限、copyCount/useCount改ざん防止、version楽観ロック、users hasAll
- [x] **アカウント削除時Storageロゴ削除追加**
- [x] **VITE_FFLOGS_CLIENT_SECRET露出リスク解消** — 開発環境もサーバーサイドプロキシ経由
- [x] **CSPヘッダー追加**（vercel.json）
- [x] **email表示削除**（Layout.tsx、AdminLayout.tsx）
- [x] **Twitter OAuthスコープ最小化** — tweet.read除去
- [x] **未使用xlsxパッケージ削除**（高脆弱性解消）
- [x] **auth.lopoly.app DNS反映確認** — Googleログイン正常動作

## 完了（第44セッション 2026-03-30）
- [x] **Googleログイン画面のドメイン表示修正** — auth.lopoly.appサブドメインをFirebase Hosting+Cloudflare DNSで設定、authDomainを変更（DNS反映待ち）
- [x] **サイドバー畳み時のアイコン化** — isOpen判定で☕のみ表示
- [x] **全モーダル×ボタンの反転ホバー統一** — 15ファイルの×ボタンにhover:bg-app-text hover:text-app-bgを適用
- [x] **ステータス設定のタイトル統一** — 「パラメータ設定」→「ステータス設定」
- [x] **TANK/HEALER/DPSラベルのライトモード視認性改善** — dark:修飾子で色分け
- [x] **FFLogsインポートモーダルのz-index修正** — createPortalでbody直下にレンダリング
- [x] **デザイン改善6画面確認済み** — フェーズ追加・共有プレビュー・削除確認・オートプラン・FFLogs・ログイン画面OK
- [x] **ToDo全体の整理・外部レビュー指摘の追記** — 運用・品質基盤セクション追加（テスト・エラー監視・バックアップ・a11y・法的確認等）
- [x] **ToDo確認用HTML作成** — docs/todo-review.html（チェックボックス+コピー機能付き）

## 完了（第43セッション 2026-03-30）
- [x] **ライトモードのモーダル背景改善** — glass-tier3のライトモードデフォルトを `transparent→rgba(255,255,255,0.65)` + `blur 2px→12px` に変更。サイドバー・ヘッダーは `glass-frame` クラスで元の値を維持
- [x] **スライドオーバーのバックドロップ暗転削除** — PartySettingsModal, PartyStatusPopoverのbg-black/50を除去
- [x] **JobPickerのバックドロップ暗転削除**
- [x] **共有モーダルのヘッダー改善** — bg-app-surface2/40追加、OGPプレビュー背景を60%透過に

## 完了（第42セッション 2026-03-29）
- [x] **アクセントカラー導入** — CSS変数でblue/red/amber定義。全モーダル・ダイアログのボタンに適用済み
- [x] **ツールチップ反転表示** — glass-tier3変数上書き方式でテーマ反転
- [x] **パルス設定のlocalStorage永続化**
- [x] **MitigationSelector グラスモーフィズム復活**
- [x] **ClearMitigationsPopover 角丸修正**
- [x] **PartyStatusPopover text-whiteハードコード→テーマ変数化**
- [x] **人気ページの「ランキング」文言削除**

## 完了（第40セッション 2026-03-29）
- [x] **OGP画像の多言語対応** — vitest導入、OGPロジックをogpHelpers.tsに切り出し（32テスト）、CONTENT_METAにenフィールド追加、getContentName/trySeriesSummary多言語対応、共有データにlangフィールド保存、OG画像・メタタグの言語切替
- [x] **テストフレームワーク導入（vitest）** — vitest導入済み。ogpHelpersのテスト32件
- [x] **Discord鯖のチャンネル設計・権限設定** — コミュニティ機能ON、ルール設定、チャンネル構成整備、@everyone権限制限、βテスター用カテゴリ作成
- [x] **Discord Bot設計** — 設計書作成完了（`docs/superpowers/specs/2026-03-29-lopo-discord-bot-design.md`）

## 完了（第39セッション 2026-03-29）
- [x] **共有モーダル: ロゴ/画像の操作修正** — share APIにPUT追加、ロゴ追加/変更/削除時にshareデータ上書き更新
- [x] **プランの端末間同期の信頼性修正** — Firestoreを正として扱うマージロジックに変更
- [x] **プランの端末間同期の信頼性調査** — 第39セッションで調査・修正完了

## 完了（第35セッション 2026-03-29）
- [x] **バグ修正: コンパクト表示のエフェクト棒** — 軽減の効果時間バーがコンパクト表示で1行分はみ出す問題を修正（空行は直前の可視行で切り詰め）

## 完了（第34セッション 2026-03-28）
- [x] **管理者向け運営マニュアル作成** — `docs/ADMIN_OPERATIONS_MANUAL.md` に作成済み
- [x] **バグ修正: AAアイコン** — text-app-text-muted → text-app-text-sec（ライトモード視認性向上）
- [x] **バグ修正: パルスカラーパレット** — GradientSliderにoverflow-hidden + getValueFromXサム幅考慮
- [x] **バグ修正: SELECTテキスト** — text-white/40 → text-app-text-muted（ライトモード対応）
- [x] **Discord通知刷新** — GitHub Commit Webhook廃止 → 管理画面データ更新時にユーザー向け自動通知（DISCORD_UPDATE_WEBHOOK_URL）
- [x] **CSVエクスポート** — サイドバーのプラン⋮メニューからCSVダウンロード機能を追加
- [x] **ADMIN_REFERENCE.md更新** — FirebaseプランSpark→Blaze修正

## 完了（第30セッション 2026-03-28）
- [x] **Firebase App Check有効化** — reCAPTCHA Enterprise設定・サイトキー作成・Vercel環境変数追加・Firebase Console登録
- [x] **Firestoreセキュリティルールのデプロイ** — master/templates/backups/admin_logsのルール追加・firebase deploy完了
- [x] **ログアウト高速化** — forceSyncAllの直列ループをPromise.allSettledで並列化（50-70%高速化）
- [x] **管理画面UI改善** — Toast成功/失敗区別・selectドロップダウン背景色・フォームUX全面改善（例をラベル横に表示・シリーズドロップダウン化・層選択・上級者設定折りたたみ）
- [x] **管理基盤 Phase 0〜1 セットアップ完了** — 第28-29セッションで実装、第30でApp Check+ルール+UI改善

## 完了（第29セッション 2026-03-28）
- [x] **管理者ロール初回セットアップ** — ADMIN_SECRET設定・curl実行・/admin動作確認OK
- [x] **Firebase App Check導入（コード実装）** — フロントエンド初期化・APIクライアント・サーバー検証・全API統合
- [x] **管理基盤 Phase 1 実装** — コンテンツ・テンプレートのFirestore移行完了
- [x] **Firestoreシーディング** — 63コンテンツ+18シリーズ+25テンプレート投入
- [x] **Googleログイン修正** — Google Cloud APIキーのウェブサイト制限追加

## 完了（第28セッション 2026-03-28）
- [x] **管理基盤 Phase 0 実装** — 管理者ロール(Custom Claims)、管理画面骨組み(/admin)、APIレート制限、監査ログ、プラン複製機能、GoogleログインPWA対応、CORSホワイトリスト化

## 完了（第27セッション 2026-03-28）
- [x] **管理基盤・マスターデータFirestore移行 設計書作成** — 全ゲームデータのFirestore移行計画（→ `docs/管理基盤設計書.md`）

## 完了（第26セッション 2026-03-28）
- [x] **コンテキスト最適化** — CLAUDE.mdの必読リスト2層化、古い引き継ぎ書4件削除、TODO完了タスクアーカイブ、セッション終了時クリーンアップルール追加
- [x] **サイドバーボタンのホバーアニメーション追加** — ボタン群に白黒反転+active:scale-95、カテゴリ/レベルタブにも同様、ツリー要素にactive:scale-[0.98]
- [x] **言語設定がページ間で引き継がれないバグ修正** — i18n.tsの初期化時にlocalStorageから保存済み言語を復元するよう修正
- [x] **ダンジョン・レイド・その他のプラン作成対応** — SavedPlanにcategoryフィールド追加、NewPlanModalで自由入力対応、サイドバーでカテゴリ別表示、Firestore保存/復元対応
- [x] **NewPlanModal改善** — レベル・カテゴリ未選択スタート、「任意」ラベル削除、Enterキーで作成、未入力項目の案内表示、コンテンツ選択をドロップダウンから1列フラットリストに変更

## 完了（第25セッション 2026-03-28）
- [x] **サイドバー・ヘッダー接合部の線の統一** — glass-tier3のborder個別上書きユーティリティ追加、2重/3重線を解消
- [x] **コントロールバー区切り線をテーブルカラムと位置揃え**
- [x] **「まとめて共有」ボタン名変更**

## 完了（第24セッション 2026-03-28）
- [x] **タイムライン枠のガラス表現強化** — glass-panelにボーダー光沢+影追加
- [x] **テーブル横罫線のオン/オフトグル追加** — コントロールバーにRows3アイコンボタン
- [x] **ヘッダー区切り線の視認性向上** — ダーク:白25%、ライト:純黒
- [x] **サイドバー選択中プランのインジケーター** — 開いているプランだけに左直線
- [x] **CSS変数の一括視認性向上** — --color-border/--glass-borderの値変更
- [x] **EventModalツールチップ簡素化** — スキル名のみ表示

## 完了（第23セッション 2026-03-27）
- [x] **パルス設定デフォルト値全面見直し**
- [x] **パルスカラー変更が即時反映されないバグ修正**
- [x] **グローをスライダー化**
- [x] **カスタムカラーピッカー追加**
- [x] **パルス設定パネルをcreatePortalでbody直下に配置**
- [x] **距離・速度・太さ・光の強さのマッピングテーブル再設計**

## 完了（第22セッション 2026-03-27）
- [x] **古い引き継ぎ書21ファイル削除**
- [x] **CORE_UPGRADE_PLAN.md/GRAPL_PROJECT_PLAN.md更新** — LoPo統一
- [x] **零式ホバー光走りバグ修正** — overflow:hidden追加
- [x] **光走りが要素縦横比で歪む問題修正** — 200vmax化
- [x] **backdrop-filterビルド消失問題の全箇所修正** — Lightning CSS対策
- [x] **TECH_NOTES.md新設**
- [x] **PWA: apple-touch-icon追加 / SW autoUpdate化**
- [x] **共有モーダルがヘッダー下に隠れる問題修正**
- [x] **パルス設定パネル全面リニューアル / グロー実装**
- [x] **Google Cloud APIキー制限設定**

## 完了（進行中セクションから）
- [x] **Firestoreプラン保存の実装** — ログインユーザーのプランをクラウドに永続化（2026-03-25）
- [x] **プライバシーポリシー・利用規約ページ** — Googleログインに必須（2026-03-25）
- [x] **プラン件数制限の実装** — 1コンテンツ5件 / 合計50件 / 30件超で圧縮警告（2026-03-25）
- [x] **FFLogsインポートをログイン限定に変更** — API保護 + ログインメリット強化 + 5キーラウンドロビン（2026-03-25）
- [x] **Firestoreセキュリティルール + インデックスのデプロイ** — firebase.json / firestore.indexes.json 作成、Firebase CLIでデプロイ（2026-03-25）
- [x] **モバイルボトムナビにログインボタン追加** — Status→Login/アバターに変更、パーティシートにタブ（パーティ/ステータス）統合（2026-03-25）
- [x] **カスタムドメイン取得** — lopoly.app（Cloudflare Registrar）、DNS設定済み（2026-03-25）

## 完了（チュートリアル）
- [x] モバイル: 簡易ガイド（スワイプカード4枚）で代替。デスクトップチュートリアルはモバイルで自動起動しない（2026-03-24）
- [x] サンドボックス方式に改修 — 既存データを退避→復元。警告ダイアログ削除（2026-03-25）

## 完了（バグ修正）
- [x] サイドバー: 開いている表のコンテンツが展開（選択）状態になっていないことがある（2026-03-25修正済み）
- [x] ログイン成功UX: ウェルカム画面をLayout.tsxで全面表示に統合、表のチラつき防止（2026-03-25修正）
- [x] ログアウト時にlocalStorageプラン・軽減データクリア — アカウント切替時の違和感を解消（2026-03-25）
- [x] リダイレクトログイン（Discord/X）の認証中画面追加 — 戻り時のチラつき防止（2026-03-25）
- [x] Xログイン時のアバター代替表示 — photoURLなし時にイニシャル円表示（2026-03-25）
- [x] サイドバーのプランアイテムにcursor-pointer追加（2026-03-25）
- [x] 新規プラン作成時のパーティ構成引き継ぎバグ修正 — ジョブとMY JOBをリセット（2026-03-25）
- [x] テンプレート読み込み中のローディングインジケーター追加（2026-03-25）
- [x] 未ログインでタブを閉じる前のブラウザ確認ダイアログ追加（2026-03-25）
- [x] コード・ファイルクリーンアップ: MitiPlannerロゴ削除、旧名称の残骸除去、index.htmlのog:image更新（2026-03-25対応済み）
- [x] チュートリアルのサンドボックス化: Playwright通しテスト全ステップ合格。party-closeステップ正常動作確認済み（2026-03-25）
- [x] EventModal軽減選択バグ修正: チュートリアルStep9dでvisibleMitigationsチェックが原因で2つ目以降のハイライトが消える問題を修正（2026-03-25）
- [x] OGP: ShareModalにプラン名表示ON/OFF切り替えUI追加（2026-03-25）
- [x] プラン削除時にuseMitigationStoreのデータがクリアされない — 削除後に次のプランに自動切替、0件ならクリア（2026-03-25修正）
- [x] **保存インジケーター改修** — フェイク表示→実際のlocalStorage保存完了を反映するリアクティブ方式に改修。localStorage:500msデバウンス即保存、Firestoreイベント駆動同期（2026-03-25修正）
- [x] ヘッダーのプラン名が長いとき省略されず保存インジケーターが隠れる — inline style truncateで修正（2026-03-25修正）
- [x] **テーマフラッシュ防止** — index.htmlにインラインスクリプトでReact前にテーマ適用（2026-03-25修正）
- [x] **フェードオーバーレイ** — 言語/テーマ/プラン切替時にアニメーション付きトランジション。DOM直接操作でGPU 60fps（2026-03-25）

## 完了（スマホ対応）
- [x] モバイルヘッダーにコンテンツ名・プラン名を表示（2026-03-24）
- [x] ハードコード日本語のi18n化 — ツールシート・軽減フロー・戻るボタン・ボトムナビ（2026-03-24）
- [x] モバイルのpaddingTopアニメーション問題を修正（2026-03-24）
- [x] モバイル軽減フロー改善 — イベントコンテキスト表示・配置済み軽減数バッジ・ポップオーバーから「軽減を追加」（2026-03-24）
- [x] モバイルポップオーバーを画面中央配置（2026-03-24）
- [x] ボトムナビ全タブ排他制御トグル化（2026-03-24）
- [x] 表の表示領域拡大 — モバイルのmargin/roundingを除去してフルスクリーン表示（2026-03-24）
- [x] パーティ編成モバイル専用UI（2026-03-24）
- [x] 軽減追加フロー全面改修 — ボトムシート一覧式（2026-03-24）
- [x] ボトムナビz-index修正（2026-03-24）
- [x] シート/モーダルをボトムナビの上に配置（2026-03-24）
- [x] 表の二重padding解消（2026-03-24）
- [x] サイドバーのモバイル幅修正（2026-03-24）
- [x] 軽減一覧のレベルフィルタ追加（2026-03-24）
- [x] 軽減一覧を5列フラット表示に改修（2026-03-24）
- [x] パーティ設定が閉じた時にDOMから消えない問題修正（2026-03-24）
- [x] コントロールバーをモバイルで非表示（2026-03-24）
- [x] サイドバーのモバイルフル幅表示（2026-03-24）
- [x] パーティ編成/ステータスをMobileBottomSheet化（2026-03-24）
- [x] MY JOB設定フロー実装（2026-03-24）
- [x] ダメージ数値をモバイルで短縮表示（2026-03-24）
- [x] ヘッダーカラム名モバイル短縮（2026-03-24）
- [x] ボトムナビ白黒デザイン化（2026-03-24）
- [x] モバイルヘッダーh-9に縮小（2026-03-24）
- [x] ポップオーバーアイコン色を白黒統一（2026-03-24）
- [x] iOSキーボード閉じ後のビューポートずれ修正（2026-03-24）
- [x] ジョブ変更時のマイグレーション確認 — モバイルにもJobMigrationModal統合済み（2026-03-25）
- [x] サイドバーのモバイル幅 — fullWidthプロパティ追加、styleタグハック削除（2026-03-25）

## 完了（機能・UI）
- [x] チュートリアル通しテスト全ステップ合格（2026-03-25）
- [x] Google ログイン
- [x] Discord ログイン（2026-03-23）
- [x] Service Worker の /api/ 除外
- [x] ログインメニュー ホバー→クリック型
- [x] デバッグ用 alert 全削除
- [x] Discord/Twitter 共通 OAuth ポップアップヘルパー統合
- [x] Vercel環境変数にTwitterキー追加
- [x] Discord アイコン・表示名表示
- [x] Twitter(X) ログイン（2026-03-23）
- [x] ログインメニュー クリック型+ツールチップ+ログアウト赤字+多言語対応
- [x] ログインモーダル化（2026-03-23）
- [x] ログイン方式をリダイレクト方式に変更
- [x] ログイン成功ウェルカムオーバーレイ
- [x] トップページにログイン導線を配置
- [x] インターベンション/原初の猛りバグ修正
- [x] アダーガルゲージ計算バグ修正
- [x] 共有ボタン移動
- [x] 共有機能（2026-03-24）
- [x] サイドバー導線刷新（2026-03-24）
- [x] サイドバーモノクロ化（2026-03-24）
- [x] プラン名インライン編集（2026-03-24）
- [x] 同コンテンツ複数プランUX（2026-03-24）
- [x] 自動保存フィードバック（2026-03-24）
- [x] ヘッダーのヒーロータイトル修正（2026-03-24）
- [x] 動的OGP画像生成（2026-03-24）
- [x] 複数選択→まとめて共有（2026-03-24）
- [x] 共有UIモーダル化（2026-03-24）
- [x] 複数選択をプラン単位に変更（2026-03-24）
- [x] コンテンツ選択→名前入力フロー（2026-03-24）
- [x] UI白黒ルール適用（2026-03-24）
- [x] 共有モーダル修正（2026-03-24）
- [x] 削除ボタン英語表示崩れ修正（2026-03-24）
- [x] FFLogsツールチップ改善（2026-03-24）
- [x] チュートリアル修復（2026-03-24）
- [x] 名前入力フロー改善（2026-03-24）
- [x] 新規作成フロー改善（2026-03-24）
- [x] サイドバー改善（2026-03-24）
- [x] 削除UI改善（2026-03-24）
- [x] ヘッダー改善（2026-03-24）
- [x] プラン0件オーバーレイ（2026-03-24）
- [x] 英語表現修正（2026-03-24）
- [x] チュートリアル基盤改修（2026-03-24）
- [x] チュートリアル全面改修（2026-03-24）
- [x] 数値入力の全角→半角自動変換（2026-03-24）
- [x] チュートリアル中のテーマ・言語切替を常時操作可能に（2026-03-24）
- [x] セキュリティ修正（2026-03-25）
- [x] crypto.randomUUID()のフォールバック追加（2026-03-25）
- [x] デバッグ用console.log削除（2026-03-25）
- [x] Firestoreプラン保存（2026-03-25）
- [x] プライバシーポリシー・利用規約ページ（2026-03-25）
- [x] プラン件数制限（2026-03-25）
