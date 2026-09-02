import { createStateGuard } from '@/lib/utils/stateGuard';
import type { CrmLeadStatus } from './types';

// Lead lifecycle: new → contacted → interested → follow_up → converted
// with lost / cancelled as terminal states.
// converted/lost/cancelled are terminal on purpose: a repeat enquiry from the
// same customer creates a NEW lead row, not a reopened old one.
export const CRM_LEAD_STATE_TRANSITIONS: Record<CrmLeadStatus, readonly CrmLeadStatus[]> = {
  new: ['contacted', 'interested', 'follow_up', 'converted', 'lost', 'cancelled'],
  contacted: ['interested', 'follow_up', 'converted', 'lost', 'cancelled'],
  interested: ['contacted', 'follow_up', 'converted', 'lost', 'cancelled'],
  follow_up: ['contacted', 'interested', 'converted', 'lost', 'cancelled'],
  converted: [],
  lost: [],
  cancelled: [],
};

const leadStateGuard = createStateGuard(CRM_LEAD_STATE_TRANSITIONS, { allowSameState: false });

export function canTransitionLeadState(current: CrmLeadStatus, next: CrmLeadStatus) {
  return leadStateGuard.canTransition(current, next);
}

export function assertLeadStateTransition(current: CrmLeadStatus, next: CrmLeadStatus) {
  if (current === next) {
    throw new Error(`CRM_LEAD_STATUS_NOOP:${current}`);
  }

  leadStateGuard.assertTransition(current, next, 'INVALID_CRM_LEAD_TRANSITION');
}
