import type { ReactNode } from 'react';

// チェックボックス関連プロパティの discriminated union。
// showCheckbox=false のときは isChecked / onToggleCheck を要求しないが、
// showCheckbox=true のときはこれらを必須にする。
// これにより「showCheckbox=true なのに状態を渡し忘れて静かに壊れる」事故を型レベルで防ぐ。
type CheckboxProps =
    | { showCheckbox: false }
    | { showCheckbox: true; isChecked: boolean; onToggleCheck: () => void };

type SharePlanCardProps = {
    title: string;
    subtitle?: string;
    // アクティブ表示 (現在選択されている / プレビュー対象等) のフラグ。
    isActive: boolean;
    // タイトル右側に置く任意のバッジ (例: 「取り込み済み」表示)。
    badge?: ReactNode;
    // 行ボディ (タイトル / サブタイトル領域) クリック時のコールバック。
    onClickRow: () => void;
    // 行下に追加で描画するスロット (進捗インジケータ等)。
    children?: ReactNode;
} & CheckboxProps;

// 共有取り込み (ShareImportSheet) と上限解消 (LimitResolutionSheet) で共通使用するカード行。
// レイアウト: [チェックボックス?] [タイトル/サブタイトル] [バッジ?]
//             [children (任意の追加スロット)]
// アクセシビリティ: 行全体をクリック可能なボタンとして扱い、キーボード (Enter/Space) でも起動できる。
export function SharePlanCard(props: SharePlanCardProps) {
    const { title, subtitle, isActive, badge, onClickRow, children } = props;
    return (
        <div
            data-testid="share-plan-card"
            role="button"
            tabIndex={0}
            onClick={onClickRow}
            onKeyDown={(e) => {
                // Enter / Space で行を起動。スクロール等の既定動作は抑止する。
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClickRow();
                }
            }}
            className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue ${
                isActive
                    ? 'active bg-app-blue/10 border-app-blue/40'
                    : 'bg-app-surface2/30 border-app-border hover:bg-app-surface2/50'
            }`}
        >
            <div className="flex items-center gap-2">
                {props.showCheckbox && (
                    <input
                        type="checkbox"
                        checked={props.isChecked}
                        onChange={props.onToggleCheck}
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
