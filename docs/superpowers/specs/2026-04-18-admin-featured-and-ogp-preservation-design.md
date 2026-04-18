# 管理画面 Featured 設定 + OGP 高速化 + 削除防止 設計書

**作成日**: 2026-04-18
**前提**: 2026-04-17 の `popular-ranking-redesign-design.md` の Phase 1/2 は完了済み、Phase 3 を本設計書で再設計して実装する。
**スコープ**: Phase 3（URL貼り付け方式に刷新）＋ ボトムシート OGP 高速化 ＋ Featured OGP 削除防止 ＋ AdminUgc i18n 現象確認。

---

## 1. 背景と目的

### 1-1. なぜこの設計書が必要か
- 野良主流（ボトムシートの代表カード）は Phase 2 まで本番稼働中。次は管理人が「外部で本当に流行っているプラン」を手動で固定する仕組み（featured）の UI を作る。
- Phase 3 の元設計書は「候補一覧を出して選ぶ」案だったが、**候補 = copyCount 上位 = 自動ランキング上位**なので、外部シグナル観測で選ぶ featured の目的に合わない。
- ボトムシートの OGP 画像は現状 `/api/og?id=X`（毎回 Playwright レンダ）で遅い。Phase 2 で作った Storage キャッシュ `/og/{hash}.png` を活用すれば瞬時表示できる。
- Storage キャッシュには 30 日未アクセスで削除する cron があり、featured 指定したプランも静かな時期に巻き込まれる可能性がある。featured = 野良主流の顔なので削除されると UX が崩れる。

### 1-2. 達成したいこと
1. 管理人が**共有 URL を貼り付けるだけ**で、そのプランを featured 指定できる（AdminUgc と同じ操作パターン）。
2. ボトムシートの代表カードが**瞬時に鮮明な OGP 画像**を表示する（X のリンクカードと同じ見た目）。
3. Featured 指定されたプランの OGP 画像は**絶対に 30 日 cron で消えない**。
4. 既存 AdminUgc 画面の i18n が翻訳キーのまま出ている（報告ベース）場合は直す。

---

## 2. スコープ

### 2-1. 含むもの
- 新規管理画面 `AdminFeatured.tsx`（URL 貼り付け→検索→[Featured にする / 解除] の1フロー）
- `/api/popular` に `PATCH` メソッド追加（admin 専用、featured フラグ切替 + トランザクションで 1 件化）
- `/api/popular` GET レスポンスに `imageHash` を含める（フロントで `/og/{hash}.png` を組み立てるため）
- `MitigationSheet.tsx` の OGP URL を `/og/{hash}.png` に切替、imageHash 無しの古いプランは従来の `/api/og?id=X` にフォールバック
- `og_image_meta/{hash}` に `keepForever: boolean` を追加。PATCH 時に該当 meta に set/clear
- `/api/cron/cleanup-og-images` で `keepForever === true` の hash は絶対に削除しない
- `src/locales/ja.json` の `admin.*` に新規キー（featured_*）追加
- 新規画面ナビを `AdminLayout.tsx` に追加
- AdminUgc i18n 現象確認（翻訳キーがそのまま出ている報告 → 実機確認→原因特定→修正 or クローズ）

### 2-2. 含まないもの（スコープ外 = 今回やらない）
- Featured の自動期限切れ通知（1 件 × コンテンツ × 期限なし運用で問題なし）
- 管理画面での「候補上位 N 件を自動ピックアップ」機能
- Featured 変更履歴の監査ログ（将来必要なら別スコープ）
- Featured 設定 UI の多言語対応（ja のみ、他言語は ja へフォールバック）

---

## 3. タスク1: 管理画面 Featured 設定 UI

