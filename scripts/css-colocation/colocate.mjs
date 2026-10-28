// CSS の規則を、 持ち主の部品(.tsx)の隣の <部品名>.css へ移す道具の入口。 計画は planColocation.mjs、 対象ごとの設定は scopes/<名前>.mjs。
// 使い方: node scripts/css-colocation/colocate.mjs --scope=<housing|military> --dry-run           → .out/plan.md に移し先の一覧
//         node scripts/css-colocation/colocate.mjs --scope=<housing|military> --write [--only=a,b] → 書き出し+import 追加+元のファイルから削除
//         (--only は部品フォルダ以下のフォルダ名。 "." は直下の部品・"_shared" は共有フォルダ行き)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { planColocation } from './planColocation.mjs';
import { applyPlan } from './applyPlan.mjs';
import { reachable } from './reachable.mjs';
import { listTsx } from './srcFiles.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');
  const scopeName = args.find((a) => a.startsWith('--scope='))?.slice(8);
  if (!scopeName) throw new Error('--scope=<housing|military> を付ける');
  const sc = await import(pathToFileURL(path.join(HERE, 'scopes', `${scopeName}.mjs`)).href);
  const C = sc.componentsDir;
  const short = (k) => k.replace(`${C}/`, '');

  const sources = sc.sources();
  const base = (f) => path.basename(f);
  const reach = reachable('src/main.tsx', (f) => fs.readFileSync(f, 'utf8'), (f) => fs.existsSync(f) && fs.statSync(f).isFile());
  const allowed = sc.candidates(reach);
  const jsx = (sc.listCandidates?.() ?? listTsx('src')).filter((file) => allowed.has(file)).map((file) => ({ file, text: fs.readFileSync(file, 'utf8') }));
  const p = planColocation({
    sources,
    jsx,
    shared: sources.filter((s) => s.role === 'shared').map((s) => base(s.file)),
    frame: sources.filter((s) => s.role === 'frame').map((s) => base(s.file)),
    overrides: sc.overrides,
    selectorOverrides: sc.selectorOverrides,
    fileFallback: sc.fileFallback,
    componentsDir: C,
    sharedDir: sc.sharedDir,
    unusedDir: sc.unusedDir,
    prefixRe: sc.prefixRe,
    ...(sc.planOptions?.(reach, jsx) ?? {}),
  });

  // 一覧
  const lines = [`# 移し先の一覧(colocate.mjs --scope=${scopeName} --dry-run)`, ''];
  for (const s of sources) {
    const tally = new Map();
    for (const u of p.units) if (u.src === s.file && u.rule) {
      const k = u.dest.out ?? '(残す)';
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    lines.push(`- ${s.file} → ${[...tally].map(([k, n]) => `${short(k)}(${n})`).join(' / ')}`);
  }
  lines.push('', `## 出力 ${p.outputs.size} 本(500 行超は ⚠)`);
  for (const [k, css] of [...p.outputs].sort()) {
    const n = css.split('\n').length + 1;
    lines.push(`- ${n > 500 ? '⚠ ' : ''}${short(k)} ${n} 行`);
  }
  lines.push('', `## 部品をまたぐ順番頼り ${p.crossPairs.length}`);
  for (const [a, b, prop, ka, kb] of p.crossPairs) lines.push(`- [${prop}] ${a.media ? `@media ${a.media} ` : ''}${a.selector} (${short(ka)})  →  ${b.selector} (${short(kb)})`);
  lines.push('', `## 共有と部品の順番頼り ${p.sharedPairs.length}(ビルドの前後比較で確認)`);
  for (const [a, b, prop, ka, kb] of p.sharedPairs) lines.push(`- [${prop}] ${a.selector} (${short(ka)})  →  ${b.selector} (${short(kb)})`);
  lines.push('', `## 持ち主が割れた class ${p.ambiguous.length}`);
  for (const a of p.ambiguous) lines.push(`- ${a.cls} → ${short(a.chosen)}  (候補: ${a.candidates.map((c) => short(String(c))).join(', ')})`);
  lines.push('', '## JSX に見つからず元のファイルの主な持ち主へ寄せた規則');
  for (const u of p.units) if (u.fallback && u.rule && u.dest.out) lines.push(`- ${base(u.src)}: ${u.rule.kind === 'rule' ? u.rule.selector : `@${u.rule.name} ${u.rule.params}`} → ${short(u.dest.out)}`);
  const outDir = path.join(HERE, '.out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'plan.md'), `${lines.join('\n')}\n`);
  console.log(`出力 ${p.outputs.size} 本 / またぐ順番頼り ${p.crossPairs.length} / 共有との順番頼り ${p.sharedPairs.length} / 割れ ${p.ambiguous.length} → scripts/css-colocation/.out/plan.md`);
  if (!write) return;
  if (p.crossPairs.length) throw new Error('部品をまたぐ順番頼りが残っている(overrides で解消してから --write)');

  // 書き出し: 対象の単位だけ移し、 元のファイルからは消す(書く前に全部の行き先を検査する=applyPlan.mjs)
  const done = applyPlan({ p, sc, sources, only });
  console.log(`書き出し ${done.outputs} 本(${done.moving} 単位)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
