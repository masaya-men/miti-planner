# 段取り④-b リアルタイム共同編集 presence / カーソル 設計書 (2026-06-10)

> 親設計書 = [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md)（§6 Presence/カーソル・§10 要検証）。
> 本書は §6 の**確定方針を変えず**、§10 が「実装計画で詰める」とした presence/カーソルの**詳細**を埋める。
> 直前増分 = [④-a サーバ側編集認証](./2026-06-10-realtime-collab-stage4a-server-edit-auth-design.md)。

---

## 1. 背景・ゴール

④-a までで「**全 PlanData を全員でライブ編集でき、サーバが編集権をサーバ側で強制する**」エンジンが完成した。だが画面上は「誰が一緒にいるか・どこを触っているか」が**一切見えない**。④-b はこれを可視化する。

### ゴール
- 部屋にいる参加者の**顔ぶれ**（誰がいる・ジョブ・色・編集/閲覧の別）が一目で分かる。
- 各参加者の**カーソルが動いて見える**（ジョブアイコン + 色つき・実名なし）。
- **$0 ハードストップ設計を 1 ミリも崩さない**（親 §4）。
- プロジェクトルール「**マウス追従 UI = 高頻度 setState 禁止**」（[.claude/rules/ui-design.md](../../../.claude/rules/ui-design.md)）を守る。

### 非ゴール（④-b では作らない）
- **編集席 / 閲覧席の席種別モデル**（8 編集席・昇格・譲渡）→ 親 §3 の理想だが別増分（④-a 設計書 §「将来」でも範囲外と明記）。④-b は「ログイン=編集者バッジ / 未ログイン=閲覧者バッジ」の**表示**だけ。
- **自由入力の表示名 / ニックネーム**（PII・モデレーション面を作らない。§7）。
- TURN サーバ（有料中継）の導入（親 §4：使わない）。

---

## 2. 親設計書から継承する確定事項（変えない）

- カーソルの「気配情報」は **Yjs awareness**（保存本体とは別チャンネル）で扱う（親 §6）。
- カーソルの高頻度トラフィックは **P2P（WebRTC）でメーター外**にする（親 §4 / §6）。WebSocket（DO 経由）に高頻度カーソルを流すと**受信 1 件ごとに DO リクエスト計に乗り無料枠を食い潰す**ため不可（親 §90 の一次資料判断を本設計のコスト試算でも再確認済み）。
- ポインターは**通常のポインターのまま**、その右上に小さくジョブアイコンを添える（操作性維持・親 §6）。
- カーソル位置は**画面ピクセルでなく「タイムライン上の意味のある位置」で送る**（利用者ごとに画面幅・拡大率・DPR が違う・親 §6）。
- TURN なし時の少数派（厳しい NAT・8〜25%）は**カーソル非配信でフォールバック**（親 §4）。

---

## 3. アーキテクチャ — ハイブリッド 2 チャンネル

presence を「**確実に全員へ届けたい低頻度情報**」と「**滑らかさが要る高頻度情報**」に分け、別チャンネルで運ぶ。

| 情報 | 頻度 | チャンネル | 根拠 |
|---|---|---|---|
| **roster**（在室・ジョブ・色・editor/viewer・カーソルの有効/無効） | 低（入退室・ジョブ変更・トグル時のみ） | **既存 WebSocket awareness**（y-partyserver の `provider.awareness`） | 低頻度 → $0。**P2P が張れない人にも 100% 届く** |
| **live カーソル位置** `(timeSec, xRatio)` | 高（移動中 ~10–15Hz サンプル） | **P2P（WebRTC データチャネル）** | メーター外 = $0・滑らか |

### なぜ分けるか（親 §6 からの詰め）
親 §6 は「awareness を P2P で流す」とだけ書いていた。しかしそれを**素直に「全 presence を P2P awareness 1 本」にすると、NAT で P2P が張れない 8〜25% の人は roster にも出ない**（誰がいるかすら他者に見えない）。roster は presence の中で最も価値が高く、かつ低頻度なので、**roster だけは確実な WebSocket に逃がす**。これにより「カーソルは出ないが、誰がいるかは全員に見える」という素直な劣化になる。これは方針変更ではなく §6 の実装詳細化。

