# 管理基盤・マスターデータFirestore移行 設計書

> **作成日**: 2026-03-28（第27セッション）
> **ステータス**: 承認済み・実装待ち
> **スコープ**: LoPo全体（軽減プランナー + 将来のハウジングツアー）

---

## 1. 背景と目的

### 1.1 現状の問題

LoPo（FF14軽減プランナー）のゲームデータは全て静的ファイルとしてアプリケーションにバンドルされている。

| データ | ファイル | 件数 |
|--------|----------|------|
| コンテンツ定義（ボス） | `src/data/contents.json` | 63件 |
| テンプレート（タイムライン） | `src/data/templates/*.json` | 25ファイル |
| ジョブ定義 | `src/data/mockData.ts` | 21ジョブ |
| 軽減スキル | `src/data/mockData.ts` | 97スキル |
| スキル表示順 | `src/data/mockData.ts` | 96件 |
| ステータス係数 | `src/data/defaultStats.ts` | 4レベル×複数パッチ |
| レベル補正値 | `src/data/levelModifiers.ts` | 4レベル |
| スキルアイコン | `public/icons/` | 127枚PNG（計2.1MB） |
| コンテンツグルーピング | `src/data/contentRegistry.ts` | ハードコードされたシリーズ分類ロジック |
| DC/サーバー/表記揺れ | `src/data/masterData.ts` | 5リージョン・32サーバー・5ハウジングエリア |
| カテゴリ/レベルラベル | `src/data/contentRegistry.ts` | ハードコード |

**問題点:**
- データの追加・変更のたびにコード変更→ビルド→デプロイが必要
- 管理者（非エンジニア）がブラウザから管理できない
- FF14は3〜4ヶ月ごとに新コンテンツが来る。新ジョブ追加は拡張ごと（約2年周期）
- スキル効果の変更はパッチごと（約3ヶ月周期）に発生しうる
- 将来のハウジングツアーアプリとの共有データ（DC/サーバー/タグ）も静的ファイル依存

### 1.2 目的

**「FF14のコンテンツ更新に非エンジニアがブラウザだけで対応できる管理基盤」を構築する。**

具体的には:
1. 全てのゲームデータをFirestoreに移行し、管理画面から編集可能にする
2. FFLogsインポートと人気プランから自動でテンプレートを生成・更新する仕組みを作る
3. セキュリティ（App Check、レート制限、監査ログ）を確保する
4. パフォーマンスを現在以上に保つ（操作中のFirestoreアクセスゼロ）
5. ハウジングツアーアプリとのデータ共有基盤を整える

---

## 2. アーキテクチャ概要

### 2.1 データフロー（移行後）

```
【管理者の操作】
  ブラウザ → /admin 管理画面 → Vercel API（認証+バリデーション）→ Firestore更新
                                                                    ↓
                                                        /master/config のバージョン番号を+1
                                                                    ↓
                                                        Discord Webhook で管理者に通知

【ユーザーのアプリ起動】
  アプリ起動 → /master/config のバージョン番号を確認（Firestore 1回読み取り）
    → バージョンが同じ → localStorageキャッシュを使用（Firestoreアクセス0回）
    → バージョンが変わった → 変更されたデータだけ再取得 → localStorageに保存
    → 以降の操作は全てメモリ内（Firestoreアクセス0回・120fps操作感を維持）

【ローカル開発】
  npm run dev → 本番Firestoreに読み取り専用で接続
    → 管理画面で追加したデータもローカルで見える
    → ネットに繋がらないとき → 静的ファイル（src/data/）にフォールバック
```

### 2.2 Firestoreコレクション設計

**重要: マスターデータは種類ごとに1ドキュメントにまとめる（読み取り回数の最適化）**

スキル97件を個別ドキュメントにすると DAU 3,000 × 97 = 291,000回/日 → 無料枠50,000を超過。
1ドキュメントにまとめれば DAU 3,000 × 1 = 3,000回/日 → 無料枠の6%。

