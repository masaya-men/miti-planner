# セッション引き継ぎ書（2026-03-31 第64セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**
- **`replace_all` で意図しない箇所まで置換してしまう**
- **Zustandストア内でハードコーディングした日本語メッセージ**
- **backdrop-filterを直書きする（Lightning CSSに削除される）→ TECH_NOTES.md参照**
- **glass-tier3の`!important`を無視してTailwindクラスで上書きしようとする**
- **authDomainをlopoly.appに直接変更する（Firebase Hostingのハンドラーが必要）→ auth.lopoly.appを使う**
- **Vercel環境変数を`echo`でパイプしない** — `printf`か`--value`フラグを使う
- **`require()`をAPI関数内で使わない** — ESモジュールバンドルで`require is not defined`になる
- **編集のたびにFirestoreに同期しない** — イベント駆動+定期バックアップが正しい設計
- **useShallowでConsolidatedHeaderのmyJobHighlightをまとめると再レンダリングが阻害される** — 個別セレクタを使う
- **Ctrl+Shift+Zのe.keyは大文字'Z'** — toLowerCase()を使う

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand 5 + Firebase + Vercel
- **Discord**: https://discord.gg/z7uypbJSnN
- **公式X**: https://x.com/lopoly_app
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第64セッション）で完了したこと

### チュートリアル刷新の設計＋実装計画（コード変更なし・ドキュメントのみ）

**ブレインストーミング（ビジュアルコンパニオン使用）でユーザーと合意した設計：**

1. **構造**: 旧28ステップ1本通し → 短い個別チュートリアル3本
   - メインチュートリアル（10ステップ）: コンテンツ選択→パーティ編成→軽減配置→完了
   - 攻撃追加チュートリアル（4ステップ）: +ボタンor新規作成の初回使用時に発火
   - 共有チュートリアル（2ステップ）: 共有ボタン初回使用時に発火

2. **UI**: 緑ピルインジケーター（#22c55e ビビッドグリーン）
   - ラベル4種: CLICK / TAP / CHECK / NEXT
   - ボタン自体のCSSをいじらない独立物体方式
   - スポットライト廃止、クリックブロックのみ残す

3. **特殊演出**:
   - パーティ自動埋め: パレットアイコンの分身が弧を描いて飛行→スロットにカチャッと着地
   - ピル飛行: CHECK状態で赤ダメージセル横に表示→1.5秒後に軽減セルへ飛行→CLICKに変化
   - 完了カード: お祝い＋機能紹介（共有・新規作成・メニュー場所）

4. **メニュー**: 既存「チュートリアルを見る」ボタンからドロップダウン。3項目＋✓完了マーク

5. **設計思想**: データ駆動型（ステップ追加・削除は配列編集だけ）、戻るボタン廃止、旧コード完全削除

**成果物:**
- 設計書: `docs/superpowers/specs/2026-03-31-tutorial-overhaul-design.md`
- 実装計画: `docs/superpowers/plans/2026-03-31-tutorial-overhaul.md`（13タスク）
- TODO.md更新

### SE利用規約の調査

- LoPo全体の利用規約準拠を確認。結果: 概ねOK
- ジョブ/スキルアイコンの出自確認を推奨（ファンキット由来か直接抽出か）
- Ko-fiはグレーゾーンだが「ツール開発支援」の位置づけで多くのファンツールが同様に運営中
- 著作権表記は既に十分（`© SQUARE ENIX CO., LTD. All Rights Reserved.` + 非公式ファンツール免責）
- スクリーンショットの切り抜き使用はOK（改ざんデータでなければ）
- YouTube埋め込みは容量ゼロで安全

### YouTube埋め込みアイデア

- LP/ハウジングツアーにYouTube埋め込みで動画配置可能（容量ゼロ）
- CSSで角丸・clip-path等デザインカスタマイズ自由
- TODO.mdのアイデアセクションに追記済み

---

## 次セッションの優先タスク

### 1. チュートリアル刷新の実装（最優先・大タスク）
- 実装計画: `docs/superpowers/plans/2026-03-31-tutorial-overhaul.md`
- **推奨実行方法**: `superpowers:subagent-driven-development` スキルを使用
- 13タスク。Task 1（定義データ）から順番に実行
- 設計書を必ず読んでから実装開始: `docs/superpowers/specs/2026-03-31-tutorial-overhaul-design.md`

### 2. feature/pretext-lpブランチの整理
- 不採用が確定しているのでブランチ削除を検討

### 3. 継続検討タスクの方針決め

---

## 重要な技術的注意（前セッションから引き続き）

- **Vercel関数**: 現在7/12。新規APIは既存ルーターに統合する方式
- **API URLパターン**: `/api/admin?resource=xxx`, `/api/auth?provider=xxx`, `/api/template?action=xxx`, `/api/share?type=page`
- **管理者curlコマンド**: `curl -X POST "https://lopoly.app/api/admin?resource=role" ...`
- **ENFORCE_APP_CHECK=true が本番で有効** — 全APIでverifyAppCheckを維持
- **OAuthコールバックURL**: Discord=`/api/auth?provider=discord`, Twitter=`/api/auth?provider=twitter`
- **Cookieパス**: 統合後は `/api/auth`
- **LoPo管理マニュアル**: `C:\Users\masay\Desktop\LoPo管理マニュアル\` — 全シークレット含む（git外）
- **キーボードショートカット**: S(サイドバー), H(ヘッダー), P(パーティ), F(フォーカスモード) — Layout.tsxで実装

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Upstash Redis: `lopo-rate-limit` (us-east-1, 無料プラン)
