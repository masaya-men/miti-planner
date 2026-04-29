# LoPo 開発ToDo

> 完了済みタスクは [TODO_COMPLETED.md](./TODO_COMPLETED.md) に移動済み
> 確定した設計方針は [DESIGN_DECISIONS.md](./DESIGN_DECISIONS.md) を参照
> 管理者手順は [ADMIN_SETUP.md](./ADMIN_SETUP.md) を参照

---

## 現在の状態（次セッションはここから読む）

- **ブランチ**: main直接
- **注意**: ENFORCE_APP_CHECK=true、Vercel関数9/12、月100ビルド制限
- **軽減アプリ: 完成・公開済み（2026-04-13 完成ツイート済み）**
- **最新セッション（2026-04-29・イベント追加モーダル UI 全面改善）**: 設計書 `docs/superpowers/specs/2026-04-29-event-modal-mitigation-improvements-design.md` + 実装プラン `docs/superpowers/plans/2026-04-29-event-modal-mitigation-improvements.md` に基づき、PC/スマホ共通の EventModal.tsx を全面改善。20 コミットを EventModal.tsx ファイル内に閉じて他コンポーネントへの影響ゼロで実施: ①並び順を 3 グループ構成（全体軽減 → タンクLB → 個別軽減）に再構成、各グループ内ロール T→H→D → ジョブ順 → リキャスト短→長、前提スキル (requires) は親の直後に配置 ②純粋回復スキル自動除外ルール追加（healingIncrease なしを判定） ③mantra/nature_s_minne を EXCLUDED から復帰、riddle_of_earth と aspected_helios を追加 ④単体バフ (scope='target') 選択時に MT|ST トグル UI を直下に表示、計算で被対象者と突合 ⑤鼓舞展開 3 バリアント実装（展開戦術 / +秘策 / +秘策+生命回生法）、排他選択、CRIT_MULTIPLIER 1.60 と protraction.healingIncrease 動的取得で実シールド倍率計算、学者不在時 DEFAULT_HEALER_STATS フォールバック、アイコンは「展開戦術ベース＋右上秘策バッジ＋右下生命回生法バッジ」の重ね方式 ⑥ニュートラルセクト押下で lv96+ コンジャ／lv95- アスペクト・ヘリオスのバリアを自動加算（占星不在時もフォールバック）、SKILL_DATA キー名に揃えて修正 ⑦Timeline.tsx のプラン切替 useEffect で「チュートリアル中 or 空プラン」では hideEmptyRows リセットをスキップ。build+test 244 PASS、ユーザー実機 OK、デプロイ完了。
- **前セッション（2026-04-29・PC イベントモーダル軽減プレビュー）**: PC のイベント追加モーダル「使用された軽減・バリア」横の選択軽減プレビューが `slice(0, 4)` ハードコードで 4 個固定 + `+N` 省略になっていた問題を修正。`flex-wrap` で全件表示・右寄せ・必要に応じて折り返し、`+N` 省略を撤去、ラベル側に `shrink-0` で折り返し防止。スマホ側（MobileTimelineRow）は別実装のため影響なし。build+test 244 PASS、ユーザー実機 OK 確認済み。
- **前セッション（2026-04-29・離脱ダイアログ廃止 → revert）**: タブ離脱ダイアログを削除する変更を入れたが、ユーザー報告で別端末同期不整合・PC のデータが古い状態に戻る等の症状が判明。原因仮説は「旧コードはダイアログ表示の数秒間で Firestore SDK の async write が完了していたのが、削除後は完了前にタブが閉じる」。被害最小化のため 2 コミット即 revert して元の挙動に戻した。離脱ダイアログは復活、データ同期は元の信頼性に戻る。build+test 244 PASS、デプロイ完了。
- **前セッション（2026-04-29・SEO canonical 追加）**: Search Console「ページにリダイレクトがあります」通知の調査。対象は `http://lopoly.app/` のみで HTTP→HTTPS の正常 308、対処不要と判明。あわせて SEO 改善の基礎固めとして `useCanonicalUrl` フックを新設、全公開ページ（/、/miti、/share/:id、/popular、/privacy、/terms、/commercial）に `<link rel="canonical">` を動的注入。SPA で utm パラメータ・末尾スラッシュ違いが重複ページ判定されるのを防ぐ。build+test 244 PASS、デプロイ完了。次は Search Console URL 検査での再クロール要求。
- **前セッション（2026-04-29・プラン切替リセット）**: ユーザー報告「別プランを開いても横スクロール位置と空行非表示トグルが引き継がれる」を修正。`Timeline.tsx` のプラン切替 `useEffect` が `scrollTo({ top: 0 })` で縦のみリセットしていた点を `top: 0, left: 0` に拡張、加えて `setHideEmptyRows(true)` を呼びコンパクト表示に戻す。フェーズ列・ラベル列の折りたたみはユーザー操作の状態を維持する判断で意図的に触らない。build+test 119 PASS、デプロイ完了、実機 OK（チュートリアル含む）確認済み。
- **前セッション（2026-04-28 深夜・スマホ空行操作）**: スマホでイベントの無い行にも軽減配置・イベント追加できるように改修。`MobileTimelineRow.tsx` の長押し／タップ両方の `events.length > 0` ガードを撤去、`onLongPress` 引数を `TimelineEvent | null` に拡張。`Timeline.tsx` `handleMobileLongPress` で event=null のとき直接 EventModal を開く（PC の `+` ボタン相当）。空行表示は既存の `hideEmptyRows` トグル（FAB）に依存、変更なし。build+test 244 PASS。
- **前セッション（2026-04-28 終盤・5 段目）**: 4 段目で OGP プレビュー本体は治ったが「URL の生成に失敗」トーストがたまに発生。原因は **PUT /api/share のレート制限 5 回/分**で、ロゴ操作を連続でやると到達してしまうこと。共有モーダルでのロゴ追加・削除・トグルは正常な使い方なので、レート制限を **5 → 15 回/分に緩和**。PUT は既存共有のロゴ差し替えのみで破壊的でなく、サーバーコストも軽量で安全。build+test 244 PASS。
- **前セッション（2026-04-28 終盤・4 段目）**: 3 段目でも治らない真の根本原因を特定。**React closure 問題**だった。`processLogoFile` で `setTeamLogoUrl(url)` 直後に `await updateShareLogo(true)` を呼んでいたが、updateShareLogo の closure 内では teamLogoUrl がまだ古い null のまま。結果サーバーに「ロゴ無し PUT」を送ってしまい同じロゴ無し imageHash が返ってきて React bail-out。「右上の更新ボタンで動く」のは次の render 後で closure が更新されているから。**updateShareLogo に `logoUrlOverride` 引数を追加**して `processLogoFile` から最新 url を直接渡し、closure を回避。これが本質的修正。
- **前セッション（2026-04-28 終盤・3 段目）**: `updateShareLogo` 冒頭で `setOgImageUrl(null)` を挟んで `<img>` を確実にアンマウント→マウント。state bail-out 対策。closure 問題が真因だったため、3 段目だけでは不十分だが保険として有効。
- **前セッション（2026-04-28 終盤・2 段目）**: ShareModal の `<img>` に `key={ogImageUrl}` を追加して URL 変更時に強制再マウント。サーバー側 PUT 200 成功しても /og/ リクエストが発行されない事象への対策。Vercel ログで判明。
- **前セッション（2026-04-28 終盤）**: 共有モーダル OGP プレビュー「永遠に生成中」バグ修正 1 段目。原因は **古い PWA Service Worker が `/og/{hash}.png` のフェッチを呑んで永遠 Pending にする** 事象。systematic-debugging で `<img>` 要素は DOM 存在 + src 正しい→ブラウザがリクエスト未発行→SW unregister で復活、を順に検証して特定。`vite.config.ts` の workbox `runtimeCaching` に `/og/[a-f0-9]{16}.png` を **NetworkOnly** で明示追加。新版デプロイ後に新 SW が `clientsClaim` で即時切替される。
- **前セッション（2026-04-28 後半）**: 致命バグ修正＋同意ダイアログ白背景化＋プラン名自動採番。①PopularConsentDialog をライトモードで白背景化（他主要モーダルと同じ `--share-modal-bg` を適用）。②**致命バグ**: 野良主流ボトムシートからのコピーで `ownerId: ''` 空文字になっており、雲同期で「別端末で削除」と誤判定されてプランが丸ごと消滅していた問題を修正（過去 4 回直したのと同パターンが新規入口に再発、`ownerId: 'local'` に統一）。③`generateUniqueTitle` ユーティリティを新設し、野良主流コピーと「下にコピー」の両方で同コンテンツ内重複時に `(2)` を自動採番。build+test 244 PASS。
- **前セッション（2026-04-28）**: 野良主流 OGP 表示ポリシー整理 完了。プラン名 OGP 焼き込み機能を全削除（lib/API/UI/i18n）、野良主流シート・ページのカードからプラン名撤去、X 共有テキストも `コンテンツ名` のみに。共有モーダル初回 POST 直前に同意ダイアログ表示（localStorage 永続）、ロゴトグル＝身元公開意思の明確化、4 言語常駐キャプション追加。設計書: `docs/superpowers/specs/2026-04-28-popular-ogp-consent-design.md`
- **前セッション（2026-04-20 後半）**: LP の SEO 改善（レベル 1）完了。index.html / 4 言語 locale / LandingPage.tsx を更新し、「FF14 軽減表」等の検索キーワードをメタタグに反映。多言語対応（ja=軽減表、en=mitigation sheet、ko=경감 시트、zh=减伤轴）。見た目変更なし、build+test 成功。設計書: `docs/superpowers/specs/2026-04-20-lp-seo-meta-multilingual-design.md`
- **前セッション（2026-04-20）**: Vercel 2026年4月セキュリティインシデント対応。Vercel CLI 導入、監査（不正侵入痕跡ゼロ確認）、全カスタム環境変数を production/preview で sensitive 化（29本）、動作確認＆デプロイ完了。
- **前セッション（2026-04-18 夜）**: 学者エーテルフロー実機確認後の調整。削除/ずらし尊重ガード追加（hasAnyAetherflow）、ポップアップ「いいえ」廃止＋×/Esc 化＋ライトモード白背景化。デプロイ済み、実機再確認は次セッション。
- **前セッション（2026-04-18 後半）**: 学者エーテルフロー仕様を全面刷新。スキル化＋自動配置＋ポップアップ実装、Pattern 切替ボタン廃止。
- **前セッション（2026-04-18 前半）**: サイドバータブリセットバグ修正 + ヘッダー罫線統一 + フェーズ/ラベル境界系3連修正 すべてデプロイ・検証済み
- **シークレット漏洩 3層防御 導入済み（全プロジェクト自動診断）**

