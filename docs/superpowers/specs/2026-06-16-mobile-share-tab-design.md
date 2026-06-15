# スマホ共有タブ(B)設計書

**日付:** 2026-06-16
**ブランチ:** `feat/mobile-bottom-nav-redesign`(A の続き・A+B まとめて push/デプロイ)

## 目的

スマホのボトムナビ「共有」タブ(現状 `Coming soon` プレースホルダ=[Layout.tsx](../../../src/components/Layout.tsx) `mobileShareOpen`)に中身を実装し、**現在開いているプラン1つ**を PC と同じ挙動で共有できるようにする。共同編集(collab)は本番公開済みなので、コピー配布だけでなく共同編集リンク配布もスマホから行える。

## 確定した設計判断(ユーザー承認済 2026-06-16)

1. **共有タブ = 現在プラン1つの共有に専念**。複数まとめて共有(複数選択)は今までどおりメニュー(Sidebar の MULTI SELECT MODE → まとめて共有)に残す。共有タブには併設しない。
2. **PC の共有導線をミラー**: [ShareButtons.openShareUI](../../../src/components/ShareButtons.tsx) と同じ判定を再利用する。
   - 未ログイン → コピー共有モーダル直行(共同編集はログイン必須)
   - ログイン済み・collab OFF → 2択([ShareChoiceModal](../../../src/components/collab/ShareChoiceModal.tsx))
   - ログイン済み・collab ON → オーナーパネル直行([OwnerCollabPanel](../../../src/components/collab/OwnerCollabPanel.tsx))
3. **スマホのオーナーパネルはカーソル共有を非表示**。リンク配布・人数制限・部屋名・参加者一覧・失効・再発行は残す。カーソル(P2P ライブカーソル=マウス前提)とそれに紐づくアイコン選択([PresenceControls](../../../src/components/collab/PresenceControls.tsx))のみスマホで省く。PC は無傷。

## 非ゴール

- 複数プランまとめて共有のスマホ専用UI(メニュー側で既存対応済み)。
- スマホ専用の共有レイアウト新規作成(既存モーダルがすでに `max-w-94vw` + `grid md:grid-cols-2` で縦積み・portal でモバイル対応済み)。
- collab のサーバ/同期ロジック変更。
- カーソルのスマホ対応(明確に省く方針)。

## アーキテクチャ

### 1. `useShareFlow` フック(新規・共有フローの 1 ソース化)

`src/components/collab/useShareFlow.tsx`

PC ShareButtons に埋まっている「共有フローの状態機械」をヘッドレスに抽出する。**トリガー UI(ヘッダーのチップ/アイコン or ナビタブ)は各consumer 側**に残し、フックは状態とモーダルだけ持つ。

```ts
function useShareFlow(opts: {
  currentPlan: SavedPlan | undefined;
  contentLabel: string | null;
  hideCursor?: boolean;   // スマホ=true(オーナーパネルのカーソルUIを隠す)
}): {
  view: 'none' | 'choice' | 'copy' | 'panel';
  openShareUI: () => void;          // 判定して初期 view を決める(tutorial 起動含む)
  isOn: boolean;                    // collab ON(チップ表示用・PC)
  liveCount: number;                // 参加人数(PC チップ用)
  active: boolean;                  // ライブ接続中(PC の compact PresenceControls 用)
  collabBusy: boolean;
  modals: React.ReactNode;          // ShareChoiceModal / ShareModal / OwnerCollabPanel / LoginModal
}
```

