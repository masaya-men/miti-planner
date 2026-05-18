export interface FilterChipProps {
    label: string;
    active: boolean;
    onToggle: () => void;
    /** Optional aria-label override (defaults to label). */
    ariaLabel?: string;
}

export const FilterChip: React.FC<FilterChipProps> = ({ label, active, onToggle, ariaLabel }) => {
    return (
        <button
            type="button"
            className="housing-chip"
            data-active={active}
            aria-pressed={active}
            aria-label={ariaLabel ?? label}
            onClick={onToggle}
        >
            {label}
        </button>
    );
};
