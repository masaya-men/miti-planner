# ハウジング画面文言 繁体字対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジング画面の言語切り替えボタンのバグを直し、ハウジング文言764件の繁体字を全件レビューし、ログイン/アカウントモーダル23件を4言語(en/ko/zh/zh-Hant)で新規翻訳する。

**Architecture:** 既存の`pickRegionLocale`(`src/data/housing/regionMap.ts`)を再利用してハウジング内2箇所の言語判定バグを解消。翻訳はJSON値の追加・修正のみで、コード構造の変更は伴わない。全作業はworktree `.claude/worktrees/housing-taiwan-region-support`(ブランチ`worktree-housing-taiwan-region-support`)内で行う。

**Tech Stack:** React + TypeScript, i18next/react-i18next, vitest + @testing-library/react (happy-dom環境)

## Global Constraints

- 作業ディレクトリは必ず絶対パス `C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support` に `cd` してから全コマンドを実行すること(サブエージェントはworktree切替を継承しない)
- 既存の日本語・英語・韓国語・簡体字ユーザーの表示・動作を一切変えないこと(回帰テスト必須)
- コミットはするが、**push はしない**(このブランチはフェーズ①〜⑤が全て終わるまでpushしない方針)
- 本フェーズでは `/admin` 管理画面・Firestoreシード・ゲームデータ翻訳には一切触らない
- JSON編集は該当パスのみの部分編集にとどめ、ファイル全体のparse→再stringifyは行わないこと(フォーマット崩れ・意図しない差分を防ぐ)

---

### Task 1: StatusBar.tsx の言語切り替えバグ修正 + zh-Hant ボタン追加

**Files:**
- Modify: `src/components/housing/workspace/StatusBar.tsx`
- Modify: `src/__tests__/housing/StatusBar.test.tsx`

**Interfaces:**
- Consumes: `pickRegionLocale(language: string): 'ja'|'en'|'ko'|'zh'|'zh-Hant'`(既存・`src/data/housing/regionMap.ts`からexport済み、変更しない)
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/StatusBar.test.tsx` の import 部分に zh-Hant リソースを追加し、既存の言語スイッチャーテストを更新、新しい回帰テストを追加する。

```tsx
// 既存の import 群の下に追加
import zhHantTranslations from '../../locales/zh-Hant.json';
```

`beforeAll` の `resources` に1行追加:

```tsx
      zh: { translation: zhTranslations },
      'zh-Hant': { translation: zhHantTranslations },
```

既存の以下のテストを:

```tsx
  it('renders language switcher with ja/en/ko/zh and marks active', () => {
    renderStatusBar();
    const ja = screen.getByRole('button', { name: 'ja' });
    const en = screen.getByRole('button', { name: 'en' });
    const ko = screen.getByRole('button', { name: 'ko' });
    const zh = screen.getByRole('button', { name: 'zh' });
    expect(ja).toBeInTheDocument();
    expect(en).toBeInTheDocument();
    expect(ko).toBeInTheDocument();
    expect(zh).toBeInTheDocument();
    expect(ja.className).toContain('is-on');
  });
```

次のように置き換える:

```tsx
  it('renders language switcher with ja/en/ko/zh/zh-Hant and marks active', () => {
    renderStatusBar();
    const ja = screen.getByRole('button', { name: 'ja' });
    const en = screen.getByRole('button', { name: 'en' });
    const ko = screen.getByRole('button', { name: 'ko' });
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(ja).toBeInTheDocument();
    expect(en).toBeInTheDocument();
    expect(ko).toBeInTheDocument();
    expect(zh).toBeInTheDocument();
    expect(zhHant).toBeInTheDocument();
    expect(ja.className).toContain('is-on');
  });

  it('changes language on click', () => {
    renderStatusBar();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(i18n.language).toBe('en');
  });

  it('marks only zh-Hant active (not zh) when language is zh-Hant (2026-07-28 誤判定バグの回帰テスト)', () => {
    renderStatusBar();
    fireEvent.click(screen.getByRole('button', { name: 'zh-Hant' }));
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(zhHant.className).toContain('is-on');
    expect(zh.className).not.toContain('is-on');
  });