### サーバ改修
- **roster（WS awareness）= サーバ改修ゼロ**。YServer は既に awareness を扱う（[workers/collab/src/server.ts:81,104](../../../workers/collab/src/server.ts) に awareness 用 state の merge・クリーンアップが存在）。④-a で `conn.setState` に `collabEditor` を merge 済みで、awareness state と共存する作りになっている。
- **P2P signaling = 別チャンネルが要る**（§6 で後述）。これが ④-b で増える唯一のサーバ要素。

---

## 4. データモデル

### 4.1 roster（WS awareness の各クライアント state）

`provider.awareness.setLocalStateField('presence', …)` に載せる（④-a の `collabEditor` state とは別フィールドで共存）:

```ts
interface PresenceState {
  clientColor: string;   // 自動配色（後述 §5）。HEX 等。
  jobId: string | null;  // 本人を表すジョブアイコン（JobPicker の job id）。未選択は null。
  isEditor: boolean;     // ログイン済み（④-a でサーバが editor 認定する状態と一致）= 編集者バッジ。
  cursorEnabled: boolean;// 本人がカーソル配信を ON にしているか（閲覧者は OFF を選べる・親 §6）。
}
```

- **誰=自分か**は awareness の `clientID`（Yjs 既定）で識別。サーバの uid（④-a の `collabEditor`）は roster 表示には使わない（hash UID すら UI に出さない＝実名なし徹底）。
- `isEditor` は表示用。**権限の真実は④-a のサーバゲート**（roster の `isEditor` を詐称しても書き込みはサーバが破棄）。roster はあくまで「見た目のバッジ」。

### 4.2 live カーソル（P2P データチャネルのメッセージ）

```ts
interface CursorPacket {
  peerId: string;            // セッション内の一時 ID（clientID と対応づけ）
  pos: { timeSec: number; xRatio: number } | null; // null = タイムライン外 → 相手側で非表示
  t: number;                 // 送信側 monotonic（受信側の補間・古いパケット破棄用）
}
```

- カーソルの**見た目属性（色・ジョブ）は roster（WS）側にあり**、カーソルパケットには載せない（高頻度パケットを最小化）。受信側は `peerId → roster` を引いて色/アイコンを得る。

---

## 5. 座標系（既存 Memo 座標を流用 — 新規実装ほぼ不要）

LoPo の軽減表は**縦軸 = 時間**で行高さが動的なため線形変換が使えず、Timeline が `timeToYMap`（time→y）を持つ。Memo 機能がこの逆引きを実装済み（[src/components/Memo/coords.ts](../../../src/components/Memo/coords.ts)）。**カーソル位置はこれをそのまま再利用する**:

- 送信側: ポインター px → `yToTimeSec(yPx, timeToYMap)` + `pxToXRatio(xPx, sheetWidth)` → `(timeSec, xRatio)`。シート範囲外なら `yToTimeSec` が `null` → `pos: null` を送る。
- 受信側: `(timeSec, xRatio)` → `timeSecToY(timeSec, timeToYMap)` + `xRatioToPx(xRatio, sheetWidth)` → 自分の画面の px。

`timeToYMap` とシート幅は Memo が使うのと同じ Timeline コンテキストから取得する。**画面幅・拡大率・DPR が違っても、誰の画面でも正しい場所にカーソルが出る**（親 §6 の要件を既存資産で満たす）。

---

## 6. P2P signaling とフォールバック

### 6.1 signaling（接続確立だけの低頻度通信）
WebRTC は P2P を張る前に offer/answer/ICE candidate を交換する仲介（signaling）が要る。これは**接続時だけの低頻度通信**なので、無料枠に収まる形で**自前ホスト**する（第三者の公開 signaling は使わない＝プライバシー・信頼性・[[feedback_auth_privacy]] の原則）。

設置形態の最終決定は実装計画（§11 spike）に委ねるが、有力 2 案:
- **(A) 既存 collab worker に signaling 用の別 party / ルート**を足す（例: `/parties/signal/<roomToken>`）。document の YServer party と疎結合に保てる。
- **(B) 既存の document WebSocket に相乗り**し、Yjs 以外の signaling メッセージを envelope で見分けて中継（`onMessage` override）。新規接続を増やさないが YServer との結合が増える。

