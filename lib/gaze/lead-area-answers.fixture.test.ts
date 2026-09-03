import { describe, expect, it } from 'vitest';
import { matchLeadArea, matchLeadAreaByPincode } from './leads';

// ── Gazetteer fixture — real lead area answers vs the matcher ──────────────────
//
// Values come from the Gaze tracker data notes (2026-09-03): the Meta form's
// area question is free text, so junk answers exist ("Yes" ×14, "Grooming" ×4).
// This fixture pins which real answers map and which are known gaps — when the
// gazetteer or matcher changes, this test shows exactly what moved.

describe('matchLeadArea — real lead area answers', () => {
  it.each([
    ['HSR', 'hsr-layout'],
    ['HSR Layout', 'hsr-layout'],
    ['BTM', 'btm-layout'],
    ['BTM Layout', 'btm-layout'],
    ['Koramangala 5th block', 'koramangala'],
    ['Electronic City', 'electronic-city'],
    ['ecity', 'electronic-city'],
    ['Whitefield', 'whitefield'],
    ['Indiranagar', 'indiranagar'],
    ['Jayanagar', 'jayanagar'],
    ['Hebbal', 'hebbal'],
    ['RT Nagar', 'rt-nagar'],
    ['R. T. Nagar', 'rt-nagar'],
    ['Frazer Town', 'fraser-town'],
    ['Halasuru', 'ulsoor'],
  ])('maps %j → %s', (answer, expectedSlug) => {
    expect(matchLeadArea(answer)?.slug).toBe(expectedSlug);
  });

  it.each([
    'Yes',
    'Grooming',
    'N/A',
    'Somewhere near forum mall',
  ])('leaves junk / unrecognizable answers (%j) unmapped', (answer) => {
    expect(matchLeadArea(answer)).toBeNull();
  });
});

describe('matchLeadAreaByPincode — manual pincode reverse lookup', () => {
  it.each([
    ['560032', 'rt-nagar'],
    ['560001', 'shivajinagar'],
  ])('maps %s → %s', (pincode, expectedSlug) => {
    expect(matchLeadAreaByPincode(pincode)?.slug).toBe(expectedSlug);
  });

  it('rejects malformed or unknown pincodes', () => {
    expect(matchLeadAreaByPincode('123')).toBeNull();
    expect(matchLeadAreaByPincode('56003')).toBeNull();
    expect(matchLeadAreaByPincode('999999')).toBeNull();
    expect(matchLeadAreaByPincode(null)).toBeNull();
  });
});
