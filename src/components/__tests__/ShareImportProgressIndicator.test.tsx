// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareImportProgressIndicator } from '../ShareImportProgressIndicator';
import type { ProgressEvent, ProgressStage, ProgressStatus } from '../../lib/shareImportTypes';

// i18n はキーをそのまま返すモックにし、テストの安定性を確保する。
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

const stageEvent = (stage: ProgressStage, status: ProgressStatus): ProgressEvent => ({
    planId: 'p1',
    stage,
    status,
});

describe('ShareImportProgressIndicator', () => {
    it('events が空でも 3 ステージ分のスロットを描画する', () => {
        render(<ShareImportProgressIndicator events={[]} />);
        expect(screen.getAllByTestId(/^stage-/)).toHaveLength(3);
    });

    it('ステージが success のとき ✓ を表示する', () => {
        const events = [stageEvent('check', 'success')];
        render(<ShareImportProgressIndicator events={events} />);
        expect(screen.getByTestId('stage-check')).toHaveTextContent('✓');
    });

    it('ステージが in_progress のとき data-status=in_progress を持つ', () => {
        const events = [stageEvent('local', 'in_progress')];
        render(<ShareImportProgressIndicator events={events} />);
        expect(screen.getByTestId('stage-local')).toHaveAttribute('data-status', 'in_progress');
    });

    it('ステージが failed のとき ⚠ を表示する', () => {
        const events = [stageEvent('server', 'failed')];
        render(<ShareImportProgressIndicator events={events} />);
        expect(screen.getByTestId('stage-server')).toHaveTextContent('⚠');
    });

    it('ステージが skipped のとき data-status=skipped を持つ', () => {
        const events = [stageEvent('server', 'skipped')];
        render(<ShareImportProgressIndicator events={events} />);
        expect(screen.getByTestId('stage-server')).toHaveAttribute('data-status', 'skipped');
    });
});