```
/master/config                    ← アプリ設定・バージョン管理
  {
    dataVersion: number,          // データ更新のたびに+1
    featureFlags: {               // 機能フラグ
      useFirestore: boolean,      // Firestore ↔ 静的ファイル切り替え
    },
    categoryLabels: {             // カテゴリラベル（ja/en）
      savage: { ja: '零式', en: 'Savage' },
      ultimate: { ja: '絶', en: 'Ultimate' },
      dungeon: { ja: 'ダンジョン', en: 'Dungeon' },
      raid: { ja: 'レイド', en: 'Raid' },
      custom: { ja: 'その他', en: 'Misc' },
    },
    levelLabels: {                // レベルラベル（ja/en）
      100: { ja: 'Lv100 (黄金)', en: 'Lv100 (Dawntrail)' },
      90:  { ja: 'Lv90 (暁月)', en: 'Lv90 (Endwalker)' },
      ...
    },
  }

/master/contents                  ← コンテンツ定義（現 contents.json + contentRegistry.ts）
  {
    items: [                      // 全コンテンツの配列
      {
        id: 'm1s',
        category: 'savage',
        level: 100,
        patch: '7.05',
        name: { ja: '至天の座アルカディア零式：ライトヘビー級1', en: 'AAC Light-heavyweight M1 (Savage)' },
        shortName: { ja: 'M1S', en: 'M1S' },
        seriesId: 'aac_lhw',     // ★ グルーピングをデータで持つ（コードのパース不要に）
        order: 1,                 // シリーズ内の表示順
        fflogsEncounterId: 93,
        hasCheckpoint: false,
      },
      ...
    ],
    series: [                     // シリーズ定義
      {
        id: 'aac_lhw',
        category: 'savage',
        level: 100,
        name: { ja: '至天の座アルカディア零式 ライトヘビー級', en: 'AAC Light-heavyweight (Savage)' },
        projectLabel: { ja: '至天の座アルカディア零式', en: 'AAC' },
        order: 1,
      },
      ...
    ],
  }

/master/skills                    ← ジョブ・スキルデータ（現 mockData.ts）
  {
    jobs: [                       // 全ジョブの配列
      {
        id: 'pld',
        name: { ja: 'ナイト', en: 'Paladin' },
        role: 'tank',
        icon: '/icons/Paladin.png',  // アイコンパス（Firebase Storage URL or Vercelプロキシ）
      },
      ...
    ],
    mitigations: [                // 全スキルの配列
      {
        id: 'holy_sheltron',
        jobId: 'pld',
        name: { ja: 'ホーリーシェルトロン', en: 'Holy Sheltron' },
        icon: '/icons/HolySheltron.png',
        recast: 5,
        duration: 8,
        type: 'all',
        value: 15,
        burstValue: 5,
        burstDuration: 4,
        isShield: true,
        shieldPotency: 1000,
        valueType: 'potency',
        scope: 'self',
        minLevel: 82,
        family: 'tank_short',
        // ... その他全フィールド（types/index.ts の Mitigation インターフェース準拠）
      },
      ...
    ],
    displayOrder: [               // 表示順（スキルIDの配列）
      'reprisal_base', 'reprisal', 'divine_veil', ...
    ],
  }

/master/stats                     ← ステータス・レベル補正（現 defaultStats.ts + levelModifiers.ts）
  {
    levelModifiers: {             // レベル補正値
      100: { level: 100, main: 440, sub: 420, div: 2780, hp: 3000 },
      90:  { level: 90,  main: 390, sub: 400, div: 1900, hp: 3000 },
      80:  { level: 80,  main: 340, sub: 380, div: 1300, hp: 3000 },
      70:  { level: 70,  main: 292, sub: 364, div: 900,  hp: 3000 },
    },
    patchStats: {                 // パッチ別デフォルトステータス
      '7.40': {
        tank: { hp: 296194, mainStat: 6217, det: 2311, wd: 146 },
        other: { hp: 186846, mainStat: 6317, det: 2311, wd: 146 },
      },
      '7.20': { ... },
      ...
    },
    defaultStatsByLevel: {        // レベル別デフォルト（パッチ不明時のフォールバック）
      100: '7.40',
      90: '6.40',
      80: '5.40',
      70: '4.40',
    },
  }

/master/servers                   ← DC/サーバー/表記揺れ（現 masterData.ts・ハウジングと共有）
  {
    datacenters: {
      'Elemental': {
        region: 'JP',
        aliases: ['エレ', 'エレメンタル', 'Elemental', 'Ele', 'Elem'],
        servers: {
          'Aegis': ['イージス', 'Aegis', 'Aeg'],
          'Atomos': ['アトモス', 'Atomos', 'Ato'],
          ...
        },
      },
      ...
    },
    housingAreas: {
      'Mist': {
        name_jp: 'ミスト・ヴィレッジ',
        apartment_name: 'トビー・ミスト・アパートメント',
        aliases: ['ミスト', 'Mist', 'みすと'],
      },
      ...
    },
    housingSizes: {
      'S': { name_jp: 'S', aliases: ['S', 'Sサイズ', '小'] },
      ...
    },
    tags: {
      taste: [
        { id: 'modern', name: { ja: 'モダン', en: 'Modern' } },
        { id: 'japanese', name: { ja: '和風', en: 'Japanese' } },
        ...
      ],
      seasonal: [
        { id: 'spring', name: { ja: '春・桜', en: 'Spring / Cherry Blossom' } },
        ...
      ],
    },
  }

/templates/{contentId}            ← タイムラインテンプレート（現 templates/*.json）
  {
    contentId: 'm1s',
    source: 'fflogs_import' | 'popular_plan' | 'admin_manual',
    timelineEvents: TimelineEvent[],
    phases: Phase[],
    lockedAt: Timestamp | null,   // 安定フェーズ移行日時（null = まだ発見フェーズ）
    lastUpdatedAt: Timestamp,
    lastUpdatedBy: string,        // 'auto' | 管理者UID
    candidateShareId: string | null, // 人気プラン昇格時の元共有プランID
  }

/template_backups/{contentId}     ← テンプレートの前バージョン自動バックアップ
  {
    contentId: string,
    previousData: { ... },        // 更新前のテンプレートデータ丸ごと
    replacedAt: Timestamp,
    replacedBy: string,
  }

/master_backups/{backupId}        ← マスターデータの前バージョン自動バックアップ
  {
    documentPath: string,         // 例: '/master/skills'
    previousData: { ... },        // 更新前のデータ丸ごと
    replacedAt: Timestamp,
    replacedBy: string,           // 管理者UID
  }

/admin_logs/{logId}               ← 監査ログ
  {
    action: 'create' | 'update' | 'delete',
    target: string,               // 例: 'skills.holy_sheltron', 'contents.m13s'
    adminUid: string,
    changes: { before: any, after: any },
    timestamp: Timestamp,
  }

// 既存コレクション（変更なし）
/users/{uid}                      ← ユーザープロファイル
/plans/{planId}                   ← ユーザーのプラン
/shared_plans/{shareId}           ← 共有プラン
/userPlanCounts/{uid}             ← プラン件数カウンター
```

