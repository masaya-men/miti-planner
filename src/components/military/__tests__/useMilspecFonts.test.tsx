// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MILSPEC_FONTS_HREF, useMilspecFonts } from '../useMilspecFonts';

const Probe = () => { useMilspecFonts(); return null; };

describe('useMilspecFonts', () => {
  afterEach(() => { cleanup(); document.getElementById('milspec-fonts')?.remove(); });

  it('MIL-SPEC の書体の <link> を head に 1 つだけ足す', () => {
    render(<><Probe /><Probe /></>);
    const links = document.head.querySelectorAll('link#milspec-fonts');
    expect(links.length).toBe(1);
    const link = links[0] as HTMLLinkElement;
    expect(link.rel).toBe('stylesheet');
    expect(link.getAttribute('href')).toBe(MILSPEC_FONTS_HREF);
  });

  it('アンマウントしても <link> は残す', () => {
    const { unmount } = render(<Probe />);
    unmount();
    expect(document.head.querySelectorAll('link#milspec-fonts').length).toBe(1);
  });

  it('href に 7 書体が入っている', () => {
    for (const f of ['IBM+Plex+Sans+JP', 'IBM+Plex+Mono', 'Saira+Semi+Condensed', 'Michroma', 'Doto', 'Share+Tech+Mono', 'Orbitron', 'display=swap']) {
      expect(MILSPEC_FONTS_HREF).toContain(f);
    }
  });
});
