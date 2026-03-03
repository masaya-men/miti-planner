import { calculateMemberValues } from './src/utils/calculator';
import { LEVEL_MODIFIERS } from './src/data/levelModifiers';

const fakeMember = {
    id: 'test',
    jobId: 'sch',
    role: 'healer',
    name: 'Test SCH',
    stats: {
        hp: 100000,
        mainStat: 3000,
        det: 2000,
        crt: 2000,
        ten: 400,
        ss: 400,
        wd: 130
    }
};

const calc100 = calculateMemberValues(fakeMember as any, 100);
console.log("=== LEVEL 100 SCH SHIELDS ===");
console.log("鼓舞激励の策:", calc100["鼓舞激励の策"]);
console.log("秘策：展開戦術:", calc100["秘策：展開戦術"]);

const calc70 = calculateMemberValues(fakeMember as any, 70);
console.log("\n=== LEVEL 70 SCH SHIELDS ===");
console.log("鼓舞激励の策:", calc70["鼓舞激励の策"]);
console.log("秘策：展開戦術:", calc70["秘策：展開戦術"]);
