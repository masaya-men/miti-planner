# ハウジング ログイン UI 整備 設計書

- **作成日**: 2026-05-20
- **作成者**: masaya-men + Claude (Opus 4.7)
- **対象**: ハウジング (`/housing`) 画面に Discord ログイン UI 一式を導入し、 未ログインユーザーの登録モーダル経由のログイン誘導フローを完成させる
- **位置づけ**: hash 化マイグレーション (Step 2) 完了後の本来の目的だった作業。 hash 化により「LoPo は連絡できない」 が事実として真になった状態で文言適用も行う
- **依存**: hash 化マイグレーション Step 2 完了 (2026-05-20 完了済)

---

## 1. 背景と目的

### 1.1 経緯

セッション #39 (2026-05-19) でハウジング ログイン UI 整備の文言詰めをしていた最中、 認証実装が `discord:<生 ID>` を Firebase uid として使っており、 「LoPo は連絡できません」 という主張が技術的に厳密でないことが判明した。 そこで hash 化マイグレーションを先行で実施 (Step 1 + Step 2、 2026-05-20 完了)。

これにより:
- Discord 10 件全てが `hashed:<HMAC-SHA256>` 形式に移行済
- LoPo 内部からも元 Discord ID 復元不能
- 「LoPo は元の Discord ID を保存せず、 LoPo 内部でも復元できない」 が**事実として真**

本 spec はこの状態で本来のハウジング ログイン UI 整備を完了させるための設計書である。

### 1.2 目的

ハウジングの全機能 (物件登録 / お気に入り / ツアー保存 等) は Discord ログイン必須。 現状は LoPo (軽減表) の LoginModal を間接的に再利用する形だが、 ハウジングは独立世界観 (memory `feedback_housing_design_independent.md`) として独自トンマナ (ハニーゴールド) を持つため、 **ハウジング専用のログイン / アカウント UI を新規作成**する。

具体的には準備メモ [2026-05-19-hash-migration-prep.md](../../.private/2026-05-19-hash-migration-prep.md) §「ハウジング ログイン UI 整備の 6 項目」 を実装する:

1. ハウジング版 LoginModal (未ログイン時)
2. ハウジング版 AccountModal (ログイン済み時)
3. TopBar 右上 ログイン / アバターボタン
4. モーダルスタッキング (登録モーダル背後ロック + ログインモーダル手前)
5. ログイン後の登録モーダル復元
6. × で閉じた時の挙動

### 1.3 非ゴール

- ハウジング全体の i18n 整備 (= 既に完了済、 残ハードコードゼロを確認)
- スマホ最適化 (= 別タスク、 ハウジング全体まとめて後で実施)
- Phase 2 (マップ書き起こし) / Phase 3 (物件詳細 / 通報 / 異議申し立て) の実装
- `?register=open` 以外のクエリ駆動モーダル (Phase 3 で追加予定)

---

## 2. 決定事項サマリー (brainstorming 結果)

| # | 論点 | 決定 | 根拠 |
|---|---|---|---|
| 1 | 実装戦略 | **B**: ハウジング専用 UI を新規作成、 ロジックは hooks で LoPo と共通化 | トンマナ完全分離 (`housing-design.md` ルール) を保ちつつ、 認証データ操作の二重実装を避ける |
| 2 | モーダル開閉 | **β**: URL クエリ `?register=open` 駆動、 ブラウザバックで閉じる | 業界水準の UX、 Phase 3 のモーダル増加にも対応できる基盤 |
| 3 | TopBar 配置 | **2**: 一番右 (LoPo アバター丸と同じ感覚) | LoPo (軽減表) との位置感覚統一、 ユーザー認知負荷低減 |
| 4 | × で閉じる挙動 | **b**: 経路 B (登録モーダル経由) では両方一緒に閉じる + URL クリア | 「× = 全部閉じる」 でシンプル、 ユーザーが迷子にならない |
| 5 | AccountModal 機能 | **2 + A**: アバター / displayName / 管理画面 / ログアウト / 退会 (ローカル取込は除外) | ハウジングに関係ない軽減表機能は除外、 displayName は将来表示する可能性に備えて含める |
| 6 | i18n | **A'**: 最初から i18n キー化、 ja 翻訳のみ先行、 en/ko/zh は後で値追加 | ハードコード回避 (memory `feedback_no_hardcoding.md`)、 ハウジング全体 i18n 整備済の整合性維持 |

