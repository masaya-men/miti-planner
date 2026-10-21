// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import type { PartyMember } from '../../../../types';
import { MilspecJackBoard } from '../MilspecJackBoard';

const mk = (id: string): PartyMember => ({ id, jobId: null, role: 'dps', stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 }, computedValues: {} });

describe('MilspecJackBoard', () => {
  it('React.memo で包まれている(同じ props では再描画しない)', () => {
    expect((MilspecJackBoard as any).$$typeof).toBe(Symbol.for('react.memo'));
  });
  it('幅 0(未計測)では SVG の中身を作らない', () => {
    const members = [mk('MT'), mk('ST')];
    const layout = new Map([['MT', { left: 0, width: 100 }], ['ST', { left: 100, width: 100 }]]);
    const { container } = render(<MilspecJackBoard members={members} partySortOrder="role" memberLayout={layout} />);
    expect(container.querySelector('svg')?.innerHTML).toBe('');
  });
});
