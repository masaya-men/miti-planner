import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./vitest.setup.ts'],
        include: [
          'src/**/__tests__/**/*.test.ts',
          'src/**/__tests__/**/*.test.tsx',
          'api/**/__tests__/**/*.test.ts',
        ],
        // pool: 'vmThreads' (VM context で isolation)。
        //
        // 過去の試行:
        // - 'threads' (worker_threads): Firebase ESM singleton が境界を超える → 諦め
        // - 'vmThreads' (VM context): isolation はあるが、 vi.mock した module の cache が
        //   ファイル間で共有されてしまい mock pollution (= mock fn が file A の物を file B も
        //   見てしまう、 expect(mock).toHaveBeenCalled が false) が発生 → 2026-05-16 に forks へ移行
        // - 'vmThreads' + fileParallelism: false: pollution 残存
        // - 'forks': 各 file が完全独立のプロセスで動く → mock 完全独立 + Firebase ESM もOK
        //   しかし Node v24 で "Vitest failed to find the runner" により動作不可 (2026-05-20)
        // - 'vmThreads' (再採用): Node v24 対応。 pollution 再発リスクあり要監視。
        //
        // 唯一の代償はプロセス起動コスト。 全 ~70 ファイルでも実用範囲内。
        //
        // ⚠ vmThreads の落とし穴 (2026-05-21 特定): VM コンテキストは「実タイマー等の
        // ハンドルを残すテスト」を終了できず「RUN」表示のまま無限ハング→node ゾンビ化する。
        // teardownTimeout はスレッドを確実に kill できない。forks 時代は OS がプロセスごと
        // 殺すので起きなかった。フォーム全体を submit まで駆動する happy-dom テストが特に危険
        // (自動入力スタッガー setTimeout 等)。重い UI 駆動テストは置かず純関数ユニット＋実機で
        // カバーする。詳細は memory reference_vitest_vmthreads_hang。
        pool: 'vmThreads',
        // テスト無限待ち防止: Firebase App Check の async 初期化や、 Windows + npx wrapper 経由の
        // exit code 伝達失敗により vitest が無限ハングするケースを teardown で強制終了。
        // セッション 19 で過去セッションのゾンビ vitest プロセスが新規実行をブロックする問題が判明したため追加。
        testTimeout: 15000,
        hookTimeout: 15000,
        teardownTimeout: 5000,
    },
});
