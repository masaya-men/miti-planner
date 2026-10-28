export interface StepProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  isJa: boolean;
}

export interface StepContentIdProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  existingIds: Set<string>;
  t: (key: string) => string;
  isJa: boolean;
}

export interface StepNameProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  t: (key: string) => string;
}
export interface StepSeriesProps {
  data: Record<string, unknown>;
  setField: (key: string, value: unknown) => void;
  isJa: boolean;
  t: (key: string) => string;
  newSeriesInput: string;
  setNewSeriesInput: (v: string) => void;
  newSeriesNameJaInput: string;
  setNewSeriesNameJaInput: (v: string) => void;
  newSeriesNameEnInput: string;
  setNewSeriesNameEnInput: (v: string) => void;
  isNewSeriesMode: boolean;
  setIsNewSeriesMode: (v: boolean) => void;
}
