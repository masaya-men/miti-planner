# Grapl（グレイプル）総合開発計画書

**サービス名：Grapl（グレイプル）**
**リポジトリ：https://github.com/masaya-men/miti-planner**
**ドメイン：未定（grapl.app / .gg / .io 等）**

---

## ステータス凡例
- ✅ 完了
- 🔄 進行中
- ⬜ 未着手
- ❓ 未決定

---

## 1. サービス概要

FF14プレイヤー向けの総合ツールポータル。
第一弾：軽減プランナー（Miti Planner）
第二弾：ハウジングツアープランナー

スプレッドシートの重さ・使いにくさを解消し、PC・スマートフォンどちらでもストレスなく使えることを最優先とする。完全無料。マネタイズはYouTubeへの誘導のみ（スクウェア・エニックス利用規約準拠）。

---

## 2. 技術スタック

```
フロントエンド：React 19, TypeScript, Vite 7
スタイリング：Tailwind CSS v4
状態管理：Zustand
アニメーション：framer-motion
アイコン：lucide-react
多言語：react-i18next（日本語・英語対応済み）
3D背景：Three.js（WebGL ShaderMaterial）
認証・DB：Firebase（Auth + Firestore）
デプロイ：Vercel
```

---

## 3. 共通仕様

### 認証
- Google / Discord / X（Twitter）ログイン対応
- 軽減表・ハウジングツール共通アカウント
- 非ログインユーザーは閲覧のみ
- プロフィールページ：表示名のみ（アバターなし）

### デザイン方針
- ダーク/ライトテーマ共通（両ツール同期）
- グラスモーフィズム・漆黒/純白背景
- フォント：Rajdhani + Noto Sans JP
- 大胆なタイポグラフィ・贅沢な余白・スクロール連動アニメーション
- デザインリファレンス：
  - https://dashdigital.studio/
  - https://aircord.co.jp/
  - https://www.neoculturalcouture.com/

### 法的要件（全ページ共通フッター）
```
(C) SQUARE ENIX CO., LTD. All Rights Reserved.
当サイトは非公式のファンツールであり、
株式会社スクウェア・エニックスとは一切関係ありません。
```
- プライバシーポリシーページ（必須・Googleログイン使用のため）
- 利用規約ページ（必須）
- お問い合わせ：X（Twitter）のみ

### マネタイズ
- アプリ内課金・広告なし（SE利用規約準拠）
- YouTubeチャンネル（これから作成）への誘導のみ
  - 全ジョブの最新パッチ毎スキル回し動画
  - 人気ハウジングツアー動画
  - 概要欄にGraplへのリンクを設置

---

## 4. ポータルサイト

### ✅ 完了
- ポータルページの基本構造
- ツール選択カード
- フッター（SE権利表記・免責事項）
- OGP画像・favicon・PWA対応

### ⬜ 未着手
- **トップページの抜本的デザイン改修**
  - 大胆なタイポグラフィ（見出しが画面を支配するサイズ）
  - 贅沢な余白、スクロール連動アニメーション
  - モノトーン基調、使う色は一点集中
  - Graplのブランドイメージを一瞬で伝えるビジュアル
- SEO対策（日英両対応）
- Discordコミュニティ（❓未決定）

---

## 5. 軽減プランナー（Miti Planner）

### ✅ 完了済み実装

**コア機能**
- タイムラインテーブル（軽減配置・ドラッグ移動）
- パーティ編成モーダル（ロールカラー付きスロット・React.memo最適化済み）
- ステータス設定・ダメージ計算
- 軽減自動組み立てアルゴリズム（純粋JSアルゴリズム・LLM不使用）
- FFLogsインポート（Vercel Edge Functionプロキシ経由）
- Undo/Redo（最大30件）
- コンパクト表示・AA追加モード
- マイジョブハイライト
- ライトパーティ/ロール別並び替え
- フェーズ管理