### 2.3 Firestoreコスト見積もり

**読み取り（無料枠: 50,000回/日）**

| 操作 | 回数/日 | 計算根拠 |
|------|---------|---------|
| バージョン確認 | 3,000 | DAU 3,000 × 1回 |
| データ更新時の再取得 | 500 | 更新日のみ。DAUの一部 × 5ドキュメント |
| プラン読み込み | 15,000 | ログインユーザー × 平均5プラン |
| 共有プラン閲覧 | 5,000 | APIキャッシュあり（15分TTL） |
| **合計（通常日）** | **〜23,500** | **無料枠の47%** |
| **合計（更新日ピーク）** | **〜38,500** | **無料枠の77%** |

**書き込み（無料枠: 20,000回/日）**
- 管理操作: 数十回/日（管理者1人）
- テンプレート自動更新: 最大12回/日（零式4層 × 3回）
- ユーザーのプラン保存: 既存（変化なし）
- → **無料枠に十分収まる**

**Firebase Storage（無料枠: 5GB保存・1GB/日ダウンロード）**
- アイコン保存: 2.1MB / 5GB = 0.04%
- ダウンロード: Vercelエッジキャッシュ経由なので実質数MB/日

---

## 3. キャッシュ戦略

### 3.1 基本方針

**操作中にFirestoreへアクセスしない。全データはメモリ内で完結する。**

### 3.2 キャッシュフロー

```typescript
// アプリ起動時の処理（擬似コード）
async function initializeAppData() {
  // 1. localStorageからキャッシュを復元
  const cache = loadFromLocalStorage('lopo-master-data');

  // 2. Firestoreのバージョン番号を確認（1回だけ読み取り）
  const config = await getDoc(doc(db, 'master', 'config'));
  const remoteVersion = config.data().dataVersion;

  if (cache && cache.version === remoteVersion) {
    // 3a. バージョンが同じ → キャッシュをそのまま使用（Firestoreアクセス0回）
    return cache.data;
  }

  // 3b. バージョンが違う → 変更されたデータを再取得
  const [contents, skills, stats, servers] = await Promise.all([
    getDoc(doc(db, 'master', 'contents')),
    getDoc(doc(db, 'master', 'skills')),
    getDoc(doc(db, 'master', 'stats')),
    getDoc(doc(db, 'master', 'servers')),
  ]);

  // 4. localStorageに保存（次回起動用）
  const newCache = { version: remoteVersion, data: { contents, skills, stats, servers } };
  saveToLocalStorage('lopo-master-data', newCache);

  return newCache.data;
}
```

### 3.3 localStorage容量見積もり

| データ | 推定サイズ |
|--------|-----------|
| コンテンツ定義（63件+シリーズ） | 約20KB |
| スキルデータ（97スキル+21ジョブ） | 約80KB |
| ステータス/レベル補正 | 約5KB |
| DC/サーバー/表記揺れ | 約15KB |
| **合計** | **約120KB** |

localStorage上限5〜10MB → **1.2〜2.4%しか使わない。余裕。**

テンプレートは使用時にオンデマンドで取得・キャッシュ（1件50〜100KB）。

### 3.4 オフライン対応

- localStorageにキャッシュ済みデータがあれば、Firestore不到達でもアプリは起動・操作可能
- PWA（ホーム画面追加）時もService Worker + localStorageキャッシュで完全動作
- 初回アクセスのみネットワーク必須（キャッシュがない場合）

### 3.5 開発環境

```
本番: VITE_USE_FIRESTORE=true（デフォルト）→ Firestoreから読み取り
ローカル: VITE_USE_FIRESTORE=true（デフォルト）→ 本番Firestoreに読み取り専用で接続
          VITE_USE_FIRESTORE=false（任意）→ 静的ファイルにフォールバック（オフライン開発用）
```

ローカル開発でも管理画面で追加した最新データが見える。

---

## 4. 管理画面

### 4.1 アクセス制御

- **URL**: `/admin`（同一アプリ内ルート）
- **認証**: Firebase Custom Claims（`role: 'admin'`）
  - 管理者はサーバーサイドでのみ設定可能（UIからの昇格不可）
  - 初回設定: Vercel API経由でUID指定して付与
- **ルートガード**: Custom Claimsに`admin`がないユーザーはリダイレクト
- **Firestoreルール**: `/master/**` と `/templates/**` の書き込みはサーバーサイドAPI経由のみ

### 4.2 管理画面の機能一覧

**コンテンツ管理**
- コンテンツ一覧（検索・フィルター）
- コンテンツ追加（ID、カテゴリ、レベル、パッチ、名前JP/EN、シリーズ、FFLogs ID）
- コンテンツ編集（名前修正、シリーズ変更等）
- コンテンツ削除（紐づくテンプレートの確認あり）
- シリーズ追加/編集/削除

**テンプレート管理**
- テンプレート一覧（コンテンツ別）
- テンプレートプレビュー（タイムラインイベント数、フェーズ数、最終更新日）
- テンプレート手動アップロード（JSONファイル）
- テンプレートの手動差し替え
- テンプレートのロック/アンロック
- 人気プラン昇格候補の確認・承認/却下
- テンプレートの「元に戻す」（前バージョンに復元）

