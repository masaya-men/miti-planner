/**
 * 検査: ファイル同士の循環 import(A が B を読み、B が A を読む)を新しく増やさない。
 *
 * 目的: 循環があると、読み込み順しだいで「まだ中身の無い値」を掴んで起動時に壊れたり、
 *   ファイルを分けても切り離せず整理が進まなくなる。全体リファクタの「理想の状態」は循環 0
 *   (方針=docs/.private/2026-10-27-lopo-refactor-ideal.md の②)。
 *
 * 方式(歯止め): src/ の import のつながりを lib/importGraph.ts で作り、madge の循環検出に渡して、
 *   見つかった循環を ALLOWED と突き合わせる。
 *   - ALLOWED に無い循環が出たら落ちる(新しく作った)。
 *   - ALLOWED にあるのに無くなった循環も落ちる(直したら ALLOWED から消す=許可を残さない)。
 *   ALLOWED は 0 件を目指して 1 件ずつ減らす。
 * 型だけの import(import type)の循環も数える(実行時は無害だが、ファイルを切り離せなくなる)。
 *   2026-10-27 の計測 9 件(実行時 4・型だけ 5)は同日にすべて解消した。
 * つながりを自前で作る理由: madge 本体の読み取りは約 2000 ファイルで 16〜40 秒かかり、
 *   全体テストの同時実行で 60 秒を超えてまれに落ちた。自前だと約 2 秒(結果は madge と一致を確認済み)。
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import madge from 'madge';
import { buildImportGraph } from './lib/importGraph';

const ROOT = join(__dirname, '..', '..');

/** 例外として許す循環(src からの相対・madge の表記)。2026-10-27 に 0 件へ解消済み。足すときは理由を添える */
const ALLOWED: string[] = [];

describe('循環 import の検査', () => {
  it('src の循環 import が許可リストと一致する(増えても、直したのに残っていても落ちる)', async () => {
    const res = await madge(buildImportGraph(join(ROOT, 'src')));
    const found = res.circular().map((c) => c.join(' > '));
    const added = found.filter((c) => !ALLOWED.includes(c));
    const fixed = ALLOWED.filter((c) => !found.includes(c));
    expect(added, '新しい循環 import(import の向きを一方通行に直す)').toEqual([]);
    expect(fixed, '直った循環(ALLOWED から消す)').toEqual([]);
  }, 60_000);

  it('検出器そのものの確認: 型だけの import も含めて循環を拾い、npm パッケージは無視する', async () => {
    const dir = fs.mkdtempSync(join(os.tmpdir(), 'circ-'));
    try {
      fs.writeFileSync(join(dir, 'a.ts'), "import { b } from './b';\nimport 'react';\nexport const a = b;\n");
      fs.writeFileSync(join(dir, 'b.ts'), "import type { a } from './a';\nexport const b = 1 as unknown as typeof a;\n");
      fs.writeFileSync(join(dir, 'c.ts'), 'export const c = 1;\n');
      const found = (await madge(buildImportGraph(dir))).circular().map((c) => c.join(' > '));
      expect(found).toEqual(['a.ts > b.ts']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
