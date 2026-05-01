# PiP（Floating Timeline）復活 設計書

作成日: 2026-05-01
ベース設計書: [2026-04-09-pip-cue-sheet-design.md](./2026-04-09-pip-cue-sheet-design.md)

---

## 1. 概要

過去に実装したが「Chrome の Document Picture-in-Picture API はウィンドウ自体を OS レベルで透過できず、CSS 半透明では裏（ゲーム画面）が見えない」という根本問題で UI 非表示にしていた PiP カンペビューを復活させる。

復活にあたり仕様を見直し：
- 透過機能は意味がないため**完全削除**（将来 Chrome がウィンドウ透過対応したら再検討）
- 単一メンバー選択 → **多選**（ジョブピッカー多選で「個別 / 全員 / 任意の組合せ」を 1 つの UI に統合）
- 自ジョブ未設定時は**全員表示**で開ける
- 透過の代わりに**背景カラーピッカー**を追加（ユーザー好みの色で固定）

コードの大半は残存しているため、本タスクは **PipView 本体の改修 + UI 復活ポイント 2 箇所** が中心。

---

## 2. ユースケース

- **PC ゲーマー**: FF14 のウィンドウとは別ウィンドウで PiP カンペを開き、サブモニタや空きスペースに置いてカンペとして使用
- **PS5 ゲーマー**: スマホをテレビ横に置き、フルスクリーン表示で軽減タイミングを確認

---

## 3. スコープ

### 含む
- PipView.tsx 本体改修（多選 / 全員フォールバック / 透過撤去 / カラーピッカー追加）
- Timeline.tsx PC 起動ボタンの復活（`false &&` 撤去 + disable 撤去）
- MobileFAB.tsx モバイル起動 FAB 項目復活
- i18n キー追加（多選 UI 用）と削除（不要になった disable 文言）
- 単体テスト追加

### 含まない
- 「自分のプラン」識別バッジ修復（個人特定回避方針で諦め決定済み、別件）
- 横スクロールタイムライン（音ゲーモード）
- `mode` prop の完全削除（透過分岐が消えると差別化不要だが、コードクリーンアップは別タスク）
- 共有 API への uid 関連改修

---

## 4. 仕様

### 4.1 表示メンバー（多選）

**現状**: `selectedMemberId: string` で 1 名固定。Popover でジョブアイコン1個を選んで切替。

**変更後**: `selectedMemberIds: Set<string>` で複数選択可。

**初期値ロジック**:
| 条件 | 初期値 |
|------|--------|
| `myMemberId` あり、かつ該当メンバーがアクティブ（jobId 設定済み） | `Set([myMemberId])` |
| `myMemberId` 未設定 or 該当メンバーなし | アクティブメンバー全員（`Set(activeMembers.map(m => m.id))`） |

**フィルタ計算**: 「いずれかの選択メンバーが軽減を配置しているイベント」を抽出。各イベント行には「選択メンバー全員分の軽減アイコンをフラットにマージ」して並べる（メンバー識別ラベルなし）。

**理由**: パーティメンバー構成は別 UI で確認できるため、PiP では誰の軽減かを区別せずアイコンだけ並べるのが情報密度的に最適。

### 4.2 ジョブピッカー UI（Popover）

ツールバー左の小ボタン（縦 24px 横 24+α）クリックで Popover メニューを表示。Popover の中身：
- アクティブメンバー（`jobId` 設定済み）のジョブアイコンを横一列 or グリッドで配置
- 各アイコンはトグル方式（クリックで選択 ⇄ 解除、選択中は外枠 ring + 背景強調）
- 上部に「全員 / 解除」の 2 ボタン（i18n キー新設）

**ツールバーの「現在の選択状態」表示**: Popover を開いていない通常時、ボタンには代表として 1 ジョブアイコン or 件数バッジ（例: `+3`）を表示する。シンプル化のため、選択数 1 ならそのジョブアイコン、2 以上なら最初のジョブ + `+N` バッジ、選択数 0 は `?` プレースホルダで進める（ユーザーが「解除」を押した直後に発生し得る）。

### 4.3 透過機能の完全削除

**削除対象**:
- `opacity` state
- 透過率 range input UI（ツールバー中央）
- `style={mode === 'pip' ? { background: rgba(...) } : { background: '#0F0F10' }}` の三項演算分岐
- i18n キー `timeline.pip_opacity` 削除

### 4.4 背景カラーピッカー（新規追加）

**目的**: 透過撤去の代わりに、ユーザーが好みの背景色で固定できるように。

**動作**:
- ツールバーに小色丸ボタン（直径 16px、現在色塗り、白枠 1px）
- クリックで隠した `<input type="color">` を `.click()` プログラム起動
- ブラウザネイティブのカラーピッカーダイアログが開く（OS 依存の見た目で承認済み）
- `onChange` で `bgColor` state + localStorage `pip-bg-color` 同期
- PiP ルート div の `background` に直接 inline style で適用

**永続化**: グローバル `localStorage['pip-bg-color']`（プラン単位ではなくユーザー好み単位）。

**デフォルト値**:
| ユーザーテーマ | デフォルト |
|---------------|-----------|
| ダーク | `#0F0F10`（既存ダーク背景） |
| ライト | `#FAFAFA`（既存ライト背景） |

ユーザーが一度選んだ色は localStorage で永続。テーマを切り替えてもユーザー指定色は維持。初回起動時のみテーマでデフォルト分岐。

