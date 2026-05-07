# ハウジングツアー Phase 1 設計書（マップ以外の MVP）

> **作成日**: 2026-05-07
> **ステータス**: 設計レビュー待ち
> **スコープ**: lopoly.app/housing パス統合、マップ抜きの全機能
> **元計画書**: `docs/housing-tour-planner-requirements.md`
> **メモリ**: `project_lopo_mul_constraint.md`

---

## 1. 背景と目的

### 1.1 ねらい

FF14 のハウジング（プレイヤーが家を建てて装飾する機能）を巡る「ハウジングツアー体験」を提供する Web アプリを `lopoly.app/housing` パス配下に統合する。Phase 1 ではマップ以外の機能を完成させ、Phase 2 でマップ + 公開、Phase 3 でリアルタイム同期等のキラー機能を追加する段階リリース戦略を採る。

### 1.2 LoPo 本体との関係

| 項目 | LoPo 本体（軽減表） | ハウジングツアー |
|---|---|---|
| MUL 対象 | 対象（SE 公式アイコン使用） | 対象外（SE 素材一切使わない設計） |
| 収益化 | 寄付モデル堅持 | 別運営方針（メモリ参照） |
| ドメイン | lopoly.app | lopoly.app/housing（同統合） |
| Firebase プロジェクト | 共通（同 Auth） | 共通（同 Auth） |
| ログイン要件 | 一部機能のみ | 登録時必須、閲覧は不要 |

### 1.3 Phase 1 の完成定義

- マップ以外の機能を全完成
- 一般公開はしない（内部完成のみ）
- Phase 2 でマップ追加 + まとめて公開

---

## 2. スコープ

### 2.1 Phase 1 に含む

- ✅ ルート登録 (`/housing`, `/housing/p/{id}`, `/housing/tour/{id}`)
- ✅ Firestore スキーマ確定 + セキュリティルール
- ✅ 認証統合（既存 Firebase Auth 流用、アカウントリンク対応）
- ✅ 登録機能（SNS / ブログ URL 自動補完 + 手動入力 + マップクリックは Phase 2）
- ✅ 画像 3 択（SNS URL / サムネアップ / 画像なし）
- ✅ ギャラリー UI（カードグリッド + Lazy Load）
- ✅ タグ・住所による検索フィルタ
- ✅ ツアー機能（マップ抜き：ルート保存・並び替え・URL 共有・ルーレット）
- ✅ DC 自動分割 + DC 移動カード
- ✅ お気に入り（ローカル / クラウド同期）
- ✅ 通報フロー（3 件で自動非表示）
- ✅ 削除依頼フロー（自分のカード即削除 / 他人のカードは keyword verification）
- ✅ オンボーディング（3 択を平等に提示）
- ✅ Progressive disclosure（連携誘導）
- ✅ リキッドグラス + ルーペエフェクト視覚演出
- ✅ 多言語対応（ja / en / ko / zh）

### 2.2 Phase 2 に先送り

- 🚀 ハウジングマップ表示（独自書き起こし SVG）
- 🚀 マップクリック登録モード
- 🚀 ツアー進行 UI（マップ上「↓ 次へ」）
- 🚀 エーテライト最短ルート計算
- 🚀 一般公開（Phase 1 + Phase 2 完成時）

### 2.3 Phase 3 に先送り

- 🌟 ツアーモード B（リアルタイム連動・主催者の「次へ」で全員同期）
- 🌟 信用スコアシステム
- 🌟 永久 BAN（admin 画面）
- 🌟 NSFW 自動判定（Vision API）
- 🌟 Twitter 連携での住所自動補完強化
- 🌟 アカウントリンク UI 充実

---

## 3. アーキテクチャ概要

### 3.1 技術スタック

```
Frontend  : 既存 LoPo と統合（Vite + React + TypeScript + Tailwind v4）
Auth      : 既存 Firebase Auth（Twitter / Discord）
DB        : 既存 Firebase Firestore（同プロジェクト）
Storage   : Firebase Storage（サムネ画像のみ、80KB に圧縮）
画像配信  : SNS URL は外部 CDN（X / Bluesky 等）、サムネは Cloudflare CDN 経由
状態管理  : Zustand（既存パターン踏襲）
i18n      : react-i18next（既存）
ルーティング: react-router-dom（既存）
画像処理  : Cloud Functions（アップロード時自動圧縮）
```

### 3.2 Firebase 容量試算

```
Firestore  : 1 物件 ≒ 1 KB
             10 万物件で 100 MB（無料枠 1 GB の 10%）
             完全に無料枠内
Storage    : サムネ 80KB × 全登録の 30% 想定
             10,000 物件 → 240 MB（無料枠内）
             100,000 物件 → 2.4 GB（$0.06/月）
帯域       : Cloudflare CDN 噛ませて月 $0-30 規模
              巨大スケール（100 万物件）でも $300/月 程度
課金上限   : 月 1,000 円警告 / 5,000 円停止（既存設定）
```