**スキル管理**
- ジョブ一覧 / ジョブ追加 / ジョブ編集
- スキル一覧（ジョブ別フィルター）
- スキル追加（全フィールド入力フォーム）
- スキル編集（値変更、名前修正等）
- スキル削除
- 表示順の並び替え（ドラッグ&ドロップ）
- アイコンアップロード（Firebase Storage → Vercelプロキシ経由で配信）

**ステータス管理**
- レベル補正値の編集
- パッチ別デフォルトステータスの追加/編集
- デフォルトレベル紐付けの変更

**DC/サーバー/表記揺れ管理**（ハウジングと共有）
- DC/サーバーの追加/編集/削除
- 表記揺れ（エイリアス）の追加/削除
- ハウジングエリアの追加/編集
- タグ（テイスト/季節）の追加/編集/削除

**システム**
- 監査ログ閲覧（誰がいつ何を変えたか）
- データの一括エクスポート（JSONバックアップ）
- データの一括インポート（復旧用）

### 4.3 バリデーション

管理画面で保存する前に以下を検証する（サーバーサイドAPIでも二重チェック）:

- **必須フィールドの存在確認**（id, name.ja, name.en 等）
- **ID重複チェック**（既存のコンテンツID/スキルIDとの衝突）
- **数値範囲チェック**（recast > 0, value >= 0 かつ <= 100 等）
- **参照整合性**（スキルのjobIdが存在するジョブか、コンテンツのseriesIdが存在するシリーズか）
- **i18n完全性**（ja/en両方の名前が入力されているか）

### 4.4 バックアップと復元

- **自動バックアップ**: 管理操作で保存するたびに、更新前のデータを `/master_backups/` に自動退避
- **テンプレートバックアップ**: テンプレート更新時に前バージョンを `/template_backups/` に退避
- **「元に戻す」ボタン**: 管理画面から直前のバックアップに1クリックで復元
- **一括エクスポート**: 全マスターデータをJSONとしてダウンロード（手動バックアップ）

### 4.5 Discord Webhook通知

管理者のDiscordに以下のイベントを通知:
- テンプレート候補が自動登録された
- 人気プランがテンプレート昇格の閾値に達した
- App Checkで不正リクエストがブロックされた（大量発生時のみ）
- 将来: ハウジング通報が一定数溜まった

---

## 5. テンプレート自動生成・更新システム

### 5.1 2段階の仕組み

**段階A: FFLogsインポートからの初期テンプレート（発見フェーズ）**

新しいコンテンツのテンプレートがFirestoreに存在しない場合、ユーザーのFFLogsインポートから自動生成する。

**既知の制約:** FFLogs APIでは英語主言語のログからJP技名が取得できないケースがある（既知バグ: TODO.md参照）。そのためFFLogsインポートから自動生成されたテンプレートは片方の言語しか入っていない可能性がある。管理者が管理画面で言語を補完してから公開品質になる。人気プランからの昇格（段階B）の方がユーザーが編集済みで両言語入っているため品質が高い。

```
ユーザーがFFLogsインポート実行
  ↓
システムがcontentIdを検出
  ↓
/templates/{contentId} がFirestoreに存在するか確認
  ↓
【存在しない場合】
  品質チェック:
    ✅ クリアログである（エンレージ付近までイベントがある）
    ✅ 死亡0回
    ✅ イベント数が閾値以上（コンテンツの種類に応じて設定）
  → 全て通過 → テンプレートとして自動登録
  → 1つでも失敗 → 登録しない（ユーザーのプランとしては作成される）

【既に存在する場合】
  発見フェーズ中（lockedAt === null かつ 登録から14日以内）:
    新しいログのイベント数 > 既存テンプレートのイベント数
    → より良いテンプレートとして差し替え
  安定フェーズ（lockedAt !== null）:
    → 自動更新しない
```

**段階B: 人気プランからの昇格（成熟後）**

```
共有プランのcopyCountが閾値に達する
  ↓
テンプレート昇格候補としてマーク
  ↓
Discord Webhookで管理者に通知
  ↓
管理者が管理画面で確認
  ↓
【承認】→ そのプランのtimelineEvents（技名・タイミング・ダメージ）を抽出
          ジョブ構成・軽減配置は含めない
          → テンプレートとして登録/差し替え
【却下】→ 何もしない
```

### 5.2 テンプレート更新ルール

| フェーズ | 期間 | 自動更新 | 手動更新 |
|---------|------|---------|---------|
| **発見フェーズ** | コンテンツ実装〜14日 | より良いFFLogsログで差し替え可 | 管理者はいつでも可 |
| **安定フェーズ** | 14日目〜 | 自動更新停止（ロック） | 管理者はいつでも可 |
| **人気プラン昇格** | いつでも | copyCount 20以上 かつ 既存の2倍以上 → 候補通知 | 管理者承認で反映 |

- copyCountの閾値（20）と倍率（2倍）は `/master/config` で管理画面から調整可能
- 人気プランの昇格は管理者承認制（自動反映しない）
- テンプレート更新時は前バージョンを自動バックアップ

### 5.3 copyCount水増し防止

- copyCountの増加はログインユーザーのみ
- 1ユーザー・1コンテンツあたり1回のみカウント（重複クリック無効）
- 実装: `/shared_plans/{shareId}/copiedBy/{uid}` サブコレクションで管理

---

## 6. セキュリティ

### 6.1 防御の3層構造

