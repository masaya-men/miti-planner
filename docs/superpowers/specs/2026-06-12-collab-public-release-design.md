# 共同編集 一般公開 設計書 (2026-06-12)

> 共同編集機能を **admin gate の内側から一般公開** するための、公開条件・UI 仕上げ・検証の設計。
> 機能エンジン本体（①〜⑤-3c / ④-a / ④-b-1 / ④-b-2）は **既に main にマージ済・本番デプロイ済**。
> 本書のスコープは「封印（admin gate）を外す前に満たす条件」と「公開前の UI/UX 仕上げ・バグ修正・検証」に限定する。

---

## 0. 棚卸し（git 実測・2026-06-12）

- `origin/main` = HEAD = `7d733b3`（0 ahead / 0 behind）。
- collab 関連の held 表記ブランチ8本（lifecycle / 2b2 / 4a / 4b1 / 4b2 / 5-3a / 5-3b / 5-3c）は **全て HEAD の祖先＝main に入っている**。TODO/memory の「held・push/deploy 保留」表記は**全て stale**。
- Worker `lopo-collab` デプロイ済。データ破壊バグ根治＋閲覧者 read-only 防御もデプロイ済。
- **唯一の封印** = [src/components/ShareButtons.tsx:46](../../../src/components/ShareButtons.tsx#L46) `if (!isAdmin) { setView('copy'); return; }`。一般ユーザーには共同編集 UI を見せず、従来のコピー共有へ直行させている。

→ **機能は作り終わって本番に乗っている。残るのは封印解除の条件確定と、公開前の仕上げ・検証だけ。**

---

## 1. 公開条件（方針・確定済）

### 1.1 コスト = A（今のまま）
- 根拠（設計書 [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md) §4・一次資料）:
  - **冬眠（Hibernation）**でアイドルの部屋は duration 課金停止 → 「同時に何部屋開いているか」はコストにほぼ効かない（1000 部屋開きっぱなしでも duration ≈ $0）。
  - 編集の**配信（送信）は課金なし**。
  - 課金されるのは **1 日の延べリクエスト数だけ**（入室＝1人1リクエスト＋編集受信の 20:1 圧縮分）。カーソルは P2P でメーター外。
  - 無料枠 = **1 日 10 万リクエスト** ≒ **1,000〜1,500 セッション/日**が圏内（概算・要負荷テスト）。
  - 無料プランは振り切れても**課金されず $0 で自動停止**（青天井にならない）。
- 実コードの実際の制限は **1 部屋あたりの人数だけ**：既定 8 人・最大 20 人（[workers/collab/src/collabCapacity.ts:10,15](../../../workers/collab/src/collabCapacity.ts#L10)）。設計書にあった「同時 30 部屋」のグローバル上限は**コード未実装**（保守的な見積もり段階の数字）。
- **結論**: グローバル同時上限の追加実装は不要（過剰）。緊急停止 `COLLAB_DISABLED` を保険として持ったまま、まず公開して計測する。
- **後回し TODO**: 使用量の自動監視 → Discord 通知 cron（「素人でも管理できる運用ツール群」）は公開後に後追い追加。

### 1.2 荒らし対策 = A（今の防御）
- モデル = **編集ログイン必須 / 閲覧は誰でも**（Notion 完全一致・Figma 準拠の業界標準）。
  - 編集はサーバ認証（④-a）= worker が Firebase トークン検証、未ログインの書き込みはサーバが破棄。
  - 閲覧は読み取り専用（実害ほぼ無し）。
  - オーナーは**リンク失効・再発行**できる（再発行＝旧リンク無効化＝荒らしは戻れない）。
- 残る荒らしの筋 = 「信頼してリンクを渡した相手（or 漏れたリンク経由のログインユーザー）が悪意で書き換える」。被害はオーナー 1 枚の表に限定、失効で即停止。
- **結論**: 今の防御で公開。元に戻す（編集履歴）/ 個別キックは、実被害が出てから優先度を上げる（公開を遅らせない）。

### 1.3 ゲート撤去
- [ShareButtons.tsx:46](../../../src/components/ShareButtons.tsx#L46) の判定を **`!isAdmin` → 「未ログイン」** に置換。
  - **ログイン済ユーザー** → 共有2択（コピー or 共同編集リンク発行）が見える。
  - **未ログインユーザー** → 従来どおりコピー共有へ直行（部屋作成 API はログイン必須なので発行 UI は出さない。リンクを受け取って閲覧するのは誰でも可）。
- 部屋作成 API（⑤-2a）は ID トークン＋オーナー照合済 = 未ログインは構造的に部屋を作れない。クライアントのゲートはそれと一致させるだけ。

---

## 2. 公開前 UI/UX 仕上げ・バグ修正

各項目は **実装フェーズで対象コンポーネントを実機確認してから着手**する（現状コードで既に部分的に直っている可能性も含めて検証）。

### 2.1 カーソル ON/OFF トグルの改修（①）
- **現状** [src/components/collab/PresenceControls.tsx:52-62](../../../src/components/collab/PresenceControls.tsx#L52): 丸いスイッチ型トグル。**状態を示すテキストが無い**。置き場所が `w-[190px]` 固定枠（[CollabJoinerPage.tsx:185](../../../src/components/CollabJoinerPage.tsx#L185)）で、ユーザー環境（拡大率 258%）でスイッチが枠外にはみ出る。
- **変更後**:
  - スイッチを **状態ラベル付きボタン**に置換：OFF 時「オンにする」/ ON 時「オフにする」。
  - ボタンの近くに**現在状態を常時表示**：ON 時「今はカーソル共有が ON です」/ OFF 時「今はカーソル共有が OFF です」（業界水準＝状態テキスト明示）。
  - 枠（`w-[190px]` 等）に収まるレイアウト。文字サイズ拡大環境（258%）でもはみ出さないこと。
  - OFF→ON は従来どおり `CursorOptInModal`（IP 露出の同意）を挟む。ON→OFF は即時。
- **影響範囲**: PresenceControls は **オーナーパネル（[OwnerCollabPanel.tsx:124](../../../src/components/collab/OwnerCollabPanel.tsx#L124)）とジョイナーpage（[CollabJoinerPage.tsx:186](../../../src/components/CollabJoinerPage.tsx#L186)）の両方**で使われる＝1 箇所直せば両方直る。
- i18n: 新規キー（`collab.cursor_share_on` / `collab.cursor_share_off` / `collab.cursor_turn_on` / `collab.cursor_turn_off` 等）を 4 言語（ja/en/ko/zh）。

### 2.2 ジョイナー画面にヘッダー追加（③・A案）
- **現状** [src/components/CollabJoinerPage.tsx:174-194](../../../src/components/CollabJoinerPage.tsx#L174): 赤バナー＋表（Timeline）＋浮いたカーソル操作のみ。**ヘッダーもサイドメニューも無い**。Layout を意図的に通していない（自分のデータ漏洩防止＝[CollabJoinerPage.tsx:48-55](../../../src/components/CollabJoinerPage.tsx#L48) のコメント）。
- **変更後（A案）**:
  - 上部に**ヘッダーを追加**（パーティ構成・レベル等が見える＝表を読む文脈として必要）。**左サイドメニュー（プラン一覧）は出さない**。
  - **ジョブ/ステータス変更の配線は今回スコープ外**（表示・文脈用。編集機能は不要）。ヘッダーから誤って自分のデータや部屋を破壊しないこと（read-only 相当の見た目）。
  - **重要な制約（漏洩防止の構造を壊さない）**: ジョイナーページは Layout の自動保存を通さない設計。ヘッダー追加でこの不変条件（`_collabReadonly` による persist skip / 退室 cleanup の順序）を壊さないこと。ヘッダー由来で localStorage・プラン管理・自動保存を起動させない。
- **実装方針の検討事項（plan フェーズで詰める）**: 既存 `ConsolidatedHeader` をそのまま流用できるか、それとも表示専用の軽量ヘッダーを別に用意するか。`ConsolidatedHeader` が plan store / 自動保存に依存していないか実コードで確認してから決める（依存していれば表示専用版を作る）。

### 2.3 赤バナーを画面下へ（④）
- **現状** [CollabJoinerPage.tsx:176](../../../src/components/CollabJoinerPage.tsx#L176): `CollabJoinerBanner` を Timeline の**上**に配置。
- **変更後**: 画面**下部**に固定表示。状態別 CTA（login / consent / edit）はそのまま維持。

### 2.4 プライバシーポリシーに 1 行追記（⑤）
- カーソル共有 ON にした場合、**同室の参加者に IP アドレスが伝わりうる**（P2P の宿命）旨を 1 行追記。
- 既存の `CursorOptInModal` の文言（事実ベース確定版）と矛盾しないこと。
- 対象ファイルは plan フェーズで特定（プライバシーポリシーページ / i18n）。4 言語。

### 2.5 ShareChoiceModal 2択ボタンの押下フィードバック（⑦・新規）
- **現状** [src/components/collab/ShareChoiceModal.tsx:30,34](../../../src/components/collab/ShareChoiceModal.tsx#L30): 「コピーを配る」「一緒に編集する」の2択ボタンに `transition-colors` と hover はあるが **`active:scale-95` の押下フィードバックが無い**（✕ボタン[:27] には `active:scale-90` がある）。
- **変更後**: 2択ボタンに `active:scale-[0.98]`（全幅ボタンなので 95 だと大きすぎる場合は微調整）の押下フィードバックを追加。DESIGN ルール「ボタン押下: `active:scale-95`」に準拠。

### 2.6 人数 +/- の遅延根治（⑧・新規バグ修正）
- **根本原因（コード確定・推測でない）** [src/store/useCollabSessionStore.ts:75-77](../../../src/store/useCollabSessionStore.ts#L75):
  ```js
  setMax: async (planId, n) => {
    const info = await setMaxParticipants(planId, n);  // ← サーバへ POST して
    set({ maxParticipants: info.maxParticipants });    // ← 応答が返ってから初めて表示更新
  }
  ```
  クリックのたびに API POST 往復を待ってから数字が変わる。連打で往復が積もりさらに遅い。
- **修正（楽観的更新＋デバウンス・業界標準）**:
  - クリック時に `maxParticipants` を**ローカル state で即時更新**（数字がその場で動く）。
  - API POST は**デバウンス**（例 400ms）して、連打しても**最後の値だけ**サーバに送る。
  - API エラー時は**サーバの確定値に reconcile**（楽観値を巻き戻す）。
  - クランプ（`[1, SYSTEM_MAX_PARTICIPANTS]`）はローカル即時側でも維持。
- 方針一致: [[feedback_ui_reflects_server_state_immediately]]（操作後すぐ UI 反映・楽観的 UI）。
- テスト: 連打しても API 呼び出しは最終値 1 回 / 楽観値が即時反映 / エラー時 reconcile を vitest で固定。

---

## 3. 後回し（公開ブロッカーではない）

- **②カーソルなめらか化**（時間ベース補間）: 現状 rAF lerp（飛び飛び感あり）。公開後に改善。
- 使用量自動監視 → Discord 通知 cron（1.1 の後回し TODO）。
- 元に戻す（編集履歴）/ 個別キック（1.2 の将来オプション）。

---

## 4. 検証（⑤-3d 2ブラウザ実機 E2E）

公開前に**本物の表で**、ユーザーと一緒に 2 ブラウザで実機確認する（これまで実データ往復は未検証）。

1. オーナー（ブラウザA・ログイン）が共同編集リンクを発行。
2. ジョイナー（ブラウザB）が `/collab/:token` で参加 → 閲覧表示。
3. ジョイナーがログイン＋同意 → 編集解禁 → 配置がオーナー側にライブ反映。
4. 双方向のライブ反映（軽減配置・partyMembers 等）。
5. リロード後も保持（onSave 書き戻し → 再接続で残存）。
6. オーナーが失効 → ジョイナーが弾かれる / 再発行 → 旧リンク無効。
7. カーソル ON/OFF（双方向・IP 同意モーダル・OFF で送信ゼロ）。
8. 列増殖が**再発しないこと**（プラン切替・ON→ON・リロード復帰を反復）。

検証で問題が出たら 1 件ずつ修正 → 再検証（[[feedback_one_fix_one_verify]]）。

---

## 5. 公開手順（順序厳守）

1. 上記 2.x の UI/UX 修正・バグ修正を実装（TDD・各 build+test 緑）。
2. ⑤-3d 2ブラウザ実機 E2E（ユーザーと一緒に・要デプロイ）。問題があれば修正して再検証。
3. プライバシーポリシー追記。
4. **最後に**ゲート撤去（1.3 = `!isAdmin` → 未ログイン）。
5. `git push origin HEAD:main`（Vercel 自動デプロイ）。Worker 変更があれば先に `cd workers/collab && wrangler deploy`。
6. 公開後に使用量を数日計測（Vercel Edge Requests / Cloudflare）。問題なければ後回し TODO（監視 cron 等）へ。

⚠ ゲート撤去は**他の全項目が緑になってから最後に**行う（封印を外した瞬間に一般ユーザーへ露出するため）。問題が出たら前回同様 `vercel promote` 等で即ロールバック可能な状態を保つ。

---

## 6. 受け入れ基準（Definition of Done）

- [ ] カーソルトグルがボタン＋状態テキストになり、258% 環境で枠からはみ出さない（オーナー/ジョイナー両方）。
- [ ] ジョイナー画面にヘッダーが表示され、サイドメニューは出ない。漏洩防止の不変条件（persist skip / cleanup 順序）が維持される。
- [ ] 赤バナーが画面下に表示される。
- [ ] ShareChoiceModal の2択ボタンが押下で凹む。
- [ ] 人数 +/- が即時に数字反映し、連打しても API は最終値 1 回。
- [ ] プライバシーポリシーにカーソル ON＝IP 露出の記載がある（4 言語）。
- [ ] ⑤-3d 2ブラウザ E2E が全項目グリーン（列増殖再発なし含む）。
- [ ] ゲート撤去後、ログイン済ユーザーに共有2択が出て、未ログインはコピー共有のみ。
- [ ] 全テスト緑（既知5失敗のみ）/ `npm run build` EXIT=0 / yjs 遅延チャンク維持。

---

## 7. 非ゴール（このリリースでやらないこと）

- カーソルなめらか化（時間ベース補間）。
- 編集履歴 / 元に戻す / 個別キック。
- 使用量自動監視 cron。
- ジョイナーのヘッダーからのジョブ/ステータス変更の配線。
- グローバル同時部屋数の上限実装。