### 3-1. ファイル配置
- 新規: `src/components/admin/AdminFeatured.tsx`
- 追加: `AdminLayout.tsx` の `NAV_ITEMS` に 1 行追加 (`/admin/featured`, labelKey: `'admin.featured_title'`)
- ルーティング: `AdminFeatured` を該当パスに接続するルータの場所は既存の `AdminContents` 等のパターンをそのまま踏襲する（実装計画で位置を特定）

### 3-2. UI 仕様

```
┌─ Featured設定 ──────────────────────────────────┐
│ 野良主流に固定するプランを、共有URLを貼り付けて     │
│ 指定します。1コンテンツにつき1件だけ設定できます。  │
│                                                  │
│ 共有URL: [https://lopoly.app/share/xxxxx   ][検索]│
│                                                  │
│ ──── 検索結果 ──────────────────────────────────│
│ ┌─[OGPサムネ 200x105]─┐                          │
│ │                      │  コンテンツ: 絶もう…    │
│ │                      │  タイトル: FRU_LoPo     │
│ └──────────────────────┘  コピー数: 30           │
│                           作成日: 2026-03-20     │
│                           ★ 現在 Featured (M9S)  │
│                                                  │
│         [ Featured にする ]  [ Featured を解除 ] │
│                                                  │
│ （ボタンは状態に応じて片方のみ表示）               │
└─────────────────────────────────────────────────┘
```

**動作ルール**:
1. URL 貼り付け → [検索] クリックで `GET /api/admin?resource=ugc&shareId=X` を呼ぶ（既存エンドポイント流用）。
   - 既存 ugcHandler のレスポンスに `featured`, `copyCount`, `imageHash` を追加する必要がある（後述 3-4）。
2. 検索結果に該当プランのサムネ（`/og/{imageHash}.png`、無ければ `/api/og?id=X`）、コンテンツ ID、タイトル、コピー数、作成日、現在の featured 状態を表示。
3. プランが現在 featured なら [解除] ボタンのみ、featured でないなら [Featured にする] ボタンのみ表示。
4. [Featured にする] クリック → `PATCH /api/popular` `{ shareId, featured: true }` を送信。サーバ側トランザクションで**同コンテンツの他 featured を全て外してから**対象を featured に設定。
5. [解除] クリック → `PATCH /api/popular` `{ shareId, featured: false }` を送信。該当プランのみ featured を外す。
6. 成功時はトースト表示 + 検索結果を再取得して UI 更新。

### 3-3. バックエンド: `PATCH /api/popular`

既存 `api/popular/index.ts` の `handler` 内に分岐追加（新規ファイルなし、Vercel 関数数維持）。

```ts
} else if (req.method === 'PATCH') {
    // 管理者のみ: featured フラグ切替
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { shareId, featured } = req.body ?? {};
    if (typeof shareId !== 'string' || typeof featured !== 'boolean') {
        return res.status(400).json({ error: 'shareId (string) and featured (boolean) required' });
    }

    const docRef = db.collection(COLLECTION).doc(shareId);
    const snap = await docRef.get();
    if (!snap.exists) {
        return res.status(404).json({ error: 'not found' });
    }
    const data = snap.data()!;
    const contentId = data.contentId;
    if (!contentId) {
        return res.status(400).json({ error: 'plan has no contentId' });
    }
    const newImageHash = data.imageHash as string | undefined;

    // 1) トランザクション前に、同コンテンツの既存 featured を取得しておく
    //    （自分を除く、トランザクション外で og_image_meta の keepForever を剥がすために shareId と imageHash を記録）
    const oldFeaturedSnap = await db
        .collection(COLLECTION)
        .where('contentId', '==', contentId)
        .where('featured', '==', true)
        .get();
    const oldFeaturedEntries: { shareId: string; imageHash: string | null }[] = oldFeaturedSnap.docs
        .filter(d => d.id !== shareId)
        .map(d => ({ shareId: d.id, imageHash: (d.data().imageHash as string) ?? null }));

    // 2) トランザクション: shared_plans のみを一貫更新
    await db.runTransaction(async (tx) => {
        if (featured) {
            // 旧 featured を外す（再読込して tx 内で整合性確保）
            for (const entry of oldFeaturedEntries) {
                tx.update(db.collection(COLLECTION).doc(entry.shareId), { featured: false });
            }
        }
        tx.update(docRef, { featured });
    });

    // 3) og_image_meta.keepForever の制御はトランザクション外で best-effort 実施（詳細は 5-2）
    //    失敗しても shared_plans の整合性は既に担保されており、次回 PATCH で自己修復される

    return res.status(200).json({ ok: true });
}
```

