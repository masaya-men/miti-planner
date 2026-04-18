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
- 残タスクはバグ修正・多言語・将来機能のみ（下記参照）

### 次にやること（優先順）
- **Phase 3 + OGP 高速化 + 削除防止（設計＆計画完了、新セッションで実装）**
  - 設計書: `docs/superpowers/specs/2026-04-18-admin-featured-and-ogp-preservation-design.md`
  - 実装計画: `docs/superpowers/plans/2026-04-18-admin-featured-and-ogp-preservation-plan.md`
  - 新セッションで `superpowers:executing-plans` または `superpowers:subagent-driven-development` を起動し、計画書の 13 タスクを順に実行
  - 手動検証（Task 12）と TODO.md 更新（Task 13）まで含めて 1 セッション完結の想定
- **フェーズ表示の最後のフェーズが壊れて見える件（未着手・要設計）**
  - 前セッションで一度着手したが複雑・影響範囲大のため撤回
  - `ensurePhaseEndTimes` が最後フェーズに `startTime+1` を設定する根本原因あり
  - `addPhase`の`containingPhase`判定・`BoundaryEditModal` 等多数参照あり
  - セッション初頭に**一緒に安全な計画**を立ててから着手
- デプロイ確認: サイレント圧縮の実動作（2026-04-20以降に確認）
- ハウジングツアープランナー着手（別プロジェクト作業後に開始)

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
