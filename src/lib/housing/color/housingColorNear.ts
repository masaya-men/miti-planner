// 探す時の広さ: 選んだ丸 → 当たりにする系統。11-12 masaya が試し台で「ふつう」に決めた表。
// 家に保存した色はそのままで、ここを変えるだけで当たり方を調整できる(取り直し不要)。
import type { ColorFamily, SwatchNameKey } from './housingColorSwatches.js';

export const NEAR_FAMILIES: Readonly<Record<SwatchNameKey, readonly ColorFamily[]>> = {
    white: ['white', 'lightGray'],
    gray: ['lightGray', 'gray'],
    black: ['black', 'gray'],
    red: ['red', 'pink', 'orange'],
    orange: ['orange', 'red', 'yellow'],
    yellow: ['yellow', 'orange', 'beige'],
    green: ['green', 'lightBlue'],
    lightBlue: ['lightBlue', 'blue', 'green'],
    blue: ['blue', 'lightBlue', 'purple'],
    purple: ['purple', 'blue', 'pink'],
    pink: ['pink', 'red', 'purple'],
    brown: ['brown', 'beige', 'orange'],
    beige: ['beige', 'brown', 'white'],
};
