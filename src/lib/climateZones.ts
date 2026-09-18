// Static lat/lon-band climate zone lookup, used as a free "reverse geocode"
// substitute (per spec: Open-Meteo or a static band table). This is a coarse
// approximation based on absolute latitude and does not account for local
// topography, ocean currents or elevation.

export interface ClimateBandGuess {
  climateZone: string;
  note: string;
}

/**
 * Approximates a Köppen-style climate zone band from latitude/longitude.
 * A handful of well-known arid/semi-arid belts are special-cased for
 * better accuracy (e.g., the Thar Desert / Rajasthan belt used in the
 * canonical test scenario, the Sahara/Sahel, and Australian interior).
 */
export function estimateClimateZone(lat: number, lon: number): ClimateBandGuess {
  const absLat = Math.abs(lat);

  // Known semi-arid / arid belts (coarse bounding boxes).
  const knownBelts: { box: [number, number, number, number]; zone: string; note: string }[] = [
    { box: [20, 32, 68, 76], zone: "semi-arid", note: "Thar Desert / Rajasthan-Gujarat semi-arid belt" },
    { box: [10, 20, -18, 40], zone: "semi-arid", note: "Sahel semi-arid belt" },
    { box: [15, 30, -10, 60], zone: "arid", note: "Sahara / Arabian arid belt" },
    { box: [-35, -20, 115, 150], zone: "semi-arid", note: "Australian interior semi-arid belt" },
    { box: [30, 45, -120, -95], zone: "semi-arid", note: "North American Great Plains semi-arid belt" },
  ];

  for (const belt of knownBelts) {
    const [latMin, latMax, lonMin, lonMax] = belt.box;
    if (lat >= latMin && lat <= latMax && lon >= lonMin && lon <= lonMax) {
      return { climateZone: belt.zone, note: belt.note };
    }
  }

  if (absLat <= 10) return { climateZone: "tropical", note: "Equatorial band (±10°)" };
  if (absLat <= 23.5) return { climateZone: "tropical", note: "Tropical band (10-23.5°)" };
  if (absLat <= 35) return { climateZone: "semi-arid", note: "Subtropical band (23.5-35°), often arid/semi-arid" };
  if (absLat <= 55) return { climateZone: "temperate", note: "Mid-latitude temperate band (35-55°)" };
  return { climateZone: "humid", note: "High-latitude humid/continental-to-polar band (>55°)" };
}
