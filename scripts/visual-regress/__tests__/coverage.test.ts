import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const SRC = path.join(ROOT, 'src');
const CATALOG_DIR = path.join(HERE, '..', 'catalog');

/** 窓の殻(これらを import して JSX で使う .tsx は窓の部品) */
const SHELLS = ['ModalShell', 'HousingPanelModal', 'MobileBottomSheet', 'ConfirmDialog'];

/** 殻を使わない窓・ポップ(付録 A の /miti の非 Shell ポップ)。role="menu" の .tsx は別途自動で集める */
const HAND_WRITTEN = [
  'ImportMenu', 'HeaderToolsMenu', 'LanguageSwitcher', 'AASettingsPopover', 'ClearMitigationsPopover',
  'PartyStatusPopover', 'ContextMenu', 'MobileContextMenu', 'SheetTargetPopover', 'TutorialMenu',
  'MannerNoticeDialog', 'HeaderPhaseDropdown', 'HeaderGimmickDropdown', 'HeaderMechanicSearch',
  'HeaderTimeInput', 'PulseSettings', 'LimitResolutionSheet', 'ImportProgressOverlay', 'ShareImportSheet',
  'MobileGuide', 'TutorialOverlay', 'BoundaryEditModal', 'EventModal', 'MitigationSelector', 'JobPicker',
  'PipView', 'SystemNotificationBar', 'LocalDataSafetyBar',
];

/** 未使用の窓(パス単位で除外) */
const UNUSED_PATHS: string[] = [];

/** 窓の殻そのものの定義や、窓ではない描画部品(殻を import していても検査対象にしない) */
const NOT_WINDOWS = ['ModalShell', 'HousingPanelModal', 'MobileBottomSheet', 'ConfirmDialog'];

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const base = (p: string) => path.basename(p).replace(/\.[^.]+$/, '');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

function usesShell(src: string): boolean {
  const importRe = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]+['"]|import\s+(\w+)\s+from\s*['"][^'"]+['"]/g;
  const imported = new Set<string>();
  for (const m of src.matchAll(importRe)) {
    for (const n of (m[1] ?? m[2] ?? '').split(',')) imported.add(n.trim().split(/\s+as\s+/).pop() ?? '');
  }
  return SHELLS.some((s) => imported.has(s) && new RegExp(`<${s}[\\s>/]`).test(src));
}

function routeComponents(): { route: string; component: string }[] {
  const app = fs.readFileSync(path.join(SRC, 'App.tsx'), 'utf8');
  const lazyMap: Record<string, string> = {};
  for (const m of app.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)/g)) {
    lazyMap[m[1]] = base(m[2]);
  }
  const out: { route: string; component: string }[] = [];
  for (const line of app.split('\n')) {
    const m = line.match(/<Route\s+(?:path="([^"]*)"|index)[^>]*element=\{(.*)\}\s*\/?>/);
    if (!m) continue;
    const route = m[1] ?? '(index)';
    if (route.startsWith('/housing/dev/') || route.startsWith('dev/')) continue;
    if (/<Navigate\b/.test(m[2])) continue;
    for (const t of m[2].matchAll(/<([A-Z]\w*)/g)) {
      if (['Suspense', 'AdminGuard'].includes(t[1])) continue;
      out.push({ route, component: lazyMap[t[1]] ?? t[1] });
    }
  }
  return out;
}

async function loadCatalog() {
  const covers = new Set<string>();
  for (const f of fs.readdirSync(CATALOG_DIR).filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))) {
    const items = (await import(pathToFileURL(path.join(CATALOG_DIR, f)).href)).default as { covers?: string[] }[];
    for (const it of items) for (const c of it.covers ?? []) covers.add(c);
  }
  const later = (await import(pathToFileURL(path.join(CATALOG_DIR, '_later.mjs')).href)).default as
    { component: string; stage: number; reason: string }[];
  return { covers, later };
}

describe('カタログ漏れの検査', () => {
  it('_later.mjs の各行に stage(2|3) と reason がある', async () => {
    const { later } = await loadCatalog();
    for (const l of later) {
      expect([2, 3], `${l.component} の stage`).toContain(l.stage);
      expect(typeof l.reason === 'string' && l.reason.trim().length > 10, `${l.component} の reason`).toBe(true);
    }
  });

  it('手書き一覧・除外一覧の実在確認(古くなった名前を残さない)', () => {
    const names = new Set(walk(SRC).map(base));
    for (const n of HAND_WRITTEN) expect(names.has(n), `手書き一覧に実在しない部品: ${n}`).toBe(true);
    for (const p of UNUSED_PATHS) expect(fs.existsSync(path.join(ROOT, p)), `除外一覧に実在しないファイル: ${p}`).toBe(true);
  });

  it('殻を使う窓・手書きの窓・ルートの全部が covers か _later にある', async () => {
    const { covers, later } = await loadCatalog();
    const known = new Set([...covers, ...later.map((l) => l.component)]);
    const files = walk(SRC).filter((p) => !UNUSED_PATHS.includes(rel(p)));
    const wanted = new Map<string, string>(); // 部品名 -> 由来
    for (const p of files) {
      const name = base(p);
      if (NOT_WINDOWS.includes(name)) continue;
      if (rel(p).startsWith('src/components/housing/dev/')) continue; // 開発専用ページ(本番ビルドで除去)
      const src = fs.readFileSync(p, 'utf8');
      if (usesShell(src)) wanted.set(name, `殻を使う窓 ${rel(p)}`);
      else if (/role=["']menu["']/.test(src)) wanted.set(name, `role="menu" ${rel(p)}`);
    }
    // 検出の固定: 殻を使う実在ファイルが集合に入っていること(検出が 0 件になる退行を落とす)
    const shellFound = [...wanted].filter(([, why]) => why.startsWith('殻を使う窓')).map(([n]) => n);
    expect(shellFound.length, `殻を使う窓の検出数: ${shellFound.length}`).toBeGreaterThan(20);
    expect(shellFound).toContain('NewPlanModal');
    console.log(`殻検出 ${shellFound.length} 件: ${shellFound.join(' ')}`);
    for (const n of HAND_WRITTEN) if (!wanted.has(n)) wanted.set(n, '手書き一覧');
    expect(routeComponents().length).toBeGreaterThan(20); // App.tsx の書式変更でルートが 0 件になる退行を落とす
    for (const r of routeComponents()) wanted.set(r.component, `ルート ${r.route}`);

    const missing = [...wanted].filter(([n]) => !known.has(n))
      .map(([n, why]) => `カタログに無い窓: ${n}(${why})(scripts/visual-regress/catalog/ に足すか _later.mjs に理由つきで書く)`);
    expect(missing, missing.join('\n')).toEqual([]);
    console.log(`coverage: 窓・画面 ${wanted.size} 件(うちルート ${routeComponents().length}、手書き ${HAND_WRITTEN.length})`);
  });
});
