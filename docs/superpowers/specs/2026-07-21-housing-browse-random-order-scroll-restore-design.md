# ハウジング一覧: 表示順ランダム化 + スクロール位置復元 設計書

- 日付: 2026-07-21
- 対象: `src/components/housing/pages/BrowsePage.tsx` / `src/components/housing/browse/*` / `src/components/housing/favorites/*` / `src/components/housing/pages/HousingerPage.tsx` / `src/lib/housing/sortListingsForGallery.ts`
- 発端: 実機フィードバック(2026-07-21)。「物件が増えてきたので、新しい/埋もれている物件も新鮮に見えるように表示順にランダム性を追加してほしい」「一覧→詳細→戻ると一覧が先頭に戻ってしまう、クリックした物件の位置に戻したい」の2件をbrainstormingで併せて検討した。

## 経緯・調査で判明したこと

- 探すページ(`BrowsePage.tsx:89-97`)の現在のデフォルト表示は、`sortListingsForGallery`(`src/lib/housing/sortListingsForGallery.ts:60-87`)による**住所順グループ化**(エリア→DC→サーバー→区→建物順)。2026-05-28に「時系列だと違和感がある」という理由で採用された経緯があるが、ユーザーは今回「そもそもおかしい気がしていた、新しいものが上にある方が一般的」と判断し、廃止を決定。
- 「新着順/古い順」トグル(`BrowseSortSelect.tsx`)は既存だが、選択すると住所グループ化を上書きする形で`createdAt`比較を行うのみ(2択)。
- 一覧はページング/無限スクロールなし。Firestore側`orderBy('createdAt','desc').limit(200)`で一括ロードし、`ListingGrid`が全件を一度にDOM化する(`ListingGrid.tsx:37-41`)。スクロール対象はwindowではなく`.housing-listing-grid`要素自身(`overflow-y:auto`)。
- 探す(`BrowsePage`)・詳細(`HousingDetailPage`)はReact Routerの兄弟ルートで、`Outlet`切り替え時に探すページはアンマウントされる(`App.tsx:99-109`、`HousingShell.tsx:98`)。そのため、コンポーネント内`useState`に並び順やスクロール位置を持たせても戻ったときに失われる。
- 一覧→詳細→戻る、を持つ画面は`ListingCard`/`ListingGrid`/`FavoritesGrid`の使用箇所から3つ判明: **探すページ(BrowsePage)・お気に入りページ(FavoritesPage)・ハウジンガープロフィールページ(HousingerPage、投稿者の物件一覧)**。マップ表示モード(`RoomListPanel`/`MapSpotCard`)は別UIのため対象外(既存TODOでも保留扱い)。
- 类似のセッション内state保持パターンは既存(`useHousingViewStore.ts`/`useHousingRandomStore.ts`、共にsessionStorage永続化のzustand)。ただし今回はこれらとは異なる要件(後述)のため、**永続化しない**プレーンなzustand storeを新設する。

## 要件(確定)

1. **デフォルト表示順を「ランダム」に変更**。「新着順」「古い順」も引き続き選べる(3択)。住所順は選択肢から廃止する(ただし`sortListingsForGallery`自体は他箇所=お気に入りページの「すべて」タブ等で使用中のため関数は残す。無理に消さない)。
2. **ランダム順の再シャッフル条件**:
   - アプリ内の移動(詳細ページへ→戻る、他タブへ切り替え→探すページに戻る等)では**シャッフルし直さない**(離れる前と同じ並びで戻る)。
   - ブラウザの実リロード(F5・タブを新しく開き直す)では**新しくシャッフルする**。
   - 「🔀 シャッフル」ボタン(能動的な操作)でも新しくシャッフルできる。押すと一覧の先頭にスクロールし直す。
3. **スクロール位置の復元**: 探すページ・お気に入りページ・ハウジンガープロフィールページの3画面で、一覧から詳細へ移動して戻ったときに、離れる直前のスクロール位置に戻す。
4. シャッフルボタンはモバイル幅でも適切な位置に配置する(実装時に実機/DevToolsで確認必須、`docs/.private/housing-tour-mockup`のトンマナ・`--housing-*`トークン経由で新規追加)。

## アーキテクチャ

### 状態の持ち方: 非永続(non-persisted)なzustand store

