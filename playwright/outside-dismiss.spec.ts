import { test, expect, type Page } from '@playwright/test';

// 外側を押した時の共通の動き(useDismissOnOutside)を実機で確かめる。
// 「開く → 下にあるボタンの位置を押す → 開いた物は閉じる・下のボタンは反応しない」
// ※ 通知のベルはログイン必須、右クリックメニューは Firestore のコンテンツ一覧が要るため、
//   ローカルでは開けない。代わりに同じ作りのパルス設定を確かめる(動きはフックの単体テストでも確認済み)。

const MITI_TARGET = 'button[aria-label="取り込み"]';
const TOOLS_MENU = (page: Page) => page.locator('div.fixed.float-surface:has-text("軽減自動組み立て")');

/** 初回オーバーレイ(チュートリアル・スマホガイド)を出さない */
async function suppressOverlays(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem(
            'tutorial-storage',
            JSON.stringify({ state: { hasCompleted: true, hasVisitedShare: true, isActive: false }, version: 0 }),
        );
        localStorage.setItem('lopo_mobile_guide_completed', 'true');
    });
}

/** 対象の click 回数を数える(下に届いたかを測る) */
async function countClicks(page: Page, selector: string) {
    await page.evaluate((sel) => {
        const w = window as unknown as { __clicks: number };
        w.__clicks = 0;
        document.querySelector(sel)?.addEventListener('click', () => { w.__clicks += 1; });
    }, selector);
}
const readClicks = (page: Page) => page.evaluate(() => (window as unknown as { __clicks: number }).__clicks);

/** 実ユーザーと同じく、座標に対してマウスで押す(間に何かあればそこが押される) */
async function pressAt(page: Page, selector: string) {
    const box = await page.locator(selector).first().boundingBox();
    expect(box, `${selector} の位置が取れる`).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test.describe('外側を押した時の動き(共通フック)', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1489, height: 679 });
    });

    async function openMiti(page: Page) {
        await suppressOverlays(page);
        await page.goto('/miti', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(MITI_TARGET, { state: 'visible', timeout: 60000 });
    }

    test('ヘッダーのツールメニュー: 外の取り込みボタンを押すと閉じ、取り込みは反応しない', async ({ page }) => {
        await openMiti(page);
        await page.locator('button[aria-label="その他"]').click();
        const menu = TOOLS_MENU(page);
        await expect(menu).toBeVisible();

        await countClicks(page, MITI_TARGET);
        await pressAt(page, MITI_TARGET);

        await expect(menu).toHaveCount(0);
        expect(await readClicks(page)).toBe(0);
        // 取り込みのメニューも開いていない(開く click が止められている)
        await expect(page.locator('div.fixed.float-surface:has-text("FF Logs")')).toHaveCount(0);
    });

    test('言語切替: 外を押すと閉じ、下のボタンは反応しない', async ({ page }) => {
        await openMiti(page);
        await page.locator('button:has(svg.lucide-globe)').first().click();
        const menu = page.locator('div.fixed.float-surface:has-text("English")');
        await expect(menu).toBeVisible();

        await countClicks(page, MITI_TARGET);
        await pressAt(page, MITI_TARGET);

        await expect(menu).toHaveCount(0);
        expect(await readClicks(page)).toBe(0);
    });

    test('パルス設定(メニュー): 外を押すと閉じ、下のボタンは反応しない', async ({ page }) => {
        await openMiti(page);
        await page.getByRole('button', { name: 'パルス設定' }).click();
        const panel = page.locator('div.float-surface', { hasText: 'パルス' }).last();
        await expect(panel).toBeVisible();

        await countClicks(page, MITI_TARGET);
        await pressAt(page, MITI_TARGET);

        await expect(page.locator('div.float-surface', { hasText: 'パルス' })).toHaveCount(0);
        expect(await readClicks(page)).toBe(0);
    });

    test('ハウジングの並び替え: 外を押すと閉じ、下のボタンは反応しない', async ({ page }) => {
        await page.goto('/housing', { waitUntil: 'domcontentloaded' });
        const trigger = page.locator('.housing-sort-trigger');
        await trigger.waitFor({ state: 'visible', timeout: 60000 });
        await trigger.click();
        await expect(page.locator('.housing-sort-menu')).toBeVisible();

        await countClicks(page, '.housing-shuffle-btn');
        await pressAt(page, '.housing-shuffle-btn');

        await expect(page.locator('.housing-sort-menu')).toHaveCount(0);
        expect(await readClicks(page)).toBe(0);
    });

    test('開いたボタンをもう一度押すと閉じる(開き直さない)', async ({ page }) => {
        await openMiti(page);
        const opener = page.locator('button[aria-label="その他"]');
        await opener.click();
        await expect(TOOLS_MENU(page)).toBeVisible();
        await opener.click();
        await expect(TOOLS_MENU(page)).toHaveCount(0);
    });

    test('外の入力欄を押すと、メニューは閉じて入力欄にフォーカスが当たる', async ({ page }) => {
        await page.goto('/housing', { waitUntil: 'domcontentloaded' });
        const trigger = page.locator('.housing-sort-trigger');
        await trigger.waitFor({ state: 'visible', timeout: 60000 });
        await trigger.click();
        await expect(page.locator('.housing-sort-menu')).toBeVisible();

        await pressAt(page, '.housing-app-search-input');

        await expect(page.locator('.housing-sort-menu')).toHaveCount(0);
        await expect(page.locator('.housing-app-search-input')).toBeFocused();
    });
});
