# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接
- **注意**: ENFORCE_APP_CHECK=true、Vercel関数9/12（og-cache・cron追加で+2）、月100ビルド制限
- **軽減アプリ: 完成・公開済み（2026-04-13 完成ツイート済み）**
- **OGP 画像 X 表示問題: 完全解決（2026-04-18、プライベート X でカード表示確認済み）**
- **Phase 2 本番観察: 完了（2026-04-18、copyCount/copyCountByDay/匿名ID重複排除すべて動作確認）**
- **shared_plans クリーンアップ済み: ツイート用 `5lCMACDB "FRU_LoPo"` のみ残存、管理人テスト 179件削除**
- **シークレット漏洩 3層防御 導入済み（2026-04-18）**: SessionStart フック / gitleaks pre-commit / GitHub Secret Scanning + Push Protection
- **3層防御の自動診断を全プロジェクトで有効化（2026-04-18）**: SessionStart hook `check-secret-defense-layers.sh` が毎セッション診断し不完全なら警告。`setup-secret-defense.sh` は Layer C まで自動適用。Booklage にも 3 層適用完了。
- **Phase 3 + OGP 高速化 + 削除防止 実装完了（2026-04-18）**: 管理画面 `/admin/featured` で URL 貼り付け式の Featured 指定UI、ボトムシート OGP を `/og/{hash}.png` 経路に高速化、Featured 指定中の OGP は cron で削除されない（`keepForever: true`）
- **最終フェーズ/ラベル endTime 修正 実装完了（2026-04-18）**: `ensurePhaseEndTimes` / `ensureLabelEndTimes` に optional `maxTime` 引数追加、15 呼び出し箇所で timelineEvents 最大時刻を渡す
- **隣接フェーズ/ラベルの境界追従 実装完了（2026-04-18）**: `updatePhase*Time` / `updateLabel*Time` 4関数で、被せた側が隣の境界を新値に追従させる挙動に統一。巻き戻しバグも解消、最低幅1秒を確保。
- **フェーズ/ラベル隣接規約の本質修正 実装完了（2026-04-18）**: 描画仕様 (endTime+1) とデータ規約を整合。旧規約 `endTime === next.startTime` → 新規約 `endTime + 1 === next.startTime`。境界の罫線が消えるバグ解消。loadSnapshot で既存プラン自動修復。
- 残タスクはバグ修正・多言語・将来機能のみ（下記参照）

### 次にやること（優先順）
- **本番検証（Vercel デプロイ後 / ユーザーが実施）**
  - `lopoly.app/admin/featured` で FRU テスト shareId（`5lCMACDB`）を検索 → サムネ・情報が出る
  - `[Featuredにする]` → 確認ダイアログ → Firestore で `shared_plans/5lCMACDB.featured: true` と `og_image_meta/{hash}.keepForever: true` 確認
  - `lopoly.app/miti` のボトムシートで OGP が `/og/{hash}.png` 経由で表示されること確認
  - `[Featuredを解除]` → Firestore で `featured: false` と `keepForever` 削除確認
  - 非管理者 DevTools から PATCH 叩き → 403 確認
- **最終フェーズ/ラベル修正の本番検証（ユーザー実施）**
  - FRU プラン (`5lCMACDB`) でフェーズ帯が最終イベントまで伸びているか
  - ラベル帯も最終イベントまで伸びているか
  - 新規プラン作成 / BoundaryEditModal / Timeline Select Mode が壊れていないか
- デプロイ確認: サイレント圧縮の実動作（2026-04-20以降に確認）
- ハウジングツアープランナー着手（別プロジェクト作業後に開始)

### 今セッションの完了事項（2026-04-18 追加 フェーズ/ラベル隣接規約の本質修正）
- ✅ **境界の罫線が消えるバグを根本解消**
  - 症状: 新規プランでフェーズを 2 個追加すると、境界の罫線が描画されない
  - 根本原因: 描画仕様は `endTime inclusive + 描画時 +1` なのに、データ規約は `endTime === next.startTime` で 1 行オーバーラップ → sort 順で次フェーズが上に被り、前フェーズの下辺罫線が覆い隠される
  - 新規約: **`phase[i].endTime + 1 === phase[i+1].startTime`**（描画と整合）
  - ユーザーが指定した値は尊重、追従される側が `±1` ずれる（EndTime 後ろ移動 → 次 startTime = final+1、StartTime 前移動 → 前 endTime = final-1）
  - 修正箇所:
    - `updatePhase*Time` / `updateLabel*Time` 4 関数: 衝突時の追従を +1 / -1 ずらす、最低幅確保を `next.endTime - 2` / `prev.startTime + 2` に
    - `addPhase` / `addLabel`: clippedPhases/Labels を `endTime = startTime - 1`、nextPhase ありで `endTime = nextStart - 1`
    - `ensurePhase/LabelEndTimes`: 中間の endTime を `next.startTime - 1` に
    - 新規 `repairAdjacentPhaseBoundaries` / `repairAdjacentLabelBoundaries`: 旧規約データを自動修復
    - `loadSnapshot`: 修復関数を都度呼び出し、既存プランを自動修復
  - 描画ロジック (Timeline.tsx) は無変更で温存
  - 全 219 テスト PASS（新規 boundary テスト 22 + 修復関数テスト 8）、本番ビルド成功
  - 空白は残せる仕様のまま（意図的な gap を作りたいユーザー向け）