### 3.3 MUL 整合性

ハウジングツアーは以下の SE 素材を**一切使わない**設計:
- ❌ 公式エリアマップ画像
- ❌ 公式 UI スクリーンショット
- ❌ 公式ロゴ・タイトル
- ❌ 家具アイコン・3D モデル

使うのは:
- ✅ ワールド名・エリア名・区画番号（事実情報、MUL 対象外）
- ✅ ユーザー投稿スクショ（個人プレイヤーの権利）
- ✅ ツアー予定・PR 文（ユーザー権利）
- ✅ Nominative Fair Use（「FF14 ハウジングツアー」と説明する範囲）

→ MUL 対象外として別運営方針が可能（詳細は内部メモリ）。

---

## 4. データモデル

### 4.1 Firestore コレクション一覧

```
housing_listings/{id}                       メイン物件
  └─ reports/{reportId}                     通報サブコレクション
housing_tours/{id}                          ツアールート
housing_favorites/{uid}/items/{listingId}   お気に入り（ログインユーザー）
housing_user_meta/{uid}                     ハウジング個別ユーザーデータ
users/{uid}/featureSessions/{tool}          ツール毎 opt-in フラグ
```

### 4.2 `housing_listings/{id}` — メイン物件

```typescript
interface HousingListing {
  id: string;                    // auto-id
  ownerUid: string;              // Firebase uid

  // 住所
  dc: string;                    // 'Mana' | 'Aether' | etc
  server: string;                // 'Pandaemonium' | etc
  area: 'Mist' | 'LavenderBeds' | 'Goblet' | 'Shirogane' | 'Empyreum';
  ward: number;                  // 1-30
  plot: number;                  // 1-60
  size: 'S' | 'M' | 'L' | 'Apartment' | 'PrivateRoom';
  apartmentRoom?: number;        // 1-90, only when size='Apartment'

  // 画像（3 択のいずれか）
  imageMode: 'sns' | 'thumbnail' | 'none';
  postUrl?: string;              // OGP 対応 URL（X/Bluesky/Misskey/ブログ等）
  ogImageUrl?: string;           // 登録時に取得・キャッシュした OGP 画像 URL
  thumbnailPath?: string;        // Firebase Storage path（imageMode='thumbnail'）

  // ユーザー入力
  tags: string[];                // 最大 5 件、定義済みタグから選択のみ
  description?: string;          // PR 文、最大 200 文字

  // システム
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isHidden: boolean;             // 通報 3 件で自動 true
  reportCount: number;           // キャッシュ値（reports サブコレクション件数）
}
```

### 4.3 `housing_listings/{id}/reports/{reportId}` — 通報

```typescript
interface Report {
  reporterUid: string;
  reason: 'wrong_info' | 'griefing' | 'nsfw' | 'sold' | 'other';
  comment?: string;
  createdAt: Timestamp;
}
```

### 4.4 `housing_tours/{id}` — ツアー

```typescript
interface HousingTour {
  id: string;
  ownerUid: string;              // 'local' for guest tours stored in LocalStorage
  title: string;                 // 最大 50 文字
  listingIds: string[];          // 訪問順、ドラッグ可
  startId?: string;              // 始点指定
  isPublic: boolean;             // URL 共有時 true
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

ゲストは LocalStorage で同等構造、後でログイン時にクラウド同期。

### 4.5 `housing_favorites/{uid}/items/{listingId}` — お気に入り

```typescript
interface Favorite {
  listingId: string;
  addedAt: Timestamp;
}
```

ゲストは LocalStorage、ログイン時に同期。

### 4.6 `housing_user_meta/{uid}` — ハウジング個別ユーザーデータ

```typescript
interface HousingUserMeta {
  registrationCount: number;        // 累計登録数（D 案: 30 まで無制限）
  dailyQuota: {
    remaining: number;              // 0-5
    lastReset: Timestamp;           // 24h 経過判定
  };
  // trustScore: number              // Phase 3 で追加
  // banned: boolean                 // Phase 3 で追加
}
```

### 4.7 `users/{uid}/featureSessions/{tool}` — ツール毎 opt-in

```typescript
// document path: users/{uid}/featureSessions/miti
// document path: users/{uid}/featureSessions/housing
interface FeatureSession {
  activated: boolean;
  activatedAt: Timestamp;
}
```

---

## 5. 認証モデル

### 5.1 基本方針

- **1 uid 原則**: Firebase Auth 単一セッション（業界主流、Atlassian / Notion / Auth0 等が採用）
- **Twitter (X) / Discord 両対応**: Firebase Auth プロバイダーとして両方有効
- **アカウントリンク**: `linkWithCredential` で同一 uid に複数 provider 紐づけ可能
- **ツール毎 opt-in**: `featureSessions` フラグでツール独立性を表現
- **ツイート所有権の Twitter 検証はしない**: LoPo の「個人情報を持たない」原則と整合

### 5.2 オプトインフロー

```
新規ユーザーが /housing を初訪問:
  1. 「ハウジング機能を使いますか？」を問う
  2. 既に Firebase Auth 認証済（miti から）→「同じアカウントで OK」または「別アカウントで」
     - 「OK」→ featureSessions.housing.activated = true
     - 「別アカウント」→ ログアウト → 再ログイン → featureSessions.housing.activated = true
  3. 未認証 → ログインプロンプト → featureSessions.housing.activated = true

