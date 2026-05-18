# 共有チュートリアル改善 設計書

**作成日**: 2026-05-18
**ブランチ**: main (新規ブランチ未作成)
**スコープ**: `share` チュートリアル (2 ステップ) の UX バグ修正 + 起動ロジック刷新

---

## 目的

`share` チュートリアル (共有のしかた) を、 ユーザーが自然に学べる動線に作り替える。

### ユーザー視点で何が変わるか

**初めて共有ボタンを押した人**
- 共有モーダルが開くと同時に案内カードが表示される
- 「わかった」 を押すと**そのままモーダルが残り**、 続けて画像設定や共有操作ができる
- 案内カード表示中は背後の「共有について」 モーダル (= `PopularConsentDialog`) を操作できない

**2 回目以降の人**
- 共有ボタンを押しても案内は出ない (通常のフロー)
- ヘッダーの「チュートリアルを見る」 メニューに**「共有のしかた」 が出現** し、 再学習可能

**初回で × ボタン (スキップ) した人**
- 「見た」 扱い → 2 回目以降の人と同じ挙動
- 再学習はメニューから

---

## 現状の問題と真因

| 問題 | 真因 | コード参照 |
|---|---|---|
| ① スタート不可: 軽減表を開いていないと共有ボタンが出ないため TutorialMenu から起動しても無効 | 起動条件が手動メニューのみ。 自動発火がない | — |
| ② 2/2 表示中、 背後の「共有について」 モーダルが操作できる | TutorialBlocker の active 条件 `!!step.target && !step.animation` で、 `share-2-done` は `target=null` ＆ animation 無し → ブロッカー非表示 | [TutorialOverlay.tsx:262-266](../../src/components/tutorial/TutorialOverlay.tsx#L262-L266) |
| ③ 2/2 終了後に「共有について」 モーダルが強制クローズ → 最初からやり直しになる | ShareButtons が `activeTutorialId` 変化を監視して setModalOpen(false) を呼んでいる | [ShareButtons.tsx:27-35](../../src/components/ShareButtons.tsx#L27-L35) |

---

## z-index 重ね順 (現状そのまま、 変更なし)

| 層 | コンポーネント | z-index | 操作可否 (チュートリアル中) |
|---|---|---|---|
| 下 | ShareModal | `9999` | 不可 (背景表示のみ) |
| 中 | PopularConsentDialog (初回未同意ユーザーのみ) | `10000` | 不可 (本修正で実現) |
| 上 | TutorialBlocker (SVG 全面ブロック) | `10001` | 全面ブロック |
| 最上 | TutorialCard (案内カード) | `10002` | 「わかった」 ボタンのみ操作可 |

PopularConsent を既に承諾済みのユーザーには中層が無く、 2 層 (ShareModal + Tutorial) になる。 いずれのケースでも TutorialBlocker が PopularConsentDialog と ShareModal を上から覆うので、 ユーザーは案内カードしか触れない。

---

## 設計詳細

### §1. ステップ構成変更

`share` チュートリアルを **1 ステップに削減**。

- 削除: `share-1-open` (「共有ボタンを押そう」)
- 残す: `share-2-done` (「画像などを設定して共有しよう！」) のみ
- `target: null`, `pill: 'next'` のまま (= 「わかった」 ボタンのみ)
- ID は `share-1-done` に変更してわかりやすく

変更ファイル: [src/data/tutorialDefinitions.ts](../../src/data/tutorialDefinitions.ts)

### §2. 起動ロジック変更 (案 C 採用)

ShareButtons の onClick ハンドラで自動発火する。

```ts
const completedShare = useTutorialStore(s => s.completed['share']);
const isActive = useTutorialStore(s => s.isActive);

const handleShareClick = () => {
  setModalOpen(true);
  if (!completedShare && !isActive) {
    useTutorialStore.getState().startTutorial('share');
  }
};
```

変更ファイル: [src/components/ShareButtons.tsx](../../src/components/ShareButtons.tsx)

### §3. TutorialMenu の表示条件

`share` 項目は `completed['share'] === true` のときのみ表示する。 main / create-plan は従来通り常時表示。

```ts
const visibleIds = TUTORIAL_IDS.filter(id => id !== 'share' || completed['share']);
```

変更ファイル: [src/components/tutorial/TutorialMenu.tsx](../../src/components/tutorial/TutorialMenu.tsx)

### §4. スキップでも completed[share]=true (案 A 実装)

`confirmExit` 内で `activeTutorialId === 'share'` の場合、 完了と同じく `completed['share'] = true` をセットする。 他のチュートリアル (main / create-plan) はスキップ時に completed を立てない既存挙動を維持。

```ts
confirmExit: () => {
  const { activeTutorialId } = get();
  // ... 既存処理 ...
  set(state => ({
    // ... 既存処理 ...
    completed: activeTutorialId === 'share'
      ? { ...state.completed, share: true }
      : state.completed,
  }));
}
```

変更ファイル: [src/store/useTutorialStore.ts](../../src/store/useTutorialStore.ts)

### §5. TutorialBlocker の active 条件拡張

target=null かつ pill='next' (= 完了画面類の案内カード) のときも全面ブロックを出すように条件を拡張する。

```tsx
// 変更前
<TutorialBlocker
  targetRect={targetRect}
  active={!!step.target && !step.animation}
/>

// 変更後
<TutorialBlocker
  targetRect={targetRect}
  active={(!!step.target && !step.animation) || (!step.target && !step.animation && step.pill === 'next')}
/>
```

この変更は share-2-done だけでなく、 「target なし＆案内カードのみ」 の他ステップにも適用される。 既存のステップを確認すると：
- `main-13-fake-complete` / `main-14-real-complete`: animation あり (`fake-completion-card` / `completion-card`) → 既存の別ブロッカー (`step.animation === ...` ブランチ) でブロック済み
- `create-10-complete`: animation あり (`completion-card`) → 同上
- `share-2-done` (改名後 `share-1-done`): animation なし → **新条件で初めて全面ブロックされる**

よって既存挙動への副作用はない。

変更ファイル: [src/components/tutorial/TutorialOverlay.tsx](../../src/components/tutorial/TutorialOverlay.tsx)

### §6. 強制クローズ削除

ShareButtons の useEffect (27-35 行) を**削除**。

```tsx
// 削除対象 (ShareButtons.tsx:23-35)
const activeTutorialId = useTutorialStore(s => s.activeTutorialId);
const wasShareTutorial = useRef(false);

useEffect(() => {
  if (activeTutorialId === 'share') {
    wasShareTutorial.current = true;
  } else if (wasShareTutorial.current) {
    wasShareTutorial.current = false;
    setModalOpen(false); // ← これがバグの原因
  }
}, [activeTutorialId]);
```

これにより、 チュートリアル完了/スキップ後も ShareModal は開いたまま保持され、 ユーザーはそのまま共有操作に進める。

変更ファイル: [src/components/ShareButtons.tsx](../../src/components/ShareButtons.tsx)

### §7. ShareModal の不要な completeEvent 呼び出し削除

ステップ 1 (`share-1-open`) を削除するため、 `share:modal-opened` イベントを発火する必要がなくなる。

```tsx
// 削除対象 (ShareModal.tsx:84)
useTutorialStore.getState().completeEvent('share:modal-opened');
```

変更ファイル: [src/components/ShareModal.tsx](../../src/components/ShareModal.tsx)

### §8. i18n キー削除

4 言語 (ja / en / zh / ko) から以下のキーを削除。 残すキーは変更なし。

- 削除: `tutorial.share.open.message`
- 残す: `tutorial.share.done.message` / `tutorial.share.done.description` / `tutorial.menu.share`

変更ファイル: `src/locales/{ja,en,zh,ko}.json`

---

## タイミング懸念と安全策

ShareButtons の onClick で「`setModalOpen(true)` + `startTutorial('share')`」 を同時に呼ぶ。 これにより以下のタイミングが発生する：

1. React state 更新 (modalOpen = true) → 次の render で ShareModal がマウント
2. `startTutorial('share')` → useTutorialStore 即時更新 → TutorialOverlay が `isActive=true` で render

理論上はどちらが先に画面に出てもユーザーには違和感がないが、 念のため以下を確認：
- ShareModal の `useEffect` 内 `completeEvent('share:modal-opened')` 削除済み (§7) → タイミング依存のイベント発火が消える
- TutorialOverlay の case `step.target === null` ステップは targetRect の取得を待たない → 即時表示される

**実機検証項目**: 共有ボタン押下 → 「共有モーダル」 と「案内カード」 がほぼ同時に出ること、 順序逆転やカードだけ先に出る等がないこと。

---

## 既存ユーザーへの影響 (許容済)

- `completed['share']` は localStorage 永続化のため、 現状 false のままのユーザーが大多数
- デプロイ後、 既存ユーザーも次回共有時に 1 回だけ案内カードが出る → 「わかった」 で消える → 以降は通常動作
- ユーザーとの合意: 「そんなに使われてないので大丈夫」 (許容)

---

## 変更対象ファイル一覧

### 変更
- `src/data/tutorialDefinitions.ts` — share チュートリアルを 1 ステップに削減、 ID リネーム
- `src/components/ShareButtons.tsx` — onClick で startTutorial 発火、 useEffect 削除
- `src/components/ShareModal.tsx` — `completeEvent('share:modal-opened')` 削除
- `src/components/tutorial/TutorialOverlay.tsx` — TutorialBlocker active 条件拡張
- `src/components/tutorial/TutorialMenu.tsx` — share 項目の表示条件追加
- `src/store/useTutorialStore.ts` — confirmExit で share スキップ時に completed=true
- `src/locales/ja.json` / `en.json` / `zh.json` / `ko.json` — `tutorial.share.open.message` 削除

### 新規
- なし

### 削除
- なし (関数や型は維持、 不要キー値のみ削除)

---

## テスト計画

### 自動テスト (vitest)
- `useTutorialStore.test.ts` (既存があれば): `confirmExit` で share の場合のみ completed=true になることを確認
- 既存テストへの影響: `TUTORIALS['share'].steps` のステップ数が 2→1 に変わるため、 影響あるテストを修正

### 実機テスト (Playwright + 手動)
1. **初回フロー (未経験ユーザー)**:
   - 軽減表を開く → 共有ボタンクリック
   - ShareModal が開く + 案内カード表示
   - 背後 (ShareModal / PopularConsentDialog) を**触れないこと**を確認
   - 「わかった」 押下 → カードが消える、 ShareModal は残る
   - URL コピーやチームロゴ設定が正常に動作
2. **スキップフロー**:
   - 共有ボタンクリック → 案内カード表示 → × ボタン (スキップ)
   - 確認ダイアログで「終了」 → カードが消える、 ShareModal は残る
   - TutorialMenu に「共有のしかた」 が出現することを確認
3. **2 回目フロー**:
   - リロード後、 共有ボタンクリック → カードは出ない、 ShareModal のみ表示
4. **再学習フロー**:
   - TutorialMenu → 「共有のしかた」 をクリック → 案内カード表示 (※ ただし軽減表が開いていない場合の挙動は §3 で表示制御済みなので、 メニュー出現 = 完了/スキップ済み = 共有ボタンを 1 度は触っている = 軽減表は開いていた状態のはず)
5. **多言語**: ja / en / zh / ko で案内カードの文言が正しく表示

---

## 未確定/想定外への対応

- メニュー手動起動時に軽減表が無い場合、 共有ボタンが存在しないため案内カードは虚空に浮く → 仕様上はこの状態にならない設計だが、 念のため実機で奇異な操作を試して問題ないか確認
- `TutorialOverlay` が share チュートリアル中に scrollIntoView を試みる箇所 ([TutorialOverlay.tsx:146-162](../../src/components/tutorial/TutorialOverlay.tsx#L146-L162)) は `step.target` が null なので影響なし