### 今セッションの完了事項（2026-04-18 追加 隣接フェーズ/ラベル境界追従）
- ✅ **フェーズ/ラベルの境界編集挙動を統一、被せた側が隣を追従**
  - 対象: `updatePhaseEndTime` / `updatePhaseStartTime` / `updateLabelEndTime` / `updateLabelStartTime`（4関数）
  - 旧挙動の問題:
    - `updatePhaseEndTime`: 次フェーズ `startTime` でクリップして止まる → 後ろへ動かせない
    - `updatePhaseStartTime`: 前フェーズ endTime を `oldStartTime` に巻き戻すバグ（後退時のみ、前が勝手に伸びる）
    - `updateLabelEndTime`: 何もクリップしない → 重なって表示崩れ
    - `updateLabelStartTime`: updatePhaseStartTime と同じ巻き戻しバグ
  - 新挙動（4関数で統一）:
    - EndTime を後ろへ動かす → 衝突する「次」の `startTime` を新 endTime に追従
    - StartTime を前へ動かす → 衝突する「前」の `endTime` を新 startTime に追従
    - 隣接 1 個だけ追従、複数またぎは最低幅 1 秒確保で止まる
  - 調査で UI 側の事前クリップなしを確認、store 4 関数のみ改修で完結
  - 新規テスト 19 ケース追加、全 208 テスト PASS、本番ビルド成功
  - vitest setup で `self` / `localStorage` の polyfill 追加（store 直接テストに必要）

### 今セッションの完了事項（2026-04-18 追加 最終フェーズ/ラベル endTime 修正）
- ✅ **最終フェーズ/ラベルの endTime バグを根本修正**
  - 症状: 最終フェーズ/ラベルの帯が `startTime+1` の 2 秒分しか描画されず、以降のイベント行に帯が無い
  - 根本原因: `ensurePhaseEndTimes` / `ensureLabelEndTimes` がマイグレーション時に `timelineEvents` を知らず、`startTime + 1` を決め打ちしていた
  - 修正: 両関数に optional な `maxTime` 引数を追加、15 呼び出し元で timelineEvents の最大時刻を渡す
  - `migrateLabels` は内部で最終イベント時刻を自動計算
  - 描画ロジック（Timeline.tsx / BoundaryEditModal）は無変更
  - 後方互換: `maxTime` 未指定時は既存挙動（startTime+1）
  - 徹底調査により影響範囲（管理画面/FFLogs/Timeline Select Mode/BoundaryEditModal/ラベルのフェーズ境界クリップ）を壊さないことを確認済み
  - 全 180 テスト PASS（+9 件追加）、本番ビルド成功
  - 10 commits

### 今セッションの完了事項（2026-04-18 追加 i18n バグ修正）
- ✅ **admin 画面で i18n キーが生表示されるバグを修正**
  - 原因: 過去commitで `admin` オブジェクトの閉じ `}` 位置がズレており、`ugc_*`/`featured_*` キーが `backup` オブジェクト内に誤配置されていた
  - 影響範囲: 管理画面のみ（UGC管理・Featured設定のサイドナビ/ページタイトル/ラベル類が生キー表示）
  - 修正: ja/en/zh/ko 全4言語ファイルで該当キーを `admin` オブジェクト直下に移動
  - コードロジック変更なし、一般ユーザー機能への影響なし
  - 171テスト PASS、ビルド成功、デプロイ済み

### 今セッションの完了事項（2026-04-18 Phase 3 実装）
- ✅ **Phase 3: 管理画面 Featured 設定UI + OGP 高速化 + 削除防止 実装完了**
  - `PATCH /api/popular` 追加: 管理者専用、トランザクションで同コンテンツの既存 Featured を自動解除、`og_image_meta.keepForever` を set/clear（best-effort）
  - `/api/popular` GET と `/api/admin?resource=ugc` GET のレスポンスに `imageHash` を追加
  - `MitigationSheet.tsx`: OGP URL を `imageHash` ありなら `/og/{hash}.png`、なければ従来 `/api/og?id=X` にフォールバック
  - `AdminFeatured.tsx` 新規作成: URL/shareId 貼り付け式、検索 → Featured 切替、確認ダイアログ付き
  - `/admin/featured` ルート + サイドナビ追加
  - `cleanup-og-images` cron: `keepForever: true` の画像を削除対象から除外（ハッシュ抽出をループ先頭に移動）
  - `ja.json` に `admin.featured_*` 17キー追加（en/zh/ko はフォールバック、将来対応）
  - 全 171 テスト PASS、本番ビルド成功
  - 11 commits: (Phase 3 シリーズ)

