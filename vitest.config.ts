import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
        // pool: 'forks' (各テストファイルを別プロセスで実行)。
        //
        // 過去の試行:
        // - 'threads' (worker_threads): Firebase ESM singleton が境界を超える → 諦め
        // - 'vmThreads' (VM context): isolation はあるが、 vi.mock した module の cache が
        //   ファイル間で共有されてしまい mock pollution (= mock fn が file A の物を file B も
        //   見てしまう、 expect(mock).toHaveBeenCalled が false) が発生
        // - 'vmThreads' + fileParallelism: false: pollution 残存
        // - 'forks': 各 file が完全独立のプロセスで動く → mock 完全独立 + Firebase ESM もOK
        //
        // 唯一の代償はプロセス起動コスト。 全 ~70 ファイルでも実用範囲内。
        pool: 'forks',
        // テスト無限待ち防止: Firebase App Check の async 初期化や、 Windows + npx wrapper 経由の
        // exit code 伝達失敗により vitest が無限ハングするケースを teardown で強制終了。
        // セッション 19 で過去セッションのゾンビ vitest プロセスが新規実行をブロックする問題が判明したため追加。
        testTimeout: 15000,
        hookTimeout: 15000,
        teardownTimeout: 5000,
    },
});
