/**
 * Biometric trend math utilities.
 *
 * The "trend weight" pattern (popularized by Hacker's Diet / Trendweight)
 * uses an Exponentially Weighted Moving Average so daily noise (food, water,
 * glycogen) is smoothed and the underlying body composition trajectory is
 * exposed.
 */

export interface WeightPoint {
  /** ISO date (yyyy-MM-dd) */
  date: string;
  /** Raw scale weight in kg */
  scale: number;
}

export interface TrendPoint extends WeightPoint {
  /** Smoothed EWMA trend in kg */
  trend: number;
}

/**
 * Compute the EWMA (smoothing factor alpha = 0.1 by default — about a 10-day
 * effective window). Input must be sorted ascending by date.
 */
export function computeWeightTrend(
  points: WeightPoint[],
  alpha = 0.1,
): TrendPoint[] {
  if (points.length === 0) return [];
  const out: TrendPoint[] = [];
  let trend = points[0].scale;
  for (const p of points) {
    trend = trend + alpha * (p.scale - trend);
    out.push({ ...p, trend: Number(trend.toFixed(2)) });
  }
  return out;
}

export type WeightFilter = "1W" | "1M" | "3M" | "6M" | "1Y" | "ALL";

const FILTER_DAYS: Record<WeightFilter, number | null> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  ALL: null,
};

/** Slice a sorted (asc) trend dataset by a time filter relative to the latest point. */
export function sliceByFilter<T extends { date: string }>(
  points: T[],
  filter: WeightFilter,
): T[] {
  const days = FILTER_DAYS[filter];
  if (!days || points.length === 0) return points;
  const latest = new Date(points[points.length - 1].date).getTime();
  const cutoff = latest - days * 24 * 3600 * 1000;
  return points.filter((p) => new Date(p.date).getTime() >= cutoff);
}

/** Find the trend value N days before the latest point (closest available). */
export function trendAtDaysAgo(points: TrendPoint[], daysAgo: number): number | null {
  if (points.length === 0) return null;
  const latest = new Date(points[points.length - 1].date).getTime();
  const target = latest - daysAgo * 24 * 3600 * 1000;
  let best: TrendPoint | null = null;
  let bestDiff = Infinity;
  for (const p of points) {
    const diff = Math.abs(new Date(p.date).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best?.trend ?? null;
}