各ツールから独立にログアウト可（フラグだけクリア、Firebase Auth は維持）
```

### 5.3 アカウントリンク UI

設定画面に「他の SNS を連携」ボタン:
```
連携済み:
  ✓ Discord (username#1234)
未連携:
  □ X (Twitter) — 連携で SNS URL 自動補完が使えます [連携する]
```

連携時は `linkWithCredential` を呼び、同一 uid に provider 追加。

### 5.4 Twitter / Discord 異 provider 同時並列

技術的に単一ブラウザでは不可（Firebase Auth の 1 セッション制約）。完全分離が必要なユーザーには **Chrome profile 分離**を案内（業界標準の妥協）。

---

## 6. 登録フロー

### 6.1 登録フォーム構成

```
┌─────────────────────────────────────────┐
│ 物件登録                                 │
├─────────────────────────────────────────┤
│ 画像をどうしますか？                       │
│ ⚪ SNS / ブログの URL を貼る              │
│ ⚪ サムネイル画像をアップロード             │
│ ⚪ 画像なしで登録                          │
│                                          │
│ 💡 X / Bluesky 連携で住所自動入力         │
│    [連携する]                            │
│                                          │
│ 住所:                                    │
│ DC      [▼ Mana             ]           │
│ サーバー [▼ Pandaemonium     ]          │
│ エリア   [▼ シロガネ          ]          │
│ 区      [3      ] 番地 [12     ]         │
│ サイズ  [▼ M ハウス          ]           │
│                                          │
│ タグ（最大 5 つ）:                        │
│ [モダン] [カフェ] [冬・雪] [+]           │
│                                          │
│ 紹介文（任意、200 文字まで）:              │
│ [_________________________]              │
│                                          │
│ 残り枠: 4/5  [登録する]                  │
└─────────────────────────────────────────┘
```

### 6.2 画像 3 択の処理

| モード | 処理 | 表示 |
|---|---|---|
| `sns` | URL からフロントで OGP 取得 → og:image URL 保存 | `<img src={ogImageUrl}>` |
| `thumbnail` | アップロード → Cloud Function で 400×400 / 80KB に圧縮 → Storage 保存 | `<img src={thumbnailPath}>` |
| `none` | 何も保存しない | 統一プレースホルダ（グラスモーフィズム背景 + 住所テキスト） |

`<img>` クリック時:
- `sns`: `postUrl` に新タブで遷移（投稿元へ誘導、SEO 効果あり）
- `thumbnail`: 拡大表示なし（仕様通り）
- `none`: クリック不可

### 6.3 SNS URL の住所自動補完

`masterData.ts` の `serverMasterData` / `housingAreaMasterData` / `housingSizeMasterData` の alias を使い、ツイート本文から regex で抽出:

```typescript
// src/utils/parseHousingUrl.ts (Phase 1 で新設)
export async function parseHousingUrl(url: string): Promise<{
  ogImageUrl?: string;
  extracted: Partial<HousingAddress>;
  rawText?: string;
}> {
  // 1. URL から OGP 画像取得（fetch + meta tag parse）
  // 2. 投稿本文取得（X API or oEmbed or scraping fallback）
  // 3. masterData の alias で正規表現マッチング → 住所抽出
  // 4. 抜け漏れは null、ユーザーに手動修正させる
}
```

**対応プラットフォーム**:
- X (Twitter): 完全対応（regex で住所抽出）
- Bluesky: OGP 取得のみ（住所は手動）
- Misskey: OGP 取得のみ
- ブログ等: OGP 取得のみ

### 6.4 登録枠ロジック（D 案）

```typescript
// 擬似コード
function canRegister(uid: string): { allowed: boolean; reason?: string } {
  const meta = await getHousingUserMeta(uid);

  // 累計 30 件まで無制限
  if (meta.registrationCount < 30) {
    return { allowed: true };
  }

  // 日付が変わってたら quota リセット（5 件回復）
  if (isNewDay(meta.dailyQuota.lastReset)) {
    meta.dailyQuota.remaining = 5;
    meta.dailyQuota.lastReset = now();
    await save(meta);
  }

  if (meta.dailyQuota.remaining > 0) {
    return { allowed: true };
  }

  return { allowed: false, reason: '本日の登録枠を使い切りました（明日 5 件回復）' };
}

// 登録成功時
function onRegisterSuccess(uid: string) {
  meta.registrationCount += 1;
  if (meta.registrationCount > 30) {
    meta.dailyQuota.remaining -= 1;
  }
  await save(meta);
}

// 当日削除
function onSameDayDelete(uid: string, listing: HousingListing) {
  if (isSameDay(listing.createdAt, now())) {
    meta.registrationCount -= 1;
    if (meta.registrationCount >= 30) {
      meta.dailyQuota.remaining += 1;
    }
    await save(meta);
  }
}
```

### 6.5 重複登録ハンドリング（ハイブリッド）

登録時、同住所（DC + サーバー + エリア + 区 + 番地）の既存登録を検索:

```
同住所に既存あり → 警告ダイアログ
┌─────────────────────────────────────┐
│ 同じ住所で既に登録があります             │
│                                      │
│ [既存カードのプレビュー]                │
│ オーナー: ボブさん（2 週間前）           │
│ タグ: 和風, カフェ                     │
│                                      │
│ 住所が間違っている可能性があります。     │
│                                      │
│ [住所を訂正する] [私のも登録する]       │
└─────────────────────────────────────┘
```

- 「住所を訂正する」→ フォームに戻る（タイポ防止、大半のケースをここで吸収）
- 「私のも登録する」→ 2 件目登録を許可、ギャラリーで「複数登録」バッジ表示

ギャラリー側の自浄作用:
- 訪問者が「行ってみたら違いました」報告 → 通報 3 件で自動非表示
- 第一登録者への通知は in-app 通知（Phase 3 で push 対応）

---

## 7. ギャラリー / 検索

### 7.1 ギャラリーレイアウト

```
[ヘッダー / ナビ]
[フィルタバー]   タグ ▼  DC ▼  エリア ▼  サイズ ▼  並び順 ▼

[カードグリッド（PC 4 列、タブレット 3 列、モバイル 2 列）]
┌───────┐ ┌───────┐ ┌───────┐
│ 画像   │ │ 画像   │ │ 画像   │
│       │ │       │ │       │
│ [♡][📍] │ │ [♡][📍] │ │ [♡][📍] │   hover で出現
│ 住所   │ │ 住所   │ │ 住所   │
│ タグ   │ │ タグ   │ │ タグ   │
└───────┘ └───────┘ └───────┘

[Lazy Load で無限スクロール]
```

### 7.2 カード仕様

```typescript
interface ListingCard {
  thumbnailUrl: string;          // ogImageUrl OR thumbnailPath OR placeholder
  address: string;               // "Mana / Pandaemonium / シロガネ 3区 12番地"
  size: 'S' | 'M' | 'L' | 'Apartment' | 'PrivateRoom';
  tags: string[];                // 上位 3 件まで表示
  hoverActions: ['favorite', 'addToTour'];  // ホバー時に浮かび上がる
}
```

### 7.3 視覚演出

- リキッドグラス背景（カード自体は半透明 + 軽い屈折）
- ホバー時: ルーペ + 色収差エフェクトで右上に小さなアクセント（`docs/tech-notes/liquid-lens-effect.md` 参照）
- 「♡（お気に入り）」と「📍（今日行く＝ツアー追加）」ボタン
- いいね数は**完全に非表示**（人気格差防止、計画書 7.0 準拠）

### 7.4 並び順

- 新着順（デフォルト）
- ランダム（更新ごとシャッフル）
- 訪問数（Phase 3）

### 7.5 検索フィルタ

- **タグ**: マルチ選択（テイスト/シーン/季節/環境/構造/その他）
- **DC**: 単一選択
- **サーバー**: 単一選択（DC 選択後に絞り込み）
- **エリア**: マルチ選択
- **サイズ**: マルチ選択

URL クエリパラメータに反映してシェア可能（例: `/housing?tags=和風,カフェ&dc=Mana`）。

---

## 8. ツアー機能（マップなし）

### 8.1 ツアー作成フロー

```
1. ギャラリーで物件カードの 📍 をタップ → ツアーに追加
2. サイドバー（PC）/ ボトムシート（モバイル）に格納
3. DC 自動分割で「JP / NA / EU / OCE」タブに振り分け
4. サーバー単位ブロック → 「区 → 番地」若い順に自動整列
5. 任意の家の 🏁 ボタンで始点指定
6. ドラッグ&ドロップで順番カスタム
7. URL 共有ボタンで `/housing/tour/{id}` を発行
```

### 8.2 DC 移動カードの自動挿入

ツアーリスト内で DC が切り替わるところに自動挿入:

```
🚀 DC 移動カード
┌──────────────────────────────────┐
│ JP/Mana → JP/Elemental に移動     │
│                                    │
│ 手順:                              │
│ 1. ログアウト                      │
│ 2. キャラ選択画面で自鯖（Bahamut）   │
│    に戻る                          │
│ 3. DC トラベル → Elemental →      │
│    Aegis を選択                    │
│ 4. ログイン                        │
└──────────────────────────────────┘
```

DC 切り替わり検出は単純な比較（前のカードの `dc` と次のカードの `dc` が違う場合）。文言は i18n キーで多言語化、細かい調整は実装時に詰める。

### 8.3 コンテンツルーレット

```
1. ユーザーがタグ群を選択（例: 「和風」「カフェ」）
2. 「ルーレット開始」ボタン
3. アルゴリズムが該当タグを持つ全データから **ランダム 5 件** 抽出
4. 自動で新規ツアーとして組まれ、ツアー画面に遷移
5. ユーザーは並び順カスタム or そのまま開始可
```

### 8.4 ツアー URL 共有（Phase 1）

- `/housing/tour/{id}` 発行
- isPublic フラグ true でアクセス可能化
- 開いた人はツアーリストを閲覧可能（マップは Phase 2 で追加）
- フリー探索モードのみ Phase 1（リアルタイム連動は Phase 3）

### 8.5 マナー順守ポップアップ

ツアー開始ボタンを押すと表示:

```
🏠 ツアーを始める前に
─────────────────────────────────
訪問時は家主の迷惑にならないよう
マナーを守り、SNS 等のルールを
優先してください。

  □ 確認した（次回から表示しない）

      [キャンセル] [はじめる]
```

「次回から表示しない」は LocalStorage に保存。

---

## 9. 削除依頼フロー

### 9.1 自分のカード削除（即時）

ログインユーザーが自分の登録物件を削除:

- マイページから「削除」ボタン
- 確認ダイアログ → 即削除
- 当日登録なら登録枠 +1 復活

### 9.2 他人のカード削除依頼（keyword verification）

**シナリオ**: ボブのツイートを誰か（クレア）が登録 → ボブがそのツイートを削除したい

```
1. ボブが /housing/p/{id} を開く
2. 「このツイートを削除依頼する」ボタン
3. システム: 「ツイート本文に #lopo-remove-XXXX を 24h 以内に追記してください」
   （XXXX は物件 ID 由来のハッシュ）
4. ボブが自分のツイートを編集して keyword 追加
5. システムが定期巡回（cron 30 分間隔）でツイートを取得 → keyword 検証
6. 一致 → カードを isHidden=true、ボブに完了通知
7. 24h 経過しても keyword なし → 依頼自動キャンセル
```

巡回方式:
- Cron Job (Vercel Cron) で 30 分ごとに「pending 削除依頼」を確認
- X API でツイート本文取得（読み取り専用、無料枠で十分）
- keyword 検出 → 削除実行

Phase 1 では X (Twitter) のみ対応。Bluesky / Misskey は Phase 3 で追加。

### 9.3 通報フロー

```
1. 訪問者がカードに「違いました / 古い情報 / 不適切」を報告
2. reports サブコレクションに記録
3. reportCount をキャッシュ更新
4. reportCount >= 3 で自動 isHidden=true
5. 第一登録者にマイページで通知「あなたのカードが非表示になりました」
6. オーナーは「復活させる」ボタンで isHidden=false 戻し可
```

虚偽通報対策（信用スコア）は Phase 3 で実装。

---

## 10. ページ構成 / ルーティング

### 10.1 ルート設計

```
公開ルート（独立 URL あり）:
  /housing                     メイン（ボトムナビで内部切替）
  /housing/p/{id}              物件詳細（共有可能）
  /housing/tour/{id}           ツアー詳細（共有可能）

内部 state（ルート遷移なし）:
  探す                          ギャラリー（マップは Phase 2 で右パネル追加）
  回る                          ツアー（カードリスト、Phase 2 でマップ追加）
  登録                          登録フォーム（フルスクリーンモーダル）

モーダル化（個別 URL なし）:
  物件詳細モーダル              ギャラリーから直接開く
  検索フィルタ                  [フィルタ] ボタンで開く
  マイページ                    サイドバー / メニューから開く
  設定                          サイドバー / メニューから開く
```

### 10.2 PC レイアウト

```
┌─────────────────────────────────────────────┐
│ [LoPo ロゴ] /housing       [ログイン状態] [⚙]  │
├──────┬──────────────────────────────────────┤
│      │                                      │
│  🏠  │  [メインビュー]                        │
│ 探す │   - 探す: ギャラリー                    │
│      │   - 回る: ツアーリスト                  │
│  🗺️  │   - 登録: フォーム                      │
│ 回る │                                      │
│      │                                      │
│  ➕  │                                      │
│ 登録 │                                      │
│      │                                      │
│ ──── │                                      │
│ マイ  │                                      │
│ 設定  │                                      │
└──────┴──────────────────────────────────────┘
```

### 10.3 モバイルレイアウト

```
┌─────────────────────┐
│ [LoPo] /housing  [⚙] │
├─────────────────────┤
│                     │
│  [メインビュー]       │
│                     │
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│ 🏠 探す | 🗺️ 回る | ➕  │  ← 固定ボトムナビ
└─────────────────────┘
```

ツアー画面では計画書通りボトムシート構造（マップは Phase 2、Phase 1 はリスト全画面）。

---

## 11. UI / UX デザイン方針

### 11.1 グローバルテーマ同期

LoPo 軽減表とテーマ（ライト / ダーク）を共有。`useThemeStore` をそのまま流用。

### 11.2 グラスモーフィズム背景（既存準拠）

- ライト: 純白 #FFFFFF + 水滴・プリズム抽象背景 + 白パネルすりガラス
- ダーク: 漆黒 #000000 + 水滴・光反射抽象背景 + 黒パネル
- ユーザーカスタマイズなし（計画書 2.2 準拠）

### 11.3 リキッドグラス + ルーペエフェクト

詳細実装は `docs/tech-notes/liquid-lens-effect.md` を参照。Phase 1 適用箇所:

| 箇所 | エフェクト |
|---|---|
| モバイルボトムシート | 引き上げ時に屈折エッジ |
| PC サイドバー | 半透明 + 軽い屈折 |
| 物件カード（hover） | わずかな屈折リフト + 右上ルーペアクセント |
| モーダル枠 | 屈折ボーダー |
| ヒーロー（/housing トップ） | 大型ルーペ漂遊（マウス追従 or 自動アニメ） |

CSS rules.md 準拠（`backdrop-filter` は `--tw-backdrop-blur` 変数パターン使用）。

### 11.4 オンボーディング

`/housing` 初訪問時に 1 画面オンボーディング（**Discord-only 衝撃を防ぐ**）:

```
ハウジングツアーへようこそ

🏠 みんなが作った素敵な家を巡れます
📍 自分のおすすめツアーも作って共有できます

登録時、画像の選び方は 3 つ:
  ① SNS / ブログの URL を貼る
     → フル画質画像・動画
  ② サムネイル画像をアップロード
     → 400×400 1 枚
  ③ 画像なしで登録
     → テキストのみ

[はじめる]
```

### 11.5 Progressive Disclosure（連携誘導）

登録フォームの URL 入力欄付近で控えめに案内:

```
SNS / ブログの URL: [_____________]
                  💡 X / Bluesky 連携で住所自動入力できます
                     [連携する]
```

クリック時に小さなプレビュー画像 + 連携ボタン展開。スルー可能、押し付けない。

---

## 12. タグマスター（多言語）

### 12.1 構成

`src/data/housingTags.ts` に 6 大カテゴリ × 約 100+ 件:

| カテゴリ | 件数 | 例 |
|---|---|---|
| テイスト | 約 45 | 和風 / モダン / ゴシック / コテージコア |
| シーン・用途 | 約 40 | カフェ / バー / 図書館 / 神殿 |
| 季節・イベント | 約 20 | 春・桜 / ハロウィン / クリスマス / ひな祭り |
| 環境・舞台設定 | 約 12 | 森 / 砂漠 / 海中 / 宇宙 |
| 構造・特殊 | 約 15 | 屋上 / 地下 / ギミック / 隠し部屋 |
| その他 | 約 15 | ジブリ風 / 海賊 / カジノ |

### 12.2 多言語キー方式

```typescript
interface HousingTag {
  id: string;                    // 'modern', 'wafu', 'cafe' 等
  category: 'taste' | 'scene' | 'season' | 'environment' | 'structure' | 'other';
  i18nKey: string;               // 'housing.tag.modern' 等
  // 訳は src/locales/{ja,en,ko,zh}.ts に保持
}
```

i18n キー経由で表示（CLAUDE.md i18n ルール準拠）。

### 12.3 日本由来タグの扱い

「ひな祭り」「七夕」「縁日」等の日本文化由来タグは:
- 日本語表記 + ローマ字補助（Hinamatsuri / Tanabata / Matsuri）
- 4 言語すべてで日本語+ローマ字のセットを使用

### 12.4 韓国語 / 中国語の品質

調査結果で「(未確認)」マークしたタグは、初期リリース後にネイティブチェックを行う。当面は機械翻訳ベースで配置。

### 12.5 完全タグリスト

付録 A 参照（本ドキュメント末尾）。

---

## 13. セキュリティルール

### 13.1 Firestore Rules（抜粋）

```javascript
// housing_listings
match /housing_listings/{listingId} {
  allow read: if true;  // 公開
  allow create: if request.auth != null
                && request.auth.uid == request.resource.data.ownerUid
                && canRegister(request.auth.uid)  // 枠チェック
                && validateListing(request.resource.data);
  allow update: if request.auth != null
                && resource.data.ownerUid == request.auth.uid
                && validateListingUpdate(request.resource.data);
  allow delete: if request.auth != null
                && resource.data.ownerUid == request.auth.uid;

  match /reports/{reportId} {
    allow read: if false;  // 通報は管理者のみ
    allow create: if request.auth != null
                  && request.auth.uid == request.resource.data.reporterUid;
    allow update: if false;
    allow delete: if false;
  }
}

// housing_tours
match /housing_tours/{tourId} {
  allow read: if resource.data.isPublic == true
              || (request.auth != null && resource.data.ownerUid == request.auth.uid);
  allow create: if request.auth != null
                && request.auth.uid == request.resource.data.ownerUid;
  allow update: if request.auth != null
                && resource.data.ownerUid == request.auth.uid;
  allow delete: if request.auth != null
                && resource.data.ownerUid == request.auth.uid;
}

// housing_user_meta
match /housing_user_meta/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow write: if false;  // Cloud Function 経由のみ
}

