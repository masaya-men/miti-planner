# 野良主流ランキング再設計 設計書

**作成日**: 2026-04-17
**対象**: ボトムシート / みんなの軽減表ページ / `/api/popular` / `/api/share`
**スコープ**: ランキングアルゴリズム刷新 + featured活性化 + 匿名ID集計 + 管理画面UI追加

---

## 背景と問題

### 現状（変更前）
- ボトムシートに表示されるプラン = 各コンテンツの `viewCount` 降順1位
- `viewCount` は `/api/share?id=...` GET 時にIPハッシュで重複排除しつつ +1
- `copyCount` は `/api/popular` POST 時にログインユーザーのUIDで重複排除しつつ +1（未ログインは無視）
- `featured: true` フラグのプランは `/api/popular` API で返されるが、ボトムシートUIで利用されていない（死んでいる）
- 管理画面に featured を切り替えるUIが存在せず、Firestore直叩きでのみ操作可能

### 問題
1. **自己強化ループ**: ボトムシートが開かれる度にプレビュー取得で top plan の `viewCount` が増える → 既存のtop planが固定化し、外部で流行中の新しいプランが入り込めない
2. **時間減衰なし**: 半年前のプランと昨日のプランが同じ土俵で比較される
3. **集計母数が小さい**: 未ログイン勢のコピーが全くカウントされない
4. **featured機構が死んでいる**: 管理人が「本当に外部で流行っているもの」を手動で固定する手段が実質無い

---

## 設計哲学

**「自動ランキング（デフォルト）＋ 管理人featured（最終決定権）」の二層構造**

| 層 | 役割 | 更新主体 |
|---|------|---------|
| 自動ランキング | 「今の動き」をおおまかに映す | ユーザーのコピー行動 |
| featured | 「外部の本物の人気」を管理人判断で固定 | 管理人（外部シグナル観測） |

自動シグナルは Twitter・Discord・FFLogs・PT実体験などの外部情報を直接観測できないため、最後は人間判断で決める。自動層は「featured が無い時のフォールバック」として機能する。

---

## Phase 構成

独立にデプロイ可能。この順で進める。

| Phase | 内容 | 見積 |
|-------|-----|------|
| 1 | プレビュー fetch で viewCount を増やさない（止血） | 半日 |
| 2 | 匿名ID集計 + 日別バケット「旬」ランキング + featured優先表示 + プライバシーポリシー更新 | 2〜3日 |
| 3 | 管理画面 featured 設定UI | 2〜3日 |

---

## Phase 1: viewCount 自己強化ループの止血

### 変更内容
`/api/share` GET に `preview=true` クエリパラメータ対応を追加。`preview=true` の時は viewCount をインクリメントしない。フロントのプレビュー取得時だけこのフラグを付ける。

### 対象ファイル
| ファイル | 変更 |
|---------|------|
| `api/share/index.ts` | GETハンドラで `req.query.preview === 'true'` の時は viewCount 更新ロジックをスキップ |
| `src/components/MitigationSheet.tsx` | プレビュー取得の fetch URL に `&preview=true` を付加 |
| `src/components/PopularPage.tsx` | 同上 |
| `src/components/SharePage.tsx` | **変更なし**（ユーザーが共有リンクを開く行為は従来通り閲覧としてカウント） |

### 受け入れ基準
- ボトムシートを開いてプレビュー表示しても `viewCount` が増えない
- `/share/<id>` URLを直接開いた時は従来通り `viewCount` が増える
- `/api/share?id=xxx` （preview無し）の旧呼び出しは従来通り動く（後方互換）

---

## Phase 2: 匿名ID + 旬ランキング + featured 活性化

### 2-A: 匿名ID機構

未ログインユーザーのコピーを集計母数に含めるための仕組み。

#### 2-A-1: クライアント側ユーティリティ

**新規ファイル**: `src/lib/anonCopyId.ts`

```ts
/**
 * 匿名コピー集計ID（localStorage保存）
 * - 未ログインユーザーのコピー重複排除にのみ使用
 * - サーバはこのIDから個人を特定する手段を持たない
 * - ブラウザのデータクリアでリセットされる
 */
const STORAGE_KEY = 'lopo_anon_copy_id';

export function getAnonCopyId(): string | null {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // localStorage 無効環境（プライベートブラウジング等）
    return null;
  }
}
```