---

## 3. アーキテクチャ

### 3.1 ファイル配置

| 種別 | パス | 責任 |
|---|---|---|
| 新規 | `src/components/housing/login/HousingLoginModal.tsx` | 未ログイン時のログイン誘導モーダル (Discord ボタン + 文言) |
| 新規 | `src/components/housing/login/HousingAccountModal.tsx` | ログイン済時のアカウント設定モーダル (5 機能) |
| 新規 | `src/hooks/auth/useAccountActions.ts` | LoPo `LoginModal.tsx` から抽出する共通フック (avatar / displayName / ログアウト / 退会) |
| 新規 | `src/store/useHousingModalStore.ts` | ハウジング側モーダルの開閉状態 (login / register) を URL と sync する Zustand store |
| 修正 | `src/components/housing/workspace/HousingWorkspace.tsx` | 登録モーダル open state を local useState → store + URL クエリ駆動に変更 |
| 修正 | `src/components/housing/workspace/TopBar.tsx` | 右端に「ログイン」 ボタン (未) / 「アバター丸」 (済) を追加 |
| 修正 | `src/components/housing/register/HousingRegisterFormModal.tsx` | 既存「ログイン誘導」 部分を `useHousingModalStore.openLogin({ fromRegister: true })` 呼出にリンク |
| 修正 | `src/store/useAuthStore.ts` | `saveReturnUrl()` 直前に `?register=open` を URL に書き込む拡張 (ハウジングから呼ばれたときのみ) |
| 修正 | `src/locales/ja.json` | `housing.login.*` / `housing.account.*` キー追加 (ja 翻訳のみ) |
| 修正 (空キー追加のみ) | `src/locales/en.json` / `ko.json` / `zh.json` | 同じキーで空値 or プレースホルダーを追加 (フォールバックで ja 表示) |
| 修正 | `src/styles/housing.css` | ハウジング版 LoginModal / AccountModal 用 CSS クラス追加 (`housing-login-*` / `housing-account-*` prefix) |

### 3.2 hooks 抽出範囲 (戦略 B の具体化)

LoPo [`LoginModal.tsx`](../../../src/components/LoginModal.tsx) は現状 1 ファイルに全機能が詰まっているため、 以下の機能を `useAccountActions.ts` に抽出する:

| 機能 | 抽出ロジック | 残る UI 部分 |
|---|---|---|
| アバター編集 | `uploadAvatar(file)` / `removeAvatar()` (`logoUpload.ts` 呼び出し + Firestore 更新) | プレビュー / file input / トリミング UI は各モーダルで独自実装 |
| displayName 編集 | `updateDisplayName(name)` (Firebase Auth + Firestore users doc 更新) | 入力フィールド + バリデーション UI は各モーダルで独自実装 |
| ログアウト | `signOut()` (既存 `useAuthStore` 経由) | ボタン UI は各モーダルで独自実装 |
| 退会 | `deleteAccount()` (Firestore データ削除 + Auth user 削除) | 確認ダイアログ UI は各モーダルで独自実装 |
| 管理画面リンク | (ロジック不要、 react-router navigate のみ) | リンクボタン UI は各モーダルで独自実装 |

LoPo 既存 [`LoginModal.tsx`](../../../src/components/LoginModal.tsx) も同じ hook を使うよう refactor する。 これにより:
- 認証データ操作のメンテナンスは 1 箇所 (hook) に集約
- UI (CSS / レイアウト) は LoPo (白黒) と housing (ハニーゴールド) で完全分離

### 3.3 状態管理: `useHousingModalStore`

