import { routePartykitRequest } from "partyserver";

export { Room } from "./server";

export interface Env {
  Room: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // routePartykitRequest は env: Record<string, unknown> を要求する。
    // Env に index signature を足すと env.Room 以外の型ガードが緩むため、
    // 呼び出し側でキャストして Env 本体の型安全を保つ。
    return (
      (await routePartykitRequest(request, env as unknown as Record<string, unknown>)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
