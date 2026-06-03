import { routePartykitRequest } from "partyserver";

export { Room } from "./server";

export interface Env {
  Room: DurableObjectNamespace;
  // routePartykitRequest が Record<string, unknown> を要求するため index signature を追加
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ||
      new Response("Not Found", { status: 404 })
    );
  },
} satisfies ExportedHandler<Env>;