**i18n**: `timeline.pip_bg_color`（aria-label 用、ボタンには表示しない）× 4 言語。

### 4.5 起動条件

**現状**: PC ボタン `disabled={!myMemberId}`、モバイル FAB 項目 `disabled: !myMemberId`。

**変更後**: いつでも開ける（disable 完全撤去）。
- 自ジョブ未設定でも全員表示で開けばカンペになる
- 軽減ゼロのプランでも開いて構わない（空状態メッセージで案内）

**i18n**:
- `timeline.pip_open_disabled` を削除（不要）
- `timeline.pip_open` だけ残す

### 4.6 メモ機能（既存維持）

`usePipNotes` フックと `localStorage[pip-notes:{planId}]` 永続化はそのまま維持。攻撃名のダブルクリック編集 → サニタイズ → 保存の挙動も既存通り。

### 4.7 mode prop の扱い

`mode: 'pip' | 'fullscreen'` prop は残す（呼び出し側 Timeline.tsx / Layout.tsx で受け渡し済み）が、内部分岐は全撤去（背景色は両方とも `bgColor` state、UI 構造は同一）。後日のコードクリーンアップで完全撤去するかは別タスク。

---

## 5. UI 復活ポイント

### PC 起動ボタン
- ファイル: [src/components/Timeline.tsx:1972-1990](../../src/components/Timeline.tsx#L1972)
- 変更: `{false && pipSupported && (...)}` から `false &&` を除去
- ボタンの `disabled={!myMemberId}` 削除、Tooltip content を `t('timeline.pip_open')` 一本化、`!myMemberId` 用の disable スタイルクラス削除

### モバイル FAB 項目
- ファイル: [src/components/MobileFAB.tsx:236-244](../../src/components/MobileFAB.tsx#L236)
- 変更: コメントアウト解除、`disabled: !myMemberId` を削除
- [MobileFAB.tsx:133](../../src/components/MobileFAB.tsx#L133) の `myMemberId` import コメントは削除（import 自体も不要）

---

## 6. データフロー

```
useMitigationStore
  ├─ timelineMitigations (ownerId が selectedMemberIds に含まれるものでフィルタ)
  ├─ timelineEvents (フィルタ後の軽減が配置された時刻だけ抽出)
  ├─ partyMembers (ジョブピッカー候補)
  └─ myMemberId (初期選択メンバー、未設定時は全員フォールバック)

useThemeStore
  └─ theme ('dark' | 'light') (背景色デフォルト分岐用)

usePlanStore
  └─ currentPlanId (メモのキー)

localStorage
  ├─ pip-notes:{planId} → { [eventId]: "ユーザーメモ" }
  └─ pip-bg-color → "#RRGGBB"
```

---

## 7. 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/components/PipView.tsx` | 本体改修（多選 / 透過撤去 / カラーピッカー / 全員フォールバック） |
| `src/components/Timeline.tsx` | 1 行変更（`false &&` 撤去 + disable 撤去 + Tooltip 簡略化） |
| `src/components/MobileFAB.tsx` | コメントアウト復活 + `myMemberId` 関連削除 |
| `src/locales/{ja,en,ko,zh}.json` | キー追加: `pip_select_all`, `pip_deselect_all`, `pip_bg_color`。削除: `pip_open_disabled`, `pip_opacity` |

---

## 8. テスト

### 既存維持
- `src/__tests__/usePipNotes.test.ts`（メモ永続化）

### 新規追加
- `src/__tests__/PipView.test.tsx`
  - 初期選択ロジック: `myMemberId` ありで自分のみ、未設定で全員
  - 多選フィルタ: 選択メンバーの軽減があるイベントだけ抽出、ない時刻は除外
  - 多選時のアイコンマージ: 同時刻に複数メンバーの軽減があるとき全部並ぶ
  - 空状態: 軽減ゼロ時に `pip_no_mitigations` 表示
  - カラーピッカー: 初期色がテーマ準拠、変更で localStorage に書き込み
  - 「全員 / 解除」ボタン

---

## 9. リスク・考慮点

### Document Picture-in-Picture API 非対応ブラウザ
Firefox / Safari は API 非サポート。`pipSupported` チェックで PC ボタン非表示は既存ロジックで担保済み。スマホは Chrome に依存しないフルスクリーン div なので関係なし。

### localStorage クォータ
`pip-notes:{planId}` は既存実装、`pip-bg-color` は短い文字列（`"#RRGGBB"` 7 文字）で問題なし。

### 既存 PiP ウィンドウ管理ロジックとの整合
[Timeline.tsx:590-868](../../src/components/Timeline.tsx#L590) の `pipWindow` / `pipContainer` / `handleOpenPip` / `handleClosePip` / `createPortal` 部分は active のまま動く。`false &&` 撤去だけで起動可能。

---

## 10. 完了基準

- PC で PiP ボタンが押せ、別ウィンドウが開く
- 別ウィンドウで多選 UI、軽減一覧、メモ編集、背景色変更が動く
- スマホで FAB から「カンペ」項目が押せ、フルスクリーンで開く
- 自ジョブ未設定でも開ける（全員表示）
- 軽減ゼロのプランで開いても空状態メッセージが出る（クラッシュしない）
- localStorage で背景色が永続化される（再読み込みで保持）
- 既存メモ機能が動く
- ダークテーマ / ライトテーマで初期背景色が分岐
- ビルド + テスト全 PASS
