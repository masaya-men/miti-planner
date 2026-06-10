# 段取り④-b-2 リアルタイム共同編集 live カーソル(P2P) 設計書 (2026-06-10)

> 親設計書 = [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md)(§6 Presence/カーソル・§4 コスト)。
> 直近 = [④-b presence/カーソル 設計](./2026-06-10-realtime-collab-stage4b-presence-cursors-design.md)(§6/§10/§11 が本書の起点)。
> 本書は ④-b 設計書 §11「plan で詰める」とした **signaling 設置形態 / ライブラリ / プライバシー** を **spike で確定**し、④-b-2(live カーソル)の実装詳細を埋める。
> 前段 = [④-b-1 roster(WS awareness)](./../plans/2026-06-10-realtime-collab-stage4b1-presence-roster.md)(実装完了)。

---

## 1. スコープ

④-b-1 で「**誰が部屋にいるか**(roster=色・ジョブ枠・編集/閲覧)」は WS awareness で全員に見えるようになった。④-b-2 は **各参加者のカーソルが動いて見える** ようにする。

### ゴール
- 参加者のカーソルが、軽減表(タイムライン)上で**滑らかに動いて**見える(普通の矢印 + 右上に小ジョブアイコン・実名なし・色で区別)。
- **$0 ハードストップを 1 ミリも崩さない**(カーソルの高頻度トラフィックは P2P=メーター外)。
- プロジェクトルール「**マウス追従=高頻度 setState 禁止**」([.claude/rules/ui-design.md](../../../.claude/rules/ui-design.md))を守る。
- **IP 露出をユーザーが完全に制御できる**(既定 OFF・オプトイン・ON 時に正直な説明)。

### 非ゴール(④-b-2 では作らない)
- **タイムライン以外(パーティ編成パネル・ツールバー等)の上のカーソル**。理由 = §6。将来拡張の余地として残す。
- TURN(有料中継)導入(親 §4)。
- 自由入力の表示名(PII を持たない・親 §7・[[feedback_auth_privacy]])。
- 編集権モデルの変更(編集=④-a サーバ認証/閲覧の別はそのまま。カーソルは権限と独立)。

---

## 2. spike 確定事項(②-b-1/④-a と同じ「サーバ改修ゼロ」を維持)

実コードと一次情報で確認した上で、④-b 設計書 §11 の未確定 2 点を以下に確定する。

### 2.1 signaling 設置形態 = **(C) awareness 相乗り**(④-b 設計書 §6.1 の案 A/B に対する第3案)

- WebRTC は P2P を張る前に「相手はどこ?」の番号交換(offer/answer/ICE = signaling)が要る。これを **既存の WS awareness チャンネル(④-b-1 で roster が既に使っている `provider.awareness`)に相乗り**させる。
- 各 peer の signaling データ(SDP)は awareness の **専用フィールド**(roster の `presence` フィールドとは別)に載せる。awareness は全 peer にブロードキャストされるので、相手はそれを見て応答できる。
- **新 Durable Object ゼロ・新ルートゼロ・wrangler migration ゼロ・サーバ改修ゼロ**。④-b 設計書 §6.1 の案 A(新 party=新 DO)は migration が要り b-1 の「サーバ改修ゼロ」を崩すため不採用。案 B(document WS の onMessage override)は YServer 内部結合が増えるため不採用。
- 確認した実コード: ルーティングは [workers/collab/src/index.ts:43-44](../../../workers/collab/src/index.ts) が `/parties/<party>/<room>` で party=`room` の 1 種のみ。DO バインディングも [wrangler.jsonc:7-12](../../../workers/collab/wrangler.jsonc) で `Room` 1 つ。signaling 用に別 party を足すと新 DO クラス + migration が必須 = 採用しない根拠。

### 2.2 ライブラリ = **(ii) 最小自前メッシュ**(新規 npm 依存ゼロ)