「アプリ内移動では保持・実リロードでは消える」という要件は、**sessionStorage等に永続化しない、ブラウザタブのJSメモリ上だけで生きるstore**で自然に満たせる。React RouterのSPAナビゲーション(`Outlet`切り替え)はJSモジュールの状態を破棄しないため、`persist`ミドルウェアなしの通常のzustand storeで:

- アプリ内のページ間移動・タブ切り替え → 状態は生きたまま(要件を満たす)
- ブラウザの実リロード → JSメモリごと消える(要件を満たす)

を追加の分岐ロジックなしに実現できる。既存の`useHousingViewStore`/`useHousingRandomStore`(sessionStorage永続化)とは意図的に異なる実装にする。

新設: `useHousingListOrderStore`(仮)。リスト種別(`'browse' | 'favorites' | 'housinger'`)ごとに以下を保持:

```
{
  [listKey]: {
    seed: number,        // ランダム順を決めるシード値
    scrollTop: number,   // 離脱時のスクロール位置
  }
}
```

### ランダム順の実装方式

シャッフル結果の配列そのものを保持するのではなく、**シード値だけ**を保持し、表示のたびに「現在の listings 配列 + シード値」から決定的にシャッフルする(seeded PRNGによるFisher-Yates等)。これにより:
- 同じシードなら常に同じ並びになる(再レンダーで安定)
- 新しい物件がロード中に追加されても特別なマージ処理が要らない(シャッフル関数への入力が変わるだけ)
- 保持するデータ量が最小(数値1個)

シードの更新タイミング: 初回マウント時にstore内に値が無ければ生成、リロード後(=store初期化後)も無ければ生成、シャッフルボタン押下時は明示的に再生成。

### スクロール位置の保存・復元

各対象ページで、コンポーネントのunmount時(React `useEffect`のクリーンアップ)に、その時点の`.housing-listing-grid`(またはお気に入り/プロフィールページの対応コンテナ)の`scrollTop`をstoreへ保存する。再マウント時、一覧データの描画完了後に保存済み`scrollTop`があれば復元する。ページ内の他要因での離脱(タブ切り替え等)も同じunmountフックで一律カバーする。

### 対象3画面での共通化

3画面(探す/お気に入り/プロフィール)で同じstore・同じフック(`useListOrderAndScroll(listKey)`のような共通hook)を使い回し、個別に実装を重複させない。

## UIの変更

- `BrowseSortSelect`の選択肢を「ランダム(既定)/新着順/古い順」の3つに変更(住所順を除去)。
- ソート選択の隣に「🔀 シャッフル」ボタンを追加(ランダム表示中のみ活性、housing tokens経由・モバイル幅での配置を実装時に確認)。
- お気に入りページ・プロフィールページのソートUIに変更が必要かは各ページの既存UI次第(お気に入りは既存タブ構成があるため、ランダム要件は「探すページのみ」の可能性もあるが、スクロール位置復元は3画面共通で適用する)。

## スコープ確認

- ランダム表示順(デフォルト変更+シャッフルボタン)は**探すページのみ**が対象(お気に入り・プロフィールページの既存ソート仕様は変更しない)。
- スクロール位置復元は**探す・お気に入り・プロフィールページの3画面**が対象。

## テスト方針

- シード値からの決定的シャッフル関数のユニットテスト(同シード同結果、シード違いで結果が変わることを確認)。
- store(非永続)がSPA内遷移で値を保持し、明示的なリセット操作でのみ変わることのユニットテスト。
- 3画面それぞれでスクロール位置保存→復元のユニット/結合テスト。
- モバイル幅でのシャッフルボタン配置の実機確認(スクリーンショットまたはPlaywright)。

## リスク・影響範囲チェック

- 影響ファイル: `src/components/housing/pages/BrowsePage.tsx`、`src/components/housing/browse/BrowseSortSelect.tsx`、`src/components/housing/browse/ListingGrid.tsx`、`src/lib/housing/sortListingsForGallery.ts`(関数は残置、呼び出し元のみ変更)、新設 `src/store/useHousingListOrderStore.ts`(仮)、`src/components/housing/favorites/FavoritesGrid.tsx`・`FavoritesPage.tsx`、`src/components/housing/pages/HousingerPage.tsx`、`src/styles/housing.css`(シャッフルボタンのトークン)。
- 既存の「住所順」ロジック(`sortListingsForGallery`)はお気に入りページの「すべて」タブ等で引き続き使われるため削除しない。