どちらも signaling 量は微小で **$0 を崩さない**。

### 6.2 ライブラリ選定（plan の spike で確定）
- **(i) y-webrtc** … Yjs awareness を WebRTC で運ぶ既製プロバイダ。peer メッシュ・再接続を肩代わり。難点: document も WebRTC で同期しようとするため、**カーソル専用の使い捨て Y.Doc**を与えて awareness だけ使う形にする必要がある（document の真実は WS の YServer のまま）。
- **(ii) 最小自前メッシュ** … cursor 専用に WebRTC データチャネルを薄く自前実装。y-webrtc の document 同期の荷物を持たない代わり、offer/answer/ICE/再接続を自分で書く。

room は最大 8 編集（フルパーティ）想定でフルメッシュ peer = 最大 7 本/人 = mesh が破綻しない規模（mesh の限界 ~10–15 peer）。どちらも技術的に成立。**短い spike で y-webrtc の「awareness 専用利用」が素直か確認 → 素直なら (i)、噛み合わなければ (ii)** を plan で決める。

### 6.3 TURN なしフォールバック（親 §4 を詰める）
- 厳しい NAT で **P2P が一定時間内に張れない人**は、**カーソルの送受信を諦める**（TURN 中継は使わない）。
- ただし **roster（WS）は生きている**ので、その人は「在室している・ジョブ・編集/閲覧」までは全員に見え、本人も他者の roster を見られる。**欠けるのは動くカーソルだけ**。
- フォールバック発生は UI で**静かに**扱う（「あなたのカーソルは相手に表示されていません」程度の控えめな通知 or 無表示）。エラー扱いしない。

---

## 7. アイデンティティ（実名なし）

- 各参加者 = **ジョブアイコン + 自動配色**で表現。**自由入力の名前は持たない**（PII を集めない・モデレーション面を作らない・[[feedback_auth_privacy]]）。
- **ジョブ選択**: 入室時、本人を表すジョブを 1 つ選べる（既存 JobPicker / ジョブアイコン資産を流用）。未選択時は中立アイコン or 自動割当。これは「パーティ編成のジョブ枠」とは無関係の**自己表現**（親 §6「選択ジョブアイコン」）。
- **配色**: clientID から決定的に色を割り当てる（同じ人は毎回同じ色）。同室内で色が衝突しにくいパレットを用意。色は roster とカーソルで共通。
- **ラベル文言**: roster / カーソルのホバーに出すのは**ジョブ名のローカライズ**（例: ナイト / Paladin / 기사 / 骑士）。個人名は出さない。同ジョブ複数人は色で区別。
- **i18n**: roster パネル・バッジ・フォールバック通知の文言は ja/en/ko/zh の 4 言語キー（[.claude/rules/i18n.md](../../../.claude/rules/i18n.md)・ハードコード禁止）。

---

## 8. 描画方式（「マウス追従=高頻度 setState 禁止」を守る）

プロジェクトルールは「onMouseMove の高頻度イベント + state 更新は禁止・固定位置 UI で代替」。共同カーソルは本質的にマウス追従だが、**React state を毎フレーム触らない**ことでルールの趣旨（perf）を守る。

- **送信（自分のカーソル）**: `pointermove` は ref に最新座標を書くだけ（setState しない）。別途 `requestAnimationFrame` ループ（または ~10–15Hz の間引き）で ref を読み、§5 で `(timeSec, xRatio)` に変換し、**前回から動いた時だけ** P2P 送信。アイドル時は送らない。
- **受信（他人のカーソル）**: タイムライン上の overlay 層（[MemoOverlay](../../../src/components/Memo/MemoOverlay.tsx) と同型の絶対配置レイヤ）に、参加者ごとのカーソル要素を 1 つずつ持つ。位置更新は **DOM の `transform: translate3d(...)` を直接書く**（GPU 合成・perf）。React の再レンダーは「参加者が増減した時」だけ。
- **滑らかさ**: P2P パケットはまばら（~10–15Hz）なので、受信側で最新目標位置へ **ease（lerp）補間**して動かす。`prefers-reduced-motion` 尊重で補間を弱める。
- **可視判定**: `pos: null`（相手がタイムライン外）や roster で `cursorEnabled: false` の参加者はカーソルを隠す。

