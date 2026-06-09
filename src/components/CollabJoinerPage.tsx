import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { startCollabSession, type CollabSession } from "../lib/collab/collabProvider";
import { useCollabJoinerSession } from "../store/useCollabJoinerSession";
import { useMitigationStore } from "../store/useMitigationStore";
import { ErrorBoundary } from "./ErrorBoundary";
import Timeline from "./Timeline";

export type JoinerViewKind = "connecting" | "invalid" | "full" | "sheet";

/** ⑤-3b: 接続状態 → 表示種別(純粋・テスト可能)。full > invalid > connecting > sheet の優先度。 */
export function joinerView(s: { synced: boolean; invalid: boolean; full: boolean }): JoinerViewKind {
  if (s.full) return "full";
  if (s.invalid) return "invalid";
  if (!s.synced) return "connecting";
  return "sheet";
}

/** sync が来ない場合に invalid 扱いへ倒すまでの猶予(リンク無効/サーバ停止の最終フォールバック)。 */
const SYNC_TIMEOUT_MS = 15000;

/**
 * ⑤-3b ジョイナー読み取り専用ライブビュー。
 * `/collab/:roomToken` 専用ページ。通常アプリのシェル(Layout の自動保存)を通さず、
 * Timeline サブツリーだけを読み取り専用で描画する(無漏洩を構造で担保)。
 */
export default function CollabJoinerPage() {
  const { roomToken } = useParams<{ roomToken: string }>();
  const { t } = useTranslation();
  const [synced, setSynced] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!roomToken) {
      setInvalid(true);
      return;
    }
    // 読み取り専用フラグ ON → この間 store の localStorage persist は skip される(自分のデータ保護)。
    useMitigationStore.getState().setCollabReadonly(true);
    useCollabJoinerSession.getState().enter(roomToken);

    let session: CollabSession | null = null;
    let syncedLocal = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const onSync = (isSynced: boolean) => {
      if (!isSynced) return;
      syncedLocal = true;
      setSynced(true);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // 満員(⑤-2b onBeforeConnect 403)は sync 前の connection-close として表面化する。
    // sync 済み以降の切断(再接続)はライブ表示を維持するため無視。
    const onClose = () => {
      if (!syncedLocal) setFull(true);
    };

    try {
      session = startCollabSession(roomToken, {
        readOnly: true,
        onContentId: (id) => useCollabJoinerSession.getState().setContentId(id),
      });
      session.provider.on("sync", onSync);
      session.provider.on("connection-close", onClose);
      session.provider.on("connection-error", onClose);
      timeoutId = setTimeout(() => {
        if (!syncedLocal) setInvalid(true);
      }, SYNC_TIMEOUT_MS);
    } catch {
      setInvalid(true);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (session) {
        session.provider.off("sync", onSync);
        session.provider.off("connection-close", onClose);
        session.provider.off("connection-error", onClose);
        session.disconnect();
      }
      useCollabJoinerSession.getState().clear();
      // ⚠ 順序が重要: 先に rehydrate(readonly 中=書込 skip)で自分のソロ状態を store へ戻し、
      //    その後 readonly を解除する。逆順だと readonly 解除直後の state 変化で
      //    「部屋データ」を自分の localStorage に書き戻してしまう(partialize は全 PlanData)。
      void useMitigationStore.persist
        .rehydrate()
        ?.finally(() => useMitigationStore.getState().setCollabReadonly(false));
    };
  }, [roomToken]);

  const kind = joinerView({ synced, invalid, full });
  if (kind === "connecting") return <JoinerNotice text={t("collab.joiner_connecting")} />;
  if (kind === "invalid") return <JoinerNotice text={t("collab.joiner_invalid")} />;
  if (kind === "full") return <JoinerNotice text={t("collab.joiner_full")} />;
  // sheet: Layout を通さず Timeline サブツリーのみ(自動保存・サイドバー・プラン管理なし)。
  return (
    <div className="collab-joiner-shell w-full h-screen overflow-hidden bg-app-bg flex flex-col">
      <div className="flex-1 overflow-auto relative flex">
        <ErrorBoundary>
          <Timeline />
        </ErrorBoundary>
      </div>
    </div>
  );
}

function JoinerNotice({ text }: { text: string }) {
  return (
    <div className="collab-joiner-notice w-full h-screen bg-app-bg text-app-text flex items-center justify-center text-center px-6">
      <p className="text-app-text-muted">{text}</p>
    </div>
  );
}
