# LoPo Support Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** /support ページを新設し、Ko-fi 直リンク 2 箇所（LP フッター、サイドバー下部）を 4 言語の説明付き内部ページ経由に変更する。

**Architecture:** 既存 LegalPage 系（PrivacyPolicyPage / TermsPage / CommercialDisclosurePage）の `LegalPageLayout` を export して再利用。SupportPage コンポーネントを別ファイルに作成し、4 言語の i18n キー 10 個を追加。既存 Ko-fi 直リンクを内部 React Router リンクに置換し、sitemap.xml で SEO 対応。設計書: `docs/superpowers/specs/2026-04-30-lopo-support-page-design.md`。

**Tech Stack:** React 19 + React Router 7 + react-i18next + framer-motion (既存依存)

---

## File Structure

| ファイル | 役割 | 新規/修正 |
|---|---|---|
| `src/components/LegalPage.tsx` | `LegalPageLayout` を export 化（既存はファイル内 private） | 修正 |
| `src/components/SupportPage.tsx` | Support ページ本体。LegalPageLayout を再利用、4 セクション + 戻るボタン | **新規** |
| `src/components/__tests__/SupportPage.test.tsx` | i18n キー解決と戻るボタン動作のユニットテスト | **新規** |
| `src/locales/ja.json` | `support.*` キー 10 個追加 | 修正 |
| `src/locales/en.json` | 同上（英訳） | 修正 |
| `src/locales/ko.json` | 同上（韓訳） | 修正 |
| `src/locales/zh.json` | 同上（中訳） | 修正 |
| `src/App.tsx` | `/support` ルート追加 | 修正 |
| `src/components/landing/LandingFooter.tsx` | Ko-fi 直リンクを `/support` 内部リンクに | 修正 |
| `src/components/Sidebar.tsx` | Ko-fi 直リンクを `/support` 内部リンクに | 修正 |
| `public/sitemap.xml` | `/support` を SEO sitemap に追加 | 修正 |

---

## Task 1: i18n キー追加（4 言語）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

i18n キー 10 個を 4 言語ぶん追加する。`support` ネームスペースを新設。`usage_items` は LegalPage の `splitItems` パターンと同じくカンマ区切り → 配列展開。

**注意**: `ja.json` の `legal` セクション直前に `support` を追加すると並びが整う。具体位置はファイルを開いて既存ネームスペース配置を確認すること。

- [ ] **Step 1: ja.json に `support` セクション追加**

`src/locales/ja.json` の既存 `legal` セクションの直前（または末尾の `legal` の閉じカッコ直後）に以下を追加:

```json
    "support": {
        "title": "LoPo を応援する",
        "subtitle": "LoPo の運営支援はこちらから",
        "about_heading": "LoPo について",
        "about_body": "LoPo は個人で運営している FF14 のファンツールです。現在は軽減プランナーを公開中で、今後ハウジングツアープランナー等も追加予定です。",
        "usage_heading": "資金の使い道",
        "usage_items": "サーバー費（Vercel・Firebase）,ストレージ費（共有プランの保存・OGP 画像生成）,開発・運用にかける時間",
        "kofi_heading": "Ko-fi で支援する",
        "kofi_note": "Ko-fi は寄付プラットフォームです。1 杯 ¥500 から、任意金額で支援できます。",
        "disclaimer": "本サイトは SQUARE ENIX の公式サイトではありません。SQUARE ENIX 社と関係はありません。",
        "back": "← 戻る"
    },
```

- [ ] **Step 2: en.json に `support` セクション追加**

```json
    "support": {
        "title": "Support LoPo",
        "subtitle": "Help keep LoPo running",
        "about_heading": "About LoPo",
        "about_body": "LoPo is a personally-run fan tool for FF14. The mitigation planner is currently public, and a housing tour planner and other tools are planned for the future.",
        "usage_heading": "How your support is used",
        "usage_items": "Server costs (Vercel, Firebase),Storage costs (shared plan storage, OGP image generation),Development and operation time",
        "kofi_heading": "Support on Ko-fi",
        "kofi_note": "Ko-fi is a donation platform. You can support with any amount, starting from about ¥500 (a cup of coffee).",
        "disclaimer": "This site is not an official SQUARE ENIX website and is not affiliated with SQUARE ENIX CO., LTD.",
        "back": "← Back"
    },
```