---

## 9. コスト（$0 維持の根拠）

- **roster（WS awareness）**: 入退室・ジョブ変更・トグル + awareness の周期ハートビートのみ。8 人でも秒間 1 件未満オーダー → DO 受信計への影響は編集トラフィックに対し誤差。
- **live カーソル（P2P）**: DO を通らない = **メーター完全に外**。何 Hz 動こうが DO の無料枠を消費しない。
- **signaling**: 接続確立時の数往復のみ（移動のたびではない）。微小。
- **結論**: ④-a と同じく、**$0 ハードストップを崩さない**。万一 signaling/roster が想定超でも、無料プランは課金でなく「満員（$0）」で止まる（親 §4）。

---

## 10. 実装の段取り（2 分割 — 既存 ②-b / ⑤-3 と同じ刻み）

### ④-b-1: roster（WS awareness）
- `provider.awareness` に `PresenceState` を載せ、observe して store/ビューへ。`PresenceState` は `jobId` / `cursorEnabled` フィールドも**最初から持つ**（b-2 で awareness を作り直さないため）が、b-1 では `jobId=null` / `cursorEnabled=true` 固定。
- ツールバー常設チップ（⑤-3a で「● 共同編集中」+ **アバター置き場**を用意済み）を**実参加人数**にする。クリックでオーナーパネル→参加者リスト（色ドット + editor/viewer バッジ）。
- **自動配色**（`colorForClient`・決定的）。
- **新トランスポートなし・サーバ改修ゼロ・全員に効く・低リスク**。これ単体でも「誰が一緒にいるか分かる」価値が立つ。

### ④-b-2: live カーソル（P2P）＋ 自己表現
- §6 の spike → signaling 設置 + ライブラリ確定。
- カーソル送受信（§8）+ 座標変換（§5）+ overlay 描画 + ease 補間。
- **ジョブ自己選択 UI**（roster/カーソルのアイコン）+ **カーソル ON/OFF トグル**（カーソルが出て初めて意味を持つため b-2 に同梱。b-1 で定義済みの `jobId` / `cursorEnabled` フィールドを駆動する）。
- TURN なしフォールバック（§6.3）。
- **新依存追加**（y-webrtc 等 / または自前）。依存追加はユーザー確認の上で（[[feedback_fill_gaps]]）。

> 実装順は b-1 → b-2。b-1 だけ先に held で積んでも UX が成立する。

---

## 11. plan で詰める（未確定）
- **signaling 設置形態**（§6.1 案 A/B）と **ライブラリ**（§6.2 (i)/(ii)）を**短い spike で確定**。
- 配色パレットの具体値（同室衝突回避・白黒基調 UI との整合 = [DESIGN](../../../.claude/rules/DESIGN.md) の機能色を侵さない中間色）。
- カーソルサンプル Hz と ease 係数の実測チューニング。
- フォールバック通知の出し方（控えめ通知 vs 無表示）。
- ④-a の `collabEditor`（サーバ uid）と roster の `isEditor` の整合確認（表示と権限の二段：UI=roster / 強制=サーバ）。

---

## 12. プライバシー / 規約
- 親 §7 で「参加すると表示名・編集内容・在室状況が他参加者に見える」と既に規約追加方針。④-b は**実名・PII を一切出さない**（ジョブアイコン + 色 + ジョブ名のみ）ため、規約面の追加負担は小さい。「在室状況・選択ジョブ・カーソル位置が他参加者に見える」点を既存節に含める（公開前・多言語）。

---

## 13. 公開条件との関係
- ④-a でサーバ側編集認証は満たした。④-b は presence の可視化であり、**公開（UI 露出）に必須ではない**が、共同編集の体験品質を大きく上げる。push/deploy/UI 露出は親方針どおり**⑤-3d 統合検証 + 承認まで held**。
