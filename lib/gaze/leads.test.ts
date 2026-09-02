import { describe, expect, it } from 'vitest';
import {
  aggregateLeadsByArea,
  buildGazeLeadKpis,
  buildGazeLeadPoints,
  matchLeadArea,
  matchLeadAreaByPincode,
  resolveLeadAreaDisplayPhase,
  resolveLeadPhase,
  type GazeLeadSourceRow,
} from './leads';

function makeLeadRow(overrides?: Partial<GazeLeadSourceRow>): GazeLeadSourceRow {
  return {
    id: 'lead-1',
    status: 'new',
    priority: 'normal',
    source: 'meta_lead_form',
    source_details: { city: 'HSR Layout' },
    created_at: '2026-09-01T10:00:00.000Z',
    users: { name: 'Ravi Kumar' },
    ...overrides,
  };
}

describe('matchLeadArea', () => {
  it('matches exact area names from the gazetteer', () => {
    const match = matchLeadArea('HSR Layout');

    expect(match?.slug).toBe('hsr-layout');
    expect(match?.name).toBe('HSR Layout');
    expect(match?.pincode).toBeTruthy();
  });

  it('matches aliases and is case/space tolerant', () => {
    expect(matchLeadArea('hsr layout')?.slug).toBe('hsr-layout');
    expect(matchLeadArea('White field')?.slug).toBe('whitefield');
  });

  it('matches common shorthands', () => {
    expect(matchLeadArea('HSR')?.slug).toBe('hsr-layout');
  });

  it('matches an unambiguous area prefix', () => {
    const match = matchLeadArea('Koramangala 5th block');

    expect(match?.slug).toBe('koramangala');
  });

  it('returns null for unknown or empty areas', () => {
    expect(matchLeadArea('Mumbai')).toBeNull();
    expect(matchLeadArea('')).toBeNull();
    expect(matchLeadArea(null)).toBeNull();
  });
});

describe('matchLeadAreaByPincode', () => {
  it('resolves a valid gazetteer pincode to its area', () => {
    const hsr = matchLeadArea('HSR Layout');
    if (!hsr?.pincode) throw new Error('gazetteer HSR pincode missing');

    const match = matchLeadAreaByPincode(hsr.pincode);
    expect(match?.slug).toBe('hsr-layout');
    expect(match?.pincode).toBe(hsr.pincode);
  });

  it('rejects malformed or unknown pincodes', () => {
    expect(matchLeadAreaByPincode('12345')).toBeNull();
    expect(matchLeadAreaByPincode('')).toBeNull();
    expect(matchLeadAreaByPincode(null)).toBeNull();
  });
});

describe('resolveLeadPhase', () => {
  it('groups pipeline statuses into open', () => {
    for (const status of ['new', 'contacted', 'interested', 'follow_up']) {
      expect(resolveLeadPhase(status)).toBe('open');
    }
  });

  it('maps terminal statuses directly', () => {
    expect(resolveLeadPhase('converted')).toBe('converted');
    expect(resolveLeadPhase('lost')).toBe('lost');
    expect(resolveLeadPhase('cancelled')).toBe('cancelled');
  });
});

describe('buildGazeLeadPoints', () => {
  it('maps rows with area matching and phase', () => {
    const [point] = buildGazeLeadPoints([
      makeLeadRow(),
      makeLeadRow({ source_details: { city: 'Nowhere Known' } }),
    ]);

    expect(point!.areaSlug).toBe('hsr-layout');
    expect(point!.phase).toBe('open');
    expect(point!.customerName).toBe('Ravi Kumar');
    expect(point!.isHot).toBe(false);

    const unmapped = buildGazeLeadPoints([makeLeadRow({ source_details: { city: 'Nowhere Known' } })])[0]!;
    expect(unmapped.areaSlug).toBeNull();
    expect(unmapped.area).toBe('Nowhere Known');
  });

  it('falls back to an extra_fields pincode when city is missing', () => {
    const [point] = buildGazeLeadPoints([
      makeLeadRow({ source_details: { extra_fields: { pincode: '560102' } } }),
    ]);

    // A pincode is not an area name — it stays unmapped by the gazetteer.
    expect(point!.area).toBe('560102');
    expect(point!.areaSlug).toBeNull();
  });

  it('maps leads with a manual pincode via reverse lookup when the area text fails', () => {
    const hsr = matchLeadArea('HSR Layout');
    if (!hsr?.pincode) throw new Error('gazetteer HSR pincode missing');

    const [point] = buildGazeLeadPoints([
      makeLeadRow({ source_details: { city: 'Somewhere Unknown' }, pincode: hsr.pincode }),
    ]);

    expect(point!.areaSlug).toBe('hsr-layout');
    expect(point!.areaName).toBe('HSR Layout');
    expect(point!.pincode).toBe(hsr.pincode);
    expect(buildGazeLeadKpis([point!]).mappedLeads).toBe(1);
  });

  it('prefers the manual pincode for plotting even when the area text matched', () => {
    const [point] = buildGazeLeadPoints([
      makeLeadRow({ source_details: { city: 'HSR Layout' }, pincode: '560068' }),
    ]);

    expect(point!.areaSlug).toBe('hsr-layout'); // area still groups under HSR
    expect(point!.pincode).toBe('560068'); // but plots at the manual pincode
  });
});