```
Layer 1: Firebase App Check
  → 本物のLoPoアプリからのリクエストか検証（reCAPTCHA v3連携）
  → スクリプト・偽アプリからのAPIアクセスをブロック
  → 全Vercel APIエンドポイントに適用

Layer 2: Firebase Auth + ログイン必須
  → FFLogsインポートはログイン必須（悪意ある利用を追跡可能）
  → 管理画面はAdmin Custom Claims必須
  → 全ての書き込み操作にUID紐付け

Layer 3: BAN機能
  → Firebase Authのアカウント無効化で即座にアクセス遮断
  → 以降のログイン・Firestore読み書き・API呼び出し全てブロック
```

### 6.2 脅威と対策一覧

| 脅威 | 対策 | 実装Phase |
|------|------|----------|
| Firestore読み取り乱用 | App Check + バージョンキャッシュ | Phase 0 |
| Vercel API直接攻撃 | APIレート制限（IPあたり1分10回） | Phase 0 |
| テンプレート汚染（壊れたFFLogsデータ） | 品質チェック + 14日後ロック | Phase 2 |
| 管理者アカウント乗っ取り | Custom Claims（サーバーのみ設定可）+ 監査ログ | Phase 0 |
| copyCount水増し | 1ユーザー1回制限 + ログイン必須 | Phase 2 |
| Firebase Auth乱用（BOT大量登録） | App Check + Google OAuth自体のBOT対策 | Phase 0 |
| 管理者の誤操作 | バリデーション + 自動バックアップ + 復元機能 | Phase 3 |
| XSS攻撃 | Content Security Policy ヘッダー | Phase 0 |

### 6.3 Firestoreセキュリティルール（追加分）

```javascript
// マスターデータ: 誰でも読める・直接書き込み不可（API経由のみ）
match /master/{docId} {
  allow read: if true;
  allow write: if false;  // Vercel APIのfirebase-admin経由でのみ書き込み
}

// テンプレート: 誰でも読める・直接書き込み不可
match /templates/{contentId} {
  allow read: if true;
  allow write: if false;
}

// テンプレートバックアップ: 管理者のみ読める・直接書き込み不可
match /template_backups/{docId} {
  allow read: if request.auth != null && request.auth.token.role == 'admin';
  allow write: if false;
}

// マスターバックアップ: 同上
match /master_backups/{docId} {
  allow read: if request.auth != null && request.auth.token.role == 'admin';
  allow write: if false;
}

// 監査ログ: 管理者のみ読める・直接書き込み不可
match /admin_logs/{logId} {
  allow read: if request.auth != null && request.auth.token.role == 'admin';
  allow write: if false;
}
```

### 6.4 Vercel APIレート制限

```typescript
// 全APIエンドポイントに適用するミドルウェア
// IPあたり: 1分間に10リクエストまで
// 超過時: 429 Too Many Requests を返却
```

---

## 7. アイコン管理

### 7.1 アップロードフロー

```
管理者が管理画面でアイコン画像を選択
  ↓
Firebase Storageにアップロード（/icons/{filename}.png）
  ↓
スキルデータのiconフィールドを更新（Firestoreに保存）
  ↓
ユーザーがアイコンをリクエスト
  ↓
Vercel APIプロキシ → Firebase Storageから取得 → Vercelエッジにキャッシュ（1年間）
  ↓
2回目以降 → Vercelエッジから直接配信（Firebase Storageへのアクセスなし）
```

### 7.2 コスト

- Firebase Storage保存: 2.1MB / 5GB無料枠 = 0.04%
- Firebase Storageダウンロード: Vercelキャッシュ経由なので実質数MB/日（無料枠1GB/日）
- 新しいアイコンが追加されたときだけFirebase Storageにアクセスが発生

---

## 8. プラン複製機能

### 8.1 概要

テンプレート更新に左右されないための安全網。ユーザーが既存のプランをワンクリックで複製できる。

### 8.2 UX

```
サイドバーのプラン名の横:
  ✏️ 鉛筆マーク（名前変更 — 既存機能）
  📋 コピーマーク
    → ホバーでツールチップ表示:
      JA: 「すぐ下にコピーを作成」
      EN: 「Create a copy just below」
    → クリック → 直下に「元の名前 (2)」として即座に複製
    → モーダルなし、ワンクリック
```

### 8.3 内部動作

1. 現在のプランのデータ（`timelineEvents`, `timelineMitigations`, `phases`, `partyMembers` 等）を丸ごとコピー
2. 新しいplanIdを生成
3. タイトルに連番サフィックスを付与（「M1S (2)」等）
4. 同じcontentId/category配下に追加
5. プラン件数制限（1コンテンツ5件/合計50件）のチェックは通常の新規作成と同じ

---

## 9. GoogleログインPWA対応

### 9.1 概要

PWA（ホーム画面から起動）時のGoogleログインで、ポップアップがブロックされる問題を修正。

### 9.2 実装方針

```typescript
// PWAモード検出
const isPWA = window.matchMedia('(display-mode: standalone)').matches;

// Googleログイン時の分岐
if (isPWA) {
  // PWA → リダイレクト方式（ポップアップブロック回避）
  await signInWithRedirect(auth, googleProvider);
} else {
  // ブラウザ → ポップアップ方式（従来通り・変更なし）
  await signInWithPopup(auth, googleProvider);
}
```

- **PC版ブラウザ**: 変更なし。ポップアップ方式のまま
- **スマホブラウザ**: 変更なし。ポップアップ方式のまま
- **PWA（ホーム画面から起動）時のみ**: リダイレクト方式に切り替え
- Discord/Twitterは既にリダイレクト方式なので変更不要

---

## 10. 移行対象ファイルと影響範囲

### 10.1 データ消費元の全一覧

