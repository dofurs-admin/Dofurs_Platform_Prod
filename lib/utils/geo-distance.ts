const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

/**
 * Returns the great-circle distance in kilometres between two lat/lng points
 * using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    throw new RangeError(`Latitude must be between -90 and 90 (got ${lat1}, ${lat2})`);
  }
  if (lng1 < -180 || lng1 > 180 || lng2 < -180 || lng2 > 180) {
    throw new RangeError(`Longitude must be between -180 and 180 (got ${lng1}, ${lng2})`);
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
