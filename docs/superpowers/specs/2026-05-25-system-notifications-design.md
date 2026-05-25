# 運営からの通知バッジ機能 (軽減表アプリ向け) — Design

作成日: 2026-05-25 / セッション #54
ターゲット: 軽減表アプリ画面 (`/` 系) の Sidebar 下端

---

## 1. 目的とスコープ

軽減表アプリのユーザーに、 運営 (= LoPo 管理者) からの **全体告知**を即時配信する仕組みを設ける。 ハウジング側の既存 NotificationBell とは別系統 (broadcast 型 vs 1-to-1)。

主な用途 (例):
- 新コンテンツ追加・テンプレ更新の告知
- メンテナンス予定
- バグ修正の案内
- その他の運営からのお知らせ

### スコープに含まないもの

- 端末間同期 (localStorage 既読のみ)
- ユーザーターゲティング (全員共通)
- 予約投稿 (即時公開のみ)
- 通知ジャンル分け (タグ・ラベルなし)
- 画像 / 動画 / アクションボタン (テキストのみ)
- 本文中リンク (将来拡張余地として `link?` フィールドは optional で残す)
- リッチプッシュ (デスクトップ通知 / Web Push API)
- 既読の端末間同期

これらは将来必要になったら拡張する。

---

## 2. データモデル (Firestore)

### `system_notifications/{id}`

```ts
interface SystemNotification {
  id: string;                  // doc id (auto)
  title: { ja: string; en: string; ko?: string; zh?: string };
  body:  { ja: string; en: string; ko?: string; zh?: string };
  published: boolean;          // 公開停止 toggle 用 (false = 非表示、 doc は残る)
  link?: string;               // 将来拡張用 (今は未使用、 admin UI からも入力しない)
  createdAt: number;           // Date.now()
  updatedAt: number;
}
```

- 全ユーザー共通の broadcast 型
- ja/en は必須、 ko/zh は optional (将来拡張、 当面は en にフォールバック)
- read = public (認証不要)、 write = admin 権限のみ (Firestore rules で制御)

### Firestore Rules (追加)

```
match /system_notifications/{id} {
  allow read: if true;
  allow write: if isAdmin();   // 既存の isAdmin() ヘルパを使用
}
```

---

## 3. 既読管理 (localStorage)

### key: `lopo:system_notifs:read`

```ts
interface ReadState {
  readIds: string[];   // 既読化した system_notifications の doc id
  updatedAt: number;
}
```

- ブラウザ単位、 端末間同期なし、 ログイン不要
- モーダル閉じる = 既読化 → `readIds` に doc id 追加 → re-render
- 公開停止/削除された doc の id が古い localStorage に残るが無害 (該当 doc 不在で表示対象外)
- リスト上限なし (許容、 数百件溜まっても 1KB 未満)

---

## 4. UI (Sidebar 下端、 バックアップ/復元の上)

```
┌─ Sidebar ──────────────────┐
│ ... プラン一覧 / 既存内容 ... │
│                            │
├────────────────────────────┤  ← 1px 区切り線
│ 🔔  📢 テンプレ更新しま... → │  ← 左固定ベル + 右マーキー (最新 1 通 right-to-left)
├────────────────────────────┤  ← 1px 区切り線
│ バックアップ / 復元           │  ← 既存
└────────────────────────────┘
```

### バー部分の挙動

- 未読 1 通以上: バー全体 (区切り線 + ベル + テロップ) 表示
- 未読 0: **バー枠ごと丸ごと消える** (Sidebar が縮む)、 区切り線も消える
- 複数未読: **最新 1 通だけ**テロップで流す。 既読化 → 次の未読が流れ始める
- Sidebar collapsed (折りたたみ) 時: ベルのみ表示、 テロップは非表示、 押下動作は同じ
- ベル/テロップどちらをクリックしても同じモーダルが開く
- ホバー時: 軽い highlight、 cursor:pointer

### マーキーの実装

- CSS `@keyframes` で `transform: translateX(100% → -100%)` 線形ループ
- 1 周 = テキスト長 × 一定速度 (例: 8s 程度、 文字長により調整)
- `prefers-reduced-motion` 対応: アニメ停止、 静止表示

---

## 5. モーダル

### 配置

