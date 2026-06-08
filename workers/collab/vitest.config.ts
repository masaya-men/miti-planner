import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        // wrangler.jsonc の DO binding / migration をそのままテスト環境へ読み込む。
        wrangler: { configPath: "./wrangler.jsonc" },
        // ⑤-2b: onLoad の seed fetch(と max 保存)を統合テストするため、
        // テスト env に COLLAB_SHARED_SECRET を与える(値はダミー)。実 fetch は
        // 各テストの fetchMock で intercept し、未 intercept は disableNetConnect で遮断する。
        miniflare: {
          bindings: { COLLAB_SHARED_SECRET: "test-secret" },
        },
        singleWorker: true,
        // new_sqlite_classes を使う DO では Windows 環境で SQLite ファイルが
        // テスト後もロックされ isolated storage のポップが EBUSY で失敗する。
        // isolatedStorage: false にすることで SQLite スナップショットを取らず回避。
        // 段取り①の WebSocket upgrade 検証テストは状態分離を必要としないため許容。
        // ⚠ テスト間で DO 状態が共有される。各テストは必ず異なる部屋名 (URL path) を
        //   使い、同名部屋の DO を複数テストで共有しないこと。WebSocket は各 it の
        //   末尾で close() して接続を残さないこと (在室数テスト等の汚染防止)。
        isolatedStorage: false,
      },
    },
  },
});
