// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MilspecWorkspace } from '../MilspecWorkspace';
import { useMitigationStore } from '../../../store/useMitigationStore';

/** テスト用の最小 PartyMember。MilspecWorkspace は id しか見ない(可視判定 = hiddenPartyMemberIds に無いか)。 */
const mkMembers = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `M${i}`, jobId: null, role: 'dps', stats: {}, computedValues: {},
  }));

beforeEach(() => {
  // 既定 8 人 / 全員表示に戻す(他テストの set が残らないように)
  useMitigationStore.setState({ partyMembers: mkMembers(8) as never, hiddenPartyMemberIds: [] });
});

describe('MilspecWorkspace', () => {
  it('装甲板の枠 + .milspec-ws-screen に children を入れる', () => {
    const { container } = render(<MilspecWorkspace><div data-testid="tl">TL</div></MilspecWorkspace>);
    const screen = container.querySelector('.milspec-ws-screen');
    expect(screen).not.toBeNull();
    expect(screen!.querySelector('[data-testid="tl"]')).not.toBeNull();
  });
  it('四隅ビス + 刻印を持つ', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelectorAll('.milspec-bolt').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector('.milspec-sc')).not.toBeNull();
  });

  it('端末キャップと ROSTER ノートを持つ', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelector('.milspec-ws-cap')).not.toBeNull();
    const note = container.querySelector('.milspec-ws-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toMatch(/ROSTER\s+\d{2}\s*\/\s*\d{2}/);
  });

  it('ROSTER の人数は可視パーティメンバー数(hiddenPartyMemberIds を反映)', () => {
    useMitigationStore.setState({ partyMembers: mkMembers(8) as never, hiddenPartyMemberIds: ['M0', 'M1'] });
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    const note = container.querySelector('.milspec-ws-note');
    expect(note!.textContent).toMatch(/ROSTER\s+06\s*\/\s*08/);
    expect(note!.textContent).toMatch(/SLOTS\s+02\s+OPEN/);
  });

  it('可視 8 人なら FULL PARTY', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    const note = container.querySelector('.milspec-ws-note');
    expect(note!.textContent).toMatch(/ROSTER\s+08\s*\/\s*08/);
    expect(note!.textContent).toMatch(/FULL PARTY/);
  });

  it('.milspec-ws-cap / .milspec-ws-note は aria-hidden(装飾デカール)', () => {
    const { container } = render(<MilspecWorkspace><span /></MilspecWorkspace>);
    expect(container.querySelector('.milspec-ws-cap')!.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.milspec-ws-note')!.getAttribute('aria-hidden')).toBe('true');
  });
});
