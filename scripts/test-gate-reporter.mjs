// @ts-check
/**
 * test-gate-reporter.mjs — test-gate.mjs 専用の vitest レポーター。
 * 全テストファイルの結果がそろった瞬間に .vt-result.json を書く。vitest 標準の JSON レポーターは
 * 実行の最後(後片付けの後)に書くため、後片付けで止まる(本物の Firestore 接続が残る等)と永遠に書かれない。
 */
import fs from 'node:fs';
import path from 'node:path';

export default class TestGateReporter {
  total = 0;
  /** @type {{ file: string, state: string, failed: string[], passed: number, skipped: number, error: string }[]} */
  done = [];
  out = path.join(process.cwd(), '.vt-result.json');

  /** @param {ReadonlyArray<unknown>} specifications */
  onTestRunStart(specifications) {
    this.total = specifications.length;
    this.done = [];
  }

  /** @param {any} m TestModule */
  onTestModuleEnd(m) {
    const tests = [...m.children.allTests()];
    const st = (t) => t.result().state;
    this.done.push({
      file: path.relative(process.cwd(), m.moduleId),
      state: m.state(),
      failed: tests.filter((t) => st(t) === 'failed').map((t) => t.fullName),
      passed: tests.filter((t) => st(t) === 'passed').length,
      skipped: tests.filter((t) => st(t) === 'skipped' || st(t) === 'pending').length,
      error: m.errors().map((e) => String(e.message ?? e).split('\n')[0]).join(' / '),
    });
    if (this.total > 0 && this.done.length >= this.total) this.write();
  }

  onTestRunEnd() {
    this.write();
  }

  write() {
    fs.writeFileSync(this.out, JSON.stringify({ total: this.total, modules: this.done }));
  }
}
