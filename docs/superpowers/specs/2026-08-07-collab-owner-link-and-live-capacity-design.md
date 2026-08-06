# 共同編集: オーナーの自動判別・リンク再作成不要の人数変更 設計書

## 背景・課題

共同編集のオーナーがリンクを発行してDiscord等に共有すると、オーナー自身もそのリンクを踏んで開くことがほとんどになる。しかし現状、`/collab/:roomToken` を開いた人は誰であっても一律「参加者(ジョイナー)」として扱われ、オーナー自身が開いた場合でもオーナー権限(共同編集パネルを開く・人数を変える・リンクを失効/再発行する等)が一切無い。

また、共同編集の「入れる人数」をオーナーパネルの+/-ボタンで変更しても、閉じて開き直すと変更前の値に戻ってしまうバグがある(サーバー側には正しく反映されているが、表示の再同期元がズレている)。

この2点を改善する。

## ゴール

1. オーナーが自分の共有リンクを開いたら、自動的にいつもの編集画面(そのプランを開いた状態)に案内される。他人・未ログインの場合は今まで通り参加者画面のまま。
2. 「入れる人数」をリンクを作り直さずに変更でき、かつ変更が閉じても消えない。変更中であることが画面上ではっきり分かる(明示的な確定操作)。

## 非ゴール

- オーナー判別のUIは今回追加する「確認中」表示以上に凝った演出を作らない。
- 共同編集の参加人数の仕組み自体(SYSTEM_MAX_PARTICIPANTS等)は変更しない。

---

## パート1: オーナーの自動判別とリダイレクト

### サーバー側: `/api/collab/room` に `check-owner` アクションを追加

既存の `/api/collab/room`(`api/collab/_roomHandler.ts`)は `create` / `set-max` / `revoke` / `reissue` の4アクションを持ち、いずれも Firebase ID Token を検証してから `plans/{planId}.ownerId` と突き合わせている。この検証済みの認証経路をそのまま再利用する。

新アクション `check-owner` は他の4つと違い、入力が `planId` ではなく `roomToken`(訪問者はリンクの roomToken しか知らない)。

- 入力: `{ action: 'check-owner', roomToken: string }`
- 処理: `collabRooms/{roomToken}` を1件取得(ルーム作成時に既に `ownerId` と `planId` が書き込まれているので、`plans` コレクションへの追加アクセスは不要)。
  - ドキュメントが存在しない → `{ isOwner: false }`
  - `ownerId` が今ログイン中のユーザーの uid と一致 → `{ isOwner: true, planId }`
  - 一致しない → `{ isOwner: false }`
  - 失効(`revoked: true`)済みでも、オーナー本人なら `isOwner: true` を返す(リンクの生死に関わらず「本人のプランを開いた」扱いにするのが自然なため)。
- 既存の `verifyAppCheck` / レート制限 / ID Token 検証はハンドラ冒頭で共通適用済みなのでそのまま効く。Firestore の書き込みは発生しない(読み取りのみ)。
- `_roomManageLogic.ts` の `Action` 判別に `check-owner`(roomToken必須・planId不要)を追加し、`_roomHandler.ts` 側で `planId` を前提にした既存のトランザクション処理より前に早期分岐させる。

### クライアント側: `CollabJoinerPage` の初期分岐

1. `useAuthStore` の `loading` が解消するまで待つ(未解決の間は今の「接続中...」表示のまま)。
2. ログインしていなければ判別をスキップし、今まで通り参加者フローへ進む(待ち時間の追加なし)。
3. ログインしていれば `check-owner` を1回呼ぶ。
   - `isOwner: true` → `usePlanStore.getState().setCurrentPlanId(planId)` を呼んだ上で `/` へ遷移する。以降はいつもの編集画面(Sidebar・ConsolidatedHeader・共同編集パネル等)がそのプランを開いた状態で表示される。
   - `isOwner: false`、またはリクエスト自体が失敗(通信エラー等) → 安全側に倒して今まで通りの参加者フローへ進む。判別失敗が参加者体験を壊すことは無い。

