# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接
- **注意**: ENFORCE_APP_CHECK=true、Vercel関数8/12、月100ビルド制限
- **今セッション完了・push済み**:
  - LP刷新: Eva Sanchez風エディトリアルデザインに全面リビルド
    - 巨大タイポグラフィ「LoPo」、縦グリッドライン、モノスペースナビ
    - テーマ切替（☀/●）、言語切替、フッター全て動作確認済み
    - `src/components/landing/LandingPage.tsx` + `LangToggle.tsx` + `LandingFooter.tsx`
    - Three.js 3Dポータル（portal/）は廃止・削除済み
    - bodyのoverflow:hidden問題を修正（LP表示中のみautoに上書き）
  - CSS変数: --color-lp-* をEva風カラーに変更（ライト: #f2efe9クリーム、ダーク: #0e0e0e）

### 次にやること（最優先）
- （次のタスクをここに記載）

---

## バグ・不具合（要修正）

### 中（特定環境・管理者向け）
- [ ] ラベル名が管理画面で取得できない（スプシヘッダー問題？）

### FFLogs残課題
- [ ] 英語ログ警告: 未確認

### 低（動作影響なし・エッジケース）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい
- [ ] パルス設定: カスタムカラーのスライダー初期位置が端に寄る（軽微）

---

## 未着手（次にやること）

### 多言語
- [x] ランディングページのLangToggle（2言語→4言語対応）
- [x] コンテンツ名のzh/ko翻訳（contents.json + 管理画面対応）
- [x] Firestoreへのzh/koマイグレーション実行（63件反映済み）
- [x] スキル・ジョブ名のzh/ko翻訳（mockData.ts 21ジョブ+123スキル、Firestore同期済み）
- [x] テンプレート技名のzh/ko翻訳機能（管理画面FFLogsモーダル拡張済み、各コンテンツへの適用は順次）
- [ ] コンテンツ種類ボタンのzh/ko（categoryLabels）
- [ ] ハウジングツアーページの言語対応

### 管理画面改善
- [ ] AA名統一: 英語も"AA"に変更（中韓も同様）

### その他
- [ ] モーダル出現アニメーション改善（スプリング物理ベース、設計書あり: `docs/superpowers/specs/2026-04-10-spring-modal-animation-design.md`）
- [ ] 本番動作確認（ギミックグループ・フェーズ編集・翻訳伝播・ダメージインポート）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] ヒールスキル追加（テトラ、ディグニティ等のoGCDヒール）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）
- [ ] セキュリティ: 認証方式のプライバシー調査（メアド保存範囲・Anonymous認証検討）
- [ ] セキュリティ: localStorage認証トークン / Google Fonts SRI / Firestoreパス検証

## 未着手（将来）

### 新機能: Floating Timeline (PiP)
- Document Picture-in-Picture APIで別窓タイムライン表示
- 自分のジョブだけの軽減を簡潔表示、フルパーティ表示も選択可能
- 透過対応でゲーム画面に重ねて表示
- **調査結果(2026-04)**: Document PiP APIでの透過は不可能（WICG Issue #99でOPEN要望中だが実装予定なし）
- **現実的な選択肢**: (1) Tauri v2（14MB RAM, 透過+click-through+always-on-top対応）、(2) PowerToys Always on Top + 透過（Win+Ctrl+T）で既存PiPウィンドウを透過化、(3) Electron + goverlay（重いが実績あり）

### FFLogsインポート精度向上
- 敵の全攻撃データを取得→自動判定の精度を上げる
- テンプレート昇格: 完璧なタイムラインを管理者承認でテンプレート化
- FFLogs API制限解除申請（Public化後に検討）
- FFLogsへコンタクト: API制限解除 + ロゴ/アイコン使用許可の問い合わせ（Public化済み）

### その他
- [ ] 古いプランの自動アーカイブ（30件超過時）
- [ ] SA法オートプランナー改善
- [ ] 詠唱バー注釈機能
- [ ] AI APIでオートプラン
- [ ] ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- [ ] public/icons/ 削除（バンドル2.1MB削減）
- [ ] チートシートモード検討

## アイデア・やりたいこと
- YouTube埋め込み（LP・ハウジングツアー・軽減表内に解説動画への導線）
- こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション
- UI全般の温度感・アニメーション改善
- オートプラン精度改善（スプシ教師データ・スコアリングモデル）
- YouTube導線: ジョブごとにスキル回し動画URL設定→軽減表にアイコン表示
- ストラテジーボード連携（保留）
- スクショOCR: ゲーム画面のスクショからダメージ値+軽減スキルを自動読み取り→タイムラインに反映
- 管理画面FFLogsインポート: 管理画面から直接FFLogsインポートしたい（テンプレート作成効率化）
- 横型タイムライン＋音ゲーモード（PiP）: タイムラインを横向きにし、再生ボタンを押すと実時間で右→左に流れる音ゲー風UI。戦闘開始と同時に押すとカンペのように軽減タイミングが流れてくるイメージ。PC: 自分の軽減を大きく目立たせつつ他メンバーの軽減も表示。スマホ: 自分のジョブだけでもOK
- Gemma搭載AI機能: オートプラン高精度化、画像（スクショ等）からの軽減自動追加

### 多言語リファレンスURL（zh/ko翻訳作業用）
- 韓国語スキルデータ: https://guide.ff14.co.kr/job/paladin/1?type=E#pve （ジョブ別スキル名・説明の韓国語公式）
- 中国語スキルデータ: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index （中国語公式ジョブガイド）

## バックログ（運用・品質・検討中）
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ

## プロジェクト方針
### SNS Build in Public
- 進捗時にJP+ENツイート案を提案（ツリー形式、"Translated by AI" 付記）
- #LoPo #FF14 #BuildInPublic #AISelection