`newImageHash` と `oldFeaturedEntries` をここでスコープ定義しておくことで、5-2 の meta 更新コードから参照できる。

**重要なセキュリティポイント**:
- `verifyAdmin(req)` は `src/lib/adminAuth.ts` の既存関数を使う（Firebase ID トークンを検証し `decoded.role === 'admin'` で判定）。
- `App Check` は既存 `verifyAppCheck` が handler 冒頭で全 method に適用済み。

### 3-4. `GET /api/admin?resource=ugc` の拡張

既存 `_ugcHandler.ts` のレスポンスに 3 フィールド追加:

```ts
return res.status(200).json({
    shareId: data.shareId,
    title: data.title || '',
    contentId: data.contentId || null,
    createdAt: data.createdAt || null,
    type: data.type || 'single',
    hasLogo: !!data.logoBase64,
    logoBase64: data.logoBase64 || null,
    // 追加
    featured: data.featured === true,
    copyCount: data.copyCount || 0,
    imageHash: data.imageHash || null,
});
```

これで AdminFeatured は**新しい API エンドポイントを足さずに**情報取得できる（既存 ugc エンドポイント流用でコスト 0）。

### 3-5. i18n（ja のみ追加）

`src/locales/ja.json` の `admin` オブジェクトに追加:

```json
"featured_title": "Featured設定",
"featured_description": "野良主流に固定するプランを共有URLから指定します。1コンテンツにつき1件のみ設定できます。",
"featured_url_placeholder": "共有URLまたはshareIDを貼り付け",
"featured_search": "検索",
"featured_current_content": "コンテンツ",
"featured_plan_title": "タイトル",
"featured_copy_count": "コピー数",
"featured_created": "作成日",
"featured_status_on": "現在 Featured に設定中",
"featured_status_off": "未設定",
"featured_set_button": "Featuredにする",
"featured_unset_button": "Featuredを解除",
"featured_set_success": "Featuredに設定しました",
"featured_unset_success": "Featuredを解除しました",
"featured_not_found": "共有IDが見つかりません",
"featured_confirm_set": "このプランを「{{content}}」のFeaturedに設定します。同じコンテンツの既存Featuredは自動的に外れます。よろしいですか？",
"featured_confirm_unset": "このプランのFeaturedを解除します。よろしいですか？"
```

**注**: en/zh/ko の JSON には追加しない（管理画面は ja のみ運用で決定）。他言語ユーザが万一見ても i18next の fallback 設定により日本語表示される。

### 3-6. 受け入れ基準（タスク1）
- [ ] `/admin/featured` にアクセスすると新規画面が表示される
- [ ] URL 貼り付け → [検索] で該当プランの情報とサムネが表示される
- [ ] featured でないプランには [Featuredにする] のみ表示
- [ ] featured のプランには [Featuredを解除] のみ表示
- [ ] 別のプランを Featured に設定すると同コンテンツの旧 featured が自動で解除される（Firestore で確認）
- [ ] 非管理者が `PATCH /api/popular` を叩くと 403
- [ ] 存在しない shareId を Featured にしようとすると 404
- [ ] ボトムシートで featured が優先表示される（Phase 2 の既存動作を破壊しない）

---

## 4. タスク2: ボトムシート OGP 高速化

### 4-1. `/api/popular` GET レスポンスに `imageHash` 追加