表示中の「接続中...」は既存の `joinerView()` の `connecting` 状態をそのまま流用する(判別待ちと接続待ちを同じ画面でまとめて表現する。新しい文言・状態は追加しない)。

---

## パート2: 人数変更をリンク再作成なしで確実に

### バグ修正: `useCollabSessionStore.setMax` の保存漏れ

`start`(新規作成)と `reissue`(再発行)は成功時に `usePlanStore.getState().updatePlan(planId, { collabMaxParticipants: ... })` を呼んで自分のプランデータ側にも人数を書き戻しているが、`setMax` だけこれが抜けている。そのため +/- で変更した値はサーバーには正しく保存されるのに、パネルを閉じて開き直すと「plan側に残っている古い値」で上書き表示されてしまう。`setMax` の成功時処理に同じ書き戻しを追加する。

### UI変更: 「仮の値」と明示的な確定ボタン

`OwnerCollabPanel.tsx` の人数まわりを、即時送信(400msデバウンス)から「編集→確定」の2段階に変更する。

- +/-ボタンはローカルの「仮の値」だけを動かす(まだAPIを呼ばない)。
- 仮の値が実際に保存済みの値と異なる間だけ、「定員を◯人に変更する」ボタンが人数の横(スマホ幅では折り返して下)に表示される。
- ボタンを押すと `setMaxParticipants` を呼び、成功したら仮の値を確定値として扱い(上記バグ修正により plan 側にも保存)、ボタンは消える。失敗時はエラーをトーストで示し、仮の値とボタンはそのまま残す(再試行可能)。
- 確定させずにパネルを閉じた場合、仮の値は破棄され次回開いたときは最後に確定した値が表示される。
- 現行の400msデバウンスタイマーは役目を終えるため削除する。

このパネルはPC(`ShareButtons.tsx`)・スマホ(`MobileShareController.tsx`)の両方から同じ `OwnerCollabPanel` コンポーネントを共有しているため、追加の実装をしなくても両方に反映される。既存のレイアウトも `md:grid-cols-2` でスマホ幅は自動的に縦積みになるため、確定ボタンもその流れの中で折り返させる。

新しいボタン文言はハードコードせず、既存の `collab.*` 系と同じく `src/locales/{ja,en,ko,zh,zh-Hant}.json` 全てにi18nキーを追加する(プロジェクトの i18n ルール準拠)。パート1の「接続中...」は既存文言の流用のため新規キーは不要。

---

## 影響範囲・変更予定ファイル(概算・実装計画で確定)

- `api/collab/_roomManageLogic.ts`(`check-owner` アクションの型・バリデーション追加)
- `api/collab/_roomHandler.ts`(`check-owner` の早期分岐処理追加)
- `src/lib/collab/collabRoomApi.ts`(`checkOwner()` クライアントヘルパー追加)
- `src/components/CollabJoinerPage.tsx`(オーナー判別→リダイレクト分岐追加)
- `src/store/useCollabSessionStore.ts`(`setMax` の保存漏れ修正、デバウンス削除)
- `src/components/collab/OwnerCollabPanel.tsx`(仮の値+確定ボタンのUI変更)
- 関連テスト: `api`側の新アクションのユニットテスト、`CollabJoinerPage`のリダイレクト分岐テスト、`OwnerCollabPanel`の確定ボタン挙動テスト

## テスト方針

- サーバー: `check-owner` が本人/他人/未存在roomToken/失効済みルームそれぞれで正しいレスポンスを返すことをユニットテストで確認。
- クライアント: `CollabJoinerPage` について、未ログイン/ログイン中でオーナー/ログイン中で非オーナー/判別API失敗、の4パターンで遷移先が正しいことを確認。
- `OwnerCollabPanel`: 仮の値の表示、確定ボタンの出現条件、確定後にplan側の値が更新されること、未確定のまま閉じても値が変わらないことを確認。