// users/{uid}/featureSessions/{tool}
match /users/{uid}/featureSessions/{tool} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

### 13.2 Storage Rules

```javascript
match /housing_thumbnails/{uid}/{filename} {
  allow read: if true;
  allow write: if request.auth != null
               && request.auth.uid == uid
               && request.resource.size < 100 * 1024  // 100KB
               && request.resource.contentType.matches('image/.*');
}
```

実際の圧縮は Cloud Function の onObjectFinalized トリガーで実施。

### 13.3 レート制限

- 登録 API: ユーザー単位 D 案ロジック
- 通報 API: 1 物件あたり 1 ユーザー 1 回（reports サブコレクション constraint）
- お気に入り API: 1 ユーザー 100 件まで（Phase 1）

---

## 14. パフォーマンス・スケール戦略

### 14.1 ギャラリー高速化

- Lazy Load（Intersection Observer）で 60fps 維持
- カード画像は `loading="lazy"` 属性
- サムネは Cloudflare CDN（cache-control: long）
- SNS embed の og:image は X CDN 直接（LoPo 帯域消費なし）

### 14.2 エッジキャッシュ（バズ対策）

計画書 1.3 準拠:
- `/housing/tour/{id}` の閲覧専用 API は Vercel/Cloudflare エッジで静的キャッシュ
- TTL 5 分、ヒット時 Firestore 直撃ゼロ
- W1st 配信者がツアー URL シェアしても DB スパイクなし