### 次にやること（優先順）
- ハウジングツアープランナー着手（別プロジェクト作業後に開始）
- デプロイ確認: サイレント圧縮の実動作（2026-04-20以降に確認）

### スマホ空行への軽減配置・イベント追加 2026-04-29 — 実機 OK 確認済み

### プラン切替時のスクロール/空行非表示リセット 2026-04-29 — 実機 OK 確認済み（チュートリアル含む）

### 前セッション実機検証（致命バグ修正 + 自動採番 2026-04-28 後半）すべて OK
- [x] 野良主流ボトムシートから FRU コピー → 雲同期 → プランが消えないこと
- [x] 同じプランを 2 回コピー → 2 つ目が `タイトル (2)`、3 つ目が `(3)` になる
- [x] サイドバー「下にコピー」も同コンテンツ内のみで採番されること
- [x] 別コンテンツに同名プランがあっても採番に巻き込まれないこと
- [x] PopularConsentDialog がライトモードで白背景になっていること

### 相談したい（次セッションで着手検討）
- **リキャスト本格表示**: 各スキルのリキャストを実戦に近い形で視覚化したい。具体案（CD 棒グラフ重ね／次使用可能時刻ホバー等）は未定、着手前に Claude と相談
- **SEO レベル 2**: LP の Hero サブタイトル・カード説明に日本語キーワードを盛り込む。デザイン変更伴うため、現状英語ミニマリスト美学とどう両立するかを相談
- **SEO 効果計測**: Search Console 未導入。導入すれば実際に流入しているキーワードを把握できる

