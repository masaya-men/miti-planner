import type { FFLogsRawEvent, FFLogsFight } from '../../api/fflogsTypes';
import type { MapperResult } from '../../utils/fflogsMapper';

export type ImportStatus =
    | { phase: 'idle' }
    | { phase: 'loading'; message: string }
    | { phase: 'preview'; fight: FFLogsFight; events: FFLogsRawEvent[]; mapped: MapperResult }
    | { phase: 'error'; message: string };