```

(既存の `changes language on click` テストはそのまま残し、直後に新しい回帰テストを追加する形。)

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/__tests__/housing/StatusBar.test.tsx
```

Expected: FAIL — `zh-Hant` という名前のボタンが見つからない、または `zh` ボタンが誤って `is-on` になる

- [ ] **Step 3: 最小実装**

`src/components/housing/workspace/StatusBar.tsx` の先頭 import に追加:

```tsx
import { pickRegionLocale } from '../../../data/housing/regionMap';
```

```tsx
const LANGS = ['ja', 'en', 'ko', 'zh'] as const;
```
を
```tsx
const LANGS = ['ja', 'en', 'ko', 'zh', 'zh-Hant'] as const;
```
に変更。

```tsx
            const isActive = i18n.language === lang || i18n.language.startsWith(`${lang}-`);
```
を
```tsx
            const isActive = pickRegionLocale(i18n.language) === lang;
```
に変更。

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/__tests__/housing/StatusBar.test.tsx
```

Expected: PASS(既存テスト含め全件)

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/components/housing/workspace/StatusBar.tsx src/__tests__/housing/StatusBar.test.tsx
git commit -m "fix: StatusBarの言語切替にzh-Hantを追加し誤判定を修正"
```

---

### Task 2: HousingSettingsSheet.tsx の言語切り替えバグ修正 + zh-Hant ボタン追加

**Files:**
- Modify: `src/components/housing/shell/HousingSettingsSheet.tsx`
- Create: `src/__tests__/housing/HousingSettingsSheet.test.tsx`

