# Housing Phase 3 設計 — 編集削除・詳細表示・通報フロー

**Date**: 2026-05-20
**Status**: 設計確定、 実装計画 (writing-plans) 待ち
**Scope**: ハウジングツアー Phase 3 の動く骨組み (UI 磨きは別フェーズ)
**前提仕様**:
- `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` (データモデル基盤)
- `docs/superpowers/specs/2026-05-18-housing-room-types-design.md` (個室・アパート対応)
- `docs/superpowers/specs/2026-05-08-housing-phase-b-account-link-design.md` (アカウント連携)
- `docs/superpowers/specs/2026-05-20-housing-login-ui-design.md` (ログイン UI、 #43 で完了)

---

## 1. 概要

### 1.1 目的
Phase 2 で完成済みの「ハウジング登録・一覧表示・ツアー作成」 に対して、 **編集・削除 (家主自身)・物件詳細表示・通報** という運営に必要な核機能を追加する。 マップ機能 (Phase 2B) は後回しの方針が確定済みのため、 マップ依存のない部分のみ対象とする。

### 1.2 スコープ
3 つのサブ機能を 1 セッションで「動く骨組み」 まで仕上げる:

- **Sub-spec 3-A: 家主編集・削除 UI** (TODO.md L30 の項目 3)
- **Sub-spec 3-B: 物件詳細表示** (TODO.md L29 の項目 2) — 別ページではなくモーダル中心、 URL 直アクセスは Intercepting Routes でフルページ化
- **Sub-spec 3-C: 通報フロー** (TODO.md L28 の項目 1) — 通報モーダル + アプリ内通知 + 家主への reason 別ガイド

### 1.3 スコープ外 (次セッション以降)
- 30 日後物理削除 cron (削除済みデータの掃除)
- 異議申し立てのアプリ内 UI (今回は Discord リンクで代替)
- nsfw / griefing の管理者向けアプリ内通知 (severity フラグだけ立て、 管理者通知システムは別途)
- 詳細モーダルの写真ライトボックス (写真クリック拡大なし)
- マップからの動線実装 (Phase 2B 待ち)
- en / ko / zh の i18n 値 (ja のみ先行、 キーは 4 言語分定義)
- 「自分の物件一覧」 (アカウントモーダル C 案、 後日)
- ツアー同期 Firestore 化 (TODO.md L31、 マップ完成後に統合)
- E2E (Playwright) テスト (UI 磨きフェーズ)

### 1.4 業界水準準拠の決定事項 (一覧)

| 項目 | 決定 |
|---|---|
| 編集・削除入口 | 詳細モーダル内の kebab ︙ メニュー (家主にのみ表示) |
| 詳細表示方式 | モーダル中心 (Intercepting Routes) + URL 直アクセスはフルページ |
| アクションボタン | お気に入り / シェア / ちがった (家主以外) / kebab (家主) |
| 通報モーダル | reason 5 択 (wrong_info / sold / griefing / nsfw / other) を 1 モーダルで網羅 |
| 通知 UI | TopBar bell + 未読バッジ + ドロップダウン (最新 5 件 + 「すべて見る」 = 準備中) |
| 通報後ガイド | reason 別ガイドモーダル (B 案) で reason ごとに CTA 出し分け |
| 削除方式 | soft delete (`deletedAt`)。 30 日後物理削除 cron は次セッション |
| 通報重複防止 | 同一 reporter × 同一 listing × 同一 reason は 1 回。 別 reason なら新規 OK |
| 自動非表示閾値 | `reportCount >= 3` で `deletedAt` 設定 (管理画面でリセット可能) |
| シェア UI | スマホ = Web Share API、 PC = X URL + クリップボードコピー |
| 編集モーダル | 既存 `HousingRegisterModal` を `mode` props で流用 |
| 通知データ | `users/{uid}/notifications`、 既読フラグ、 30 日 Firestore TTL |
| 認可 | API で ownerUid 一致チェック + Firestore Rules で二重防御 |
| reason 別重大度 | nsfw / griefing は `severity: 'high'` flag のみ立てる (管理者通知は次セッション) |

### 1.5 設計原則
- **業界水準を守る** (memory `feedback_industry_standard.md`): 「動く骨組み」 でも通知ドロップダウン・reason 別ガイド・削除確認等は最初から業界水準。 Airbnb / Vrbo / Google Maps / Zillow / Stripe の UX を参考にする
- **トンマナはハウジング独自世界観** (memory `feedback_housing_design_independent.md`): `docs/.private/housing-tour-mockup/index.html` が正典、 `.claude/rules/housing-design.md` 適用、 既存 UI ルール (白黒のみ・Inter 禁止・honey 色禁止) 対象外
- **個人情報を持たない原則** (memory `feedback_auth_privacy.md`): 通報者の identifier は家主に渡さない。 reporterUid は Firestore に保存するが通知側には漏らさない
- **ハードコーディング禁止**: 全 UI テキストは i18n キー経由 (`.claude/rules/i18n.md`)
- **管理作業は /admin で完結** (memory `feedback_housing_admin_complete.md`): reportCount リセット・BAN・強制削除は全て /admin から

---

## 2. アーキテクチャ

### 2.1 ルーティング (Next.js App Router + Intercepting Routes)

業界水準のソーシャル系 SPA (Twitter / Instagram / Vercel デモ) で採用される **Parallel Routes + Intercepting Routes** パターン。 マップ/一覧から物件カードをクリックしたら URL は変わるがマップ背景のまま、 同じ URL を直接踏むとフルページでレンダリングされる。

```
src/app/housing/
├── layout.tsx           # @modal slot を追加
├── page.tsx             # 一覧ページ (既存)
├── @modal/
│   ├── default.tsx      # null を返すデフォルト
│   └── (.)listing/[id]/page.tsx   # intercepting: モーダルとして表示
└── listing/[id]/page.tsx          # フルページ版 (直アクセス / OGP)
```

- `(.)listing/[id]` の `(.)` がインターセプター記法。 housing 配下からの遷移時のみモーダル
- モーダル / フルページの両方が **同じ `<HousingDetailContent>`** を中身に使う
- フルページは `<HousingDetailLayout>` (上下にヘッダー/フッター)、 モーダルは `<HousingDetailModal>` (PC = 中央 dialog、 スマホ = bottom sheet)

### 2.2 Firestore コレクション

既存:
- `housing_listings/{id}` — メイン物件 (Phase 1 で定義済)
- `housing_listings/{id}/reports/{reportId}` — 通報 (型は定義済、 操作は未実装)

新規追加 / 変更:
- `housing_listings/{id}` に `deletedAt: number | null` を追加 (soft delete)
- `users/{uid}/notifications/{notificationId}` を新設 — アプリ内通知

```typescript
// 既存 HousingListing への追加
interface HousingListing {
  // ... 既存フィールド
  deletedAt: number | null;  // soft delete: null = 生きてる、 number = 削除済み
}

// 新規 HousingNotification (src/types/notification.ts または housing.ts に追加)
interface HousingNotification {
  id: string;
  type: 'housing_report';  // 将来拡張: 他種類の通知も
  listingId: string;
  reason: ReportReason;
  severity: 'normal' | 'high';  // griefing/nsfw は 'high'
  comment?: string;     // reason = 'other' の場合
  createdAt: number;
  read: boolean;
  readAt?: number;
}
```

### 2.3 API エンドポイント (`api/housing/index.ts` 拡張)

既存パターン (`?action=register-listing` 等) に追加:

| action | method | 認可 | 用途 |
|---|---|---|---|
| `update-listing` | POST | ownerUid 一致 | 物件編集 |
| `delete-listing` | POST | ownerUid 一致 | soft delete |
| `report-listing` | POST | ログインユーザー | 通報送信 (重複チェック内蔵) |
| `list-notifications` | GET | 本人 | 通知一覧取得 (paginated) |
| `mark-notification-read` | POST | 本人 | 通知既読化 |

各ハンドラは `api/housing/_<actionName>Handler.ts` に分離 (既存 `_registerListingHandler.ts` パターン踏襲)。

### 2.4 Firestore Security Rules

二重防御として API 認可に加えて Rules でも以下を強制:
- `housing_listings/{id}` の `update / delete` は `request.auth.uid == resource.data.ownerUid` のみ許可 (削除は実際は update via `deletedAt`)
- `housing_listings/{id}/reports/{reportId}` の `create` は認証ユーザーのみ、 `read` は管理者のみ
- `users/{uid}/notifications/{nid}` は本人のみ `read / update (read flag)`、 `create` は Cloud Function or Admin SDK のみ

---

## 3. データフロー

### 3.1 通報フロー (Sub-spec 3-C 中核)

```
[他人の物件詳細モーダル] → 「ちがった」 ボタン
  → HousingReportModal (reason 5 択 + コメント任意)
  → POST /api/housing?action=report-listing
       body: { listingId, reason, comment? }
  ├─ 認可チェック: ログイン必須 (ゲスト不可)
  ├─ 重複チェック: 同一 reporterUid × 同一 listingId × 同一 reason の既存 doc を確認
  │   → 既存あれば 409 Conflict (UI で「既に通報済みです」 toast)
  ├─ Firestore Transaction:
  │   ├─ housing_listings/{id}/reports に doc 作成 (reporterUid, reason, comment, createdAt)
  │   ├─ housing_listings/{id} の reportCount を +1
  │   ├─ severity 判定: reason ∈ ['griefing', 'nsfw'] → 'high'、 それ以外 → 'normal'
  │   ├─ reportCount >= 3 で deletedAt = now を設定 (自動非表示)
  │   └─ users/{ownerUid}/notifications に通知 doc 作成
  │       (reporterUid は notification には保存しない = 家主に渡らない)
  └─ Response: 201 Created + 通報受付トースト
```

### 3.2 通知受信〜家主アクション (Sub-spec 3-C 後半)

```
[家主ブラウザ] → TopBar bell アイコン (未読バッジ +1 表示)
  → クリック → NotificationDropdown (最新 5 件)
  → 各通知行クリック
       href: /housing/listing/{listingId}?notification={notificationId}
  → モーダルとして詳細が開く + HousingReportGuideModal が自動オープン
  → reason 別 CTA:
       wrong_info  → 「内容を確認 / 編集する」 → HousingEditModal
       sold        → 「もう売却済み? 削除する」 → HousingDeleteConfirm
       griefing    → 「身に覚えがない場合は異議申し立て」 → Discord リンク (新タブ)
       nsfw        → griefing と同等 + 「LoPo 運営が直接確認します」 文言
       other       → コメント表示 + 編集/削除/異議申し立ての 3 択
  → アクション後、 もしくは「あとで」 ボタン → mark-notification-read 呼び出し
```

### 3.3 編集フロー (Sub-spec 3-A)

```
[家主の物件詳細] → kebab ︙ → 「編集」
  → HousingEditModal (= HousingRegisterModal の mode='edit')
       初期値は listing の現在値を渡す
  → 既存の登録モーダルと同じフォーム
  → 「保存」 → POST /api/housing?action=update-listing
       body: { listingId, ...updatedFields }
  ├─ 認可: ownerUid 一致
  ├─ バリデーション: zod (登録時と同じスキーマ、 ownerUid 不変)
  ├─ Firestore: housing_listings/{id} を update、 updatedAt = now
  └─ Response: 200 + 「更新しました」 toast → モーダル閉じる → 詳細リロード
```

### 3.4 削除フロー (Sub-spec 3-A)

```
[家主の物件詳細] → kebab ︙ → 「削除」
  → HousingDeleteConfirm (業界水準ダイアログ)
       「この物件を削除しますか?」
       「物件は一覧から非表示になります。 30 日後に完全削除されます。」
       [キャンセル] [削除する] (削除する は警告色)
  → 「削除する」 → POST /api/housing?action=delete-listing
       body: { listingId }
  ├─ 認可: ownerUid 一致
  ├─ Firestore: housing_listings/{id}.deletedAt = now を設定 (soft delete)
  │             ※ サブコレクション (reports) はそのまま (異議申し立て対応のため)
  └─ Response: 200 + 「削除しました」 toast → モーダル閉じる → 一覧に戻る
```

### 3.5 詳細表示フロー (Sub-spec 3-B)

```
[一覧ページ] → カードクリック
  → Next.js Link で href="/housing/listing/{id}"
  → Intercepting Route が発火 → @modal slot に <HousingDetailContent> 描画
  → 背景は一覧ページのまま、 モーダル/ボトムシートで表示
  → URL は /housing/listing/{id} に更新 (シェア可能)

[シェア URL / リロード] → 直接 /housing/listing/{id} にアクセス
  → 通常の page.tsx がレンダリング
  → 同じ <HousingDetailContent> をフルページレイアウト (上下ヘッダー/フッター) で表示
  → OGP メタタグ生成 (写真 1 枚目を og:image)
```

---

## 4. コンポーネント設計

### 4.1 新規ファイル

**`src/components/housing/listing/` (新規ディレクトリ)**
| ファイル | 役割 |
|---|---|
| `HousingDetailContent.tsx` | 詳細の中身 (モーダル/ページ両用)。 写真ギャラリー・タイトル・住所・家主名・説明・アクションボタン群 |
| `HousingDetailModal.tsx` | モーダルラッパー (PC = 中央 dialog 880×640 max、 スマホ = bottom sheet 92dvh) |
| `HousingDetailLayout.tsx` | フルページラッパー (housing トップヘッダー + フッター付き) |
| `HousingActionBar.tsx` | アクションボタン群 (お気に入り / ちがった / シェア / kebab) |
| `HousingDetailKebab.tsx` | 家主専用 ︙ メニュー (編集 / 削除)。 ownerUid === session.uid で条件レンダリング |
| `HousingPhotoGallery.tsx` | 写真ギャラリー (Airbnb 形式: 左大 1 + 右サムネ 2x2、 スマホはカルーセル) |
| `HousingShareButton.tsx` | Web Share API (スマホ) + X + クリップボード (PC) |

**`src/components/housing/report/` (新規ディレクトリ)**
| ファイル | 役割 |
|---|---|
| `HousingReportModal.tsx` | 「ちがった」 ボタン押下後の reason 選択モーダル |
| `HousingReportGuideModal.tsx` | 通知クリック後、 家主に reason 別 CTA を出すモーダル |
| `useHousingReport.ts` | 通報送信フック (重複チェック + 失敗ハンドリング) |

**`src/components/housing/delete/` (新規ディレクトリ)**
| ファイル | 役割 |
|---|---|
| `HousingDeleteConfirm.tsx` | 削除確認ダイアログ |
| `useHousingDelete.ts` | 削除送信フック |

**`src/components/housing/edit/` (新規ディレクトリ)**
| ファイル | 役割 |
|---|---|
| `HousingEditModal.tsx` | 編集モーダル (内部で `HousingRegisterModal` を mode='edit' で呼ぶ薄いラッパー) |

**`src/components/housing/notifications/` (新規ディレクトリ)**
| ファイル | 役割 |
|---|---|
| `NotificationBell.tsx` | TopBar に追加する bell + 未読バッジ |
| `NotificationDropdown.tsx` | bell クリックで開くドロップダウン (最新 5 件 + 「すべて見る」) |
| `NotificationItem.tsx` | ドロップダウン内の 1 行 |
| `useNotifications.ts` | リアルタイム購読フック (onSnapshot) |

**`src/app/housing/` (新規ファイル)**
| ファイル | 役割 |
|---|---|
| `layout.tsx` | 既存に `@modal` slot 追加 |
| `@modal/default.tsx` | デフォルト null |
| `@modal/(.)listing/[id]/page.tsx` | intercepting route (モーダル表示) |
| `listing/[id]/page.tsx` | フルページ版 (既存 `HousingDetailPagePlaceholder` の本実装) |

**`api/housing/_<action>Handler.ts` (新規 5 本)**
| ファイル | 役割 |
|---|---|
| `_updateListingHandler.ts` | 編集 API |
| `_deleteListingHandler.ts` | soft delete API |
| `_reportListingHandler.ts` | 通報 API (重複チェック・通知 doc 作成含む) |
| `_listNotificationsHandler.ts` | 通知一覧 GET |
| `_markNotificationReadHandler.ts` | 既読化 POST |

### 4.2 既存ファイル変更

| ファイル | 変更内容 |
|---|---|
| `src/types/housing.ts` | `HousingListing.deletedAt: number \| null` 追加、 `HousingNotification` 追加 |
| `src/components/housing/workspace/TopBar.tsx` | `<NotificationBell>` 配置 (Heart の隣) |
| `src/components/housing/workspace/HousingRegisterModal.tsx` | `mode: 'create' \| 'edit'` props 追加、 `initialValues` props 追加。 mode='edit' のときタイトル変更・API endpoint 変更 |
| `src/components/housing/HousingDetailPagePlaceholder.tsx` | 削除 (本実装で置き換え) |
| `api/housing/index.ts` | 新規 action 5 つの分岐追加 |
| `src/lib/firebase/firestore-rules` (or equivalent) | セキュリティルール更新 |
| ハウジング一覧画面 (`HousingWorkspace.tsx` 等) | カードクリック → `<Link href="/housing/listing/{id}">` に変更 |

### 4.3 削除予定のファイル
- `src/components/housing/HousingDetailPagePlaceholder.tsx` (本実装で置き換え)

---

## 5. UI / UX 詳細

### 5.1 物件詳細モーダル (Sub-spec 3-B)

**PC (≥768px)**:
- 中央 dialog、 最大 880×640px (4K でも視認しやすいサイズ)
- 背景はマップ/一覧 (Intercepting Route のおかげで残る)
- 背景クリック / Esc / 右上 × で閉じる (履歴 back と同等、 URL は元に戻る)
- レイアウト: 左 60% 写真ギャラリー、 右 40% 情報パネル (sticky アクションバー含む)

**スマホ (<768px)**:
- 下から bottom sheet スライドアップ、 高さ 92dvh
- スワイプダウンで閉じる
- レイアウト: 上部写真カルーセル → スクロールで情報

**ハウジングトンマナ準拠**:
- カラーパレットはモックアップ参照 (`docs/.private/housing-tour-mockup/index.html`)
- フォントは housing-design.md の指定 (Inter 禁止)
- ボタンスタイル・border-radius もモックアップに従う

### 5.2 通報モーダル (Sub-spec 3-C)

**reason 選択 (`HousingReportModal`)**:
```
┌──────────────────────────────┐
│  この物件について報告        │ ← title
│  どの点が違いますか?         │ ← subtitle
│                              │
│  ○ 位置や情報が違う          │ ← wrong_info (default 選択)
│  ○ 売却済み                  │ ← sold
│  ○ 嫌がらせ・ハラスメント    │ ← griefing
│  ○ 不適切なコンテンツ        │ ← nsfw
│  ○ その他                    │ ← other → コメント欄出現 (必須)
│                              │
│  [ コメント (任意) ]         │ ← textarea (other のみ必須)
│                              │
│  [ キャンセル ] [ 報告する ] │
└──────────────────────────────┘
```

- 送信中は「報告する」 → loading spinner
- 重複エラー (409) は toast「すでに同じ理由で報告済みです」
- 成功は toast「報告を受け付けました。 ご協力ありがとうございます」 → モーダル閉じる

### 5.3 reason 別ガイドモーダル (`HousingReportGuideModal`)

家主が通知をクリックして詳細モーダルが開いたあと、 重ねて表示。

```
┌──────────────────────────────────┐
│  あなたの物件に報告がありました  │
│  理由: 位置や情報が違う          │ ← reason 別文言
│                                  │
│  内容を確認して、 必要に応じて   │ ← reason 別ガイド
│  情報を編集してください。        │
│                                  │
│  [ あとで ] [ 編集する ]         │ ← reason 別 CTA
└──────────────────────────────────┘
```

reason 別 CTA マッピング:
| reason | ガイド文 | プライマリ CTA | アクション |
|---|---|---|---|
| wrong_info | 内容を確認して、 必要に応じて情報を編集してください | 編集する | `HousingEditModal` 起動 |
| sold | この物件は売却済みですか? 売却済みなら削除してください | 物件を削除する | `HousingDeleteConfirm` 起動 |
| griefing | 身に覚えがない場合は LoPo Discord で異議申し立てが可能です | Discord で異議申し立て | Discord 招待 URL (env var、 新タブ) |
| nsfw | LoPo 運営が直接確認します。 身に覚えがない場合は Discord で異議申し立て | Discord で異議申し立て | 同上 |
| other | (コメント表示) 内容に応じて編集 / 削除 / 異議申し立てから選択 | (3 ボタン並列) | それぞれ起動 |

「あとで」 ボタンで mark-notification-read を呼ぶ + モーダル閉じる。

### 5.4 削除確認 (`HousingDeleteConfirm`)

業界水準 (Stripe / GitHub) で典型的なパターン。 物件名入力は省略 (1 物件削除の重さ的に過剰)、 普通の確認ダイアログ。

```
┌──────────────────────────────────┐
│  この物件を削除しますか?         │ ← warning color title
│                                  │
│  「{物件タイトル}」              │ ← 物件タイトル表示
│                                  │
│  • 一覧から非表示になります      │
│  • 30 日後に完全削除されます     │
│  • この操作は元に戻せません      │
│                                  │
│  [ キャンセル ] [ 削除する ]     │ ← 削除するは red-600 系
└──────────────────────────────────┘
```

### 5.5 通知ベル & ドロップダウン

**`NotificationBell`** (TopBar 内):
- bell SVG アイコン + 未読件数バッジ (赤丸、 0 のときは非表示)
- バッジは 9 件まで、 10+ は「9+」 表示
- クリックで `NotificationDropdown` 開閉

**`NotificationDropdown`**:
- 幅 360px (PC)、 スマホは全幅 fixed
- 上部: 「通知」 タイトル + 「すべて既読にする」 リンク
- 中央: 最新 5 件 (新しい順、 未読は太字 + 左に色付きドット)
- 下部: 「すべて見る」 リンクは骨組みでは「準備中」 として disabled 表示 (将来の通知ページ /housing/notifications を予約)
- 通知行クリック → `/housing/listing/{listingId}?notification={notificationId}` に遷移

**`NotificationItem`**:
- アイコン (reason 別、 wrong_info = 編集アイコン、 nsfw = 警告アイコン 等)
- メッセージ: 「あなたの物件 〇〇 について {reason の i18n} と報告がありました」
- 相対時刻 (5 分前、 2 時間前、 等)

### 5.6 アクションバー (`HousingActionBar`)

詳細モーダル右側 sticky エリアに配置。 全 4 つを縦並びアイコンボタン:

```
[ ❤️ お気に入り ]  ← 既存 useHousingFavorites を流用
[ 📤 シェア ]      ← Web Share API + X + コピー
[ ⚠️ ちがった ]    ← 家主以外に表示、 ログイン必須
[ ︙ ]              ← 家主にのみ表示、 kebab メニュー (編集 / 削除)
```

- 各ボタンは aria-label 付き
- ゲストの場合「ちがった」 「お気に入り」 はログイン誘導モーダル (既存 `HousingAccountModal` の loginPromptVariant を使う)

---

## 6. i18n

### 6.1 新規キー一覧

**ja 値を先行追加、 en / ko / zh は同じキーで空文字 (or ja コピー) で UI 磨きフェーズに翻訳**

```jsonc
{
  "housing": {
    // 詳細モーダル
    "detail.title": "物件詳細",
    "detail.share": "シェア",
    "detail.share.copy_link": "リンクをコピー",
    "detail.share.copied": "コピーしました",
    "detail.share.twitter": "X で共有",
    "detail.report.button": "ちがった",
    "detail.kebab.edit": "編集",
    "detail.kebab.delete": "削除",
    "detail.owner_label": "登録者",

    // 通報モーダル
    "report.modal.title": "この物件について報告",
    "report.modal.subtitle": "どの点が違いますか?",
    "report.reason.wrong_info": "位置や情報が違う",
    "report.reason.sold": "売却済み",
    "report.reason.griefing": "嫌がらせ・ハラスメント",
    "report.reason.nsfw": "不適切なコンテンツ",
    "report.reason.other": "その他",
    "report.comment.placeholder": "詳細を教えてください (任意)",
    "report.comment.required": "その他を選択した場合は詳細を入力してください",
    "report.submit": "報告する",
    "report.cancel": "キャンセル",
    "report.success": "報告を受け付けました。 ご協力ありがとうございます",
    "report.duplicate": "すでに同じ理由で報告済みです",
    "report.error": "報告の送信に失敗しました。 時間をおいて再度お試しください",

    // ガイドモーダル (家主向け)
    "guide.title": "あなたの物件に報告がありました",
    "guide.reason_label": "理由",
    "guide.body.wrong_info": "内容を確認して、 必要に応じて情報を編集してください",
    "guide.body.sold": "この物件は売却済みですか? 売却済みなら削除してください",
    "guide.body.griefing": "身に覚えがない場合は LoPo Discord で異議申し立てが可能です",
    "guide.body.nsfw": "LoPo 運営が直接確認します。 身に覚えがない場合は Discord で異議申し立て",
    "guide.body.other": "報告者からのコメント",
    "guide.cta.edit": "編集する",
    "guide.cta.delete": "物件を削除する",
    "guide.cta.dispute": "Discord で異議申し立て",
    "guide.later": "あとで",

    // 削除確認
    "delete.title": "この物件を削除しますか?",
    "delete.body.line1": "一覧から非表示になります",
    "delete.body.line2": "30 日後に完全削除されます",
    "delete.body.line3": "この操作は元に戻せません",
    "delete.confirm": "削除する",
    "delete.cancel": "キャンセル",
    "delete.success": "削除しました",
    "delete.error": "削除に失敗しました",

    // 編集
    "edit.modal.title": "物件を編集",
    "edit.save": "保存",
    "edit.success": "更新しました",
    "edit.error": "更新に失敗しました",

    // 通知
    "notifications.title": "通知",
    "notifications.empty": "通知はありません",
    "notifications.mark_all_read": "すべて既読にする",
    "notifications.see_all": "すべて見る",
    "notifications.see_all.coming_soon": "準備中",
    "notifications.item.report": "あなたの物件「{title}」 について {reason} と報告がありました",
    "notifications.time.just_now": "たった今",
    "notifications.time.minutes_ago": "{n}分前",
    "notifications.time.hours_ago": "{n}時間前",
    "notifications.time.days_ago": "{n}日前"
  }
}
```

### 6.2 既存翻訳ファイルへの追加先
- `src/locales/ja/common.json` (or housing.json があれば)
- en / ko / zh は同じキー構造でジャ値コピー (動作確認は ja で行う、 翻訳は次セッション)

---

## 7. 認可・セキュリティ

### 7.1 API レベル認可

各ハンドラの先頭で:

```typescript
// 編集・削除
const session = await getServerSession(req);
if (!session?.uid) return res.status(401).json({ error: 'unauthenticated' });

const listing = await admin.firestore()
  .collection('housing_listings').doc(listingId).get();
if (!listing.exists) return res.status(404).json({ error: 'not_found' });
if (listing.data()!.ownerUid !== session.uid) {
  return res.status(403).json({ error: 'forbidden' });
}

// 通報
if (!session?.uid) return res.status(401).json({ error: 'unauthenticated' });
if (listing.data()!.ownerUid === session.uid) {
  return res.status(403).json({ error: 'cannot_report_own' });
}

// 通知操作
const notif = await admin.firestore()
  .collection('users').doc(session.uid)
  .collection('notifications').doc(notificationId).get();
if (notif.data()!.ownerUid !== session.uid) {  // doc path に uid 含むので二重チェック
  return res.status(403).json({ error: 'forbidden' });
}
```

### 7.2 Firestore Security Rules

```javascript
match /housing_listings/{listingId} {
  allow read: if true;  // 公開、 ただしクエリ側で deletedAt == null フィルタ
  allow create: if request.auth != null;
  allow update: if request.auth.uid == resource.data.ownerUid
                && request.resource.data.ownerUid == resource.data.ownerUid;  // ownerUid 改竄禁止
  allow delete: if false;  // 物理削除は管理者のみ (Admin SDK)

  match /reports/{reportId} {
    allow read: if request.auth.token.admin == true;
    allow create: if request.auth != null
                  && request.resource.data.reporterUid == request.auth.uid;
    allow update, delete: if false;
  }
}

match /users/{uid}/notifications/{nid} {
  allow read: if request.auth.uid == uid;
  allow update: if request.auth.uid == uid
                && request.resource.data.diff(resource.data).affectedKeys()
                   .hasOnly(['read', 'readAt']);  // 既読化のみ許可
  allow create, delete: if false;  // 作成は Admin SDK、 削除は TTL
}
```

### 7.3 通報者匿名性の担保

- `housing_listings/{id}/reports/{reportId}` には `reporterUid` を保存 (重複防止・管理者調査用)
- `users/{ownerUid}/notifications/{nid}` には **reporterUid を保存しない**
- 家主側 UI には reason / comment / createdAt のみ表示
- 管理画面 (/admin) でのみ reporterUid 参照可能

### 7.4 通報の DoS / スパム対策

- **骨組みで実装**: 同一 reporterUid × 同一 listingId × 同一 reason は 1 回まで (Firestore の `reports` サブコレクションで存在チェック)
- **次セッションで実装**: 同一ユーザーが短時間に大量通報する際のレート制限 (Cloud Function or Upstash Redis 等で実装、 骨組み段階ではスコープ外)

---

## 8. エラーハンドリング

### 8.1 API レスポンス

| status | 用途 | UI 側挙動 |
|---|---|---|
| 200 / 201 | 成功 | success toast |
| 400 | バリデーションエラー | エラーメッセージ表示 (フォーム) |
| 401 | 未認証 | ログイン誘導モーダル |
| 403 | 権限なし | toast「権限がありません」 + モーダル閉じる |
| 404 | 物件が存在しない or 既に削除済み | toast「物件が見つかりません」 + 一覧に戻る |
| 409 | 通報重複 | toast「すでに同じ理由で報告済みです」 |
| 429 | レート制限 (将来) | toast「しばらく時間をおいてください」 |
| 500 | サーバーエラー | toast「エラーが発生しました。 時間をおいてお試しください」 |

### 8.2 ネットワークエラー / オフライン

- fetch 失敗時は toast「通信エラー。 接続を確認してください」
- 編集モーダルは保存失敗時もフォーム状態を保持 (ユーザーの入力を消さない)

---

## 9. テスト方針

### 9.1 Vitest (単体)

- **API ハンドラ** (`api/housing/_*Handler.test.ts`):
  - バリデーション (zod) で不正リクエストを 400 拒否
  - 認可: 未ログイン → 401、 他人 → 403、 自分 → 200
  - 通報重複: 同一条件 2 回目で 409
  - 通報 transaction: reportCount インクリメント・通知 doc 作成・3 件で deletedAt 設定
  - soft delete: 削除済み物件への編集は 404

- **React コンポーネント** (`src/components/housing/**/__tests__/*.test.tsx`):
  - `HousingReportModal`: reason 選択、 other 時のコメント必須バリデーション
  - `HousingReportGuideModal`: reason 別 CTA レンダリング
  - `HousingDeleteConfirm`: 確認 → 削除呼び出し
  - `NotificationBell`: 未読件数表示、 ドロップダウン開閉
  - `NotificationDropdown`: 通知リスト・既読化・空状態

- **フック** (`src/hooks/__tests__/*.test.ts`):
  - `useHousingReport`: 重複エラーハンドリング
  - `useHousingDelete`: 削除→トースト→ナビゲーション
  - `useNotifications`: onSnapshot による未読更新

### 9.2 Vitest (統合)

- 通報 → reportCount インクリメント → 通知 doc 作成 → 既読化 の一連フロー
- 編集 → 詳細画面リロード で値が反映される
- soft delete → 一覧クエリで非表示

### 9.3 手動動作確認 (1 セッション目)

- ローカル dev サーバーで Chrome (DPR 2.58、 viewport 1489px)
- スマホ実機 or Chrome DevTools モバイル emulation (iPhone 12 サイズ)
- 主要シナリオ:
  1. 物件詳細をモーダルで開く (一覧 → カードクリック)
  2. シェア URL を別タブで開いてフルページレンダリングを確認
  3. 他人の物件を通報 → 別ブラウザの家主アカウントで通知受信を確認
  4. 通知クリック → reason 別ガイドモーダル → 編集 / 削除
  5. 自分の物件で「ちがった」 が表示されないこと、 kebab が表示されること

### 9.4 後回し (UI 磨きフェーズ)

- E2E (Playwright): 一連のシナリオ自動化
- アクセシビリティ監査 (axe-core)
- パフォーマンス計測 (Lighthouse)

---

## 10. 実装順序 (writing-plans に渡す方針)

1. **基盤**: 型定義 (`HousingListing.deletedAt`, `HousingNotification`)、 Firestore Rules 更新、 一覧クエリに `deletedAt == null` フィルタ
2. **Sub-spec 3-A (編集削除)**:
   - `_updateListingHandler`, `_deleteListingHandler` + テスト
   - `HousingEditModal` (HousingRegisterModal 拡張)
   - `HousingDeleteConfirm`
   - `HousingDetailKebab`
3. **Sub-spec 3-B (詳細表示)**:
   - `HousingDetailContent`, `HousingActionBar`, `HousingPhotoGallery`, `HousingShareButton`
   - Intercepting Routes (`@modal` slot)
   - フルページ版 `listing/[id]/page.tsx` + OGP メタ
4. **Sub-spec 3-C (通報フロー)**:
   - `_reportListingHandler` (重複チェック + transaction + 通知作成) + テスト
   - `HousingReportModal`
   - `_listNotificationsHandler`, `_markNotificationReadHandler` + テスト
   - `NotificationBell`, `NotificationDropdown`, `NotificationItem`
   - `HousingReportGuideModal` + reason 別 CTA
   - 通知遷移時の URL クエリ (`?notification={id}`) でガイドモーダル自動オープン
5. **i18n**: ja キー追加、 en/ko/zh はキーのみコピー
6. **手動動作確認 + バグ修正**
7. **コミット**: 小さい単位で 5-7 個のコミット (基盤 / 編集削除 / 詳細表示 / 通報 / 通知 / i18n / 仕上げ)

---

## 11. 未確定・要相談事項

(ない予定だが、 実装中に出てきた場合はここに追記して再相談)

- ~~なし~~

---

## 12. 関連メモリ

実装時に参照する memory:
- `feedback_industry_standard.md` — 業界水準は必ず守る
- `feedback_housing_design_independent.md` — トンマナはモックアップ正典
- `feedback_auth_privacy.md` — 通報者匿名性
- `feedback_housing_admin_complete.md` — 管理作業は /admin で完結
- `feedback_no_hardcoding.md` — i18n キー経由
- `feedback_build_check.md` — push 前に `npm run build` + `vitest run` 必須
- `feedback_vercel_tsc_strict.md` — Vercel は tsc 厳密モード、 未使用変数を残さない
- `feedback_one_fix_one_verify.md` — 修正は 1 件ずつ実機検証
- `project_lopo_mul_constraint.md` — ハウジングは広告 OK
- `feedback_form_ux_progress.md` — ✅ を最初から付けない
