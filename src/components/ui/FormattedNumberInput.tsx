import React from 'react';

interface FormattedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
    className?: string;
    placeholder?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({ value, onChange, onFocus, className, placeholder }) => {
    const toHalfWidth = (str: string) => str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = toHalfWidth(e.target.value).replace(/,/g, '');
        if (rawValue === '' || /^-?\d*$/.test(rawValue)) {
            onChange(Number(rawValue));
        }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
        if (onFocus) onFocus(e);
    };

    return (
        <input
            type="text"
            inputMode="numeric"
            value={value.toLocaleString()}
            onChange={handleChange}
            onFocus={handleFocus}
            className={className}
            placeholder={placeholder}
        />
    );
};
