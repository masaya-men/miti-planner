import { YServer } from "y-partyserver";
import type { Connection } from "partyserver";
import * as Y from "yjs";
import { buildSeedDoc, readMitigations } from "./yjsMitigations";
import { fetchMitigations, postMitigations } from "./collabPersistence";

/**
 * ライブ部屋 = 1 Durable Object。段取り②-a で YServer 化、段取り③で恒久保存。
 * - YServer が Y.Doc を握り Yjs sync protocol を話す(素のリレーは廃止)。
 * - hibernation ON: idle 時 duration 非課金($0 前提)。起床時は生存接続から再同期。
 * - 在室数は getConnections() ベース(hibernation でインスタンス変数は揮発するため)。
 * - onConnect は override しない(YServer の sync step1 送出を継承し、新規接続者へ既存状態を渡すため)。
 * - 段取り③ 保存層:
 *   - onLoad(): 受付係(Vercel)から現在の軽減配置を取得し Y.Doc を seed。
 *   - onSave(): 編集 debounce で受付係へ書き戻す(callbackOptions で頻度制御)。
 *   - onClose(): 最後の1人退室時に明示 flush(onSave は debounce のみで退室では発火しないため)。
 *   - 破壊保存ガード(#saveEnabled): seed が正常完了した部屋だけ保存可。墓標/不存在/障害では保存しない。
 */
interface CollabEnv {
  APP_API_BASE: string;
  COLLAB_SHARED_SECRET: string;
}

export class Room extends YServer {
  // hibernation を明示 ON(デフォルト OFF)。これが無いと WebSocket 接続中ずっと duration 課金。
  static options = { hibernate: true };

  // 保存頻度(③ 設計): 編集が 5s 落ち着いたら保存 / 連続編集でも最大 15s ごと。Firestore 書込最小化。
  static callbackOptions = { debounceWait: 5000, debounceMaxWait: 15000 };

  // 破壊保存ガード: seed が正常完了した部屋だけ保存可。墓標/不存在/障害(空 seed)では false のまま。
  #saveEnabled = false;

  private get collabEnv(): CollabEnv {
    return this.env as unknown as CollabEnv;
  }

  /** 受付係から seed 用の軽減配置を読む。live なら Y.Doc を組んで返し保存を解禁、それ以外は seed しない。 */
  override async onLoad(): Promise<Y.Doc | void> {
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    // 永続化が未設定なら何もしない(②-a 相当の揮発モードにフォールバック)。
    // 本番では secret 設定漏れ時の暴発防止、テストでは外部 fetch を起こさない密閉性を担保。
    if (!APP_API_BASE || !COLLAB_SHARED_SECRET) return;
    const mitigations = await fetchMitigations(APP_API_BASE, COLLAB_SHARED_SECRET, this.name);
    if (mitigations) {
      this.#saveEnabled = true; // 正常 seed できた部屋だけ保存解禁
      return buildSeedDoc(mitigations);
    }
    // null(墓標/不存在/障害): seed しない(空 Y.Doc のまま)。#saveEnabled は false で破壊保存を防ぐ。
  }

  /** 破壊保存ガード付きの書き戻し。skipped(墓標)を受けたら以後保存しない(削除が勝つ)。 */
  async flushSave(): Promise<void> {
    if (!this.#saveEnabled) return;
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    const result = await postMitigations(
      APP_API_BASE,
      COLLAB_SHARED_SECRET,
      this.name,
      readMitigations(this.document),
    );
    if (result === "skipped") this.#saveEnabled = false;
    // 'error' は次の debounce / onClose flush で再試行(ベストエフォート)。
  }

  /** 編集 debounce(callbackOptions)で発火。受付係へ書き戻す。 */
  override async onSave(): Promise<void> {
    await this.flushSave();
  }

  /** 接続クローズ。最後の1人が抜けたら明示 flush(onSave は退室では発火しないため最終保存を補う)。 */
  override async onClose(connection: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    await super.onClose(connection, code, reason, wasClean); // YServer の awareness クリーンアップ
    const remaining = [...this.getConnections()].filter((c) => c !== connection).length;
    if (remaining === 0) await this.flushSave();
  }

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
}