### 今セッションの完了事項（2026-04-18 追加分）
- ✅ **3層防御の自動診断を全プロジェクト対応に拡張**
  - 新 hook: `~/.claude/hooks/check-secret-defense-layers.sh`（SessionStart で毎回診断、不完全なら context に警告）
  - `~/.claude/settings.json` の SessionStart に診断 hook を追加
  - `~/.claude/hooks/setup-secret-defense.sh` に Layer C 自動適用を追加（`gh api -X PATCH`）
  - グローバル CLAUDE.md（`~/.claude/CLAUDE.md`）に「セキュリティ標準」セクション追加
  - **Booklage（マイコラージュ）に 3 層適用完了**: Layer B pre-commit 導入 + Layer C Secret Scanning/Push Protection 有効化
  - これで新プロジェクトでも、初回セッションで自動警告 → `bash ~/.claude/hooks/setup-secret-defense.sh` 一発で揃う

### 今セッションの完了事項（2026-04-18）
- ✅ **シークレット漏洩 3層防御 導入**
  - Layer A: `~/.claude/settings.json` に SessionStart フック（`.claude/worktrees/` を毎回自動走査、検知時は Claude の context に警告）
  - Layer B: `.husky/pre-commit` で gitleaks 自動スキャン（secret 検出時 commit 拒否、`--redact=100` で値は画面表示しない）
  - Layer C: GitHub Secret Scanning + Push Protection 両方 enabled
  - 汎用セットアップスクリプト: `~/.claude/hooks/setup-secret-defense.sh`（他プロジェクトで `bash ~/.claude/hooks/setup-secret-defense.sh` 一発）
  - きっかけ: 過去のエージェント worktree に `.env.vercel-check` が staged で残留（**commit/push 未遂、全履歴スキャンで痕跡 0 件**、実害なし）。worktree 撤去 + リモートブランチ削除済み。
- ✅ **Phase 2 本番観察完了**
  - 通常ブラウザ（ログイン中）→ UID 重複排除で alreadyCounted、ランキング不変
  - シークレット（未ログイン）→ 新規 anonId で `anonCopiedBy` + `copyCountByDay.今日` に正しく記録、copyCount +1
  - `/privacy` の4言語（ja/en/zh/ko）で「匿名ID集計」「日別コピー集計」文言確認（コード側）
  - クライアント `localStorage.lopo_copied_shares` による同一ブラウザ内 dedup 動作確認
  - サーバー App Check 強制動作確認（直接 POST で 403 "App Check token missing"）
- ✅ **shared_plans 管理人テスト 179件を一括削除**（ツイート用 `5lCMACDB "FRU_LoPo"` のみ残存）
  - 連鎖削除: copiedBy 11件、anonCopiedBy 3件
  - これで野良主流は FRU のみ 1位表示、他コンテンツは空表示
- ✅ **OGP 画像 X 表示問題を最終解決**（Firebase Storage 静的キャッシュ + Lazy 生成 + 週次 Cron）
  - 新 URL `lopoly.app/og/{hash}.png`（imageHash ベース、同一オリジン静的配信）
  - `og_image_meta/{hash}` Firestore コレクションに生成パラメータ保存
  - /api/og-cache で Storage HIT/MISS 配信、/api/cron/cleanup-og-images で 30日未使用削除
  - 後方互換: 旧 share doc (imageHash 無し) は従来 /api/og?... URL で動作
  - 4 言語 Privacy Policy に `privacy_section6` 1項目追加
  - CRON_SECRET を Vercel 環境変数に設定済み（All Environments）
  - 10 commits: cf56d6f 〜 b5acd18
  - プライベート X `@lopoly_app` で画像カード表示を実機確認
  - モーダルプレビューは Storage キャッシュ HIT で 60ms 以内に配信
- ✅ OGP 実装関連の仕様:
  - imageHash は `sha256(contentName + planTitle + showTitle + showLogo + logoHash + lang)` 先頭 16 hex
  - バンドル共有は `'bundle:' + contentId 連結 + title 連結` で hash 計算
  - Storage rule で og-images/ 直接書き込みはクライアントから禁止（admin SDK のみ）
  - hash バリデーション `^[a-f0-9]{16}$` で SSRF 類縁攻撃対策

