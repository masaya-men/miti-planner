import { YServer } from "y-partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import * as Y from "yjs";
import { buildSeedDocFull, readPlanDataFull } from "./yjsPlanData";
import { fetchSeedFull, postPlanData } from "./collabPersistence";
import { resolveMaxParticipants, MAX_PARTICIPANTS_KEY } from "./collabCapacity";
import { EDITOR_UID_HEADER, isEditorState } from "./collabAuth";
import { saveDocBinary, loadDocBinary, type KVLike } from "./docPersistence";

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

  /** 部屋の Yjs バイナリが DO ストレージにあれば identity を保って復元（再 seed 合流＝列増殖を起こさない）。
   *  無ければ初回ロード扱いで Firestore JSON から seed し、直後にバイナリを確定する。 */
  override async onLoad(): Promise<Y.Doc | void> {
    const storage = this.ctx.storage as unknown as KVLike;
    // 1) バイナリ復元（2 回目以降のロード・ハイバネ復帰）。
    const persisted = await loadDocBinary(storage);
    if (persisted) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, persisted);
      this.#saveEnabled = true; // 復元できた = 正常な部屋
      return doc;
    }
    // 2) 初回ロード: Firestore JSON から seed。
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    // 永続化が未設定なら何もしない(②-a 相当の揮発モードにフォールバック)。
    // 本番では secret 設定漏れ時の暴発防止、テストでは外部 fetch を起こさない密閉性を担保。
    if (!APP_API_BASE || !COLLAB_SHARED_SECRET) return;
    const seed = await fetchSeedFull(APP_API_BASE, COLLAB_SHARED_SECRET, this.name);
    if (seed) {
      this.#saveEnabled = true; // 正常 seed できた部屋だけ保存解禁
      // 上限値は hibernation で揮発するインスタンス変数でなく永続ストレージに置く
      // (接続が存在する間ずっと /count で参照されるため wake 後も復元が要る)。
      await this.ctx.storage.put(MAX_PARTICIPANTS_KEY, resolveMaxParticipants(seed.maxParticipants));
      const doc = buildSeedDocFull(seed);
      // 初回バイナリを確定（次回ロードはこのバイナリから復元＝再 seed しない）。
      await saveDocBinary(storage, Y.encodeStateAsUpdate(doc));
      return doc;
    }
    // null(墓標/不存在/障害): seed しない(空 Y.Doc のまま)。#saveEnabled は false で破壊保存を防ぐ。
    // max も書かない(/count は既定 8 を返す)。
  }

  /** 破壊保存ガード付きの書き戻し。skipped(墓標)を受けたら以後保存しない(削除が勝つ)。 */
  async flushSave(): Promise<void> {
    if (!this.#saveEnabled) return;
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    const result = await postPlanData(
      APP_API_BASE,
      COLLAB_SHARED_SECRET,
      this.name,
      readPlanDataFull(this.document),
    );
    if (result === "skipped") this.#saveEnabled = false;
    // 'error' は次の debounce / onClose flush で再試行(ベストエフォート)。
  }

  /** 編集 debounce(callbackOptions)で発火。受付係へ書き戻す。 */
  override async onSave(): Promise<void> {
    await this.flushSave();
  }

  /**
   * ④-a: 接続確立時に編集権を記録する。super を必ず呼び YServer の sync step1 送出を維持
   * (新規接続者へ既存状態を渡す)。信頼ヘッダ(x-collab-uid)は fetch ハンドラが検証済みで
   * クライアントは詐称できない。state は merge(awareness 用 state を壊さない)。
   */
  override onConnect(conn: Connection, ctx: ConnectionContext): void | Promise<void> {
    const ret = super.onConnect(conn, ctx);
    const uid = ctx.request.headers.get(EDITOR_UID_HEADER);
    if (uid) {
      // onConnect 時点では awareness 用 state は未設定(awareness メッセージは接続後)。
      // 既存 state を merge して collabEditor を足す(将来 state が入っても壊さない)。
      conn.setState({ ...(conn.state as Record<string, unknown> | null), collabEditor: uid });
    }
    return ret;
  }

  /**
   * ④-a: 編集者(認証済み)でない接続は読み取り専用。
   * y-partyserver はこれが true の接続の sync step2/update を破棄する(書込をサーバが拒否)。
   */
  override isReadOnly(connection: Connection): boolean {
    return !isEditorState(connection.state);
  }

  /** 接続クローズ。最後の1人が抜けたら明示 flush(onSave は退室では発火しないため最終保存を補う)。 */
  override async onClose(connection: Connection, code: number, reason: string, wasClean: boolean): Promise<void> {
    await super.onClose(connection, code, reason, wasClean); // YServer の awareness クリーンアップ
    const remaining = [...this.getConnections()].filter((c) => c !== connection).length;
    if (remaining === 0) await this.flushSave();
  }

  // 在室数 + 上限 HTTP。onBeforeConnect(index.ts)が接続前に GET /count で満員判定する。
  // count: getConnections()(ctx.getWebSockets() ベース・hibernation 安全)。
  // max: onLoad が storage に書いた値(未保存なら既定 8)。
  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/count")) {
      let count = 0;
      for (const _ of this.getConnections()) count++;
      const stored = await this.ctx.storage.get<number>(MAX_PARTICIPANTS_KEY);
      return Response.json({ count, max: resolveMaxParticipants(stored) });
    }
    return new Response("Not Found", { status: 404 });
  }
}