#### 2-A-2: APIサーバの修正

**対象**: `api/popular/index.ts` の POST ハンドラ

```ts
// 既存: Authorization ヘッダから UID を取得
// 追加: body から anonId を取得（UUID v4 regex で検証）

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const { shareId, anonId } = req.body;

let alreadyCounted = false;
if (uid) {
  // 既存パス: UIDで dedup（変更なし）
  const copiedByRef = db.doc(`${COLLECTION}/${shareId}/copiedBy/${uid}`);
  // ... 既存のロジック
} else if (typeof anonId === 'string' && UUID_V4_REGEX.test(anonId)) {
  // 新規パス: 匿名IDで dedup
  const anonCopiedByRef = db.doc(`${COLLECTION}/${shareId}/anonCopiedBy/${anonId}`);
  const existing = await anonCopiedByRef.get();
  if (existing.exists) {
    alreadyCounted = true;
  } else {
    const batch = db.batch();
    batch.set(anonCopiedByRef, { copiedAt: FieldValue.serverTimestamp() });
    batch.update(docRef, {
      copyCount: FieldValue.increment(1),
      [`copyCountByDay.${todayKey()}`]: FieldValue.increment(1),
    });
    await batch.commit();
  }
} else {
  // 匿名IDも無い → カウントしない
  alreadyCounted = true;
}
```

**`todayKey()` の定義**: UTC基準で `YYYYMMDD` 形式（例: `"20260417"`）。サーバ側で `new Date().toISOString().slice(0,10).replace(/-/g, '')` で生成。

#### 2-A-3: 3箇所のクライアント呼び出し修正

**対象**: `MitigationSheet.tsx` / `PopularPage.tsx` / `SharePage.tsx` の `apiFetch('/api/popular', POST)` 呼び出し

各箇所で `getAnonCopyId()` を呼び、body に含める:

```ts
import { getAnonCopyId } from '../lib/anonCopyId';

apiFetch('/api/popular', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shareId: entry.shareId,
    anonId: getAnonCopyId(),  // ← 追加
  }),
}).catch(() => {});
```

サーバはUIDがあれば anonId を無視するので、ログインユーザーがこのparamを送っても害はない。

---

### 2-B: 旬ランキング（日別バケット方式）

#### 2-B-1: データモデル

Firestore の `shared_plans/{id}` ドキュメントに **新フィールド** を追加:

```ts
copyCountByDay: {
  [dayKey: string]: number  // dayKey は "YYYYMMDD" UTC基準
}
```

例:
```json
{
  "shareId": "abc123",
  "copyCount": 42,
  "copyCountByDay": {
    "20260417": 5,
    "20260416": 3,
    "20260415": 7,
    "20260414": 2,
    "20260413": 4,
    "20260412": 1,
    "20260411": 6
  }
}
```

#### 2-B-2: 書き込みロジック

`/api/popular` POST の `alreadyCounted === false` 分岐内で、以下を一緒に更新:
- `copyCount`: +1（既存、変更なし）
- `copyCountByDay.{todayKey}`: +1（新規）
- 8日以上前のキーを削除（任意、簡単）

実装パターン:
```ts
// ヘルパー（api/popular/index.ts 内に定義）
function todayKey(): string {
  // UTC基準の "YYYYMMDD"
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
function dayKeyDaysBefore(n: number): string {
  // todayKey() の n 日前
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

const today = todayKey();
const updates: Record<string, any> = {
  copyCount: FieldValue.increment(1),
  [`copyCountByDay.${today}`]: FieldValue.increment(1),
};
// 古いキーを間引き（現在のドキュメントを読んで判定）
const currentData = snap.data()!;
const byDay = currentData.copyCountByDay || {};
const pruneCutoff = dayKeyDaysBefore(7);  // 7日前より古い（8日以上前）のキーを削除、7日前は残す
for (const key of Object.keys(byDay)) {
  if (key < pruneCutoff) {
    updates[`copyCountByDay.${key}`] = FieldValue.delete();
  }
}
batch.update(docRef, updates);
```

