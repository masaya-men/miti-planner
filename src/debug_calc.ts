
import { calculatePotencyValue, calculateCriticalValue } from './utils/calculator';
import { LEVEL_MODIFIERS } from './data/levelModifiers';

const input = {
    mainStat: 6317,
    det: 3141,
    crt: 2000,
    ten: 1000,
    ss: 400,
    wd: 130
};

console.log('--- Debug Calculation ---');
console.log('Input:', input);

const potency = 300;
const role = 'healer';

const baseVal = calculatePotencyValue(input, potency, role, LEVEL_MODIFIERS[100]);
const critVal = calculateCriticalValue(baseVal);

console.log(`Potency: ${potency}, Role: ${role}`);
console.log(`Calculated Base Value: ${baseVal}`);
console.log(`Calculated Critical Value: ${critVal}`);

// Expected roughly 20000 for Base (based on my manual calc of Spec A)
// Or 4622 (if User is right about what they see)

// Manual check of factors
const LEVEL_MOD_MAIN = 440;
const floor = Math.floor;
const fHmp = floor(100 * (input.mainStat - LEVEL_MOD_MAIN) / 268) + 100;
console.log(`Manual fHMP: ${fHmp}`);
