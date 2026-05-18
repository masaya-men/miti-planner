# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 本セッションで `feat(tutorial): share チュートリアル UX 刷新` を 1 commit (push 込) 予定
- **直近セッション (2026-05-18 #4)**: 軽減アプリの**共有チュートリアル UX 刷新**
  - 2 ステップ → 1 ステップに削減 (案内カードのみ)
  - 共有ボタン初回クリックで自動発火 (TutorialMenu からの初学を廃止)
  - 完了/スキップ後に TutorialMenu に項目出現 (再学習用)
  - 背後の `PopularConsentDialog` を操作不可化 (TutorialBlocker active 条件拡張)
  - チュートリアル終了時に ShareModal を強制クローズしない (そのまま共有操作へ進める)
  - 仕様: `docs/superpowers/specs/2026-05-18-tutorial-share-improvements-design.md` / 実装: `docs/superpowers/plans/2026-05-18-tutorial-share-improvements.md`
- **並行進行中**: ユーザー側で **「完璧ループの夜景動画」 を毎日試作中** — 良いの来たら差し替え (CDN 化が済めば高画質版でも OK)
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド
- **既知の残**: なし

---

## 次セッション最優先: Phase 2B 個室・アパート問題

1. **Phase 2B 個室・アパート問題の設計詰め** — `docs/.private/2026-05-17-housing-room-types-design.md` を読んで未確定箇所を決める
2. **実機 iterate** (時間あれば) — TopBar register CTA / SkeletonCard / HousingToast 接続箇所
   - HousingRegisterModal の logged-out branch ヘッダーに × アイコンなし (UX 整合性が気になれば追加検討)
   - SkeletonCard / HousingToast は実装済みだがビュー未接続 → 実機で使い所が見えたら接続

---

## ブラッシュアップ後回しリスト (Plan F 完了後に着手、 忘れない)

- お気に入りモーダル ツアービルダー: スプリング / バウンス / カード押しのけアニメ (FLIP layout を sortable と両立させる工夫が必要)
- 「全部回る」 staging のアニメ視認性向上 (現状 700ms で見えづらい)
- × ボタンの反応速度 (現状 0.12s exit でもまだ気になる)
- 「すべて削除」 ボタンの位置 / hover 調整
- マップ bubble の ♡ ホバー時表示 (設計書 §4.4 厳密準拠)
- TopBar トグルの配置 / 見た目調整

**(将来検討) XIVAuth (FF14 キャラ連携)** — ハウジング登録の本人確認に有用、 ただし XIVAuth 自体の安定性を 3-6 ヶ月様子見

**(Phase 2 で着手)** マップ Figma 書き起こし + 30 軒位置データ + マップクリック登録 + 個室・アパート問題 (`docs/.private/2026-05-17-housing-room-types-design.md`)

---

## 相談したい (次セッションで着手検討)

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード。 デザイン変更伴うため英語ミニマリスト美学との両立を相談
- **SEO 効果計測**: Search Console 未導入。 導入すれば実流入キーワードを把握可

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状。 対応案: sendBeacon / `syncDirtyPlans` 競合判定 / PULL バージョン番号
- **ローカル削除→即同期で復活** (2026-04-28): `deletePlan` が `ownerId === 'local'` で `_deletedPlanIds` 漏れ。 Plan v4 `_createdLoggedIn` 後の再評価必要
- **EventModal 計算肥大**: `handleCalculate` 分割 + calculator.ts と共通化
- **CRIT 倍率ステータス連動**: `CRIT_MULTIPLIER` 固定 → `getCritMultiplier(level)` + IL 切替 UI
- **Timeline 描画 120FPS** (2026-05-14): 要素多いと 8.33ms 超え。 DevTools プロファイル / `will-change` / 仮想スクロール / RAF throttle

---

## バグ・不具合 (要修正)

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs インポート英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー初期位置 / ヘッダー縦罫線サブピクセル
- **Phase 2 follow-up (優先度低)**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items の bullet 分割バグ / `MitigationSheet.copyPlan` の POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応 / AA 名統一
- UI/モバイル: モーダルアニメ / スマホ・タブレット最適化 / SVG アイコンアニメ / 紹介 PV
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline 除去 / Sentry / 認証プライバシー
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除
- ハウジング: 背景動画の画面サイズ別出し分け (`<source media>` で大画面に 2K、 帯域節約。 素材は 2560×1440 で既にあり)
- インフラ: **Cloudflare を Vercel の前段に置く** (無料 / 帯域無制限化) → これ実装すれば動画を高画質 (2K) や無加工美麗版にしても Vercel 帯域は消費されない。 DNS を Cloudflare に切替 + キャッシュルール設定で完了 (30 分作業)
- デッドコード: Lenis (`useSmoothScroll.ts` + テスト + `data-lenis-prevent` 属性 + 依存) 削除でバンドル減

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 優先) / ハウジングは MUL 対象外で広告 OK (memory `project_lopo_mul_constraint.md`)
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / フェーズスペース / みんなの軽減表

<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
