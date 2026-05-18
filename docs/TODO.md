# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main。 **push 済 (origin と同期)**
- **最新本番デプロイ**: セッション 31 (2026-05-18) で Plan B 補強 + D + E を含む 3 commits push、 Vercel 自動デプロイ中。 production /housing で Filter / Map / Pinterest / RightPanel (auto-scroll) / お気に入りモーダル (DnD + 矩形選択) + ツアー実行 まで動く想定
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド制限 (今日 3 消費)
- **セッション 31 成果 (2026-05-18)**:
  - **Plan B バグ修正**: TopBar に左右パネルトグル追加 (lucide PanelLeftClose/Open、 ツアー中は右トグル disabled、 設計書 §3.3 追記)。 ハマり: 「閉じた後に開けない」 片肺バグ
  - **Plan D 完成**: useAutoScroll hook + RightPanelListItem + AutoScrollList + ShareTourButton + TourKeyboardController (Enter/Space/Arrow) + TourProgressList (active hl + scrollIntoView) + RightPanel (mode 切替)
  - **Plan E 完成**: sortByAddress + useMarqueeSelection + FavoriteCard + FavoritesListPane (Shift/Ctrl/矩形 multi-select) + TourBuilderPane (@dnd-kit + framer-motion FLIP) + MannerNoticeDialog (localStorage 永続化) + FavoritesModal (92vw × 88vh + 「全部回る」 → manner → tour mode)
  - i18n: housing.workspace.{tour, favorites, tour_builder, manner, panels.right_title_tour} を 4 言語追加
  - housing.css に Plan D/E 用 class 計 44 追加、 すべて既存 token 経由 (ハードコード zero)
  - **820 tests pass** (Session 30 から +49)、 production build OK
- **新ルール (物理ファイル反映済)**: `/housing` 配下は LoPo 既存 UI デザイン制約 (白黒のみ / Inter 禁止 / honey 色禁止) **対象外**。 `.claude/rules/housing-design.md` がトリガー、 `ui-design.md` / `DESIGN.md` は frontmatter で housing/** を exclude
- **方針**: 1 ページ完結 Adaptive Workspace。 マップは Phase 2 で本実装、 Sub-spec 2B では仮画像。 iterate-first

---

## 次セッション最優先 (実機目視 → iterate or Plan F)

**確認手順** (Light / Dark 両テーマで一周):
```
https://lopoly.app/housing
# 1. TopBar 左右のパネル開閉トグル (⟨ Filter / Tour ⟩) で開閉できるか
# 2. 左パネル 6 facet chip、 server 段は DC 選択時のみ
# 3. 中央のマップ/一覧 切替、 マップで 5 件 bubble、 一覧で Masonry 50
# 4. 右パネル: 物件リストが auto-scroll で流れる、 ホバーで停止
# 5. TopBar の ♡ (バッジ付き) → お気に入りモーダル開く
# 6. (お気に入り適当に何か追加してから) Shift/Ctrl/矩形ドラッグで multi-select
# 7. ツアービルダー右ペイン: DnD で並び替え、 「住所順に戻す」 トグル
# 8. 「全部回る」 → マナーポップ → はじめる → モーダル閉 + 右パネルがツアー進行モード
# 9. Enter / Space / →/← で次へ/前へ
# 10. 「ツアーを終わる」 で閲覧モードに戻る
```

**選択肢**:
1. **iterate**: 細部の手直しがあれば iterate-first (希望伝えれば即対応)
2. **Plan F 着手** (Finishing) — 登録モーダル接続 + ルーティング (`/housing/p/{id}` / `/housing/tour/{id}`) + a11y + E2E (Playwright) + 親仕様改訂

**残 Plan**:
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
