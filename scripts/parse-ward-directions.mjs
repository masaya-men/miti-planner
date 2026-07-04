// 使い方: node scripts/parse-ward-directions.mjs
// masaya の行き方スプシ(src/data/housing/directions-src/*.csv)→ wardDirections.generated.json
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'src/data/housing/directions-src';
const OUT = 'src/data/housing/wardDirections.generated.json';
// ファイル名 → area enum (HOUSING_AREAS)
const FILES = [
  ['mist.csv', 'Mist'],
  ['lavenderbeds.csv', 'LavenderBeds'],
  ['goblet.csv', 'Goblet'],
  ['shirogane.csv', 'Shirogane'],
  ['empyreum.csv', 'Empyreum'],
];

const unq = (s) => s.replace(/^"|"$/g, '').trim();

const out = {};
for (const [file, area] of FILES) {
  const txt = readFileSync(`${SRC}/${file}`, 'utf8');
  const lines = txt.split(/\r?\n/).filter((l) => l.trim());
  const byPlot = {};
  for (let i = 1; i < lines.length; i++) {
    // header skip
    const cols = lines[i].split(',');
    const plot = Number(unq(cols[2] ?? ''));
    const aetheryte = unq(cols[3] ?? '');
    const directions = unq(cols[4] ?? '');
    if (!Number.isInteger(plot) || plot < 1 || plot > 60) continue;
    if (!aetheryte && !directions) continue;
    byPlot[String(plot)] = { aetheryte, directions };
  }
  const n = Object.keys(byPlot).length;
  if (n !== 60) throw new Error(`${area}: expected 60 plots, got ${n}`);
  out[area] = byPlot;
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(
  'wardDirections.generated.json written:',
  Object.keys(out)
    .map((a) => `${a}=${Object.keys(out[a]).length}`)
    .join(' '),
);
