# リアルタイム共同編集 段取り②-a 設計書 — 軽減配置の最小同時編集 (2026-06-04)

> 段取り②(Yjsで PlanData 共有型化 + useMitigationStore 結合)の**最小核 ②-a**。
> 「2人が同じ軽減表を開き、軽減の配置だけをリアルタイムに同時編集できる(衝突なし)」までを作る。
> 親設計書: [2026-06-03-realtime-collab-design.md](./2026-06-03-realtime-collab-design.md) / 段取り①計画: [../plans/2026-06-03-realtime-collab-step1-room-skeleton.md](../plans/2026-06-03-realtime-collab-step1-room-skeleton.md)
> ブレスト(2026-06-04)で「安全に丁寧に・最小核から」の方針合意を spec 化したもの。

---

## 1. ゴールと非ゴール

### ゴール
- 2人が同じ軽減表を開き、**`timelineMitigations`(軽減の配置)** をリアルタイムに同時編集できる。
- 一方が軽減を置く/動かす/消すと、**もう一方の画面にライブで反映**される。
- 2人が同時に別の軽減を置いても**両方残る**(CRDT による衝突なしマージ = 本機能の心臓部)。
- **1人で使う既存ユーザーへの影響ゼロ**(共同編集の部屋に入っていない限り、従来と完全に同じ動作)。

### 非ゴール (後続段取りに送る)
- 軽減**以外**の要素(`timelineEvents` / `phases` / `labels` / `memos` / `partyMembers` / 単一値)の同期 → **②-b**。
- Undo/Redo の CRDT 化(Y.UndoManager) → **②-c**。
- **Firestore への保存(seed / 書き戻し)** → **③**。②-a では恒久保存しない(下記 §5)。
- presence / カーソル / 誰が置いたかの色分け → **④**。
- 共有リンク UI / ログイン必須化 / 人数上限 / 緊急停止 → **⑤**。②-a の検証は plan ID を直接使う(§6)。
- 圧縮プラン(`compressedData`)との統合 → ③以降(保存層の話)。

---

## 2. 全体アーキテクチャ — 「共同編集中だけ Yjs を挟む」

```
[1人モード = 従来]                     [共同編集モード = 部屋に入っている間だけ]
 useMitigationStore                     useMitigationStore (Yjsバインド有効)
   state を直接 set                       add/remove/updateMitigationTime
   ↓ (従来の保存フロー)                      ↓ 書き込み先を Y.Array に振り替え
 localStorage / Firestore               Y.Doc.timelineMitigations (Y.Array<Y.Map>)
                                          ↕ (y-partyserver YProvider / WebSocket)
                                        段取り①の DO 部屋 (lopo-collab)
                                          ↕
                                        相手クライアントの Y.Doc → store → UI
```

- **部屋 = 段取り①で作った Durable Object**(`workers/collab/`、本番稼働中)。②-a で**サーバ側 Worker のコードは変更しない**(素の Yjs リレーで足りる。y-partyserver の Yjs 機能は段取り③の onLoad/onSave で本格利用)。
- **クライアント**: フロントが **y-partyserver のクライアント(YProvider 相当) + partysocket** で DO 部屋に WebSocket 接続し、`Y.Doc` を同期する。
- **共同編集中だけ** `useMitigationStore` を `Y.Doc` にバインドする。部屋を出たらバインドを解除し、従来モードへ戻す。

### 既存資産を壊さない原則 (§最重要)
1. **1人モードのコードパスは一切変更しない。** `useMitigationStore` の既存 action は従来通り `set()` で state を更新する。共同編集モードは**その上に分岐として乗せる**(後述 §4)。
2. **共同編集中は既存の Firestore 自動保存(markDirty / syncToFirestore)を抑制する。** さもないと 2 クライアントが各自 Firestore を後勝ち上書きして取り合う(親設計書 §2「部屋で編集中はその表の編集は部屋を通す」)。localStorage キャッシュは各自継続して可。**Firestore への確定保存は③で DO が代表して行う。**
3. 段取り①の Worker・既存の保存/同期/墓標マージ([src/lib/mergePlans.ts](../../../src/lib/mergePlans.ts))には触らない。

---

## 3. データモデル (Yjs)

