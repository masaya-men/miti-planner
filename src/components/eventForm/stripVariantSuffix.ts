// 軽減 ID から burst / crit / crit_protraction の接尾辞を剥がして base ID を返す
export const stripVariantSuffix = (id: string): string => {
    return id.replace(/:(burst|crit|crit_protraction)$/, '');
};
