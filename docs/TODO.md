# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main 直接、 **17 commits ahead of origin/main (未 push)**
- **最新本番デプロイ**: セッション 26 (X ログイン全撤去)。 Plan A は production に出ていない
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド制限
- **セッション 29 (2026-05-18) 成果**: **モックアップ視覚再構築完了** (commit 34a680b)。 styles/housing.css 全面拡張 (独自デザイントークン / panel chrome / scenery overlay + starfield)。 LiquidGlassPanel に chrome 追加 (ring border + corner highlights + sheen + box-shadow)。 HousingWorkspace を CSS grid (60/1fr/40 行 × 280/1fr/360 列)。 TopBar = ブランド + パンくず + 丸薬テーマトグル (honey gradient)。 StatusBar = テレメトリ (Build/Lat-Lon/Theme + Stops/ETA/FPS + 言語切替小型 pill)。 検索/登録/❤/アバターは一旦撤去 (Plan E で再配置検討)。 **738 tests pass**。 両テーマ目視確認済み
- **新ルール (物理ファイル反映済)**: `/housing` 配下は LoPo 既存 UI デザイン制約 (白黒のみ / Inter 禁止 / honey 色禁止) **対象外**。 `.claude/rules/housing-design.md` がトリガー、 `ui-design.md` / `DESIGN.md` は frontmatter で housing/** を exclude。 memory `feedback_housing_design_independent.md`
- **重要**: 中身はまだ placeholder。 push すると production /housing が空スケルトンに退化するため、 Plan B/C 完了まで push 保留継続
- **方針**: 1 ページ完結 Adaptive Workspace。 マップは Phase 2 で本実装、 Sub-spec 2B では仮画像。 iterate-first

---

## 次セッション最優先 (Plan B + C 並列実装)

**起動**:
```bash
npm run dev
# http://localhost:5173/housing で確認 (Light/Dark 両テーマで chrome OK 確認済)
```
追加の見た目調整希望があれば iterate-first、 なければ Plan B/C へ。

**手順**:
1. `docs/superpowers/plans/2026-05-17-housing-sub-spec-2b-plan-b-filter-panel.md` (左パネル Faceted Search) と
   `docs/superpowers/plans/2026-05-17-housing-sub-spec-2b-plan-c-center-area.md` (中央 Map/Pinterest + inline expansion) を確認
2. `superpowers:subagent-driven-development` skill 起動
3. **Plan B と C は別パネル (左 / 中央) を触るので並列 subagent dispatch 可能**
4. CSS は `src/styles/housing.css` の design tokens (--housing-*) を利用、 ハードコード厳禁
5. 完了後 Plan D (右パネル) → E (お気に入りモーダル + 検索/登録/❤/アバター再配置) → F (Finishing + E2E + push + deploy)

**push/deploy タイミング**: Plan B + C 完了 (UI に意味ある中身が入る) で push → Vercel 自動デプロイ。 一度に 1 回で済ませて Vercel ビルド枠節約

**残 Plan**:
- B: Filter Panel (Faceted Search) — 並列 OK
- C: Center Area (Map/Pinterest 切替 + inline expansion) — 並列 OK
- D: Right Panel (auto-scroll + ツアー進行)
- E: Favorites Modal (DnD + 矩形選択 + ツアー組立)
- F: Finishing (登録接続 + ルート + a11y + E2E + 親仕様改訂)

**(将来検討) XIVAuth (FF14 キャラ連携)** — ハウジング登録の本人確認に有用、 ただし XIVAuth 自体の安定性を 3-6 ヶ月様子見

**(Phase 2 で着手)** マップ Figma 書き起こし + 30 軒位置データ + マップクリック登録 + 個室・アパート問題 (`docs/.private/2026-05-17-housing-room-types-design.md`)

---

## 相談したい (次セッションで着手検討)

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード。 デザイン変更伴うため英語ミニマリスト美学との両立を相談
- **SEO 効果計測**: Search Console 未導入。 導入すれば実流入キーワードを把握可

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29 報告): 軽減配置直後にタブを閉じて別端末で開くと出ない / 同期競合コピー / PC データが古い状態に戻る等の複合症状。 根本対応案: (1) sendBeacon ベース独自同期 (2) `syncDirtyPlans` 競合判定見直し (3) PULL 時にバージョン番号併用
- **ローカル削除→即同期で復活 潜在バグ** (2026-04-28): `deletePlan` が `ownerId === 'local'` のとき `_deletedPlanIds` に追加しない。 修正: 同期成功後にローカル `ownerId` を `uid` に書き換え (Plan v4 で _createdLoggedIn 経由になったため再評価必要)
- **EventModal 計算ロジック責務肥大**: `handleCalculate` を `applyHealingIncrease` / `applyMitigationFilters` / `applyShieldCalc` 等に分割。 calculator.ts と重複部分は将来共通化
- **CRIT 倍率のステータス連動**: 現状 `CRIT_MULTIPLIER = 1.60` 固定 → `getCritMultiplier(level, ilv?)` 関数化 + IL 切替 UI
- **Timeline 描画 120FPS 維持** (2026-05-14 計測): セッション 20 のスムーズスクロール調整 (stiffness 80 / wheelMultiplier 1.5) で paint 期間は短縮したが、 要素数の多いプランで 1 フレーム 8.33ms を超えカクつく可能性あり。 根本対応: (1) DevTools Performance で 1 フレーム内訳プロファイル → ボトルネック特定 (2) Timeline 列/行に `will-change: transform` 指定で compositor layer 化 (3) 仮想スクロール (画面外行を unmount) (4) onScroll handler の throttle / RAF 統合

---

## バグ・不具合 (要修正)

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs インポート英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー初期位置 / ヘッダー縦罫線サブピクセル
- **Phase 2 follow-up (優先度低)**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items の bullet 分割バグ / `MitigationSheet.copyPlan` の POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- **多言語**: ハウジングツアーページ言語対応、 AA 名統一 (英語・中韓も "AA" に)
- **UI / モバイル**: モーダル出現アニメ、 スマホ最適化、 タブレット対応 / SVG アイコンアニメ / 紹介 PV / サイドメニュー軽減表名折返し / 共有取込シートスマホ左カラム幅統一
- **インフラ**: shared_plans クリーンアップ、 CSP unsafe-inline 除去 (β後)、 Sentry、 認証プライバシー
- **新機能 (将来)**: Floating Timeline (Tauri v2)、 FFLogs 精度向上、 ハウジングツアープランナー、 SA 法オートプラン改善、 詠唱バー注釈、 public/icons/ 削除 (-2.1MB)
- **デッドコード片付け**: Lenis (`src/lib/scroll/useSmoothScroll.ts` + テスト + `data-lenis-prevent` 属性 6 箇所 + package.json 依存) — テスト以外未使用、 削除でバンドル減

---

## アイデア・やりたいこと

YouTube 埋め込み / こだわりトップページ (AI デザイン NG) / 軽減配置フィードバックアニメ / オートプラン精度改善 (スプシ教師データ) / YouTube 導線 (ジョブ別スキル回し動画) / スクショ OCR / 管理画面 FFLogs インポート / 横型タイムライン + 音ゲーモード (PiP) / Gemma 搭載 AI 機能

(zh/ko 訳語確認 URL は memory `reference_ff14_jobguide_urls.md`)

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