```typescript
interface HousingModalState {
    login: { open: boolean; fromRegister: boolean };
    account: { open: boolean };
    register: { open: boolean };

    openLogin(opts?: { fromRegister?: boolean }): void;
    closeLogin(): void;  // fromRegister=true なら register も閉じる (内部判定)
    openAccount(): void;
    closeAccount(): void;
    openRegister(): void;
    closeRegister(): void;

    // URL sync
    syncFromUrl(searchParams: URLSearchParams): void;
}
```

**URL ↔ store の sync ルール**:
- `?register=open` がある → `register.open = true`
- `?register=open` がない → `register.open = false`
- ログインモーダル / アカウントモーダルは URL に含めない (短命なステート、 リロード後の復元不要)
- 開閉操作はすべて store のメソッド経由 → store 内で `navigate` を呼んで URL を更新

**ログインモーダルとアカウントモーダルの排他**: 同時に開くことはない (未ログイン → login のみ、 ログイン済 → account のみ)。 TopBar 右端ボタンのクリックハンドラで `isAuthenticated` を見て分岐する。

### 3.4 既存 LoPo への影響

| ファイル | 影響 |
|---|---|
| `src/components/LoginModal.tsx` | `useAccountActions` hook 使用に refactor (動作変更なし、 内部実装変更のみ) |
| `src/store/useAuthStore.ts` | `saveReturnUrl()` に `fromHousingRegister: boolean` 引数追加。 true なら戻り URL に `?register=open` を含める |
| 他 LoPo 画面 | 影響なし |

---

## 4. 6 項目の詳細設計

### 4.1 項目 1: ハウジング版 LoginModal

**外見**:
- `HousingPanelModal` をラッパーとして流用 ([HousingPanelModal.tsx](../../../src/components/housing/HousingPanelModal.tsx))
- `maxWidth` は LoPo LoginModal と同等 (480px 程度) の `--housing-modal-width-md` を新設
- title: i18n キー `housing.login.title` (ja: 「LoPo にログイン」)

**中身**:

```
┌─────────────────────────────────┐
│ LoPo にログイン            × │
├─────────────────────────────────┤
│                                  │
│  [文言ブロック (準備メモ §文言)]  │
│                                  │
│  ┌──────────────────────────┐  │
│  │  Discord でログイン       │  │  ← ハニーゴールド pill ボタン
│  └──────────────────────────┘  │
│                                  │
└─────────────────────────────────┘
```

**文言** (i18n キー `housing.login.notice` の本文、 ja 原文):

```
LoPo を気持ちよく使ってもらうためのお願いです。

 ・ 偽の情報や嫌がらせ目的の登録で家探しが台無しにならないよう、
   登録時には Discord ログインをお願いしています。

 ・ LoPo が受け取るのは Discord アカウントの ID (ハッシュ値) だけです。
   メールアドレス・ユーザー名・アバター画像は受け取りません。
   元の Discord ID は LoPo 内部でも復元できない形で保存されます。

 ・ 「ちがった」 ボタンを気軽に押してもらえるよう、
   逆に嫌がらせ通報を繰り返すアカウントは裏側で記録しています。
   度を越した行為があった場合、 そのアカウントの利用を制限する
   ことがあります。
```

i18n キー設計案 (実装時に調整可):
- `housing.login.title`
- `housing.login.notice.intro` (1 行目)
- `housing.login.notice.item1` (偽情報防止)
- `housing.login.notice.item2` (hash 化保存)
- `housing.login.notice.item3` (嫌がらせ通報の制限)
- `housing.login.discordButton`

**ボタン挙動**:
- Discord ボタンクリック → `useAuthStore.signInWithDiscord({ fromHousingRegister: register.open })` 呼出
- ハウジング登録モーダル経由なら `?register=open` を戻り URL に含める

### 4.2 項目 2: ハウジング版 AccountModal

**外見**: `HousingPanelModal` ラッパー、 ハニーゴールドトンマナ、 maxWidth は LoginModal と同等

**機能配置案**:

