import { describe, expect, it } from 'vitest';
// @ts-expect-error mjs の共通部品(型定義なし)
import { reachable } from '../reachable.mjs';

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
  it('どこからも読まれないファイルはどちらにも入らない', () => {
    const r = run();
    expect(r.staticFiles.has('src/dead/D.tsx') || r.dynamicFiles.has('src/dead/D.tsx')).toBe(false);
  });
});
