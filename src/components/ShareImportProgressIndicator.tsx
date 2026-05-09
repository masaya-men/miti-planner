import { useTranslation } from 'react-i18next';
import type { ProgressEvent, ProgressStage, ProgressStatus } from '../lib/shareImportTypes';

interface Props {
    events: ProgressEvent[];
}

// 取り込み処理の 3 ステージ。check (上限確認) → local (端末保存) → server (サーバー保存) の順。
const STAGES: ProgressStage[] = ['check', 'local', 'server'];

// ステージごとのステータス別 i18n キー。 keys は src/locales/*.json で全言語に存在することを確認済み。
const STAGE_I18N: Record<
    ProgressStage,
    { in_progress: string; success: string; failed: string }
> = {
    check: {
        in_progress: 'share_import.progress_check',
        success: 'share_import.progress_check_ok',
        // check は基本失敗表示しない (失敗時は limit_resolution 経路に遷移する) が、念のため共通化。
        failed: 'share_import.progress_check',
    },
    local: {
        in_progress: 'share_import.progress_local',
        success: 'share_import.progress_local_ok',
        failed: 'share_import.progress_local_failed',
    },
    server: {
        in_progress: 'share_import.progress_server',
        success: 'share_import.progress_server_ok',
        failed: 'share_import.progress_server_failed',
    },
};

// 同じステージに対する複数 event のうち、最後のものを「現在のステータス」として扱う。
function statusOfStage(events: ProgressEvent[], stage: ProgressStage): ProgressStatus | 'pending' {
    const matched = events.filter((e) => e.stage === stage);
    if (matched.length === 0) return 'pending';
    return matched[matched.length - 1].status;
}

// ステータス → 表示アイコン。Unicode のみで、画像は使わない方針。
function statusIcon(status: ProgressStatus | 'pending'): string {
    switch (status) {
        case 'success':
            return '✓';
        case 'failed':
            return '⚠';
        case 'in_progress':
            return '⚪';
        case 'skipped':
            return '–';
        case 'cancelled':
            return '×';
        default:
            return '○';
    }
}

// ステータス → アイコン色クラス。デザイントークン (app-blue/app-yellow/app-red 等) を使用。
function statusIconClass(status: ProgressStatus | 'pending'): string {
    switch (status) {
        case 'success':
            return 'text-app-blue';
        case 'failed':
            return 'text-app-red';
        case 'in_progress':
            return 'text-app-blue animate-pulse';
        case 'skipped':
        case 'cancelled':
            return 'text-app-text-muted';
        default:
            return 'text-app-text-muted';
    }
}

export function ShareImportProgressIndicator({ events }: Props) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col gap-1 mt-2">
            {STAGES.map((stage) => {
                const status = statusOfStage(events, stage);
                const i18nKey =
                    status === 'success'
                        ? STAGE_I18N[stage].success
                        : status === 'failed'
                          ? STAGE_I18N[stage].failed
                          : STAGE_I18N[stage].in_progress;
                // pending (未到達) は薄く表示し、まだ起きていないことを暗示する。
                const visible = status !== 'pending';
                return (
                    <div
                        key={stage}
                        data-testid={`stage-${stage}`}
                        data-status={status}
                        className={`flex items-center gap-2 text-app-sm ${visible ? '' : 'opacity-30'}`}
                    >
                        <span aria-hidden className={statusIconClass(status)}>
                            {statusIcon(status)}
                        </span>
                        <span className="text-app-text-sec">{t(i18nKey)}</span>
                    </div>
                );
            })}
        </div>
    );
}