**Interfaces:**
- Consumes: `pickRegionLocale`(Task1と同じ関数、`src/data/housing/regionMap.ts`)
- Produces: なし(末端コンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/housing/HousingSettingsSheet.test.tsx` を新規作成:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import jaTranslations from '../../locales/ja.json';
import enTranslations from '../../locales/en.json';
import koTranslations from '../../locales/ko.json';
import zhTranslations from '../../locales/zh.json';
import zhHantTranslations from '../../locales/zh-Hant.json';
import { MemoryRouter } from 'react-router-dom';
import { HousingSettingsSheet } from '../../components/housing/shell/HousingSettingsSheet';
import { useThemeStore } from '../../store/useThemeStore';

beforeAll(() => {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: {
      ja: { translation: jaTranslations },
      en: { translation: enTranslations },
      ko: { translation: koTranslations },
      zh: { translation: zhTranslations },
      'zh-Hant': { translation: zhHantTranslations },
    },
    interpolation: { escapeValue: false },
  });
});

beforeEach(() => {
  useThemeStore.setState({ theme: 'dark' });
  i18n.changeLanguage('ja');
});

function renderSheet() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <HousingSettingsSheet isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    </I18nextProvider>
  );
}

describe('HousingSettingsSheet', () => {
  it('renders language switcher with ja/en/ko/zh/zh-Hant and marks active', () => {
    renderSheet();
    const ja = screen.getByRole('button', { name: 'ja' });
    const en = screen.getByRole('button', { name: 'en' });
    const ko = screen.getByRole('button', { name: 'ko' });
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(ja).toBeInTheDocument();
    expect(en).toBeInTheDocument();
    expect(ko).toBeInTheDocument();
    expect(zh).toBeInTheDocument();
    expect(zhHant).toBeInTheDocument();
    expect(ja.className).toContain('is-on');
  });

  it('changes language on click', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'en' }));
    expect(i18n.language).toBe('en');
  });

  it('marks only zh-Hant active (not zh) when language is zh-Hant (2026-07-28 誤判定バグの回帰テスト)', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'zh-Hant' }));
    const zh = screen.getByRole('button', { name: 'zh' });
    const zhHant = screen.getByRole('button', { name: 'zh-Hant' });
    expect(zhHant.className).toContain('is-on');
    expect(zh.className).not.toContain('is-on');
  });

  it('toggles theme on click', () => {
    renderSheet();
    const tabs = screen.getAllByRole('tab');
    const lightTab = tabs.find((el) => el.getAttribute('aria-selected') === 'false');
    fireEvent.click(lightTab!);
    expect(useThemeStore.getState().theme).toBe('light');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/__tests__/housing/HousingSettingsSheet.test.tsx
```

Expected: FAIL — `zh-Hant` という名前のボタンが見つからない

- [ ] **Step 3: 最小実装**

`src/components/housing/shell/HousingSettingsSheet.tsx` の先頭 import に追加:

```tsx
import { pickRegionLocale } from '../../../data/housing/regionMap';
```

```tsx
const LANGS = ['ja', 'en', 'ko', 'zh'] as const;
```
を
```tsx
const LANGS = ['ja', 'en', 'ko', 'zh', 'zh-Hant'] as const;
```
に変更。

```tsx
            const isActive = i18n.language === lang || i18n.language.startsWith(`${lang}-`);
```
を
```tsx
            const isActive = pickRegionLocale(i18n.language) === lang;
```
に変更。

- [ ] **Step 4: テストを実行して成功を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/__tests__/housing/HousingSettingsSheet.test.tsx
```

Expected: PASS

- [ ] **Step 5: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/components/housing/shell/HousingSettingsSheet.tsx src/__tests__/housing/HousingSettingsSheet.test.tsx
git commit -m "fix: HousingSettingsSheetの言語切替にzh-Hantを追加し誤判定を修正"
```

---

### Task 3: ログイン/アカウントモーダル23件を4言語(en/ko/zh/zh-Hant)で新規翻訳

**Files:**
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/zh-Hant.json`
- Modify: `src/locales/__tests__/zh-hant-completeness.test.ts`
- Create: `src/locales/__tests__/housing-login-account-i18n.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `housing.login_prompt.register.lead` / `housing.login.*` / `housing.account.*` / `housing.topbar.login` / `housing.topbar.account` が en/ko/zh/zh-Hant全てで非空文字列になる(Task4のレビュー対象に含まれる)

- [ ] **Step 1: 失敗するテストを書く**

`src/locales/__tests__/housing-login-account-i18n.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import ja from '../ja.json';
import en from '../en.json';
import ko from '../ko.json';
import zh from '../zh.json';
import zhHant from '../zh-Hant.json';

const PATHS = [
  'housing.login_prompt.register.lead',
  'housing.login.title',
  'housing.login.notice.intro',
  'housing.login.notice.item1',
  'housing.login.notice.item2',
  'housing.login.notice.item3',
  'housing.login.discordButton',
  'housing.login.closeLabel',
  'housing.account.title',
  'housing.account.avatarChange',
  'housing.account.avatarDelete',
  'housing.account.displayNameLabel',
  'housing.account.displayNameEdit',
  'housing.account.adminLink',
  'housing.account.signOut',
  'housing.account.deleteAccount',
  'housing.account.deleteConfirmTitle',
  'housing.account.deleteConfirmBody',
  'housing.account.deleteConfirmYes',
  'housing.account.deleteConfirmNo',
  'housing.account.closeLabel',
  'housing.topbar.login',
  'housing.topbar.account',
] as const;

function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

describe('housing ログイン/アカウント文言の多言語対応 (2026-07-28 新規23件)', () => {
  it('ja に全パスの原文が存在する(前提確認)', () => {
    for (const path of PATHS) {
      expect(getByPath(ja, path), `ja.${path}`).toBeTruthy();
    }
  });

  const others: Record<string, unknown> = { en, ko, zh, 'zh-Hant': zhHant };
  for (const lang of Object.keys(others)) {
    it(`${lang} の全パスが非空文字列である`, () => {
      for (const path of PATHS) {
        const value = getByPath(others[lang], path);
        expect(typeof value, `${lang}.${path}`).toBe('string');
        expect(value, `${lang}.${path}`).toBeTruthy();
      }
    });
  }
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/locales/__tests__/housing-login-account-i18n.test.ts
```

Expected: FAIL(en/ko/zh/zh-Hant全て空文字列のため)

- [ ] **Step 3: 4言語の翻訳をJSONに追加する**

`src/locales/en.json` の該当パスに以下の値を設定する(既存の空文字列 `""` を置き換える):

| パス | 値 |
|---|---|
| `housing.login_prompt.register.lead` | `You can register a property by logging in with Discord. Your Discord ID is stored as an irreversible hash and can never be recovered.` |
| `housing.login.title` | `Login to LoPo` |
| `housing.login.notice.intro` | `A quick request to help keep LoPo pleasant for everyone.` |
| `housing.login.notice.item1` | `To keep fake listings or harassment-driven registrations from ruining the house-hunting experience for others, we ask you to log in with Discord when registering.` |
| `housing.login.notice.item2` | `LoPo only stores a hash of your Discord ID. Because a hash cannot be converted back to the original ID, no one — including the operators — can recover your Discord ID.` |
| `housing.login.notice.item3` | `So you can feel free to tap the "Not it" button, we also keep an internal record of accounts that repeatedly file harassing reports this way. If we find an account is abusing this, we may restrict that account's access.` |
| `housing.login.discordButton` | `Login with Discord` |
| `housing.login.closeLabel` | `Close the login screen` |
| `housing.account.title` | `Account` |
| `housing.account.avatarChange` | `Change Avatar` |
| `housing.account.avatarDelete` | `Delete` |
| `housing.account.displayNameLabel` | `Display Name` |
| `housing.account.displayNameEdit` | `Edit Display Name` |
| `housing.account.adminLink` | `Go to Admin Panel` |
| `housing.account.signOut` | `Log Out` |
| `housing.account.deleteAccount` | `Delete Account` |
| `housing.account.deleteConfirmTitle` | `Are you sure you want to delete your account?` |
| `housing.account.deleteConfirmBody` | `Deleting your account will permanently remove all of your data, including registered properties, favorites, and your avatar image. This action cannot be undone.` |
| `housing.account.deleteConfirmYes` | `Delete Account` |
| `housing.account.deleteConfirmNo` | `Cancel` |
| `housing.account.closeLabel` | `Close the account screen` |
| `housing.topbar.login` | `Login` |
| `housing.topbar.account` | `Account` |

`src/locales/ko.json` の該当パスに以下の値を設定する:

| パス | 値 |
|---|---|
| `housing.login_prompt.register.lead` | `Discord 로그인으로 매물을 등록할 수 있습니다. Discord ID는 복원할 수 없는 형태(해시값)로 저장됩니다.` |
| `housing.login.title` | `LoPo에 로그인` |
| `housing.login.notice.intro` | `모두가 LoPo를 기분 좋게 이용할 수 있도록 부탁드립니다.` |
| `housing.login.notice.item1` | `허위 정보나 괴롭힘 목적의 등록으로 집 찾기가 엉망이 되지 않도록, 등록 시 Discord 로그인을 부탁드리고 있습니다.` |
| `housing.login.notice.item2` | `LoPo가 저장하는 것은 Discord ID의 해시값뿐입니다. 해시값은 원래 ID로 되돌릴 수 없는 형태이므로, 운영자를 포함한 그 누구도 Discord ID를 복원할 수 없습니다.` |
| `housing.login.notice.item3` | `"아니었어요" 버튼을 부담 없이 누를 수 있도록, 반대로 이 기능을 악용해 괴롭힘성 신고를 반복하는 계정은 내부적으로 기록하고 있습니다. 도가 지나친 행위가 확인될 경우 해당 계정의 이용을 제한할 수 있습니다.` |
| `housing.login.discordButton` | `Discord로 로그인` |
| `housing.login.closeLabel` | `로그인 화면 닫기` |
| `housing.account.title` | `계정` |
| `housing.account.avatarChange` | `아바타 변경` |
| `housing.account.avatarDelete` | `삭제` |
| `housing.account.displayNameLabel` | `표시 이름` |
| `housing.account.displayNameEdit` | `표시 이름 수정` |
| `housing.account.adminLink` | `관리 화면으로` |
| `housing.account.signOut` | `로그아웃` |
| `housing.account.deleteAccount` | `계정 삭제` |
| `housing.account.deleteConfirmTitle` | `정말 계정을 삭제하시겠습니까?` |
| `housing.account.deleteConfirmBody` | `계정을 삭제하면 등록한 매물, 즐겨찾기, 아바타 이미지 등 모든 데이터가 완전히 삭제됩니다. 이 작업은 되돌릴 수 없습니다.` |
| `housing.account.deleteConfirmYes` | `계정 삭제` |
| `housing.account.deleteConfirmNo` | `취소` |
| `housing.account.closeLabel` | `계정 화면 닫기` |
| `housing.topbar.login` | `로그인` |
| `housing.topbar.account` | `계정` |

`src/locales/zh.json` の該当パスに以下の値を設定する:

| パス | 値 |
|---|---|
| `housing.login_prompt.register.lead` | `通过 Discord 登录即可注册房屋。Discord ID 将以无法还原的形式（哈希值）保存。` |
| `housing.login.title` | `登录 LoPo` |
| `housing.login.notice.intro` | `为了让大家都能愉快地使用 LoPo，有一件事想请您配合。` |
| `housing.login.notice.item1` | `为了避免虚假信息或恶意骚扰性质的登记毁掉大家找房的体验，注册时需要通过 Discord 登录。` |
| `housing.login.notice.item2` | `LoPo 保存的仅是 Discord ID 的哈希值。哈希值无法还原为原始 ID，因此包括运营者在内的任何人都无法复原 Discord ID。` |
| `housing.login.notice.item3` | `为了让大家可以放心地按下「不是这个」按钮，我们也会在后台记录反复利用此功能进行骚扰性举报的账号。若确认有过度行为，可能会限制该账号的使用。` |
| `housing.login.discordButton` | `使用 Discord 登录` |
| `housing.login.closeLabel` | `关闭登录界面` |
| `housing.account.title` | `账户` |
| `housing.account.avatarChange` | `更改头像` |
| `housing.account.avatarDelete` | `删除` |
| `housing.account.displayNameLabel` | `显示名称` |
| `housing.account.displayNameEdit` | `编辑显示名称` |
| `housing.account.adminLink` | `前往管理页面` |
| `housing.account.signOut` | `退出登录` |
| `housing.account.deleteAccount` | `删除账户` |
| `housing.account.deleteConfirmTitle` | `确定要删除账户吗？` |
| `housing.account.deleteConfirmBody` | `删除账户后，您注册的房屋、收藏、头像图片等所有数据都将被彻底删除。此操作无法撤销。` |
| `housing.account.deleteConfirmYes` | `删除账户` |
| `housing.account.deleteConfirmNo` | `取消` |
| `housing.account.closeLabel` | `关闭账户界面` |
| `housing.topbar.login` | `登录` |
| `housing.topbar.account` | `账户` |

`src/locales/zh-Hant.json` の該当パスに以下の値を設定する:

| パス | 値 |
|---|---|
| `housing.login_prompt.register.lead` | `透過 Discord 登入即可註冊房屋。Discord ID 將以無法還原的形式（雜湊值）保存。` |
| `housing.login.title` | `登入 LoPo` |
| `housing.login.notice.intro` | `為了讓大家都能愉快地使用 LoPo，有一件事想請您配合。` |
| `housing.login.notice.item1` | `為了避免虛假資訊或惡意騷擾性質的登記毀掉大家找房的體驗，註冊時需要透過 Discord 登入。` |
| `housing.login.notice.item2` | `LoPo 保存的僅是 Discord ID 的雜湊值。雜湊值無法還原為原始 ID，因此包括運營者在內的任何人都無法復原 Discord ID。` |
| `housing.login.notice.item3` | `為了讓大家可以放心地按下「不是這個」按鈕，我們也會在後台記錄反覆利用此功能進行騷擾性檢舉的帳號。若確認有過度行為，可能會限制該帳號的使用。` |
| `housing.login.discordButton` | `使用 Discord 登入` |
| `housing.login.closeLabel` | `關閉登入介面` |
| `housing.account.title` | `賬戶` |
| `housing.account.avatarChange` | `更改頭像` |
| `housing.account.avatarDelete` | `刪除` |
| `housing.account.displayNameLabel` | `顯示名稱` |
| `housing.account.displayNameEdit` | `編輯顯示名稱` |
| `housing.account.adminLink` | `前往管理頁面` |
| `housing.account.signOut` | `退出登入` |
| `housing.account.deleteAccount` | `刪除賬戶` |
| `housing.account.deleteConfirmTitle` | `確定要刪除賬戶嗎？` |
| `housing.account.deleteConfirmBody` | `刪除賬戶後，您註冊的房屋、收藏、頭像圖片等所有資料都將被徹底刪除。此操作無法復原。` |
| `housing.account.deleteConfirmYes` | `刪除賬戶` |
| `housing.account.deleteConfirmNo` | `取消` |
| `housing.account.closeLabel` | `關閉賬戶介面` |
| `housing.topbar.login` | `登入` |
| `housing.topbar.account` | `賬戶` |

各JSONファイルは該当パスの値だけを書き換える部分編集で行うこと(ファイル全体のparse→再stringifyは禁止。フォーマットや既存キー順が崩れる)。

- [ ] **Step 4: `zh-hant-completeness.test.ts` の `KNOWN_EMPTY_PATHS` から該当23件を削除する**

`src/locales/__tests__/zh-hant-completeness.test.ts` の `KNOWN_EMPTY_PATHS` 配列を空配列にする(23件全てがこのタスクで埋まるため)。あわせて配列直前のコメントも実情に合わせて更新する:

```ts
// 2026-07-28 フェーズ③で housing.login/account 系23件を含め全て翻訳済みになったため空配列
const KNOWN_EMPTY_PATHS: readonly string[] = [
] as const;
```

- [ ] **Step 5: テストを実行して成功を確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/locales/__tests__/housing-login-account-i18n.test.ts src/locales/__tests__/zh-hant-completeness.test.ts
```

Expected: PASS(両ファイルとも全件成功)

- [ ] **Step 6: コミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add src/locales/en.json src/locales/ko.json src/locales/zh.json src/locales/zh-Hant.json src/locales/__tests__/zh-hant-completeness.test.ts src/locales/__tests__/housing-login-account-i18n.test.ts
git commit -m "feat: ハウジングのログイン/アカウント文言23件をen/ko/zh/zh-Hantで新規翻訳"
```

---

### Task 4: housing.* 文言764件の繁体字レビュー

**Files:**
- Modify: `src/locales/zh-Hant.json`(housing名前空間のみ)

**Interfaces:**
- Consumes: Task3で追加された23件を含む、`housing`名前空間の全764件(zh.jsonとzh-Hant.json)
- Produces: なし(最終レビューで変更差分を確認)

**背景:** `zh-Hant.json`の`housing`名前空間は、フェーズ②で`zh.json`から機械的に簡体字→繁体字変換をかけて作成されたもの(文字体系の変換のみ)。中身の自然さ・大陸中国語特有の言い回いが残っていないかは未チェックのまま。本タスクで全764件を実際に読んで確認・修正する。

- [ ] **Step 1: zh/zh-Hantの全764件を書き出す**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
node -e "
const zh = require('./src/locales/zh.json');
const zhHant = require('./src/locales/zh-Hant.json');
function flatten(obj, prefix) {
  let out = {};
  for (const [k,v] of Object.entries(obj)) {
    const p = prefix ? prefix+'.'+k : k;
    if (typeof v === 'string') out[p] = v;
    else if (v && typeof v === 'object') Object.assign(out, flatten(v, p));
  }
  return out;
}
const zhFlat = flatten(zh.housing, 'housing');
const zhHantFlat = flatten(zhHant.housing, 'housing');
const lines = [];
for (const k of Object.keys(zhFlat)) {
  lines.push(k + ' ||| ' + zhFlat[k] + ' ||| ' + (zhHantFlat[k] ?? '(MISSING)'));
}
require('fs').writeFileSync('docs/.private/2026-07-28-phase3-housing-zh-hant-review-dump.txt', lines.join('\n'));
console.log('total lines:', lines.length);
"
```

このコマンドは`docs/.private/2026-07-28-phase3-housing-zh-hant-review-dump.txt`に「キーパス ||| zh(簡体字) ||| zh-Hant(繁体字)」形式で764行を書き出す(このファイルは作業用の一時ファイルで、`docs/.private/`は既にgitignore対象)。

- [ ] **Step 2: 33サブセクションを1つずつレビューする**

書き出したファイルをReadツールで(offset/limitを使って適量ずつ)読み、以下の33サブセクション全てについて、キーパスの接頭辞(`housing.coming_soon.*`等)ごとに zh と zh-Hant を突き合わせて確認する:

`coming_soon, mypage_coming_soon, card, tray, ephemeral, favStrip, ad, browse, map, tabs, placeholder, register, duplicate, onboarding, login_prompt, tag, workspace, login, account, housinger, mypage, header, topbar, mobile, gallery, detail, edit, delete, report, guide, favorites, notifications, tour`

各項目について確認する観点:
1. 簡体字の文字が変換し忘れで残っていないか(例: 简体字の「们」「说」等の簡体字特有字形)
2. 大陸中国語特有の語彙・言い回しで、台湾では通常使われない表現になっていないか(例: サーバー関連・IT用語・日常語彙の大陸/台湾差)
3. `{{変数名}}`のようなi18next補間プレースホルダーが壊れていないか(変換で括弧や変数名自体が変化していないか)
4. 意味が通る自然な繁体字の文になっているか(直訳的すぎておかしい箇所がないか)

問題を見つけたら、Editツールで`src/locales/zh-Hant.json`の該当パスの値だけを修正する。

- [ ] **Step 3: 修正内容を実装レポート用に記録する**

レビューの結果、何件中何件を修正したか、修正した代表的な例(パスと修正前後)を記録しておく(最終レビュー時にユーザーへ報告するため)。

- [ ] **Step 4: 既存テストスイートを実行し、構造が壊れていないことを確認する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run src/locales/__tests__/ src/components/housing/
```

Expected: PASS(全件。特に`zh-hant-completeness.test.ts`と各`i18nParity.test.ts`)

- [ ] **Step 5: 一時ファイルを削除してコミット**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
rm docs/.private/2026-07-28-phase3-housing-zh-hant-review-dump.txt
git add src/locales/zh-Hant.json
git commit -m "fix: housing.*文言764件の繁体字を全件レビューし不自然な箇所を修正"
```

---

### Task 5: 全体回帰確認(フルゲート)

**Files:** なし(検証のみ)

**Interfaces:**
- Consumes: Task1〜4の全成果
- Produces: なし

- [ ] **Step 1: ビルドを実行する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npm run build
```

Expected: 成功(exit code 0)。型拡張やimport追加で新たなTypeScriptエラーが出た場合はこの場で対応する。

- [ ] **Step 2: テストスイート全体を実行する**

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
npx vitest run
```

Expected: 既存の既知失敗5件(TopBar4+HousingWorkspace1、TODO.mdに記載済みの撤去予定分)を除き全件PASS。新規に失敗が増えていないことを確認する。

- [ ] **Step 3: 日本語・英語・韓国語・簡体字ユーザーの表示が変わっていないことを目視確認する**

`git diff` で Task1〜4 の差分を再確認し、既存言語(ja/en/ko/zh)の値を変更していないこと(zh-Hant.json以外のJSON編集はTask3の23件追加のみであること)を確認する。

- [ ] **Step 4: 最終コミット(必要な場合のみ)**

Step1でビルドエラー対応が発生した場合のみ、その修正をコミットする:

```bash
cd "C:\Users\masay\Desktop\FF14Sim\.claude\worktrees\housing-taiwan-region-support"
git add -A
git commit -m "fix: フェーズ③ビルドエラー対応"
```
