import { YServer } from "y-partyserver";
import type { Connection, ConnectionContext } from "partyserver";
import * as Y from "yjs";
import { buildSeedDocFull, readPlanDataFull } from "./yjsPlanData";
import { fetchSeedFull, postPlanData } from "./collabPersistence";
import { resolveMaxParticipants, MAX_PARTICIPANTS_KEY } from "./collabCapacity";
import { EDITOR_UID_HEADER, isEditorState } from "./collabAuth";
import { saveDocBinary, loadDocBinary, clearDocBinary, type KVLike } from "./docPersistence";
import { shouldSyncFirestore } from "./saveThrottle";

/**
 * ライブ部屋 = 1 Durable Object。段取り②-a で YServer 化、段取り③で恒久保存。
 * - YServer が Y.Doc を握り Yjs sync protocol を話す(素のリレーは廃止)。
 * - hibernation ON: idle 時 duration 非課金($0 前提)。起床時は生存接続から再同期。
 * - 在室数は getConnections() ベース(hibernation でインスタンス変数は揮発するため)。
 * - onConnect は override しない(YServer の sync step1 送出を継承し、新規接続者へ既存状態を渡すため)。
 * - 段取り③ 保存層:
 *   - onLoad(): 受付係(Vercel)から現在の軽減配置を取得し Y.Doc を seed。
 *   - onSave(): 編集 debounce で発火(callbackOptions で頻度制御)。DO ストレージへは毎回保存、
 *     Firestore への書き戻しは FIRESTORE_SYNC_MIN_INTERVAL_MS 未満なら間引く(2026-08-12・後述)。
 *   - onClose(): 最後の1人退室時に明示 flush(強制 Firestore 反映。onSave は debounce のみで退室では発火しないため)。
 *   - 破壊保存ガード(#saveEnabled): seed が正常完了した部屋だけ保存可。墓標/不存在/障害では保存しない。
 *
 * 2026-08-12 コスト改善: 保存は元々「DOストレージ(Cloudflare側・無料)」と「Firestore反映(Vercel経由・
 * 有料枠を消費)」の2層があり、どちらも同じ debounce(最長15秒)で一緒に動いていた。実測で Firestore 反映
 * (/api/collab)が Vercel の Fluid Active CPU 使用量の大半を占めていたため、DOストレージへの保存は
 * 従来どおり毎回(こまめな保護は維持)、Firestore への反映だけ間引く形に分離した。ソロ機能の自動保存
 * (Firestore への定期バックアップ=5分間隔)と同じ考え方に揃えている(src/components/Layout.tsx 参照)。
 * 全員退室時(onClose)は間引かず必ず即時反映する(タブを閉じる=確実に保存、という体験は変えない)。
 */
interface CollabEnv {
  APP_API_BASE: string;
  COLLAB_SHARED_SECRET: string;
}

/** 失効済みフラグ(deleteAll の後に立てる=ストレージに残り、ハイバネ/退避を越えて再接続を拒否)。 */
const DESTROYED_KEY = "__collab_destroyed";
/** 失効クローズのコード(WebSocket アプリ専用域 4000-4999)。クライアントはこれを見て再接続を止める。 */
const REVOKED_CLOSE_CODE = 4001;

export class Room extends YServer {
  // hibernation を明示 ON(デフォルト OFF)。これが無いと WebSocket 接続中ずっと duration 課金。
  static options = { hibernate: true };

  // 保存頻度(③ 設計): 編集が 5s 落ち着いたら保存 / 連続編集でも最大 15s ごと。DOストレージ保存はこの頻度のまま。
  static callbackOptions = { debounceWait: 5000, debounceMaxWait: 15000 };

  // 破壊保存ガード: seed が正常完了した部屋だけ保存可。墓標/不存在/障害(空 seed)では false のまま。
  #saveEnabled = false;
  // 直近で Firestore へ反映を試みた時刻(ms)。0 = 未実施(初回は必ず反映する)。
  #lastFirestoreSyncAt = 0;

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