`api/popular/index.ts` の `mapDoc` 関数に 1 行追加:

```ts
return {
    shareId: data.shareId,
    title: data.title ?? '',
    contentId: data.contentId,
    copyCount: data.copyCount ?? 0,
    viewCount: data.viewCount ?? 0,
    featured: data.featured === true,
    createdAt: data.createdAt,
    partyMembers,
    imageHash: data.imageHash ?? null,  // 追加
};
```

`PopularEntry` 型（`MitigationSheet.tsx`, `PopularPage.tsx` 両方）に `imageHash: string | null` を追加する。

### 4-2. `MitigationSheet.tsx` の URL 切替

```ts
// 現在
const getOgpUrl = (shareId: string) => `/api/og?id=${encodeURIComponent(shareId)}`;

// 変更後
const getOgpUrl = (entry: PopularEntry) =>
    entry.imageHash
        ? `/og/${entry.imageHash}.png`
        : `/api/og?id=${encodeURIComponent(entry.shareId)}`;  // フォールバック
```

呼び出し箇所（line 470, 他の OGP img タグ）を `getOgpUrl(entry)` に変更。

### 4-3. なぜフォールバックが必要か
- Phase 2 より**前に作られた共有プラン**は `imageHash` フィールドを持たない。
- `/og/{hash}.png` はハッシュ必須、該当ハッシュが Storage に無ければ og-cache で MISS → dynamic 生成するが、ハッシュ自体がそもそも算出されていない場合は URL を作れない。
- そのため `imageHash` が無ければ従来の `/api/og?id=X` に落とす（遅いが動作する）。
- 次に該当プランが `PUT /api/share` で更新されたタイミングで `imageHash` が付与される（既存ロジック）。

### 4-4. 受け入れ基準（タスク2）
- [ ] ボトムシートを開くと、featured / ランキング1位の OGP が瞬時に表示される（Storage HIT 想定）
- [ ] ネットワークタブで URL が `/og/{hash}.png` になっていることを確認
- [ ] `imageHash` 無しの古いプラン（テスト用に 1 件作って検証）は従来の `/api/og?id=X` が叩かれる
- [ ] Phase 2 の copyCount / 重複排除動作を破壊しない

---

## 5. タスク3: Featured OGP の削除防止

### 5-1. `og_image_meta/{hash}` にフィールド追加

既存フィールドに 1 つ追加:

```ts
interface OgImageMeta {
    shareId: string;
    showTitle: boolean;
    showLogo: boolean;
    logoHash: string | null;
    lang: 'ja' | 'en' | 'zh' | 'ko';
    createdAt: number;
    lastAccessedAt: number;
    keepForever?: boolean;  // 追加（true のとき cron 削除対象から外す）
}
```

**既定値なし = undefined or false → 通常の 30 日ルール適用。**
**true のときのみ保護。**

### 5-2. PATCH /api/popular での keepForever 制御

3-3 のトランザクション完了後に以下を実行（`newImageHash` と `oldFeaturedEntries` は 3-3 でスコープ定義済み）:

```ts
// トランザクション後
const metaCol = db.collection(OG_IMAGE_META_COLLECTION);
if (featured) {
    // (a) 新 featured の meta に keepForever: true を立てる
    if (newImageHash) {
        await metaCol.doc(newImageHash).update({
            keepForever: true,
        }).catch(() => { /* meta が無い古いプランは無視 */ });
    }
    // (b) 旧 featured の meta から keepForever を外す（新 featured と同じ hash の場合はスキップ）
    for (const entry of oldFeaturedEntries) {
        if (entry.imageHash && entry.imageHash !== newImageHash) {
            await metaCol.doc(entry.imageHash).update({
                keepForever: FieldValue.delete(),
            }).catch(() => {});
        }
    }
} else {
    // Featured 解除: 対象プランの meta から keepForever を外す
    if (newImageHash) {
        await metaCol.doc(newImageHash).update({
            keepForever: FieldValue.delete(),
        }).catch(() => {});
    }
}
```

