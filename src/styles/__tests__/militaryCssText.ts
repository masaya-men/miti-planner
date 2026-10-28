import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readCssBundle } from './readCssBundle';

// MIL-SPEC の CSS 全部を 1 つの文字列で返す(テスト用)。 規則の在りかに依らず「MIL-SPEC の見た目にこの規則がある」を確かめるため。
// = 入口 src/styles/military.css(@import を展開した土台)+ src/components/military の部品の隣の CSS(パス順)。改行は LF にそろえる。
const ROOT = resolve(__dirname, '../../..');

function componentCss(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') componentCss(p, out);
    } else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

export function militaryCssText(): string {
  const parts = [readCssBundle(join(ROOT, 'src/styles/military.css')), ...componentCss(join(ROOT, 'src/components/military')).sort().map((f) => readFileSync(f, 'utf8'))];
  return parts.join('\n').replace(/\r\n/g, '\n');
}
