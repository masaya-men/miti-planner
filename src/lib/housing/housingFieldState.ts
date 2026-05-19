import { useCallback, useState } from 'react';

export type FieldState = 'empty' | 'auto-filled' | 'confirmed' | 'edited' | 'error';

type FieldEntry = {
    state: FieldState;
    value: unknown;
    errorMessage?: string;
};

type FieldMap = Record<string, FieldEntry>;

export function useHousingFieldState(requiredFields: string[] = []) {
    const [fields, setFields] = useState<FieldMap>({});

    const getState = useCallback(
        (name: string): FieldState => fields[name]?.state ?? 'empty',
        [fields],
    );

    const getValue = useCallback((name: string) => fields[name]?.value, [fields]);

    const getError = useCallback(
        (name: string) => fields[name]?.errorMessage,
        [fields],
    );

    const setAutoFilled = useCallback((name: string, value: unknown) => {
        setFields((prev) => ({
            ...prev,
            [name]: { state: 'auto-filled', value },
        }));
    }, []);

    const confirm = useCallback((name: string) => {
        setFields((prev) => {
            const cur = prev[name];
            if (!cur) return prev;
            return { ...prev, [name]: { ...cur, state: 'confirmed' } };
        });
    }, []);

    const userEdit = useCallback((name: string, value: unknown) => {
        setFields((prev) => ({
            ...prev,
            [name]: { state: 'edited', value },
        }));
    }, []);

    const setError = useCallback((name: string, errorMessage: string) => {
        setFields((prev) => ({
            ...prev,
            [name]: {
                state: 'error',
                value: prev[name]?.value,
                errorMessage,
            },
        }));
    }, []);

    const clearField = useCallback((name: string) => {
        setFields((prev) => {
            const { [name]: _removed, ...rest } = prev;
            return rest;
        });
    }, []);

    const isReadyToSubmit = useCallback(() => {
        for (const name of requiredFields) {
            const s = fields[name]?.state ?? 'empty';
            if (s === 'empty' || s === 'auto-filled' || s === 'error') {
                return false;
            }
        }
        for (const entry of Object.values(fields)) {
            if (entry.state === 'error') return false;
        }
        return true;
    }, [fields, requiredFields]);

    return {
        getState,
        getValue,
        getError,
        setAutoFilled,
        confirm,
        userEdit,
        setError,
        clearField,
        isReadyToSubmit,
    };
}
