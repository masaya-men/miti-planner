
// Paste functions directly to avoid TS/Module issues
const floor = Math.floor;
const LEVEL_MOD_MAIN = 440;
const LEVEL_MOD_SUB = 420;
const LEVEL_MOD_DIV = 2780;

const JOB_MODS = { tank: 100, healer: 115, dps: 100 };
const TRAITS = { tank: 100, healer: 130, dps: 100 };

const getMainStatFactor = (mainStat) => floor(100 * (mainStat - LEVEL_MOD_MAIN) / 268) + 100;
const getDetFactor = (det) => floor(140 * (det - LEVEL_MOD_MAIN) / LEVEL_MOD_DIV) + 1000;
const getTenFactor = (ten) => floor(110 * (ten - LEVEL_MOD_SUB) / LEVEL_MOD_DIV) + 1000;
const getWdFactor = (wd, jobMod) => floor((LEVEL_MOD_MAIN * jobMod) / 1000) + wd;

const calculatePotencyValue = (input, potency, role = 'healer') => {
    const jobMod = JOB_MODS[role];
    const trait = TRAITS[role];
    const fHmp = getMainStatFactor(input.mainStat);
    const fDet = getDetFactor(input.det);
    const fTnc = role === 'tank' ? getTenFactor(input.ten) : 1000;
    const fWd = getWdFactor(input.wd, jobMod);

    console.log(`Debug Factors: HMP=${fHmp}, DET=${fDet}, WD=${fWd}, TRAIT=${trait}`);

    let val = floor(potency * fHmp);
    val = floor(val * fDet);
    val = floor(val / 100);
    const h1 = floor(val / 1000);

    val = floor(h1 * fTnc);
    val = floor(val / 1000);
    val = floor(val * fWd);
    val = floor(val / 100);
    val = floor(val * trait);
    const h2 = floor(val / 100);

    return h2;
};

const input = { mainStat: 6317, det: 3141, wd: 130, ten: 1000 };
const potency = 300;
const role = 'healer';

const result = calculatePotencyValue(input, potency, role);
console.log(`Result: ${result}`);
