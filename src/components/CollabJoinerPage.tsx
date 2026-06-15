import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { startCollabSession, type CollabSession } from "../lib/collab/collabProvider";
import { useCollabJoinerSession } from "../store/useCollabJoinerSession";
import { useMitigationStore } from "../store/useMitigationStore";
import { useAuthStore } from "../store/useAuthStore";
import { hasCollabEditConsent, setCollabEditConsent } from "../lib/collabEditConsent";
import { CollabEditConsentModal } from "./CollabEditConsentModal";
import { CollabJoinerBanner } from "./CollabJoinerBanner";
import { ConsolidatedHeader } from "./ConsolidatedHeader";
import { MobileHeader } from "./MobileHeader";
import { AppFooter } from "./AppFooter";
import { CollabViewerCluster } from "./collab/CollabViewerCluster";
import { LoginModal } from "./LoginModal";
import { ErrorBoundary } from "./ErrorBoundary";
import Timeline from "./Timeline";

export type JoinerViewKind = "connecting" | "invalid" | "full" | "revoked" | "sheet";

/** ⑤-3b: 接続状態 → 表示種別(純粋・テスト可能)。revoked > full > invalid > connecting > sheet の優先度。 */
export function joinerView(s: { synced: boolean; invalid: boolean; full: boolean; revoked?: boolean }): JoinerViewKind {
  if (s.revoked) return "revoked";   // オーナーがリンクを失効=終了(最優先・以後は入れない)
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [synced, setSynced] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [full, setFull] = useState(false);
  const [revoked, setRevoked] = useState(false); // オーナーがリンクを失効=共同編集終了

  const user = useAuthStore((s) => s.user);
  const isLoggedIn = user !== null;
  const [hasConsent, setHasConsent] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentPrompted, setConsentPrompted] = useState(false);
  const ownerLabel = useCollabJoinerSession((s) => s.ownerLabel);
  const contentId = useCollabJoinerSession((s) => s.contentId);

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
    // cleanup 用フラグ: async IIFE がクリーンアップ後に session を立てようとしても disconnect できるよう管理。
    let cleanedUp = false;

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

    const startSession = (s: CollabSession) => {
      session = s;
      session.provider.on("sync", onSync);
      session.provider.on("connection-close", onClose);
      session.provider.on("connection-error", onClose);
      // 初回接続のみ invalid フォールバック。再接続(既に sync 済)では張らない。
      if (!syncedEverRef.current) {
        timeoutId = setTimeout(() => {
          if (!syncedLocal && !syncedEverRef.current) setInvalid(true);
        }, SYNC_TIMEOUT_MS);
      }
    };

    if (canEdit) {
      // 編集者昇格接続: ログイン直後の ID トークンはエディタークレーム未反映の可能性がある。
      // WebSocket 確立前に強制更新し、サーバーが最新クレームを受け取れるようにする。
      void (async () => {
        try {
          const { auth } = await import("../lib/firebase");
          await auth.currentUser?.getIdToken(true);
        } catch {
          // 強制更新失敗は無視。params コールバック内の通常取得にフォールバック。
        }
        // cleanup 後(StrictMode 二重実行等)には session を立てない。
        if (cleanedUp) return;
        try {
          startSession(startCollabSession(roomToken, {
            readOnly: false,
            onContentId: (id) => useCollabJoinerSession.getState().setContentId(id),
            onOwnerLabel: (label) => useCollabJoinerSession.getState().setOwnerLabel(label),
            onRevoked: () => setRevoked(true),
          }));
        } catch {
          setInvalid(true);
        }
      })();
    } else {
      // 閲覧者接続: 強制更新不要。
      try {
        startSession(startCollabSession(roomToken, {
          readOnly: true,
          onContentId: (id) => useCollabJoinerSession.getState().setContentId(id),
          onOwnerLabel: (label) => useCollabJoinerSession.getState().setOwnerLabel(label),
          onRevoked: () => setRevoked(true),
        }));
      } catch {
        setInvalid(true);
      }
    }

    return () => {
      cleanedUp = true;
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

  const [loginOpen, setLoginOpen] = useState(false);

  const kind = joinerView({ synced, invalid, full, revoked });
  if (kind === "revoked") return <JoinerNotice text={t("collab.joiner_revoked")} />;
  if (kind === "connecting") return <JoinerNotice text={t("collab.joiner_connecting")} />;
  if (kind === "invalid") return <JoinerNotice text={t("collab.joiner_invalid")} />;
  if (kind === "full") return <JoinerNotice text={t("collab.joiner_full")} />;
  // sheet: Layout を通さず Timeline サブツリーのみ(自動保存・サイドバー・プラン管理なし)。
  // ConsolidatedHeader は viewer モードで使用 — usePlanStore は参照しない(viewer 分岐が担保)。
  return (
    // 本体シェル(Layout.tsx:566)と同一の font-sans + コンテナ最大幅(1489 中央寄せ)で
    // フォント・横幅の文脈を一致させる(= 本物ヘッダー/表と同じサイズ・字形)。
    <div className="collab-joiner-shell font-sans text-app-text w-full overflow-hidden bg-app-bg flex flex-col md:max-w-[var(--container-max)] md:mx-auto">
      {/* ── アプリシェル外周クローム: サイドバーハンドル(左) + メインコンテンツ列 + 右端デコ ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* 左: 折り畳み済みサイドバーハンドル(静的・read-only。本物 Sidebar は mount しない) */}
        <div className="hidden md:flex h-full w-6 shrink-0 flex-col relative z-40 glass-tier3 glass-frame glass-border-t-0 glass-border-r-0 glass-shadow-none">
          {/* 右端境界線 */}
          <div className="absolute inset-y-0 right-0 w-[1px] bg-app-border" />
          {/* ハンドルボタン(静的・cursor-not-allowed で操作不可を明示) */}
          <div className="relative w-full h-full cursor-not-allowed flex items-center justify-center overflow-hidden">
            {/* 左端ライン */}
            <div className="absolute inset-y-0 left-0 w-[1px] bg-app-border" />
            <ChevronLeft
              size={18}
              className="text-app-text-muted"
              style={{ transform: 'rotate(180deg)' }}
            />
          </div>
        </div>

        {/* 中央: ヘッダー + タイムライン本体 */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
          {/* 本物 ConsolidatedHeader — viewer モード。MobileTriggersContext はデフォルト値(noop)を使用 */}
          <div className="hidden md:block h-0 relative z-[120]">
            <ConsolidatedHeader
              viewer={{ contentId, ownerLabel }}
              viewerCluster={<CollabViewerCluster />}
              onAutoPlan={() => {}}
              onImportLogs={() => {}}
              partySortOrder="role"
              setPartySortOrder={() => {}}
              statusOpen={false}
              setStatusOpen={() => {}}
            />
          </div>
          {/* モバイル: 本物の MobileHeader を viewer モードで使用(本体アプリと同一の透けフロートデザイン)。
              右スロットに共同編集クラスタを置く。fixed のため Timeline の予約余白だけが効き二重余白は出ない。 */}
          <MobileHeader
            onHome={() => navigate('/')}
            viewer={{ contentId, ownerLabel }}
            rightSlot={<CollabViewerCluster />}
          />

          {/* タイムライン本体: PC は浮く ConsolidatedHeader 分の上余白(124px)。
              スマホはヘッダーが通常フロー(md:hidden 簡易ヘッダー)なので余白ゼロ(本体 Layout と同じ方針)。 */}
          <div className="flex-1 overflow-auto relative md:pt-[124px]">
            <ErrorBoundary>
              <Timeline />
            </ErrorBoundary>
          </div>
        </div>

        {/* 右端デコレーション(静的・フォーカスモードの対称装飾を常時非表示として省略) */}
        {/* Layout では isHeaderCollapsed && !isSidebarOpen のときのみ表示。joiner は常に幅0 */}
      </div>

      {/* ④ 赤い注意バナーは画面下へ(状態別 CTA: login/consent/edit)。 */}
      <CollabJoinerBanner
        isLoggedIn={isLoggedIn}
        canEdit={canEdit}
        ownerLabel={ownerLabel}
        onLogin={() => setLoginOpen(true)}
        onOpenConsent={() => setConsentOpen(true)}
      />

      {/* 本物 AppFooter */}
      <AppFooter />

      {/* モーダル群 */}
      <CollabEditConsentModal isOpen={consentOpen} onAccept={acceptConsent} onCancel={() => setConsentOpen(false)} />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
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
