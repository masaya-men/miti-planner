# 共同編集: 空上書き防御(reseedEmptyDocFields)の信頼境界 設計書

## 背景・課題

共同編集の「空上書き防御」(`reseedEmptyDocFields`、`src/lib/collab/collabProvider.ts:121-155`)は、部屋(Y.Doc)側の構造フィールドが空で手元(`useMitigationStore`)が非空のとき、手元のデータを部屋へ再シードする。この仕組みは「手元データ = 呼び出し元が意図しているプランのデータ」という前提を無条件に信頼しており、**手元データが本当にこれから接続する部屋(roomToken/planId)のものかを一度も検証しない**。

この結果、以下2つの経路(いずれもユーザーの明確な誤操作を伴わない)で、無関係なプランのデータが他人の共同編集ルームへ不可逆に(全参加者に見える形で・Firestoreにも永続化されて)混入しうる。

1. **参加者の同意済み部屋への再訪問**(`CollabJoinerPage.tsx:251`): ログイン済みで過去に「編集に同意」した部屋を再訪問すると、初回接続から書き込みモードになる。この時点で手元にあるのは直前に開いていた無関係なソロプランのデータ。
2. **オーナーのマルチタブ+リロード自動接続**(`Layout.tsx`起動時 → `collabLifecycle.ts:44`): 複数タブ/ウィンドウで別々のプランを操作し、どちらかをリロードするだけで、ユーザー操作なしに無関係データが部屋へ push されうる。

根本原因は、「今表示中のデータはどのプランのものか」を示す札(`useMitigationStore._loadedPlanId`)が `partialize` に含まれておらずページ再読込のたびに消え、その札を貼り直す処理(`Layout.tsx`起動時 `useEffect`)がデータの中身を確認せず`currentPlanId`で無条件に上書きすることにある。

調査の全過程は `docs/.private/2026-08-07-collab-data-safety-audit/`(`00-synthesis-and-next-steps.md` + `audit1〜4-*.md`)に記録済み。本設計書はこの調査を踏まえたもの。

## ゴール

- 上記2経路(P0)を、同じ仕組みで一度に塞ぐ。
- 副作用として、`start()`/`reissue()`(ユーザーの能動的操作)にも同じ弱点が理論上あることがわかっているため、同じ仕組みで一律に守る。
- 既存ユーザーのデータ・体験に一切影響を与えない(移行を意識せず自動的に安全化される)。
- 通常の共同編集操作(開始・自動再接続・人数変更・リンク再発行・リンク失効)の挙動を変えない。

## 非ゴール

- サーバー(Cloudflare Durable Object)側に部屋の「真の持ち主」を記録させる案(調査でいう案C)は今回やらない。クライアント側の信頼境界を直すだけで実務上十分に事故を防げると判断(理由は後述)。過剰投資と判断されたため温存する。
- `docs/TODO.md` の別項目(roomToken切替時のstale closure、P3・到達可能なUI導線なし)は対象外。

---

## 設計方針: 全体像

対策は3層。**どれか1つでは不十分**で、3つ揃って初めて2つのP0経路を両方閉じられる(理由は各パートで説明)。

1. **`_loadedPlanId` の永続化**: 札を再読込をまたいでも正しく持ち歩けるようにする。
2. **起動時ブートストラップの食い違い検出**: 札を貼り直す処理に「保存されていた札と今開こうとしているプランが食い違っていないか」の確認を追加する。食い違っていたら盲目的に貼り直さず、プランの保存データから読み直す(＝今の「データが空だったとき」と同じ安全な経路に合流させる)。
3. **接続直前の信頼確認ガード**: 部屋へ書き込む直前、「札が指しているプランの部屋」と「これから接続する部屋」が一致するかを確認し、不一致なら再シードだけをスキップする。

なぜ3層必要か: 3のみ(接続直前チェックのみ)だと、経路2(オーナーのマルチタブ)を防ぎきれない。この経路では、起動時に札そのものが「間違っているのに、たまたま接続先と一致して見える」形で貼り直されるため、接続直前チェックだけでは食い違いを検知できない(誤った札が、誤った札が指す先の部屋と比較されるので、当然一致してしまう)。1と2で札自体を信頼できるものにして初めて、3のチェックが意味を持つ。

---

## パート1: `_loadedPlanId` の永続化

`src/store/useMitigationStore.ts` の `partialize`(1818-1834行)に `_loadedPlanId: state._loadedPlanId` を追加する。

- 読み取り側は `Layout.tsx:297`(自動保存の保存先決定)のみで、追加によって壊れる既存箇所は無い(既存コードを実読みして確認済み)。
- データ本体(`loadSnapshot`)と常にアトミックに更新される設計は既にあるので、このフィールドを保存対象に加えるだけで「データ本体と一緒に持ち運ばれる札」になる。

---

## パート2: 起動時ブートストラップの食い違い検出

`src/components/Layout.tsx` の起動時 `useEffect`(234-250行)を変更する。