**設計判断**:
- トランザクション内で `og_image_meta` を同居させない（where クエリ + collection 跨ぎで tx リトライ難度が上がるため）
- meta 更新が失敗しても `shared_plans.featured` の整合性は既に担保されている。meta だけ古く残っても最悪「本来消せる古い画像が残る」だけなので UX 影響なし
- 次回 PATCH が走ると再度 keepForever の set/delete が試行されるので自己修復する
- `FieldValue.delete()` は既存の `api/popular/index.ts` で import 済み、追加 import 不要

### 5-3. `/api/cron/cleanup-og-images` の保護判定

`api/cron/cleanup-og-images/index.ts` の削除ループに 1 条件追加:

```ts
for (const file of files) {
    if (checked >= MAX_PROCESS) break;
    checked++;
    try {
        // ハッシュ抽出
        const match = file.name.match(/^og-images\/([a-f0-9]{16})\.png$/);
        const hash = match?.[1];

        // 追加: keepForever 判定
        if (hash) {
            const metaSnap = await db.collection(OG_IMAGE_META_COLLECTION).doc(hash).get();
            if (metaSnap.exists && metaSnap.data()?.keepForever === true) {
                continue;  // 絶対に削除しない
            }
        }

        const [metadata] = await file.getMetadata();
        // ...（既存の 30 日判定ロジックはそのまま）
    }
}
```

**パフォーマンス影響**:
- Firestore read が 1 ファイルあたり 1 回追加（MAX_PROCESS=500 × 週1回 = 2,000/月）
- 無料枠 50,000 reads/day の中では誤差レベル

### 5-4. 受け入れ基準（タスク3）
- [ ] プランを Featured に設定すると `og_image_meta/{imageHash}.keepForever = true` が立つ
- [ ] Featured を解除すると `keepForever` フィールドが削除される
- [ ] 別プランに Featured を切り替えると、旧 featured の `keepForever` が外れ、新 featured に立つ
- [ ] cron を手動実行しても `keepForever: true` の画像は絶対に消えない
- [ ] `keepForever` が無い（または false の）画像は従来通り 30 日ルールで消える

---

## 6. タスク4: AdminUgc i18n 現象確認

### 6-1. 状況
- ユーザ報告: AdminUgc 画面で翻訳キーがタグのまま表示される
- ja.json には `admin.ugc_title` 等すべて存在する（grep で確認済み）
- したがって**実機で再現するか先に確認**が必要

### 6-2. 手順
1. ローカルで `npm run dev` 起動後、管理ログインして `/admin/ugc` を開く
2. 「UGC管理」の見出しが日本語で表示されるか、`admin.ugc_title` のようなキーで表示されるか確認
3. キーのまま表示される場合:
   - i18n namespace 誤りがないか `t('admin.ugc_title')` vs `t('ugc_title')` の違いを確認
   - 該当 key のスペルミス確認
   - `i18next-browser-languagedetector` の言語が ja になっているか確認
4. 正常に日本語表示される場合: ユーザに「再現しない」と伝えてクローズ（タスク閉じ）

### 6-3. 受け入れ基準
- [ ] 実機確認で現象再現の有無を報告
- [ ] 再現した場合: 修正コミット込みで日本語表示される
- [ ] 再現しなかった場合: 確認結果を引き継ぎメッセージに記載

---

## 7. 実装順序

最小リスク順（1→4）。各ステップ commit 粒度は実装計画で細かく切る。

