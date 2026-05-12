import { test, expect } from '@playwright/test';

const VIEWPORTS = [
    { name: '1366-laptop', width: 1366, height: 768, dpr: 1 },
    { name: '1489-user-actual', width: 1489, height: 768, dpr: 1 },
    { name: '1920-majority', width: 1920, height: 1080, dpr: 1 },
    { name: '2560-27inch-4k-150', width: 2560, height: 1440, dpr: 1 },
    { name: '3840-native-4k', width: 3840, height: 2160, dpr: 1 },
];

// 期待値: 軽減アイコン列は固定 px (アイコン最大並び数で決まる機能要件)
// --col-th-w:  124px (= 2L + 5×ICON(24) + 2L、 viewport 非依存)
// --col-dps-w: 52px  (= 2L + 2×ICON(24) + 2L、 viewport 非依存)
const EXPECTED_TH_WIDTH: Record<string, number> = {
    '1366-laptop': 124,
    '1489-user-actual': 124,
    '1920-majority': 124,
    '2560-27inch-4k-150': 124,
    '3840-native-4k': 124,
};

const EXPECTED_DPS_WIDTH: Record<string, number> = {
    '1366-laptop': 52,
    '1489-user-actual': 52,
    '1920-majority': 52,
    '2560-27inch-4k-150': 52,
    '3840-native-4k': 52,
};

for (const vp of VIEWPORTS) {
    test(`column widths at ${vp.name} (${vp.width}x${vp.height})`, async ({ browser }) => {
        const ctx = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            deviceScaleFactor: vp.dpr,
        });
        const page = await ctx.newPage();
        // タイムラインは /miti (MitiPlannerPage) でレンダリング
        await page.goto('/miti');

        // タイムラインのメンバー列ヘッダーが描画されるまで待機
        await page.waitForSelector('[data-member-role="tank"]', { state: 'attached', timeout: 15000 });

        // CSS clamp() の resize 反映待ち (1 フレーム)
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

        const tank = page.locator('[data-member-role="tank"]').first();
        const tankBox = await tank.boundingBox();
        expect(tankBox).not.toBeNull();
        expect(tankBox!.width).toBeCloseTo(EXPECTED_TH_WIDTH[vp.name], 0); // ±0.5px tolerance

        const dps = page.locator('[data-member-role="dps"]').first();
        const dpsBox = await dps.boundingBox();
        expect(dpsBox).not.toBeNull();
        expect(dpsBox!.width).toBeCloseTo(EXPECTED_DPS_WIDTH[vp.name], 0);

        // 1489 はユーザー本人環境の絶対基準 - サブピクセル誤差は許容するが整数値で 124/52 を要求
        if (vp.name === '1489-user-actual') {
            expect(Math.round(tankBox!.width)).toBe(124);
            expect(Math.round(dpsBox!.width)).toBe(52);
        }

        await ctx.close();
    });
}

// container max-width 中央寄せ検証 (Phase 2C + 全 shell 中央寄せ)
// 3840 ultrawide で app-shell (Layout.tsx 最外層) の幅が --container-max (1489px) に制限されているか確認
test('App shell is capped at 1489px and centered on 3840 ultrawide', async ({ browser }) => {
    const ctx = await browser.newContext({
        viewport: { width: 3840, height: 2160 },
        deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    await page.goto('/miti');
    await page.waitForSelector('[data-member-role="tank"]', { state: 'attached', timeout: 15000 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));

    // data-app-shell (Layout.tsx 最外層) の幅を計測 — sidebar + main を含む全 shell が 1489 にキャップされる
    const shell = page.locator('[data-app-shell]').first();
    const shellBox = await shell.boundingBox();
    expect(shellBox).not.toBeNull();

    // 3840 viewport では max-width: 1489px が効いているはず (±2px tolerance)
    expect(shellBox!.width).toBeLessThanOrEqual(1489 + 2);

    // 中央寄せ: shell の左マージンと右マージンがほぼ同じ (両側余白均等)
    const leftMargin = shellBox!.x;
    const rightMargin = 3840 - (shellBox!.x + shellBox!.width);
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(5);  // ±5px tolerance

    await ctx.close();
});