- `Y.Doc` のトップに `timelineMitigations` という **`Y.Array<Y.Map>`** を1本持つ。
- **軽減1個 = 1つの `Y.Map`**。`AppliedMitigation` ([src/types/index.ts:82-91](../../../src/types/index.ts#L82-L91)) は全フィールドがプリミティブ(string/number/boolean、ネストなし)なので、各フィールドを `Y.Map` のエントリにフラットに格納できる:
  - `id`(string・一意, crypto.randomUUID) / `mitigationId`(string) / `time`(number) / `duration`(number) / `ownerId`(string) / `targetId`(string?) / `linkedMitigationId`(string?) / `autoHidden`(boolean?)。
- **なぜ要素単位の Y.Map か**: 配列まるごと1値で持つと、A が MT に鉄壁・B が ST に守りを同時に置くと片方が消える。要素単位なら両方残る(衝突なしマージ)。`id` が既に全要素ユニークなので、要素の同定・移動・削除が安定する。
- ②-a では `timelineMitigations` のみ。他のキーは②-b で同じ `Y.Doc` に追加する(将来拡張を見据え、トップレベルにキーを並べる構造にする)。

---

## 4. useMitigationStore との結合方式

共同編集中だけ有効になる「Yjs バインド層」を新設する(既存 action 本体は触らない方針)。

### 入室時 (seed)
1. 部屋(plan ID)に YProvider で接続し `Y.Doc` を得る。
2. **最初の参加者**: 自分の現在の `timelineMitigations`(store)を `Y.Array<Y.Map>` に書き込んで初期化する。
3. **2人目以降**: `Y.Doc` が既に内容を持つので、それを store に反映する(自分のローカル状態は上書きされる = 部屋の状態が正)。

### ローカル編集 → Yjs
- 共同編集中、`addMitigation` / `removeMitigation` / `updateMitigationTime` の3 action が、`set()` で直接 state を変える代わりに **`Y.Array<Y.Map>` を操作**する(push / delete / 該当 Y.Map の set)。
- 実装方式は writing-plans で確定(有力案: store に `_ydoc` 参照を持たせ、3 action 冒頭で「Yjsモードなら Y 操作して return、でなければ従来 set」と分岐。既存ロジック=盾連鎖解決等は Yjs 反映後の observe ハンドラ側で再計算)。

### Yjs → store → UI
- `Y.Array` の `observe` で変更を受け、`timelineMitigations` を再構築して `set()` → 既存の `useShallow` selector 経由で UI 更新([Timeline.tsx](../../../src/components/Timeline.tsx) / [CheatSheetView.tsx](../../../src/components/CheatSheetView.tsx))。
- 自分の操作も相手の操作も**同じ observe 経路**で store に入る(単一の真実 = Y.Doc)。

### 退室時
- YProvider を切断し、バインドを解除。store は通常モードに戻る(以後の編集は従来の `set()` + 保存フロー)。

### Firestore 自動保存の抑制 (§2-2)
- 共同編集モードの間、[Layout.tsx](../../../src/components/Layout.tsx) の `markDirty` / Firestore PUSH 経路を**抑制するフラグ**を立てる。実装箇所・フラグの持ち方は writing-plans で確定。

---

## 5. 保存とリロードの扱い (②-a の正直な限界)

- ②-a では **Firestore への確定保存をしない**。共同編集の内容は、**部屋(DO)が生きている間だけ** Y.Doc 上に存在する。
- 全員が退室して部屋が空になると、その Yjs 状態は失われる(DO の Y.Doc は揮発)。**恒久保存は③(DO が onSave で Firestore へ書き戻す)で実装する。**
- リロード/再接続: 部屋がまだ生きていれば、再接続で Y.Doc から復元される。部屋が消えていれば共同編集分は失われる(②-a の限界。③で解消)。
- → ②-a の実機確認は「**2画面で軽減がライブ同期するか / 同時操作で両方残るか**」を見る。「保存されて後で開いても残る」は③の確認事項。

---

## 6. 部屋への入り方 (②-a の最小形)

- ②-a では共有リンク UI(⑤)を作らない。**ルームID = plan ID(軽減表の ID)** を直接使う。
- 検証では「同じ plan ID を指定した2クライアント」が同じ DO 部屋に繋がる(段取り①で実証済みのルーティング `/parties/room/<plan-id>`)。
- 「一緒に編集」を始める UI 入口(ボタン)とログイン必須化は⑤。②-a は**結線の確立**に集中する。

---

## 7. テスト / 検証

- **ユニット(vitest)**: 「Yjsバインド層」を純粋に近い形で切り出し、`Y.Doc` を2つ用意して「A の add が B に伝わる / 同時 add で両方残る / updateTime / remove」を Yjs レベルで検証(ネットワーク・DO 不要のローカル Yjs テスト)。既存ストアのテストは壊さない。
- **本番結線(node 2クライアント)**: 段取り①と同様、私(Claude)が2つのクライアントを本番 DO 部屋に繋ぎ「片方の軽減操作がもう片方に出る / 同時操作で両方残る」を実証してから、ユーザーが2ブラウザで確認。
- 既存の本体テスト(1人モード)が**全て従来通り緑**であることを各タスクで確認(非干渉の担保)。

---

## 9. 改訂 (2026-06-04 実機検証後) — サーバを YServer 化する

> writing-plans 着手前の事前調査で、**§2/§42 の前提「サーバ側 Worker は変更しない・素の Yjs リレーで足りる」は実機で否定された**。本節がその訂正であり、以後の正典。ユーザー承認済み (2026-06-04)。

### 9.1 何が否定されたか (証拠)
- 段取り①の素のブロードキャスト Worker に、`y-partyserver` の `YProvider` を node 2クライアントで本番接続した実機スパイク結果: **`provider.synced` が永久に false、軽減が1件も相手に伝わらない、後入室クライアントも空**。同時 add も互いにクロスしない。
- 一次ソース確認: `YProvider` は y-websocket フォークで、接続時に sync step1 を送り**サーバからの sync step2 応答を前提**にする。素のリレーは応答しないため同期が成立しない。
- 出典: [y-partyserver provider source](https://github.com/cloudflare/partykit/blob/main/packages/y-partyserver/src/provider/index.ts)、[README](https://github.com/cloudflare/partykit/blob/main/packages/y-partyserver/README.md)。

### 9.2 訂正後のアーキテクチャ
- **サーバ (`workers/collab/src/server.ts`)**: `Room extends Server`(partyserver)→ **`Room extends YServer`(y-partyserver)** に基底クラスを変更。素のリレー (`onMessage` ブロードキャスト) は廃止し、YServer が Y.Doc を握って sync protocol を話す。
- **段取り①資産の温存**: 在室数 `/count` HTTP は `onRequest` override で温存。ただし在室数の数え方は **`_connectionCount` インスタンス変数 → `getConnections()` ベース**へ変更(下記 9.3)。
- **クライアント**: `y-partyserver/provider` の `YProvider`(または `y-partyserver/react` の `useYProvider`)で接続。サーバ routing `/parties/room/<id>` に合わせ **`party: "room"` を必ず指定**。
- wrangler 構成(DO binding / `new_sqlite_classes` / compatibility_date 2026-05-29)は流用。

### 9.3 Hibernation (コスト $0 のため必須) — ソース確定事項
- `YServer` は hibernation 対応だが**デフォルト OFF**。サブクラスに **`static options = { hibernate: true }`** を明示して有効化(出典: [partyserver README](https://github.com/cloudflare/partykit/blob/main/packages/partyserver/README.md))。
- hibernation 中の idle は **duration 非課金**(出典: [Cloudflare DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/))。OFF だと WebSocket 接続中ずっと課金 → $0 前提が崩れる。
- 起床時、メモリ上の Y.Doc は空だが**生存接続から sync step1 で再同期して復元**(編集中データは消えない)。
- **Y.Doc の自動永続化はされない**。`onLoad`/`onSave` 未実装なら**全員退室で揮発** = 設計書 §5 の許容範囲。→ **②-a では `onLoad`/`onSave` を実装しない**(恒久保存は §③)。`onLoad`/`onSave` の保存先は外部(Firestore)で、③で実装する。
- ⚠️ hibernation で**インスタンス変数 `_connectionCount` は消える**ため、在室数は `getConnections()`(= `ctx.getWebSockets()` ベース、hibernation 安全)で数える。

### 9.4 §8 未確定事項の解決状況
- y-partyserver クライアント API: `import YProvider from "y-partyserver/provider"`、`new YProvider(host, room, doc, { party: "room", WebSocketPolyfill })`、cleanup は `provider.destroy()`、再接続は自動(exponential backoff)。**解決**。
- Y.Map 内フィールド変更(`updateMitigationTime`)の監視は **`observeDeep` が必要**(`observe` では配列の add/delete しか拾えない)。**解決**。
- ルームID=plan ID の接続/切断タイミング、3 action の Yjs 分岐の具体形、seed の最初の参加者判定、Firestore 抑制フラグ → **実装計画 [../plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md](../plans/2026-06-04-realtime-collab-stage2a-mitigations-sync.md) で確定**。

---

## 8. 要検証 / 未確定 (writing-plans で詰める)
- **y-partyserver のクライアント側 API**(YProvider / partysocket)の正確な使い方・接続/切断・再接続挙動(要調査)。②-a 着手前に workers/collab の workerd を本番 compatibility_date へ追随(`npm update wrangler`)させてから着手([[project-realtime-collab-status]] の注意①)。
- 3 action(add/remove/updateMitigationTime)の Yjs 分岐の**具体的な実装箇所と形**(store 内分岐 vs ラッパ層)。盾連鎖解決・依存チェック等の既存ロジックを observe 側でどう再適用するか。
- 入室 seed の「最初の参加者判定」(空の Y.Doc か否か)の確実な方法。
- Firestore 自動保存を抑制するフラグの持ち方と、抑制範囲(localStorage は残すか)。
- ルームID = plan ID をフロントのどこで解決し、いつ接続/切断するか(プラン切替・画面離脱との関係)。
- 共同編集中のプラン切替・タブ閉じなど離脱系の扱い(②-a では最小限、③/⑤で本格化)。
