// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

import { DamageTypeIcon } from '../DamageTypeIcon';

describe('DamageTypeIcon', () => {
  it('種別に応じたアイコンを出す(magical)', () => {
    const { container } = render(<DamageTypeIcon damageType="magical" />);
    expect(container.querySelector('img[src="/icons/type_magic.png"]')).toBeTruthy();
  });

  it('フラグOFF時は赤リングの印を出さない', () => {
    const { container } = render(<DamageTypeIcon damageType="physical" />);
    expect(container.querySelector('.ring-red-500\\/40')).toBeNull();
  });

  it('フラグON時は赤リングの印を出す', () => {
    const { container } = render(<DamageTypeIcon damageType="physical" ignoresDebuffMitigation />);
    expect(container.querySelector('.ring-red-500\\/40')).toBeTruthy();
  });

  it('フラグON + withTooltip=false のとき Tooltip ラッパ(.relative)を出さない', () => {
    const { container } = render(
      <DamageTypeIcon damageType="physical" ignoresDebuffMitigation withTooltip={false} />
    );
    // 赤リングの印は出る
    expect(container.querySelector('.ring-red-500\\/40')).toBeTruthy();
    // Tooltip コンポーネントのラッパ div(.relative)は無い
    expect(container.querySelector('.relative')).toBeNull();
  });

  it('フラグON + 既定(withTooltip省略)では Tooltip ラッパ(.relative)を出す', () => {
    const { container } = render(
      <DamageTypeIcon damageType="physical" ignoresDebuffMitigation />
    );
    expect(container.querySelector('.relative')).toBeTruthy();
  });
});