**UI/UX**
- ダーク/ライトテーマ切り替え
- WebGL背景アニメーション（Three.js ShaderMaterial）
- グラスモーフィズムデザイン
- ヘッダー折り畳み/展開（近接センサー付き）
- サイドバー開閉（近接センサー付き）
- チュートリアル（全ステップ・多言語対応）
- モバイル対応基盤

**技術**
- localStorage永続化（Zustand persist）
- i18n（日本語・英語）
- Vercelデプロイ・PWA対応
- npm run build クリーン確認済み

**データ**
- `src/data/masterData.ts`：サーバー・ハウジングエリア・タグの表記ゆれ対応データ

### 🔄 進行中
- ライトテーマの透け感改善
- ヘッダーボタンデザイン・フォント改修（Rajdhani導入）

---

### ⬜ Phase 1：Firebase認証

**ユーザーの手動作業（5分）**
1. Firebase Consoleでプロジェクト作成
2. Authentication → Google / Discord / X を有効化
3. Firestore Database を本番モードで作成
4. ウェブアプリ登録 → 設定値を `.env.local` に追加
   ```
   VITE_FIREBASE_API_KEY=xxx
   VITE_FIREBASE_AUTH_DOMAIN=xxx
   VITE_FIREBASE_PROJECT_ID=xxx
   VITE_FIREBASE_STORAGE_BUCKET=xxx
   VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
   VITE_FIREBASE_APP_ID=xxx
   ```

**実装内容**
- `src/lib/firebase.ts`（Firebase初期化）
- `src/store/useAuthStore.ts`（ログイン状態管理）
- ヘッダーにログインボタン追加
  - 未ログイン：「Googleでログイン」等
  - ログイン済み：表示名 + ログアウト
- i18nキー追加：`auth.sign_in` / `auth.sign_out` / `auth.signed_in_as`

---

### ⬜ Phase 2：プラン保存・読み込み

**Firestoreデータ構造**
```
/plans/{planId}
  ownerId: string
  ownerDisplayName: string
  title: string（デフォルト：コンテンツのフルネーム）
  contentId: string | null
  isPublic: boolean
  copyCount: number（コピーされた回数）
  useCount: number（「これ使ってます」ボタンの数）
  currentLevel: number
  timelineEvents: TimelineEvent[]
  timelineMitigations: AppliedMitigation[]
  phases: Phase[]
  partyMembers: PartyMember[]（computedValues除く）
  aaSettings: AASettings
  schAetherflowPatterns: Record<string, 1 | 2>
  createdAt: Timestamp
  updatedAt: Timestamp
```

**実装内容**
- `src/lib/planService.ts`（Firestore CRUD）
- プラン保存ボタン（ヘッダーに保存状態表示）
  - 「保存中…」「✓ 保存済み」「● 未保存の変更あり」
- プランのタイトル編集（デフォルト：コンテンツのフルネーム）

**Firestore Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /plans/{planId} {
      allow read: if true;
      allow create: if request.auth != null
                    && request.resource.data.ownerId == request.auth.uid;
      allow update, delete: if request.auth != null
                            && resource.data.ownerId == request.auth.uid;
    }
    match /templates/{templateId} {
      allow read: if true;
      allow write: if false; // サーバーサイド or Cloud Functionsのみ
    }
  }
}
```

**無料枠の目安（Spark プラン）**
- 1日 5,000〜10,000人まで無料で対応可能
- バズった時のみ一時的にコスト発生（月数百〜数千円程度）
- 「これ使ってます」はコピー時のみ書き込み → 書き込み数を最小化

---

### ⬜ Phase 3：共有・検索機能

**共有URL**
- ログインユーザー：プランを公開URLとして共有可能
- 非ログインユーザー：共有URLから閲覧のみ・SNS共有可
- 他ユーザーのプランは「自分用にコピー」できる（ログイン必要）
- コピー時に `copyCount` をインクリメント

**「これ使ってます」ボタン**
- 公開プランに表示
- 押した数が人気度の指標（`useCount`）
- 検索結果は `useCount` 順で表示

**軽減表を探す（サイドバー新機能）**
```
サイドバー
├── ＋ 新規作成
├── 最近のアクティビティ
├── 🔍 軽減表を探す        ← 新機能
│    └── コンテンツを選ぶ
│         └── useCount順で一覧表示
│              └── 閲覧 → 自分用にコピー
└── エクスプローラー
      └── 零式：至天の座アルカディア零式
            └── ヘビー級
                  ├── 1層
                  │     ├── 至天の座...（デフォルト名）
                  │     ├── 攻略用
                  │     └── 前半練習
                  └── 2層
                        └── 至天の座...（デフォルト名）