**注意**: 既に POST ハンドラ冒頭で `snap = await docRef.get()` しているので、追加の読み取りは不要。

#### 2-B-3: 読み込みロジック（ランキング計算）

`/api/popular` GET ハンドラの修正:

**変更前**:
```ts
.orderBy('viewCount', 'desc').limit(3)
```

**変更後**:
```ts
// コンテンツごとの全プランを取得（Firestore orderBy 不可、メモリでソート）
const allSnap = await db.collection(COLLECTION)
  .where('contentId', '==', id)
  .get();

// 7日ウィンドウの始点: 6日前の日付キー（今日を含めて7日間）
const windowStart = dayKeyDaysBefore(6);

const scored = allSnap.docs.map(doc => {
  const data = doc.data();
  const byDay: Record<string, number> = data.copyCountByDay || {};
  let score7d = 0;
  for (const [key, n] of Object.entries(byDay)) {
    if (key >= windowStart) score7d += n;  // "YYYYMMDD" 文字列の辞書順比較は日付順と一致
  }
  return { doc, score7d, copyCount: data.copyCount ?? 0 };
});

// スコア降順、tie-break は生涯copyCount降順
scored.sort((a, b) => b.score7d - a.score7d || b.copyCount - a.copyCount);

const plans = scored.slice(0, 2).map(s => mapDoc(s.doc));
```

**読み取りコスト評価**:
- 1コンテンツあたり最大 ~100プラン程度（現実的なスケール）
- 1回の `/api/popular` GET で ~20コンテンツ × 100 = 2000 reads 程度
- `Cache-Control: s-maxage=900` でエッジキャッシュ15分 → 時間あたり実読み取りは大幅減
- Firestore free tier (50k/day) 内で余裕
- 将来スケール対応: 非正規化フィールド `score7d` を導入するオプションあり（今は不要）

#### 2-B-4: フォールバック

`copyCountByDay` フィールドを持たない既存プラン（Phase 2 デプロイ前の書き込み分）:
- `score7d = 0` になる
- tie-break で `copyCount` の大小で並ぶ
- 新規コピーが走れば自動で `copyCountByDay` が生成されるので、自然に解消される
- 特別なマイグレーションは不要

---

### 2-C: featured 優先表示

#### 2-C-1: API の返却

`/api/popular` GET のレスポンスは現状維持（`plans` と `featured` を別々に返す）。

#### 2-C-2: ボトムシートの利用

**対象**: `src/components/MitigationSheet.tsx`

現在: `entry = popularData[selectedId]?.plans?.[0]` をプレビュー対象にする

変更後:
```ts
const entry =
  popularData[selectedId]?.featured  // featured が存在すれば最優先
  ?? popularData[selectedId]?.plans?.[0]  // 無ければ自動ランキング1位
  ?? null;
```

同様に `copyPlan` のターゲットも featured 優先にする。

#### 2-C-3: カード一覧の表示順

左カード列では現状通り、各コンテンツの代表プラン（featured があれば featured、無ければ自動ランキング1位）をサムネに使う。

**重要（設計判断）**: featured であることをユーザーに明示するバッジ等は **設けない**。「野良主流」という入口の文脈で管理人介入の存在を表に出すと、自然なコミュニティ感が損なわれる。内部的に featured が優先される動作だけ実装し、見た目上は自動ランキングと区別しない。

---

### 2-D: プライバシーポリシー更新

#### 2-D-1: Section 1「自動的に取得する情報」への追記

**現状** (`privacy_section1_auto_items`):
```
共有プランが何人に見られたかを正しく数えるため、閲覧時のIPアドレスを元に戻せない形に変換して記録します（元のIPアドレスを復元することはできません）,不正アクセスを防ぐため、IPアドレスを一時的に記録します（最大1分で自動的に消えます）
```

**変更後** (1項目追加):
```
共有プランが何人に見られたかを正しく数えるため、閲覧時のIPアドレスを元に戻せない形に変換して記録します（元のIPアドレスを復元することはできません）,不正アクセスを防ぐため、IPアドレスを一時的に記録します（最大1分で自動的に消えます),人気プランの集計を正しく行うため、あなたのブラウザで生成されたランダムな匿名ID（個人を特定しない文字列）を受け取ります
```

