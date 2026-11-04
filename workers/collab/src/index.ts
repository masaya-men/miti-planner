import { routePartykitRequest } from "partyserver";
import { isRoomFull } from "./collabCapacity";
import { verifyToken, authorizeConnection } from "./collabAuth";

export { Room } from "./server";

export interface Env {
  Room: DurableObjectNamespace;
  /** 受付係(Vercel)アプリのオリジン。例: https://lopoly.app */
  APP_API_BASE: string;
  /** DO↔Vercel のサーバー間共有シークレット(wrangler secret で投入)。 */
  COLLAB_SHARED_SECRET: string;
}

/**
 * 満員なら upgrade を拒否する(段取り⑤-2b の安全弁)。
 * onBeforeConnect は DO ルーティングの前に走るため、ここで返す Response は DO に届かず接続を断つ。
 * 在室数(count)と上限(max)は対象 DO の GET /count から 1 往復で取得する
 * (max は onLoad が storage に保存した値・hibernation 安全)。
 * 判定や問い合わせが失敗したら接続を許可する(fail-open): 安全弁の一時障害で
 * 正規ユーザーを締め出さない(設計書 §11 の soft enforcement と整合)。
 */
async function rejectIfRoomFull(env: Env, roomName: string): Promise<Response | void> {
  try {
    const stub = env.Room.get(env.Room.idFromName(roomName));
    const res = await stub.fetch("https://do.internal/count");
    const { count, max } = await res.json<{ count: number; max: number }>();
    if (isRoomFull(count, max)) {
      return new Response("room full", { status: 403 });
    }
  } catch {
    // fail-open: 接続を許可する。
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // partyserver 0.5.x は DO 内で ctx.id.name からルーム名を解決するが、
    // Miniflare/古い workerd では ctx.id.name が露出しない。partyserver の
    // フォールバック (x-partykit-room ヘッダ) を我々が補ってテスト/本番両対応にする。
    // 本番では ctx.id.name が優先されるため、このヘッダは無害(フォールバックのみ)。
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean); // ["parties","room","<id>"]
    if (parts[0] === "parties" && parts.length >= 3) {
      const room = parts[2];
      const req = new Request(request);
      req.headers.set("x-partykit-room", room);
      // ④-a: WS upgrade(実接続)のみ認可する。token を verify し、編集者なら信頼ヘッダ
      //   (x-collab-uid)を付与・クライアント由来の同名ヘッダは除去(詐称防止・fail-closed)。
      //   ここで request を仕立てておくことで onBeforeConnect は満員判定のみ(void 返し)に保て、
      //   partyserver の DO 名前バインド(__ps_name)を壊さない(Request を返すと壊れるため)。
      //   /count 等(Upgrade 無し)は対象外。
      if (req.headers.get("Upgrade")?.toLowerCase() === "websocket") {
        // req(可変ヘッダのコピー)を in-place 認可。二重コピーしないので名前バインドは無傷。
        await authorizeConnection(req, (t) =>
          verifyToken(env.APP_API_BASE, env.COLLAB_SHARED_SECRET, t),
        );
      }
      request = req;
    }
    // routePartykitRequest は env: Record<string, unknown> を要求する。
    // Env に index signature を足すと env.Room 以外の型ガードが緩むため、
    // 呼び出し側でキャストして Env 本体の型安全を保つ。
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>, {
        // 接続前の満員判定のみ(認可は fetch ハンドラ冒頭で request に仕立て済み)。
        // ここで Request を返すと DO 名前バインドが壊れるため void/Response のみ返す。
        onBeforeConnect: (_req: Request, lobby: { name: string }) => rejectIfRoomFull(env, lobby.name),
      })) || new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