```

---

### ⬜ Phase 4：タイムラインテンプレートシステム

#### 概念

タイムラインテンプレートとは「軽減なし・攻撃名と時間だけが入った土台」のこと。
ユーザーはこの土台の上に自分の軽減を乗せて使う。
テンプレートはユーザーが意識することなく、自動的に生成・更新される。

#### 【現行コンテンツ】開発者による事前作成

対象：M1S〜M12S（14件）・FRU

作成手順（開発者が手動で実施）：
1. FFLogsインポートでクリアログ取得
2. 不要イベントを削除・攻撃名を整理
3. DevTools Console で以下を実行：
   ```javascript
   JSON.stringify(useMitigationStore.getState().timelineEvents)
   ```
4. 出力を `src/data/templates/{contentId}.json` に保存
5. アプリにバンドルして公開

形式：
```json
{
  "contentId": "m9s",
  "timelineEvents": [...],
  "phases": [...]
}
```

UX：
- 層を選択した時点でテンプレートが自動読み込み
- テンプレートがない場合は空の表が開く
- 「テンプレート」という文言はUI上に出さない

#### 【新規コンテンツ】FFLogsインポートによる自動テンプレート化

新しいパッチのコンテンツ（零式・絶など）は、
クリアしないと最後まで攻撃が判明しないため、
開発者が事前にテンプレートを用意することができない。

**自動テンプレート化の仕組み：**

```
① ユーザーがFFLogsからクリアログをインポート
        ↓
② システムが contentId を検出
        ↓
③ Firestoreに同じ contentId のテンプレートが存在しない場合
   → 自動的に最初のテンプレートとして登録
   （ユーザーには何も通知されない・意識させない）
        ↓
④ 同じ contentId で複数のインポートが蓄積される
        ↓
⑤ useCount・copyCount の多いタイムラインが
   自然と「よく使われるテンプレート」として上位表示
```

**Firestoreのテンプレートデータ構造：**
```
/templates/{contentId}/candidates/{candidateId}
  sourceType: 'fflogs_import'
  timelineEvents: TimelineEvent[]  // 軽減なし・攻撃のみ
  phases: Phase[]
  useCount: number
  copyCount: number
  importedAt: Timestamp
  importedBy: string（匿名化）