現状:
```
if (shouldRestoreMitigationFromPlan(...) && plan?.data) {
    loadSnapshot(plan.data, currentPlanId);
} else if (currentPlanId) {
    setLoadedPlanId(currentPlanId); // 中身を見ずに無条件で貼る
}
```

変更後: `else` 分岐に入る前に、**このマウントの一番最初の時点**(何も `set()` していない状態)で `useMitigationStore.getState()._loadedPlanId` を読み、`currentPlanId` と比較する。

- **未設定(`null`/`undefined`)** → 「まだ一度も確認されていない」扱い。今まで通り `setLoadedPlanId(currentPlanId)` を実行(挙動変更なし)。これにより、この修正を配信した直後の全既存ユーザーの初回起動は、今と完全に同じ動きをする(後述「移行」参照)。
- **具体的な値が入っていて、かつ `currentPlanId` と異なる** → 食い違いを検出。`shouldRestoreMitigationFromPlan` が true だったときと同じ経路(`loadSnapshot(plan.data, currentPlanId)`)に合流させ、`plan.data`(Firestore/localStorage 上の確定データ)から読み直す。手元に残っていた無関係データで `currentPlanId` のラベルを汚さない。
- **一致** → 今まで通り `setLoadedPlanId(currentPlanId)`(実質 no-op)。

この効果は `React.useEffect(..., [])` で mount 時に1回だけ実行される(依存配列が空であることをコードで確認済み)。プラン切替(Sidebar経由)はこの effect を再実行しないため、通常のプラン切替操作には一切影響しない。

---

## パート3: 接続直前の信頼確認ガード

### 新規の純粋関数

`src/lib/collab/collabReseed.ts` に追加(既存の `fieldsNeedingReseed` と同じファイル、同じ「テスト容易性のため分離された純粋ロジック」という位置づけ):

```ts
export function canTrustLocalDataForRoom(args: {
  loadedPlanId: string | null;
  roomToken: string;
  plans: { id: string; activeCollabRoomToken?: string }[];
}): boolean {
  const { loadedPlanId, roomToken, plans } = args;
  if (!loadedPlanId) return false;
  const plan = plans.find((p) => p.id === loadedPlanId);
  if (!plan) return false;
  return plan.activeCollabRoomToken === roomToken;
}
```

既存の `canOpenOwnerEditor`(`CollabJoinerPage.tsx:72-85`、本ブランチで既に実装・レビュー済み)と同じ考え方(「札が指す先の持ち物が、今アクセスしようとしている対象と一致するか」)を、reseed の入口に適用したもの。

### 呼び出し箇所

`src/lib/collab/collabProvider.ts`:

- `applyRoomToStore` の `opts` 型に `roomToken: string` を追加。呼び出し元(同ファイル449行目、`startCollabSession` 内の `onSynced`)は既に `roomToken` を関数引数として持っているので、渡すだけでよい。
- `usePlanStore` を静的 import する(現状このファイルは import していない。`usePlanStore` はどのみち main bundle に含まれる通常の store なので、遅延ロード境界に影響しない)。
- `reseedEmptyDocFields(doc, store)` の呼び出し(176行目)を、次のガードで包む:

```ts
if (!opts.readOnly) {
  const store = useMitigationStore.getState();
  store.enterCollabMode(opts.handlers);
  const trusted = canTrustLocalDataForRoom({
    loadedPlanId: store._loadedPlanId,
    roomToken: opts.roomToken,
    plans: usePlanStore.getState().plans,
  });
  if (trusted) {
    reseedEmptyDocFields(doc, store);
  } else {
    console.warn('[LoPo][collab] 手元データの持ち主が接続先の部屋と一致しないため、空上書き防御をスキップしました', {
      loadedPlanId: store._loadedPlanId, roomToken: opts.roomToken,
    });
  }
}
```

**`enterCollabMode` はスキップしない**(不一致でも呼ぶ)。理由: このブロックの直後(178-186行目)で、部屋の本当のデータが無条件に手元へ反映される(`_applyMitigationsFromCollab` 等)。不一致を検出した場合でも、その直後に手元が部屋の正しいデータで上書きされるため、共同編集自体は正常に始まる。ユーザーから見ると「特に何も起きなかった」ように見え、書き込み(汚染)だけが防がれる。

---

## パート4: 副次的に見つかった回帰リスクの解消(`reissue()` の順序修正)

設計検討中に発見: `src/store/useCollabSessionStore.ts` の `reissue()`(98-109行)は、`startCollabSession(info.roomToken)`(105行目)を呼んだ**後**に `updatePlan(planId, { activeCollabRoomToken: info.roomToken, ... })`(107行目)を呼んでいる。`start()`(51-65行)は逆に `updatePlan`(58行目)→ `startCollabSession`(63行目)の順。

パート3のガードをそのまま適用すると、`reissue()` 実行時、接続の瞬間にはまだ `plan.activeCollabRoomToken` が**古いトークンのまま**(=新しく作った部屋のトークンと一致しない)ため、オーナー自身の正当な「リンク再発行」操作が誤って「不一致」と判定され、再発行した部屋にデータが再シードされず空のまま、という新規の不具合を生む。