### 14.3 Firestore クエリ最適化

- ギャラリーは `where('isHidden', '==', false).orderBy('createdAt', 'desc').limit(30)`
- 複合インデックス: `isHidden + createdAt` / `isHidden + dc + createdAt` / etc
- フィルタ複合は Firestore 制約に注意（最大 1 配列フィールド + N 単一フィールド）

---

## 15. テスト計画

### 15.1 ユニットテスト

- `parseHousingUrl()` regex 抽出（既存 masterData 使用）
- `canRegister()` D 案ロジック（境界値テスト）
- DC 移動カード挿入ロジック
- タグフィルタリング

### 15.2 結合テスト

- 登録 → ギャラリー反映
- 通報 3 件 → 自動非表示
- 削除 → 当日枠返還
- アカウントリンク → 単一 uid 維持

### 15.3 E2E（Playwright）

- ゲストユーザー: 閲覧 + ツアー作成（LocalStorage）
- ログインユーザー: 登録 + 編集 + 削除
- 削除依頼 keyword verification flow（モック）

---

## 16. リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| MUL 解釈変更 | 設計前提崩壊 | 公式アナウンス監視、SNS 素材 / 住所のみで maximum 防御済み |
| Firebase 課金スパイク | 運営費圧迫 | エッジキャッシュ + 課金上限（既存設定） |
| 荒らし登録大量 | ギャラリー汚染 | D 案 5/日 + 通報 + Phase 3 信用スコア |
| Twitter API 仕様変更 | regex 抽出失敗 | regex は段階的 fallback、抽出失敗時は手動入力フォーム表示 |
| Discord-only ユーザーの不公平感 | 離脱 | オンボーディングで 3 択平等表示、サムネアップ提供 |
| iOS Safari の SVG filter 非対応 | 視覚演出劣化 | プレーン glassmorphism にフォールバック（緩やか） |