```

**自浄・最適化の仕組み：**
- 時間が経つにつれ「これ使ってます」数・コピー数が多いものが上位へ
- 人気上位のテンプレートがそのコンテンツの「標準タイムライン」として機能
- 誤ったタイムライン（途中でアウトしたログ等）は自然に埋もれる
- 開発者・モデレーターが手動でキュレーションする必要がない

**クリアログの判定条件：**
- FFLogsのログがコンテンツの最後まで記録されているか
- 零式・絶コンテンツであるか
- 一定以上のイベント数があるか（途中アウトのログを除外）

---

### ⬜ リリース戦略
1. クローズドβ（信頼できる少数に先行公開）
2. フィードバック反映
3. 準備でき次第すぐ公開
4. Xで告知（Discordは❓未決定）

---

## 6. ハウジングツアープランナー

**リリース時期：軽減表公開・安定後なるべく早く**
**アカウント：軽減表と共通**

### ⬜ ギャラリー

**登録**
- XのURLから住所を自動解析
  - `src/data/masterData.ts` の表記ゆれデータを使用
  - DC・サーバー・エリア名を自動抽出
  - 番地はXの投稿文から数字を読み取り
  - 解析できなかった項目は手入力
- 地図上をクリックして番地入力も可能（両方対応）

**画像表示**
- XのoEmbed（公式埋め込み・APIキー不要・無料）を使用
- 以前のX API方式は廃止

**タグ**
- `masterData.ts` の `tagMasterData` を使用
  - テイスト系：モダン・和風・サイバーパンク等
  - 季節系：春・夏・秋・冬・ハロウィン・クリスマス等

**登録枠制限**
- 初期登録期間：上限なし（大御所ハウジンガーが大量登録できる）
- 以後：1日あたり上限あり（件数は❓要調整）

**いいね機能**
- 閲覧ユーザーがいいねできる
- いいね数の人気順ソートはあえて実装しない（格差防止）

**悪用対策**
- 通報機能あり（詳細は❓後回し）

### ⬜ マップ

- 実機のマップを撮影・超抽象化したオシャレなデザインに加工
- FF14全ハウジングエリア対応（初期から全エリア）
  - ミスト・ゴブレット・ラベンダーベッド・シロガネ・エンピレアム
- 最短ルート・簡易エーテライトからの経路表示

### ⬜ ツアー機能

- フリーモード（各自が自由に次へ進む）
- ガイドモード（主催者が次へ進むと全員の画面が切り替わる・Firebase Realtimeで同期）
- 両モード切り替え可能（必須機能）
- Enterキー/Spaceキーで次へ（PC）

### ⬜ リリース準備
- 登録データをある程度準備してから公開（コールドスタート回避）
- 自分でデータを事前登録しておく

---

## 7. 未決定事項

| 項目 | 状況 |
|------|------|
| ドメイン | 未定（grapl.app / .gg / .io等） |
| Discordコミュニティ | ❓未決定 |
| ハウジング登録の1日上限件数 | ❓要調整 |
| ハウジングイベント告知機能 | ❓未決定 |
| YouTubeチャンネル名 | 未定 |
| クリアログ判定の条件詳細 | 実装時に詰める |

---

## 8. 次のアクション（優先順）

```
【今すぐ】
  1. Firebase Consoleでプロジェクト作成（手動・5分）
  2. 設定値を .env.local に追加
  3. Phase 1（Firebase認証）実装

【完了後】
  4. Phase 2（プラン保存・読み込み）
  5. Phase 3（共有・検索機能）
  6. Phase 4（現行コンテンツのテンプレート作成）
     + 新コンテンツ自動テンプレート化の実装
  7. クローズドβ → 公開

【並行して進めるもの】
  - 🔄 ライトテーマの透け感改善
  - 🔄 ヘッダーボタンデザイン・フォント改修
  - ⬜ ポータルトップページのデザイン改修
  - ⬜ プライバシーポリシー・利用規約ページ作成
  - ⬜ YouTubeチャンネル作成
  - ⬜ ドメイン取得
```

---

## 9. 重要ファイル一覧

| 用途 | ファイル |
|------|---------|
| 状態管理（全データ） | `src/store/useMitigationStore.ts` |
| チュートリアル管理 | `src/store/useTutorialStore.ts` |
| 型定義 | `src/types/index.ts` |
| コンテンツ登録 | `src/data/contentRegistry.ts` |
| スキルデータ | `src/data/mockData.ts` |
| 表記ゆれ対応データ | `src/data/masterData.ts` |
| ルーティング | `src/App.tsx` |
| メインページ | `src/MitiPlannerPage.tsx` |
| サイドバー | `src/components/Sidebar.tsx` |
| ヘッダー | `src/components/ConsolidatedHeader.tsx` |
| レイアウト | `src/components/Layout.tsx` |
| 背景アニメーション | `src/components/ParticleBackground.tsx` |
| i18n 日本語 | `src/locales/ja.json` |
| i18n 英語 | `src/locales/en.json` |
| FFLogsプロキシ | `api/route.ts` |
| Vercel設定 | `vercel.json` |
| 環境変数サンプル | `.env.local.example` |
| 現行テンプレート（作成予定） | `src/data/templates/{contentId}.json` |
