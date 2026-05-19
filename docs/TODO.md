# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #34 で個室・アパ schema を push 済 (13 commit) だが **schema に重大な仕様誤りが判明** (2026-05-19)
- **直近セッション (2026-05-19 #35)**: ルール拡大 + spec 訂正 + Phase 1 plan 作成 (完了)、 Phase 1 schema 訂正実装 (次セッション継続予定)
  - **発覚した誤り**: 公式調査ミスで「subdivision (本街/拡張街) フィールド」 を作ったが、 **実際は plot 1-60 通し番号で判別可能** (31 以上 = 拡張街)。 さらに `ownerType` (個人宅/FC 区別) もユーザー目線で意味なしと判明
  - **訂正方針**: forward fix (本番データなし、 placeholder 段階) で 2 フィールド削除 + plot 範囲を 1-60 に
  - **訂正版 spec**: [`docs/superpowers/specs/2026-05-18-housing-room-types-design.md`](./superpowers/specs/2026-05-18-housing-room-types-design.md) (2026-05-19 訂正版に更新済)
  - **Phase 1 実装 plan**: [`docs/superpowers/plans/2026-05-19-housing-schema-correction.md`](./superpowers/plans/2026-05-19-housing-schema-correction.md) — 9 task の forward fix 手順、 全て code 含めて記載済み、 次セッションは Task 1 から実行
  - **ルール拡大も完了**: `.claude/rules/housing-design.md` の paths を `src/components/housing/**` 全体に拡大 (workspace のみ → 全 housing 配下、 register / dialog / 新規モーダル も独自トンマナ強制)。 `ui-design.md` / `DESIGN.md` の exclude も同範囲拡大、 memory `feedback_housing_design_independent.md` も補強
- **並行進行中**: ユーザー側で「完璧ループの夜景動画」 を毎日試作中
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド
- **既知の残**: schema 訂正 (Phase 1) 実装が次セッションの最優先

---

## 次セッション最優先: Phase 1 schema 訂正実装

**plan**: [`docs/superpowers/plans/2026-05-19-housing-schema-correction.md`](./superpowers/plans/2026-05-19-housing-schema-correction.md)

実行方法 (推奨): subagent-driven-development スキル経由で task-by-task 実行。 9 task すべて code 含めて plan に記載済み。

1. Task 1: PLOT_RANGE を 1-60 に訂正
2. Task 2: 型定義から subdivision / ownerType 削除
3. Task 3: addressKey から S${subdivision} 削除 + テスト書き直し
4. Task 4: validateAddress を 3 パターン (家全体 / FC 個室 / アパ部屋) に簡素化 + テスト
5. Task 5: housingListingsService クエリから subdivision 削除
6. Task 6: register API handler から 2 フィールド保存削除
7. Task 7: firestore.rules を 3 パターン制約に簡素化
8. Task 8: HousingRegisterView の EMPTY_DRAFT + 既存テスト fixture 修正
9. Task 9: 統合確認 (tsc + vitest + build green、 grep で残骸ゼロ)

完了後: commit + push + Vercel デプロイ確認

## 次セッション次優先: Phase 2 登録モーダル UI 実装 (Phase 1 完了後)

spec `2026-05-18-housing-room-types-design.md` §4.1 + ユーザー方針 (2026-05-19 確定):
- ハウジング独自トンマナでモーダル化 (`docs/.private/housing-tour-mockup/index.html` 準拠)
- **SNS URL 欄を最上部** (任意、 将来 OG 解析で住所自動推定する準備)
- **住居タイプ 5 種チップ** (S / M / L / 個室 / アパート) — フィルタ UI と完全統一
- ファイル分け: HousingRegisterModal / Form / SnsUrlField / TypeSelector / AddressFields / RoomNumberField 等
- i18n 4 言語 (ja/en/ko/zh) で約 25 キー × 4 = 100 訳追加
- plan は Phase 1 完了時に新規作成 (`2026-05-19-housing-register-modal.md`)

その後 Phase 3: 物件詳細ページ + 通報 UI 分離 (「ちがった」/「報告」) + 家主異議申し立て (「これは私の家です」)、 Phase 1 設計書 (2026-05-07) §4.2/§4.3/§6.1/§6.5/§7/§9.3 改訂

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
