import { bengaluruAreas } from '@/lib/service-areas';
import { CRM_LEAD_OPEN_STATUSES } from '@/lib/crm/types';

// ── CRM leads layer for Gaze ──────────────────────────────────────────────────
//
// Leads carry a free-text area (the Meta form question "which area in
// Bengaluru you want the service?"). To plot lead demand on the map, the area
// text is matched against the Bengaluru areas gazetteer in lib/service-areas
// (names + aliases → pincodes), and Gaze's existing booking-derived pincode
// centroids provide the coordinates. Pure functions only — trivially testable,
// same convention as lib/gaze/aggregates.ts.

export type GazeLeadPhase = 'open' | 'converted' | 'lost' | 'cancelled';

export type GazeLeadPoint = {
  id: string;
  customerName: string | null;
  area: string | null;
  areaSlug: string | null;
  areaName: string | null;
  pincode: string | null;
  phase: GazeLeadPhase;
  isHot: boolean;
  source: string;
  createdAt: string;
};

export type GazeLeadAreaStat = {
  areaSlug: string;
  areaName: string;
  pincode: string | null;
  leadCount: number;
  openCount: number;
  hotCount: number;
  convertedCount: number;
  lostCount: number;
  cancelledCount: number;
  /** Converted leads / total leads for the area (0..1). */
  conversionRate: number;
};

export type GazeLeadKpis = {
  totalLeads: number;
  openLeads: number;
  hotLeads: number;
  convertedLeads: number;
  /** Leads whose area matched a known Bengaluru area (mappable). */
  mappedLeads: number;
};

// ── Area matching ─────────────────────────────────────────────────────────────

type GazeLeadAreaMatch = {
  slug: string;
  name: string;
  pincode: string | null;
};

const AREA_SHORTHANDS: Record<string, string> = {
  hsr: 'hsr-layout',
  ecity: 'electronic-city',
  btm: 'btm-layout',
};

function normalizeAreaKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const areaMatchByKey: Map<string, GazeLeadAreaMatch> = (() => {
  const index = new Map<string, GazeLeadAreaMatch>();

  for (const area of bengaluruAreas) {
    const entry: GazeLeadAreaMatch = {
      slug: area.slug,
      name: area.name,
      pincode: area.pincodes[0] ?? null,
    };

    index.set(normalizeAreaKey(area.name), entry);
    for (const alias of area.aliases) {
      const key = normalizeAreaKey(alias);
      if (key && !index.has(key)) {
        index.set(key, entry);
      }
    }
  }

  return index;
})();

export function matchLeadArea(areaText: string | null | undefined): GazeLeadAreaMatch | null {
  if (!areaText) {
    return null;
  }

  const key = normalizeAreaKey(areaText);
  if (!key) {
    return null;
  }

  const direct = areaMatchByKey.get(key);
  if (direct) {
    return direct;
  }

  const shorthandSlug = AREA_SHORTHANDS[key];
  if (shorthandSlug) {
    const shorthand = areaMatchByKey.get(normalizeAreaKey(shorthandSlug));
    if (shorthand) {
      return shorthand;
    }
  }

  // Lenient fallback: a known area name that is a prefix of the lead text
  // matches when unambiguous (e.g. "Koramangala 5th block" → Koramangala).
  const prefixMatches: GazeLeadAreaMatch[] = [];
  if (key.length >= 4) {
    for (const [candidateKey, entry] of areaMatchByKey) {
      if (
        candidateKey.length >= 4 &&
        key.startsWith(candidateKey) &&
        !prefixMatches.some((existing) => existing.slug === entry.slug)
      ) {
        prefixMatches.push(entry);
      }
    }
  }

  return prefixMatches.length === 1 ? prefixMatches[0]! : null;
}

/**
 * Reverse lookup: an explicit pincode (manually entered on a lead) resolves to
 * the first gazetteer area that contains it, so manually geo-tagged leads join
 * the same area aggregation as text-matched ones.
 */
export function matchLeadAreaByPincode(pincode: string | null | undefined): GazeLeadAreaMatch | null {
  if (!pincode || !/^[0-9]{6}$/.test(pincode.trim())) {
    return null;
  }

  const normalized = pincode.trim();
  for (const area of bengaluruAreas) {
    if (area.pincodes.includes(normalized)) {
      return {
        slug: area.slug,
        name: area.name,
        pincode: normalized,
      };
    }
  }

  return null;
}

// ── Lead mapping & aggregation ────────────────────────────────────────────────

export function resolveLeadPhase(status: string): GazeLeadPhase {
  if ((CRM_LEAD_OPEN_STATUSES as readonly string[]).includes(status)) {
    return 'open';
  }
  if (status === 'converted' || status === 'lost' || status === 'cancelled') {
    return status;
  }
  return 'open';
}

