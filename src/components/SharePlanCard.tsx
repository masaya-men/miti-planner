import type { ReactNode } from 'react';

interface Props {
    title: string;
    subtitle?: string;
    // アクティブ表示 (現在選択されている / プレビュー対象等) のフラグ。
    isActive: boolean;
    // チェックボックスの ON/OFF。 showCheckbox=false のときは無視される。
    isChecked?: boolean;
    showCheckbox: boolean;
    // タイトル右側に置く任意のバッジ (例: 「取り込み済み」表示)。
    badge?: ReactNode;
    // 行ボディ (タイトル / サブタイトル領域) クリック時のコールバック。
    onClickRow: () => void;
    // チェックボックスクリック時のコールバック。
    onToggleCheck?: () => void;
    // 行下に追加で描画するスロット (進捗インジケータ等)。
    children?: ReactNode;
}

// 共有取り込み (ShareImportSheet) と上限解消 (LimitResolutionSheet) で共通使用するカード行。
// レイアウト: [チェックボックス?] [タイトル/サブタイトル] [バッジ?]
//             [children (任意の追加スロット)]
export function SharePlanCard({
    title,
    subtitle,
    isActive,
    isChecked,
    showCheckbox,
    badge,
    onClickRow,
    onToggleCheck,
    children,
}: Props) {
    return (
        <div
            data-testid="share-plan-card"
            className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-colors ${
                isActive
                    ? 'active bg-app-blue/10 border-app-blue/40'
                    : 'bg-app-surface2/30 border-app-border hover:bg-app-surface2/50'
            }`}
            onClick={onClickRow}
        >
            <div className="flex items-center gap-2">
                {showCheckbox && (
                    <input
                        type="checkbox"
                        checked={!!isChecked}
                        onChange={onToggleCheck}
                        // チェックボックスのクリックが行クリックに伝播しないようにする。
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer accent-app-blue shrink-0"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-app-md text-app-text truncate">
                        {title}
                    </div>
                    {subtitle && (
                        <div className="text-app-sm text-app-text-muted truncate">{subtitle}</div>
                    )}
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {children}
        </div>
    );
}