**mockData.ts（スキル・ジョブ）→ /master/skills**
影響ファイル（11件）:
- `src/store/useMitigationStore.ts` — ストア初期化、INITIAL_PARTY
- `src/components/CheatSheetView.tsx` — スキル一覧表示
- `src/components/ClearMitigationsPopover.tsx` — 軽減クリア
- `src/components/EventModal.tsx` — ダメージ計算UI
- `src/components/JobPicker.tsx` — ジョブ選択
- `src/components/TimelineRow.tsx` — タイムライン行表示
- `src/components/MitigationSelector.tsx` — 軽減選択
- `src/components/Timeline.tsx` — タイムライン全体
- `src/utils/autoPlanner.ts` — 自動プランナー
- `src/utils/resourceTracker.ts` — リソース計算
- `src/utils/jobMigration.ts` — ジョブ変更時のスキル移行

**contentRegistry.ts（コンテンツ定義）→ /master/contents**
影響ファイル（9件）:
- `src/components/Layout.tsx` — ヘッダーのコンテンツ名表示
- `src/components/Sidebar.tsx` — サイドバーのコンテンツツリー
- `src/components/NewPlanModal.tsx` — 新規プラン作成モーダル
- `src/components/SharePage.tsx` — 共有ページ
- `src/components/PopularPage.tsx` — 人気プラン
- `src/components/ConsolidatedHeader.tsx` — ヘッダー
- `src/components/EventModal.tsx` — イベント編集
- `src/components/JobPicker.tsx` — ジョブ選択
- `src/components/TimelineRow.tsx` — タイムライン行

**defaultStats.ts + levelModifiers.ts → /master/stats**
影響ファイル（6件）:
- `src/store/useMitigationStore.ts` — ストア初期化
- `src/utils/calculator.ts` — 計算エンジン
- `src/components/EventModal.tsx` — ダメージ計算
- `src/components/PartyStatusPopover.tsx` — ステータス表示
- `src/debug_calc.ts` — デバッグ用

**templateLoader.ts → /templates/{contentId}**
影響ファイル（2件）:
- `src/components/NewPlanModal.tsx` — テンプレート読み込み
- `src/components/Sidebar.tsx` — テンプレート読み込み

**masterData.ts → /master/servers**
影響ファイル（確認が必要だが、主にハウジングツアー関連）

### 10.2 移行パターン

全ての消費元で同じパターンを適用する:

```typescript
// 移行前（現在）
import { MITIGATIONS, JOBS } from '../data/mockData';
const mit = MITIGATIONS.find(m => m.id === 'reprisal');

// 移行後
import { useMasterData } from '../hooks/useMasterData';
const { mitigations, jobs } = useMasterData(); // キャッシュからの同期取得
const mit = mitigations.find(m => m.id === 'reprisal');
```

`useMasterData()` フックが:
1. アプリ起動時にFirestoreから取得済みのデータをメモリから返す（同期的）
2. データ未取得時はローディング状態を返す
3. フォールバック: 静的ファイルからのインポート（環境変数制御）

---

## 11. 実装フェーズ

### Phase 0: 安全基盤（セキュリティ・インフラ）

**目的:** 管理画面の認証基盤、セキュリティ対策、独立した小機能

**タスク:**
1. 管理者ロール導入（Firebase Custom Claims）
   - Vercel APIエンドポイント: `/api/admin/set-role` — UIDを指定してadminロールを付与
   - useAuthStoreに `isAdmin` フラグ追加
2. 管理画面の骨組み
   - `/admin` ルート追加（App.tsxにルートガード付きで追加）
   - 管理画面レイアウト（サイドナビ + メインエリア）
   - ダッシュボード（空の状態 → Phase 1以降で中身を追加）
3. Firebase App Check導入
   - reCAPTCHA v3プロバイダー設定
   - Firebase初期化にApp Check追加
   - 全Vercel APIエンドポイントでApp Check検証
4. Vercel APIレート制限ミドルウェア
5. 監査ログ基盤（`/admin_logs` コレクション + 書き込みヘルパー関数）
6. フィーチャーフラグ基盤（`VITE_USE_FIRESTORE` 環境変数）
7. GoogleログインPWA対応（signInWithRedirect分岐）
8. プラン複製機能（サイドバーにコピーボタン追加）

**成果物:** セキュリティ基盤が整い、管理画面の骨組みがある状態。

---

### Phase 1: コンテンツ・テンプレートのFirestore化

**目的:** 新しい零式・絶が来たらブラウザから追加できるようにする

**タスク:**
1. Firestoreコレクション作成
   - `/master/config` — バージョン管理 + ラベル定義
   - `/master/contents` — コンテンツ定義 + シリーズ定義
   - `/templates/{contentId}` — テンプレート
   - `/template_backups/{contentId}` — バックアップ
2. 既存データの初期シーディング
   - `contents.json` → `/master/contents` へ移行（シリーズ定義をデータ化）
   - `templates/*.json` → `/templates/{contentId}` へ移行
   - `contentRegistry.ts` のラベル → `/master/config` へ移行
3. キャッシュ基盤
   - `useMasterData` フック（バージョンチェック + localStorageキャッシュ + メモリ保持）
   - ローディング状態のUI（アプリ起動時のスプラッシュ）
4. `contentRegistry.ts` の書き換え
   - 静的インポートから `useMasterData()` 経由のデータ参照に変更
   - ヘルパー関数（getContentById等）を維持（シグネチャ変更なし）
5. `templateLoader.ts` の書き換え
   - Vite glob → Firestore読み取り + localStorageキャッシュ
