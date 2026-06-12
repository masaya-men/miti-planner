import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { startCollabSession, type CollabSession } from "../lib/collab/collabProvider";
import { useCollabJoinerSession } from "../store/useCollabJoinerSession";
import { useMitigationStore } from "../store/useMitigationStore";
import { useAuthStore } from "../store/useAuthStore";
import { hasCollabEditConsent, setCollabEditConsent } from "../lib/collabEditConsent";
import { CollabEditConsentModal } from "./CollabEditConsentModal";
import { CollabJoinerBanner } from "./CollabJoinerBanner";
import { CollabJoinerHeader } from "./CollabJoinerHeader";
import { PresenceControls } from "./collab/PresenceControls";
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

/** ⑤-3c: 編集可否（ログイン && 部屋ごと同意）。 */
export function computeCanEdit(isLoggedIn: boolean, hasConsent: boolean): boolean {
  return isLoggedIn && hasConsent;
}

/**
 * 退室 cleanup: rehydrate(readonly 中=書込 skip で自分のソロ state を store へ戻す)→ 完了後に readonly 解除。
 * zustand persist は **同期 storage のとき `.finally` を持たない最小 thenable** を返す
 * (useMitigationStore は同期 storage)。素朴な `rehydrate()?.finally(...)` は `?.` が短絡せず
 * crash する(本番のページ離脱 / dev StrictMode 二重 unmount で顕在化)。Promise.resolve でラップし、
 * 戻り値が Promise でも最小 thenable でも undefined でも `.finally` を安全に使えるようにする。
 * 順序(rehydrate → readonly off)は維持される(rehydrate の同期処理は呼び出し時に完了済み)。
 */
export function rehydrateThenClearReadonly(
  rehydrate: () => unknown,
  clearReadonly: () => void,
): Promise<unknown> {
  return Promise.resolve(rehydrate()).finally(clearReadonly);
}

/** sync が来ない場合に invalid 扱いへ倒すまでの猶予(リンク無効/サーバ停止の最終フォールバック)。 */
const SYNC_TIMEOUT_MS = 15000;

/**
 * ⑤-3b/⑤-3c ジョイナーのライブビュー。
 * `/collab/:roomToken` 専用ページ。通常アプリのシェル(Layout の自動保存)を通さず、
 * Timeline サブツリーだけを描画する(無漏洩を構造で担保)。
 * ⑤-3c: ログイン && 部屋ごと同意で編集者へ昇格(readOnly:false で再接続)。
 *   - 「自分の localStorage 保護(persist skip = _collabReadonly)」は canEdit と独立に常時 ON。
 *   - 編集解禁は WebSocket セッションの readOnly を切り替えるだけ(永続化方針は不変)。
 */
