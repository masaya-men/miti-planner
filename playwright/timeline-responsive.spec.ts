import { test, expect } from '@playwright/test';

const VIEWPORTS = [
    { name: '1366-laptop', width: 1366, height: 768, dpr: 1 },
    { name: '1489-user-actual', width: 1489, height: 768, dpr: 1 },
    { name: '1920-majority', width: 1920, height: 1080, dpr: 1 },
    { name: '2560-27inch-4k-150', width: 2560, height: 1440, dpr: 1 },
    { name: '3840-native-4k', width: 3840, height: 2160, dpr: 1 },
];

// 期待値: clamp(min, vw, max) 計算 — philosophy v2 (max = base、 開発者画面 px)
// --col-th-w:  clamp(110px, 8.395vw, 125px)  ← max を base に統一
// --col-dps-w: clamp(45px, 3.358vw, 50px)    ← max を base に統一
// 1489+ では max クランプで base 固定、 ultrawide でも要素拡大しない
const EXPECTED_TH_WIDTH: Record<string, number> = {
    '1366-laptop': 115,        // 1366 * 0.08395 = 114.68 → vw 自然値 (min/max 範囲内)
    '1489-user-actual': 125,   // 基準値 (1489 * 0.08395 = 125.00 = max)
    '1920-majority': 125,      // max クランプ (1920 * 0.08395 = 161.18 > 125)
    '2560-27inch-4k-150': 125, // max クランプ (固定)
    '3840-native-4k': 125,     // max クランプ (固定)
};

const EXPECTED_DPS_WIDTH: Record<string, number> = {
    '1366-laptop': 46,         // 1366 * 0.03358 = 45.87 → vw 自然値
    '1489-user-actual': 50,    // 基準値 (1489 * 0.03358 ≈ 50 = max)
    '1920-majority': 50,       // max クランプ (1920 * 0.03358 = 64.47 > 50)
    '2560-27inch-4k-150': 50,  // max クランプ (固定)
    '3840-native-4k': 50,      // max クランプ (固定)
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

        // 1489 はユーザー本人環境の絶対基準 - サブピクセル誤差は許容するが整数値で 125/50 を要求
        if (vp.name === '1489-user-actual') {
            expect(Math.round(tankBox!.width)).toBe(125);
            expect(Math.round(dpsBox!.width)).toBe(50);
        }

        await ctx.close();
    });
}