---

## 17. Phase 2 / 3 への接続

### 17.1 Phase 2 で追加

- 独自書き起こし SVG マップ（Figma で初期版）
- マップ上の区画クリック登録モード
- ツアー進行 UI（マップ + 「↓ 次へ」フローティングボタン）
- エーテライト最短ルート計算
- 一般公開リリース

### 17.2 Phase 3 で追加

- ツアーモード B（リアルタイム連動）
- 信用スコアシステム（虚偽通報無効化）
- 永久 BAN（admin 画面）
- NSFW 自動判定（Vision API）
- アカウントリンク UI 充実
- Twitter 以外の OAuth 拡張（Bluesky 等）

---

## 18. 実装サブスペック分解

Phase 1 を 3 つの実装スペックに分割:

### Sub-spec 1: Foundation（裏側のみ）
- ルート登録 / 「Coming Soon」ページ
- Firestore 型定義 + セキュリティルール
- Auth 統合確認 + featureSessions スキーマ
- 工数: 1-2 日

### Sub-spec 2: Registration & Gallery
- 登録フォーム + 画像 3 択 + URL 自動補完
- ギャラリー UI + フィルタ + Lazy Load
- リキッドグラス基本適用
- タグマスター実装
- 工数: 2-3 週

### Sub-spec 3: Tour & Search & Deletion
- ツアー機能（カードリスト・DC 分割・DC 移動カード）
- 検索フィルタ詳細
- 削除依頼 keyword verification フロー
- 通報フロー
- ルーペ + 色収差エフェクト最終仕上げ
- マナー順守ポップアップ
- 工数: 2-3 週

