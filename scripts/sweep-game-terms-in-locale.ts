// 使い方: npx tsx scripts/sweep-game-terms-in-locale.ts
// src/locales/zh.json の文言の中に、src/data/mockData.ts のスキル名(zh)が
// 部分一致で含まれている箇所を一覧表示する(jobs.*/roles.*は全件が対象と分かっているため除外)。
// 出力された項目は機械変換ではなく公式ソースで個別に訳し直す候補。
import { readFileSync } from 'fs';
import { MITIGATIONS } from '../src/data/mockData';

const zh = JSON.parse(readFileSync('src/locales/zh.json', 'utf8'));

function collectLeaves(obj: Record<string, unknown>, prefix = ''): [string, string][] {
    const out: [string, string][] = [];
    for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (path.startsWith('jobs.') || path.startsWith('roles.')) continue;
        if (typeof value === 'string') {
            out.push([path, value]);
        } else if (typeof value === 'object' && value !== null) {
            out.push(...collectLeaves(value as Record<string, unknown>, path));
        }
    }
    return out;
}

const skillTerms = [...new Set(MITIGATIONS.map((m) => m.name.zh).filter((t) => t.length >= 2))];
const leaves = collectLeaves(zh);

for (const [path, value] of leaves) {
    for (const term of skillTerms) {
        if (value.includes(term)) {
            console.log(`${path} = ${JSON.stringify(value)}  (一致: "${term}")`);
            break;
        }
    }
}
