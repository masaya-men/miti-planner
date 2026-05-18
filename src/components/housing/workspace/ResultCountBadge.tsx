import { useTranslation } from 'react-i18next';

export interface ResultCountBadgeProps {
    result: number;
    total: number;
}

export const ResultCountBadge: React.FC<ResultCountBadgeProps> = ({ result, total }) => {
    const { t } = useTranslation();
    const isZero = result === 0;
    return (
        <span
            className="housing-result-count"
            data-zero={isZero}
            aria-label={t('housing.workspace.result_count.aria', { result, total })}
        >
            <span className="now">{result}</span>
            <span>{' / '}{total}</span>
        </span>
    );
};
