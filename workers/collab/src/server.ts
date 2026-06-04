import { YServer } from "y-partyserver";
import type { Connection, ConnectionContext } from "partyserver";

/**
 * ライブ部屋 = 1 Durable Object。段取り②-a で YServer 化。
 * - YServer が Y.Doc を握り Yjs sync protocol を話す(素のリレーは廃止)。
 * - hibernation ON: idle 時 duration 非課金($0 前提)。起床時は生存接続から再同期。
 * - 在室数は getConnections() ベース(hibernation でインスタンス変数は揮発するため)。
 * - onLoad/onSave は未実装 = 全員退室で Y.Doc 揮発(設計書 §5 の許容範囲)。恒久保存は段取り③。
 * - TODO(段取り③): 「最後の1人が抜けたら Firestore 保存」実装時は onError でも在室整合させる。
 */
export class Room extends YServer {
  // hibernation を明示 ON(デフォルト OFF)。これが無いと WebSocket 接続中ずっと duration 課金。
  static options = { hibernate: true };

  // 在室数 HTTP。WebSocket 接続中に GET /count で現在の接続数を返す。
  // getConnections() は ctx.getWebSockets() ベースで hibernation 安全。
  override onRequest(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      let count = 0;
      for (const _ of this.getConnections()) count++;
      return Response.json({ count });
    }
    return new Response("Not Found", { status: 404 });
  }

  override onConnect(_connection: Connection, _ctx: ConnectionContext): void {
    // 段取り①の _connectionCount++ は撤去(getConnections() で代替)。
    // 接続ライフサイクルのフックは hibernation 起床後も呼ばれる(partyserver 仕様)。
  }
}