#### 2-D-2: Section 5「ブラウザへのデータ保存」の修正

**現状** (`privacy_section5_storage_items`):
```
プランデータのキャッシュ（素早く表示するためのコピー）,テーマ設定（ダークモード/ライトモードの選択）,ログイン状態の一時的な保持
```

**変更後** (1項目追加):
```
プランデータのキャッシュ（素早く表示するためのコピー）,テーマ設定（ダークモード/ライトモードの選択）,ログイン状態の一時的な保持,人気プランの集計用の匿名ID（ランダムな文字列）
```

**現状** (`privacy_section5_storage_note`):
> これらのデータはお使いのブラウザの中だけに保存されます。サーバーに自動送信されることはありません。

**変更後**:
> これらのデータは基本的にお使いのブラウザの中だけに保存されます。ただし「人気プランの集計用の匿名ID」だけは、あなたが共有プランをコピーする際にサーバーへ送信されます（個人を特定しない文字列であり、集計の二重カウントを防ぐためだけに使われます）。

#### 2-D-3: Section 3「情報の使いみち」への追記

**現状** (`privacy_section3_items`):
```
ログインとアカウントの管理,軽減プランの保存・端末間の同期・他の人との共有,不正アクセスや悪用の防止,サービスの利用状況の把握と改善
```

**変更後** (1項目追加):
```
ログインとアカウントの管理,軽減プランの保存・端末間の同期・他の人との共有,人気プランの集計（どのプランがよく参考にされているかの把握）,不正アクセスや悪用の防止,サービスの利用状況の把握と改善
```

#### 2-D-4: Section 6「データの保存場所と保持期間」への追記と注記修正

**現状** (`privacy_section6_data_types`):
```
アカウント情報・軽減プラン,チームロゴ画像,共有プラン,閲覧者の記録（元に戻せない形に変換済み）,アクセス頻度の記録,ログイン用Cookie,ブラウザ内のキャッシュ
```

**変更後** (2項目追加 — 匿名コピー集計ID と 匿名コピー記録):
```
アカウント情報・軽減プラン,チームロゴ画像,共有プラン,閲覧者の記録（元に戻せない形に変換済み）,匿名コピー集計ID（ランダムな文字列）,匿名コピー記録・日別コピー集計,アクセス頻度の記録,ログイン用Cookie,ブラウザ内のキャッシュ
```

対応する `privacy_section6_data_locations` も同じ位置に2項目追加:
```
Google Firebase（東京）,Google Firebase Storage（米国）,Google Firebase（東京）,Google Firebase（東京）,お使いのブラウザ,Google Firebase（東京）,Upstash（米国東部）,お使いのブラウザ,お使いのブラウザ
```

対応する `privacy_section6_data_periods` も同じ位置に2項目追加:
```
アカウントを削除するまで,自分で削除するまで,基本的に無期限,無期限（元のIPアドレスに戻すことはできません）,自分でブラウザから削除するまで,日別集計は8日以上前のものを自動削除,最大1分で自動削除,最大5分で自動削除,自分で削除するまで
```

**Section 6 注記の修正（重要）**

**現状** (`privacy_section6_note`):
> ログインしていない場合、データはブラウザの中だけに保存され、サーバーには送信されません。

この記述は Phase 2 後に **事実として誤りになる**（未ログインでもコピー時に匿名IDと集計データがサーバに送られる）。必ず以下に修正:

**変更後**:
> ログインしていない場合、本サービスに軽減プランが保存されることはありません。ただし、あなたが共有プランをコピーしたときに限り、集計の二重カウントを防ぐための匿名ID（個人を特定しない文字列）がサーバーへ送信されます。

#### 2-D-5: 他言語対応

ja 以外に en / zh / ko の同じキーも同様に更新する。機械翻訳ベースで作り、既存翻訳のトーンに合わせる。対象キー:
- `privacy_section1_auto_items`
- `privacy_section3_items`
- `privacy_section5_storage_items`
- `privacy_section5_storage_note`
- `privacy_section6_data_types`
- `privacy_section6_data_locations`
- `privacy_section6_data_periods`
- `privacy_section6_note`