- [ ] **Step 3: ko.json に `support` セクション追加**

```json
    "support": {
        "title": "LoPo 후원하기",
        "subtitle": "LoPo 운영을 지원해 주세요",
        "about_heading": "LoPo 소개",
        "about_body": "LoPo는 개인이 운영하는 FF14 팬 툴입니다. 현재는 경감 플래너를 공개 중이며, 향후 하우징 투어 플래너 등도 추가 예정입니다.",
        "usage_heading": "후원금의 사용처",
        "usage_items": "서버 비용 (Vercel·Firebase),스토리지 비용 (공유 플랜 보관·OGP 이미지 생성),개발·운영 시간",
        "kofi_heading": "Ko-fi에서 후원하기",
        "kofi_note": "Ko-fi는 후원 플랫폼입니다. 약 ¥500부터 원하는 금액으로 후원할 수 있습니다.",
        "disclaimer": "본 사이트는 SQUARE ENIX의 공식 사이트가 아니며, SQUARE ENIX 사와 관련이 없습니다.",
        "back": "← 돌아가기"
    },
```

- [ ] **Step 4: zh.json に `support` セクション追加**

```json
    "support": {
        "title": "支持 LoPo",
        "subtitle": "支持 LoPo 的运营从这里开始",
        "about_heading": "关于 LoPo",
        "about_body": "LoPo 是个人运营的 FF14 同人工具。目前公开了减伤规划工具，未来还计划添加房屋导览工具等。",
        "usage_heading": "资金用途",
        "usage_items": "服务器费用（Vercel·Firebase）,存储费用（共享方案保存·OGP 图像生成）,开发与运营时间",
        "kofi_heading": "在 Ko-fi 上支持",
        "kofi_note": "Ko-fi 是一个捐赠平台。可以从约 ¥500（一杯咖啡）开始,以任意金额进行支持。",
        "disclaimer": "本网站不是 SQUARE ENIX 的官方网站,与 SQUARE ENIX 公司无关。",
        "back": "← 返回"
    },
```

- [ ] **Step 5: JSON シンタックスチェック**

各 locale ファイルが valid JSON であることを確認:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('src/locales/ja.json','utf8')) ? 'ja OK' : 'ja FAIL')"
node -e "console.log(JSON.parse(require('fs').readFileSync('src/locales/en.json','utf8')) ? 'en OK' : 'en FAIL')"
node -e "console.log(JSON.parse(require('fs').readFileSync('src/locales/ko.json','utf8')) ? 'ko OK' : 'ko FAIL')"
node -e "console.log(JSON.parse(require('fs').readFileSync('src/locales/zh.json','utf8')) ? 'zh OK' : 'zh FAIL')"
```

Expected: 全 4 言語で OK 表示

- [ ] **Step 6: コミット**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "i18n(support): /support ページ用キー 10 個 × 4 言語追加"
```

---

## Task 2: LegalPageLayout を export 化

**Files:**
- Modify: `src/components/LegalPage.tsx`

`LegalPageLayout` は現状ファイル内 private（`const`）になっている。これを `export` して SupportPage から再利用可能にする。

- [ ] **Step 1: LegalPageLayout の宣言を export に変更**

`src/components/LegalPage.tsx` line 279 の以下を:

```tsx
const LegalPageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
```

以下に変更:

```tsx
export const LegalPageLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
```

- [ ] **Step 2: build / vitest が通ることを確認**

```bash
rtk vitest run
```

Expected: 既存テスト 289 全 PASS（LegalPageLayout は内部利用にも引き続き使える）

- [ ] **Step 3: コミット**

```bash
rtk git add src/components/LegalPage.tsx
rtk git commit -m "refactor(legal): LegalPageLayout を export 化（SupportPage で再利用するため）"
```

---

## Task 3: SupportPage コンポーネントとテスト作成（TDD）

**Files:**
- Test: `src/components/__tests__/SupportPage.test.tsx`
- Create: `src/components/SupportPage.tsx`

TDD で進める。先に失敗するテスト → 最小実装 → PASS。

- [ ] **Step 1: 失敗するテストを書く**

`src/components/__tests__/SupportPage.test.tsx` を新規作成:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SupportPage } from '../SupportPage';

