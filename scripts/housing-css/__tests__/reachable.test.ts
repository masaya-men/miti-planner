import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { cssImportOrder, reachable } from '../reachable.mjs';

const files: Record<string, string> = {
  'src/main.tsx': "import App from './App';\nimport './index.css';",
  'src/App.tsx': "import { A } from './a/A';\nconst L = lazy(() => import('./lazy/L'));\nexport { x } from './b';",
  'src/a/A.tsx': "import {\n  y,\n} from '../util';",
  'src/util.ts': '',
  'src/b/index.ts': '',
  'src/lazy/L.tsx': "import { A } from '../a/A';\nimport { M } from './M';",
  'src/lazy/M.tsx': '',
  'src/dead/D.tsx': "import { A } from '../a/A';",
};
const run = () => reachable('src/main.tsx', (f: string) => files[f], (f: string) => f in files);

describe('reachable', () => {
  it('普通の import(複数行・export from・index 解決)をたどる', () => {
    const { staticFiles } = run();
    expect([...staticFiles].sort()).toEqual(['src/App.tsx', 'src/a/A.tsx', 'src/b/index.ts', 'src/main.tsx', 'src/util.ts']);
  });
  it('import() の先は dynamic に分け、 static に届くものは含めない', () => {
    expect([...run().dynamicFiles].sort()).toEqual(['src/lazy/L.tsx', 'src/lazy/M.tsx']);
  });
  it('import type だけのつながりはたどらない', () => {
    const f: Record<string, string> = { 'src/main.tsx': "import type { T } from './T';\nexport type { U } from './U';", 'src/T.tsx': '', 'src/U.tsx': '' };
    expect([...reachable('src/main.tsx', (p: string) => f[p], (p: string) => p in f).staticFiles]).toEqual(['src/main.tsx']);
  });
  it('どこからも読まれないファイルはどちらにも入らない', () => {
    const r = run();
    expect(r.staticFiles.has('src/dead/D.tsx') || r.dynamicFiles.has('src/dead/D.tsx')).toBe(false);
  });
});

describe('cssImportOrder', () => {
  // ESM は import 文の順に依存先を先に評価する。 CSS はその評価順でビルドに並ぶ(Vite)
  const f: Record<string, string> = {
    'src/main.tsx': "import './base.css';\nimport { A } from './A';\nimport { B } from './B';",
    'src/A.tsx': "import { B } from './B';\nimport './A.css';",
    'src/B.tsx': "import './B.css';",
  };
  const order = () => cssImportOrder('src/main.tsx', (p: string) => f[p], (p: string) => p in f);
  it('import 文の順・深さ優先で CSS の並びを出す', () => {
    expect(order()).toEqual(['src/base.css', 'src/B.css', 'src/A.css']);
  });
  it('2 回目以降の import は並びを変えない', () => {
    expect(order().filter((p: string) => p === 'src/B.css')).toHaveLength(1);
  });
});
