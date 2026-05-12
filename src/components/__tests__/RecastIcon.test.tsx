// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createRef } from 'react';
import { RecastIcon } from '../RecastIcon';

describe('RecastIcon', () => {
    it('renders an img with the given iconUrl and alt', () => {
        const { container } = render(<RecastIcon iconUrl="/icons/holmgang.png" alt="Holmgang" />);
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.getAttribute('src')).toBe('/icons/holmgang.png');
        expect(img?.getAttribute('alt')).toBe('Holmgang');
    });

    it('renders root with class "recast-icon" and a "recast-num" span', () => {
        const { container } = render(<RecastIcon iconUrl="/x.png" alt="x" />);
        expect(container.querySelector('.recast-icon')).not.toBeNull();
        expect(container.querySelector('.recast-num')).not.toBeNull();
    });

    it('forwards ref to the root element', () => {
        const ref = createRef<HTMLDivElement>();
        render(<RecastIcon ref={ref} iconUrl="/x.png" alt="x" />);
        expect(ref.current).toBeInstanceOf(HTMLDivElement);
        expect(ref.current?.classList.contains('recast-icon')).toBe(true);
    });

    it('sets default CSS variables on the root element', () => {
        const { container } = render(<RecastIcon iconUrl="/x.png" alt="x" />);
        const el = container.querySelector('.recast-icon') as HTMLDivElement;
        expect(el.style.getPropertyValue('--cd-display')).toBe('none');
        expect(el.style.getPropertyValue('--cd-angle')).toBe('0deg');
        expect(el.style.getPropertyValue('--cd-order')).toBe('0');
    });
});
