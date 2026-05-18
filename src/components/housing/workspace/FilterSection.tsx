export interface FilterSectionProps {
    title: string;
    children: React.ReactNode;
}

export const FilterSection: React.FC<FilterSectionProps> = ({ title, children }) => {
    return (
        <div className="housing-filter-group">
            <div className="housing-filter-label">{title}</div>
            <div className="housing-chip-row">{children}</div>
        </div>
    );
};