対策: `reissue()` の2行を入れ替え、`updatePlan(...)` を `startCollabSession(...)` より前に呼ぶ(`start()` と同じ順序に揃える)。これはこの修正の一部として一緒に行う。

---

## エッジケース・安全側動作一覧

| ケース | 挙動 |
|---|---|
| `_loadedPlanId` が `null`(未確定) | 信頼しない(reseedスキップ)。ガードの `!loadedPlanId` で判定 |
| `_loadedPlanId` が指すプランがローカルに存在しない(削除済み等) | 信頼しない(reseedスキップ) |
| プランに `activeCollabRoomToken` が無い(collab-OFF) | 信頼しない(reseedスキップ、`undefined !== roomToken`で自然に不一致) |
| ブートストラップで札が未設定(この修正配信直後の全既存ユーザーの初回起動) | 「食い違い」扱いにしない。今まで通り黙って札を貼るだけ(データ・挙動とも無変化) |
| ブートストラップで札と `currentPlanId` が明確に異なる | `plan.data` から読み直す(安全側) |
| `start()`/`reissue()`(能動的操作) | `updatePlan` が `startCollabSession` より先に走るため、正しく信頼される(パート4で保証) |
| 参加者の consent 昇格(読み取り専用→編集、2回目以降の接続) | 元々 SAFE(調査 audit1 で確認済み・今回の変更で悪化しない。手元は既に部屋のデータと同期済みのため） |

---

## 移行(既存ユーザー)

この修正を配信した直後、全既存ユーザーの初回起動時:

1. `mitigation-storage` に `_loadedPlanId` キーが無い(旧バージョンでは保存されていなかったため) → 起動直後の値は `null`。
2. パート2の分岐で「未設定」扱いになり、今まで通り `setLoadedPlanId(currentPlanId)` を実行するだけ。データは一切読み直されず、触られない。
3. その `set()` 呼び出し自体が zustand の persist 機構により即座に localStorage へ書き込まれる(操作不要・タブを閉じるだけでも書き込み済み)。これ以降、このユーザーは正しい札を持ち歩く状態になる。

つまり全既存ユーザーは、この修正が入った後に一度アプリを開くだけで自動的に・データを一切書き換えずに移行が完了する。

---

## テスト方針(TDD)

- `canTrustLocalDataForRoom`(新規): 一致/`loadedPlanId`が`null`/プランが見つからない/`activeCollabRoomToken`不一致、の4パターンを単体テスト。
- `useMitigationStore` の永続化: `_loadedPlanId` が `partialize`→`merge` を経ても保持されることの回帰テスト(既存 `loadedPlanId.test.ts` を拡張)。
- `Layout.tsx` 起動時 effect: (a) 札が未設定+ストア非空 → 読み直しが起きないこと、(b) 札が`currentPlanId`と異なる+ストア非空 → `loadSnapshot` が `plan.data` で呼ばれること、の2パターン。
- `applyRoomToStore`: 信頼できないときに `reseedEmptyDocFields` 相当の書き込みが Y.Doc に行われないこと、かつ `enterCollabMode` は呼ばれ部屋のデータが手元に反映されることの両方を確認。
- `useCollabSessionStore.reissue`: `updatePlan` が `startCollabSession` より前に呼ばれる順序の回帰テスト。
- 再現シナリオ相当のテスト: audit1 が特定した2つのP0手順(参加者の同意済み部屋再訪問/オーナーのマルチタブ+リロード)に近い形で、誤ったデータが部屋へ書き込まれないことを確認する統合テスト。

---

## スコープ外として温存する対策(案C)

部屋(Y.Doc/サーバー)側に不変の `ownerPlanId` を持たせ、クライアントのローカル状態を経由せずサーバー自身の記録と照合する案。今回のバグは悪意ある攻撃者ではなく正規クライアントの自己バグが原因であり、「送信前に持ち主を確認してから書き込む」という本設計(接続前チェック)は、この種の事故防止として広く使われる標準的な考え方(楽観的ロック/compare-and-swapと同種)で、実務上十分な安全性を低コストで達成できると判断。将来もし残余リスクが実害化した場合の次の一手として温存する。

---

## 変更対象ファイル一覧(実装は worktree `collab-owner-link-and-live-capacity` で行う)

- `src/store/useMitigationStore.ts` — `partialize` に `_loadedPlanId` 追加
- `src/components/Layout.tsx` — 起動時 `useEffect` に食い違い検出を追加
- `src/lib/collab/collabReseed.ts` — `canTrustLocalDataForRoom` 新規追加
- `src/lib/collab/collabProvider.ts` — `usePlanStore` import、`applyRoomToStore` の `opts` に `roomToken` 追加、reseed 呼び出しをガードで包む
- `src/store/useCollabSessionStore.ts` — `reissue()` の2行を入れ替え
- 上記に対応するテストファイル(既存拡張 + 新規)