- カーソル用に WebRTC データチャネルを薄く自前実装する。
- **y-webrtc を採用しない**根拠(一次情報 [yjs/y-webrtc README](https://github.com/yjs/y-webrtc/blob/master/README.md) + 実コードで確認):
  - y-webrtc は**自前 protocol の signaling サーバを別途立てる必要**があり、我々の既存 DO WS を使い回せない(別 protocol)。
  - document を WebRTC で同期しようとするため、**捨て Y.Doc を抱かせて awareness だけ使う**回避が要る(④-b 設計書 §6.2(i) の難点が実物で裏取りできた)。
  - 新規 npm 依存 + 遅延チャンクの bundle 増。peer メッシュ管理の利点は最大 7 peer では薄い。
- カーソル用 datachannel は **document 同期より大幅に簡単**(lossy 許容・順序保証不要・再ネゴ不要)なので、自前メッシュの最大の難所が小さい。
- **RTCPeerConnection はブラウザ標準 API** = npm 依存も bundle 増もほぼゼロ。WebRTC を使うコードは既存の遅延チャンク(collab)境界の中に置き、ソロ利用者の初期 bundle に乗せない(②-a の遅延ロード方針を踏襲)。

---

## 3. プライバシー設計(本増分の核心)

P2P の宿命として、**接続した相手にあなたの IP アドレスが見えうる**(直接つなぐ方式そのものの性質・LoPo 固有の欠陥ではない)。これを事実ベースで設計に反映する。

### 3.1 事実整理(一次情報で確認済み)
- IP から分かるのは**おおよその地域(都市レベル・ISP 拠点・50km 以内 50〜75% 程度)**まで。**名前・自宅住所・アカウントには届かない**。PC 侵入・乗っ取りもできない。
- 現実的な最悪ケース = **DDoS で回線を一時的に落とされる**(ゲーム界隈の嫌がらせ)+ おおよその地域推測。**一時的・復旧可能・身元特定や金銭被害には直結しない**。
- IP は**画面に表示されない**。取り出すには、相手が **ブラウザ内部ツール(`chrome://webrtc-internals` 等)や専用ソフトで接続を意図的に解析**する必要がある = 技術知識があってわざとやる人だけ。casual には見えない。
- その人は**あなたが招いた部屋の中にいる**ことが前提(オーナーが失効・人数制限・緊急停止を保持)。

出典: [WebRTC Security in 2025 – WebRTC.ventures](https://webrtc.ventures/2025/07/webrtc-security-in-2025-protocols-vulnerabilities-and-best-practices/) / [Bitdefender – WebRTC Leaks](https://www.bitdefender.com/en-us/blog/hotforsecurity/the-dangers-of-webrtc-leaks-and-how-to-avoid-them) / [PureVPN – gaming IP](https://www.purevpn.com/blog/how-do-hackers-get-your-ip-address-while-youre-playing-online/)。

### 3.2 設計でリスクを完全に各人の選択にする
- **カーソル共有は既定 OFF・オプトイン**。OFF の人・閲覧だけの人は **P2P 接続に一切参加しない = IP を一切共有しない**。デフォルトでは誰の IP も露出しない。
- **P2P 接続は「カーソル ON の peer 同士」だけで張る**(§5.3 mesh membership = roster の `cursorEnabled=true` の peer 集合)。
- **ON にした瞬間に正直な説明を出す**(§7.2 説明モーダル)。インフォームド・オプトイン。
- **OFF にしたら即座に当該 P2P 接続を閉じる**。以降に入る peer はその人の IP を取得できない。
- **LoPo は IP をどこにも永続保存しない**。signaling は awareness の一時フィールドを通るだけで、サーバ(DO)に保存しない。接続確立後は signaling フィールドを**クリア**して awareness 状態に SDP を残さない(late-join への再配布も防ぐ)。

### 3.3 OFF の意味(事実・誇張しない)
- OFF = **これ以降の露出を止める**(未来の peer に出ない・現在の接続を切る)。
- OFF は **「ON だった間に実際につながり、かつ相手が意図的に記録していた IP」までは取り消せない**(送信済みデータは取り消せないという通信の根本原理・LoPo 固有でない)。
- → だからこそ「既定 OFF・ON の間だけ・ON の相手とだけ」に厳密に限定する設計が効く。何もせず OFF のままなら接続自体が発生せず、この懸念はゼロ。

### 3.4 安心の根拠(100% 正しいものだけを UI に書く)
- ✅ **「カーソルを ON にしない限り IP は出ない・いつでも OFF にできる」**(オプトインの保証 = 完全に正しい)。
- ❌ 「ルーター再起動で IP が変わる」は**書かない**(動的 IP でも変わらない場合があり・固定 IP/CGNAT では変わらない = 不正確な安心になる)。

---

## 4. アーキテクチャ概観 — awareness signaling + 自前メッシュ + datachannel

```
[A のブラウザ] --(WS)--> [DO(既存)] --(WS)--> [B のブラウザ]   ← roster + signaling(低頻度・awareness)
[A のブラウザ] <=========== WebRTC datachannel ===========> [B のブラウザ]  ← カーソル位置(高頻度・$0)
```

- **roster + signaling** = 既存 WS awareness(全員に確実配信・低頻度・DO 経由だが微小 = $0)。
- **カーソル位置** = P2P datachannel(DO を通らない = メーター外 = 何 Hz でも $0)。
- 色・ジョブ = roster(awareness)側が持つ。カーソルパケットには載せない(高頻度パケットを最小化)。受信側は `clientID → roster` を引いて見た目を得る。

---

## 5. signaling とメッシュ確立(自前・最小)

### 5.1 awareness signaling のメッセージ
awareness の専用フィールド `signal`(roster の `presence` とは別フィールド・[presence.ts](../../../src/lib/collab/presence.ts) は無改変)に、宛先付きの SDP を載せる:

```ts
interface SignalMsg {
  to: number;        // 宛先 clientID(自分宛でなければ無視)
  from: number;      // 送信元 clientID
  kind: 'offer' | 'answer';
  sdp: string;       // ICE candidate を含む完全 SDP(non-trickle)
  nonce: number;     // 再接続時に古い offer/answer を区別
}
```

- **non-trickle ICE**: ICE candidate を小刻みに送らず、**ICE gathering 完了後に candidate 込みの完全 SDP を 1 回だけ**載せる。awareness 書き込み回数を最小化(接続あたり offer 1 + answer 1)。代償 = 接続確立が 1〜2 秒遅い(カーソル用途には許容)。
- **接続確立後は `signal` フィールドをクリア**(awareness に SDP=IP を残さない・§3.2 プライバシー)。

### 5.2 glare(同時 offer)回避
- ペアごとに **clientID が小さい側だけが initiator**(offer を作る)。大きい側は answerer。両者が同時に offer して衝突するのを防ぐ決定的ルール。

### 5.3 mesh membership(誰と繋ぐか)
- roster(④-b-1)から **`cursorEnabled=true` の peer 集合**を導出。自分も ON のとき、その集合の各 peer とフルメッシュ(最大 7 本/人)で datachannel を張る。
- peer の `cursorEnabled` が false に変化 / 退室 → 当該接続を閉じる。
- 自分が OFF → 全接続を閉じる(§3.2)。
- メッシュ規模 = 最大 8 編集席(フルパーティ)→ 最大 7 peer = mesh 破綻しない規模(親 §4 / ④-b 設計書 §6.2)。

### 5.4 datachannel 設定
- `{ ordered: false, maxRetransmits: 0 }` = **unreliable・unordered**。カーソルは最新位置だけ意味があり、取りこぼし・順序入替わりは無害。最低レイテンシ。

---

## 6. 座標系(既存 Memo 座標を流用 — 新規実装ほぼゼロ)

軽減表は縦軸=時間で行高さが動的なため線形変換が使えず、Timeline が `timeToYMap` を持つ。Memo がこの変換を実装済み([src/components/Memo/coords.ts](../../../src/components/Memo/coords.ts)・確認済み: `yToTimeSec`/`timeSecToY`/`pxToXRatio`/`xRatioToPx`/`clampXRatio` が存在)。**カーソル位置はこれをそのまま再利用**:

- 送信側: ポインタ px → `yToTimeSec(yPx, timeToYMap)` + `pxToXRatio(xPx, sheetWidth)` → `(timeSec, xRatio)`。シート範囲外なら `yToTimeSec` が `null` → `pos: null` を送る(相手側で非表示)。
- 受信側: `(timeSec, xRatio)` → `timeSecToY` + `xRatioToPx` → 自分の画面 px。
- **画面幅・拡大率・DPR が違っても、誰の画面でも正しい場所に出る**。

### 6.1 なぜタイムライン上のみか(非ゴールの根拠)
- カーソルを正しい場所に出すには「画面 px」でなく「意味のある座標」が要る。タイムラインは `timeToYMap` という**きれいな共通座標系**を既に持つ。
- パーティ編成パネル・ツールバー等は共通座標系を持たず、かつ**レイアウトがユーザーごとに変わる**(画面幅でボタン位置が違う・スマホ/PC で別物)→「画面の px」を送っても相手では別の物を指す。
- タイムラインは**共同編集の主戦場**(実際に一緒にいじる場所)なので、ここだけで価値の大半を取れる。他パネルは将来、その部分だけ座標を定義すれば足せる。

### 6.2 カーソルパケット
```ts
interface CursorPacket {
  clientId: number;  // = awareness clientID(roster と突き合わせて色/ジョブを引く)
  pos: { timeSec: number; xRatio: number } | null; // null = タイムライン外 → 非表示
  t: number;         // 送信側 monotonic(古いパケット破棄・受信側補間用)
}
```

---

## 7. UI(自己表現 + オプトイン + 正直な説明 + フォールバック)

### 7.1 ジョブ自己選択 + カーソル ON/OFF トグル
- **ジョブ選択**: 入室時に「自分を表すジョブ」を 1 つ選べる(既存 JobPicker / ジョブアイコン資産を流用)。未選択は中立アイコン。パーティ編成のジョブ枠とは無関係の自己表現。`PresenceState.jobId` を駆動(④-b-1 で先行定義済み)。
- **カーソル ON/OFF トグル**: `PresenceState.cursorEnabled` を駆動(④-b-1 で先行定義済み・**既定 OFF**)。
- 置き場: ④-b-1 のオーナーパネル / ツールバーチップ周辺(roster UI と同居)。i18n 4 言語。

### 7.2 ON 時の説明モーダル(インフォームド・オプトイン)
- OFF→ON にする操作で、確定前に**正直な説明**を出す(淡々と・脅かさない):
  - あなたのマウスの動きが部屋の参加者に見えるようになる。
  - 技術的副作用として、部屋の参加者に IP アドレス(おおよその地域が分かる程度・名前/住所は分からない)が見えうる。部屋に入れるのはリンクを渡した相手だけ。
  - **いつでも OFF に戻せる**(OFF にしない限り IP は出ない)。
- 確認 → `cursorEnabled=true` + P2P 確立。キャンセル → OFF のまま。
- 文言は i18n 4 言語(collab.cursor_optin_* 等・[.claude/rules/i18n.md](../../../.claude/rules/i18n.md)・ハードコード禁止)。

### 7.3 描画方式(「マウス追従=高頻度 setState 禁止」を守る)
- **送信(自分)**: `pointermove` は ref に最新 px を書くだけ(setState しない)。別途 ~10–15Hz の間引きループで ref を読み、§6 で `(timeSec, xRatio)` に変換し、**前回から動いた時だけ**全 datachannel に送信。アイドル時は送らない。
- **受信(他人)**: タイムライン上の overlay 層([MemoOverlay](../../../src/components/Memo/MemoOverlay.tsx) と同型の絶対配置レイヤ)に、peer ごとのカーソル要素を 1 つ持つ。位置更新は **DOM の `transform: translate3d(...)` を直接書く**(GPU 合成)。React 再レンダーは「peer が増減した時」だけ。
- **滑らかさ**: パケットはまばら(~10–15Hz)なので、受信側で最新目標位置へ **ease(lerp)補間**して動かす → 人の目には滑らかに見える(動画がパラパラ漫画でも滑らかに見えるのと同じ原理)。`prefers-reduced-motion` 尊重で補間を弱める。
- **可視判定**: `pos: null`(タイムライン外)や roster で `cursorEnabled: false` の peer はカーソルを隠す。

### 7.4 TURN なしフォールバック(親 §4 を詰める)
- 厳しい NAT で **P2P が一定時間内に張れない peer** は、**カーソルの送受信を諦める**(TURN 中継は使わない)。roster(WS)は生きているので「在室・ジョブ・編集/閲覧」は全員に見える。**欠けるのは動くカーソルだけ**。
- フォールバックは UI で**静かに**扱う(「あなたのカーソルは今、相手に表示されていません」程度の控えめな表示)。エラー扱いしない・i18n。

---

## 8. コスト($0 維持の根拠)
- **カーソル(P2P)**: DO を通らない = メーター完全に外。何 Hz でも無料枠を消費しない。
- **signaling(awareness)**: 接続あたり offer 1 + answer 1(non-trickle)+ 確立後クリア。peer 増減時のみ。微小。
- **roster(awareness)**: ④-b-1 のまま(入退室・トグル時のみ)。
- 結論: ④-a / ④-b-1 と同じく **$0 ハードストップを崩さない**。万一 signaling/roster が想定超でも、無料プランは課金でなく「満員($0)」で止まる(親 §4)。

---

## 9. モジュール構成(テスト容易性 = yjs/WebRTC 非依存の注入式)
④-b-1 の `presence.ts`(AwarenessLike 注入式)と同じ流儀で、純粋ロジックを WebRTC/yjs 非依存に切り出す:

- **`src/lib/collab/cursorTransport.ts`(新規)**: mesh membership 導出(roster → 接続すべき clientID 集合)・glare 判定(initiator か)・signaling 状態機械(offer/answer 受領処理)。`RTCPeerConnectionLike` / `AwarenessLike` を注入して fake でテスト。
- **`src/lib/collab/cursorInterp.ts`(新規)**: lerp 補間・古いパケット破棄(`t` 比較)・可視判定の純関数。
- **座標変換**: 既存 [coords.ts](../../../src/components/Memo/coords.ts) を流用(テスト済み)。
- **描画層**: `CursorOverlay`(新規・MemoOverlay 同型)。位置は imperative(transform 直書き)、React は peer 集合のみ。
- **配線**: [collabProvider.ts](../../../src/lib/collab/collabProvider.ts) の `startCollabSession` に cursor transport を結線(④-b-1 の `wirePresence` と同じ位置)。WebRTC コードは遅延チャンク境界の内側に閉じる(main bundle 非混入)。
- store: `useCollabPresenceStore`(④-b-1)に cursor 関連(自分の cursorEnabled/jobId・フォールバック状態)を追加。カーソル位置自体は store に入れない(高頻度 = 描画層 ref で持つ)。

---

## 10. i18n / プライバシーポリシー
- roster は ④-b-1 で 4 言語済み。④-b-2 追加分 = ジョブ選択ラベル・カーソル ON/OFF・ON 時説明モーダル・フォールバック通知(ja/en/ko/zh)。
- **プライバシーポリシーに 1 行追記**(公開前・多言語): 「共同編集でカーソル共有を ON にすると、同じ部屋の参加者に IP アドレス(おおよその地域)が見えうる。既定は OFF」。親 §7/§12 の追記方針に含める。

---

## 11. plan で詰める(未確定・実装計画/spike 残)
- **awareness が readOnly(viewer)接続でもブロードキャストされるか**を 1 点実機確認(④-b-1 で viewer が roster に出て APPROVED 済 = 動く前提だが、signaling の土台なので念のため)。
- カーソルサンプル Hz(~10–15)と ease(lerp)係数の実測チューニング。
- ON 時説明モーダルの再表示頻度(セッション初回のみ / 毎回)。
- 配色は ④-b-1 の `PALETTE` を流用(カーソルと roster で共通)。最終色はユーザー視覚確認で微調整(④-b 設計書 §11)。
- フォールバック通知の最終的な出し方(控えめ通知 vs 無表示)。
- ④-a の `collabEditor`(サーバ uid)と roster `isEditor` の整合(表示=roster / 強制=サーバ)は ④-b-1 で確立済み・カーソルは権限と独立。

---

## 12. 実装の段取り(④-b-1 と同じ刻み・held 継続)
本書は ④-b-2 単体の設計。実装計画(writing-plans)で TDD タスク分解する。push/deploy/UI 露出は親方針どおり **⑤-3d 統合検証 + 承認まで held**(④-b-1 と同じブランチ系列 or 後続ブランチ)。

> 実装順: cursorTransport / cursorInterp(純ロジック・TDD)→ CursorOverlay 描画 → collabProvider 結線 → ジョブ選択 + ON/OFF トグル + 説明モーダル UI → フォールバック → i18n。
