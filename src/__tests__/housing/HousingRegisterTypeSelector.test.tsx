// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));

import { HousingRegisterTypeSelector } from '../../components/housing/register/HousingRegisterTypeSelector';

describe('HousingRegisterTypeSelector', () => {
    it('renders 5 chips', () => {
        render(<HousingRegisterTypeSelector value={null} onChange={() => {}} />);
        expect(screen.getByRole('radio', { name: 'housing.register.type.S' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'housing.register.type.M' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'housing.register.type.L' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'housing.register.type.private' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'housing.register.type.apartment' })).toBeInTheDocument();
    });

    it('calls onChange with size id when chip clicked', () => {
        const onChange = vi.fn();
        render(<HousingRegisterTypeSelector value={null} onChange={onChange} />);
        fireEvent.click(screen.getByRole('radio', { name: 'housing.register.type.M' }));
        expect(onChange).toHaveBeenCalledWith('M');
    });

    it('marks selected chip with data-selected', () => {
        render(<HousingRegisterTypeSelector value="L" onChange={() => {}} />);
        expect(screen.getByRole('radio', { name: 'housing.register.type.L' })).toHaveAttribute('data-selected', 'true');
    });
});
