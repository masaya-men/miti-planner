/**
 * src/utils/damageRounding.ts
 *
 * Adaptive ceiling rounding for damage values.
 * Always rounds UP to ensure damage is never underestimated.
 *
 * Strategy: 3 significant digits, ceiling.
 *   156,234 → 157,000
 *    42,876 →  42,900
 *     8,523 →   8,530
 *       312 →     312 (≤999: no rounding)
 */

/**
 * Round a damage value UP (ceiling) to 3 significant digits.
 * Values ≤ 999 are returned as-is.
 * Negative or zero values are returned as-is.
 */
export function roundDamageCeil(value: number): number {
    if (value <= 999 || value <= 0) return value;

    // Determine the order of magnitude
    // e.g. 156234 → digits=6 → divisor=1000 → 156.234 → ceil → 157 → 157000
    const digits = Math.floor(Math.log10(value)) + 1;
    const divisor = Math.pow(10, digits - 3);

    return Math.ceil(value / divisor) * divisor;
}
