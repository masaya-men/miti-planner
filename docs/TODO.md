# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main 直接
- **最新本番デプロイ**: セッション 23 末 (共有取込シート UX 整備 — ホイール完全復活 + スマホ軽減追加シートをジョブ別化 + 共有取込/上限解消シートのトンマナ統一)
- **注意**: ENFORCE_APP_CHECK=true、 Vercel 関数 9/12、 月 100 ビルド制限
- **軽減アプリ: 完成・公開済み** (2026-04-13 完成ツイート済み)
- **既知の未解決**: 学者列の点線が下まで伸びる本番限定バグ (= 真因不明、 点線描画削除で疑似解決済、 必要なら別セッションで再調査)

---

## 次セッション最優先

1. **ハウジング Sub-spec 2B** (Gallery & Search) — 並行プロジェクト、 lopoly.app/housing 統合方針

---

## 相談したい (次セッションで着手検討)

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード。 デザイン変更伴うため英語ミニマリスト美学との両立を相談
- **SEO 効果計測**: Search Console 未導入。 導入すれば実流入キーワードを把握可
- **アプデ告知機構** (2026-05-16): 新バージョン初回起動時に 1 度だけ告知ダイアログ表示 → PWA 再設定 (キャッシュクリア / SW unload) を案内するボタン併設の構想

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29 報告): 軽減配置直後にタブを閉じて別端末で開くと出ない / 同期競合コピー / PC データが古い状態に戻る等の複合症状。 根本対応案: (1) sendBeacon ベース独自同期 (2) `syncDirtyPlans` 競合判定見直し (3) PULL 時にバージョン番号併用
- **ローカル削除→即同期で復活 潜在バグ** (2026-04-28): `deletePlan` が `ownerId === 'local'` のとき `_deletedPlanIds` に追加しない。 修正: 同期成功後にローカル `ownerId` を `uid` に書き換え (Plan v4 で _createdLoggedIn 経由になったため再評価必要)
- **EventModal 計算ロジック責務肥大**: `handleCalculate` を `applyHealingIncrease` / `applyMitigationFilters` / `applyShieldCalc` 等に分割。 calculator.ts と重複部分は将来共通化
- **CRIT 倍率のステータス連動**: 現状 `CRIT_MULTIPLIER = 1.60` 固定 → `getCritMultiplier(level, ilv?)` 関数化 + IL 切替 UI
- **Timeline 描画 120FPS 維持** (2026-05-14 計測): セッション 20 のスムーズスクロール調整 (stiffness 80 / wheelMultiplier 1.5) で paint 期間は短縮したが、 要素数の多いプランで 1 フレーム 8.33ms を超えカクつく可能性あり。 根本対応: (1) DevTools Performance で 1 フレーム内訳プロファイル → ボトルネック特定 (2) Timeline 列/行に `will-change: transform` 指定で compositor layer 化 (3) 仮想スクロール (画面外行を unmount) (4) onScroll handler の throttle / RAF 統合

---

## バグ・不具合 (要修正)

- **中 (スマホ)**: 攻撃ジャンプ UI で 1 時刻に複数攻撃あるとき、 攻撃を押すと選択肢が画面外にはみ出して押せない。 ポップオーバーを画面内に重ねる方式に変更 (PC は現状維持、 2026-05-16 報告)
- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs インポート英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー初期位置 / ヘッダー縦罫線サブピクセル
- **Phase 2 follow-up (優先度低)**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items の bullet 分割バグ / `MitigationSheet.copyPlan` の POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- **多言語**: ハウジングツアーページ言語対応、 AA 名統一 (英語・中韓も "AA" に)
- **UI / モバイル**: モーダル出現アニメ (スプリング物理ベース、 設計書あり)、 スマホ最適化、 タブレット対応
- **インフラ**: shared_plans クリーンアップ (logoBase64 残留)、 CSP unsafe-inline 除去 (β後)、 Sentry 等エラー監視、 認証プライバシー / Firestore パス検証
- **新機能 (将来)**: Floating Timeline (PiP, Tauri v2)、 FFLogs 精度向上、 ハウジングツアープランナー、 SA 法オートプラン改善、 詠唱バー注釈、 public/icons/ 削除 (バンドル -2.1MB)
- **UI 改善 (検討中)**: SVG アイコンアニメ、 紹介 PV 動画 (CapCut/DaVinci)、 サイドメニュー軽減表名の全文表示 (折返し対応、 切れ ⇄ 折返しのトグル等含めて要相談)、 共有取込シートのスマホ左カラム幅統一 (現状 140px、 「みんなの軽減表」 と完全統一するなら 280px or 縦スタックだがプレビュー併存と相反、 要相談)
- **デッドコード片付け**: Lenis (`src/lib/scroll/useSmoothScroll.ts` + テスト + `data-lenis-prevent` 属性 6 箇所 + package.json 依存) — `useSmoothScroll` はテスト以外どこからも呼ばれていない。 削除でバンドルサイズ削減

---

## アイデア・やりたいこと

YouTube 埋め込み / こだわりトップページ (AI デザイン NG) / 軽減配置フィードバックアニメ / オートプラン精度改善 (スプシ教師データ) / YouTube 導線 (ジョブ別スキル回し動画) / スクショ OCR / 管理画面 FFLogs インポート / 横型タイムライン + 音ゲーモード (PiP) / Gemma 搭載 AI 機能

### 多言語リファレンス URL (zh/ko 翻訳作業用)

- 韓国語: https://guide.ff14.co.kr/job/paladin/1?type=E#pve
- 中国語: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index

---

## プロジェクト方針

- **コンテンツ追加フロー**: `npm run add-content` (contents.json 編集) → `npx tsx scripts/seed-contents.ts` (Firestore 同期) の 2 ステップ。 admin 画面からも追加可能 (セッション 22 で機能修正済)
- **スキルデータ管理**: Firestore = 正本 (管理画面が正規ワークフロー)、 mockData.ts = フォールバック + テスト + 初期 seed、 seed-skills-stats.ts = マージ型 (Firestore のみのスキルは保持)
- **SNS Build in Public**: 進捗時に JP+EN ツイート案を提案 (ツリー形式、 "Translated by AI" 付記)、 ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`

---

## 並行プロジェクト

- **マイコラージュ (収益化アプリ、 別プロジェクト)**: ユーザー優先指示継続、 並行進行
- **ハウジングツアー** (lopoly.app/housing 統合、 MUL 対象外で広告 OK): Sub-spec 2A 完了、 2B (Gallery & Search) 着手予定、 詳細は memory `project_lopo_mul_constraint.md`

---

## バックログ

運用 (npm audit / a11y / SE 利用規約 / GDPR / SEO) / 検討中 (FFLogs アイコン、 チートシート MTST 分け、 フェーズスペース、 テンプレ日本語名、 みんなの軽減表、 軽減モーダルサイズ)

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