### 次セッションで実機再確認すること（学者フロー調整 2026-04-18 夜）
- [ ] エーテルフローを削除した後、ジョブ一括更新やパーティ操作で復活しないか
- [ ] エーテルフローを大きくずらしても初期配置 (t=13,73,...) が補充されないか
- [ ] 賢者→学者にジョブ変更 → 転化＋フローが自動配置されるか
- [ ] 編集後保存→再読込でユーザー編集が保持されるか
- [ ] 「野良主流」ボタンから popular プラン（旧 Pattern 2）を開くと migration が走るか
- [ ] ポップアップが ×/Esc/背景クリックで閉じる、ライトモードで白背景になっているか

### イベント追加モーダル 残課題

#### 優先度: 高
- **計算ロジック責務肥大（リファクタ）**: `EventModal.tsx` の `handleCalculate` が healingIncrease 集計 / scope フィルタ / MT-ST 突合 / 鼓舞展開 / ニュートラルセクト分岐 / value mitigation / shield calc など 8 段階を担う。`applyHealingIncrease` / `applyMitigationFilters` / `applyShieldCalc` 等への分割を検討。Timeline 本体側の同種計算（calculator.ts）と重複している部分は将来共通化すべき
- **CRIT 倍率のステータス連動**: 現状 `calculator.ts` の `CRIT_MULTIPLIER = 1.60` は固定値（コメントにも "approx 1.60 for now"）。本来 FF14 のクリティカル倍率は装備のクリダメステータスから `1.40 + (CRIT - 420) × 200 / 100000` で算出される。IL/装備帯ごとに 1.55〜1.65 程度で変動。`getCritMultiplier(level, ilv?)` 関数化 + 設定画面での IL 切替 UI が理想。calculator.ts の CRIT 計算箇所すべてに波及するため中規模の機能追加

