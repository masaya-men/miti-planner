
const floor = Math.floor;
const LEVEL_MOD_MAIN = 440;
const LEVEL_MOD_SUB = 420;
const LEVEL_MOD_DIV = 2780;
const TRAIT_MOD = 1.3;

const getWdMultiplier = (wd: number, jobMod: number = 115): number => {
    const base = floor((LEVEL_MOD_MAIN * jobMod) / 1000) + wd;
    return base / 100;
};

const getMainStatMultiplier = (mainStat: number): number => {
    const val = floor((mainStat - LEVEL_MOD_MAIN) * 195 / LEVEL_MOD_DIV);
    return (100 + val) / 100;
};

const getDetMultiplier = (det: number): number => {
    const val = floor(140 * (det - LEVEL_MOD_MAIN) / LEVEL_MOD_DIV);
    return (1000 + val) / 1000;
};

const getTenMultiplier = (ten: number): number => {
    const val = floor(100 * (ten - LEVEL_MOD_SUB) / LEVEL_MOD_DIV);
    return (1000 + val) / 1000;
};

const calculatePotencyValue = (input: any, potency: number, isTank: boolean = false): number => {
    const fWd = getWdMultiplier(input.wd);
    const fMain = getMainStatMultiplier(input.mainStat);
    const fDet = getDetMultiplier(input.det);
    const fTnc = isTank ? getTenMultiplier(input.ten) : 1;
    const fTrait = TRAIT_MOD;

    let val = potency;
    val *= fMain;
    val *= fDet;
    val *= fTnc;
    val *= fWd;
    val *= fTrait;

    console.log(`Potency: ${potency}`);
    console.log(`fMain (${input.mainStat}): ${fMain}`);
    console.log(`fDet (${input.det}): ${fDet}`);
    console.log(`fWd (${input.wd}): ${fWd}`);
    console.log(`Calc: ${potency} * ${fMain} * ${fDet} * ${fWd} * ${fTrait} = ${val}`);
    return floor(val);
};

const zeroStats = {
    mainStat: 0,
    det: 0,
    wd: 0,
    crt: 0,
    ten: 0,
    ss: 0
};

console.log("--- Calculating Holos (300 Pot) with 0 Stats ---");
const holos = calculatePotencyValue(zeroStats, 300);
console.log(`Holos result: ${holos}`);

console.log("\n--- Calculating Adloquium (300 * 1.8 = 540 Pot) with 0 Stats ---");
const adlo = calculatePotencyValue(zeroStats, 540); // 300 * 1.8
console.log(`Adlo result: ${adlo}`);