  /** DO ストレージへの保存だけを行う(CRDT の真実・Cloudflare 側で完結・Vercel コストと無関係)。
   *  onSave のたび毎回実施する(こまめな保護は従来どおり)。 */
  private async saveBinaryOnly(): Promise<void> {
    if (!this.#saveEnabled) return;
    const storage = this.ctx.storage as unknown as KVLike;
    // DO KV 障害で投げても Worker をクラッシュさせず、次の debounce/onClose で再試行（JSON 側と対称のベストエフォート）。
    // saveDocBinary は meta を最後に書くため、途中失敗しても loadDocBinary は meta 欠如で null を返し JSON seed に安全フォールバックする。
    try {
      await saveDocBinary(storage, Y.encodeStateAsUpdate(this.document));
    } catch (e) {
      console.error("collab: saveDocBinary failed (best-effort, will retry):", e);
    }
  }

  /** JSON 射影を Firestore へ反映する(ソロ機能が読む / 別部屋の初回 seed 元)。
   *  force=false のときは shouldSyncFirestore の判定で間引く(コスト対策・2026-08-12)。
   *  skipped(墓標)を受けたら以後保存せず、バイナリも破棄する（削除が勝つ）。 */
  private async syncFirestore(force: boolean): Promise<void> {
    if (!this.#saveEnabled) return;
    if (!shouldSyncFirestore(force, this.#lastFirestoreSyncAt, Date.now())) return;
    const { APP_API_BASE, COLLAB_SHARED_SECRET } = this.collabEnv;
    const result = await postPlanData(APP_API_BASE, COLLAB_SHARED_SECRET, this.name, readPlanDataFull(this.document));
    this.#lastFirestoreSyncAt = Date.now();
    if (result === "skipped") {
      this.#saveEnabled = false;
      const storage = this.ctx.storage as unknown as KVLike;
      await clearDocBinary(storage); // 墓標 = この部屋は死んだ。バイナリも残さない。
    }
    // 'error' は次の debounce / onClose flush で再試行（ベストエフォート）。
  }

  /** DOストレージ保存(常時) + Firestore反映(force=trueなら強制、それ以外は間引き)。 */
  async flushSave(force = false): Promise<void> {
    await this.saveBinaryOnly();
    await this.syncFirestore(force);
  }

  /** 編集 debounce(callbackOptions)で発火。DOストレージは毎回、Firestoreは間引いて受付係へ書き戻す。 */
  override async onSave(): Promise<void> {
    await this.flushSave(false);
  }

  /**
   * ④-a: 接続確立時に編集権を記録する。super を必ず呼び YServer の sync step1 送出を維持
   * (新規接続者へ既存状態を渡す)。信頼ヘッダ(x-collab-uid)は fetch ハンドラが検証済みで
   * クライアントは詐称できない。state は merge(awareness 用 state を壊さない)。
   */
  override async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
    // 失効済みの部屋は新規接続を即拒否する(暖かい DO への再接続も塞ぐ=リンク失効後は二度と入れない)。
    // sync(super.onConnect)を呼ぶ前に閉じる=部屋の中身を一切渡さない。
    if (await this.ctx.storage.get(DESTROYED_KEY)) {
      conn.close(REVOKED_CLOSE_CODE, "revoked");
      return;
    }
    await super.onConnect(conn, ctx);
    const uid = ctx.request.headers.get(EDITOR_UID_HEADER);
    if (uid) {
      // onConnect 時点では awareness 用 state は未設定(awareness メッセージは接続後)。
      // 既存 state を merge して collabEditor を足す(将来 state が入っても壊さない)。
      conn.setState({ ...(conn.state as Record<string, unknown> | null), collabEditor: uid });
    }
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
    if (remaining === 0) await this.flushSave(true); // 全員退室 = Firestore反映も間引かず必ず実施
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
      // #3d: 人数はハイバネを越えて保持される接続リスト(getConnections)が真実(Cloudflare 公式)。
      //   ブラウザが入退室時だけ取得して確実な人数を出すため CORS を許可する(count/max は非機微・
      //   部屋トークンを知る者は元々接続できるので * で可)。単純 GET = プリフライト不要。
      return Response.json(
        { count, max: resolveMaxParticipants(stored) },
        { headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    if (url.pathname.endsWith("/set-max")) {
      // オーナーが人数上限を変更したとき Vercel 受付係から叩かれる（クライアントは到達不可）。
      // 共有シークレットで認証し、DO のストレージを即時更新する。/count はこの値を返すため
      // 次の接続から新しい上限が有効になる（部屋の再起動不要）。
      const secret = request.headers.get("x-collab-secret");
      if (!this.collabEnv.COLLAB_SHARED_SECRET || secret !== this.collabEnv.COLLAB_SHARED_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      const n = Number(url.searchParams.get("n"));
      const clamped = resolveMaxParticipants(n);
      await this.ctx.storage.put(MAX_PARTICIPANTS_KEY, clamped);
      return Response.json({ max: clamped });
    }
    if (url.pathname.endsWith("/destroy")) {
      // 失効/再発行で受付係(Vercel)が叩く。共有シークレットで認証（クライアントは到達不可）。
      const secret = request.headers.get("x-collab-secret");
      if (!this.collabEnv.COLLAB_SHARED_SECRET || secret !== this.collabEnv.COLLAB_SHARED_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }
      this.#saveEnabled = false;          // 以後の debounce save を止める(空上書き防止)
      await this.ctx.storage.deleteAll(); // バイナリ・max・チャンクを丸ごと破棄
      await this.ctx.storage.put(DESTROYED_KEY, true); // deleteAll の後に失効フラグ=再接続拒否が残る
      // 失効=即・全員退出。既存の接続を全部閉じる(クライアントは再接続せず終了表示)。
      // onClose の flushSave は #saveEnabled=false で no-op=空保存しない。
      for (const conn of [...this.getConnections()]) {
        try { conn.close(REVOKED_CLOSE_CODE, "revoked"); } catch { /* 既に閉じている等は無視 */ }
      }
      return Response.json({ destroyed: true });
    }
    return new Response("Not Found", { status: 404 });
  }
}