- `openShareUI` / `handleCollab` のロジックは現 [ShareButtons.tsx:43-64](../../../src/components/ShareButtons.tsx#L43) を**そのまま移植**(挙動同一)。
- `view` 判定の純粋部分は `resolveInitialShareView({ user, isOn })` として切り出しテストする。
- `modals` に `OwnerCollabPanel` を `hideCursor={opts.hideCursor}` 付きで描画。

### 2. `OwnerCollabPanel` に `hideCursor` prop

`hideCursor` が true のとき [PresenceControls 描画行(134)](../../../src/components/collab/OwnerCollabPanel.tsx#L134)をスキップするだけ。既定 false で PC 無傷。

### 3. `ShareButtons`(PC)を `useShareFlow` 利用へ薄くリファクタ

- 既存 props(`contentLabel` / `currentPlan`)は**変更しない**(ConsolidatedHeader への波及ゼロ)。
- トリガー(isOn チップ + ParticipantDots / Share アイコン / `active` 時 compact PresenceControls)は残す。状態機械と `{modals}` をフックへ委譲。
- `hideCursor` は渡さない(PC はカーソル維持)。挙動は現状と完全一致。

### 4. `MobileShareController`(新規)+ Layout 配線

`src/components/collab/MobileShareController.tsx`

- props: `{ isOpen: boolean; onClose: () => void }`。
- `currentPlan` を `usePlanStore` から、`contentLabel` を新ヘルパー `getCurrentContentLabel()`(下記)で導出し、`useShareFlow({ currentPlan, contentLabel, hideCursor: true })` を使う。
- `isOpen` が false→true になったら `openShareUI()` を1回呼ぶ。`view` が `'none'` に戻ったら `onClose()` を呼ぶ(開いた後だけ・ref でガード)。
- `{modals}` を描画。
- Layout 側: 現 `mobileShareOpen` の `MobileBottomSheet`(Coming soon)を `<MobileShareController isOpen={mobileShareOpen} onClose={()=>setMobileShareOpen(false)} />` に置換。`onShareToggle` は従来どおり `mobileShareOpen` を true にするだけ(他シートは閉じる)。activeTab 'share' の点灯は `mobileShareOpen` 連動を維持。

### 5. ヘルパー `getCurrentContentLabel`(DRY)

`src/lib/getContentLabel.ts`(新規・小)。[ConsolidatedHeader.tsx:124-141](../../../src/components/ConsolidatedHeader.tsx#L124) の contentLabel 導出(getContentById → getPhaseName → ja の和欧スペース)を関数化。ConsolidatedHeader も将来これを使えるが、**今回は ConsolidatedHeader は触らず**、MobileShareController からのみ利用(波及最小化)。

## データフロー

```
[ナビ共有タブ tap] → Layout.onShareToggle → setMobileShareOpen(true)
   → <MobileShareController isOpen> effect → useShareFlow.openShareUI()
       → 未ログイン: view='copy' → <ShareModal>
       → ON: view='panel' → <OwnerCollabPanel hideCursor>(リンク/人数/名前/参加者/失効/再発行)
       → OFF: view='choice' → <ShareChoiceModal>
             → コピー: view='copy' → <ShareModal>
             → 一緒に編集: handleCollab → start(planId) → view='panel' → <OwnerCollabPanel hideCursor>
   → モーダルを閉じる(view='none') → onClose → setMobileShareOpen(false)
```

## テスト

- `resolveInitialShareView`: 未ログイン→'copy' / ログイン+ON→'panel' / ログイン+OFF→'choice'(純粋関数・3 ケース)。
- `getCurrentContentLabel`: contentId 無し→null / ja で和欧スペース挿入 / 他言語はそのまま。
- 既存: ShareButtons / collab 関連テストが緑のまま(PC 挙動不変の回帰チェック)。
- 手動(Playwright・390px): 共有タブ tap で(未ログイン)コピーモーダル / (ログイン OFF)2択 / オーナーパネルでカーソルUIが出ない・リンク/人数/名前/失効が出る。

## リスクと対策

- **PC ShareButtons リファクタの回帰**: props 不変 + ロジック移植は逐語 + 純粋部分をテスト + build/vitest/実機で確認。
- **モバイルで openShareUI の二重発火**: ref で「開いた」フラグ管理し、isOpen の立ち上がりエッジのみ起動。
- **collab 二重発行**: `collabBusy` ガードはフックに移植して維持。
