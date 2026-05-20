# LoPo 開発 ToDo

> **維持ルール (必読)**:
> - **100 行以内を目標**に維持
> - 完了タスクは即 [TODO_COMPLETED.md](./TODO_COMPLETED.md) へ移動
> - 大きな設計議論 / 詳細未確定の議題は `docs/.private/YYYY-MM-DD-{topic}.md` に集約
> - 確定済み設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md)、 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md)
> - **セッション終了時に必ず本ファイルの行数を確認 → 超過していたら整理**

---

## 現在の状態 (次セッションはここから読む)

- **ブランチ**: main、 セッション #41 (2026-05-20) で **hash 化マイグレーション Step 2 完了**
- **完了**: Discord 10 件全部の uid を `hashed:` 形式に移行。 10/10 verify PASS、 全データ無事
- **secret 保管**: `LOPO_PSEUDONYM_SECRET` を Vercel sensitive (prod/preview) + .env.local + iPhone メモ の 3 箇所バックアップ済 (rotation 不可)
- **設計書 / プラン**: [docs/superpowers/specs/2026-05-20-hash-migration-step2-design.md](superpowers/specs/2026-05-20-hash-migration-step2-design.md) / [docs/superpowers/plans/2026-05-20-hash-migration-step2.md](superpowers/plans/2026-05-20-hash-migration-step2.md)
- **注意**: 本人の avatar.webp + team-logo.jpg が migration バグで Storage 消失 → LoPo UI 経由で再アップロード要
- **教訓**: Step 1 already-migrated check を Step 0 window sweep より先に置く順序バグを発見・修正済
- **注意**: ENFORCE_APP_CHECK=true、 **Vercel 関数 11/12**、 月 100 ビルド

---

## 次セッション最優先: ハウジング ログイン UI 整備の再開

1. **準備メモを再確認** ([docs/.private/2026-05-19-hash-migration-prep.md](docs/.private/2026-05-19-hash-migration-prep.md) の §「ハウジング ログイン UI 整備の 6 項目」)
2. hash 化完了で「LoPo は連絡できません」 が事実として真になった状態でログイン文言を適用
3. 6 項目を順に実装

### pause 中のハウジング UI タスク (6 項目)

- ハウジング 右上 TopBar ログインボタン + ハウジング版 LoginModal (ハニーゴールドトンマナ) + 登録モーダル 2 層スタッキング
- `fieldState.confirm()` バグ究明 (state="confirmed" に切り替わらない、 isReadyToSubmit auto-filled 許容で回避中)
- 登録モーダル UX 磨き (✅ バッジ警告色化 / checklist アニメ / 確認モーダル整形)
- 旧 `workspace/HousingRegisterModal.tsx` と `HousingRegisterView.tsx` の dead code 撤去
- AddressFields の `renderBadge` prop 化、 tweet 取得の rate limiting、 photo `alt` 属性

## 次セッション次優先 (hash 化 + ハウジング UI 完了後)

Cloudflare 前段化 (DNS 切替 30 分) → Phase 2B (マップ Figma 書き起こし + 30 軒位置データ + マップクリック登録) → Phase 3 (物件詳細ページ + 通報 UI 分離 + 家主異議申し立て + ツアー同期)

**Phase 3 通報フロー仕様 (2026-05-19 確定)**:
- 自分の登録は編集・削除を必ず可能に
- 「ちがった」 押下 → 登録者にアプリ内通知 (通報者 ID は渡さない)
- 虚偽通報の異議申し立ては LoPo Discord サーバーで運営 DM 受付 → 管理画面で `reportCount` を 0 リセット
- 上記すべて + ハウジング関連の運営作業全般 (BAN / 強制削除 / quota リセット 等含む) は `/admin` で完結 (memory `feedback_housing_admin_complete.md` 参照)

---

## ブラッシュアップ後回しリスト (Plan F 完了後に着手)

- お気に入りモーダル ツアービルダー: スプリング / バウンス / カード押しのけアニメ
- 「全部回る」 staging アニメ視認性 / × ボタン反応速度 / 「すべて削除」 ボタン位置
- マップ bubble の ♡ ホバー時表示 / TopBar トグル配置
- **(将来検討)** XIVAuth (FF14 キャラ連携) — 安定性を 3-6 ヶ月様子見

---

## 相談したい

- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワード (デザインとの両立相談)
- **SEO 効果計測**: Search Console 未導入

---

## 既知の残課題 (中規模、 別セッションで設計から)

- **同期不安定** (2026-04-29): 軽減配置→タブ閉→別端末で消失等の複合症状
- **ローカル削除→即同期で復活** (2026-04-28): `deletePlan` の `_deletedPlanIds` 漏れ
- **EventModal 計算肥大**: `handleCalculate` 分割 + calculator.ts と共通化
- **CRIT 倍率ステータス連動**: `getCritMultiplier(level)` + IL 切替 UI
- **Timeline 描画 120FPS** (2026-05-14): 要素多いと 8.33ms 超え

---

## バグ・不具合 (要修正)

- **中**: ラベル名が管理画面で取得できない (スプシヘッダー問題?)
- **低 (動作影響なし)**: FFLogs 英語ログ / 無敵反映 / オートプラン同一技 / パルス設定スライダー / ヘッダー縦罫線
- **Phase 2 follow-up**: api/popular の `viewCount` 削除 / en/ko privacy_section1_auto_items bullet バグ / `MitigationSheet.copyPlan` POST 失敗時 localStorage 残留

---

## 未着手・将来計画

- 多言語: ハウジング言語対応 / AA 名統一
- UI/モバイル: モーダルアニメ / スマホ・タブレット最適化 / SVG アイコンアニメ / 紹介 PV
- インフラ: shared_plans クリーンアップ / CSP unsafe-inline / Sentry / Cloudflare 前段 / 認証プライバシー (← Step 1 完了で大幅前進)
- 新機能: Floating Timeline (Tauri v2) / FFLogs 精度 / SA 法改善 / 詠唱バー注釈 / public/icons/ 削除
- デッドコード: Lenis (`useSmoothScroll.ts`) 削除でバンドル減 / ハウジング背景動画の画面サイズ別出し分け

---

## アイデア / プロジェクト方針 / 並行 / バックログ

- アイデア: YouTube 埋込/導線、 こだわりトップ、 配置アニメ、 OCR、 横型タイムライン、 Gemma AI
- 方針: コンテンツ追加 = `add-content` → `seed-contents.ts`、 スキル正本 = Firestore、 SNS ハッシュタグ `#LoPo #FF14 #BuildInPublic #AISelection`
- 並行: マイコラージュ (収益化、 優先) / ハウジングは MUL 対象外で広告 OK (memory `project_lopo_mul_constraint.md`)
- バックログ: npm audit / a11y / SE 利用規約 / GDPR / SEO / FFLogs アイコン / MTST 分け / みんなの軽減表
<!-- When compacting, always preserve: 現在のタスク、変更中のファイルパス、本ファイルの「現在の状態」セクション -->
