import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";

/**
 * ライブ部屋。1部屋 = 1 Durable Object。
 * 段取り①では「接続を受け、メッセージを他の在室者へ中継し、在室数を答える」骨組み。
 * Yjs / Firestore / 認証 / presence は後続段取りで上に乗せる。
 */
export class Room extends Server {
  /**
   * 現在の在室接続数。
   * getConnections() は close 後の反映タイミングが不安定なため、
   * onConnect/onClose で明示的にカウントする。
   * 後続段取り③ (最後の1人が抜けたら保存) でも活用できる設計。
   */
  private _connectionCount = 0;

  // 接続が確立したとき。在室カウントをインクリメント。
  onConnect(_connection: Connection, _ctx: ConnectionContext): void {
    this._connectionCount++;
  }

  // 接続が閉じたとき。在室カウントをデクリメント。
  onClose(
    _connection: Connection,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): void {
    if (this._connectionCount > 0) {
      this._connectionCount--;
    }
  }

  // 在室者からメッセージが来たら、送信者以外の全員へ中継する。
  onMessage(connection: Connection, message: WSMessage): void {
    this.broadcast(message, [connection.id]);
  }

  // 通常HTTP。段取り①では在室数の確認だけ (デバッグ/疎通用)。
  onRequest(_request: Request): Response {
    const url = new URL(_request.url);
    if (url.pathname.endsWith("/count")) {
      return Response.json({ count: this._connectionCount });
    }
    return new Response("Not Found", { status: 404 });
  }
}