6. 管理画面: コンテンツ管理UI
   - コンテンツ一覧/追加/編集/削除
   - シリーズ一覧/追加/編集/削除
7. 管理画面: テンプレート管理UI
   - テンプレートプレビュー/アップロード/削除
   - バックアップからの復元
8. Discord Webhook通知の実装
9. Firestoreセキュリティルール更新
10. 影響を受ける全コンポーネント（9件）の動作確認

**成果物:** 新コンテンツ追加がブラウザだけで完了する状態。

---

### Phase 2: 自動テンプレート + 人気プラン昇格

**目的:** テンプレートが自動で生成・更新され、運用不要で回り続ける仕組み

**タスク:**
1. FFLogsインポート → テンプレート候補自動登録
   - `FFLogsImportModal.tsx` にインポート後のテンプレート登録ロジック追加
   - 品質チェック（クリアログ判定、死亡数、イベント数閾値）
   - `/templates/{contentId}` への書き込み（Vercel API経由）
2. 発見フェーズ/安定フェーズのロジック
   - テンプレート登録から14日後に自動ロック
   - ロック中は自動更新を停止
3. 人気プラン昇格システム
   - copyCount水増し防止（`/shared_plans/{shareId}/copiedBy/{uid}`）
   - 閾値チェック（copyCount 20以上 かつ 既存の2倍）
   - 管理者への通知（Discord Webhook）
   - 管理画面: 昇格候補一覧 → 承認/却下ボタン
4. 管理画面: テンプレートのロック/アンロック操作
5. 管理画面: 昇格閾値の設定変更

**成果物:** 新コンテンツのテンプレートが自動生成され、人気プランから改善される仕組み。

---

### Phase 3: スキル・ステータスのFirestore化

**目的:** 新ジョブ追加・スキル効果変更をブラウザから対応

**タスク:**
1. Firestoreコレクション作成
   - `/master/skills` — ジョブ + スキル + 表示順
   - `/master/stats` — ステータス + レベル補正
   - `/master_backups/{backupId}` — バックアップ
2. 既存データの初期シーディング
   - `mockData.ts` → `/master/skills` へ移行
   - `defaultStats.ts` + `levelModifiers.ts` → `/master/stats` へ移行
3. `useMasterData` フックの拡張（skills, stats データの追加）
4. `useMitigationStore.ts` の書き換え
   - ストア初期化をデータ取得完了後に行うよう変更
   - `INITIAL_PARTY` の構築をデータ取得後に遅延実行
5. 全消費元ファイル（11件+6件）のインポート書き換え
6. 管理画面: スキル管理UI
   - ジョブ一覧/追加/編集
   - スキル一覧/追加/編集/削除
   - 表示順ドラッグ&ドロップ
   - 入力バリデーション（必須項目、数値範囲、ID重複、i18n完全性）
7. 管理画面: ステータス管理UI
   - レベル補正値編集
   - パッチ別ステータス追加/編集
8. 自動バックアップ + 復元機能
9. 管理画面: データ一括エクスポート/インポート
10. 影響を受ける全コンポーネント・ユーティリティの動作確認

**成果物:** ジョブ・スキル・ステータスの全管理がブラウザから完了する状態。

---

### Phase 4: アイコン・共有データ

**目的:** アイコンのブラウザ管理 + ハウジングツアーとのデータ共有基盤

**タスク:**
1. Firebase Storage設定
2. アイコンのFirebase Storage移行（既存127枚）
3. Vercel APIプロキシ実装（エッジキャッシュ1年）
4. 管理画面: アイコンアップロード機能
5. Firestoreコレクション作成
   - `/master/servers` — DC/サーバー/表記揺れ + ハウジングエリア + タグ
6. `masterData.ts` → `/master/servers` への移行
7. 管理画面: DC/サーバー管理UI
8. 管理画面: 表記揺れ（エイリアス）管理UI
9. 管理画面: ハウジングエリア/タグ管理UI

**成果物:** 全データの管理がブラウザから完了。ハウジングツアー開発の土台が整った状態。

---

### Phase 5: ハウジング管理機能の準備

**目的:** ハウジングツアーアプリ開発時に必要な管理機能の事前準備

**タスク:**
1. ハウジングリスティングのモデレーション基盤
2. 通報管理画面
3. 信用スコアシステム基盤
4. ハウジングエリア/タグの管理をPhase 4のUIで運用開始

**成果物:** ハウジングツアーアプリの管理運用基盤。

---

## 12. 既存の静的ファイルの扱い

| ファイル | 移行Phase | 移行後 |
|---------|-----------|--------|
| `src/data/contents.json` | Phase 1 | 開発フォールバック用として残す。本番では使わない |
| `src/data/contents.ts` | Phase 1 | 同上 |
| `src/data/contentRegistry.ts` | Phase 1 | ヘルパー関数は残す（データソースをFirestoreに切り替え） |
| `src/data/templates/*.json` | Phase 1 | Firestore移行後に削除可（バンドルサイズ削減） |
| `src/data/templateLoader.ts` | Phase 1 | Firestore版に書き換え |
| `src/data/mockData.ts` | Phase 3 | 開発フォールバック用として残す |
| `src/data/defaultStats.ts` | Phase 3 | 同上 |
| `src/data/levelModifiers.ts` | Phase 3 | 同上 |
| `public/icons/*.png` | Phase 4 | Firebase Storage移行後も残してよい（Vercelプロキシのフォールバック） |
| `src/data/masterData.ts` | Phase 4 | 開発フォールバック用として残す |

