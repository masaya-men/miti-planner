import { routePartykitRequest } from "partyserver";

export { Room } from "./server";

export interface Env {
  Room: DurableObjectNamespace;
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
      request = req;
    }
    // routePartykitRequest は env: Record<string, unknown> を要求する。
    // Env に index signature を足すと env.Room 以外の型ガードが緩むため、
    // 呼び出し側でキャストして Env 本体の型安全を保つ。
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