計8キー × 3言語 = 24キーを手動翻訳/校正する。

---

### 2-E: Phase 2 の受け入れ基準

**匿名ID集計:**
- [ ] 未ログイン状態でコピーすると `copyCount` が +1 される
- [ ] 同じブラウザで同じプランを2回コピーしても +1 のまま（localStorage が effective な間）
- [ ] localStorage 無効環境でもエラーにならない（ただしカウントされない）

**旬ランキング:**
- [ ] `copyCountByDay.20260417` のようなフィールドが正しく +1 される
- [ ] 8日以上前のキーが削除される
- [ ] `/api/popular` GET のレスポンスが「直近7日 copyCount 順」で並んでいる
- [ ] `copyCountByDay` が未定義のプランも scoreで 0 として扱われ、エラーにならない

**featured優先:**
- [ ] Firestore で `featured: true` を立てたプランがボトムシートのプレビュー対象になる
- [ ] `featured` を外すと自動ランキング1位に戻る
- [ ] UI上、featured か自動ランキング1位かは見た目で区別されない（バッジ等なし）

**プライバシーポリシー:**
- [ ] 4言語（ja/en/zh/ko）で Section 1 / Section 3 / Section 5 / Section 6 が更新されている
- [ ] Section 5 storage_note が「匿名IDはサーバー送信される」旨を明記している
- [ ] Section 6 note が「未ログインでも匿名IDだけはサーバーに送られる」旨を明記している（Phase 2 の事実に整合）
- [ ] Section 6 のデータ表に「匿名コピー集計ID」「匿名コピー記録・日別コピー集計」が追加されている
- [ ] `legal.privacy_last_updated` の日付を更新している

---

## Phase 3: 管理画面 featured 設定 UI

### 3-A: 目的
管理人が外部シグナル（Twitter/Discord/FFLogs等）を見て判断した「本物の人気プラン」を、各コンテンツに対してワンクリックで featured 指定できるようにする。

### 3-B: 配置
- 新規メニュー: 管理ダッシュボードに「Featured設定」タブを追加
- 新規ファイル: `src/components/admin/AdminFeatured.tsx`

### 3-C: UI要素

```
┌─ Featured設定 ──────────────────────────┐
│                                          │
│  コンテンツ: [ドロップダウン: M1S ▼]     │
│                                          │
│  ★ 現在のFeatured:                        │
│  ┌────────────────┐                     │
│  │ [OGP]          │  タイトル            │
│  │                │  作者 | copyCount    │
│  └────────────────┘  [解除]              │
│                                          │
│  ── 候補一覧（直近7日 copyCount 順） ──   │
│  ┌────────────────┐                     │
│  │ [OGP]          │  タイトル            │
│  │                │  30コピー(7日) / 150 │
│  └────────────────┘  [Featuredにする]    │
│  ...                                     │
└──────────────────────────────────────────┘
```

### 3-D: バックエンド

**採用方針**: **既存 `/api/popular` に PATCH メソッドを追加する**（新規ファイル無し）。

理由:
- Vercel Hobby プラン 8/12 の関数数制約を維持
- 新規ファイル無しでレビュー・修正リスクを最小化
- 既存の CORS / AppCheck / Firebase Admin 初期化ロジックを流用可能
- 追加コードは約50行（ハンドラ分岐1つ + トランザクション処理1つ）

実装スケルトン:
```ts
} else if (req.method === 'PATCH') {
  // 管理者のみ: featured フラグ切替
  if (!await verifyAdmin(req, res)) return;
  const { shareId, featured } = req.body;
  if (typeof shareId !== 'string' || typeof featured !== 'boolean') {
    return res.status(400).json({ error: 'invalid body' });
  }

  const docRef = db.collection(COLLECTION).doc(shareId);
  const snap = await docRef.get();
  if (!snap.exists) return res.status(404).json({ error: 'not found' });
  const contentId = snap.data()!.contentId;

  // トランザクション: 同コンテンツの他 featured を全て外してから、対象を設定
  await db.runTransaction(async (tx) => {
    if (featured) {
      const othersSnap = await tx.get(
        db.collection(COLLECTION)
          .where('contentId', '==', contentId)
          .where('featured', '==', true)
      );
      othersSnap.forEach(doc => {
        if (doc.id !== shareId) tx.update(doc.ref, { featured: false });
      });
    }
    tx.update(docRef, { featured });
  });

  return res.status(200).json({ ok: true });
}
```

