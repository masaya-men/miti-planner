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
    },
});
