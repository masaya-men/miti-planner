import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";

/**
 * ライブ部屋。1部屋 = 1 Durable Object。
 * 段取り①では「接続を受け、メッセージを他の在室者へ中継する」だけの骨組み。
 * Yjs / Firestore / 認証 / presence は後続段取りで上に乗せる。
 */
export class Room extends Server {
  // 接続が確立したとき。段取り①では受け入れるだけ。
  onConnect(_connection: Connection, _ctx: ConnectionContext): void {}

  // 在室者からメッセージが来たら、送信者以外の全員へ中継する。
  onMessage(connection: Connection, message: WSMessage): void {
    this.broadcast(message, [connection.id]);
  }
}
