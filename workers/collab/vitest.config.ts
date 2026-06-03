import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // wrangler.jsonc の DO binding / migration をそのままテスト環境へ読み込む。
        wrangler: { configPath: "./wrangler.jsonc" },
        singleWorker: true,
        // new_sqlite_classes を使う DO では Windows 環境で SQLite ファイルが
        // テスト後もロックされ isolated storage のポップが EBUSY で失敗する。
        // isolatedStorage: false にすることで SQLite スナップショットを取らず回避。
        // 段取り①の WebSocket upgrade 検証テストは状態分離を必要としないため許容。
        isolatedStorage: false,
      },
    },
  },
});