**`verifyAdmin` の実装**: 既存の admin API（`/api/admin-templates` など）で使われている管理者判定ロジックを共通化 or 流用する。実装計画時に既存コードを調査してパターンを合わせる。

### 3-E: Phase 3 の受け入れ基準
- [ ] 管理画面から1クリックでfeatured設定/解除できる
- [ ] 同コンテンツに複数featuredが立たない（1つに統一）
- [ ] 非管理者が PATCH を叩いても 403 になる
- [ ] ボトムシートで featured が優先表示される動作が Phase 2 と整合している

---

## リスクと対策

| リスク | 対策 |
|-------|------|
| 既存のログイン済みコピー動作を壊す | UID有りパスは一切変更しない（additive change のみ） |
| localStorage 無効環境での失敗 | try-catchで握りつぶし、匿名IDを付けずに呼ぶ（従来の「未ログインはカウントしない」挙動にfallback） |
| anonId ゴミデータ送信 | サーバ側で UUID v4 regex検証、非準拠なら null 扱い（400 は返さない、後方互換重視） |
| copyCountByDay 肥大化 | 書き込み時に 8日以上前のキーを `FieldValue.delete()` |
| 既存プラン（`copyCountByDay` 未定義）の扱い | 未定義は `{}` として 0点扱い、tie-break で `copyCount` フォールバック |
| Firestore 読み取りコスト | s-maxage=900 の edge cache で時間あたり数回に抑制。現在スケールでは free tier 内 |
| プライバシーポリシー更新漏れ | Phase 2 内で4言語同時更新（タスクとしてチェックリスト化） |
| featured が複数立つ事故 | Phase 3 の PATCH endpoint で トランザクション処理（同コンテンツの他 featured を必ず先に解除） |
| Vercel 関数数圧迫 | 新規エンドポイントは作らず、`/api/popular` を PATCH 追加で拡張 |

---

## テスト戦略

### ユニットテスト（vitest）
- `src/lib/anonCopyId.ts`: UUID生成/再利用/localStorage失敗時のfallback
- `dayKey` / `dayKeyNDaysAgo` ヘルパ（新設予定）: UTC日付計算の正しさ
- ランキングスコア計算関数（API内の切り出し可能部分）: `copyCountByDay` から7日スコアへの集約

### 手動検証
- **匿名ID**: ログアウト状態でコピー → Firestoreで `anonCopiedBy/{uuid}/` が作成されるか
- **匿名dedup**: 同ブラウザで同プランを2回コピー → 2回目はカウント増えないか
- **プライベートブラウジング**: エラーなく動くか（カウントはされない）
- **日別バケット**: コピー → `shared_plans/{id}.copyCountByDay` に今日のキーが増えるか
- **古いキー間引き**: 9日以上前のキーを手動で Firestore に入れてコピー → 消えるか
- **旬ランキング**: 同コンテンツに複数プランを用意し、直近コピー数で並びが変わるか
- **featured優先**: 手動で Firestore に `featured: true` を立てる → ボトムシートで優先されるか（見た目上は自動ランキング1位と区別されないこと）
- **プライバシーポリシー**: `/privacy` で4言語すべて新文言が出るか

### 既存テスト
- 148/148 pass を維持する（破壊しない）

---

## 未対応（スコープ外）

- **Phase 4 候補**: featured の自動期限切れ警告（最終確認日から90日経過で通知）
- **Phase 4 候補**: copyCountByDay の非正規化（score7d フィールド）によるスケール対応
- **Phase 4 候補**: コピー後「実際にプランを開いた」シグナルのトラッキング（深さ方向）
- **今回スコープ外**: 既存 viewCount のハッシュIP機構の廃止や見直し（Phase 1 で自己強化ループだけ断つ）
- **今回スコープ外**: 一般公開ランキングページ（PopularPage）の並び順統一（現在 viewCount 順のまま維持、将来 Phase 2 に合わせて再設計）