1. **タスク2 先行**: `/api/popular` に `imageHash` 追加 + `MitigationSheet` URL 切替（副作用少、UX 即改善）
2. **タスク3**: `og_image_meta.keepForever` + cron 保護判定（タスク1 で使う基盤）
3. **タスク1 バックエンド**: `PATCH /api/popular` + `_ugcHandler` 拡張
4. **タスク1 フロント**: `AdminFeatured.tsx` + nav 追加 + ja.json キー追加
5. **タスク4**: AdminUgc i18n 現象確認
6. **回帰テスト**: 既存 vitest + 手動検証（後述）

---

## 8. リスクと対策

| リスク | 対策 |
|-------|------|
| 旧 featured の meta 更新失敗でストレージが肥大化 | 不整合は次回 PATCH で修復。cron でも keepForever が新 featured のみ存在するので、古い残りは 30 日で消える |
| トランザクション内で meta 更新を混ぜる複雑性 | トランザクションは shared_plans のみ、og_image_meta は通常 update（失敗耐性設計） |
| 非管理者の PATCH 乱用 | verifyAdmin + App Check の二重防御 |
| 既存 `/api/og?id=X` 削除欲求 | 本スコープでは削除しない。imageHash 無しプランのフォールバックとして残す |
| i18n fallback（他言語で ja_title が出る） | 運用上問題なし（管理画面は ja 1 人運用で合意済み） |
| Vercel Hobby 関数数制約 | 新規 API 関数ゼロ（既存 `/api/popular` と `/api/admin` に分岐追加のみ） |
| /api/popular の既存 cache ヘッダ(s-maxage=900) | PATCH は cache されないので問題なし。GET は従来通り |
| PATCH でトランザクション競合 | Firestore トランザクション自動リトライで吸収 |
| cron の Firestore read 増加 | MAX_PROCESS=500 × 週1 = 2,000/月、無料枠の 0.1% |

---

## 9. テスト戦略

### 9-1. ユニットテスト（vitest）
- 既存 148/148 pass 維持
- 新規テストは最小限（`verifyAdmin` / トランザクション挙動は既存の admin 系テストパターンを踏襲）

### 9-2. 手動検証（各タスク完了後）

**タスク2**:
- ボトムシートを開く→ネットワークタブで `/og/{hash}.png` が叩かれる
- レスポンスタイム < 200ms（HIT 時）
- `imageHash` 無しのテストプランを 1 件 Firestore 手動作成 → `/api/og?id=X` が叩かれることを確認

**タスク3**:
- 管理画面から Featured 設定 → Firestore で `og_image_meta/{hash}.keepForever === true` を確認
- 解除 → フィールド消える
- 別プランに切替 → 旧 featured の keepForever が消え、新 featured に立つ
- cron 手動実行: `keepForever: true` は残り、期限切れの通常画像は消える

**タスク1**:
- 管理ログイン → `/admin/featured` → URL 貼り付け → 結果表示 → Featured 設定 → ボトムシートで確認
- 同コンテンツの別プランを Featured 設定 → 旧 featured 自動解除を Firestore で確認
- 非管理者の fetch で PATCH を叩く → 403
- 存在しない shareId → 404

**タスク4**:
- `/admin/ugc` 実機確認（現象再現有無）

### 9-3. 既存動作の非回帰確認
- ボトムシートのコピー動作（Phase 2 の copyCount / anonId 重複排除）
- /api/popular GET の既存レスポンス互換（imageHash 追加のみ、既存フィールド削除/改名なし）
- OGP X プレビュー（`/share/{id}` ページの OGP meta tag は本改修に無関係、変更しない）

---

## 10. 引き継ぎ時の注意

- 本設計書は「何を・なぜ」を定義する。**具体的な実装順・ファイル変更・テスト手順は別途実装計画に記載**する。
- 実装計画は `superpowers:writing-plans` スキルで `docs/superpowers/plans/2026-04-18-admin-featured-and-ogp-preservation-plan.md` に生成する。
- 実装は新セッション（/clear 後）で `superpowers:executing-plans` を使って段階実行。
- 全ステップ完了後、本番デプロイ前に手動検証チェックリストを完走する。