- `createPortal` で body 直下に出して `position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%)`
- **viewport 中央**配置 (Sidebar 幅に偏らない、 ユーザーの強い要望)
- backdrop は半透明黒 (既存 LoPo モーダル踏襲)

### デザイン (LoPo 軽減表アプリのトンマナ厳守)

`.claude/rules/ui-design.md` および `.claude/rules/DESIGN.md` 準拠:

- **白黒のみ** (既存テーマ変数 `--color-text-primary` / `--color-bg-primary` 等)
- **Inter フォント禁止** (既存 LoPo フォントスタック使用)
- **honey 色禁止** (これはハウジング独自)
- glassmorphism は控えめ
- アニメーション: framer-motion で `{ opacity, scale, y }` 100-200ms
- 既存モーダル参考: `NewPlanModal.tsx` / `ShareModal.tsx` / `BackupExportModal.tsx`

### 中身 (上から下)

```
┌─ Modal (viewport center) ─────────────────┐
│  📢 [Title (i18n.language 優先)]    [×]  │
│                                            │
│  [Body 本文 (multi-line, 改行保持)]        │
│                                            │
│  投稿日: 2026-05-25                        │
│  ─────────────────────────────────────    │
│  📨 過去の通知や最新情報は                  │
│    [X (Twitter)]  [Discord]                │
│                                            │
│  [既読にする / 閉じる]                     │
└────────────────────────────────────────────┘
```

### 言語フォールバック

```ts
const text = obj[i18n.language] || obj.en || obj.ja;
```

`i18n.language` は `ja` / `en` / `ko` / `zh` のいずれか。 ko/zh は当面 en にフォールバックされる。

### フッター固定文言 (X / Discord 案内)