### 前セッション（2026-04-17）の完了事項
- ✅ ボトムシートUX改善（初期ロード全面スピナー + コピー進捗実値・パルス・最低400ms、本番確認済み）
- ✅ 通知音パス修正（FFXIV_SE/FFXIV_Notification.mp3 へ更新）
- ✅ 野良主流ランキング再設計 + Phase 1/Phase 2 実装（本番観察未実施）
- ✅ タンクLBスキル追加（Lv1/2/3 × 4ジョブ）

### Phase 2 後の follow-up（優先度低・時間あるとき）
- [ ] `api/popular/index.ts` `mapDoc` と `PopularEntry` 型の `viewCount` フィールドは Phase 2 以降未使用 → 削除整理
- [ ] en/ko の `privacy_section1_auto_items` 既存翻訳でインラインコンマが bullet 分割される pre-existing バグ（Phase 2 で追加した末尾項目は影響なし、既存項目のみ軽微表示崩れ）
- [ ] `PopularPage.tsx` `handleCopyAllRank` の localStorage persist がループ外（途中でタブ閉じると client dedupe list が保存されない、匿名ID サーバ側 dedup でカバー済み・影響軽微）
- [ ] **クライアント dedup の書き込みタイミング問題**: `MitigationSheet.tsx` の `copyPlan` で `localStorage.lopo_copied_shares` を POST **前** に書いている → POST が失敗（App Check エラー等）しても localStorage には残るため、そのブラウザは二度とカウントされない。改善案: POST 成功の 2xx レスポンス確認後に localStorage 更新。影響軽微（App Check 失敗は稀、普通は 1 ブラウザ 1 カウントで正常）

---

## バグ・不具合（要修正）

### 中
- [ ] ラベル名が管理画面で取得できない（スプシヘッダー問題？）
- [ ] TS5.9互換: mockData.ts等のインポートパスに拡張子が必要（3件）

### 低（動作影響なし・エッジケース）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい
- [ ] パルス設定: カスタムカラーのスライダー初期位置が端に寄る（軽微）

---

## 未着手（次にやる���と）

### 多言語
- [ ] ハウジングツアーページの言語対応

### その他
- [ ] AA名統一: 英語も"AA"に変更（中韓も同様）
- [ ] モーダル出現アニメーション改善（スプリング物理ベース、設計書あり）
- [ ] 本番動作確認（ギミックグループ・フェーズ編集・翻訳伝播・ダメージインポート）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）
- [ ] セキュリティ: 認証方式のプライバシー調査（メアド保存範囲・Anonymous認証検討）
- [ ] セキュリティ: localStorage認証トークン / Google Fonts SRI / Firestoreパス検証

## 未着手（将来）

### 新機能
- Floating Timeline (PiP): Tauri v2が現実的。Document PiP APIでは透過不可
- FFLogsインポート精度向上: 敵攻撃データ取得、テンプレート昇格、API制限解除申請
- ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- SA法オートプランナー改善 / AI APIでオートプラン
- 詠唱バー注釈機能 / チートシートモード検討
- public/icons/ 削除（バンドル2.1MB削減）

## UI改善（検討中）
- [ ] アイコンアニメーション化（SVGアニメ、FFLogsボタン等）
- [ ] みんなの軽減表: 機能の位置づけ再検討（規約更新は不要と判断済み — 既存共有プランのランキング表示のみ、新たなデータ収集なし）
- [ ] 紹介PV動画: CapCut/DaVinci Resolveでの制作を検討

## アイデア・やりたいこと
- YouTube埋め込み / こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション / UI温度感改善
- オートプラン精度改善（スプシ教師データ・スコアリングモデル）
- YouTube導線: ジョブごとにスキル回し動画URL設定→アイコン表示
- スクショOCR: ゲーム画面から軽減自動読み取り
- 管理画面FFLogsインポート（テンプレート作成効率化）
- 横型タイムライン＋音ゲーモード（PiP）
- Gemma搭載AI機能

### 多言語リファレンスURL（zh/ko翻訳作業用）
- 韓国語: https://guide.ff14.co.kr/job/paladin/1?type=E#pve
- 中国語: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index

## バックログ（運用・品質・検討中）
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ

## プロジェクト方針

### スキルデータ管理
- **正本: Firestore**（管理画面から追加・編集するのが正規ワークフロー）
- **mockData.ts**: フォールバック + テスト用 + 初期seed用
- **seed-skills-stats.ts**: マージ型（Firestoreのみのスキルは保持）
- スキル追加は管理画面で完結。将来的にFirestore→mockData.tsのexportスクリプト

### SNS Build in Public
- 進捗時にJP+ENツイート案を提案（ツリー形式、"Translated by AI" 付記）
- #LoPo #FF14 #BuildInPublic #AISelection
