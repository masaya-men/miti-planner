# 動画でタイムライン作成 PiP — 設計書

> 作成: 2026-06-02 / 着手元アイデア: `docs/.private/2026-06-02-pip-attack-recording-idea.md`
> brainstorming 完了 → 本設計書 → writing-plans → 実装

## 1. 目的とユースケース

**新規コンテンツ(特に新規絶)の軽減表を、ユーザーが自分のプレイ動画を見ながらゼロから組み上げる**のを大幅に助ける PiP(Picture-in-Picture)機能。

LoPo 公式データがまだ無い実装直後のコンテンツで、YouTube 等の動画を再生しながら、LoPo 製のフローティング小窓(Document PiP)を動画の上に重ねて、攻撃を1つずつ「攻撃情報フォーム」で記録 → ワンボタンで現在開いている軽減表(プラン)のタイムラインに書き込む。

- **記録する対象**=ボスの攻撃情報:時刻 / 技名 / ダメージタイプ / 対象 / ダメージ(逆算入力で算出)
- **記録しないもの**=軽減配置・パーティ編成(取り込み後に本体タイムラインで行う)

### 確定済み前提(brainstorming で合意)

- 反映方式は**ライブ反映式**(記録=その場で現在プランに `addEvent`)。下書き段階は持たない。取り消しは既存 Undo を流用
- ダメージ入力は**逆算入力に固定**(動画を見て実ダメージから生ダメージを算出する用途なので直接入力は不要)
- タイマーは**手動ストップウォッチ**。YouTube 時間連動は恒久的に行わない
- **PC 専用**(Document PiP は PC のみ)

## 2. 非対象(今回やらない)

- 録画中の軽減配置(取り込み後に本体タイムラインのドラッグ&ドロップで行う既存機能を使用)
- パーティ編成の変更(後から本体で変更可能)
- YouTube 等の動画時間との同期(恒久的に無し。完全手動同期)
- モバイル対応(Document PiP がモバイル非対応)
- `enrage` ダメージタイプの UI 露出(既存 EventModal が出していないため parity を維持)

## 3. 入口:カンペボタンのポップアップ化

既存の PiP ボタン(`PictureInPicture2` アイコン、[Timeline.tsx:988](../../../src/components/Timeline.tsx)。`handleOpenPip`)を、クリックでポップアップメニューを開く形に変更し、2択を提示する:

1. **カンペを表示**(従来の `PipView`・読み取り専用カンペ)
2. **動画でタイムライン作成**(新規 `PipRecorder`)

- メニューは既存トンマナ(`glass-tier2/3`、白黒+機能色、トークン経由、`active:scale-95`)
- どちらも内部は同一の Document PiP 窓を開く。`pipMode: 'cue' | 'recorder' | null` を state で持ち、Portal の中身を出し分ける
- 窓の初期サイズはモード別(カンペ=従来の小サイズ / レコーダー=フォームが収まるやや大きめ。例 横 360 / 縦 480 前後、Chrome 補正に委ねる箇所は既存同様)
- 非対応ブラウザ(`'documentPictureInPicture' in window` が false、[Timeline.tsx:605](../../../src/components/Timeline.tsx))ではレコーダー項目を無効化し、非対応の旨を表示

## 4. PiP 窓の中身:2つの状態

### (a) タイマー画面(動画を見ながら待機)

- 経過時間を **`XX分:XX秒.XX`(小数点第2位)**で大きく表示
- ボタン:**スタート / 一時停止**(トグル)、**リセット**(0.00 に戻す)、大きな **＋イベントを追加**、**取消(Undo)**、記録済み件数表示
- **数字のガタつき防止(CSS 必須)**:時刻表示は枠をあらかじめ確保し、`font-variant-numeric: tabular-nums`(等幅数字)+ 固定幅コンテナを当て、数字が変化してもコロン・ドット位置がブレないようにする

### (b) フォーム画面(＋イベントを追加で切替・タイマー停止)

- 抽出した `EventForm` を `variant="pip"` でコンパクト表示
- 時刻はストップウォッチ停止時の値を自動入力(編集可)
- **逆算入力に固定**(逆算/直接トグルは非表示)
- フィールド:技名 / ダメージタイプ / 対象 / 実ダメージ → 生ダメージ(逆算) / 軽減アイコングリッド(逆算計算用)
- ボタン:**キャンセル**(タイマー画面へ戻る)、**表に書き込む**(`addEvent` → タイマー画面へ戻る)

## 5. タイマーの挙動(手動ストップウォッチ)

1. ユーザーが動画を再生 → 戦闘開始を待つ → 同時に「スタート」を押す
2. ストップウォッチが 0.00 から進む(小数点第2位表示)
3. 攻撃が来たら「＋イベントを追加」→ **その瞬間にストップウォッチが停止**し、その時刻(秒・小数2位)がフォームに自動入力
4. フォーム入力 →「表に書き込む」→ 現在プランに `addEvent` → タイマー画面へ戻る(ストップウォッチは停止のまま)
5. ユーザーが動画を再生し直すと同時に「スタート」を再度押す(停止値から続行)
6. 2〜5 を繰り返す

- 自動再開なし・動画連動なし。完全に手動同期(最もシンプルで、ズレはユーザーが目視で合わせる)
- 捕捉時刻は `TimelineEvent.time`(秒・number)としてそのまま使う。表で微調整も可能

## 6. データの流れと前提

