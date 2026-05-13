import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
        // Firebase ESM モジュールは threads pool と相性が悪い（内部シングルトンがモック境界を越える）。
        // vmThreads は VM isolation を持ちつつ fork より軽量なため採用。
        pool: 'vmThreads',
        // テスト無限待ち防止: Firebase App Check の async 初期化や、 Windows + npx wrapper 経由の
        // exit code 伝達失敗により vitest が無限ハングするケースを teardown で強制終了。
        // セッション 19 で過去セッションのゾンビ vitest プロセスが新規実行をブロックする問題が判明したため追加。
        testTimeout: 15000,
        hookTimeout: 15000,
        teardownTimeout: 5000,
    },
});