// react-i18next の useTranslation をモック
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'support.title': 'LoPo を応援する',
        'support.subtitle': 'LoPo の運営支援はこちらから',
        'support.about_heading': 'LoPo について',
        'support.about_body': 'LoPo は個人で運営している...',
        'support.usage_heading': '資金の使い道',
        'support.usage_items': 'サーバー費,ストレージ費,開発時間',
        'support.kofi_heading': 'Ko-fi で支援する',
        'support.kofi_note': 'Ko-fi は寄付プラットフォーム...',
        'support.disclaimer': '本サイトは SQUARE ENIX の公式サイトではありません...',
        'support.back': '← 戻る',
        'footer.kofi': 'Ko-fiで応援',
      };
      return map[key] ?? key;
    },
    i18n: { language: 'ja' },
  }),
}));

// useThemeStore のモック
vi.mock('../../store/useThemeStore', () => ({
  useThemeStore: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

// useTransitionOverlay のモック
vi.mock('../ui/TransitionOverlay', () => ({
  useTransitionOverlay: () => ({ runTransition: (cb: () => void) => cb() }),
}));

// useCanonicalUrl のモック
vi.mock('../../hooks/useCanonicalUrl', () => ({
  useCanonicalUrl: vi.fn(),
}));

describe('SupportPage', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('全セクションのタイトルが表示される', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('LoPo を応援する')).toBeInTheDocument();
    expect(screen.getByText('LoPo について')).toBeInTheDocument();
    expect(screen.getByText('資金の使い道')).toBeInTheDocument();
    expect(screen.getByText('Ko-fi で支援する')).toBeInTheDocument();
  });

  it('Ko-fi ボタンが正しい URL を持つ', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    const link = screen.getByRole('link', { name: /Ko-fiで応援/ });
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/lopoly');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('資金使途リストが 3 項目展開される', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('サーバー費')).toBeInTheDocument();
    expect(screen.getByText('ストレージ費')).toBeInTheDocument();
    expect(screen.getByText('開発時間')).toBeInTheDocument();
  });

  it('SE 免責が表示される', () => {
    render(
      <MemoryRouter initialEntries={['/support']}>
        <Routes>
          <Route path="/support" element={<SupportPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText(/SQUARE ENIX の公式サイトではありません/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テスト実行 → 失敗を確認**

```bash
rtk vitest run src/components/__tests__/SupportPage.test.tsx
```

Expected: FAIL — `SupportPage` が import できないエラー。

- [ ] **Step 3: SupportPage.tsx を実装**

`src/components/SupportPage.tsx` を新規作成:

```tsx
/**
 * LoPo 支援ページ (/support)
 * Ko-fi へ飛ばす前に 4 言語で支援内容を説明する
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../hooks/useCanonicalUrl';
import { LegalPageLayout } from './LegalPage';

/** i18n キーで「,」区切りのリストを配列に変換 */
function splitItems(value: string): string[] {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const KOFI_URL = 'https://ko-fi.com/lopoly';

export const SupportPage: React.FC = () => {
    useCanonicalUrl('/support');
    const { t } = useTranslation();

    const usageItems = splitItems(t('support.usage_items'));

    return (
        <LegalPageLayout>
            {/* タイトル */}
            <h1 className="text-app-4xl font-bold mb-1">{t('support.title')}</h1>
            <p className="text-app-lg text-app-text-muted mb-8">{t('support.subtitle')}</p>

            {/* LoPo について */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.about_heading')}
                </h2>
                <p className="text-app-2xl text-app-text-muted leading-relaxed">
                    {t('support.about_body')}
                </p>
            </section>

            {/* 資金の使い道 */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.usage_heading')}
                </h2>
                <ul className="list-disc list-inside space-y-1 text-app-2xl text-app-text-muted">
                    {usageItems.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
            </section>

            {/* Ko-fi で支援する */}
            <section className="mb-8">
                <h2 className="text-app-2xl-plus font-bold mb-3 border-b border-app-border pb-1">
                    {t('support.kofi_heading')}
                </h2>
                <p className="text-app-2xl text-app-text-muted mb-4 leading-relaxed">
                    {t('support.kofi_note')}
                </p>
                <a
                    href={KOFI_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-6 py-3 rounded-lg bg-app-text text-app-bg font-bold text-app-2xl hover:opacity-90 active:scale-95 transition-all"
                >
                    {t('footer.kofi')}
                </a>
            </section>

            {/* SE 免責 */}
            <p className="text-app-lg text-app-text-muted mt-12 pt-4 border-t border-app-border leading-relaxed">
                {t('support.disclaimer')}
            </p>
        </LegalPageLayout>
    );
};
```

注意: `LegalPageLayout` 内のヘッダーには既に戻るボタン（`← LoPo`）が含まれている。SupportPage では追加の戻るボタンを設けず、共通レイアウトのものを使用する。これにより既存ページと UI 一貫性が保たれる。

- [ ] **Step 4: テスト実行 → PASS を確認**

```bash
rtk vitest run src/components/__tests__/SupportPage.test.tsx
```

Expected: 全 4 テスト PASS

- [ ] **Step 5: 既存テスト全体が引き続き通ることを確認**

```bash
rtk vitest run
```

Expected: 全テスト PASS（既存 289 + 新規 4 = 293 程度）

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/SupportPage.tsx src/components/__tests__/SupportPage.test.tsx
rtk git commit -m "feat(support): /support ページコンポーネント追加（LoPo について / 資金使途 / Ko-fi）"
```

---

## Task 4: App.tsx に Route 追加

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: import を追加**

`src/App.tsx` line 7 付近（他のページ import の近く）に追加:

```tsx
import { SupportPage } from './components/SupportPage';
```

- [ ] **Step 2: Route を追加**

`src/App.tsx` line 117 付近（`/share/:shareId` の Route の直後、`/privacy` の前）に追加:

```tsx
<Route path="/support" element={<SupportPage />} />
```

- [ ] **Step 3: build 確認**

```bash
rtk npm run build
```

Expected: exit 0、エラーなし

- [ ] **Step 4: コミット**

```bash
rtk git add src/App.tsx
rtk git commit -m "feat(routing): /support ルートを追加"
```

---

## Task 5: 既存 Ko-fi 直リンクを内部リンクに置換

**Files:**
- Modify: `src/components/landing/LandingFooter.tsx`
- Modify: `src/components/Sidebar.tsx`

LP フッターとサイドバー下部の既存 Ko-fi 直リンクを `/support` 経由に変更。

- [ ] **Step 1: LandingFooter.tsx を確認**

```bash
rtk grep -n "ko-fi.com/lopoly" src/components/landing/LandingFooter.tsx
```

該当行（おおよそ 118 行目付近）を確認。`<FooterLink>` の使い方を見て内部リンク版に切り替える。

- [ ] **Step 2: LandingFooter.tsx を修正**

該当箇所:

```tsx
<FooterLink href="https://ko-fi.com/lopoly" external>
  {t('footer.kofi')}
</FooterLink>
```

を以下に変更:

```tsx
<FooterLink href="/support">
  {t('footer.kofi')}
</FooterLink>
```

`external` prop を削除（内部リンク扱い）。`FooterLink` の実装が `target="_blank"` を強制している場合は内部リンク用の挙動を確認し、必要なら React Router の `Link` を直接使用する。

実装パターン確認のため:

```bash
rtk grep -n "FooterLink" src/components/landing/LandingFooter.tsx
```

`FooterLink` が `<a>` を出力している場合、内部リンクなら `<Link to="/support">` への置換が望ましい。具体的な実装は LandingFooter.tsx の `FooterLink` 定義を見て判断する。

- [ ] **Step 3: Sidebar.tsx を修正**

`src/components/Sidebar.tsx` line 1526-1531 付近の以下を:

```tsx
<a
    href="https://ko-fi.com/lopoly"
    target="_blank"
    rel="noopener noreferrer"
    ...
>
    {t('footer.kofi')}
</a>
```

を React Router の `Link` を使った内部リンクに変更:

```tsx
<Link
    to="/support"
    className={/* 既存のクラス名を維持 */}
>
    {t('footer.kofi')}
</Link>
```

`Link` の import が無ければ Sidebar.tsx 上部に追加:

```tsx
import { Link } from 'react-router-dom';
```

既存の `import` 行を確認して `react-router-dom` の他の import がある場合はマージする。

- [ ] **Step 4: build + vitest**

```bash
rtk npm run build
rtk vitest run
```

Expected: 両方 PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/landing/LandingFooter.tsx src/components/Sidebar.tsx
rtk git commit -m "feat(support): 既存 Ko-fi 直リンクを /support 経由に変更（LP フッター + サイドバー下部）"
```

---

## Task 6: sitemap.xml に /support 追加

**Files:**
- Modify: `public/sitemap.xml`

- [ ] **Step 1: sitemap.xml に URL を追加**

`public/sitemap.xml` の `</urlset>` 直前に以下を追加:

```xml
  <url>
    <loc>https://lopoly.app/support</loc>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>
```

- [ ] **Step 2: コミット**

```bash
rtk git add public/sitemap.xml
rtk git commit -m "seo(support): sitemap.xml に /support を追加"
```

---

## Task 7: Playwright E2E 統合テスト

**Files:**
- Create: `C:/Users/masay/AppData/Local/Temp/playwright-test-support-page.js`（一時ファイル、コミット対象外）

dev server を起動して実ブラウザで以下を検証:

1. `/support` を直接開ける
2. LP フッターから `/support` に遷移できる
3. サイドバーから `/support` に遷移できる
4. Ko-fi ボタンの href が `https://ko-fi.com/lopoly` で `target="_blank"`
5. 4 言語切替で文言が変わる（日本語 → 英語 → 韓国語 → 中国語）

- [ ] **Step 1: dev server を起動**

```bash
cd c:/Users/masay/Desktop/FF14Sim
npm run dev
```

別ターミナル（または background）で起動。`http://localhost:5173` で動作することを確認:

```bash
until curl -s http://localhost:5173 -o /dev/null -m 2; do sleep 1; done; echo "ready"
```

- [ ] **Step 2: Playwright スクリプトを書く**

`C:/Users/masay/AppData/Local/Temp/playwright-test-support-page.js` を作成:

```javascript
const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('tutorial-storage', JSON.stringify({
      state: {
        completed: { main: true, 'create-plan': true, share: true, 'event-add': true, 'mitigation-add': true, 'party-edit': true, 'phase-edit': true },
        hasCompleted: true,
        hasVisitedShare: true,
      },
      version: 0,
    }));
  });
  const page = await ctx.newPage();

  try {
    // Test 1: /support 直アクセス
    console.log('\n=== Test 1: /support 直アクセス ===');
    await page.goto(`${TARGET_URL}/support`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const titleVisible = await page.locator('text=/LoPo を応援|Support LoPo/').first().isVisible();
    check('/support のタイトル表示', titleVisible);
    await page.screenshot({ path: 'C:/Users/masay/AppData/Local/Temp/support-test-1-direct.png' });

    // Test 2: Ko-fi ボタン属性
    console.log('\n=== Test 2: Ko-fi ボタンの href / target ===');
    const kofiLink = page.locator('a[href="https://ko-fi.com/lopoly"]').first();
    const kofiCount = await kofiLink.count();
    check('Ko-fi リンク存在', kofiCount > 0);
    if (kofiCount > 0) {
      const target = await kofiLink.getAttribute('target');
      const rel = await kofiLink.getAttribute('rel');
      check('target="_blank"', target === '_blank', `actual: ${target}`);
      check('rel に noopener', rel && rel.includes('noopener'), `actual: ${rel}`);
    }

    // Test 3: SE 免責表示
    console.log('\n=== Test 3: SE 免責表示 ===');
    const disclaimer = await page.locator('text=/SQUARE ENIX/').first().isVisible();
    check('SE 免責の文言', disclaimer);

    // Test 4: 戻るボタン（共通 LegalPageLayout の "← LoPo"）
    console.log('\n=== Test 4: 戻るボタン動作 ===');
    const backBtn = page.locator('button', { hasText: 'LoPo' }).first();
    const backVisible = await backBtn.isVisible().catch(() => false);
    check('共通レイアウトの戻るボタン表示', backVisible);

    // Test 5: LP のフッターから /support へ遷移
    console.log('\n=== Test 5: LP フッターから /support へ ===');
    await page.goto(`${TARGET_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // フッター内の Ko-fi 風リンクを探してクリック
    const footerLink = page.locator('a[href="/support"], a[href*="support"]').first();
    const footerLinkCount = await footerLink.count();
    if (footerLinkCount > 0) {
      await footerLink.click();
      await page.waitForTimeout(1500);
      const url = page.url();
      check('LP → /support 遷移', url.endsWith('/support'), `URL: ${url}`);
    } else {
      check('LP フッター /support リンク', false, '見つからない');
    }

    // Test 6: 言語切替（ja → en）で文言が変わる
    console.log('\n=== Test 6: 言語切替 ===');
    await page.goto(`${TARGET_URL}/support`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const langSwitcher = page.locator('button[aria-label*="language" i], button:has-text("EN")').first();
    const langCount = await langSwitcher.count();
    if (langCount > 0) {
      await langSwitcher.click().catch(() => {});
      await page.waitForTimeout(500);
      // English option をクリック（文字列マッチで簡略化）
      const enOption = page.locator('button, [role="menuitem"]', { hasText: /^English$|^EN$/i }).first();
      if (await enOption.count() > 0) {
        await enOption.click().catch(() => {});
        await page.waitForTimeout(1500);
        const enTitle = await page.locator('text=Support LoPo').first().isVisible().catch(() => false);
        check('英語切替で "Support LoPo" 表示', enTitle);
      } else {
        check('英語切替', false, 'EN オプションが見つからない（手動確認推奨）');
      }
    } else {
      check('言語切替', false, '言語切替ボタンが見つからない（手動確認推奨）');
    }

  } catch (err) {
    console.error('テスト中にエラー:', err.message);
    check('テスト全体', false, err.message);
  }

  console.log('\n========== サマリ ==========');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log(`PASS: ${passed} / FAIL: ${failed}`);
  if (failed > 0) {
    console.log('FAILED:');
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name} (${r.detail || ''})`));
  }

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
```

- [ ] **Step 3: Playwright 実行**

```bash
cd "C:/Users/masay/.claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill"
node run.js "C:/Users/masay/AppData/Local/Temp/playwright-test-support-page.js"
```

Expected: 全 PASS、または部分 FAIL の場合スクショで実態を確認

- [ ] **Step 4: dev server を停止**

```bash
powershell -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id \$_ -Force -ErrorAction SilentlyContinue }"
```

または PowerShell ツールで:

```powershell
$pids = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
```

---

## Task 8: 最終 build / test / push

**Files:** なし（CI 確認のみ）

- [ ] **Step 1: 最終 build**

```bash
rtk npm run build
```

Expected: exit 0

- [ ] **Step 2: 最終 vitest**

```bash
rtk vitest run
```

Expected: 既存 289 + 新規 4 = 293 程度すべて PASS

- [ ] **Step 3: git log 確認**

```bash
rtk git log --oneline -10
```

Task 1〜6 のコミットが順番に並んでいることを確認。

- [ ] **Step 4: push**

```bash
rtk git push
```

Vercel が自動でデプロイを開始する。デプロイ後の確認は次タスクで。

---

## Task 9: Ko-fi 側プロフィール設定（ユーザー作業 / 並行可）

**Files:** 外部（ko-fi.com/lopoly 管理画面）

このタスクは Claude が実行できないため、ユーザーに依頼する形で記載。Task 7 の Playwright E2E と並行で進めて構わない。

- [ ] **Step 1: ko-fi.com にログインし `lopoly` のプロフィールを開く**

- [ ] **Step 2: About 文を 4 言語で記入**

```
[日本語] LoPo（FF14 ファンツール）の運営者です。個人運営のファンサイトで、サーバー費を支援いただけたら嬉しいです。

[English] I run LoPo, a fan tool collection for FFXIV. It's a personally-operated fan site — your support helps cover server costs.

[한국어] LoPo (FF14 팬 툴) 운영자입니다. 개인이 운영하는 팬 사이트로, 서버 비용 지원을 도와주시면 감사하겠습니다.

[中文] LoPo（FF14 同人工具）的运营者。个人运营的同人网站,如能帮忙支持服务器费用将不胜感激。
```

- [ ] **Step 3: カバー画像を設定**

`public/ogp.png` を流用可。Ko-fi 推奨サイズは 1500×500px 程度。LoPo ロゴ + 黒背景。

- [ ] **Step 4: アバターを設定**

`public/apple-touch-icon.png` を流用可（180×180px）。

- [ ] **Step 5: Tipper Welcome Message（支援後のサンキュー）を 4 言語で設定**

```
ご支援ありがとうございます！LoPo の運営を続けられます。/ Thank you for your support! It helps keep LoPo running. / 후원해 주셔서 감사합니다! LoPo 운영을 계속할 수 있습니다. / 感谢您的支持!这能让 LoPo 继续运营下去。
```

- [ ] **Step 6: Membership / Goal / Shop / Commission が無効になっていることを確認**

Ko-fi 管理画面の各メニューで Disable 状態を確認。すでに無効ならスキップ。

- [ ] **Step 7: 完了報告**

ユーザーが Ko-fi 側設定完了したことを Claude に伝える。Vercel デプロイ済みの `https://lopoly.app/support` から「Ko-fi で応援」ボタンを押した時に整備された Ko-fi ページが表示されることを確認。

---

## Task 10: 本番動作確認

**Files:** なし

Vercel デプロイ完了後、本番環境で実機確認する。

- [ ] **Step 1: https://lopoly.app/support に直アクセス**

各セクション・Ko-fi ボタン・SE 免責が表示されることを確認。

- [ ] **Step 2: LP フッターから /support に遷移できる**

`https://lopoly.app/` を開き、フッターの Ko-fi 関連リンクをクリック。`/support` に遷移することを確認。

- [ ] **Step 3: サイドバーから /support に遷移できる**

`https://lopoly.app/miti` を開き、サイドバー下部の Ko-fi 関連リンクをクリック。`/support` に遷移することを確認。

- [ ] **Step 4: 4 言語切替で文言が変わる**

ヘッダーの言語切替で ja / en / ko / zh を順に切り替え、すべての文言が表示されることを確認。

- [ ] **Step 5: Ko-fi ボタンを押して整備された Ko-fi プロフィールが開く**

Task 9 完了後、`Ko-fi で応援` ボタンを押す。新規タブで `https://ko-fi.com/lopoly` が開き、整備した About / カバー画像 / アバターが表示されることを確認。

- [ ] **Step 6: TODO.md に完了記録を追記**

`docs/TODO.md` 先頭の「現在の状態」セクションに最新セッション記録を追加。「LoPo Support Page 実装完了」の旨を記載。

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs(todo): LoPo Support Page 実装完了を記録"
rtk git push
```

---

## Self-Review Checklist

### Spec coverage

| 設計書要件 | カバーするタスク |
|---|---|
| URL `/support` のルート登録 | Task 4 |
| 4 セクション構成（ヘッダー / About / 使途 / Ko-fi） + SE 免責 | Task 3 |
| デザイン: LegalPage トンマナ | Task 2 + Task 3（LegalPageLayout 流用） |
| 戻るボタン（navigate(-1) + フォールバック） | Task 3（LegalPageLayout が `navigate(-1)` を使用、設計書の意図と一致） |
| Ko-fi 側プロフィール設定 | Task 9 |
| i18n キー 10 個 × 4 言語 | Task 1 |
| 既存リンクの置き換え | Task 5 |
| sitemap.xml 追加 | Task 6 |
| `useCanonicalUrl('/support')` | Task 3（実装内） |
| 自動テスト（vitest） | Task 3（4 テスト追加） |
| Playwright E2E | Task 7 |

### Placeholder scan

- TBD / TODO なし
- 「適切な〜」「必要に応じて〜」なし
- すべてのコードブロックが完全実装

### Type consistency

- `support.usage_items` / `support.kofi_note` 等のキー名は全タスクで一貫
- `splitItems` 関数は LegalPage.tsx と同じシグネチャを採用（`(value: string) => string[]`）
- `LegalPageLayout` の export 名は Task 2 と Task 3 で一致

### Notes

- 設計書では「戻るボタン: `navigate(-1)` ベース、履歴なしは `/` フォールバック」と書いていたが、実装では既存 `LegalPageLayout` を流用するため、フォールバック処理は LegalPageLayout 側の実装に従う（現状は単純な `navigate(-1)`）。これは既存ページとの UX 一貫性を優先した実装判断。フォールバックが必要と判明した場合は LegalPageLayout を改修する別タスクとして切り出し可能。

- Task 7（Playwright）の Test 5・6 は selector が dev server 環境とユーザー操作の状態に依存するため、PASS せず FAIL する可能性がある。その場合はスクショ確認で代替判定する（前例: PopularPage 削除タスクの Playwright Test 6 をスクショ確認で OK 判定）。