- 書き込み先=**現在開いているプラン**。「表に書き込む」は `addEvent({ ...eventData, id })` を呼ぶだけ(既存の +ボタン保存経路と同一、[Timeline.tsx:1451](../../../src/components/Timeline.tsx))。オートセーブも既存どおり機能する
- **前提:先に空のプランを開いておくのは必須**(新規絶用に NewPlanModal で `custom`/`ultimate` を作成 → 空タイムラインで開始、[NewPlanModal.tsx:149](../../../src/components/NewPlanModal.tsx))
- **プラン未選択で録ろうとした場合**:PiP に「先に軽減表(プラン)を開いてください」と案内を表示し、書き込みを抑止
- **Undo**:PiP の「取消」は既存ストア `undo()` を呼ぶだけ。`addEvent` は履歴に積む実装([useMitigationStore.ts:569](../../../src/store/useMitigationStore.ts))なので、直前の書き込みから数件巻き戻せる

## 7. 文言(i18n)

- 新規文言はすべてキー化し、**ja / en / zh / ko の4言語**をそろえる(`src/locales/*.json`)
- **PiP 専用にチューンした文言を用意**し、本体 EventModal の文言は一切変更しない(画面・チュートリアルの見た目ゼロ変更=回帰なし)
- 既存 PiP キーは `timeline.pip_*` 配下のため、レコーダーは `timeline.recorder.*`(ネスト)に統一
- 「表に書き込む」も PiP 専用文言(訳例 en: Add to sheet / zh: 写入表 / ko: 표에 기록。最終訳は実装時に精査)

## 8. コンポーネント構造(案A:EventForm 抽出)

### 8.1 新規 `src/components/EventForm.tsx`

EventModal の中身(全フィールド state・逆算計算ロジック・チュートリアル用 effect)をそっくり移植する。

- **チュートリアルが参照する DOM を丸ごと EventForm 側へ移す**:`#event-modal-form` / `#mitigation-grid-container` / `data-tutorial-*`(`event-name-input` / `event-actual-damage-input` / `event-save-btn` / `tutorial-skill-*` 等)/ `data-mitigation-id`。これによりチュートリアルのセレクタは一致したまま
- Props:
  - `initialData?: TimelineEvent | null`
  - `initialTime?: number`
  - `onSave: (event: Omit<TimelineEvent,'id'>) => void`
  - `onDelete?: () => void`
  - `onCancel?: () => void`
  - `variant: 'modal' | 'pip'`(サイズ・余白・コンパクト度を制御)
  - `reverseOnly?: boolean`(true で逆算/直接トグルを非表示・`inputMode='reverse'` 固定。PiP のみ true)
  - `labels?`(保存ボタン等、instance ごとに差し替える文言。modal は既存キー、PiP は `timeline.recorder.*`)

### 8.2 `src/components/EventModal.tsx`(薄いラッパー化)

- Portal + 背景 + 位置決め + ヘッダ + `<EventForm variant="modal" />` のみに縮小
- 既存 props・挙動・文言・ポジショニング(PC カーソル追従 / モバイルボトムシート / チュートリアル中央固定)は完全維持

### 8.3 新規 `src/components/PipRecorder.tsx`

- タイマー画面 ⇄ フォーム画面の状態を持つ
- ストップウォッチ state(開始/一時停止/リセット/停止時刻の保持)。正確さのため内部は開始時刻基準で経過を算出するが、UI 上は単純なストップウォッチ
- フォーム画面では `<EventForm variant="pip" reverseOnly labels={recorderLabels} initialTime={captured} onSave={writeToSheet} onCancel={backToTimer} />`
- `writeToSheet` = `addEvent({ ...eventData, id })` → タイマー画面へ戻る
- 現在プラン未選択時は案内表示
- 逆算計算は学者/占星のシールド値に party 情報を使うが、**未編成でもデフォルトステータスにフォールバック**する既存ロジックがある([EventModal.tsx:444-465](../../../src/components/EventModal.tsx))ため、パーティ未設定の新規プランでも機能する

### 8.4 `src/components/Timeline.tsx`

- カンペボタンをポップアップメニュー化(2項目)
- `pipMode: 'cue' | 'recorder' | null` を追加
- Document PiP 生成は既存 `handleOpenPip`([Timeline.tsx:988](../../../src/components/Timeline.tsx))を流用し、モード別に初期サイズと Portal の中身(`PipView` / `PipRecorder`)を切り替え

### 8.5 i18n

- `src/locales/{ja,en,zh,ko}.json` の `timeline.recorder.*` にキー追加

## 9. ブラウザ対応・フォールバック

- 対応:Chrome / Edge 116+、Firefox 151+
- Safari:Document PiP 未対応 → レコーダー項目を無効化+理由表示(既存 `pipSupported` 流用)
- 非対応時もカンペ(従来)は同じ Document PiP を使うため挙動は現状維持

## 10. 検証(verification)

- **チュートリアル回帰**:EventForm 抽出後、チュートリアルのイベント追加ステップ群(add-1-name / add-2-damage / add-3-miti / add-4-save / create-8-miti)を実機で1周通して確認
- **既存テスト**:EventModal 関連テスト・ストア(addEvent/undo)テストが green であることを確認
- **新規テスト**:PipRecorder のストップウォッチ(開始/停止/リセット)と「表に書き込む」で `addEvent` が正しい payload で呼ばれることを確認
- **実機**:Chrome で Document PiP を開き、動画の上に重なること / フォーム入力 → 書き込みで本体タイムラインに行が増えること / Undo で巻き戻ること / プラン未選択時の案内
- push 前に `npm run build`(tsc 厳密)+ `vitest run` を通す(memory `feedback_vercel_tsc_strict`)

## 11. 関連ファイル

- 既存: `src/components/Timeline.tsx` / `src/components/EventModal.tsx` / `src/components/PipView.tsx` / `src/store/useMitigationStore.ts` / `src/components/NewPlanModal.tsx` / `src/locales/{ja,en,zh,ko}.json`
- 新規: `src/components/EventForm.tsx` / `src/components/PipRecorder.tsx`
