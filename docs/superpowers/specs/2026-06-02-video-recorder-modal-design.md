# 動画埋め込み式 タイムライン作成モーダル — 設計書

> 作成: 2026-06-02 / 前段: `2026-06-02-pip-timeline-recorder-design.md`(Document PiP 版レコーダー。本設計でモーダルへ発展・置換)
> brainstorming 完了 → 本設計書 → writing-plans → 実装

## 1. 目的

YouTube 動画を LoPo 内に埋め込み、動画を見ながら攻撃を記録 → 現在プランのタイムラインへ書き込む。動画の再生/一時停止を記録操作と連動させ、FF14 動画(動画開始 ≠ 戦闘開始、1本に複数戦闘あり)で快適にタイムラインを組めるようにする。

前段で作った Document PiP 版レコーダー(別タブ動画の上に浮遊)を、本設計の**中央モーダル(左=動画 / 右=記録UI)に置き換える**。「カンペ」(読み取り専用)は Document PiP のまま残す。

## 2. 確定済み方針(brainstorming)

- **検索なし**:動画は URL 貼り付けのみ(YouTube Data API は使わない)。
- **時刻は動画位置基準**:イベント時刻 = 動画の現在位置 − 戦闘開始位置。シーク/巻き戻ししてもズレない。
- **Document PiP レコーダーは廃止**:「動画を見ながらイベント追加」メニューは本モーダルを開く。
- **コントロールは YouTube native のみ**(自前の 10 秒戻し等は作らない)。
- **手動操作はスタート(戦闘開始マーク)のみ**。
- トンマナ・UI/UX は LoPo に合わせる。**楽に・シンプルに・安全に**。

## 3. 全体構成

「動画を見ながらイベント追加」メニュー → 画面中央のモーダル `VideoRecorderModal` を開く。

- LoPo トンマナ:`glass-tier3` / 白黒 + 機能色(青=OK・赤=危険) / 色・フォントはトークン経由 / `active:scale-95` / framer-motion で `{opacity, scale, y}` 表示。
- 背景オーバーレイ(`bg-black/50`)+ ✕ 閉じる + Esc 閉じる(`useEscapeClose`)。
- サイズ感はユーザー提示画像準拠:横長の大きな中央モーダル。**左=大きめ動画(16:9)/ 右=やや狭い記録パネル**を横並び。
- PC 前提。狭幅(`md` 未満)は縦積み(動画上・記録下)にフォールバック。

## 4. 左ペイン(動画)

- **初期状態**:URL 入力欄(プレースホルダ「ここに動画URLを貼ってください」)+ 読み込みボタン。
- **URL 解析**:純粋関数 `parseYouTubeId(url): string | null`。対応:`https://youtu.be/<id>`、`https://www.youtube.com/watch?v=<id>`、`https://www.youtube.com/embed/<id>`、`m.youtube.com`、余分なクエリ(`&t=`, `&list=` 等)付き。解析不可は null → 入力欄にエラー文言(i18n)。
- **読み込み後**:youtube-nocookie の IFrame Player API で埋め込み。
  - `host: 'https://www.youtube-nocookie.com'`(CSP frame-src に既存)、`playerVars: { controls: 1, rel: 0, modestbranding: 1 }`。
  - **コントロールは native のみ**(再生・一時停止・シーク・音量・全画面)。自前ボタンは置かない。
  - 「別の動画」ボタンで URL 入力に戻る。

## 5. 時刻連動(中核)

`useYouTubePlayer` フックが IFrame API のロードとプレイヤー生成・制御を担い、`{ ready, play(), pause(), getCurrentTime(), isPlaying }` を提供する。

- **スタート(戦闘開始)**:押下時の `getCurrentTime()` を `combatStartSec` として保持(= 戦闘開始 0 秒)。以降ストップウォッチ表示開始。これが唯一の手動操作。
- **ストップウォッチ表示** = `formatStopwatch(max(0, getCurrentTime() - combatStartSec))`。再生中は軽いポーリング(`setInterval` 200ms 程度 or rAF)で更新。`combatStartSec` 未設定時は `00:00.00` 固定。
- **＋イベントを追加**:`pause()` → 経過 = `getCurrentTime() - combatStartSec` → `snapToSecond` で整数秒 → EventForm を開く(`initialTime` に渡す)。
- **表に書き込む**:`addEvent({...ev, id})`(既存経路)→ フォーム閉じる → タイマー表示に戻る(動画は停止のまま)。
- **再生/再開**:`play()`(ストップウォッチは動画位置基準なので自動追従)。
- **リセット**:`combatStartSec` を未設定へ戻す(同一動画の次の戦闘で再度スタート)。
- シーク・巻き戻し(native)しても時刻は動画位置基準なので常に正確。

