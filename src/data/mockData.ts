import type { Mitigation } from '../types/index.js';
import { MITIGATIONS_GNB_TO_DRK } from './mockData/mitigationsGnbToDrk.js';
import { MITIGATIONS_SCH_TO_SGE } from './mockData/mitigationsSchToSge.js';
import { MITIGATIONS_RDM_TO_WAR } from './mockData/mitigationsRdmToWar.js';
import { MITIGATIONS_WHM_DNC } from './mockData/mitigationsWhmDnc.js';
import { MITIGATIONS_ROLE_ACTIONS } from './mockData/mitigationsRoleActions.js';

export { MITIGATION_DISPLAY_ORDER, getMitigationPriority } from './mockData/displayOrder.js';
export { JOBS } from './mockData/jobs.js';

export const MITIGATIONS: Mitigation[] = [
    ...MITIGATIONS_GNB_TO_DRK,
    ...MITIGATIONS_SCH_TO_SGE,
    ...MITIGATIONS_RDM_TO_WAR,
    ...MITIGATIONS_WHM_DNC,
    ...MITIGATIONS_ROLE_ACTIONS,
];
