# LoPo Firebase設計書

## 目次
1. [Firestoreデータ構造設計](#1-firestoreデータ構造設計)
2. [Firestoreセキュリティルール](#2-firestoreセキュリティルール)
3. [認証セキュリティ](#3-認証セキュリティ)
4. [レート制限・DDoS対策](#4-レート制限ddos対策)
5. [プライバシー](#5-プライバシー)
6. [スケーラビリティ](#6-スケーラビリティ)
7. [コスト最適化](#7-コスト最適化)
8. [推奨設定・移行チェックリスト](#8-推奨設定移行チェックリスト)

---

## 1. Firestoreデータ構造設計

### 設計方針：ルートコレクション方式を採用

サブコレクション（`users/{uid}/plans/{planId}`）ではなく、**ルートコレクション**（`plans/{planId}`にownerIdフィールド）を採用する。

**理由：**
- 共有プランを`plans/{shareId}`で直接取得できる（サブコレだと`users/{unknownUid}/plans/{planId}`が必要で、Collection Group Queryが必須になる）
- Collection Group Queryはインデックス管理が煩雑で、セキュリティルールも複雑化する
- プランの所有者移転（将来的なチーム機能など）もフィールド書き換えだけで済む

### コレクション構造

```
firestore-root/
├── users/{uid}                    # ユーザープロファイル
├── plans/{planId}                 # 軽減プラン（メインデータ）
├── sharedPlanMeta/{shareId}       # 共有用の軽量メタデータ
└── userPlanCounts/{uid}           # プラン数カウンター（上限管理用）
```

### users コレクション

**保存すべきもの：** アプリ動作に必要な最小限の表示情報のみ
**保存すべきでないもの：** メールアドレス、認証トークン、個人を特定できる情報

```
users/{uid}
├── displayName: string           # 表示名（ユーザーが設定、本名ではない）
├── avatarUrl: string | null      # アバター画像URL
├── provider: "google" | "discord" | "twitter"  # 認証プロバイダ
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── settings: {                   # アプリ設定
        language: "ja" | "en"
        defaultLevel: number
    }
```

> **重要：メールアドレスはFirestore上に保存しない。** Firebase Authの内部にのみ保持し、Firestoreからは参照不可にする。これにより、セキュリティルールの設定ミスがあっても、メールアドレスが漏洩するリスクをゼロにする。

### plans コレクション

```
plans/{planId}
├── ownerId: string               # Firebase Auth UID
├── ownerDisplayName: string      # 非正規化（表示用キャッシュ）
├── title: string                 # プラン名
├── contentId: string             # コンテンツID（例: "aac_lhw_m4s"）
├── isPublic: boolean             # 共有ON/OFF
├── shareId: string | null        # 共有用短縮ID（nanoid 10文字）
├── copyCount: number             # コピーされた回数
├── useCount: number              # 閲覧回数
├── data: PlanData                # 軽減プランのフルデータ（既存の型をそのまま使用）
├── version: number               # 楽観的ロック用バージョン番号
├── createdAt: Timestamp
├── updatedAt: Timestamp
└── archivedAt: Timestamp | null  # アーカイブ済みの場合のタイムスタンプ
```

**インデックス設計：**
```
1. ownerId ASC, contentId ASC, updatedAt DESC
   → 用途: 自分のプラン一覧（コンテンツ別、新しい順）

2. ownerId ASC, updatedAt DESC
   → 用途: 自分の全プラン一覧（新しい順）

3. shareId ASC（単一フィールド、自動作成）
   → 用途: 共有URLからのプラン取得

4. isPublic ASC, contentId ASC, copyCount DESC
   → 用途: 人気公開プラン一覧（将来の探索機能用）
```

### sharedPlanMeta コレクション（共有の軽量参照）

共有URLアクセス時に、プランのフルデータを読む前に存在確認・メタ表示するための軽量ドキュメント。

```
sharedPlanMeta/{shareId}
├── planId: string                # 実プランへの参照
├── ownerId: string               # プラン所有者UID
├── ownerDisplayName: string
├── title: string
├── contentId: string
├── createdAt: Timestamp
└── isActive: boolean             # プラン削除時にfalseにする
```

**なぜ分離するのか：**
- 共有URLアクセスは**読み取り1回で済む**（プランのフルデータはユーザーが「開く」操作をした時だけ読む）
- OGP生成にもこの軽量データで十分
- プランのフルデータ（data フィールド）は数KB〜数十KBあるため、不要な読み取りを避ける

### userPlanCounts コレクション（上限管理）

```
userPlanCounts/{uid}
├── total: number                 # 全プラン数
├── byContent: {                  # コンテンツ別プラン数
│       "aac_lhw_m4s": 3,
│       "aac_lhw_m3s": 2
│   }
└── updatedAt: Timestamp
```

**プラン数制限の実装方式：**

セキュリティルールでカウントドキュメントを検証する「2段階トランザクション方式」を採用。

```
手順:
1. クライアントがバッチ書き込みで以下を同時実行:
   a. plans/{newPlanId} にプランを作成
   b. userPlanCounts/{uid}.total を +1
   c. userPlanCounts/{uid}.byContent[contentId] を +1
2. セキュリティルールが以下を検証:
   a. カウントドキュメントの新しい値が上限以下か
   b. プランのownerIdがリクエスト者と一致するか
```

> **注意:** セキュリティルール内でcount()クエリを使う方法もあるが、読み取りコストがcount()ごとに発生するため、カウンタードキュメント方式の方がコスト効率が良い。

---

## 2. Firestoreセキュリティルール

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ========================================
    // ヘルパー関数
    // ========================================

    // 認証済みかどうか
    function isAuthenticated() {
      return request.auth != null;
    }

    // 自分自身のドキュメントか
    function isOwner(uid) {
      return isAuthenticated() && request.auth.uid == uid;
    }

    // ドキュメントサイズが制限内か（100KB）
    function isValidSize() {
      return request.resource.data.keys().size() <= 20;
    }

    // プラン数が上限内か
    function isPlanCountValid(uid, contentId) {
      let counts = get(/databases/$(database)/documents/userPlanCounts/$(uid)).data;
      return counts.total < 50
          && counts.byContent.get(contentId, 0) < 5;
    }

    // 文字列の長さ制限
    function isValidString(s, maxLen) {
      return s is string && s.size() > 0 && s.size() <= maxLen;
    }

    // タイムスタンプが妥当か（未来の日付でないこと）
    function isValidTimestamp(ts) {
      return ts is timestamp && ts <= request.time;
    }

    // ========================================
    // users コレクション
    // ========================================
    match /users/{uid} {
      // 自分のプロファイルのみ読み書き可能
      allow read: if isOwner(uid);
      allow create: if isOwner(uid)
                    && isValidString(request.resource.data.displayName, 30)
                    && !('email' in request.resource.data);  // メールアドレス保存を禁止
      allow update: if isOwner(uid)
                    && isValidString(request.resource.data.displayName, 30)
                    && !('email' in request.resource.data);
      allow delete: if isOwner(uid);
    }

    // ========================================
    // plans コレクション
    // ========================================
    match /plans/{planId} {
      // 読み取り: 自分のプラン OR isPublic=trueの公開プラン
      allow read: if isOwner(resource.data.ownerId)
                  || resource.data.isPublic == true;

      // 作成: 認証済み + 自分がオーナー + サイズ制限 + 必須フィールド
      allow create: if isAuthenticated()
                    && request.resource.data.ownerId == request.auth.uid
                    && isValidString(request.resource.data.title, 100)
                    && request.resource.data.contentId is string
                    && request.resource.data.isPublic is bool
                    && request.resource.data.data is map
                    && request.resource.data.version == 1
                    // data フィールドのサイズ上限（約100KB相当）
                    && request.resource.data.data.keys().size() <= 15;

      // 更新: 自分のプランのみ + ownerIdの変更禁止
      allow update: if isOwner(resource.data.ownerId)
                    && request.resource.data.ownerId == resource.data.ownerId  // オーナー変更禁止
                    && isValidString(request.resource.data.title, 100)
                    && request.resource.data.version == resource.data.version + 1;  // 楽観的ロック

      // 削除: 自分のプランのみ
      allow delete: if isOwner(resource.data.ownerId);
    }

    // ========================================
    // sharedPlanMeta コレクション
    // ========================================
    match /sharedPlanMeta/{shareId} {
      // 誰でも読み取り可能（共有URLの解決に必要）
      allow read: if true;

      // 書き込み: プラン所有者のみ
      allow create: if isAuthenticated()
                    && request.resource.data.ownerId == request.auth.uid;
      allow update: if isOwner(resource.data.ownerId);
      allow delete: if isOwner(resource.data.ownerId);
    }

    // ========================================
    // userPlanCounts コレクション
    // ========================================
    match /userPlanCounts/{uid} {
      allow read: if isOwner(uid);

      // 作成: 初回のみ（total=0で初期化）
      allow create: if isOwner(uid)
                    && request.resource.data.total == 0;

      // 更新: 自分のカウンターのみ + 上限チェック
      allow update: if isOwner(uid)
                    && request.resource.data.total <= 50
                    && request.resource.data.total >= 0;
                    // byContent の各値は Cloud Functions で検証する方が確実

      allow delete: if false;  // カウンターは直接削除不可
    }

    // ========================================
    // その他すべてのパスを拒否
    // ========================================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### セキュリティルールの補足

**プラン数上限の強制方法：**

| 方式 | メリット | デメリット | 採用 |
|------|---------|-----------|------|
| クライアント側のみ | 実装が簡単 | バイパス可能 | x |
| セキュリティルール + カウンター | バイパス不可、低コスト | カウンターの整合性管理が必要 | **採用** |
| Cloud Functions | 最も堅牢 | コールドスタート遅延、コスト増 | 将来の強化用 |

**推奨：** セキュリティルール + カウンタードキュメント方式を基本とし、カウンターの整合性修復用にCloud Functions（定期バッチ）を後から追加する。

**管理者アクセス：**
現時点では管理者UIは不要。Firebase Consoleから直接操作する。将来的に管理画面が必要になった場合は、Custom Claimsで `admin: true` を付与し、セキュリティルールで `request.auth.token.admin == true` を検証する。

---

## 3. 認証セキュリティ

### Firebase Authが保存する情報

Firebase Authは内部的に以下を保持する（Firestoreとは別のシステム）：
- **UID**（一意識別子）
- **メールアドレス**（Googleログイン時に自動取得）
- **表示名**（Googleのプロフィール名）
- **プロフィール写真URL**
- **プロバイダ情報**（google.com, discord等）
- **最終ログイン日時**
- **アカウント作成日時**

### Firestoreへの情報漏洩防止

```
■ 漏洩防止の3層防御

1層: Firestoreにメールアドレスを保存しない
   → usersドキュメントにemailフィールドを含めない
   → セキュリティルールでemailフィールドの書き込みを明示的に拒否

2層: usersドキュメントは本人しか読めない
   → 他ユーザーのプロファイルは一切参照不可
   → 共有プランのownerDisplayNameはplansドキュメントに非正規化

3層: 表示名はユーザーが自由に設定できる
   → Googleの本名をそのまま使わず、ニックネームを設定させるUI
   → 初回ログイン時に表示名設定画面を表示
```

### アカウント削除時のデータクリーンアップ

Firebase Authの`beforeUserDeleted`拡張（または`onDeleteUser` Cloud Function）で以下を実行：

```
1. plans コレクションから ownerId == uid の全ドキュメントを削除
2. sharedPlanMeta コレクションから ownerId == uid の全ドキュメントを削除
3. userPlanCounts/{uid} を削除
4. users/{uid} を削除
5. Firebase Storage のアーカイブデータを削除
```

**注意：** Cloud Functionsなしでこれを実現するのは困難。最低限、`firebase-extensions/delete-user-data`拡張を導入するか、Blaze プランに移行後にCloud Functionを実装する。Sparkプランでは手動削除フローとして、クライアント側で削除処理を行い、Firebase Authアカウント削除前にFirestoreデータを削除する方式を取る。

---

## 4. レート制限・DDoS対策

### 無料枠の防御策

```
Sparkプラン上限:
- Firestore読み取り: 50,000回/日
- Firestore書き込み: 20,000回/日
- Firestore削除: 20,000回/日
- ストレージ: 1GB
- ネットワーク: 10GB/月
```

### 多層防御設計

```
■ 第1層: App Check（推奨、最優先で導入）
  - reCAPTCHA Enterprise または reCAPTCHA v3 と統合
  - 正規アプリからのリクエストのみFirestoreアクセスを許可
  - ボットや不正クライアントからの直接APIアクセスを遮断
  - Sparkプランでも利用可能

■ 第2層: セキュリティルールによるデータ量制限
  - 1ドキュメントあたりのフィールド数上限
  - 文字列長の上限
  - 1ユーザーのプラン数上限（50件）

■ 第3層: クライアント側レート制限
  - 保存操作: 最低5秒のデバウンス
  - プラン作成: 1分に1回まで
  - 共有URL生成: 1分に3回まで

■ 第4層: Firestore使用量モニタリング
  - Firebase Consoleの使用量アラートを設定
  - 日次読み取りが40,000回を超えたらメール通知
  - 異常を検知したらメンテナンスモードに切り替え
```

### 共有URLの濫用防止

```
対策:
1. shareIdは推測困難なランダム文字列（nanoid 10文字 = 64^10 通り）
2. sharedPlanMetaの読み取りは軽量（数百バイト）
3. プランフルデータの読み取りはユーザーアクション（ボタンクリック）時のみ
4. クライアント側で共有プランアクセスにもデバウンスを適用
5. 将来的にCloudflare等のCDNを前段に置く場合、WAFルールで保護可能
```

---

## 5. プライバシー

### GDPRおよびプライバシー観点

```
■ データ最小化原則（GDPR第5条1項c）
  - Firestoreに保存するのは表示名とアバターURLのみ
  - メールアドレス・本名・住所等は一切保存しない
  - Firebase Auth内のメールアドレスは認証目的のみに使用

■ ユーザーの権利（GDPR第15-20条）
  - アクセス権: ユーザーは自分のすべてのデータをアプリ内で確認可能
  - 削除権: アカウント削除機能を提供（上記クリーンアップ処理）
  - データポータビリティ: プランデータのJSON形式エクスポート機能を提供

■ プライバシーポリシーに記載すべき内容
  - 収集する情報: Firebase Auth経由の認証情報、アプリ内で作成したプランデータ
  - 使用目的: ユーザー認証、プランの保存・共有
  - 第三者提供: なし（Firebase/Googleのインフラ利用は記載）
  - 保持期間: アカウント削除時に全データ削除
  - Cookie: Firebase AuthのセッショントークンのみCookieとは記載不要（実際にはIndexedDB）
```

### メールアドレスの取り扱い

```
■ 設計方針: Firestoreからメールアドレスを完全に排除

理由:
1. セキュリティルールの設定ミス → メールアドレス漏洩のリスク
2. Firestoreバックアップの管理 → 平文メールアドレスの管理負荷
3. アプリ機能にメールアドレスは不要 → 保存する理由がない

実装:
- Firebase Auth SDK経由でのみ取得（currentUser.email）
- Firestoreのusersドキュメントにはemailフィールドを含めない
- セキュリティルールでemailフィールドの書き込みを拒否
```

---

## 6. スケーラビリティ

### 読み取り量試算

```
■ シナリオ: 同時アクセス1,000人（レイドパッチ初日）

ユーザーあたりの1セッション読み取り:
  - 自分のプロファイル読み取り:           1回
  - 自分のプラン一覧取得:                1回（1クエリで最大50件）
  - プラン詳細の読み取り:                3回（セッション中に3プラン操作想定）
  - userPlanCounts読み取り:              1回
  - 共有プラン閲覧（他人のプランを見る）:  2回（meta + full data）
  合計: 約8回/セッション

1日の総読み取り（ユーザー滞在時間考慮）:
  - 1セッション: 8回
  - 1日2セッション平均: 16回/人/日
  - DAU 1,000人: 16,000回/日 → 無料枠50,000回の32%
  - DAU 2,500人: 40,000回/日 → 無料枠の80%（警告ライン）
  - DAU 3,000人: 48,000回/日 → 無料枠の96%（危険）
```

### 無料枠でサポートできるユーザー数

```
■ 読み取り制限（50,000回/日）がボトルネック

保守的見積もり（キャッシュなし）:
  - DAU 2,000人程度が安全圏

キャッシュ最適化後:
  - ローカルキャッシュ+Firestoreオフライン永続化で読み取りを50%削減
  - DAU 4,000〜5,000人まで拡大可能

書き込み制限（20,000回/日）:
  - 1人あたり1日5回書き込み想定 → 4,000人まで
  - デバウンス+バッチ書き込みで → 8,000人まで

■ 結論: 無料枠で安定運用できるのはDAU 2,000〜3,000人
  FF14エンドコンテンツ勢の想定規模（数千人）ではギリギリ
```

### Blaze移行の閾値

```
■ 移行すべきタイミング:
  1. DAUが2,000人を安定的に超えた時
  2. 日次読み取りが40,000回を3日連続で超えた時
  3. Cloud Functionsが必要になった時（アーカイブ機能、アカウント削除等）
  4. Firebase Storage を活用する時（アーカイブ機能）

■ Blazeプランのコスト目安:
  - Firestore読み取り: $0.06 / 100,000回
  - Firestore書き込み: $0.18 / 100,000回
  - ストレージ: $0.18 / GB / 月

  DAU 10,000人の場合:
  - 読み取り: 160,000回/日 × 30日 = 4,800,000回/月 → 約$2.88/月
  - 書き込み: 50,000回/日 × 30日 = 1,500,000回/月 → 約$2.70/月
  - ストレージ: 2GB → $0.36/月
  合計: 約$6/月（約900円/月）

  → 非常に安い。ユーザー数が増えてもコスト負担は軽微。
```

---

## 7. コスト最適化

### キャッシュ戦略

```typescript
// ■ 1. Firestoreオフライン永続化を有効化
//   → 一度読んだデータをIndexedDBにキャッシュ
//   → 同じドキュメントの2回目以降の読み取りはローカルから
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});


// ■ 2. Zustandとの統合キャッシュ層
//   → Firestoreからの読み取り結果をZustandストアにも保持
//   → UIの再レンダリング時にFirestoreへの再クエリを防止

// ■ 3. プラン一覧はメタデータだけ取得し、詳細は遅延読み取り
//   → select() でフィールドを限定する機能はFirestore Web SDKにはないが、
//     プラン一覧用に軽量なインデックスドキュメントを別途持つことで代替

// ■ 4. stale-while-revalidate パターン
//   → まずローカルキャッシュを表示、バックグラウンドでFirestoreに確認
//   → ユーザー体験を損なわずに最新データを取得
```

### バッチ書き込みの活用

```typescript
import { writeBatch, doc, increment, serverTimestamp } from 'firebase/firestore';

// プラン作成時のバッチ書き込み例
async function createPlan(plan: Omit<FirestorePlan, 'createdAt' | 'updatedAt'>) {
  const batch = writeBatch(db);
  const planRef = doc(collection(db, 'plans'));
  const countRef = doc(db, 'userPlanCounts', plan.ownerId);

  // 1. プランドキュメント作成
  batch.set(planRef, {
    ...plan,
    version: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. カウンター更新（アトミックに実行）
  batch.update(countRef, {
    total: increment(1),
    [`byContent.${plan.contentId}`]: increment(1),
    updatedAt: serverTimestamp(),
  });

  // 3. 共有メタデータ（isPublicの場合）
  if (plan.isPublic && plan.shareId) {
    const metaRef = doc(db, 'sharedPlanMeta', plan.shareId);
    batch.set(metaRef, {
      planId: planRef.id,
      ownerId: plan.ownerId,
      ownerDisplayName: plan.ownerDisplayName,
      title: plan.title,
      contentId: plan.contentId,
      createdAt: serverTimestamp(),
      isActive: true,
    });
  }

  await batch.commit();
  return planRef.id;
}
```

### リアルタイムリスナーの設計指針

```
■ リアルタイムリスナー（onSnapshot）を使うべき場所:
  - なし（現時点では不要）

■ リアルタイムリスナーを使うべきでない場所:
  - プラン一覧の取得 → getDocs() で1回取得
  - プラン詳細の取得 → getDoc() で1回取得
  - 共有プランの閲覧 → getDoc() で1回取得

■ 理由:
  - LoPoは協調編集ツールではない（1人が1つのプランを編集する）
  - リアルタイムリスナーは接続中ずっとリソースを消費する
  - 保存は明示的なユーザー操作（保存ボタン）で行うため、リスナー不要
  - 将来的にチーム編集機能を追加する場合のみ、対象プランにリスナーを設定

■ 例外的にリスナーが有効なケース（将来）:
  - 共有プランのuseCount表示（リアルタイムでカウント増加を見せたい場合）
  - → ただしコスト的に見合わないので、ページリロード時に再取得で十分
```

---

## 8. 推奨設定・移行チェックリスト

### Firebase プロジェクト設定

```
□ Firebase App Checkを有効化（reCAPTCHA v3）
□ Firestoreのロケーションを asia-northeast1（東京）に設定
□ Firestore使用量アラートを設定（40,000読み取り/日で通知）
□ 不要なFirebaseサービスを無効化（Realtime Database等）
□ Authorized domainsにデプロイ先ドメインのみ登録
□ Google Analyticsは無効化（プライバシー配慮、必要になったら有効化）
```

### 段階的な導入ロードマップ

```
Phase 1: 認証 + プラン保存（Sparkプラン）
  - Google認証の導入
  - Firestoreへのプラン保存/読み取り
  - ローカルストレージからの移行機能
  - セキュリティルール適用
  - App Check導入

Phase 2: 共有機能（Sparkプラン）
  - shareId生成
  - 共有URL発行
  - sharedPlanMetaの管理
  - 共有プランのコピー機能

Phase 3: アーカイブ・管理機能（Blazeプラン移行後）
  - Cloud Functions導入
  - 90日アーカイブ処理（定期バッチ）
  - アカウント削除時のクリーンアップ
  - Discord/X認証追加

Phase 4: スケーリング（Blazeプラン）
  - 使用量に応じた自動スケール（Blazeの従量課金）
  - Cloudflare CDN等の検討
  - 探索機能（人気プラン一覧）の追加
```

---

## 付録: TypeScript型定義

以下は、既存の `src/types/index.ts` の `SavedPlan` / `PlanData` を拡張するFirestore用の型定義。

```typescript
// src/types/firebase.ts

import type { Timestamp } from 'firebase/firestore';
import type { PlanData } from './index';

// ========================================
// Firestoreドキュメント型
// ========================================

/** users/{uid} */
export interface FirestoreUser {
  displayName: string;
  avatarUrl: string | null;
  provider: 'google' | 'discord' | 'twitter';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings: {
    language: 'ja' | 'en';
    defaultLevel: number;
  };
}

/** plans/{planId} */
export interface FirestorePlan {
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  isPublic: boolean;
  shareId: string | null;
  copyCount: number;
  useCount: number;
  data: PlanData;
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
}

/** sharedPlanMeta/{shareId} */
export interface FirestoreSharedPlanMeta {
  planId: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  createdAt: Timestamp;
  isActive: boolean;
}

/** userPlanCounts/{uid} */
export interface FirestoreUserPlanCounts {
  total: number;
  byContent: Record<string, number>;
  updatedAt: Timestamp;
}

// ========================================
// クライアント側で使う変換後の型
// ========================================

/** Firestoreから取得後、Timestamp → number に変換した型 */
export interface ClientPlan {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  isPublic: boolean;
  shareId: string | null;
  copyCount: number;
  useCount: number;
  data: PlanData;
  version: number;
  createdAt: number;  // ミリ秒タイムスタンプ
  updatedAt: number;
  archivedAt: number | null;
}

/** プラン一覧表示用の軽量型（dataフィールドを除外） */
export interface PlanListItem {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  title: string;
  contentId: string;
  isPublic: boolean;
  shareId: string | null;
  copyCount: number;
  updatedAt: number;
}

// ========================================
// 定数
// ========================================

export const PLAN_LIMITS = {
  /** 1ユーザーの最大プラン数 */
  MAX_TOTAL_PLANS: 50,
  /** 1コンテンツあたりの最大プラン数 */
  MAX_PLANS_PER_CONTENT: 5,
  /** プランタイトルの最大文字数 */
  MAX_TITLE_LENGTH: 100,
  /** 表示名の最大文字数 */
  MAX_DISPLAY_NAME_LENGTH: 30,
  /** 共有IDの長さ */
  SHARE_ID_LENGTH: 10,
  /** プラン保存のデバウンス間隔（ミリ秒） */
  SAVE_DEBOUNCE_MS: 5000,
  /** アーカイブまでの日数 */
  ARCHIVE_AFTER_DAYS: 90,
} as const;
```