- ユーザー要望「全部消えた後どこで見るの? と思われないように」 への対応
- 既存 URL を再利用 ([Layout.tsx:652](src/components/Layout.tsx#L652) / [LandingFooter.tsx:115](src/components/landing/LandingFooter.tsx#L115) と同じ):
  - X: `https://x.com/lopoly_app`
  - Discord: `https://discord.gg/z7uypbJSnN`
- 多言語化: i18n キー `system_notif.modal.footer_info` / `system_notif.modal.x` / `system_notif.modal.discord`

### 閉じる動作

- × ボタン / ESC / backdrop クリック / 「既読にする」 ボタン → **すべて既読化扱い**
- 既読化 → localStorage 更新 → 次の未読あれば残し、 無ければ Sidebar 枠ごと消える

---

## 6. 管理画面 (/admin 内に新規タブ「通知」 追加)

### 一覧画面

新着順表示、 1 行あたり:
- title (ja) を主表示
- 「公開中 / 停止中」 バッジ
- 投稿日 / 最終更新日
- アクション: 編集 / 公開停止 toggle / 削除

### 投稿フォーム

| フィールド | 必須 | 説明 |
|---|---|---|
| title (ja) | ✅ | 日本語タイトル |
| title (en) | ✅ | 英語タイトル |
| title (ko) | ⬜ | optional、 当面空で OK |
| title (zh) | ⬜ | optional、 当面空で OK |
| body (ja) | ✅ | 日本語本文 |
| body (en) | ✅ | 英語本文 |
| body (ko) | ⬜ | optional |
| body (zh) | ⬜ | optional |
| published | ✅ | 公開チェックボックス (デフォルト ON) |

### 編集

- 既存通知の title/body 修正
- updatedAt 更新
- 既読 ID リストはそのまま (= 既読ユーザーには再表示されない、 これは仕様)

### 公開停止 toggle

- `published: true ↔ false` の切替
- false にすると即時 UI から消える (`onSnapshot` で全クライアント反映)
- 削除と違い不可逆ではない

### 削除

- confirm ダイアログ後に doc を完全削除
- 不可逆操作のため警告

### 反映

- Firestore 更新 → `onSnapshot` で全ユーザー Sidebar に即時反映
- 公開即時表示、 公開停止/削除も即時消える

### admin 認証 / 権限

- 既存 `AdminGuard.tsx` (Discord OAuth + admin 判定) を継承
- Firestore Rules の `isAdmin()` ヘルパで write 制御

---

## 7. ファイル構成

### 新規追加

```
src/types/systemNotification.ts
  - SystemNotification 型
  - ReadState 型
  - 多言語フィールドの型 LocalizedText = { ja, en, ko?, zh? }

src/store/useSystemNotifications.ts
  - Firestore 購読 (onSnapshot で published===true のもののみ)
  - localStorage 既読ロジック
  - markRead(id) / unreadItems / latestUnread
  - public read のため認証不要

src/components/SystemNotificationBar.tsx
  - Sidebar 下端の ベル + テロップ枠
  - 未読 0 で null 返し (枠ごと消える)
  - Sidebar collapsed 状態を props で受け取り、 テロップ表示/非表示切替
  - LoPo 既存トンマナ (白黒、 Inter 禁止)

src/components/SystemNotificationModal.tsx
  - viewport 中央モーダル
  - title / body / 投稿日 / X & Discord 案内 / 閉じる
  - createPortal で body 直下
  - framer-motion アニメ
  - LoPo 既存モーダルパターン踏襲 (NewPlanModal 等)

src/components/admin/AdminSystemNotifications.tsx
  - 一覧 + 投稿 + 編集 + 公開停止 toggle + 削除
  - 既存 admin ページのレイアウト/UI パターン踏襲 (AdminContents.tsx 等を参考)

src/lib/systemNotifLinks.ts (or 既存定数ファイルに追記)
  - LOPO_X_URL = 'https://x.com/lopoly_app'
  - LOPO_DISCORD_URL = 'https://discord.gg/z7uypbJSnN'
```

### 既存ファイル変更

```
src/components/Sidebar.tsx
  - 下端 (バックアップ/復元の上) に <SystemNotificationBar isCollapsed={...} /> 追加

src/components/admin/AdminLayout.tsx (or admin タブメニュー定義箇所)
  - 「通知」 タブ追加 → AdminSystemNotifications を表示

firestore.rules
  - system_notifications collection の rule 追加
  - read = public、 write = isAdmin()

src/locales/ja.json, en.json, ko.json, zh.json
  - system_notif.* キー追加 (UI 文言、 admin 画面ラベル、 modal フッター文言)
```

---

## 8. テスト

### 単体 / hook テスト

- `useSystemNotifications`: 購読挙動 / 既読化 / 未読カウント / localStorage 永続化
- `SystemNotification` 型バリデーション (ja/en 必須チェック)

### コンポーネント (RTL)

- `SystemNotificationBar`: 未読あり → 表示 / 未読 0 → null / collapsed 時のテロップ非表示
- `SystemNotificationModal`: title/body 表示 / 言語フォールバック / 閉じるで markRead 呼ばれる / X & Discord リンクが正しい href

### 管理画面

- `AdminSystemNotifications`: 投稿フォーム → Firestore 書き込み / 編集 / 公開停止 toggle / 削除 confirm

### vitest 全体

- 現在 1042 pass → 1060 程度に増加見込み
- memory `reference_vitest_vmthreads_hang` の安全手順厳守 (パイプ禁止、 ファイル出力 + ハードタイムアウト、 再実行しない)
- memory `reference_vitest_pool_firebase` 通り pool='vmThreads' 維持

---

## 9. リリース後 / 拡張余地

- ko/zh 多言語 (admin UI には optional フィールドとして既に置く)
- 通知ジャンル分け (タグ / アイコン違い)
- 本文中リンクのクリッカブル化 (Markdown 風 or `link?` フィールド活用)
- 既読の端末間同期 (ログイン時のみ Firestore 保存)
- Web Push 通知 (ブラウザ通知 API)
- 予約投稿 (Vercel Cron で publish toggle)

---

## 10. オープン論点 (実装前に再確認)

- なし (このセッションで全論点クリア)

## 11. メモ

- 軽減表アプリは LoPo メイン本体機能。 ハウジング (`/housing`) は独立トンマナのため、 本機能はハウジング画面では出さない (Sidebar 自体が ハウジング画面では別レイアウトのため自然に出ない)
- LP (`/`) は別ページ。 Sidebar 自体が無いので、 SystemNotificationBar も出ない (これは仕様、 LP は静的告知なし)
- 必要なら将来 LP にも告知バナー追加できる (SystemNotificationModal 流用)