export default function CollabJoinerPage() {
  const { roomToken } = useParams<{ roomToken: string }>();
  const { t } = useTranslation();
  const [synced, setSynced] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [full, setFull] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isLoggedIn = user !== null;
  const [hasConsent, setHasConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentPrompted, setConsentPrompted] = useState(false);
  const ownerLabel = useCollabJoinerSession((s) => s.ownerLabel);

  const canEdit = computeCanEdit(isLoggedIn, hasConsent);
  // 「一度でも sync したか」を session 再接続(canEdit 切替)を跨いで保持。再接続時に
  // 「接続中」へ戻したり timeout で invalid に倒したりしないためのガード。
  const syncedEverRef = useRef(false);

  // 効果A: persist skip(自分のローカル保護)+ ジョイナー入室 + 退室クリーンアップ。
  // canEdit と独立に部屋に居る間ずっと ON。deps は roomToken のみ(編集解禁では再実行しない)。
  useEffect(() => {
    if (!roomToken) {
      setInvalid(true);
      return;
    }
    useMitigationStore.getState().setCollabReadonly(true);
    useCollabJoinerSession.getState().enter(roomToken);
    setHasConsent(hasCollabEditConsent(roomToken));
    setConsentPrompted(false);
    syncedEverRef.current = false;

    return () => {
      useCollabJoinerSession.getState().clear();
      // ⚠ 順序が重要: 先に rehydrate(readonly 中=書込 skip)で自分のソロ状態を store へ戻し、
      //    その後 readonly を解除する。逆順だと readonly 解除直後の state 変化で
      //    「部屋データ」を自分の localStorage に書き戻してしまう(partialize は全 PlanData)。
      //    rehydrate() の戻り値は同期 storage で .finally 無しの最小 thenable のため helper でラップ。
      void rehydrateThenClearReadonly(
        () => useMitigationStore.persist.rehydrate(),
        () => useMitigationStore.getState().setCollabReadonly(false),
      );
    };
  }, [roomToken]);

  // 効果B: WebSocket セッション。readOnly は canEdit に連動。canEdit 切替で張り直す
  // (cleanup で旧セッション disconnect → 新 readOnly で再接続)。persist skip(効果A)は触らない。
  useEffect(() => {
    if (!roomToken) return;
    // Timeline の readOnly 判定が参照する canEdit を session の readOnly と一致させる。
    useCollabJoinerSession.getState().setCanEdit(canEdit);

    let session: CollabSession | null = null;
    let syncedLocal = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const onSync = (isSynced: boolean) => {
      if (!isSynced) return;
      syncedLocal = true;
      syncedEverRef.current = true;
      setSynced(true);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // 満員(⑤-2b onBeforeConnect 403)は sync 前の connection-close として表面化する。
    // sync 済み以降の切断(再接続)はライブ表示を維持するため無視。
    const onClose = () => {
      if (!syncedLocal && !syncedEverRef.current) setFull(true);
    };

    try {
      session = startCollabSession(roomToken, {
        readOnly: !canEdit,
        onContentId: (id) => useCollabJoinerSession.getState().setContentId(id),
        onOwnerLabel: (label) => useCollabJoinerSession.getState().setOwnerLabel(label),
      });
      session.provider.on("sync", onSync);
      session.provider.on("connection-close", onClose);
      session.provider.on("connection-error", onClose);
      // 初回接続のみ invalid フォールバック。再接続(既に sync 済)では張らない。
      if (!syncedEverRef.current) {
        timeoutId = setTimeout(() => {
          if (!syncedLocal && !syncedEverRef.current) setInvalid(true);
        }, SYNC_TIMEOUT_MS);
      }
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
    };
  }, [roomToken, canEdit]);

  // ログイン済・未同意で sync 後に同意モーダルを 1 度だけ自動表示(cancel 後は banner から再開)。
  useEffect(() => {
    if (isLoggedIn && !hasConsent && synced && !consentPrompted) {
      setConsentOpen(true);
      setConsentPrompted(true);
    }
  }, [isLoggedIn, hasConsent, synced, consentPrompted]);

  const acceptConsent = () => {
    if (roomToken) setCollabEditConsent(roomToken);
    setHasConsent(true);
    setConsentOpen(false);
  };

  const kind = joinerView({ synced, invalid, full });
  if (kind === "connecting") return <JoinerNotice text={t("collab.joiner_connecting")} />;
  if (kind === "invalid") return <JoinerNotice text={t("collab.joiner_invalid")} />;
  if (kind === "full") return <JoinerNotice text={t("collab.joiner_full")} />;
  // sheet: Layout を通さず Timeline サブツリーのみ(自動保存・サイドバー・プラン管理なし)。
  return (
    <div className="collab-joiner-shell w-full h-screen overflow-hidden bg-app-bg flex flex-col">
      <CollabJoinerHeader />
      <div className="flex-1 overflow-auto relative flex">
        {/* ④-b-2: ジョイナーも自分のカーソル/ジョブを共有できる(既定 OFF オプトイン)。 */}
        <div className="absolute top-2 right-2 z-30 glass-tier2 rounded-xl p-2.5 w-[190px] shadow-lg">
          <PresenceControls />
        </div>
        <ErrorBoundary>
          <Timeline />
        </ErrorBoundary>
      </div>
      {/* ④ 赤い注意バナーは画面下へ(状態別 CTA: login/consent/edit)。 */}
      <CollabJoinerBanner
        isLoggedIn={isLoggedIn}
        canEdit={canEdit}
        ownerLabel={ownerLabel}
        onLogin={() => useAuthStore.getState().signInWith("discord")}
        onOpenConsent={() => setConsentOpen(true)}
      />
      <CollabEditConsentModal isOpen={consentOpen} onAccept={acceptConsent} onCancel={() => setConsentOpen(false)} />
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