### Phase 1 全体工数試算: 約 5-7 週間

---

## 付録 A: タグマスターリスト（4 言語完備）

タグ全リストは別ファイル `src/data/housingTags.ts` に実装時に配置。実装時参照ソース:

主要参考: [HOUSING SNAP](https://housingsnap.com/) / [HOUSING COLLECTION](https://housing-collection-ff14.com/) / [StudioXIV](https://studio-xiv.com/) / [Thonhart's Gallery](https://thonhart.com/) / [namu wiki](https://namu.wiki/) / [huijiwiki](https://ff14.huijiwiki.com/)

調査済みカテゴリ別ダイジェスト（実装時に確定）:

**テイスト系（45 項目）**: 和風 / 和モダン / 中華風 / 韓国風 / 洋風 / モダン / ミニマル / ナチュラル / 北欧 / アンティーク / ヴィンテージ / レトロ / 大正ロマン / ラスティック / カントリー / コテージコア / ゴシック / ダークアカデミア / インダストリアル / スチームパンク / サイバーパンク / SF・未来 / ファンタジー / メルヘン / ボヘミアン / 高級・ラグジュアリー / シック / エレガント / ロマンチック / かわいい / ポップ / モノクローム / ダーク / ライト / 派手 / 落ち着いた / シンプル / 暖かい / 涼やか / 幻想的 / 廃墟 / ホラー / 魔女 / 錬金術師 / 賢者・魔導師

**シーン・用途系（40 項目）**: 住宅・個人宅 / アパルトメント / 寝室 / リビング / ダイニング / キッチン / 浴室・風呂 / 書斎 / 子供部屋 / ウォークインクローゼット / カフェ / 喫茶店 / 純喫茶 / バー / 居酒屋 / 酒場 / クラブ・ナイトクラブ / ホストクラブ / レストラン / 食堂 / ラーメン屋 / 屋台 / 茶室 / ベーカリー / ショップ・店舗 / ブティック / 花屋 / 本屋・書店 / 図書館 / 美術館・ギャラリー / アトリエ / 工房・鍛冶場 / 撮影スタジオ / 神殿 / 神社 / 教会 / 学校 / 病院・診療所 / 旅館・宿屋 / ホテル / 温泉 / 銭湯 / 占い屋 / 庭園 / 水族館 / 動物園・ペットルーム / 武道場・道場 / FCハウス / 雑居ビル・複合 / 隠れ家 / 秘密基地

**季節・イベント系（20 項目）**: 春 / 夏 / 秋 / 冬 / 桜 / 紅葉 / 雪 / 海・ビーチ / 七夕 / ハロウィン / クリスマス / バレンタイン / 正月・新年 / ひな祭り / イースター / 夏祭り / 星芒祭 / 守護天節 / 縁日・祭り / イルミネーション

**環境・舞台設定系（12 項目）**: 森 / 砂漠 / 雪国 / 熱帯・南国 / 地中海・リゾート / 草原 / 山岳 / 洞窟 / 海中・水中 / 宇宙 / 空中・浮島 / 異世界・異空間

**構造・特殊系（15 項目）**: 屋上 / 地下 / 庭・外構 / テラス / 中庭 / 高低差 / 多層・複層 / 吹き抜け / ロフト / 屋根裏 / ギミック / 隠し部屋 / ワープ・異空間移動 / 浮かせ / 撮影向き

**その他（15 項目）**: ジブリ風 / 海賊 / 中世 / 城・宮殿 / 廃墟洋館 / 遊郭風 / 竜宮城 / ツリーハウス / キャンプ・野営 / 廃工場 / 研究室・ラボ / 監獄・牢獄 / 葬祭場 / カジノ / 劇場・シアター / サーカス

実装時に各タグの 4 言語訳を `src/locales/{ja,en,ko,zh}.ts` に配置。

---

**承認後、3 サブスペックに分解した実装プランを `superpowers:writing-plans` で作成します。**