```
┌─────────────────────────────────┐
│ アカウント                  × │
├─────────────────────────────────┤
│                                  │
│  [アバター画像 + 編集ボタン]      │
│                                  │
│  表示名 [          ] [保存]      │
│                                  │
│  ─────────────────────         │
│                                  │
│  [管理画面へ] (admin のみ表示)    │
│  [ログアウト]                    │
│  [退会する] (赤系警告色 + 確認)   │
│                                  │
└─────────────────────────────────┘
```

**機能詳細**:

| 機能 | 実装 |
|---|---|
| アバター画像表示 | `users/{uid}/avatar.webp` (Firebase Storage) を表示、 fallback は generic icon |
| アバター編集 | クリック → file picker → トリミング UI → `useAccountActions().uploadAvatar(file)` |
| アバター削除 | アバター編集 UI 内に「削除」 ボタン → `useAccountActions().removeAvatar()` |
| 表示名編集 | 入力 → 保存ボタン → `useAccountActions().updateDisplayName(name)` |
| 管理画面リンク | `isAdmin === true` のときのみ表示、 クリック → `navigate('/admin')` |
| ログアウト | クリック → 確認なしで `useAccountActions().signOut()` (LoPo と同じ挙動) |
| 退会 | クリック → 確認ダイアログ「全データが削除されます。 本当に退会しますか?」 → `useAccountActions().deleteAccount()` |

**ローカル取込ボタンは含めない** (= LoPo の `LoginModal` にあるが、 ハウジング側では不要)。

### 4.3 項目 3: TopBar 右端 ログイン / アバターボタン

