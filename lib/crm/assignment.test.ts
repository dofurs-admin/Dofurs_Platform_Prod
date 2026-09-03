import { afterEach, describe, expect, it } from 'vitest';
import { isLeadAutoAssignEnabled, pickLeastLoadedAssignee } from './service';

describe('pickLeastLoadedAssignee', () => {
  const staff = [
    { id: 'staff-a', createdAt: '0' },
    { id: 'staff-b', createdAt: '1' },
    { id: 'staff-c', createdAt: '2' },
  ];

  it('picks the staff member with the fewest open leads', () => {
    const openCounts = new Map<string, number>([
      ['staff-a', 5],
      ['staff-b', 2],
      ['staff-c', 3],
    ]);

    expect(pickLeastLoadedAssignee(staff, openCounts)).toBe('staff-b');
  });

  it('treats missing counts as zero', () => {
    expect(pickLeastLoadedAssignee(staff, new Map())).toBe('staff-a');
  });

  it('breaks ties toward the earliest-created staff member', () => {
    const openCounts = new Map<string, number>([
      ['staff-a', 2],
      ['staff-b', 2],
      ['staff-c', 2],
    ]);

    expect(pickLeastLoadedAssignee(staff, openCounts)).toBe('staff-a');
  });

  it('rebalances as soon as a load changes', () => {
    // staff-b/staff-c have zero open leads, so they beat staff-a's single lead.
    expect(pickLeastLoadedAssignee(staff, new Map([['staff-a', 1]]))).toBe('staff-b');

    const afterAssignment = new Map<string, number>([
      ['staff-a', 1],
      ['staff-b', 1],
      ['staff-c', 0],
    ]);
    expect(pickLeastLoadedAssignee(staff, afterAssignment)).toBe('staff-c');
  });

  it('returns null when no staff exist', () => {
    expect(pickLeastLoadedAssignee([], new Map())).toBeNull();
  });
});

describe('isLeadAutoAssignEnabled', () => {
  const originalValue = process.env.CRM_LEAD_AUTO_ASSIGN;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.CRM_LEAD_AUTO_ASSIGN;
    } else {
      process.env.CRM_LEAD_AUTO_ASSIGN = originalValue;
    }
  });

  it('is disabled by default — new leads are created unassigned (owner decision 2026-09-03)', () => {
    delete process.env.CRM_LEAD_AUTO_ASSIGN;
    expect(isLeadAutoAssignEnabled()).toBe(false);
  });

  it('is disabled when explicitly false', () => {
    process.env.CRM_LEAD_AUTO_ASSIGN = 'false';
    expect(isLeadAutoAssignEnabled()).toBe(false);
  });

  it('is enabled only by the explicit opt-in value true', () => {
    process.env.CRM_LEAD_AUTO_ASSIGN = 'true';
    expect(isLeadAutoAssignEnabled()).toBe(true);
  });

  it('accepts case/whitespace variants of true as opt-in', () => {
    process.env.CRM_LEAD_AUTO_ASSIGN = ' True ';
    expect(isLeadAutoAssignEnabled()).toBe(true);
  });

  it('treats any other value as disabled — no accidental opt-in', () => {
    process.env.CRM_LEAD_AUTO_ASSIGN = 'yes';
    expect(isLeadAutoAssignEnabled()).toBe(false);
  });
});
