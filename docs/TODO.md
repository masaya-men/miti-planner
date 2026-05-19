# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 本セッションで個室・アパ schema 確定の 13 commit を push して Vercel 自動デプロイ
- **直近セッション (2026-05-18/19 #34)**: ハウジング**個室・アパート対応 schema 確定**
  - spec/plan 新規作成、 subagent-driven で 7 task + 統合確認を TDD 完走
  - 新 schema: `HousingListing` に `subdivision` / `buildingType` / `ownerType` / `roomKind` / `roomNumber` 追加、 旧 `apartmentRoom` 廃止、 旧 `'Apartment'`/`'PrivateRoom'` size 削除
  - 6 層 (型 / validation / buildAddressKey / register handler / Firestore Rules / service クエリ) に整合性制約 4 パターン (個人宅 / FC 全体 / FC 個室 / アパ部屋) を反映
  - 既存 UI / store / mock / 既存テストを暫定対応 (Apartment UI 一時削除 → Sub-spec 2B で再実装、 it.skip 2 件は意図的)
  - 検証: build green / vitest 850 PASS / 2 skipped / 0 failed、 final review 指摘 (i18n plot 1〜30 訂正 + ChamberQuery dc/server 追加) も解決済み
  - 仕様: `docs/superpowers/specs/2026-05-18-housing-room-types-design.md` / 実装: `docs/superpowers/plans/2026-05-18-housing-room-types.md`
- **並行進行中**: ユーザー側で **「完璧ループの夜景動画」 を毎日試作中** — 良いの来たら差し替え (CDN 化が済めば高画質版でも OK)
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド
- **既知の残**: なし

---

## 次セッション最優先: Sub-spec 2B 系 UI 実装 (schema 基盤完成済み)

1. **登録モーダル 4 タイプ選択 UI 実装** — `HousingRegisterAddressFields.tsx` に住居タイプ選択 (個人宅 / FC ハウス / FC 個室 / アパート) と subdivision / roomNumber 入力 UI を追加、 spec `2026-05-18-housing-room-types-design.md` §4.1 通り
2. **物件詳細ページ 関連登録表示** — `findChambersInPlot` / `findHouseForChamber` / `findApartmentRoomsInWard` を使った詳細表示 (spec §4.2)
3. **フィルタ UI 5 種チップ復活** (2026-05-19 確定) — 左パネル「サイズ」 セクションに `[S] [M] [L] [個室] [アパート]` の 5 チップ (個人宅 vs FC ハウスはフィルタとして区別しない、 spec §4.4)。 `FilterPanel.tsx` + `useHousingFilterStore.ts` を新方針で実装し、 Task 8 で `it.skip` 化した 2 テストを復活
4. **通報 UI 分離** — 「ちがった」 (1 タップ wrong_info) + 「報告」 (理由選択) の 2 ボタン構成 (spec §5.2)
5. **家主異議申し立て導線** — 「これは私の家です」 ボタン → 運営連絡先誘導 (spec §5.3、 連絡先 URL も決める)
6. **Phase 1 設計書改訂** — `2026-05-07-housing-tour-phase1-design.md` の §4.2/§4.3/§6.1/§6.5/§7/§9.3 を本 spec §6.1 リスト通りに更新

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