---

## 13. ハウジングツアーとの共有設計

### 13.1 共有するデータ

| データ | Firestoreパス | 軽減表 | ハウジング |
|--------|-------------|--------|-----------|
| ユーザー認証 | Firebase Auth | ✅ | ✅ |
| テーマ設定 | localStorage (zustand persist) | ✅ | ✅ |
| DC/サーバー定義 | `/master/servers` | ❌ | ✅ |
| 表記揺れエイリアス | `/master/servers` | ❌ | ✅ |
| ハウジングエリア定義 | `/master/servers` | ❌ | ✅ |
| タグ定義 | `/master/servers` | ❌ | ✅ |

### 13.2 管理画面の共有

`/admin` ルートは両アプリ共通。サイドナビでセクションを分ける:

```
管理画面
├── ダッシュボード
├── 軽減プランナー
│   ├── コンテンツ管理
│   ├── テンプレート管理
│   ├── スキル管理
│   └── ステータス管理
├── ハウジングツアー（Phase 5〜）
│   ├── リスティング管理
│   ├── 通報管理
│   └── エリア/タグ管理
├── 共通
│   ├── DC/サーバー管理
│   ├── 表記揺れ管理
│   ├── 監査ログ
│   └── データバックアップ
└── 設定
    ├── Discord Webhook
    └── 閾値設定
```

---

## 14. 注意事項・制約

### 14.1 パフォーマンス

- **操作中にFirestoreへアクセスしない**（最重要）
- アプリ起動時のデータ取得は並列化（Promise.all）
- localStorageキャッシュにより2回目以降の起動は瞬時
- パフォーマンス最適化（React.memo / useMemo）は全視覚変更後に実施（確定方針）

### 14.2 Firestoreドキュメントサイズ制限

- 1ドキュメントの上限: 1MB
- スキル97件（約50KB）、コンテンツ63件（約20KB）→ 十分収まる
- テンプレート最大85KB（fru.json）→ 問題なし
- **将来テンプレートが1MBを超える可能性は極めて低い**（Ultimate最長でも85KB）

### 14.3 Firebase無料枠（Sparkプラン）

| リソース | 無料枠 | 推定使用量 | 余裕度 |
|---------|--------|-----------|--------|
| Firestore読み取り | 50,000回/日 | 〜38,500回（ピーク時） | 23% |
| Firestore書き込み | 20,000回/日 | 〜5,000回 | 75% |
| Firebase Storage保存 | 5GB | 2.1MB | 99.96% |
| Firebase Storage DL | 1GB/日 | 数MB（キャッシュ後） | 99%+ |

DAU 5,000人超でBlazeプラン（従量課金）推奨。コスト: 月数百〜数千円程度。

### 14.4 既存のCSSルール（CLAUDE.md準拠）

- 管理画面も白黒ベース（アクセントカラー導入前）
- `backdrop-filter` は `--tw-backdrop-blur` 変数パターンを使用
- AIグラデーション禁止、shadcnデフォルトそのまま禁止

### 14.5 多言語対応

- 管理画面のUIテキストもi18nキー経由（ハードコーディング禁止）
- ゲームデータの名前（スキル名、ボス名等）はFirestoreにja/en両方保存
- UIテキスト（ボタン名等）は従来通り `locales/*.json` で管理

---

## 付録A: 関連ドキュメント

- `docs/TODO.md` — タスク管理・進捗
- `docs/TECH_NOTES.md` — 技術的な落とし穴
- `docs/GRAPL_PROJECT_PLAN.md` — プロジェクト全体ロードマップ
- `docs/Firebase設計書.md` — 既存のFirestore構造
- `docs/housing-tour-planner-requirements.md` — ハウジングツアー要件

## 付録B: 既存のFirestoreコレクション（変更なし）

| コレクション | 用途 |
|-------------|------|
| `/users/{uid}` | ユーザープロファイル |
| `/plans/{planId}` | ユーザーのプラン |
| `/shared_plans/{shareId}` | 共有プラン |
| `/userPlanCounts/{uid}` | プラン件数カウンター |

## 付録C: 新規Vercel APIエンドポイント（予定）

| エンドポイント | メソッド | 認証 | 用途 |
|--------------|--------|------|------|
| `/api/admin/set-role` | POST | サーバーシークレット | 管理者ロール付与 |
| `/api/admin/contents` | GET/POST/PUT/DELETE | Admin | コンテンツCRUD |
| `/api/admin/templates` | GET/POST/PUT/DELETE | Admin | テンプレートCRUD |
| `/api/admin/skills` | GET/POST/PUT/DELETE | Admin | スキルCRUD |
| `/api/admin/stats` | GET/POST/PUT | Admin | ステータスCRUD |
| `/api/admin/servers` | GET/POST/PUT/DELETE | Admin | DC/サーバーCRUD |
| `/api/admin/icons` | POST/DELETE | Admin | アイコンアップロード/削除 |
| `/api/admin/logs` | GET | Admin | 監査ログ閲覧 |
| `/api/admin/export` | GET | Admin | データ一括エクスポート |
| `/api/admin/import` | POST | Admin | データ一括インポート |
| `/api/admin/backup/restore` | POST | Admin | バックアップ復元 |
| `/api/icons/{filename}` | GET | なし | アイコンプロキシ（エッジキャッシュ） |
| `/api/template/auto-register` | POST | Auth + App Check | FFLogsからの自動テンプレート登録 |
| `/api/template/promote` | POST | Admin | 人気プラン昇格承認 |
