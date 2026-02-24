import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const csvPath = resolve(__dirname, 'FF14sim_スキル効果一覧 - 効果一覧.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
const headers = lines[0].split(',');

// Mappings
const jobMap = {
    'ガンブレイカー': ['gnb'],
    'ナイト': ['pld'],
    'ピクトマンサー': ['pct'],
    'モンク': ['mnk'],
    '暗黒騎士': ['drk'],
    '学者': ['sch'],
    '機工士': ['mch'],
    '吟遊詩人': ['brd'],
    '賢者': ['sge'],
    '赤魔導士': ['rdm'],
    '占星術師': ['ast'],
    '戦士': ['war'],
    '白魔導士': ['whm'],
    '踊り子': ['dnc'],
    'リーパー': ['rpr'],
    'ロールアクション': [] // Special handling
};

const roleJobs = {
    'Tank': ['pld', 'war', 'drk', 'gnb'],
    'Melee': ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'],
    'PhysicalRanged': ['brd', 'mch', 'dnc'],
    'MagicalRanged': ['blm', 'smn', 'rdm', 'pct'],
    'Healer': ['whm', 'sch', 'ast', 'sge']
};

// Map specific role actions to roles
const roleActionMap = {
    'Rampart': roleJobs.Tank,
    'Reprisal': roleJobs.Tank,
    'Feint': roleJobs.Melee,
    'Addle': roleJobs.MagicalRanged
};

const mitigations = [];
const skillData = {};

let dataLines = lines.slice(1);

// Helper to parse CSV line respecting quotes
function parseCSVLine(text) {
    const re_valid = /^\s*(?:'[^']*'|"[^"]*"|[^,'"]*|)(?:\s*,\s*(?:'[^']*'|"[^"]*"|[^,'"]*|))*\s*$/;
    const re_value = /(?!\s*$)\s*(?:'([^']*)'|"([^"]*)"|([^,'"]*)|)\s*(?:,|$)/g;
    if (!re_valid.test(text)) return null;
    const a = [];
    text.replace(re_value, function (m0, m1, m2, m3) {
        if (m1 !== undefined) a.push(m1.replace(/\\'/g, "'"));
        else if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) a.push(m3);
        return '';
    });
    if (/,\s*$/.test(text)) a.push('');
    return a;
}

dataLines.forEach(line => {
    const cols = parseCSVLine(line);
    if (!cols || cols.length < 2) return;

    const nameJP = cols[0].trim();
    const nameEN = cols[1].trim();
    const jobJP = cols[2].trim();
    const typeJP = cols[3].trim(); // 軽減, バリア, 無敵, その他
    const potency = cols[4].trim(); // 回復力
    const shieldVal = cols[5].trim(); // バリア量
    const mitigateVal = cols[6].trim(); // 軽減率
    const durationMit = cols[7].trim();
    const durationShield = cols[8].trim();
    const recast = cols[9].trim();
    const charges = cols[10].trim();
    const remarks = cols[11].trim();

    // Determine Jobs
    let targetJobs = [];
    if (jobJP === 'ロールアクション') {
        if (roleActionMap[nameEN]) {
            targetJobs = roleActionMap[nameEN];
        } else {
            // Fallback or skip
            console.log(`Unknown role action: ${nameEN}`);
        }
    } else if (jobMap[jobJP]) {
        targetJobs = jobMap[jobJP];
    } else {
        // Check for other jobs not in map (e.g. from new expansion if any)
        // console.log(`Unknown job: ${jobJP}`);
    }

    // Determine Type & Values
    let type = 'all'; // Default
    let value = 0;
    let valuePhys = undefined;
    let valueMag = undefined;
    let isShield = false;

    // Parse Mitigation Value
    if (mitigateVal.includes('%') || mitigateVal.includes('％')) {
        const match = mitigateVal.match(/(\d+)(?:%|％)/);
        if (match) value = parseInt(match[1]);
    } else if (mitigateVal.includes('詳細')) {
        // Parse remarks for split values
        if (remarks.includes('被魔法') && remarks.includes('被物理')) {
            const magMatch = remarks.match(/被魔法.*?(\d+)(?:%|％)/);
            const physMatch = remarks.match(/被物理.*?(\d+)(?:%|％)/);
            if (magMatch) valueMag = parseInt(magMatch[1]);
            if (physMatch) valuePhys = parseInt(physMatch[1]);
            // Set base value to max or 0? 
            value = Math.max(valueMag || 0, valuePhys || 0); // Representative
            type = 'all'; // It covers both but with different values
        } else if (remarks.includes('15%*15%') || remarks.includes('15％*15％')) {
            // Stacked mitigation? Just take base or approximate.
            // "最初4秒15%*15%, 残り4秒15％" -> Effectively ~27.75% then 15%. 
            // Simulator might just take one value. Let's use the higher one or base?
            // Use 15 for now, or 27? Let's use 15 and note it. 
            // Or maybe add temporal logic later.
            value = 15;
        }
    }

    if (nameEN === 'Addle' || nameEN === 'Feint') {
        // Force correct types
        if (nameEN === 'Addle') {
            type = 'magical';
            value = 10; // 7.0 change? CSV says 10% mag, 5% phys.
            // CSV Remark: "被魔法10%,被物理5%軽減"
            valueMag = 10;
            valuePhys = 5;
            type = 'all'; // Split
        }
        if (nameEN === 'Feint') {
            // CSV Remark: "被物理10%,被魔法5%軽減"
            valuePhys = 10;
            valueMag = 5;
            type = 'all';
        }
    }

    if (nameEN === 'Dark Missionary' || nameEN === 'Heart of Light') {
        // "被物理5%, 被魔法10%軽減"
        valueMag = 10;
        valuePhys = 5;
        type = 'all';
    }

    if (nameEN === 'Dark Mind') {
        // "被魔法軽減20%,被物理軽減10％" ? No, Dark Mind is usually Magic only 20%.
        // CSV Remark: "被魔法軽減20%,被物理軽減10％" -> Wait, Dark Mind received buff?
        // Checking CSV validity... User provided data is source of truth.
        // If remarks say so, we map so.
        if (remarks.includes('被魔法')) valueMag = 20;
        if (remarks.includes('被物理')) valuePhys = 10; // If specified
        else type = 'magical'; value = 20; // Classic Dark Mind
    }

    // Determine Duration
    let duration = 0;
    if (durationMit && durationMit !== '-') duration = parseInt(durationMit);
    if (durationShield && durationShield !== '-' && (!duration || duration === 0)) duration = parseInt(durationShield);
    if (!duration) duration = 15; // Default fallback

    // Shield Logic
    if (typeJP.includes('バリア') || shieldVal !== '-') {
        isShield = true;
    }

    // Generate Mitigations
    targetJobs.forEach((jid, index) => {
        const idBase = nameEN.toLowerCase().replace(/['\s]/g, '_').replace(/_+/g, '_');
        const id = targetJobs.length > 1 && index > 0 ? `${idBase}_${jid}` : idBase;
        // Logic for unique ID: if generic role action, we usually suffix. 
        // Existing mockData uses 'reprisal' for pld, 'reprisal_war' for war.

        let uniqueId = idBase;
        if (['Rampart', 'Reprisal', 'Feint', 'Addle'].includes(nameEN) || targetJobs.length > 1) {
            // Check if it's the "first" or default job?
            // Let's just suffix all except maybe the first one found? 
            // Better to correspond to User's sorting.
            // Let's just suffix with jobId if it's a multi-job skill to be safe and avoiding duplicates.
            // BUT existing code might rely on 'reprisal' (no suffix) for PLD?
            // 'reprisal' -> PLD in mockData.
            if (jid !== 'pld' && nameEN === 'Reprisal') uniqueId = `${idBase}_${jid}`;
            else if (targetJobs.length > 1 && !(nameEN === 'Reprisal' && jid === 'pld')) uniqueId = `${idBase}_${jid}`;
        }

        const iconPath = `/icons/${nameEN.replace(/\s/g, '_')}.png`;

        const mit = {
            id: uniqueId,
            jobId: jid,
            name: nameEN,
            icon: iconPath,
            cooldown: parseInt(recast) || 60,
            duration: duration,
            type: type,
            value: value,
            isShield: isShield
        };

        if (valuePhys !== undefined) mit.valuePhysical = valuePhys;
        if (valueMag !== undefined) mit.valueMagical = valueMag;

        mitigations.push(mit);
    });


    // Generate SKILL_DATA
    // e.g. 'Adloquium': { potency: 300, multiplier: 1.8, type: 'potency', jobs: ['sch'] }
    let skillEntry = {};
    if (potency && potency !== '-') {
        skillEntry.potency = parseInt(potency);
        skillEntry.type = 'potency';
    } else if (shieldVal.includes('%') || shieldVal.includes('％')) {
        // HP Percent based
        const pMatch = shieldVal.match(/(\d+)(?:%|％)/);
        if (pMatch) {
            skillEntry.percent = parseInt(pMatch[1]);
            skillEntry.type = 'hp';
        }
    }

    // Multiplier for shields (e.g. "回復量の180％分")
    if (shieldVal.includes('回復量')) {
        const mMatch = shieldVal.match(/(\d+)(?:%|％)/);
        if (mMatch) {
            skillEntry.multiplier = parseInt(mMatch[1]) / 100;
        } else {
            skillEntry.multiplier = 1.0;
        }
    }

    if (Object.keys(skillEntry).length > 0) {
        skillEntry.jobs = targetJobs;
        skillData[nameEN] = skillEntry;
    }
});

console.log('// --- MITIGATIONS ---');
console.log(JSON.stringify(mitigations, null, 4));
console.log('\n// --- SKILL_DATA ---');
console.log(JSON.stringify(skillData, null, 4));
