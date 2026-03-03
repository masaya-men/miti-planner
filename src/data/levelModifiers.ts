export interface LevelModifier {
    level: number;
    main: number; // 攻撃魔法威力/回復魔法威力の計算に使われるメインステータス補正値
    sub: number;  // クリティカル/意思力/不屈の計算に使われるサブステータス補正値
    div: number;  // 汎用的な除算補正値 (LevelModDiv)
    hp: number;   // HP計算時の補正値
}

export const LEVEL_MODIFIERS: Record<number, LevelModifier> = {
    // パッチ7.0 (黄金のレガシー) 基準値 (Lv100)
    100: {
        level: 100,
        main: 440,
        sub: 420,
        div: 2780,
        hp: 3000,
    },
    // パッチ6.0 (暁月のフィナーレ) 基準値 (Lv90)
    90: {
        level: 90,
        main: 390,
        sub: 400,
        div: 1900,
        hp: 3000,
    },
    // パッチ5.0 (漆黒のヴィランズ) 基準値 (Lv80)
    80: {
        level: 80,
        main: 340,
        sub: 380,
        div: 1300,
        hp: 3000,
    },
    // パッチ4.0 (紅蓮のリベレーター) 基準値 (Lv70)
    70: {
        level: 70,
        main: 292, // 概算値
        sub: 364,
        div: 900,
        hp: 3000,
    }
};
