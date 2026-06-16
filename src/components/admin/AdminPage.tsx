/**
 * 管理画面 共通ページシェル（試作）
 *
 * 全管理ページ共通の土台。本体(軽減表)の「ヘッダーは固定・本文だけスクロール」思想を
 * 管理画面にも持ち込む。装飾(ガラス/グリッド)は載せず、クリアで明快に保つ(A案)。
 *
 * - header: スクロールしない固定領域。ページ名 + 補足(meta) + ページ固有アクション(actions)。
 * - body:   header の下で単独スクロールする本文領域。
 *
 * 使い方:
 *   <AdminPage title="テンプレート管理" meta="60件" actions={<button>新規</button>}>
 *     ...本文...
 *   </AdminPage>
 */
import type { ReactNode } from 'react';

interface AdminPageProps {
  /** ページ名（固定ヘッダー左に大きく表示） */
  title: string;
  /** タイトル横の補足（件数・絞り込み状態など）。任意 */
  meta?: ReactNode;
  /** ヘッダー右に集約するページ固有アクション。任意 */
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminPage({ title, meta, actions, children }: AdminPageProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 固定ヘッダー（スクロールしない） */}
      <header className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-app-text/10 bg-app-bg">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-app-3xl font-bold truncate">{title}</h1>
          {meta != null && (
            <span className="text-app-lg text-app-text-muted shrink-0">{meta}</span>
          )}
        </div>
        {actions != null && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </header>

      {/* 本文（ここだけスクロール） */}
      <div className="flex-1 min-h-0 overflow-auto px-6 py-5">{children}</div>
    </div>
  );
}