export type GazeLeadSourceRow = {
  id: string;
  status: string;
  priority: string;
  source: string;
  source_details: Record<string, unknown> | null;
  /** Manually entered pincode on the lead (highest-priority location signal). */
  pincode?: string | null;
  created_at: string;
  users?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

function leadAreaText(sourceDetails: Record<string, unknown> | null | undefined): string | null {
  const city = sourceDetails?.city;
  if (typeof city === 'string' && city.trim()) {
    return city.trim();
  }

  const extraFields = sourceDetails?.extra_fields;
  if (extraFields && typeof extraFields === 'object' && !Array.isArray(extraFields)) {
    const pincode = (extraFields as Record<string, unknown>).pincode;
    if (typeof pincode === 'string' && pincode.trim()) {
      return pincode.trim();
    }
  }

  return null;
}

export function buildGazeLeadPoints(rows: readonly GazeLeadSourceRow[]): GazeLeadPoint[] {
  return rows.map((row) => {
    const customerRow = Array.isArray(row.users) ? row.users[0] : row.users;
    const area = leadAreaText(row.source_details);
    const explicitPincode = row.pincode?.trim() || null;

    // Location resolution order: manual pincode (reverse-lookup area) → area
    // text match (gazetteer) → unmapped. An explicit pincode always wins for
    // the plotted pincode (coordinate accuracy) even when text matched too.
    const textMatch = matchLeadArea(area);
    const pincodeMatch = textMatch ? null : matchLeadAreaByPincode(explicitPincode);
    const match = textMatch ?? pincodeMatch;

    return {
      id: row.id,
      customerName: customerRow?.name?.trim() || null,
      area,
      areaSlug: match?.slug ?? null,
      areaName: match?.name ?? null,
      pincode: explicitPincode ?? match?.pincode ?? null,
      phase: resolveLeadPhase(row.status),
      isHot: row.priority === 'hot',
      source: row.source,
      createdAt: row.created_at,
    };
  });
}

export function aggregateLeadsByArea(points: readonly GazeLeadPoint[]): GazeLeadAreaStat[] {
  const statsBySlug = new Map<string, GazeLeadAreaStat>();

  for (const point of points) {
    if (!point.areaSlug || !point.areaName) {
      continue;
    }

    let stat = statsBySlug.get(point.areaSlug);
    if (!stat) {
      stat = {
        areaSlug: point.areaSlug,
        areaName: point.areaName,
        pincode: point.pincode,
        leadCount: 0,
        openCount: 0,
        hotCount: 0,
        convertedCount: 0,
        lostCount: 0,
        cancelledCount: 0,
        conversionRate: 0,
      };
      statsBySlug.set(point.areaSlug, stat);
    }

    stat.leadCount += 1;

    if (point.phase === 'open') stat.openCount += 1;
    else if (point.phase === 'converted') stat.convertedCount += 1;
    else if (point.phase === 'lost') stat.lostCount += 1;
    else if (point.phase === 'cancelled') stat.cancelledCount += 1;

    if (point.isHot && point.phase === 'open') {
      stat.hotCount += 1;
    }

    if (!stat.pincode && point.pincode) {
      stat.pincode = point.pincode;
    }
  }

  return Array.from(statsBySlug.values())
    .map((stat) => ({
      ...stat,
      conversionRate: stat.leadCount > 0 ? stat.convertedCount / stat.leadCount : 0,
    }))
    .sort((left, right) => right.leadCount - left.leadCount || left.areaName.localeCompare(right.areaName));
}

export function buildGazeLeadKpis(points: readonly GazeLeadPoint[]): GazeLeadKpis {
  let openLeads = 0;
  let hotLeads = 0;
  let convertedLeads = 0;
  let mappedLeads = 0;

  for (const point of points) {
    if (point.phase === 'open') {
      openLeads += 1;
    }
    if (point.phase === 'converted') {
      convertedLeads += 1;
    }
    if (point.isHot && point.phase === 'open') {
      hotLeads += 1;
    }
    if (point.areaSlug) {
      mappedLeads += 1;
    }
  }

  return {
    totalLeads: points.length,
    openLeads,
    hotLeads,
    convertedLeads,
    mappedLeads,
  };
}

// ── Status colour coding ──────────────────────────────────────────────────────

export type GazeLeadDisplayPhase = 'hot' | 'open' | 'converted' | 'lost' | 'cancelled';

/** Area bubble colours by dominant lead status. */
export const LEAD_PHASE_COLORS: Record<GazeLeadDisplayPhase, string> = {
  hot: '#dc2626',
  open: '#f59e0b',
  converted: '#16a34a',
  lost: '#64748b',
  cancelled: '#a3a3a3',
};

const DISPLAY_PHASE_PRECEDENCE: GazeLeadDisplayPhase[] = ['open', 'converted', 'lost', 'cancelled'];

/**
 * Colour coding for an area bubble: the status with the most leads in the area
 * (ties resolve open > converted > lost > cancelled). An open-dominant area
 * that contains hot leads shows as hot — the most actionable signal on the map.
 */
export function resolveLeadAreaDisplayPhase(stat: GazeLeadAreaStat): GazeLeadDisplayPhase {
  let winner: GazeLeadDisplayPhase = 'open';
  let winnerCount = -1;

  for (const phase of DISPLAY_PHASE_PRECEDENCE) {
    const count =
      phase === 'open'
        ? stat.openCount
        : phase === 'converted'
          ? stat.convertedCount
          : phase === 'lost'
            ? stat.lostCount
            : stat.cancelledCount;

    if (count > winnerCount) {
      winner = phase;
      winnerCount = count;
    }
  }

  if (winner === 'open' && stat.hotCount > 0) {
    return 'hot';
  }

  return winner;
}

export const LEAD_DISPLAY_PHASE_LABELS: Record<GazeLeadDisplayPhase, string> = {
  hot: 'Hot leads present (open)',
  open: 'Mostly open leads',
  converted: 'Mostly converted leads',
  lost: 'Mostly lost leads',
  cancelled: 'Mostly cancelled leads',
};


