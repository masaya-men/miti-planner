// @ts-check
// 段階 1 のカタログに入れなかった窓・画面(理由つき)。run.mjs は先頭 _ のファイルを読まない。
// stage: 2 = 見本・撮影手順を足せば撮れる / 3 = 撮影対象外・専用の仕組みが要る
// 管理画面のページ本体。/admin は AdminGuard が管理者ログイン(Firebase Auth + 管理者権限)を要求し、データも Firestore 直読みで見本に載せられない
const ADMIN_PAGES = ['AdminLayout', 'AdminDashboard', 'AdminContents', 'AdminContentForm', 'AdminTemplates', 'AdminConfig', 'AdminSkills', 'AdminTranslations', 'AdminStats', 'AdminServers', 'AdminBackups', 'AdminLogs', 'AdminUgc', 'AdminFeatured', 'AdminSystemNotifications', 'AdminHousingReports', 'AdminHousingerReports', 'AdminHousingNewBadge'];

/** @type {{ component: string, stage: 2 | 3, reason: string }[]} */
export default [
  { component: 'HousingerPage', stage: 2, reason: '/housing/housinger/:uid は uid が hashed:<id> に正規化され、API が uid=hashed:vr-user-a で呼ばれる。見本ファイル名にコロンが入り Windows で作れず(apiFixtureKey の置換が要る)、プロフィール本体は Firestore 直読み(遮断中)で、撮ると見本の無い通信で失敗する。マイページのログイン案内側(/housing/mypage 未ログイン)だけ housing/login-prompt-mypage で撮影済み。' },
  { component: 'HousingerShortLinkPage', stage: 2, reason: '/h/:slug は Firestore getDocs で slug を解決する(遮断中)ため、実内容が出ない。HousingerPage と同じ理由で見本の拡張が要る。' },
  { component: 'JoinTourPage', stage: 2, reason: '/housing/tour/:tourToken を撮ると「接続中/見つからない」の 1 枚メッセージだけ(housing-tour-empty-title)が出る。viewing/ended の本体は shared_tours の Firestore getDoc と onSnapshot が必須で、遮断中は出せない。' },
  { component: 'HousingCardVideoOverlay', stage: 2, reason: '動画つきカード(vr-l05)にホバーしても 15 秒待ってオーバーレイ(.housing-card-video-overlay)が出なかった。再生対象はビューポート内のスポットライト回転(useSpotlightRotation)で決まり、時間依存。再生を決める値の固定手順が要る。' },
  { component: 'RoomListPanel', stage: 2, reason: '同じ建物(スポット)に 2 件以上の家がある時だけ開く。見本の家は 1 スポット 1 件なので開けない。同一アパートに複数件の見本を足せば撮れる。' },
  { component: 'ListingCardOwnerControls', stage: 2, reason: 'マイページ(ログイン必須)の家カードにだけ出る公開状態バッジとそのメニュー(Task 17 で ListingCard から分けた)。カード本体は housing/browse-list で撮影済み。ログイン状態の見本が要る。' },
  { component: 'TourInvitePanel', stage: 2, reason: 'ログイン済みの時だけ描画される(未ログインは HousingLoginPrompt に切り替わる)。ログイン状態の見本が要る。' },
  { component: 'HousingDiagOverlay', stage: 3, reason: '診断用の隠し表示・撮影対象外(?diag=1)。' },
  { component: 'AvatarCropModal', stage: 2, reason: 'LoginModal 内の窓。ログイン済みユーザーのアバター変更でしか開かない。ログイン状態の見本が要る。' },
  { component: 'ShareChoiceModal', stage: 2, reason: '共有ボタンの 2 択窓。ログイン済み+保存済みプランの時だけ開く(未ログインはコピー共有へ直行)。ログイン状態の見本が要る。' },
  { component: 'OwnerCollabPanel', stage: 3, reason: '共同編集中のオーナー用パネル。ログイン+共同編集の部屋(WebSocket)が必須。' },
  { component: 'CursorOptInModal', stage: 3, reason: '共同編集のカーソル共有の同意窓。共同編集の接続中にだけ出る。' },
  { component: 'CollabEditConsentModal', stage: 3, reason: '/collab/:roomToken の参加同意窓。部屋への WebSocket 接続が必須で、撮影対象外。' },
  { component: 'WelcomeSetup', stage: 2, reason: '新規ユーザー(useAuthStore.isNewUser)の初回設定窓。ログイン直後にしか出ない。ログイン状態の見本が要る。' },
  { component: 'VideoRecorderModal', stage: 3, reason: 'PiP メニューからの動画取り込み。PiP(Document Picture-in-Picture)と画面共有の権限が必要で自動撮影できない。' },
  { component: 'FFLogsImportModal', stage: 2, reason: '本体(URL 入力・プレビュー)はログイン必須。未ログインのログイン案内のみ段階 1 で撮影(miti/win-fflogs-import)' },
  { component: 'MilspecDim', stage: 3, reason: '電源投入の演出は動きなので撮らない(設計書 §3)。撮影は演出完了後の静止状態' },
  // ───────── 段階 2: 管理画面(管理者ログイン + 管理データが必須) ─────────
  ...ADMIN_PAGES.map((component) => ({ component, stage: /** @type {const} */ (2), reason: '/admin 配下の管理画面。AdminGuard が管理者ログインを要求し、表示データも Firestore の管理用コレクション(遮断中)から読む。管理者ログイン状態と管理データの見本が要る。' })),
  { component: 'PlanToTemplateModal', stage: 2, reason: '管理画面 AdminTemplates の「プランからテンプレート化」窓。管理者ログイン + 保存済みプランが必須。' },
  { component: 'CsvImportModal', stage: 2, reason: '管理画面(src/components/admin/CsvImportModal.tsx)の CSV 取り込み窓。管理者ログインが必須。(src/components/CsvImportModal.tsx は未使用で別物)' },
  { component: 'FflogsTranslationModal', stage: 2, reason: '管理画面 AdminTranslations の FFLogs 翻訳取り込み窓。管理者ログインと FFLogs API 通信が必須。' },
  { component: 'FflogsTimelineImportModal', stage: 2, reason: '管理画面 AdminTemplates の FFLogs タイムライン取り込み窓。管理者ログインと FFLogs API 通信が必須。' },
  { component: 'SheetTargetMatchModal', stage: 2, reason: '管理画面 AdminTemplates のスプレッドシート対象照合窓。管理者ログインとテンプレート編集状態が必須。' },
  { component: 'BulkEditPopover', stage: 2, reason: '管理画面 AdminTemplates のテンプレート一括編集ポップ。管理者ログイン + テンプレートの複数選択が必須。' },
  { component: 'SkillFormModal', stage: 2, reason: '管理画面 AdminSkills のスキル追加・編集窓。管理者ログインが必須。' },
  { component: 'EditModal', stage: 2, reason: '管理画面 AdminSystemNotifications の通知編集窓(同ファイル内の内部コンポーネント。削除確認はブラウザ標準の confirm)。管理者ログインが必須。' },
  // ───────── 段階 2: ログイン必須の窓(軽減表スマホ・ハウジング) ─────────
  { component: 'MobileAccountMenu', stage: 2, reason: '軽減表スマホのアカウントシート(Layout.tsx の mobileAccountOpen)。ログイン済みユーザーの時だけ開く(未ログインは下ナビ「ログイン」がログイン窓を開く)。' },
  { component: 'HousingAccountModal', stage: 2, reason: 'ハウジングのアカウント窓(確認ダイアログ含む)。ログイン済みの時だけ開く。' },
  { component: 'HousingAvatarCropModal', stage: 2, reason: 'ハウジングのアバター切り抜き窓。マイページ/アカウント窓のログイン済み操作でしか開かない。' },
  { component: 'NotificationDropdown', stage: 2, reason: 'ハウジングの通知ドロップダウン。ログイン済みヘッダーにだけ出る。' },
  { component: 'HousingReportModal', stage: 2, reason: 'ハウジング詳細の報告窓。ログイン必須で他人の投稿の時だけ出る。' },
  { component: 'HousingDetailKebab', stage: 2, reason: 'ハウジング詳細のオーナー用ケバブメニュー。投稿者本人のログインが必須。' },
  { component: 'HousingDeleteConfirm', stage: 2, reason: 'ハウジング投稿の削除確認。ケバブ(オーナー)経由で、ログイン必須。' },
  { component: 'HousingerReportModal', stage: 2, reason: 'ハウジンガーページの報告窓。ログイン必須。ハウジンガーページ自体も見本が未対応(HousingerPage 参照)。' },
  { component: 'HousingerReportMenu', stage: 2, reason: 'ハウジンガーページの「…」メニュー(通報・本人以外にだけ出る)。HousingerPage から切り出した部品で、ハウジンガーページ自体が見本未対応(HousingerPage 参照)。' },
  { component: 'VisibilityConfirmModal', stage: 2, reason: 'マイページの公開範囲変更の確認窓。ログイン + 自分の投稿が必須。' },
  { component: 'HousingerProfileSection', stage: 2, reason: 'マイページのハウジンガープロフィール編集欄。ログイン必須。' },
  { component: 'HousingDateTimePicker', stage: 2, reason: 'ハウジング登録画面の日時選択ポップ。登録画面はログイン必須(未ログインはログイン案内のみ)。' },
  { component: 'HousingDuplicateWarningDialog', stage: 2, reason: 'ハウジング登録の重複警告。ログイン + 重複住所の登録操作が必須。' },
  { component: 'TourAddressExposureDialog', stage: 2, reason: 'ツアー招待作成時の住所公開確認。ログイン必須(招待作成はログイン済みのみ)。' },
  { component: 'RegisterPage', stage: 2, reason: 'ハウジング登録画面の本体。ログイン必須で、未ログイン時のログイン案内(HousingLoginPrompt)のみ housing/login-prompt-register で撮影済み。' },
  { component: 'HousingEditPage', stage: 2, reason: 'ハウジング編集画面(/housing/listing/:id/edit)。ログイン + 自分の投稿が必須。' },
  // ───────── 段階 2: カタログ網羅検査(coverage.test.ts)で見つかった載せ漏れ ─────────
  { component: 'HousingBottomNav', stage: 2, reason: '段階 1 で載せ漏れ。ハウジングのスマホ下ナビのアカウントメニュー(role=menu)は、ログイン済みの時だけ開く(housing-bottomnav-account-menu)。ログイン状態の見本が要る。' },
  { component: 'SharePage', stage: 2, reason: '段階 1 で載せ漏れ。/share/:shareId は共有プランを /api/share から読む。share.get の見本 JSON を用意すれば開ける見込み(未検証)。' },
  { component: 'HousingShell', stage: 3, reason: '全ハウジング画面の外枠(ヘッダー・下ナビ)。個別画面の撮影にすべて写り込むため単独では撮らない。/h/:slug の中身は HousingerShortLinkPage 参照。' },
  { component: 'ContentWizard', stage: 2, reason: '管理画面 /admin/content-wizard。管理者ログインと管理データ(Firestore)が必須。' },
  { component: 'TemplateWizard', stage: 2, reason: '管理画面 /admin/template-wizard。管理者ログインと管理データ(Firestore)が必須。' },
  { component: 'JobWizard', stage: 2, reason: '管理画面 /admin/job-wizard。管理者ログインと管理データ(Firestore)が必須。' },
  { component: 'StatsWizard', stage: 2, reason: '管理画面 /admin/stats-wizard。管理者ログインと管理データ(Firestore)が必須。' },
  { component: 'MobilePartySettings', stage: 2, reason: '段階 1 で載せ漏れ。軽減表スマホのパーティ設定シート(Layout 内)。MobilePartyWithTabs は撮影済みで、同ファイルのアカウントシート側(MobileAccountMenu)はログイン済みが必要。ファイル単位の照合のため残りの窓を確認して撮影見込み(未検証)。' },
  { component: 'ProgressDetailPanel', stage: 2, reason: '段階 1 で載せ漏れ。攻略の軌跡パネル(ProgressRecordPanel、撮影済み)内の折りたたみ詳細。ChevronToggle を押して開く見込み(未検証)。' },
  // ───────── 段階 3: 共同編集 ─────────
  { component: 'CollabJoinerPage', stage: 3, reason: '/collab/:roomToken の参加画面。部屋への WebSocket 接続とログインが必須で、撮影対象外。' },
];
