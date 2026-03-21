// Script to generate templates for all 18 target contents sequentially
import { execSync } from 'node:child_process';

const targets = [
    // Ultimates
    'fru', 'top', 'dsr', 'tea', 'uwu', 'ucob',
    // Arcadia Light-Heavyweight
    'm1s', 'm2s', 'm3s', 'm4s',
    // Arcadia Cruiserweight
    'm5s', 'm6s', 'm7s', 'm8s',
    // Arcadia Heavyweight
    'm9s', 'm10s', 'm11s',
    // M12S has p1/p2 but shares encounter, handled by the script
];
// M12S_P1 and M12S_P2 share the same base encounter group, so just run m12s_p1
targets.push('m12s_p1');

for (const t of targets) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Generating: ${t}`);
    console.log(`${'='.repeat(60)}`);
    try {
        execSync(`node ./scripts/generate-templates.mjs -- --content ${t}`, {
            cwd: process.cwd(),
            stdio: 'inherit',
            timeout: 300000, // 5 min per content
        });
    } catch (err) {
        console.error(`ERROR generating ${t}:`, err.message);
    }
}

console.log('\n\nDONE! All templates generated.');