#### 優先度: 最低（やらない判断もアリ）
- **Phase 3（理想形・別セッションで設計）**: パーティメンバー個別 (H1/H2/D1-D4) の target 指定 / 鼓舞インスタンス選択 UI / Timeline と同じ owner/targetId モデル統合。実用上は MT/ST トグルで足りているため優先度最低

### 既知の残課題
- **同期不安定（2026-04-29 報告）**: 軽減配置直後にタブを閉じて別端末で開くと出ない / 同期ボタンを押しても出ない / 同期競合コピーが作られる / PC データが古い状態に戻る等の複合症状。離脱ダイアログ廃止が悪化させた可能性が高く revert 済みだが、症状が「前から起きていた」可能性もユーザー認識あり。根本対応案: (1) sendBeacon ベースの独自同期エンドポイント新設、(2) `syncDirtyPlans` の競合判定ロジック見直し（updatedAt のクライアント時計依存）、(3) PULL 時の上書き条件を `updatedAt` だけでなくバージョン番号併用に変更。中規模工数、別セッションで設計から検討。
- ヘッダー縦罫線 2 番目のサブピクセル残存（実害なし、放置判断）
- **同期済みプランをローカル削除→即同期で復活する潜在バグ**（2026-04-28 後半発見）。原因: `deletePlan` が `ownerId === 'local'` のとき `_deletedPlanIds` に追加せず、Firestore に削除指示を出さない。同期成功後もローカルの `ownerId` は `'local'` のまま。発生条件は限定的（削除直後に新規コピー＆同期）でユーザー判断「重要度低」。修正方針: `syncDirtyPlans` 同期成功後に ローカル `ownerId` を `uid` に書き換える根本対応が必要。同期ロジックの中核に触るため別セッションで設計から検討。

---

## バグ・不具合（要修正）

### 中
- [ ] ラベル名が管理画面で取得できない（スプシヘッダー問題？）

