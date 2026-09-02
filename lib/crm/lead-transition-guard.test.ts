import { describe, expect, it } from 'vitest';
import type { CrmLeadStatus } from './types';
import { CRM_LEAD_STATE_TRANSITIONS, assertLeadStateTransition, canTransitionLeadState } from './lead-transition-guard';

describe('crm lead transition guard', () => {
  it('advances through the happy path new → converted', () => {
    const path: CrmLeadStatus[] = ['new', 'contacted', 'interested', 'follow_up'];

    for (let index = 1; index < path.length; index += 1) {
      expect(canTransitionLeadState(path[index - 1], path[index])).toBe(true);
    }

    expect(canTransitionLeadState('follow_up', 'converted')).toBe(true);
  });

  it('allows direct conversion from any open state', () => {
    for (const status of ['new', 'contacted', 'interested', 'follow_up'] as const) {
      expect(canTransitionLeadState(status, 'converted')).toBe(true);
    }
  });

  it('allows losing or cancelling from any open state', () => {
    for (const status of ['new', 'contacted', 'interested', 'follow_up'] as const) {
      expect(canTransitionLeadState(status, 'lost')).toBe(true);
      expect(canTransitionLeadState(status, 'cancelled')).toBe(true);
    }
  });

  it('treats converted, lost and cancelled as terminal', () => {
    for (const status of ['converted', 'lost', 'cancelled'] as const) {
      expect(CRM_LEAD_STATE_TRANSITIONS[status]).toEqual([]);
    }
  });

  it('rejects same-state transitions', () => {
    expect(() => assertLeadStateTransition('new', 'new')).toThrowError('CRM_LEAD_STATUS_NOOP:new');
    expect(canTransitionLeadState('contacted', 'contacted')).toBe(false);
  });

  it('rejects reopening terminal states', () => {
    expect(() => assertLeadStateTransition('lost', 'new')).toThrowError(
      'INVALID_CRM_LEAD_TRANSITION:lost->new',
    );
    expect(() => assertLeadStateTransition('converted', 'follow_up')).toThrowError(
      'INVALID_CRM_LEAD_TRANSITION:converted->follow_up',
    );
  });

  it('rejects backsliding to new from working states', () => {
    expect(canTransitionLeadState('contacted', 'new')).toBe(false);
    expect(canTransitionLeadState('follow_up', 'new')).toBe(false);
  });
});