describe('aggregateLeadsByArea', () => {
  it('aggregates counts, hot flags and conversion rate per area', () => {
    const points = buildGazeLeadPoints([
      makeLeadRow(),
      makeLeadRow({ id: 'lead-2', status: 'follow_up', priority: 'hot' }),
      makeLeadRow({ id: 'lead-3', status: 'converted' }),
      makeLeadRow({ id: 'lead-4', status: 'lost' }),
      makeLeadRow({ id: 'lead-5', status: 'new', source_details: { city: 'Whitefield' } }),
    ]);

    const stats = aggregateLeadsByArea(points);
    const hsr = stats.find((stat) => stat.areaSlug === 'hsr-layout')!;

    expect(stats[0]!.areaSlug).toBe('hsr-layout'); // most leads first
    expect(hsr.leadCount).toBe(4);
    expect(hsr.openCount).toBe(2);
    expect(hsr.hotCount).toBe(1);
    expect(hsr.convertedCount).toBe(1);
    expect(hsr.lostCount).toBe(1);
    expect(hsr.conversionRate).toBeCloseTo(0.25);
  });

  it('skips unmapped leads', () => {
    const points = buildGazeLeadPoints([makeLeadRow({ source_details: { city: 'Unknown Place' } })]);

    expect(aggregateLeadsByArea(points)).toEqual([]);
  });
});

describe('resolveLeadAreaDisplayPhase', () => {
  it('colours an area by its dominant lead status', () => {
    const convertedDominant = aggregateLeadsByArea(
      buildGazeLeadPoints([
        makeLeadRow(),
        makeLeadRow({ id: 'a', status: 'converted' }),
        makeLeadRow({ id: 'b', status: 'converted' }),
        makeLeadRow({ id: 'c', status: 'lost' }),
      ]),
    )[0]!;
    expect(resolveLeadAreaDisplayPhase(convertedDominant)).toBe('converted');

    const lostDominant = aggregateLeadsByArea(
      buildGazeLeadPoints([
        makeLeadRow(),
        makeLeadRow({ id: 'a', status: 'lost' }),
        makeLeadRow({ id: 'b', status: 'lost' }),
      ]),
    )[0]!;
    expect(resolveLeadAreaDisplayPhase(lostDominant)).toBe('lost');
  });

  it('marks open-dominant areas with hot leads as hot', () => {
    const openWithHot = aggregateLeadsByArea(
      buildGazeLeadPoints([
        makeLeadRow(),
        makeLeadRow({ id: 'a', priority: 'hot', status: 'contacted' }),
      ]),
    )[0]!;

    expect(resolveLeadAreaDisplayPhase(openWithHot)).toBe('hot');
  });

  it('keeps converted-dominant areas green even when a hot lead exists', () => {
    const mostlyConverted = aggregateLeadsByArea(
      buildGazeLeadPoints([
        makeLeadRow({ id: 'a', status: 'converted' }),
        makeLeadRow({ id: 'b', status: 'converted' }),
        makeLeadRow({ id: 'c', status: 'converted' }),
        makeLeadRow({ id: 'd', priority: 'hot', status: 'contacted' }),
      ]),
    )[0]!;

    expect(resolveLeadAreaDisplayPhase(mostlyConverted)).toBe('converted');
  });

  it('resolves ties in the order open > converted > lost > cancelled', () => {
    const tied = aggregateLeadsByArea(
      buildGazeLeadPoints([
        makeLeadRow(), // status 'new' → open
        makeLeadRow({ id: 'a', status: 'converted' }),
      ]),
    )[0]!;

    expect(resolveLeadAreaDisplayPhase(tied)).toBe('open'); // 1 open vs 1 converted
  });
});

describe('buildGazeLeadKpis', () => {
  it('counts totals, open, hot, converted and mapped leads', () => {
    const points = buildGazeLeadPoints([
      makeLeadRow(),
      makeLeadRow({ id: 'lead-2', priority: 'hot', status: 'contacted' }),
      makeLeadRow({ id: 'lead-3', status: 'converted' }),
      makeLeadRow({ id: 'lead-4', status: 'new', source_details: { city: 'Unknown Place' } }),
    ]);

    const kpis = buildGazeLeadKpis(points);

    expect(kpis.totalLeads).toBe(4);
    expect(kpis.openLeads).toBe(3);
    expect(kpis.hotLeads).toBe(1);
    expect(kpis.convertedLeads).toBe(1);
    expect(kpis.mappedLeads).toBe(3);
  });
});
