# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持 (旧目標 50 → 現実的に 100 に緩和、 ただし可能なら 50 を目指す)
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #35 で **Phase 1 schema 訂正 (9 task) 完了 + push 予定**
- **直近セッション (2026-05-19 #35)**: ハウジング schema 訂正版 (subdivision/ownerType 削除 + plot 1-60) を **forward fix で全面置換完了**
  - 前セッション (#34) の公式仕様調査ミスを訂正: plot は **1-60 通し番号** (本街 1-30 + 拡張街 31-60)、 subdivision フィールド不要
  - さらに ownerType (個人/FC 区別) も schema から削除 (ユーザー目線で意味なし、 個室は FC 由来なのは公式仕様で自明)
  - 6 層 (型 / validation / addressKey / API handler / Firestore Rules / service) すべて 3 パターン制約 (家全体 / FC 個室 / アパ部屋) に簡素化
  - **検証**: tsc clean / vitest 850 PASS / build green / `subdivision\|ownerType` grep 残骸ゼロ
  - **訂正版 spec**: [`docs/superpowers/specs/2026-05-18-housing-room-types-design.md`](./superpowers/specs/2026-05-18-housing-room-types-design.md)
  - **Phase 1 plan (完了)**: [`docs/superpowers/plans/2026-05-19-housing-schema-correction.md`](./superpowers/plans/2026-05-19-housing-schema-correction.md)
  - **ハウジング独自トンマナルール拡大も完了**: `.claude/rules/housing-design.md` の paths を `src/components/housing/**` 全体に (workspace のみ → 全 housing 配下、 今後の Phase 2 モーダルも自動的に独自トンマナ強制)、 memory も補強
- **並行進行中**: ユーザー側で「完璧ループの夜景動画」 を毎日試作中
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 10/12**、 月 100 ビルド
- **既知の残**: なし

---

## 次セッション最優先: Phase 2 登録モーダル UI 実装

spec `2026-05-18-housing-room-types-design.md` §4.1 + ユーザー方針 (2026-05-19 確定):

- **ハウジング独自トンマナでモーダル化** (`docs/.private/housing-tour-mockup/index.html` 準拠、 ガラスパネル + ハニーゴールド)
- **SNS URL 欄を最上部** (任意、 将来 OG 解析で住所自動推定する準備、 今は欄だけ用意)
- **住居タイプ 5 種チップ** (S / M / L / 個室 / アパート) — フィルタ UI と完全統一
- 番地 1-60 入力欄の横に「31 以上は拡張街」 注記
- 個室選択時は親家のサイズ (S/M/L) も別 select で入力
- ファイル分け案 (`src/components/housing/register/`):
  - HousingRegisterModal.tsx (モーダル枠、 glass panel)
  - HousingRegisterForm.tsx (state 管理)
  - HousingRegisterSnsUrlField.tsx (NEW、 最上部)
  - HousingRegisterTypeSelector.tsx (NEW、 5 種チップ)
  - HousingRegisterAddressFields.tsx (既存、 番地 1-60 注記追加)
  - HousingRegisterRoomNumberField.tsx (NEW、 タイプ依存で 1-512 or 1-90)
  - HousingRegisterTagPicker.tsx / HousingRegisterDescriptionField.tsx (既存)
- i18n 4 言語 (ja/en/ko/zh) で約 25 キー × 4 = 100 訳追加
- 既存テスト `HousingRegisterAddressFields.test.tsx` の `it.skip` 2 件を復活
- plan は新規作成: `docs/superpowers/plans/2026-05-19-housing-register-modal.md`

## 次セッション次優先 (Phase 2 完了後)

Phase 3: 物件詳細ページ (関連登録表示、 `findChambersInPlot` / `findHouseForChamber` / `findApartmentRoomsInWard` 使用) + 通報 UI 分離 (「ちがった」 1 タップ / 「報告」 理由選択) + 家主異議申し立て (「これは私の家です」 → 運営連絡先) + Phase 1 設計書 (2026-05-07) §4.2/§4.3/§6.1/§6.5/§7/§9.3 改訂

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
