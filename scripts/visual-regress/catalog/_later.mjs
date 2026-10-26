// @ts-check
// 段階 1 のカタログに入れなかった窓・画面(理由つき)。run.mjs は先頭 _ のファイルを読まない。
// stage: 2 = 見本・撮影手順を足せば撮れる / 3 = 撮影対象外・専用の仕組みが要る
/** @type {{ component: string, stage: 2 | 3, reason: string }[]} */
export default [
  { component: 'HousingerPage', stage: 2, reason: '/housing/housinger/:uid は uid が hashed:<id> に正規化され、API が uid=hashed:vr-user-a で呼ばれる。見本ファイル名にコロンが入り Windows で作れず(apiFixtureKey の置換が要る)、プロフィール本体は Firestore 直読み(遮断中)で、撮ると見本の無い通信で失敗する。マイページのログイン案内側(/housing/mypage 未ログイン)だけ housing/login-prompt-mypage で撮影済み。' },
  { component: 'HousingerShortLinkPage', stage: 2, reason: '/h/:slug は Firestore getDocs で slug を解決する(遮断中)ため、実内容が出ない。HousingerPage と同じ理由で見本の拡張が要る。' },
  { component: 'JoinTourPage', stage: 2, reason: '/housing/tour/:tourToken を撮ると「接続中/見つからない」の 1 枚メッセージだけ(housing-tour-empty-title)が出る。viewing/ended の本体は shared_tours の Firestore getDoc と onSnapshot が必須で、遮断中は出せない。' },
  { component: 'HousingCardVideoOverlay', stage: 2, reason: '動画つきカード(vr-l05)にホバーしても 15 秒待ってオーバーレイ(.housing-card-video-overlay)が出なかった。再生対象はビューポート内のスポットライト回転(useSpotlightRotation)で決まり、時間依存。再生を決める値の固定手順が要る。' },
  { component: 'RoomListPanel', stage: 2, reason: '同じ建物(スポット)に 2 件以上の家がある時だけ開く。見本の家は 1 スポット 1 件なので開けない。同一アパートに複数件の見本を足せば撮れる。' },
  { component: 'TourInvitePanel', stage: 2, reason: 'ログイン済みの時だけ描画される(未ログインは HousingLoginPrompt に切り替わる)。ログイン状態の見本が要る。' },
  { component: 'HousingDiagOverlay', stage: 3, reason: '診断用の隠し表示・撮影対象外(?diag=1)。' },
  { component: 'AvatarCropModal', stage: 2, reason: 'LoginModal 内の窓。ログイン済みユーザーのアバター変更でしか開かない。ログイン状態の見本が要る。' },
  { component: 'ShareChoiceModal', stage: 2, reason: '共有ボタンの 2 択窓。ログイン済み+保存済みプランの時だけ開く(未ログインはコピー共有へ直行)。ログイン状態の見本が要る。' },
  { component: 'OwnerCollabPanel', stage: 3, reason: '共同編集中のオーナー用パネル。ログイン+共同編集の部屋(WebSocket)が必須。' },
  { component: 'CursorOptInModal', stage: 3, reason: '共同編集のカーソル共有の同意窓。共同編集の接続中にだけ出る。' },
  { component: 'CollabEditConsentModal', stage: 3, reason: '/collab/:roomToken の参加同意窓。部屋への WebSocket 接続が必須で、撮影対象外。' },
  { component: 'WelcomeSetup', stage: 2, reason: '新規ユーザー(useAuthStore.isNewUser)の初回設定窓。ログイン直後にしか出ない。ログイン状態の見本が要る。' },
  { component: 'ArchivePromptModal', stage: 2, reason: '旧レベル零式プランがあり archive-auto-done キーが無い時だけ自動で出る。該当プランを含む見本を足せば撮れる。' },
  { component: 'LocalImportDialog', stage: 2, reason: 'useLocalImportDialog.open() で開く。ログイン後のローカルデータ取り込み用で、取り込み対象のローカルプランを持つ見本が要る。' },
  { component: 'ShareImportSheet', stage: 2, reason: '/share/:id の取り込みシート。GET /api/share?id= の共有データ見本(planData つき)が fixtures/api に無い。見本を足せば撮れる。' },
  { component: 'LimitResolutionSheet', stage: 2, reason: '取り込み時のプラン数上限の解消シート。ShareImportSheet と同じ共有データ見本+プラン上限状態が要る。' },
  { component: 'ImportProgressOverlay', stage: 2, reason: '共有取り込みの進行中オーバーレイ。ShareImportSheet と同じ共有データ見本が要る。' },
  { component: 'JobMigrationModal', stage: 2, reason: 'パーティ設定でジョブを変更し、既存の軽減がある時だけ開く。ジョブ変更の操作手順を足せば撮れる。' },
  { component: 'VideoRecorderModal', stage: 3, reason: 'PiP メニューからの動画取り込み。PiP(Document Picture-in-Picture)と画面共有の権限が必要で自動撮影できない。' },
  { component: 'TutorialOverlay', stage: 2, reason: 'startTutorial() で出る案内の吹き出し。チュートリアルは各ステップの要素待ちで、ステップごとの手順の設計が要る。' },
  { component: 'ProgressRecordPanel', stage: 2, reason: 'その他メニュー→進捗バー表示を ON にして記録を押す手順と、進捗の見本データが要る。' },
  { component: 'SheetTargetPopover', stage: 2, reason: '表示を「スプシ」にしたセルの操作で出る小窓。セルのクリック手順(列・行の座標)が要る。' },
  { component: 'AetherflowChainPromptModal', stage: 2, reason: 'store の aetherflowChainPrompt を立てれば開くが、store の dev 動的 import 手順を足す必要がある。' },
  { component: 'AstrologianDrawChainPromptModal', stage: 2, reason: 'store の astrologianDrawChainPrompt を立てれば開くが、store の dev 動的 import 手順を足す必要がある。' },
];