## 6. 右ペイン(記録UI)= 既存流用

前段で作成済みの要素をそのまま流用:

- コンテンツ名 + プラン名ヘッダ(`getContentById` + 現在プラン、作成済みロジック)。
- ストップウォッチ表示(`formatStopwatch`、`font-mono` + tabular-nums)。
- ボタン:スタート / 再生(再開)/ リセット / ＋イベントを追加 / 取消(Undo = 既存 store `undo()`)/ 記録済み件数。
- **EventForm(`variant="pip" reverseOnly` + 「表に書き込む」ラベル)をそのまま**。
- プラン未選択時は「先に軽減表(プラン)を開いてください」案内(既存)。
- 文言は既存 `timeline.recorder.*` を流用 + 不足分(動画URL入力・エラー等)を 4 言語追加。

## 7. コンポーネント / ファイル構成

- **新規** `src/utils/youtube.ts` — `parseYouTubeId(url)`(純粋関数)
- **新規** `src/utils/__tests__/youtube.test.ts`
- **新規** `src/hooks/useYouTubePlayer.ts` — IFrame API ロード + プレイヤー生成/制御フック
- **新規** `src/components/VideoRecorderModal.tsx` — モーダル(左=URL/プレイヤー、右=記録パネル)
- **改修** `src/components/PipRecorder.tsx` — 右パネルとしてモーダルから使う形にリファクタ。タイミング源を performance.now から「動画位置(props 経由の getElapsed/clock)」へ差し替え。EventForm 流用・ヘッダ・件数・Undo は維持。Document PiP 専用前提を外す。
  - 具体的には、記録パネルは時刻関連を props で受ける(`elapsedSec` / `running` / `onStart` / `onTogglePlay` / `onReset` / `onAddEvent(capturedSec)` / `combatStarted`)。モーダルが動画と連動して供給する。書き込み(`addEvent`)とフォーム表示はパネル内に保持。
- **改修** `src/components/Timeline.tsx` — 「動画を見ながらイベント追加」メニュー項目で `VideoRecorderModal` を開く(`pipMode='recorder'` の Document PiP 経路を撤去)。「カンペ」は Document PiP のまま。
- **改修** `src/utils/stopwatch.ts` — `formatStopwatch` / `snapToSecond` は流用。`computeElapsed`(performance.now 用)は使用箇所が無くなるが、テスト済みで無害なため残置(YAGNI 判断で削除も可、プランで決定)。
- **改修** `src/locales/{ja,en,zh,ko}.json` — `timeline.recorder.*` に動画URL関連キー追加(プレースホルダ・読み込み・別の動画・URLエラー)。
- **改修** `vercel.json` — CSP `script-src` に `https://www.youtube.com` を追加(IFrame API スクリプト)。frame-src の `youtube-nocookie.com` は既存。

## 8. CSP

- `script-src` に `https://www.youtube.com` を追加(`https://www.youtube.com/iframe_api` とプレイヤー JS のため)。
- `frame-src` は `https://www.youtube-nocookie.com` が既存(プレイヤーは host=nocookie で生成するため追加不要)。
- 実装後、ブラウザコンソールに CSP 違反が出ないことを確認(プレイヤーが描画・再生できること)。

## 9. テスト / 検証

- `parseYouTubeId`:各 URL 形式 → 正しい ID / 不正 → null(純粋テスト)。
- 既存 `stopwatch`(formatStopwatch / snapToSecond)テストは維持。
- 記録パネルの書き込み経路:`onAddEvent` 相当でフォーム → `addEvent` され `timelineEvents` が増える(既存 PipRecorder テストの方針を踏襲)。
- **実機 E2E(Chrome)**:URL 貼付 → プレイヤー表示 → 再生 → スタート → ＋イベント追加(動画停止+整数秒) → 表に書き込む → 表に行が出る → 再開で動画再生 → リセットで次戦闘。CSP 違反なし。
- push 前に `npm run build` + `vitest run`(memory `feedback_vercel_tsc_strict`)。

## 10. 非対象(今回やらない)

- YouTube その場検索(Data API)。
- 自前の 10 秒戻し等カスタムコントロール(native で代替)。
- 動画位置とイベントの双方向同期(行クリックで動画ジャンプ等)。将来検討。
- モバイル最適化(縦積みフォールバックのみ。作り込みは将来)。