### 低（動作影響なし・エッジケース）
- [ ] FFLogsインポート: 英語主言語ログで言語取得できない
- [ ] FFLogsインポート: 無敵/リビングデッド中ダメージの反映
- [ ] オートプラン: 無敵はなるべく同じ技に使いたい
- [ ] パルス設定: カスタムカラーのスライダー初期位置が端に寄る（軽微）
- [ ] ヘッダー縦罫線 2 番目のみサブピクセルで細く見える（`w-px shrink-0` 適用後も残存、実害なし）

### Phase 2 後の follow-up（優先度低）
- [ ] `api/popular/index.ts` `mapDoc` と `PopularEntry` 型の `viewCount` フィールドは Phase 2 以降未使用 → 削除整理
- [ ] en/ko の `privacy_section1_auto_items` 既存翻訳でインラインコンマが bullet 分割される pre-existing バグ
- [ ] `PopularPage.tsx` `handleCopyAllRank` の localStorage persist がループ外（影響軽微）
- [ ] クライアント dedup の書き込みタイミング問題（`MitigationSheet.tsx` `copyPlan`）: POST 失敗でも localStorage に残る

---

## 未着手

### 多言語
- [ ] ハウジングツアーページの言語対応
- [ ] AA名統一: 英語も"AA"に変更（中韓も同様）

### その他
- [ ] モーダル出現アニメーション改善（スプリング物理ベース、設計書あり）
- [ ] 本番動作確認（ギミックグループ・フェーズ編集・翻訳伝播・ダメージインポート）
- [ ] shared_plansクリーンアップ（アカウント削除時logoBase64残留）
- [ ] CSP unsafe-inline除去（β後、reCAPTCHA/Firebase Auth依存）
- [ ] エラー監視（Sentry無料枠 or Discord Webhook）
- [ ] スマホ対応追加改善（モーダル最適化、タブレット）
- [ ] セキュリティ: 認証方式のプライバシー調査 / localStorage認証トークン / Google Fonts SRI / Firestoreパス検証

### 新機能（将来）
- Floating Timeline (PiP): Tauri v2が現実的
- FFLogsインポート精度向上: 敵攻撃データ取得、テンプレート昇格、API制限解除申請
- ハウジングツアープランナー（要件定義済み、Pretext採用決定）
- SA法オートプランナー改善 / AI APIでオートプラン
- 詠唱バー注釈機能 / チートシートモード検討
- public/icons/ 削除（バンドル2.1MB削減）

### UI改善（検討中）
- [ ] アイコンアニメーション化（SVGアニメ、FFLogsボタン等）
- [ ] 紹介PV動画: CapCut/DaVinci Resolveでの制作を検討

---

## アイデア・やりたいこと
- YouTube埋め込み / こだわりのトップページ（AIデザインNG）
- 軽減配置時のフィードバックアニメーション / UI温度感改善
- オートプラン精度改善（スプシ教師データ・スコアリングモデル）
- YouTube導線: ジョブごとにスキル回し動画URL設定→アイコン表示
- スクショOCR: ゲーム画面から軽減自動読み取り
- 管理画面FFLogsインポート（テンプレート作成効率化）
- 横型タイムライン＋音ゲーモード（PiP）
- Gemma搭載AI機能

### 多言語リファレンスURL（zh/ko翻訳作業用）
- 韓国語: https://guide.ff14.co.kr/job/paladin/1?type=E#pve
- 中国語: https://actff1.web.sdo.com/project/20190917jobguid/index.html#/index

## バックログ（運用・品質・検討中）
- [ ] 運用: npm audit定期確認 / a11y / SE利用規約 / GDPR / SEO
- [ ] 検討中: FFLogsアイコン / チートシートMTST分け / フェーズスペース / テンプレ日本語名 / みんなの軽減表 / 軽減モーダルサイズ

---

## プロジェクト方針

### スキルデータ管理
- **正本: Firestore**（管理画面から追加・編集するのが正規ワークフロー）
- **mockData.ts**: フォールバック + テスト用 + 初期seed用
- **seed-skills-stats.ts**: マージ型（Firestoreのみのスキルは保持）

### SNS Build in Public
- 進捗時にJP+ENツイート案を提案（ツリー形式、"Translated by AI" 付記）
- #LoPo #FF14 #BuildInPublic #AISelection