**現状**: [TopBar.tsx:24-149](../../../src/components/housing/workspace/TopBar.tsx#L24-L149)

```
[左パネルトグル] [ブランド] [検索] | [♡] [登録] [テーマ] [右パネルトグル]
```

**変更後**:

```
[左パネルトグル] [ブランド] [検索] | [♡] [登録] [テーマ] [右パネルトグル] [👤]
                                                                          ↑
                                                                  未ログイン: ログインボタン (pill)
                                                                  ログイン済: アバター丸
```

**実装**:
- 未ログイン時: `<button className="housing-top-login-btn" onClick={() => openLogin()}>{t('housing.topbar.login')}</button>`
- ログイン済時: `<button className="housing-top-avatar-btn" onClick={() => openAccount()}><img src={avatarUrl} ... /></button>`
- いずれも §3.3 `useHousingModalStore` のメソッド呼出
- `useAuthStore` の `isAuthenticated` で表示を分岐

**注意**: 「パネル開閉と並べる位置の最終調整は後で」 (ユーザー判断、 2026-05-20)。 現状は LoPo アバター丸の感覚に合わせて TopBar の右端に置く。

### 4.4 項目 4: モーダルスタッキング

**シナリオ**: 未ログインユーザーがハウジング登録モーダルを開く → 内部の「ログインしてください」 リンクをクリック → ログインモーダルが上に重なる

**実装**:

| 要素 | z-index | 補足 |
|---|---|---|
| `HousingRegisterFormModal` (背後) | 50 (既存) | 開いたまま、 オーバーレイで操作不可ロック |
| `HousingLoginModal` (手前) | 60 | 新規追加、 完全に手前に表示 |
| 確認ダイアログ等 (もし出るなら) | 70 | 退会確認等の最上位 |

**操作不可ロック**: `HousingRegisterFormModal` の overlay を維持しつつ、 `pointer-events: none` を中身に当てる or `aria-hidden="true"` を立てる。 視覚的には背後にかすかに見えるが、 直接クリック不能。

### 4.5 項目 5: ログイン後の登録モーダル復元

**フロー**:

```
[ハウジング画面] → 登録ボタン押下
    ↓
[?register=open に URL 更新] → 登録モーダル開く
    ↓
[未ログインを検知] → 「ログインしてください」 リンク表示
    ↓ クリック
[ログインモーダル開く (スタッキング)]
    ↓ Discord ボタン
[useAuthStore.signInWithDiscord({ fromHousingRegister: true })]
    ↓ 内部で saveReturnUrl() に ?register=open 付きの戻り URL を渡す
[Discord OAuth リダイレクト]
    ↓ Discord 認証完了
[/auth/callback で戻り URL に redirect]
    ↓ 戻り URL = /housing?register=open
[HousingWorkspace mount → useHousingModalStore.syncFromUrl(searchParams)]
    ↓ register.open = true
[登録モーダル auto open + アバター丸が TopBar に表示]
```

**重要**: `saveReturnUrl()` は既存 [`useAuthStore.ts:29`](../../../src/store/useAuthStore.ts#L29) で実装済。 ハウジング側からの呼出で `?register=open` を含むことを追加する。

### 4.6 項目 6: × で閉じた時の挙動

**経路 A** (TopBar の「ログイン」 ボタンから直接):
- ログインモーダル × → `closeLogin()` → ログインモーダルだけ閉じる
- 登録モーダルはそもそも開いてないので影響なし

**経路 B** (登録モーダル → 「ログインしてください」 リンク → ログインモーダル):
- ログインモーダル × → `closeLogin({ closeRegister: true })` → 両方閉じる + URL クリア (`?register=open` 除去)

**識別方法**: ログインモーダルを開く時に「経路 A か B か」 を store に保存する。

```typescript
openLogin(opts?: { fromRegister?: boolean }) {
    set({ login: { open: true, fromRegister: opts?.fromRegister ?? false } });
}

closeLogin() {
    const { login } = get();
    if (login.fromRegister) {
        get().closeRegister();  // URL からも ?register=open を除去
    }
    set({ login: { open: false, fromRegister: false } });
}
```

---

## 5. i18n 対応

### 5.1 追加キー (`src/locales/ja.json`)

```json
{
    "housing": {
        "login": {
            "title": "LoPo にログイン",
            "notice": {
                "intro": "LoPo を気持ちよく使ってもらうためのお願いです。",
                "item1": "偽の情報や嫌がらせ目的の登録で家探しが台無しにならないよう、登録時には Discord ログインをお願いしています。",
                "item2": "LoPo が受け取るのは Discord アカウントの ID (ハッシュ値) だけです。メールアドレス・ユーザー名・アバター画像は受け取りません。元の Discord ID は LoPo 内部でも復元できない形で保存されます。",
                "item3": "「ちがった」ボタンを気軽に押してもらえるよう、逆に嫌がらせ通報を繰り返すアカウントは裏側で記録しています。度を越した行為があった場合、そのアカウントの利用を制限することがあります。"
            },
            "discordButton": "Discord でログイン"
        },
        "account": {
            "title": "アカウント",
            "avatarLabel": "アバター画像",
            "avatarEdit": "編集",
            "avatarRemove": "削除",
            "displayNameLabel": "表示名",
            "displayNameSave": "保存",
            "adminLink": "管理画面へ",
            "signOut": "ログアウト",
            "deleteAccount": "退会する",
            "deleteConfirmTitle": "本当に退会しますか?",
            "deleteConfirmBody": "アカウントを削除すると、登録した物件・お気に入り・アバター画像など全てのデータが完全に削除されます。この操作は取り消せません。",
            "deleteConfirmYes": "退会する",
            "deleteConfirmNo": "やめる"
        },
        "topbar": {
            "login": "ログイン",
            "account": "アカウント"
        }
    }
}
```

### 5.2 en / ko / zh

同じキーで**空文字列**を追加する。 i18next のフォールバック設定 (`fallbackLng: 'ja'`) により、 空文字または未定義のキーは ja の値が表示される。

実際の en / ko / zh への翻訳は別タスクで実施 (ハウジング全体 i18n 整備の一環)。

### 5.3 確認: ハードコード残量

[2026-05-20 確認時点](../../../src/components/housing/) でハウジング workspace 配下にハードコード日本語文字列は**コメント内 4 件のみ**、 ユーザー向け表示文字列は全て i18n キー化済。 本 spec の実装でも新規ハードコードを発生させない。

---

## 6. 実装順序とデプロイ

### 6.1 順序 (依存関係に基づく)

| Phase | 内容 | 動作確認 |
|---|---|---|
| **A** | hooks 抽出 (`useAccountActions.ts`) + LoPo `LoginModal.tsx` を hook 使用に refactor | LoPo `LoginModal` の全機能が refactor 前と同じ動作 (manual test + 既存 vitest pass) |
| **B** | `useHousingModalStore.ts` 作成 + 登録モーダル open state を local useState → store 移行 (URL 駆動はまだ未接続) | 登録モーダルが従来通り開閉 (TopBar の登録ボタンから) |
| **C** | URL クエリ駆動接続 (`HousingWorkspace` で `syncFromUrl`、 store 内 navigate 呼出) | URL に `?register=open` で開く / ブラウザバックで閉じる |
| **D** | `HousingLoginModal.tsx` 実装 + `HousingPanelModal` 流用 + i18n キー追加 (ja) | TopBar からまだ呼べないので、 一時的に開発用ボタンで動作確認 |
| **E** | `HousingAccountModal.tsx` 実装 + 5 機能配置 | 同上 |
| **F** | TopBar 右端に「ログイン」 / 「アバター丸」 ボタン追加 | 未ログイン / ログイン済の両方で表示切替 |
| **G** | ログイン後の戻り (`?register=open` 含む) + `saveReturnUrl()` 拡張 | Discord OAuth 経由で戻ってきたら登録モーダルが自動 open |
| **H** | × で閉じる時の挙動 (経路 A/B 分岐) | 全シナリオ手動テスト |
| **I** | en / ko / zh ロケールに空キー追加 | 言語切替で他言語でも ja 文言がフォールバック表示 |

### 6.2 デプロイ単位

| 単位 | 内容 |
|---|---|
| **PR 1** | Phase A: hooks 抽出 + LoPo LoginModal refactor (独立した clean refactor) |
| **PR 2** | Phase B + C: store + URL 駆動への移行 (動作変更なし、 仕組みだけ変更) |
| **PR 3** | Phase D-I: ハウジング版 LoginModal / AccountModal / TopBar / 戻り処理 / × 挙動 / i18n (= ユーザー体験変化を伴う) |

**メリット**: PR 1 / 2 で動作変更ゼロのリファクタを先に merge することで、 PR 3 のレビュー範囲が「新規機能のみ」 に絞られる。 万一 PR 3 でバグが見つかっても PR 1/2 は影響しない。

### 6.3 デプロイ環境

- Vercel preview デプロイで `?register=open` 動作確認 → masaya-men さん人柱テスト
- 確認 OK で main merge → 本番デプロイ
- Vercel Hobby 月 100 ビルドの上限を考慮 (memory `feedback_vercel_builds.md`)、 push をまとめる

---

## 7. テスト戦略

### 7.1 vitest unit test

| 対象 | テスト |
|---|---|
| `useAccountActions.ts` | mock Firestore + Auth で全 5 機能の挙動 |
| `useHousingModalStore.ts` | open/close メソッド、 URL sync (mock URLSearchParams) |
| `HousingLoginModal.tsx` | render テスト + Discord ボタンクリックで `signInWithDiscord` が呼ばれる |
| `HousingAccountModal.tsx` | render テスト + 5 機能ボタンの存在確認、 退会確認ダイアログの表示 |

### 7.2 手動テスト (人柱)

masaya-men さん本人で:
1. 未ログイン状態で TopBar の「ログイン」 ボタン → ログインモーダル開く → × → 閉じる (経路 A)
2. 未ログイン状態で TopBar の「登録」 → 登録モーダル開く → 「ログインしてください」 → ログインモーダル開く → × → 両方閉じる + URL クリア (経路 B × b 挙動)
3. 上記 2 の続きで × ではなく Discord ボタン → OAuth 完了 → 戻ってきて登録モーダル auto open + アバター丸表示
4. ログイン済状態で TopBar アバター丸 → AccountModal 開く → アバター編集 → displayName 編集 → ログアウト
5. 退会フロー (本人 admin claim 残るので慎重に確認、 確認ダイアログでキャンセル)
6. ブラウザバックで登録モーダルが閉じる (β 方式の動作確認)
7. ハウジング画面リロードで URL クエリ `?register=open` から登録モーダル復元

### 7.3 既存 LoPo 機能の回帰テスト

PR 1 の refactor 後に LoPo `LoginModal` の全機能が変化なしで動くこと:
- アバター編集 / displayName 編集 / 管理画面 / ローカル取込 / ログアウト / 退会
- LoPo 既存の vitest run pass

---

## 8. ロールバック可能性

| 項目 | ロールバック可否 | 補足 |
|---|---|---|
| PR 1 (hooks 抽出 refactor) | 可 | git revert で完全復元 |
| PR 2 (URL 駆動) | 可 | git revert で local useState に戻る |
| PR 3 (ハウジング新規 UI) | 可 | git revert で TopBar 元の状態に戻る、 ハウジング登録は引き続き LoPo LoginModal で間接的にログイン可能 |
| i18n キー追加 | 可 | ロケールファイルから該当キーを削除 |

---

## 9. 完了の定義

- ✅ `HousingLoginModal` / `HousingAccountModal` が実装され、 ハニーゴールドトンマナで表示される
- ✅ TopBar 右端で未ログイン → 「ログイン」 ボタン、 ログイン済 → アバター丸 が表示切替される
- ✅ ハウジング登録モーダルから「ログインしてください」 でログインモーダルが手前にスタック表示される
- ✅ ログインモーダル × で経路 A / B の挙動が正しく分岐する (経路 B では両方閉じる + URL クリア)
- ✅ Discord OAuth から戻ったら `?register=open` 付き URL で登録モーダル auto open する
- ✅ `useAccountActions.ts` hook を LoPo `LoginModal.tsx` も使用するよう refactor 済、 既存 LoPo 動作変化なし
- ✅ `src/locales/ja.json` に新キー追加、 en / ko / zh は空キーでフォールバック動作
- ✅ ハウジング workspace 配下に新規ハードコード文字列ゼロ (既存ガイドライン維持)
- ✅ Vercel preview で動作確認 → main merge → 本番デプロイ完了

---

## 10. 参照リンク

- 準備メモ (個人特定情報含む、 gitignore): [docs/.private/2026-05-19-hash-migration-prep.md](../../.private/2026-05-19-hash-migration-prep.md)
- hash 化 Step 2 設計書: [2026-05-20-hash-migration-step2-design.md](2026-05-20-hash-migration-step2-design.md)
- ハウジング独自ルール: [.claude/rules/housing-design.md](../../../.claude/rules/housing-design.md)
- ハウジング モックアップ (正典): `docs/.private/housing-tour-mockup/index.html`
- LoPo LoginModal: [src/components/LoginModal.tsx](../../../src/components/LoginModal.tsx)
- ハウジング TopBar: [src/components/housing/workspace/TopBar.tsx](../../../src/components/housing/workspace/TopBar.tsx)
- ハウジング HousingWorkspace: [src/components/housing/workspace/HousingWorkspace.tsx](../../../src/components/housing/workspace/HousingWorkspace.tsx)
- ハウジング HousingPanelModal: [src/components/housing/HousingPanelModal.tsx](../../../src/components/housing/HousingPanelModal.tsx)
- ハウジング登録モーダル: [src/components/housing/register/HousingRegisterFormModal.tsx](../../../src/components/housing/register/HousingRegisterFormModal.tsx)
- 認証 store: [src/store/useAuthStore.ts](../../../src/store/useAuthStore.ts)
- 認証プライバシー方針 memory: `feedback_auth_privacy.md`
- ハウジング独立世界観 memory: `feedback_housing_design_independent.md`
- ハードコード回避 memory: `feedback_no_hardcoding.md`
